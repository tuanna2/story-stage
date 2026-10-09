import { jsonrepair } from 'jsonrepair';
import { DomainError } from './errors.js';

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const looksLikeOutput = v => object(v) && ['kind', 'turns', 'outcome', 'prose', 'narrative', 'action', 'casefile', 'preset', 'world', 'response', 'result', 'data', 'output'].some(k => Object.hasOwn(v, k));

// Extract complete top-level containers, respecting strings and comments.
// Incomplete outputs are never repaired by inventing their missing ending.
function containers(text) {
  const found = []; let start = -1, stack = [], quote = null, escaped = false, comment = null, omitted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (start < 0) { if (c === '{' || c === '[') { start = i; stack = [c]; } continue; }
    if (comment === 'line') { if (c === '\n') comment = null; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { comment = null; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && next === '/') { comment = 'line'; i++; continue; }
    if (c === '/' && next === '*') { comment = 'block'; i++; continue; }
    if (['"', "'", '“', '‘'].includes(c)) { quote = c === '“' ? '”' : c === '‘' ? '’' : c; continue; }
    if ((c === '.' && text.slice(i, i + 3) === '...') || c === '…') omitted = true;
    if (c === '{' || c === '[') stack.push(c);
    if (c === '}' || c === ']') {
      if (stack.at(-1) !== (c === '}' ? '{' : '[')) return { found, incomplete: true };
      stack.pop();
      if (!stack.length) { found.push(text.slice(start, i + 1)); start = -1; }
    }
  }
  return { found, incomplete: start >= 0, omitted };
}
function decode(text) {
  try { return { value: JSON.parse(text), repaired: false }; }
  catch { try { return { value: JSON.parse(jsonrepair(text)), repaired: true }; } catch { return null; } }
}
export function readLLMJSON(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 1000000) throw new DomainError('Câu trả lời cần là văn bản, tối đa 1 MB.');
  const clean = raw.replace(/^\uFEFF/, '').trim(); const notes = [];
  if (!clean) throw new DomainError('Ô câu trả lời đang trống. Dán output ChatGPT trước khi kiểm tra.');
  let direct;
  try { direct = { value: JSON.parse(clean), repaired: false }; } catch {}
  if (typeof direct?.value === 'string') {
    try { direct.value = JSON.parse(direct.value); notes.push('Đã mở JSON được bọc trong một chuỗi.'); } catch { direct = null; }
  }
  let chosen = direct;
  if (!chosen) {
    const scan = containers(clean);
    if (scan.omitted) throw new DomainError('JSON có dấu ba chấm thay cho nội dung bị lược bỏ. Yêu cầu ChatGPT trả toàn bộ dữ liệu, không dùng ... hoặc … ngoài chuỗi văn bản.');
    if (scan.incomplete) throw new DomainError('JSON đang bị cắt dở hoặc thiếu dấu đóng. Sao chép toàn bộ output; nếu ChatGPT dừng giữa chừng, yêu cầu trả lại JSON đầy đủ.', 422, [{ path: 'output', message: 'Chưa có đối tượng JSON hoàn chỉnh; không tự thêm phần nội dung bị thiếu.' }]);
    const candidates = scan.found.map(text => ({ text, ...decode(text) })).filter(c => c.value !== undefined);
    const recognizable = candidates.filter(c => looksLikeOutput(Array.isArray(c.value) && c.value.length === 1 ? c.value[0] : c.value));
    const possible = recognizable.length ? recognizable : candidates;
    if (possible.length > 1) throw new DomainError('Có nhiều khối JSON trong bản dán. Chỉ giữ câu trả lời cho prompt đang chờ, bỏ ví dụ và câu trả lời cũ.');
    chosen = possible[0];
    if (!chosen) throw new DomainError('Chưa nhận diện được JSON. Bước này cần dữ liệu theo mẫu trong prompt, không chỉ văn xuôi. Dùng “Prompt sửa câu trả lời” để chuyển output về đúng mẫu.', 422, [{ path: 'output', message: 'Cần một đối tượng { ... }. Có thể dán cả lời dẫn và khối ```json.' }]);
    if (chosen.text !== clean) notes.push('Đã lấy khối JSON khỏi lời dẫn hoặc Markdown.');
  }
  if (chosen.repaired) notes.push('Đã sửa cú pháp JSON (dấu nháy, dấu phẩy hoặc xuống dòng). Đọc lại bản chuẩn hóa trước khi nhập.');
  let value = chosen.value;
  if (Array.isArray(value) && value.length === 1 && object(value[0])) { value = value[0]; notes.push('Đã mở mảng chứa một đối tượng.'); }
  for (let i = 0; i < 3 && object(value); i++) {
    const wrapper = ['response', 'result', 'output', 'data'].find(k => object(value[k]) && Object.keys(value).every(x => [k, 'notes', 'explanation', 'commentary'].includes(x)));
    if (!wrapper) break;
    value = value[wrapper]; notes.push(`Đã mở lớp bọc ${wrapper}.`);
  }
  if (!object(value)) throw new DomainError('Output cần là một đối tượng JSON. Không dán riêng mảng turns hoặc từng lượt rời.');
  return { value, notes };
}
