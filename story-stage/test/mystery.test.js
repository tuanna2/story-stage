import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, nextJob, caseSetupJob, acceptResponse, previewResponse, exportPreset } from '../src/engine.js';
import { cleanPreset } from '../src/engine.js';
import { presets } from '../src/presets.js';
import { characterView } from '../src/memory.js';
import { readerView, pacingView } from '../src/mystery.js';
import { simulation, proseResponse, caseScenes, runCaseExample } from '../examples/case-fixture.js';

const setup = () => { const p = createProject({ preset_id: 'rain-case', config: { batch_size: 1 } }); return [p, nextJob(p)]; };
const raw = value => JSON.stringify(value);
function rejectsAtomically(p, job, response, pattern) {
  const before = raw(p); assert.throws(() => acceptResponse(p, job.id, raw(response)), pattern); assert.equal(raw(p), before);
}
test('Hồ sơ cố định hợp lệ, chỉ World có toàn bộ đáp án; độc giả ban đầu rỗng', () => {
  const [p, job] = setup();
  assert.equal(p.casefile.clues.length, 6); assert.ok(job.prompt.includes('world_only_casefile'));
  const view = characterView(p, 'quan');
  assert.equal(view.known_clues.length, 0);
  assert.ok(!raw(view).includes('report-editor')); assert.ok(!raw(view).includes('deeper_reading')); assert.ok(!raw(view).includes('lam xóa dòng thứ ba'));
  const reader = readerView(p); assert.equal(reader.facts.length, 0); assert.equal(reader.clues.length, 0);
  assert.ok(!raw(reader).includes('answer_fact_ids')); assert.ok(!raw(reader).includes('discovery_condition'));
});
test('Tham chiếu hồ sơ lỗi và claim mâu thuẫn bị chặn khi tạo truyện', () => {
  const preset = cleanPreset(presets.find(p => p.id === 'rain-case'));
  preset.casefile.clues[0].evidence_fact_id = 'f-thu';
  assert.throws(() => createProject({ preset }), /tách khỏi đáp án|ID trùng/);
  const other = cleanPreset(presets.find(p => p.id === 'rain-case'));
  other.world.facts.push({ id: 'f-other', text: 'Đổi người sửa hồ sơ.', known_by: [], claim: { key: 'report-editor', value: 'quan' } });
  assert.throws(() => createProject({ preset: other }), /mâu thuẫn/);
});
test('Phát hiện cần nguồn trong outcome và người chứng kiến; packet lỗi rollback', () => {
  const [p, job] = setup();
  let response = simulation(p, job, caseScenes[0].sim);
  response.turns[0].clue_discoveries[0].by.push('lam');
  rejectsAtomically(p, job, response, /người chứng kiến/);
  response = simulation(p, job, caseScenes[0].sim); response.turns[0].clue_discoveries[0].excerpt = 'Đoạn không có trong kết quả.';
  rejectsAtomically(p, job, response, /trích nguyên văn/);
  response = simulation(p, job, caseScenes[0].sim);
  const preview = previewResponse(p, job.id, raw(response)); assert.equal(preview.discoveries.length, 1); assert.equal(p.case_ledger.discoveries.length, 0);
  acceptResponse(p, job.id, raw(response));
  assert.ok(p.world.facts.find(f => f.id === 'e-collar').known_by.includes('quan'));
  assert.equal(p.reader.clues.length, 0); assert.equal(p.case_ledger.discoveries[0].turn_id, 't_1_1');
  assert.equal(characterView(p, 'lam').known_clues.length, 0);
});
test('Không tự mở đáp án khi tìm dấu vết, không diễn giải manh mối mới trong cùng lượt', () => {
  const [p, job] = setup(); let response = simulation(p, job, caseScenes[0].sim);
  response.turns[0].interpretation_updates = [{ clue_id: 'c-collar', text: 'Tôi nghĩ đây là đồ của chó.', confidence: 80 }];
  rejectsAtomically(p, job, response, /chưa phát hiện/);
  response = simulation(p, job, caseScenes[0].sim); response.turns[0].reveals = [];
  acceptResponse(p, job.id, raw(response));
  assert.deepEqual(p.world.facts.find(f => f.id === 'f-thu').known_by, ['phong']);
});
test('Tiết lộ đáp án cần đủ chứng cứ hoặc thú nhận từ người đã biết', () => {
  const [p, job] = setup(); let response = simulation(p, job, { witnesses: ['quan', 'lam'], outcome: 'Quân kết luận Lam đã sửa hồ sơ.', reveals: [{ fact_id: 'f-report', to: ['quan'], excerpt: 'Lam đã sửa hồ sơ.' }] });
  rejectsAtomically(p, job, response, /Thiếu manh mối/);
  response.turns[0].reveals[0].source_character_id = 'quan';
  rejectsAtomically(p, job, response, /đã biết sự thật/);
  response.turns[0].reveals[0].source_character_id = 'lam';
  acceptResponse(p, job.id, raw(response));
  assert.ok(p.world.facts.find(f => f.id === 'f-report').known_by.includes('quan'));
  assert.equal(p.case_ledger.truth_reveals[0].source_character_id, 'lam');
});
test('Claim khác giá trị không thể thêm với ID mới; reveal dấu vết không lách ledger', () => {
  const [p, job] = setup(); let response = simulation(p, job);
  response.turns[0].new_facts.push({ id: 'f-new-editor', text: 'Người sửa là Quân.', known_by: ['quan'], claim: { key: 'report-editor', value: 'quan' } });
  rejectsAtomically(p, job, response, /mâu thuẫn/);
  response = simulation(p, job); response.turns[0].reveals = [{ fact_id: 'e-copy', to: ['quan'] }];
  rejectsAtomically(p, job, response, /clue_discoveries/);
});
test('World event ghi nguồn riêng và chỉ chuyển dấu vết tới witnesses của sự kiện', () => {
  const [p, job] = setup(); const response = simulation(p, job, { event: { text: 'Từ đọc bản sao cho Lam: dòng nhân chứng trống.', witnesses: ['tu', 'lam'], new_facts: [], reveals: [], clue_discoveries: [{ clue_id: 'c-copy', by: ['lam'], excerpt: 'dòng nhân chứng trống.' }] } });
  acceptResponse(p, job.id, raw(response));
  assert.equal(p.case_ledger.discoveries[0].source, 'world_event');
  assert.equal(characterView(p, 'quan').known_clues.length, 0); assert.equal(characterView(p, 'lam').known_clues.length, 1);
});
test('Narrator không có answer key; trích đoạn, POV, đáp án và tự kiểm tra đều bắt buộc', () => {
  const [p, job] = setup(); acceptResponse(p, job.id, raw(simulation(p, job, caseScenes[0].sim)));
  const narrator = nextJob(p);
  assert.ok(!narrator.prompt.includes('deeper_reading')); assert.ok(!narrator.prompt.includes('world_only_casefile')); assert.ok(!narrator.prompt.includes('report-editor'));
  let response = proseResponse(p, narrator, caseScenes[0].prose, caseScenes[0].updates);
  response.reader_updates.clues[0].excerpt = 'Một trích đoạn bịa.';
  rejectsAtomically(p, narrator, response, /trích nguyên văn/);
  response = proseResponse(p, narrator, caseScenes[0].prose, caseScenes[0].updates);
  response.reader_updates.facts.push({ fact_id: 'f-report', excerpt: 'Tôi đặt vòng cổ lên bàn.' });
  rejectsAtomically(p, narrator, response, /POV chưa biết/);
  response = proseResponse(p, narrator, caseScenes[0].prose, caseScenes[0].updates);
  response.reader_updates.facts.push({ fact_id: 'secret_phong', excerpt: 'Tôi đặt vòng cổ lên bàn.' });
  rejectsAtomically(p, narrator, response, /Bí mật riêng/);
  response = proseResponse(p, narrator, caseScenes[0].prose, caseScenes[0].updates);
  response.reader_updates.clues = [];
  rejectsAtomically(p, narrator, response, /chưa được chuẩn bị/);
  response = proseResponse(p, narrator, caseScenes[0].prose, caseScenes[0].updates);
  response.editorial_check.no_new_events = false;
  rejectsAtomically(p, narrator, response, /no_new_events/);
  response = proseResponse(p, narrator, caseScenes[0].prose, caseScenes[0].updates); delete response.reader_updates;
  rejectsAtomically(p, narrator, response, /reader_updates/);
});
test('Người kể không tạo giả thuyết mới hoặc xác nhận câu hỏi chưa đủ fact/clue', () => {
  const [p, job] = setup(); acceptResponse(p, job.id, raw(simulation(p, job, caseScenes[0].sim))); const j = nextJob(p);
  let r = proseResponse(p, j, caseScenes[0].prose, caseScenes[0].updates);
  r.reader_updates.interpretations.push({ clue_id: 'c-collar', text: 'Tôi nghi Lam.', confidence: 90, excerpt: 'Tôi đặt vòng cổ lên bàn.' });
  rejectsAtomically(p, j, r, /giả thuyết đã lưu/);
  r = proseResponse(p, j, caseScenes[0].prose, caseScenes[0].updates);
  r.reader_updates.answers.push({ question_id: 'q-report', excerpt: 'Tôi đặt vòng cổ lên bàn.' });
  rejectsAtomically(p, j, r, /chưa có đủ sự thật/);
});
test('Sáu cảnh: giữ canon, đổi POV, đổi cách hiểu, độc giả biết sau narration', () => {
  let lastClues = 0; const p = runCaseExample((p, response) => {
    if (response.kind === 'simulation') assert.equal(p.reader.clues.length, lastClues);
    else lastClues = p.reader.clues.length;
  });
  assert.equal(p.status, 'complete'); assert.equal(p.revision, 12); assert.equal(p.reader.clues.length, 6); assert.equal(p.reader.answers.length, 4);
  assert.equal(p.case_ledger.interpretations.length, 2); assert.deepEqual(p.case_ledger.interpretations.map(i => i.confidence), [65, 95]);
  assert.equal(p.world.facts.find(f => f.id === 'f-report').claim.value, 'lam');
  assert.equal(p.scenes[3].pov_id, 'lam'); assert.equal(p.scenes[4].pov_id, 'quan');
  assert.equal(p.scenes[5].editorial_check.semantic_check, 'model_self_report');
  const exported = exportPreset(p); const rerun = createProject({ preset: exported });
  assert.deepEqual(rerun.casefile, p.casefile); assert.equal(rerun.reader.facts.length, 0); assert.ok(rerun.case_ledger.discoveries.length > 0);
  assert.equal(pacingView(p).scenes_remaining, 0);
});
test('Hồ sơ tùy chỉnh: đúng một prompt đầu truyện, preview không lưu, hồ sơ không ghi đè', () => {
  const p = createProject({ preset_id: 'interrogation' }); const j = caseSetupJob(p, 'Giữ một bí mật có thể kiểm chứng.');
  const response = { exchange_id: j.id, revision: j.revision, scene_number: j.scene_number, kind: 'case_setup',
    casefile: { central_question: 'Vòng cổ là của ai?', truths: [{ fact_id: 'f-thu', required_clue_ids: ['c-collar'] }], timeline: [{ id: 'past', at: 'Trước truyện', text: 'Tiểu Thu đã chết.', fact_ids: ['f-thu'] }], clues: [{ id: 'c-collar', title: 'Vòng cổ', evidence_fact_id: 'f-collar', location: 'Túi Phong', discovery_condition: 'Phong đưa ra.', surface_reading: 'Tên người.', deeper_reading: 'Tên chó.', truth_fact_ids: ['f-thu'] }], questions: [{ id: 'q-thu', text: 'Tiểu Thu là ai?', answer_fact_ids: ['f-thu'], required_clue_ids: ['c-collar'] }] },
    new_facts: [{ id: 'f-collar', text: 'Vòng cổ có rãnh dây dắt.', known_by: ['phong'] }], initial_beliefs: [] };
  assert.equal(previewResponse(p, j.id, raw(response)).casefile_created.clues.length, 1); assert.equal(p.casefile, null);
  acceptResponse(p, j.id, raw(response)); assert.equal(p.case_ledger.discoveries[0].source, 'initial');
  assert.throws(() => caseSetupJob(p), /đã có hồ sơ/); assert.equal(nextJob(p).kind, 'simulation');
});
test('Tách nhân vật giữ giả thuyết do Character chọn khi World phân xử', () => {
  const p = runCaseExample(); const preset = exportPreset(p); const fresh = createProject({ preset, config: { mode: 'isolated' } }); fresh.next_actor_id = 'quan';
  const j = nextJob(fresh); assert.ok(!j.prompt.includes('deeper_reading'));
  const thought = { clue_id: 'c-copy', text: 'Cách hiểu riêng tôi chọn.', confidence: 70 };
  acceptResponse(fresh, j.id, raw({ exchange_id: j.id, revision: j.revision, scene_number: 1, kind: 'character', character_id: 'quan', thought: 'Tôi sẽ kiểm tra lại.', intention: 'Kiểm tra.', mood: { fear: 20, anger: 10, hope: 30, guilt: 20 }, action: 'Tôi hỏi Bác Từ.', interpretation_updates: [thought] }));
  const w = nextJob(fresh); const r = simulation(fresh, w);
  const { turns, ...resolution } = r; Object.assign(resolution, { kind: 'resolution', outcome: turns[0].outcome, witnesses: ['quan'], new_facts: [], reveals: [], clue_discoveries: [], world_event: null });
  acceptResponse(fresh, w.id, raw(resolution)); assert.equal(fresh.case_ledger.interpretations.at(-1).text, thought.text);
});
test('Thú nhận có thể kể sự thật trước chuỗi chứng cứ, câu hỏi vẫn cần đủ manh mối', () => {
  const [p, j] = setup();
  const outcome = 'Lam nói với Quân: Tôi đã xóa dòng nhân chứng để tránh bị truy trách nhiệm.';
  acceptResponse(p, j.id, raw(simulation(p, j, { witnesses: ['quan', 'lam'], outcome, reveals: [{ fact_id: 'f-report', to: ['quan'], source_character_id: 'lam', excerpt: 'Tôi đã xóa dòng nhân chứng để tránh bị truy trách nhiệm.' }] })));
  const n = nextJob(p); const prose = 'Lam nói với tôi: Tôi đã xóa dòng nhân chứng để tránh bị truy trách nhiệm.';
  const updates = { facts: [{ fact_id: 'f-report', excerpt: 'Tôi đã xóa dòng nhân chứng để tránh bị truy trách nhiệm.' }], clues: [], interpretations: [], answers: [] };
  const wrong = proseResponse(p, n, prose, updates); wrong.reader_updates.answers.push({ question_id: 'q-report', excerpt: prose });
  rejectsAtomically(p, n, wrong, /thiếu manh mối/);
  acceptResponse(p, n.id, raw(proseResponse(p, n, prose, updates)));
  assert.equal(p.reader.facts.length, 1); assert.equal(p.reader.answers.length, 0);
  assert.equal(readerView(p).facts[0].excerpt, updates.facts[0].excerpt); assert.equal(readerView(p).facts[0].text, undefined);
});
test('POV có bí mật nền không tự gửi đáp án chưa chuẩn bị tới Người kể', () => {
  const [p, j] = setup(); acceptResponse(p, j.id, raw(simulation(p, j, { actor: 'lam', witnesses: ['lam'] })));
  const n = nextJob(p); const hidden = p.world.facts.find(f => f.id === 'f-report').text;
  assert.ok(!n.prompt.includes(hidden)); assert.ok(!n.prompt.includes(p.characters.find(c => c.id === 'lam').secret));
});
test('Nhịp chững sau hai cảnh chỉ gợi ý cơ hội, không tự tạo phát hiện hay đáp án', () => {
  const [p, first] = setup(); let j = first;
  for (let i = 0; i < 2; i++) {
    acceptResponse(p, j.id, raw(simulation(p, j)));
    const n = nextJob(p); acceptResponse(p, n.id, raw(proseResponse(p, n, 'Tôi hỏi nhưng chưa nhận được câu trả lời.')));
    if (i === 0) j = nextJob(p);
  }
  const pacing = pacingView(p); assert.equal(pacing.stale_scenes, 2); assert.ok(pacing.advice.includes('không tự trao đáp án'));
  assert.equal(p.case_ledger.discoveries.length, 0); assert.equal(p.reader.answers.length, 0);
  assert.ok(nextJob(p).prompt.includes(pacing.advice));
});
