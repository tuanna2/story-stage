import test from 'node:test';
import assert from 'node:assert/strict';
import { readLLMJSON } from '../src/llm-json.js';
import { createProject, nextJob, previewResponse, acceptResponse } from '../src/engine.js';
import { batch, narration } from './fixtures.js';

test('Đọc lời dẫn, Markdown, dấu phẩy cuối, nháy đơn và nháy cong', () => {
  const cases = [
    'Đây là kết quả:\n```json\n{"kind":"simulation", "turns":[],}\n```\nBạn có thể dán vào web.',
    "{'kind': 'simulation', 'turns': [],}",
    '{“kind”:“simulation”,“turns”:[]}',
    '{"kind":"simulation",/* kết quả */"turns":[]}',
  ];
  for (const raw of cases) {
    const result = readLLMJSON(raw);
    assert.deepEqual(result.value, { kind: 'simulation', turns: [] }); assert.ok(result.notes.length);
  }
});

test('Mở lớp response, mảng một output và JSON được bọc thành chuỗi', () => {
  const value = { kind: 'simulation', turns: [] };
  for (const wrapped of [{ response: value, notes: 'x' }, [value], JSON.stringify(value)]) {
    assert.deepEqual(readLLMJSON(JSON.stringify(wrapped)).value, value);
  }
});

test('Không ghép nhiều output, không thêm phần bị cắt dở hoặc xóa dấu lược bỏ', () => {
  for (const raw of ['{"kind":"simulation"}\n{"kind":"narration"}', '{"kind":"simulation","turns":[', '{"kind":"simulation","turns":[...]}', '{"kind":"simulation",…}']) {
    assert.throws(() => readLLMJSON(raw));
  }
  assert.equal(readLLMJSON('{"prose":"Tôi đợi..."}').value.prose, 'Tôi đợi...');
  assert.throws(() => readLLMJSON('Một cảnh truyện bằng văn xuôi.'), /JSON/);
});

test('Chuẩn hóa metadata thiếu, tên nhân vật, số dạng chuỗi; preview không ghi dữ liệu', () => {
  const p = createProject({ config: { batch_size: 1 } }), job = nextJob(p);
  const response = batch(p, job);
  delete response.exchange_id; delete response.kind;
  response.revision = '0'; response.scene_number = '1';
  const t = response.turns[0], c = p.characters.find(c => c.id === t.actor_id);
  t.actor_id = c.name; t.witnesses = [c.name]; response.scene.pov_id = c.name;
  t.mood.fear = '35'; delete t.new_facts; delete t.reveals; delete t.world_event;
  const raw = `Đây là output:\n\`\`\`json\n${JSON.stringify({ response }, null, 2).replace(/\n}$/, ',\n}')}\n\`\`\``;
  const before = structuredClone(p), v = previewResponse(p, job.id, raw);
  assert.deepEqual(p, before); assert.equal(v.normalized_response.exchange_id, job.id);
  assert.equal(v.normalized_response.turns[0].actor_id, c.id); assert.equal(v.normalized_response.turns[0].mood.fear, 35);
  assert.deepEqual(v.normalized_response.turns[0].new_facts, []); assert.ok(v.import_notes.length >= 5);
  acceptResponse(p, job.id, raw);
  assert.equal(p.exchanges[0].raw_response, raw); assert.deepEqual(p.exchanges[0].response, v.normalized_response);
  assert.deepEqual(p.exchanges[0].import_notes, v.import_notes);
});

test('Alias rõ nghĩa được đọc, alias mâu thuẫn và thiếu hành động không được tự dựng', () => {
  const p = createProject({ config: { batch_size: 1 } }), j = nextJob(p), r = batch(p, j);
  r.turns[0].private_thought = r.turns[0].thought; delete r.turns[0].thought;
  assert.equal(previewResponse(p, j.id, JSON.stringify(r)).normalized_response.turns[0].thought, r.turns[0].private_thought);
  r.turns[0].thought = 'Một nội tâm khác.';
  assert.throws(() => previewResponse(p, j.id, JSON.stringify(r)), /nội dung khác/);
  delete r.turns[0].thought; delete r.turns[0].action;
  assert.throws(() => previewResponse(p, j.id, JSON.stringify(r)), error => error.details.some(d => d.path === 'turns.0.action'));
});

test('Sai metadata rõ ràng, chứng kiến, phạm vi biết hoặc mood vẫn bị chặn và rollback', () => {
  const p = createProject({ config: { batch_size: 1 } }), j = nextJob(p), before = structuredClone(p);
  const edits = [
    r => { r.revision = 9; }, r => { r.exchange_id = 'x_old'; }, r => { r.kind = 'narration'; },
    r => { r.turns[0].witnesses = ['Người chưa có trong dàn vai']; },
    r => { r.turns[0].mood.fear = '101'; },
    r => { r.turns[0].new_facts = [{ id: 'f_bad', text: 'Một sự thật chưa chứng kiến.', known_by: [p.characters[1].name] }]; },
  ];
  for (const edit of edits) {
    const r = batch(p, j); edit(r); assert.throws(() => acceptResponse(p, j.id, JSON.stringify(r))); assert.deepEqual(p, before);
  }
});

test('Tên trùng không được đoán thành ID của một nhân vật', () => {
  const p = createProject({ config: { batch_size: 1 } }); p.characters[0].name = p.characters[1].name = 'Lan';
  const j = nextJob(p), r = batch(p, j); r.turns[0].actor_id = 'Lan'; r.turns[0].witnesses = ['Lan'];
  assert.throws(() => previewResponse(p, j.id, JSON.stringify(r)), /trùng giữa nhiều nhân vật/);
});

test('Người kể truyện thường có thể dán văn xuôi; metadata nguồn lấy từ cảnh đã mô phỏng', () => {
  const p = createProject({ config: { max_turns: 1, batch_size: 1 } });
  const j = nextJob(p); acceptResponse(p, j.id, JSON.stringify(batch(p, j))); const nj = nextJob(p);
  const prose = 'Tôi nghe tiếng đồng hồ. Câu hỏi vừa rồi vẫn chưa có lời đáp.';
  const v = previewResponse(p, nj.id, prose);
  assert.equal(v.prose, prose); assert.deepEqual(v.normalized_response.used_turn_ids, [p.scenes[0].turns[0].id]);
  assert.ok(v.import_notes.some(n => n.includes('văn xuôi')));
  const r = narration(p, nj); delete r.pov_id; delete r.used_turn_ids; r.narrative = r.prose; delete r.prose;
  assert.equal(previewResponse(p, nj.id, JSON.stringify(r)).prose, r.narrative);
});

test('Vụ án vẫn đòi bằng chứng Reader và editorial_check thật', () => {
  const p = createProject({ preset_id: 'rain-case', config: { max_turns: 1, batch_size: 1 } });
  const j = nextJob(p); acceptResponse(p, j.id, JSON.stringify(batch(p, j))); const nj = nextJob(p);
  assert.throws(() => previewResponse(p, nj.id, 'Tôi nghe tiếng mưa.'), /JSON/);
  const r = narration(p, nj);
  assert.throws(() => previewResponse(p, nj.id, JSON.stringify(r)), /reader_updates|editorial_check/);
});
