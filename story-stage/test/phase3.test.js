import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, nextJob, acceptResponse, previewResponse, cancelJob, exportStory, exportPreset } from '../src/engine.js';
import { editManuscript, restoreVersion, rewriteJob, previewRewrite, acceptRewrite, setChapters, forkScene, patchWriting } from '../src/manuscript.js';
import { hydrateStory } from '../src/story.js';
import { characterView } from '../src/memory.js';
import { batch, narration } from './fixtures.js';
import { runCaseExample } from '../examples/case-fixture.js';
import { diffParagraphs } from '../public/manuscript-ui.js';

function writeScene(p) {
  const job = nextJob(p); acceptResponse(p, job.id, JSON.stringify(batch(p, job)));
  const n = nextJob(p), r = narration(p, n); acceptResponse(p, n.id, JSON.stringify(r));
  return p.scenes.find(s => s.number === n.scene_number);
}
const ready = () => { const p = createProject({ config: { max_turns: 1, batch_size: 1, max_scenes: 4 } }); writeScene(p); return p; };
const simulationState = p => structuredClone({ world: p.world, characters: p.characters, threads: p.threads, casefile: p.casefile, case_ledger: p.case_ledger, pending_job_id: p.pending_job_id, pending_action: p.pending_action, revision: p.revision, memory_sequence: p.memory_sequence, turns: p.scenes.map(s => s.turns), status: p.status });
const manual = (s, prose = 'Tôi lắng nghe. Câu hỏi vừa được nói ra vẫn chưa có lời đáp.') => ({ base_version_id: s.current_version_id, prose, summary: 'Câu hỏi chưa có lời đáp.', confirmed: true, ...(s.reader_updates ? { reader_updates: structuredClone(s.reader_updates) } : {}) });

test('Truyện mới gộp 6 lượt, mục tiêu 1.500 từ, prompt tạo chất liệu và tự rà trong hai lần trao đổi', () => {
  const p = createProject({}), j = nextJob(p);
  assert.equal(p.config.batch_size, 6); assert.equal(p.style.words, 1500); assert.equal(j.actor_ids.length, 6);
  assert.match(j.prompt, /150–250/); assert.match(j.prompt, /lời nói nguyên văn/);
  acceptResponse(p, j.id, JSON.stringify(batch(p, j))); const n = nextJob(p);
  assert.equal(n.kind, 'narration'); assert.match(n.prompt, /continuity_review/);
  acceptResponse(p, n.id, JSON.stringify(narration(p, n))); assert.equal(p.exchanges.length, 2);
  assert.equal(p.scenes[0].versions.length, 1); assert.equal(p.manuscript_revision, 1);
});
test('Action/outcome dài được nhận, bản dán sơ sài có nhắc chất liệu nhưng không gây lỗi format', () => {
  const p = createProject({ config: { batch_size: 1 } }), j = nextJob(p), r = batch(p, j);
  r.turns[0].action = 'Một lời đối thoại cụ thể. '.repeat(150); r.turns[0].outcome = 'Một phản ứng quan sát được. '.repeat(190);
  assert.ok(previewResponse(p, j.id, JSON.stringify(r)).valid);
  assert.ok(previewResponse(p, j.id, JSON.stringify(batch(p, j))).quality_notes.length);
});
test('Thiết lập độ dài cho truyện cũ giữ prompt pending, actor count và revision mô phỏng', () => {
  const p = createProject({ config: { batch_size: 3 } }), j = nextJob(p), original = structuredClone(j);
  patchWriting(p, { manuscript_revision: p.manuscript_revision, words: 1800, batch_size: 6, voice: p.style.voice, guidance: p.style.guidance });
  assert.equal(p.revision, 0); assert.equal(p.pending_job_id, j.id); assert.deepEqual(p.exchanges[0], original);
  acceptResponse(p, j.id, JSON.stringify(batch(p, j))); assert.equal(p.scenes[0].turns.length, 3);
  assert.equal(nextJob(p).actor_ids.length, 3); assert.equal(p.style.words, 1800);
});
test('Mục tiêu riêng cách ly, mạch có nguồn và thay đổi trạng thái qua tương tác', () => {
  const p = createProject({ config: { batch_size: 3 } }), j = nextJob(p), r = batch(p, j);
  assert.ok(characterView(p, 'phong').story_threads.every(t => t.known_by.includes('phong')));
  assert.ok(!characterView(p, 'quan').story_threads.some(t => t.id === 'goal_phong_1'));
  const update = { thread_id: 'thread_promise', kind: 'promise', title: 'Hẹn tìm hồ sơ', character_ids: ['phong', 'quan'], status: 'open', evidence_fact_ids: [], excerpt: 'Quân đồng ý tìm hồ sơ vào sáng mai.' };
  r.turns[0].witnesses = ['phong', 'quan']; r.turns[0].outcome = update.excerpt; r.turns[0].thread_updates = [update];
  r.turns[1].witnesses = ['quan', 'phong']; r.turns[1].outcome = 'Quân đã tìm được hồ sơ theo lời hẹn.';
  r.turns[1].thread_updates = [{ ...update, status: 'resolved', excerpt: r.turns[1].outcome }];
  const preview = previewResponse(p, j.id, JSON.stringify(r)); assert.equal(preview.changed_threads[0].status, 'resolved');
  acceptResponse(p, j.id, JSON.stringify(r)); const t = p.threads.find(t => t.id === update.thread_id);
  assert.equal(t.history.length, 2); assert.equal(t.status, 'resolved');
  assert.ok(!characterView(p, 'lam').story_threads.some(t => t.id === 'thread_promise'));
  // A valid long goal from a custom preset must still be updatable as a thread.
  const preset = exportPreset(p); preset.characters[0].goals[0] = 'Mục tiêu có bối cảnh riêng. '.repeat(24);
  const custom = createProject({ preset, config: { batch_size: 1 } }), goal = custom.threads[0], job = nextJob(custom), response = batch(custom, job);
  response.turns[0].thread_updates = [{ thread_id: goal.id, kind: 'goal', title: goal.title, character_ids: goal.character_ids, status: 'resolved', evidence_fact_ids: [], excerpt: response.turns[0].outcome }];
  acceptResponse(custom, job.id, JSON.stringify(response)); assert.equal(custom.threads[0].status, 'resolved');
});
test('Mạch truyện không có nguồn, người biết hoặc evidence hợp lệ bị rollback cả packet', () => {
  const p = createProject({ config: { batch_size: 1 } }), j = nextJob(p), before = structuredClone(p);
  const update = { thread_id: 'thread_bad', kind: 'question', title: 'Một nghi vấn', character_ids: ['phong'], status: 'open', evidence_fact_ids: [], excerpt: 'Không có câu này trong log.' };
  for (const patch of [{}, { excerpt: 'Câu hỏi được ghi lại nhưng chưa có câu trả lời.', evidence_fact_ids: ['secret_quan'] }, { excerpt: 'Câu hỏi được ghi lại nhưng chưa có câu trả lời.', character_ids: ['lam'] }, { excerpt: 'Câu hỏi được ghi lại nhưng chưa có câu trả lời.', status: 'resolved' }]) {
    const r = batch(p, j); r.turns[0].thread_updates = [{ ...update, ...patch }];
    assert.throws(() => acceptResponse(p, j.id, JSON.stringify(r))); assert.deepEqual(p, before);
  }
});
test('Người vắng mặt giữ trạng thái mạch đã chứng kiến trước đó, không đọc cập nhật mới', () => {
  const p = createProject({ config: { batch_size: 3 } }), j = nextJob(p), r = batch(p, j);
  const update = { thread_id: 'thread_hall', kind: 'promise', title: 'Lời hẹn trước cửa', character_ids: ['phong', 'quan'], status: 'open', evidence_fact_ids: [], excerpt: 'Quân nhận lời đi lấy hồ sơ.' };
  r.turns[0].witnesses = ['phong', 'quan', 'lam']; r.turns[0].outcome = update.excerpt; r.turns[0].thread_updates = [update];
  r.turns[1].witnesses = ['phong', 'quan']; r.turns[1].outcome = 'Quân trở lại cùng tập hồ sơ.'; r.turns[1].thread_updates = [{ ...update, status: 'resolved', excerpt: r.turns[1].outcome }];
  acceptResponse(p, j.id, JSON.stringify(r));
  assert.equal(characterView(p, 'quan').story_threads.find(t => t.id === update.thread_id).status, 'resolved');
  assert.equal(characterView(p, 'lam').story_threads.find(t => t.id === update.thread_id).status, 'open');
});
test('Sửa/khôi phục tạo lịch sử bất biến, giữ thế giới, ký ức và prompt mô phỏng đang chờ', () => {
  const p = ready(), s = p.scenes[0], original = structuredClone(s.versions[0]); nextJob(p);
  const before = simulationState(p); editManuscript(p, 1, manual(s));
  assert.deepEqual(simulationState(p), before); assert.deepEqual(p.scenes[0].versions[0], original);
  const edited = p.scenes[0]; assert.equal(edited.versions.length, 2);
  restoreVersion(p, 1, { base_version_id: edited.current_version_id, version_id: original.id });
  assert.equal(p.scenes[0].versions.length, 3); assert.equal(p.scenes[0].prose, original.prose);
  assert.deepEqual(simulationState(p), before);
});
test('Sửa bằng phiên bản cũ hoặc chưa xác nhận không lưu và không tăng revision', () => {
  const p = ready(), s = p.scenes[0], old = manual(s); editManuscript(p, 1, old); const before = structuredClone(p);
  assert.throws(() => editManuscript(p, 1, old), e => e.statusCode === 409); assert.deepEqual(p, before);
  assert.throws(() => editManuscript(p, 1, { ...manual(p.scenes[0]), confirmed: false })); assert.deepEqual(p, before);
});
test('Viết lại có preview, nhập một lần; không chặn mô phỏng và không đổi revision thế giới', () => {
  const p = ready(), pending = nextJob(p), s = p.scenes[0], j = rewriteJob(p, 1, { base_version_id: s.current_version_id, guidance: 'Giọng kể tiết chế.' });
  assert.equal(p.pending_job_id, pending.id); assert.equal(rewriteJob(p, 1, { base_version_id: s.current_version_id }).id, j.id);
  acceptResponse(p, pending.id, JSON.stringify(batch(p, pending))); const before = simulationState(p);
  const raw = 'Tôi nghe câu hỏi được nói ra, rồi chờ một lời đáp. Tiếng mưa vẫn đều bên ngoài.';
  const copy = structuredClone(p), preview = previewRewrite(p, j.id, raw); assert.deepEqual(p, copy);
  acceptRewrite(p, j.id, raw); assert.equal(p.scenes[0].prose, preview.response.prose); assert.equal(p.scenes[0].versions.length, 2);
  assert.deepEqual(simulationState(p), before); assert.throws(() => acceptRewrite(p, j.id, raw), e => e.statusCode === 409);
});
test('Prompt viết lại lấy POV/nguồn lịch sử, không đưa kiến thức nhân vật học ở cảnh sau', () => {
  const p = runCaseExample(), s = p.scenes[0]; s.narrator_context = null;
  p.characters.find(c => c.id === 'phong').background = 'LATE_SECRET_9388';
  const j = rewriteJob(p, 1, { base_version_id: s.current_version_id });
  assert.ok(!j.prompt.includes('LATE_SECRET_9388')); assert.ok(!j.prompt.includes('f-report')); assert.match(j.prompt, /fixed_reader_information/);
});
test('Vụ án: sửa câu chữ cập nhật nguồn Reader, giữ ID/thời điểm tiết lộ; thêm/bỏ thông tin bị chặn', () => {
  const p = runCaseExample(), s = p.scenes[0], data = manual(s, s.prose.replace('Quân chạm vào hai rãnh dây dắt.', 'Quân lần tay trên hai rãnh dây dắt.'));
  data.reader_updates.clues[0].excerpt = 'Quân lần tay trên hai rãnh dây dắt.';
  const before = simulationState(p); editManuscript(p, 1, data);
  assert.deepEqual(simulationState(p), before); assert.equal(p.reader.clues.find(c => c.clue_id === 'c-collar').excerpt, data.reader_updates.clues[0].excerpt);
  assert.equal(p.reader.clues.find(c => c.clue_id === 'c-collar').scene_number, 1);
  const current = p.scenes[0], bad = manual(current, current.prose); bad.reader_updates.facts = [];
  const unchanged = structuredClone(p); assert.throws(() => editManuscript(p, 1, bad), /thông tin đã kể/); assert.deepEqual(p, unchanged);
  const mismatch = manual(current, 'Đoạn văn không có những trích đoạn trước.'); assert.throws(() => editManuscript(p, 1, mismatch), /Trích đoạn/);
});
test('Vụ án: rewrite giữ bằng chứng và POV; metadata/reader/continuity sai bị chặn', () => {
  const p = runCaseExample(), s = p.scenes[0], j = rewriteJob(p, 1, { base_version_id: s.current_version_id });
  const response = { exchange_id: j.id, revision: j.revision, scene_number: 1, kind: 'rewrite', base_version_id: s.current_version_id, pov_id: s.pov_id,
    prose: s.prose, summary: s.summary, used_turn_ids: s.turns.map(t => t.id), reader_updates: s.reader_updates,
    editorial_check: { pov_consistent: true, no_new_events: true, ground_truth_consistent: true, clues_supported: true, notes: [] },
    continuity_review: { timeline_consistent: true, no_repetition: true, character_consistent: true, notes: [] } };
  const before = structuredClone(p);
  for (const bad of [{ ...response, pov_id: 'quan' }, { ...response, base_version_id: 'v_old' }, { ...response, editorial_check: undefined }, { ...response, continuity_review: { ...response.continuity_review, no_repetition: false } }]) {
    assert.throws(() => acceptRewrite(p, j.id, JSON.stringify(bad))); assert.deepEqual(p, before);
  }
  acceptRewrite(p, j.id, `\`\`\`json\n${JSON.stringify(response)}\n\`\`\``); assert.equal(p.scenes[0].versions.length, 2);
});
test('Bản thảo đổi làm rewrite cũ hết hiệu lực; hủy rewrite giữ prompt mô phỏng', () => {
  const p = ready(), pending = nextJob(p), s = p.scenes[0], j = rewriteJob(p, 1, { base_version_id: s.current_version_id });
  editManuscript(p, 1, manual(s)); const before = structuredClone(p);
  assert.throws(() => acceptRewrite(p, j.id, 'Một đoạn viết lại.'), e => e.statusCode === 409); assert.deepEqual(p, before);
  cancelJob(p, j.id); assert.equal(p.pending_job_id, pending.id); assert.equal(p.pending_rewrite_job_id, null);
});
test('Chương tự nhóm hai cảnh, chỉnh tên/nhóm và export; cấm trùng hoặc đổi thứ tự cảnh', () => {
  const p = ready(); writeScene(p); writeScene(p); writeScene(p);
  assert.deepEqual(p.chapters.map(c => c.scene_numbers), [[1, 2], [3, 4]]);
  setChapters(p, { manuscript_revision: p.manuscript_revision, chapters: [{ id: 'ch_custom', title: 'Những câu hỏi', scene_numbers: [1, 2, 3, 4] }] });
  assert.match(exportStory(p), /## Những câu hỏi/); assert.match(exportStory(p), /### Cảnh 4/);
  const before = structuredClone(p);
  for (const numbers of [[1,1,2,3,4], [1,3,2,4], [1,2,3], [1,2,3,4,5]]) {
    assert.throws(() => setChapters(p, { manuscript_revision: p.manuscript_revision, chapters: [{ id: 'bad', title: 'Sai', scene_numbers: numbers }] })); assert.deepEqual(p, before);
  }
});
test('Nhánh trước cảnh giữ trạng thái tại mốc, loại diễn biến tương lai và độc lập với truyện gốc', () => {
  const p = ready(); const j = nextJob(p), r = batch(p, j);
  r.turns[0].new_facts = [{ id: 'f_future', text: 'Một việc ở cảnh hai.', known_by: [r.turns[0].actor_id] }];
  acceptResponse(p, j.id, JSON.stringify(r)); const n = nextJob(p); acceptResponse(p, n.id, JSON.stringify(narration(p, n)));
  const before = structuredClone(p), branch = forkScene(p, 2, 'Nhánh khác');
  assert.deepEqual(p, before); assert.notEqual(branch.id, p.id); assert.equal(branch.scenes.length, 2);
  assert.ok(!branch.world.facts.some(f => f.id === 'f_future')); assert.deepEqual(branch.characters, p.scenes[1].checkpoint.characters);
  assert.equal(branch.scenes[1].turns.length, 0); assert.equal(branch.scenes[0].prose, p.scenes[0].prose); assert.equal(branch.pending_job_id, null);
  const bj = nextJob(branch); acceptResponse(branch, bj.id, JSON.stringify(batch(branch, bj))); assert.deepEqual(p, before);
});
test('Truyện legacy hydrate phiên bản ổn định; cảnh đã chạy thiếu checkpoint không bị giả phục hồi', () => {
  const p = ready(); delete p.manuscript_revision; delete p.chapters; delete p.scenes[0].versions; delete p.scenes[0].checkpoint;
  hydrateStory(p); assert.equal(p.scenes[0].versions[0].id, 'v_legacy_1'); assert.equal(p.scenes[0].versions.length, 1);
  hydrateStory(p); assert.equal(p.scenes[0].versions.length, 1); assert.throws(() => forkScene(p, 1), /chưa có mốc/);
  assert.ok(forkScene(p, 2).scenes.at(-1).checkpoint);
});
test('So sánh đoạn nhận biết phần giữ, bỏ và thêm, kể cả nội dung HTML', () => {
  assert.deepEqual(diffParagraphs('Một.\n\nHai.', 'Một.\n\nBa.'), [{ type: 'same', text: 'Một.' }, { type: 'removed', text: 'Hai.' }, { type: 'added', text: 'Ba.' }]);
  assert.equal(diffParagraphs('<script>x</script>', '<b>y</b>')[0].type, 'removed');
});
