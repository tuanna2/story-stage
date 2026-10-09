import { DomainError } from './schema.js';

const check = (condition, message) => { if (!condition) throw new DomainError(message); };
const normalized = value => String(value).normalize('NFC').replace(/\s+/gu, ' ').trim();
export const hasExcerpt = (text, excerpt) => Boolean(normalized(excerpt)) && normalized(text).includes(normalized(excerpt));
const unique = (values, label) => check(new Set(values).size === values.length, `${label} có ID trùng.`);

export function hydrateMystery(project) {
  project.casefile ??= null;
  project.reader ??= { facts: [], clues: [], interpretations: [], answers: [] };
  project.case_ledger ??= { discoveries: [], interpretations: [], truth_reveals: [] };
  return project;
}
export function initializeMystery(project) {
  hydrateMystery(project);
  if (!project.casefile) return;
  validateCasefile(project, project.casefile);
  for (const clue of project.casefile.clues) {
    const fact = project.world.facts.find(f => f.id === clue.evidence_fact_id);
    if (fact.known_by.length) project.case_ledger.discoveries.push({ clue_id: clue.id, by: [...fact.known_by], excerpt: fact.text, scene_number: 0, turn_id: null, source: 'initial' });
  }
}
export function validateClaims(facts, additions = []) {
  const values = new Map();
  for (const f of [...facts, ...additions]) {
    if (!f.claim) continue;
    check(!values.has(f.claim.key) || values.get(f.claim.key) === f.claim.value, `Khẳng định ${f.claim.key} mâu thuẫn với sự thật đã có. Không thể đổi giá trị để tạo twist.`);
    values.set(f.claim.key, f.claim.value);
  }
}
export function validateCasefile(project, casefile) {
  const facts = project.world.facts, factIds = new Set(facts.map(f => f.id));
  const clueIds = casefile.clues.map(c => c.id), truthIds = casefile.truths.map(t => t.fact_id);
  unique(clueIds, 'Manh mối'); unique(truthIds, 'Sự thật nền'); unique(casefile.questions.map(q => q.id), 'Câu hỏi'); unique(casefile.timeline.map(t => t.id), 'Mốc thời gian');
  const requireFacts = ids => { for (const id of ids) check(factIds.has(id), `Hồ sơ tham chiếu sự thật không tồn tại: ${id}.`); unique(ids, 'Tham chiếu sự thật'); };
  const requireClues = ids => { for (const id of ids) check(clueIds.includes(id), `Hồ sơ tham chiếu manh mối không tồn tại: ${id}.`); unique(ids, 'Tham chiếu manh mối'); };
  for (const t of casefile.truths) { requireFacts([t.fact_id]); requireClues(t.required_clue_ids); }
  const evidenceIds = casefile.clues.map(c => c.evidence_fact_id); unique(evidenceIds, 'Dấu vết của manh mối');
  for (const c of casefile.clues) {
    requireFacts([c.evidence_fact_id, ...c.truth_fact_ids]);
    check(!truthIds.includes(c.evidence_fact_id), `Dấu vết ${c.id} phải tách khỏi đáp án nền, để việc tìm thấy không tự tiết lộ đáp án.`);
    check(c.truth_fact_ids.every(id => truthIds.includes(id)), `Manh mối ${c.id} phải liên kết tới sự thật nền của hồ sơ.`);
  }
  for (const t of casefile.timeline) requireFacts(t.fact_ids);
  for (const q of casefile.questions) {
    requireFacts(q.answer_fact_ids); requireClues(q.required_clue_ids);
    check(q.answer_fact_ids.every(id => truthIds.includes(id)), `Đáp án ${q.id} phải tham chiếu sự thật nền.`);
  }
  validateClaims(facts);
}
export function knowsClue(project, characterId, clueId) {
  return project.case_ledger.discoveries.some(d => d.clue_id === clueId && d.by.includes(characterId));
}
export function knownClues(project, characterId) {
  if (!project.casefile) return [];
  return project.casefile.clues.filter(c => knowsClue(project, characterId, c.id)).map(c => ({ id: c.id, title: c.title, observation: project.world.facts.find(f => f.id === c.evidence_fact_id).text, evidence_fact_id: c.evidence_fact_id }));
}
export function validateInterpretations(project, actorId, updates = []) {
  if (!updates.length) return;
  check(project.casefile, 'Chưa có hồ sơ vụ án để diễn giải manh mối.');
  for (const u of updates) check(knowsClue(project, actorId, u.clue_id), `Nhân vật ${actorId} chưa phát hiện manh mối ${u.clue_id}, nên chưa thể diễn giải nó.`);
}
export function applyDiscoveries(project, discoveries, witnesses, outcome, source) {
  if (!discoveries?.length) return;
  check(project.casefile, 'Chưa có hồ sơ vụ án để phát hiện manh mối.');
  for (const d of discoveries) {
    const clue = project.casefile.clues.find(c => c.id === d.clue_id);
    check(clue, `Không tồn tại manh mối: ${d.clue_id}.`);
    unique(d.by, 'Người phát hiện');
    check(d.by.every(id => witnesses.includes(id)), 'Chỉ người chứng kiến mới được ghi nhận đã phát hiện manh mối.');
    check(hasExcerpt(outcome, d.excerpt), `Phát hiện ${d.clue_id} cần trích nguyên văn đoạn kết quả/sự kiện mô tả việc phát hiện.`);
    const fact = project.world.facts.find(f => f.id === clue.evidence_fact_id);
    fact.known_by = [...new Set([...fact.known_by, ...d.by])];
    project.case_ledger.discoveries.push({ ...d, ...source });
  }
}
export function validateEvidenceReveal(project, reveal, witnesses, outcome, source) {
  if (!project.casefile) return;
  const evidence = project.casefile.clues.find(c => c.evidence_fact_id === reveal.fact_id);
  if (evidence) check(reveal.to.every(id => knowsClue(project, id, evidence.id)), `Dấu vết ${evidence.id} cần clue_discoveries có nguồn trước khi mở quyền biết.`);
  const truth = project.casefile.truths.find(t => t.fact_id === reveal.fact_id);
  if (!truth) return;
  unique(reveal.evidence_clue_ids, 'Chứng cứ tiết lộ');
  check(hasExcerpt(outcome, reveal.excerpt), `Tiết lộ sự thật nền ${reveal.fact_id} cần trích nguyên văn kết quả làm căn cứ.`);
  const fact = project.world.facts.find(f => f.id === reveal.fact_id);
  if (reveal.source_character_id) {
    check(witnesses.includes(reveal.source_character_id) && fact.known_by.includes(reveal.source_character_id), 'Nguồn thú nhận phải có mặt và đã biết sự thật trước khi tiết lộ.');
  } else {
    check(truth.required_clue_ids.length > 0, 'Sự thật chưa có chuỗi chứng cứ cần một nguồn thú nhận đã biết nó.');
    check(truth.required_clue_ids.every(id => reveal.evidence_clue_ids.includes(id)), `Thiếu manh mối bắt buộc để kết luận ${reveal.fact_id}.`);
    check(reveal.to.every(person => reveal.evidence_clue_ids.every(id => knowsClue(project, person, id))), 'Người nhận kết luận chưa biết các manh mối làm căn cứ.');
  }
  project.case_ledger.truth_reveals.push({ ...reveal, ...source });
}

export function narrationPermission(project, povId, factId, readerClueIds = project.reader.clues.map(c => c.clue_id)) {
  const truth = project.casefile?.truths.find(t => t.fact_id === factId);
  if (!truth || project.reader.facts.some(f => f.fact_id === factId)) return true;
  if (truth.required_clue_ids.length && truth.required_clue_ids.every(id => readerClueIds.includes(id) && knowsClue(project, povId, id))) return true;
  return project.case_ledger.truth_reveals.some(r => r.fact_id === factId && r.source_character_id && r.to.includes(povId));
}
export function narratorCaseView(project, povId) {
  if (!project.casefile) return null;
  const allowed = knownClues(project, povId);
  const allowedReaderClues = [...new Set([...project.reader.clues.map(c => c.clue_id), ...allowed.map(c => c.id)])];
  return {
    central_question: project.casefile.central_question,
    open_questions: project.casefile.questions.filter(q => !project.reader.answers.some(a => a.question_id === q.id)).map(({ id, text }) => ({ id, text })),
    known_clues: allowed,
    own_interpretations: project.case_ledger.interpretations.filter(i => i.character_id === povId),
    reader_so_far: readerView(project),
    allowed_fact_ids: project.world.facts.filter(f => !f.id.startsWith('secret_') && f.known_by.includes(povId) && narrationPermission(project, povId, f.id, allowedReaderClues)).map(f => f.id),
    answer_contracts: project.casefile.questions.filter(q => q.answer_fact_ids.every(id => project.world.facts.find(f => f.id === id).known_by.includes(povId))).map(q => ({ question_id: q.id, required_fact_ids: q.answer_fact_ids, required_clue_ids: q.required_clue_ids })),
  };
}
export function readerView(project) {
  hydrateMystery(project);
  return {
    central_question: project.casefile?.central_question || null,
    facts: project.reader.facts.map(f => ({ ...f })),
    clues: project.reader.clues.map(c => ({ ...c, title: project.casefile?.clues.find(x => x.id === c.clue_id)?.title || '' })),
    interpretations: project.reader.interpretations,
    questions: project.casefile?.questions.map(q => ({ id: q.id, text: q.text, answer: project.reader.answers.find(a => a.question_id === q.id) || null })) || [],
  };
}
export function pacingView(project) {
  if (!project.casefile) return null;
  const scene = project.scenes.at(-1);
  const completed = project.scenes.filter(s => s.status === 'complete').length;
  const lastProgress = Math.max(0, ...Object.values(project.reader).flat().map(entry => entry.scene_number));
  const open = project.casefile.questions.filter(q => !project.reader.answers.some(a => a.question_id === q.id));
  return { scene_number: scene.number, scenes_remaining: project.config.max_scenes - completed, stale_scenes: completed - lastProgress,
    open_question_ids: open.map(q => q.id), suggested_clue_ids: [...new Set(open.flatMap(q => q.required_clue_ids))].filter(id => !project.case_ledger.discoveries.some(d => d.clue_id === id)),
    advice: completed - lastProgress >= 2 ? 'Đã hai cảnh chưa có thông tin mới cho độc giả. Tạo cơ hội hợp lý để tiếp cận một manh mối, để nhân vật tự chọn; không tự trao đáp án.' : 'Ưu tiên một câu hỏi đang mở, dùng áp lực và mục tiêu riêng để thúc đẩy tương tác. Không ép kết cục.',
  };
}

export function applyReaderUpdates(project, scene, response) {
  if (!project.casefile) return;
  const updates = response.reader_updates, audit = response.editorial_check;
  check(updates && audit, 'Truyện có hồ sơ vụ án cần reader_updates và editorial_check trong câu trả lời Người kể.');
  for (const key of ['pov_consistent', 'no_new_events', 'ground_truth_consistent', 'clues_supported']) check(audit[key], `Người kể tự phát hiện lỗi ${key}. Hãy sửa bản thảo trước khi nhập. ${audit.notes.join(' ')}`);
  const quoted = entry => check(hasExcerpt(response.prose, entry.excerpt), 'Thông tin độc giả cần excerpt trích nguyên văn từ bản thảo hiện tại.');
  unique(updates.clues.map(c => c.clue_id), 'Manh mối độc giả'); unique(updates.facts.map(f => f.fact_id), 'Sự thật độc giả'); unique(updates.answers.map(a => a.question_id), 'Đáp án độc giả');
  const readerClues = new Set(project.reader.clues.map(c => c.clue_id)), readerFacts = new Set(project.reader.facts.map(f => f.fact_id));
  for (const c of updates.clues) {
    quoted(c); check(knowsClue(project, scene.pov_id, c.clue_id), `POV chưa biết manh mối ${c.clue_id}. Không thể cho độc giả thấy qua POV này.`);
    readerClues.add(c.clue_id);
  }
  for (const f of updates.facts) {
    quoted(f);
    check(!f.fact_id.startsWith('secret_'), 'Bí mật riêng không tự trở thành fact cho độc giả. Dùng sự thật nền có nguồn trong hồ sơ.');
    const fact = project.world.facts.find(x => x.id === f.fact_id);
    check(fact?.known_by.includes(scene.pov_id), `POV chưa biết sự thật ${f.fact_id}.`);
    check(narrationPermission(project, scene.pov_id, f.fact_id, [...readerClues]), `Sự thật nền ${f.fact_id} chưa được chuẩn bị bằng manh mối đã kể hoặc lời thú nhận có nguồn.`);
    readerFacts.add(f.fact_id);
  }
  for (const i of updates.interpretations) {
    quoted(i); check(readerClues.has(i.clue_id) && knowsClue(project, scene.pov_id, i.clue_id), 'Cách hiểu của độc giả phải dựa trên manh mối POV biết và độc giả đã được đọc.');
    const own = project.case_ledger.interpretations.some(x => x.character_id === scene.pov_id && x.clue_id === i.clue_id && x.text === i.text && x.confidence === i.confidence);
    check(own, 'Cách hiểu đưa vào văn xuôi phải khớp một giả thuyết đã lưu của POV, không phải suy nghĩ được Người kể tạo thêm.');
  }
  for (const a of updates.answers) {
    quoted(a);
    const q = project.casefile.questions.find(q => q.id === a.question_id);
    check(q, `Không tồn tại câu hỏi: ${a.question_id}.`);
    check(q.answer_fact_ids.every(id => readerFacts.has(id) && project.world.facts.find(f => f.id === id).known_by.includes(scene.pov_id)), 'Độc giả và POV chưa có đủ sự thật để xác nhận đáp án.');
    check(q.required_clue_ids.every(id => readerClues.has(id) && knowsClue(project, scene.pov_id, id)), 'Đáp án thiếu manh mối đã được kể và được POV biết.');
  }
  for (const [key, idKey] of [['facts', 'fact_id'], ['clues', 'clue_id'], ['answers', 'question_id']]) for (const entry of updates[key]) if (!project.reader[key].some(old => old[idKey] === entry[idKey])) project.reader[key].push({ ...entry, scene_number: scene.number });
  project.reader.interpretations.push(...updates.interpretations.map(i => ({ ...i, scene_number: scene.number, pov_id: scene.pov_id })));
  scene.reader_updates = updates;
  scene.editorial_check = { ...audit, provenance_checked: true, semantic_check: 'model_self_report' };
}
