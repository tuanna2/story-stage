import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, nextJob, acceptResponse, previewResponse, cancelJob, exportStory, exportPreset, cleanPreset } from '../src/engine.js';
import { presets } from '../src/presets.js';
import { characterView } from '../src/memory.js';
import { batch, narration, actor, resolution } from './fixtures.js';

test('Các preset hợp lệ, có ký ức và bí mật riêng', () => {
  for (const preset of presets) {
    const p = createProject({ preset_id: preset.id });
    assert.equal(p.characters.length, 4);
    assert.equal(p.scenes.length, 1);
    for (const c of p.characters) { assert.equal(c.memories.length, 2); assert.deepEqual(p.world.facts.find(f => f.id === `secret_${c.id}`).known_by, [c.id]); }
  }
});
test('Preset không cho ID nhân vật trùng hoặc căn cứ không biết', () => {
  const preset = cleanPreset(presets[0]); preset.characters[1].id = preset.characters[0].id;
  assert.throws(() => createProject({ preset }), /duy nhất/);
  const other = cleanPreset(presets[0]); other.characters[0].beliefs = [{ text: 'Tôi biết hồ sơ bị bỏ.', confidence: 80, evidence_fact_ids: ['f-report'] }];
  assert.throws(() => createProject({ preset: other }), /chưa biết/);
});
test('Prompt nhân vật cách ly không chứa bí mật hoặc sự thật của người khác', () => {
  const p = createProject({ config: { mode: 'isolated' } }), j = nextJob(p);
  assert.equal(j.kind, 'character');
  assert.ok(j.prompt.includes('secret_phong'));
  assert.ok(!j.prompt.includes('f-report'));
  assert.ok(!j.prompt.includes(p.characters.find(c => c.id === 'quan').secret));
  assert.ok(!j.prompt.includes('secret_quan'));
  assert.deepEqual(characterView(p, 'phong').known_facts.map(f => f.id), ['f-missing', 'f-arrival', 'f-thu', 'f-athlete', 'secret_phong']);
});
test('Tạo lại trả prompt đang chờ; hủy làm prompt cũ vô hiệu', () => {
  const p = createProject({}), j = nextJob(p);
  assert.equal(nextJob(p).id, j.id);
  cancelJob(p, j.id);
  assert.throws(() => acceptResponse(p, j.id, JSON.stringify(batch(p, j))), /bị hủy/);
  assert.notEqual(nextJob(p).id, j.id);
});
test('Preview không đổi trạng thái; nhập một lần tăng revision', () => {
  const p = createProject({ config: { batch_size: 3 } }), j = nextJob(p), raw = JSON.stringify(batch(p, j));
  const before = JSON.stringify(p), preview = previewResponse(p, j.id, raw);
  assert.equal(preview.new_turns.length, 3); assert.equal(JSON.stringify(p), before);
  acceptResponse(p, j.id, raw); assert.equal(p.revision, 1); assert.equal(p.scenes[0].turns.length, 3);
  assert.throws(() => acceptResponse(p, j.id, raw), /lần thứ hai/);
});
test('Câu trả lời trong code fence được đọc; ID/version sai bị chặn', () => {
  const p = createProject({}), j = nextJob(p), result = batch(p, j);
  assert.throws(() => acceptResponse(p, j.id, JSON.stringify({ ...result, revision: 999 })), /không khớp/);
  acceptResponse(p, j.id, `\`\`\`json\n${JSON.stringify(result)}\n\`\`\``);
  assert.equal(p.revision, 1);
});
test('Ghi đè sự thật bị chặn và toàn bộ packet rollback', () => {
  const p = createProject({}), j = nextJob(p), result = batch(p, j), before = JSON.stringify(p);
  result.turns[1].new_facts = [{ id: 'f-thu', text: 'Sửa Tiểu Thu thành người.', known_by: ['quan'] }];
  assert.throws(() => acceptResponse(p, j.id, JSON.stringify(result)), /ghi đè/);
  assert.equal(JSON.stringify(p), before);
});
test('Witness/knowledge và người hành động phải hợp lệ', () => {
  const p = createProject({}), j = nextJob(p), result = batch(p, j);
  result.turns[0].new_facts = [{ id: 'f-new', text: 'Một điều chỉ Tần Phong nghe.', known_by: ['lam'] }];
  assert.throws(() => acceptResponse(p, j.id, JSON.stringify(result)), /nhóm chứng kiến/);
  result.turns[0].new_facts = []; result.turns[0].witnesses = ['quan'];
  assert.throws(() => acceptResponse(p, j.id, JSON.stringify(result)), /witnesses/);
});
test('Sự kiện chỉ gửi ký ức tới người chứng kiến', () => {
  const p = createProject({ config: { batch_size: 1 } }), j = nextJob(p), result = batch(p, j);
  result.turns[0].world_event = { text: 'Một cuộc gọi chỉ Bác Từ nghe thấy.', witnesses: ['tu'], new_facts: [{ id: 'f-phone', text: 'Kho hồ sơ sắp đóng cửa.', known_by: ['tu'] }], reveals: [] };
  acceptResponse(p, j.id, JSON.stringify(result));
  assert.ok(p.characters.find(c => c.id === 'tu').memories.some(m => m.text.includes('Một cuộc gọi')));
  assert.ok(!p.characters.find(c => c.id === 'quan').memories.some(m => m.text.includes('Một cuộc gọi')));
  assert.ok(!characterView(p, 'phong').known_facts.some(f => f.id === 'f-phone'));
});
test('Lượt sau trong packet được dùng sự thật đã học từ lượt trước', () => {
  const p = createProject({}), j = nextJob(p), result = batch(p, j);
  result.turns[0].witnesses.push('quan');
  result.turns[0].new_facts = [{ id: 'f-hall', text: 'Ngoài hành lang có người chờ.', known_by: ['phong', 'quan'] }];
  result.turns[1].belief_updates = [{ text: 'Có thể người ấy mang hồ sơ.', confidence: 30, evidence_fact_ids: ['f-hall'] }];
  acceptResponse(p, j.id, JSON.stringify(result));
  assert.equal(p.characters.find(c => c.id === 'quan').beliefs.length, 1);
});
test('Niềm tin không được dựa trên bí mật chưa biết; mood ngoài 0–100 bị chặn', () => {
  const p = createProject({}), j = nextJob(p), result = batch(p, j);
  result.turns[0].belief_updates = [{ text: 'Tề Quân biết hồ sơ.', confidence: 90, evidence_fact_ids: ['f-report'] }];
  assert.throws(() => acceptResponse(p, j.id, JSON.stringify(result)), /chưa biết/);
  result.turns[0].belief_updates = []; result.turns[0].mood.fear = 1000;
  assert.throws(() => acceptResponse(p, j.id, JSON.stringify(result)), /cấu trúc/);
});
test('Giới hạn lượt chuyển sang narration, không gọi thêm WorldAgent để kết thúc', () => {
  const p = createProject({ config: { max_turns: 3 } }), j = nextJob(p);
  acceptResponse(p, j.id, JSON.stringify(batch(p, j)));
  assert.equal(p.scenes[0].status, 'awaiting_narration'); assert.equal(nextJob(p).kind, 'narration');
});
test('Cảnh được kết thúc sớm nhưng không được âm thầm thiếu lượt', () => {
  const p = createProject({}), j = nextJob(p), result = batch(p, j); result.turns = result.turns.slice(0, 1);
  assert.throws(() => acceptResponse(p, j.id, JSON.stringify(result)), /đủ số lượt/);
  result.scene.ended = true; result.scene.end_reason = 'Cần đợi hồ sơ.';
  acceptResponse(p, j.id, JSON.stringify(result)); assert.equal(p.scenes[0].status, 'awaiting_narration');
});
test('Narrator không thấy nội tâm của nhân vật khác hoặc log ngoài POV', () => {
  const p = createProject({ config: { max_turns: 3 } }), j = nextJob(p);
  acceptResponse(p, j.id, JSON.stringify(batch(p, j)));
  const nj = nextJob(p);
  assert.ok(nj.prompt.includes('Nội tâm riêng của phong.'));
  assert.ok(!nj.prompt.includes('Nội tâm riêng của quan.'));
  assert.ok(!nj.prompt.includes('t_1_2'));
  const nr = narration(p, nj); nr.used_turn_ids.push('t_1_2');
  assert.throws(() => acceptResponse(p, nj.id, JSON.stringify(nr)), /POV chứng kiến/);
});
test('Narration hoàn tất cảnh, tóm tắt ký ức theo cá nhân rồi mở cảnh tiếp', () => {
  const p = createProject({ config: { max_turns: 3, max_scenes: 2 } }), j = nextJob(p);
  acceptResponse(p, j.id, JSON.stringify(batch(p, j)));
  const nj = nextJob(p); acceptResponse(p, nj.id, JSON.stringify(narration(p, nj)));
  assert.equal(p.scenes[0].status, 'complete'); assert.equal(p.scenes.length, 2);
  assert.ok(p.characters.find(c => c.id === 'quan').memories.find(m => m.type === 'summary').text.includes('quan'));
  assert.ok(!p.characters.find(c => c.id === 'quan').memories.find(m => m.type === 'summary').text.includes('Nội tâm riêng của phong'));
  assert.equal(p.characters.find(c => c.id === 'tu').memories.length, 2);
  assert.ok(exportStory(p).includes('## Cảnh 1:'));
});
test('Tách nhân vật dùng 2 bước/turn; World chỉ nhận hành động công khai', () => {
  const p = createProject({ config: { mode: 'isolated', max_scenes: 1 } }), j = nextJob(p);
  const ar = actor(p, j); acceptResponse(p, j.id, JSON.stringify(ar));
  assert.equal(p.scenes[0].turns.length, 0); assert.equal(p.characters[0].mood.anger, 73);
  const wj = nextJob(p); assert.equal(wj.kind, 'resolution'); assert.ok(!wj.prompt.includes(ar.thought));
  acceptResponse(p, wj.id, JSON.stringify(resolution(p, wj)));
  assert.equal(p.scenes[0].turns.length, 1); assert.equal(p.characters[0].mood.anger, 51);
  const nj = nextJob(p); acceptResponse(p, nj.id, JSON.stringify(narration(p, nj)));
  assert.equal(p.status, 'complete'); assert.throws(() => nextJob(p), /tối đa/);
});
test('Preset xuất ra có thể tạo truyện mới từ trạng thái đang có', () => {
  const p = createProject({}); assert.equal(createProject({ preset: exportPreset(p) }).characters.length, 4);
});

test('Trạng thái vắng/chết được duyệt và không tiếp tục xếp lượt cho nhân vật ấy', () => {
  const p = createProject({ config: { batch_size: 1 } }), j = nextJob(p), result = batch(p, j);
  result.turns[0].status_updates = [{ character_id: 'phong', status: 'absent', reason: 'Tần Phong được đưa sang phòng nghỉ.' }];
  const preview = previewResponse(p, j.id, JSON.stringify(result));
  assert.deepEqual(preview.changed_statuses, [{ id: 'phong', name: 'Tần Phong', status: 'absent' }]);
  acceptResponse(p, j.id, JSON.stringify(result));
  assert.ok(!nextJob(p).actor_ids.includes('phong'));
});

test('Thứ tự actor tiếp nối qua cảnh, không bỏ mãi nhân vật thứ tư', () => {
  const p = createProject({ config: { max_turns: 3 } }), j = nextJob(p);
  acceptResponse(p, j.id, JSON.stringify(batch(p, j)));
  const nj = nextJob(p); acceptResponse(p, nj.id, JSON.stringify(narration(p, nj)));
  assert.equal(nextJob(p).actor_ids[0], 'tu');
});

test('Preset hiện tại giữ người đã biết bí mật và niềm tin dựa trên bí mật', () => {
  const p = createProject({ config: { batch_size: 1 } }), j = nextJob(p), result = batch(p, j);
  result.turns[0].witnesses.push('quan');
  result.turns[0].reveals = [{ fact_id: 'secret_phong', to: ['quan'] }];
  result.turns[0].belief_updates = [{ text: 'Tôi cần hỏi về lần gặp cũ.', confidence: 70, evidence_fact_ids: ['secret_phong'] }];
  acceptResponse(p, j.id, JSON.stringify(result));
  const next = createProject({ preset: exportPreset(p) });
  assert.ok(next.world.facts.find(f => f.id === 'secret_phong').known_by.includes('quan'));
  assert.equal(next.world.facts.filter(f => f.id === 'secret_phong').length, 1);
  assert.equal(next.characters[0].beliefs[0].evidence_fact_ids[0], 'secret_phong');
});

test('World không được hồi sinh nhân vật đã chết', () => {
  const preset = cleanPreset(presets[0]); preset.characters.find(c => c.id === 'tu').status = 'dead';
  const p = createProject({ preset, config: { batch_size: 1 } }), j = nextJob(p), result = batch(p, j);
  result.turns[0].witnesses.push('tu');
  result.turns[0].status_updates = [{ character_id: 'tu', status: 'active', reason: 'Ông bất ngờ trở lại.' }];
  assert.throws(() => acceptResponse(p, j.id, JSON.stringify(result)), /hồi sinh/);
});

test('World chọn actor theo diễn biến trong packet và gợi ý actor cho bước tiếp', () => {
  const p = createProject({ config: { batch_size: 1 } }), j = nextJob(p), result = batch(p, j);
  result.turns[0].actor_id = 'tu'; result.turns[0].witnesses = ['tu'];
  result.scene.pov_id = 'tu'; result.scene.next_actor_id = 'lam';
  acceptResponse(p, j.id, JSON.stringify(result));
  assert.equal(p.scenes[0].turns[0].actor_id, 'tu');
  assert.equal(nextJob(p).actor_ids[0], 'lam');
});

test('World không được chọn actor vắng hoặc không tồn tại làm bước tiếp', () => {
  const p = createProject({}), j = nextJob(p), result = batch(p, j);
  result.scene.next_actor_id = 'ghost';
  assert.throws(() => acceptResponse(p, j.id, JSON.stringify(result)), /status active/);
});
