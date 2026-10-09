import { randomUUID } from 'node:crypto';
import { DomainError, parseSchema, manuscriptEditSchema, rewriteResponseSchema, chaptersSchema, writingSchema } from './schema.js';
import { hydrateStory, readerBefore, checkpoint, qualityNotes } from './story.js';
import { hasExcerpt } from './mystery.js';
import { importResponse } from './response-import.js';
import { buildRewritePrompt } from './prompts.js';

const uid = prefix => `${prefix}_${randomUUID()}`;
const check = (ok, message, status = 422) => { if (!ok) throw new DomainError(message, status); };
const getScene = (project, number) => {
  hydrateStory(project);
  const scene = project.scenes.find(s => s.number === Number(number));
  check(scene?.prose && scene.status === 'complete', 'Cảnh cần hoàn tất bản thảo trước khi biên tập.');
  return scene;
};
export function checkContinuity(response) {
  const review = response.continuity_review;
  if (!review) return;
  for (const key of ['timeline_consistent', 'no_repetition', 'character_consistent']) check(review[key], `Người kể cần sửa ${key} trước khi lưu. ${review.notes.join(' ')}`);
}
function manuscriptEvent(project, action, data) {
  project.manuscript_revision++;
  project.manuscript_events.push({ revision: project.manuscript_revision, action, ...data, created_at: new Date().toISOString() });
  project.updated_at = new Date().toISOString();
}
export function recordVersion(project, scene, response, source, metadata = {}) {
  hydrateStory(project);
  const version = { id: uid('v'), number: scene.versions.length + 1, source, created_at: new Date().toISOString(),
    prose: response.prose, summary: response.summary, reader_updates: structuredClone(response.reader_updates || null),
    editorial_check: structuredClone(response.editorial_check || scene.editorial_check || null), continuity_review: structuredClone(response.continuity_review || null), ...metadata };
  if (version.editorial_check) Object.assign(version.editorial_check, { provenance_checked: true, semantic_check: ['manual', 'restore'].includes(source) ? 'human_review' : 'model_self_report' });
  scene.versions.push(version); scene.current_version_id = version.id;
  scene.prose = version.prose; scene.summary = version.summary; scene.reader_updates = structuredClone(version.reader_updates);
  scene.editorial_check = structuredClone(version.editorial_check); scene.continuity_review = structuredClone(version.continuity_review);
  if (!project.chapters.some(c => c.scene_numbers.includes(scene.number))) {
    let chapter = project.chapters.at(-1);
    if (!chapter || chapter.scene_numbers.length >= 2) { chapter = { id: uid('ch'), title: `Chương ${project.chapters.length + 1}`, scene_numbers: [] }; project.chapters.push(chapter); }
    chapter.scene_numbers.push(scene.number);
  }
  manuscriptEvent(project, source, { scene_number: scene.number, version_id: version.id, exchange_id: metadata.exchange_id || null });
  return version;
}
function sameReaderInformation(before, after) {
  check(after, 'Cần reader_updates với trích đoạn mới cho bản thảo vụ án.');
  for (const key of ['facts', 'clues', 'answers', 'interpretations']) {
    const signature = entry => key === 'interpretations' ? JSON.stringify([entry.clue_id, entry.text, entry.confidence]) : entry.fact_id || entry.clue_id || entry.question_id;
    check(JSON.stringify((before?.[key] || []).map(signature).sort()) === JSON.stringify(after[key].map(signature).sort()), `Viết lại giữ các thông tin đã kể trong reader_updates.${key}. Để thay diễn biến hoặc thời điểm tiết lộ, tạo nhánh truyện.`);
  }
}
function validateEditedReader(project, scene, response) {
  if (!project.casefile) {
    check(!response.reader_updates || Object.values(response.reader_updates).every(entries => !entries.length), 'Truyện không có hồ sơ chưa có thông tin độc giả dạng ID.');
    return;
  }
  sameReaderInformation(scene.reader_updates, response.reader_updates);
  for (const entries of Object.values(response.reader_updates)) for (const entry of entries) check(hasExcerpt(response.prose, entry.excerpt), 'Trích đoạn độc giả cần xuất hiện nguyên văn trong bản thảo đã sửa.');
  if (response.kind === 'rewrite') {
    check(response.editorial_check, 'Viết lại vụ án cần editorial_check trong cùng câu trả lời.');
    for (const key of ['pov_consistent', 'no_new_events', 'ground_truth_consistent', 'clues_supported']) check(response.editorial_check[key], `Người kể cần sửa ${key} trước khi nhập bản viết lại.`);
  }
}
function updateReaderQuotes(project, scene, response) {
  if (!project.casefile) return;
  for (const [key, idKey] of [['facts', 'fact_id'], ['clues', 'clue_id'], ['answers', 'question_id']]) for (const entry of project.reader[key].filter(e => e.scene_number === scene.number)) {
    entry.excerpt = response.reader_updates[key].find(e => e[idKey] === entry[idKey]).excerpt;
  }
  for (const entry of project.reader.interpretations.filter(e => e.scene_number === scene.number)) entry.excerpt = response.reader_updates.interpretations.find(e => e.clue_id === entry.clue_id && e.text === entry.text && e.confidence === entry.confidence).excerpt;
}
function assertVersion(scene, base) { check(scene.current_version_id === base, 'Bản thảo đã có phiên bản mới. Mở lại cảnh và duyệt trước khi lưu.', 409); }
function editInPlace(project, number, input, source = 'manual', metadata = {}) {
  const scene = getScene(project, number);
  const response = parseSchema(manuscriptEditSchema, input);
  assertVersion(scene, response.base_version_id); validateEditedReader(project, scene, response);
  updateReaderQuotes(project, scene, response);
  const editorial_check = project.casefile ? { pov_consistent: true, no_new_events: true, ground_truth_consistent: true, clues_supported: true, notes: ['Người biên tập xác nhận nội dung, POV và nguồn tiết lộ.'], provenance_checked: true, semantic_check: 'human_review' } : null;
  return recordVersion(project, scene, { ...response, editorial_check }, source, metadata);
}
export function editManuscript(project, number, input) {
  const copy = structuredClone(project), version = editInPlace(copy, number, input);
  Object.assign(project, copy); return version;
}
export function restoreVersion(project, number, { base_version_id, version_id }) {
  const copy = structuredClone(project), scene = getScene(copy, number), old = scene.versions.find(v => v.id === version_id);
  check(old, 'Không tìm thấy phiên bản cần khôi phục.');
  const version = editInPlace(copy, number, { base_version_id, prose: old.prose, summary: old.summary, reader_updates: old.reader_updates || undefined, confirmed: true }, 'restore', { restored_from: old.id });
  Object.assign(project, copy); return version;
}
export function setChapters(project, input) {
  const copy = structuredClone(project); hydrateStory(copy);
  const data = parseSchema(chaptersSchema, input);
  check(data.manuscript_revision === copy.manuscript_revision, 'Bản thảo đã đổi. Mở lại danh sách chương.', 409);
  const ids = data.chapters.map(c => c.id), numbers = data.chapters.flatMap(c => c.scene_numbers), written = copy.scenes.filter(s => s.prose).map(s => s.number);
  check(new Set(ids).size === ids.length && new Set(numbers).size === numbers.length && JSON.stringify([...numbers].sort((a, b) => a - b)) === JSON.stringify(written), 'Mỗi cảnh đã viết phải thuộc đúng một chương; không thêm cảnh chưa viết.');
  check(JSON.stringify(numbers) === JSON.stringify(written), 'Giữ thứ tự thời gian các cảnh khi chia chương.');
  copy.chapters = data.chapters; manuscriptEvent(copy, 'chapters', {}); Object.assign(project, copy);
  return copy.chapters;
}
export function patchWriting(project, input) {
  const copy = structuredClone(project); hydrateStory(copy);
  const data = parseSchema(writingSchema, input);
  check(data.manuscript_revision === copy.manuscript_revision, 'Thiết lập đã đổi. Mở lại trước khi lưu.', 409);
  copy.style = { words: data.words, voice: data.voice, guidance: data.guidance }; copy.config.batch_size = data.batch_size;
  manuscriptEvent(copy, 'writing', { words: data.words, batch_size: data.batch_size }); Object.assign(project, copy); return copy;
}
export function rewriteJob(project, number, { guidance = '', base_version_id } = {}) {
  const scene = getScene(project, number); assertVersion(scene, base_version_id);
  if (project.pending_rewrite_job_id) {
    const pending = project.exchanges.find(j => j.id === project.pending_rewrite_job_id);
    check(pending.scene_number === scene.number, `Đang có prompt viết lại cảnh ${pending.scene_number}. Mở hoặc hủy prompt đó trước.`, 409);
    return pending;
  }
  const job = { id: uid('x'), kind: 'rewrite', revision: project.revision, scene_number: scene.number, base_version_id: scene.current_version_id,
    base_manuscript_revision: project.manuscript_revision, status: 'pending', actor_ids: [scene.pov_id], guidance: guidance.trim().slice(0, 4000),
    created_at: new Date().toISOString(), raw_response: null, response: null };
  job.prompt = buildRewritePrompt(project, scene, job);
  project.exchanges.push(job); project.pending_rewrite_job_id = job.id; return job;
}
function applyRewrite(project, jobId, raw) {
  hydrateStory(project);
  const job = project.exchanges.find(j => j.id === jobId);
  check(job?.kind === 'rewrite' && job.status === 'pending' && project.pending_rewrite_job_id === jobId, 'Prompt viết lại đã được nhập hoặc hủy.', 409);
  check(job.base_manuscript_revision === project.manuscript_revision, 'Bản thảo đã đổi sau khi tạo prompt viết lại. Hủy prompt cũ và tạo lại từ bản hiện tại.', 409);
  const scene = getScene(project, job.scene_number); assertVersion(scene, job.base_version_id);
  const imported = importResponse(raw, project, job);
  if (imported.value.base_version_id === undefined) { imported.value.base_version_id = job.base_version_id; imported.notes.push('Bổ sung base_version_id từ prompt viết lại.'); }
  const response = parseSchema(rewriteResponseSchema, imported.value);
  check(response.exchange_id === job.id && response.revision === job.revision && response.scene_number === job.scene_number && response.base_version_id === job.base_version_id, 'Metadata bản viết lại không khớp prompt.');
  check(response.pov_id === scene.pov_id, 'Viết lại giữ POV của cảnh đã mô phỏng.');
  const sourceIds = scene.turns.filter(t => t.witnesses.includes(scene.pov_id) || t.world_event?.witnesses.includes(scene.pov_id)).map(t => t.id);
  check(new Set(response.used_turn_ids).size === response.used_turn_ids.length && response.used_turn_ids.length === sourceIds.length && response.used_turn_ids.every(id => sourceIds.includes(id)), 'Viết lại cần giữ đúng các lượt nguồn POV đã chứng kiến.');
  checkContinuity(response); validateEditedReader(project, scene, response); updateReaderQuotes(project, scene, response);
  const version = recordVersion(project, scene, response, 'rewrite', { exchange_id: job.id });
  Object.assign(job, { status: 'consumed', raw_response: raw, response, import_notes: imported.notes, consumed_at: new Date().toISOString(), consumed_manuscript_revision: project.manuscript_revision });
  project.pending_rewrite_job_id = null;
  return { response, version, import_notes: imported.notes };
}
export function previewRewrite(project, jobId, raw) {
  const copy = structuredClone(project), result = applyRewrite(copy, jobId, raw);
  return { valid: true, ...result, quality_notes: qualityNotes(project, result.response) };
}
export function acceptRewrite(project, jobId, raw) {
  const copy = structuredClone(project), result = applyRewrite(copy, jobId, raw); Object.assign(project, copy); return result;
}
export function forkScene(project, number, name) {
  const source = structuredClone(project); hydrateStory(source);
  const scene = source.scenes.find(s => s.number === Number(number));
  check(scene, 'Không tìm thấy cảnh để tạo nhánh.'); checkpoint(source, scene);
  check(scene.checkpoint, 'Cảnh cũ chưa có mốc trạng thái trước mô phỏng. Có thể tạo nhánh ở cảnh mới chưa chạy.');
  const branch = { ...source, ...structuredClone(scene.checkpoint), id: uid('p'), name: name?.trim() || `${source.name.slice(0, 95)} · Nhánh cảnh ${number}`,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), revision: 0, manuscript_revision: 0, manuscript_events: [], exchanges: [],
    status: 'running', pending_job_id: null, pending_rewrite_job_id: null, pending_action: null,
    branch_origin: { project_id: source.id, scene_number: Number(number), source_revision: source.revision },
    scenes: source.scenes.filter(s => s.number < Number(number)).map(s => structuredClone(s)),
    chapters: source.chapters.map(c => ({ ...c, scene_numbers: c.scene_numbers.filter(n => n < Number(number)) })).filter(c => c.scene_numbers.length),
  };
  check(branch.name.length > 0 && branch.name.length <= 120, 'Tên nhánh cần từ 1–120 ký tự.');
  branch.scenes.push({ id: uid('s'), number: Number(number), status: 'simulating', title: '', location: branch.world.location, time: branch.world.time, atmosphere: '', turns: [], pov_id: null, end_reason: '', prose: null, summary: null, versions: [] });
  // Previous active versions remain the source for published excerpts in the branch.
  branch.reader = readerBefore(source, Number(number));
  checkpoint(branch, branch.scenes.at(-1)); return branch;
}
