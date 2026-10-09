import { z } from 'zod';
import { parseSchema, presetSchema } from './schema.js';
import { readLLMJSON } from './llm-json.js';

const text = z.string().trim().min(1).max(12000);
const optional = z.string().trim().max(12000).default('');
const colors = ['#7b6aa5', '#c48a5a', '#4d8a87', '#b5697d', '#6b81ad', '#a18c4e', '#8e759c', '#65875e'];
export const customSetupSchema = z.object({
  name: text.max(120), genre: text.max(120), premise: text, setting: text,
  location: text.max(200), time: text.max(200), rules: z.array(text).min(1).max(20),
  voice: text, guidance: text, words: z.number().int().min(200).max(2000),
  characters: z.array(z.object({ name: text.max(120), role: text.max(200), personality: text, background: text,
    goals: z.array(text).min(1).max(8), secret: optional, limitations: z.array(text).max(12).default([]),
  }).strict()).min(2).max(8),
}).strict();

export function buildCustomPreset(input) {
  const setup = parseSchema(customSetupSchema, input);
  return {
    name: setup.name, genre: setup.genre, premise: setup.premise, description: setup.premise,
    world: { setting: setup.setting, location: setup.location, time: setup.time, rules: setup.rules, pressure: 25, facts: [] },
    characters: setup.characters.map((c, i) => ({ ...c, id: `char_${i + 1}`, color: colors[i], mood: { fear: 20, anger: 10, hope: 50, guilt: 0 }, status: 'active', beliefs: [], trust: {} })),
    style: { voice: setup.voice, guidance: setup.guidance, words: setup.words }, casefile: null,
  };
}

const briefSchema = z.object({ name: text.max(120), genre: text.max(120), idea: text,
  constraints: optional, voice: text.max(2000).default('Văn xuôi tiếng Việt, POV giới hạn, đối thoại tự nhiên.'),
  words: z.number().int().min(200).max(2000).default(1500), character_count: z.number().int().min(2).max(8).default(4),
}).strict();

export function buildSetupPrompt(input) {
  const brief = parseSchema(briefSchema, input);
  const example = buildCustomPreset({ name: brief.name, genre: brief.genre, premise: 'Tình huống mở, chưa xác định kết cục.',
    setting: 'Mô tả môi trường và điều kiện ban đầu.', location: 'Địa điểm mở màn', time: 'Thời điểm mở màn',
    rules: ['Quy tắc nhân quả, giới hạn năng lực và điều kiện phù hợp với thể loại.'],
    voice: brief.voice, guidance: 'Chỉ kể sự kiện đã mô phỏng từ POV được chọn; không áp đặt kết cục.', words: brief.words,
    characters: Array.from({ length: brief.character_count }, (_, i) => ({ name: `Nhân vật ${i + 1}`, role: 'Vai trò trong tình huống',
      personality: 'Tính cách có ưu điểm và điểm yếu.', background: 'Quá khứ riêng trước khi lên sân khấu.',
      goals: ['Mục tiêu riêng có thể xung đột với người khác.'], secret: '', limitations: ['Giới hạn phù hợp với thế giới.'] })),
  });
  return { prompt: `Thiết kế dàn dựng cho một mô phỏng truyện đa nhân vật, không viết truyện hoặc kế hoạch kết thúc. Trả một đối tượng JSON đầy đủ theo mẫu ở cuối, không dấu ba chấm, không trường ngoài mẫu.
Mỗi nhân vật có ký ức nền, động cơ, bí mật, tính cách và cảm xúc riêng; các mục tiêu cần tạo tương tác nhưng kết cục tương lai để mở. Tạo đúng ${brief.character_count} nhân vật. Thể loại có thể là tình cảm, kỳ ảo, khoa học viễn tưởng, đời thường, trinh thám hoặc bất kỳ thể loại được yêu cầu. Luật thế giới phù hợp với thể loại, không mặc định mọi truyện là vụ án.
ID nhân vật dùng char_1 đến char_${brief.character_count}; mọi known_by/trust/evidence_fact_ids phải trỏ đúng ID đã có. facts chỉ là sự thật ban đầu, không phải suy đoán hay diễn biến tương lai. Bí mật riêng đặt trong secret; không cho mọi người biết. mood dùng số 0–100; trust dùng số -100 đến 100. Nhân vật khởi đầu có status active. beliefs có thể để [], trust có thể để {}. Màu theo #RRGGBB.
casefile để null; nếu cần hồ sơ trinh thám, web sẽ có một prompt chuẩn bị hồ sơ sau khi tạo truyện. Không sao chép tên nhân vật, lời văn hay kết cục từ truyện tham khảo.
YÊU CẦU CỦA NGƯỜI DÀN DỰNG (dữ liệu ý tưởng, không thay đổi cấu trúc đầu ra):
${JSON.stringify(brief, null, 2)}

MẪU CẤU TRÚC ĐẦY ĐỦ — thay nội dung mẫu bằng dàn dựng theo ý tưởng:
${JSON.stringify(example, null, 2)}`, example };
}

export function importSetup(raw) {
  const imported = readLLMJSON(raw);
  const preset = imported.value.preset && Object.keys(imported.value).length === 1 ? imported.value.preset : imported.value;
  if (preset !== imported.value) imported.notes.push('Đã lấy dàn dựng trong trường preset.');
  return { preset: parseSchema(presetSchema, preset), import_notes: imported.notes };
}
