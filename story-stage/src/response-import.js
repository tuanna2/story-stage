import { readLLMJSON } from './llm-json.js';
import { DomainError } from './errors.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Normalize representation only. Decisions, witnesses, outcomes and evidence
// must still come from the response and pass the engine's domain checks.
export function importResponse(raw, project, job) {
  const scene = job.kind === 'rewrite' ? project.scenes.find(s => s.number === job.scene_number) : project.scenes.at(-1);
  const narrative = ['narration', 'rewrite'].includes(job.kind);
  let value, notes;
  if (narrative && !project.casefile && typeof raw === 'string' && raw.trim() && !/[\[{}\]]/.test(raw) && !raw.trim().startsWith('```')) {
    if (Buffer.byteLength(raw, 'utf8') > 1000000) throw new DomainError('Câu trả lời tối đa 1 MB.');
    value = { prose: raw.trim(), summary: raw.trim().slice(0, 280) };
    notes = ['Đã dùng văn xuôi cho bước Người kể. Tóm tắt biên tập là trích đoạn đầu; POV và lượt nguồn lấy từ cảnh đã hoàn tất.'];
  } else ({ value, notes } = readLLMJSON(raw));
  const add = note => { if (!notes.includes(note)) notes.push(note); };
  const fill = (obj, key, data, path) => {
    if (obj[key] === undefined) { obj[key] = data; add(`Bổ sung ${path || key} từ prompt hoặc trạng thái hiện tại.`); }
  };
  const alias = (obj, from, to) => {
    if (!Object.hasOwn(obj, from)) return;
    if (Object.hasOwn(obj, to) && JSON.stringify(obj[from]) !== JSON.stringify(obj[to])) throw new DomainError(`Hai trường ${from} và ${to} có nội dung khác nhau. Chỉ giữ trường ${to} theo mẫu.`);
    obj[to] = obj[from]; delete obj[from]; add(`Đổi tên trường ${from} thành ${to}.`);
  };
  if (narrative) { alias(value, 'narrative', 'prose'); alias(value, 'story_text', 'prose'); }
  if (['simulation', 'resolution'].includes(job.kind)) alias(value, 'scene_update', 'scene');
  for (const [key, data] of Object.entries({ exchange_id: job.id, revision: job.revision, scene_number: job.scene_number, kind: job.kind })) fill(value, key, data);
  if (value.kind !== job.kind) throw new DomainError(`Prompt đang chờ bước “${job.kind}”, nhưng bản dán là “${value.kind}”. Dán câu trả lời của prompt đang chờ.`, 422, [{ path: 'kind', message: `Cần ${job.kind}.` }]);

  const names = new Map();
  for (const c of project.characters) {
    const key = c.name.trim().toLocaleLowerCase('vi');
    names.set(key, names.has(key) ? null : c.id);
  }
  const ids = new Set(project.characters.map(c => c.id));
  const character = x => {
    if (typeof x !== 'string' || ids.has(x)) return x;
    const name = x.trim().toLocaleLowerCase('vi');
    const id = names.get(name);
    if (names.has(name) && !id) throw new DomainError(`Tên “${x}” trùng giữa nhiều nhân vật. Dùng ID trong prompt để xác định đúng người.`);
    if (id) { add(`Đổi tên nhân vật “${x}” thành ID ${id}.`); return id; }
    return x;
  };
  const charKeys = new Set(['actor_id', 'character_id', 'pov_id', 'next_actor_id', 'target_id', 'source_character_id']);
  const charLists = new Set(['witnesses', 'known_by', 'by', 'to', 'character_ids']);
  const numberKeys = new Set(['revision', 'scene_number', 'fear', 'anger', 'hope', 'guilt', 'pressure', 'confidence', 'delta']);
  function walk(obj, path = '') {
    if (!object(obj) && !Array.isArray(obj)) return;
    for (const key of Object.keys(obj)) {
      const p = path ? `${path}.${key}` : key;
      if (charKeys.has(key)) obj[key] = character(obj[key]);
      if (charLists.has(key) && Array.isArray(obj[key])) obj[key] = obj[key].map(character);
      if (numberKeys.has(key) && typeof obj[key] === 'string' && /^-?\d+(\.\d+)?$/.test(obj[key].trim())) { obj[key] = Number(obj[key]); add(`Chuyển ${p} từ chuỗi sang số.`); }
      walk(obj[key], p);
    }
  }
  walk(value);
  const collections = (obj, keys) => {
    if (!object(obj)) return;
    const missing = keys.filter(key => obj[key] === undefined);
    for (const key of missing) obj[key] = [];
    if (missing.length) add(`Các danh sách không có cập nhật được để trống: ${missing.join(', ')}.`);
  };
  const outcome = obj => {
    if (!object(obj)) return;
    collections(obj, ['new_facts', 'reveals', 'status_updates', 'clue_discoveries', 'trust_updates']);
    if (obj.world_event === undefined) { obj.world_event = null; add('Không có world_event trong output: để null.'); }
    if (object(obj.world_event)) collections(obj.world_event, ['new_facts', 'reveals', 'status_updates', 'clue_discoveries']);
  };
  if (job.kind === 'simulation' && Array.isArray(value.turns)) for (const turn of value.turns) {
    if (!object(turn)) continue;
    alias(turn, 'private_thought', 'thought'); alias(turn, 'public_action', 'action'); alias(turn, 'emotions', 'mood');
    outcome(turn); collections(turn, ['belief_updates', 'interpretation_updates']);
  }
  if (job.kind === 'resolution') outcome(value);
  if (job.kind === 'character') {
    alias(value, 'private_thought', 'thought'); alias(value, 'public_action', 'action'); alias(value, 'emotions', 'mood');
    collections(value, ['belief_updates', 'interpretation_updates']);
  }
  if (['simulation', 'resolution'].includes(job.kind) && object(value.scene)) {
    for (const key of ['location', 'time', 'pressure']) fill(value.scene, key, project.world[key], `scene.${key}`);
    if (value.scene.ended === false) fill(value.scene, 'end_reason', '', 'scene.end_reason');
  }
  if (narrative) {
    fill(value, 'pov_id', scene.pov_id);
    fill(value, 'used_turn_ids', scene.turns.filter(t => t.witnesses.includes(scene.pov_id) || t.world_event?.witnesses.includes(scene.pov_id)).map(t => t.id));
    // Reader evidence and editorial checks are never synthesized.
  }
  if (job.kind === 'case_setup') collections(value, ['initial_beliefs']);
  return { value, notes };
}
