import { randomUUID } from 'node:crypto';
import { presets, defaultConfig } from './presets.js';
import { parseSchema, parseResponse, presetSchema, configSchema, batchResponseSchema, actorResponseSchema, resolutionResponseSchema, narrationResponseSchema, caseSetupResponseSchema, DomainError } from './schema.js';
import { buildPrompt, actorOrder } from './prompts.js';
import { remember, summarizeScene } from './memory.js';
import { hydrateMystery, initializeMystery, validateCasefile, validateClaims, validateInterpretations, applyDiscoveries, validateEvidenceReveal, applyReaderUpdates, pacingView } from './mystery.js';

const uid = prefix => `${prefix}_${randomUUID()}`;
const assert = (condition, message) => { if (!condition) throw new DomainError(message); };
export function cleanPreset(preset) {
  const { id, ...p } = structuredClone(preset);
  p.characters = p.characters.map(({ memories, ...c }) => c);
  return p;
}
export function createProject({ name, preset_id = 'interrogation', preset, config = {} }) {
  const base = preset || cleanPreset(presets.find(x => x.id === preset_id) || (() => { throw new DomainError('Không tìm thấy preset.'); })());
  const parsed = parseSchema(presetSchema, base);
  validatePreset(parsed);
  const project = { ...parsed, id: uid('p'), name: name?.trim() || parsed.name, config: parseSchema(configSchema, { ...defaultConfig, ...config }), revision: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'running', scenes: [], exchanges: [], pending_job_id: null, pending_action: null, next_actor_id: null, memory_sequence: 0 };
  assert(project.name.length <= 120, 'Tên truyện tối đa 120 ký tự.');
  for (const c of project.characters) {
    c.memories = [];
    remember(project, c.id, 'background', c.background, 0, 8);
    if (c.secret && !project.world.facts.some(f => f.id === `secret_${c.id}`)) project.world.facts.push({ id: `secret_${c.id}`, text: c.secret, known_by: [c.id] });
    remember(project, c.id, 'reflection', `Mục tiêu của tôi: ${c.goals.join('; ')}`, 0, 9);
  }
  initializeMystery(project);
  addScene(project);
  return project;
}
export function validatePreset(preset) {
  const ids = preset.characters.map(c => c.id);
  assert(preset.characters.some(c => c.status === 'active'), 'Cần ít nhất một nhân vật có status active để bắt đầu.');
  assert(new Set(ids).size === ids.length, 'ID nhân vật phải duy nhất.');
  const factIds = preset.world.facts.map(f => f.id);
  assert(new Set(factIds).size === factIds.length, 'ID sự thật phải duy nhất.');
  for (const c of preset.characters) {
    const secret = preset.world.facts.find(f => f.id === `secret_${c.id}`);
    if (secret) assert(c.secret && secret.text === c.secret && secret.known_by.includes(c.id), `Sự thật secret_${c.id} phải khớp bí mật và được chính nhân vật biết.`);
    for (const target of Object.keys(c.trust)) assert(ids.includes(target) && target !== c.id, 'Quan hệ phải trỏ đến một nhân vật khác có trong dàn vai.');
    for (const belief of c.beliefs) for (const id of belief.evidence_fact_ids) assert((id === `secret_${c.id}` && c.secret) || preset.world.facts.some(f => f.id === id && f.known_by.includes(c.id)), `Niềm tin của ${c.name} trỏ đến sự thật chưa biết: ${id}.`);
  }
  for (const f of preset.world.facts) for (const known of f.known_by) assert(ids.includes(known), `Sự thật ${f.id} chứa người biết không hợp lệ: ${known}.`);
  validateClaims(preset.world.facts);
  if (preset.casefile) validateCasefile(preset, preset.casefile);
}
function addScene(project) {
  project.scenes.push({ id: uid('s'), number: project.scenes.length + 1, status: 'simulating', title: '', location: project.world.location, time: project.world.time, atmosphere: '', turns: [], pov_id: null, end_reason: '', prose: null, summary: null });
}
export function nextJob(project, guidance = '') {
  hydrateMystery(project);
  if (project.pending_job_id) return project.exchanges.find(x => x.id === project.pending_job_id);
  assert(project.status !== 'complete', 'Truyện đã đạt số cảnh tối đa.');
  const scene = project.scenes.at(-1);
  const kind = scene.status === 'awaiting_narration' ? 'narration' : project.pending_action ? 'resolution' : project.config.mode === 'isolated' ? 'character' : 'simulation';
  const count = kind === 'simulation' ? Math.min(project.config.batch_size, project.config.max_turns - scene.turns.length) : 1;
  const job = { id: uid('x'), kind, revision: project.revision, scene_number: scene.number, status: 'pending', guidance: guidance.trim().slice(0, 4000), actor_ids: kind === 'narration' ? [scene.pov_id] : project.pending_action ? [project.pending_action.character_id] : actorOrder(project, count), created_at: new Date().toISOString(), raw_response: null, response: null };
  job.prompt = buildPrompt(project, job);
  project.pending_job_id = job.id;
  project.exchanges.push(job);
  return job;
}
export function caseSetupJob(project, guidance = '') {
  hydrateMystery(project);
  assert(!project.casefile, 'Truyện đã có hồ sơ vụ án cố định. Tạo truyện mới để thử sự thật nền khác.');
  assert(!project.pending_job_id && !project.pending_action && !project.scenes.some(s => s.turns.length), 'Chuẩn bị hồ sơ trước lượt mô phỏng đầu tiên và khi không có prompt đang chờ.');
  const job = { id: uid('x'), kind: 'case_setup', revision: project.revision, scene_number: project.scenes.at(-1).number, status: 'pending', guidance: guidance.trim().slice(0, 4000), actor_ids: [], created_at: new Date().toISOString(), raw_response: null, response: null };
  job.prompt = buildPrompt(project, job);
  project.pending_job_id = job.id; project.exchanges.push(job);
  return job;
}
export function cancelJob(project, jobId) {
  assert(project.pending_job_id === jobId, 'Prompt này không còn chờ câu trả lời.');
  project.exchanges.find(x => x.id === jobId).status = 'cancelled';
  project.pending_job_id = null;
}

export function previewResponse(project, jobId, raw) {
  const copy = structuredClone(project);
  const response = acceptResponse(copy, jobId, raw);
  const before = project.scenes.at(-1), scene = copy.scenes.find(s => s.id === before.id);
  return { valid: true, kind: response.kind, next_status: copy.status === 'complete' ? 'complete' : copy.pending_action ? 'awaiting_resolution' : copy.scenes.at(-1).status,
    scene: { title: scene.title, status: scene.status, pov_id: scene.pov_id, end_reason: scene.end_reason },
    new_turns: scene.turns.slice(before.turns.length), new_facts: copy.world.facts.filter(f => !project.world.facts.some(old => old.id === f.id)),
    changed_moods: copy.characters.filter((c, i) => Object.keys(c.mood).some(k => c.mood[k] !== project.characters[i].mood[k])).map(c => ({ id: c.id, name: c.name, mood: c.mood })),
    changed_statuses: copy.characters.filter((c, i) => c.status !== project.characters[i].status).map(c => ({ id: c.id, name: c.name, status: c.status })),
    reveals: copy.world.facts.filter(f => JSON.stringify(f.known_by) !== JSON.stringify(project.world.facts.find(old => old.id === f.id)?.known_by)).map(f => ({ id: f.id, text: f.text, known_by: f.known_by })),
    prose: response.prose || null, proposed_action: response.kind === 'character' ? { actor_id: response.character_id, action: response.action, thought: response.thought } : null,
    casefile_created: response.kind === 'case_setup' ? copy.casefile : null,
    initial_beliefs: response.kind === 'case_setup' ? response.initial_beliefs : [],
    discoveries: copy.case_ledger.discoveries.slice(project.case_ledger?.discoveries.length || 0),
    interpretations: response.kind === 'character' ? response.interpretation_updates.map(i => ({ ...i, character_id: response.character_id })) : copy.case_ledger.interpretations.slice(project.case_ledger?.interpretations.length || 0),
    reader_updates: response.reader_updates || null, editorial_check: scene.editorial_check || null, pacing: pacingView(copy),
    review_notes: ['Kiểm tra xem outcome có hợp lý và giữ đúng quy tắc thế giới.', 'Phần mềm kiểm tra cấu trúc, ID và phạm vi người biết. Tính hợp lý của văn xuôi và nguyên nhân tiết lộ vẫn cần bạn đọc duyệt.'],
  };
}

export function acceptResponse(project, jobId, raw) {
  const working = structuredClone(project);
  const response = applyResponse(working, jobId, raw);
  Object.assign(project, working);
  return response;
}

function applyResponse(project, jobId, raw) {
  hydrateMystery(project);
  const job = project.exchanges.find(x => x.id === jobId);
  if (!job || job.status !== 'pending' || project.pending_job_id !== jobId) throw new DomainError('Prompt đã được nhập hoặc bị hủy. Không thể nhập lần thứ hai.', 409);
  if (job.revision !== project.revision) throw new DomainError('Prompt thuộc phiên bản cũ. Hãy tạo prompt mới từ trạng thái hiện tại.', 409);
  const schemas = { simulation: batchResponseSchema, character: actorResponseSchema, resolution: resolutionResponseSchema, narration: narrationResponseSchema, case_setup: caseSetupResponseSchema };
  const response = parseSchema(schemas[job.kind], parseResponse(raw));
  assert(response.exchange_id === job.id && response.revision === project.revision && response.scene_number === job.scene_number, 'exchange_id, revision hoặc scene_number không khớp prompt.');
  const scene = project.scenes.at(-1);
  if (job.kind === 'case_setup') {
    assert(!project.casefile && !project.scenes.some(s => s.turns.length), 'Hồ sơ nền chỉ được tạo trước mô phỏng.');
    validateClaims(project.world.facts, response.new_facts);
    for (const f of response.new_facts) {
      assert(!project.world.facts.some(old => old.id === f.id), `Sự thật ${f.id} đã tồn tại.`);
      assert(new Set(f.known_by).size === f.known_by.length && f.known_by.every(id => project.characters.some(c => c.id === id)), 'Người biết sự thật nền không hợp lệ.');
      project.world.facts.push(f);
    }
    project.casefile = response.casefile;
    initializeMystery(project);
    for (const { character_id, ...belief } of response.initial_beliefs) {
      const c = project.characters.find(c => c.id === character_id);
      assert(c, 'Niềm tin ban đầu có nhân vật không tồn tại.');
      validateBeliefs(project, c.id, [belief]); c.beliefs.push(belief);
    }
  } else if (job.kind === 'character') {
    assert(response.character_id === job.actor_ids[0], 'Nhân vật trả lời không đúng người được chọn.');
    validateBeliefs(project, response.character_id, response.belief_updates);
    validateInterpretations(project, response.character_id, response.interpretation_updates);
    project.pending_action = response;
  } else if (job.kind === 'simulation' || job.kind === 'resolution') {
    const turns = job.kind === 'simulation' ? response.turns : [{ ...project.pending_action, actor_id: project.pending_action.character_id, outcome: response.outcome, witnesses: response.witnesses, new_facts: response.new_facts, reveals: response.reveals, clue_discoveries: response.clue_discoveries, status_updates: response.status_updates, trust_updates: response.trust_updates, world_event: response.world_event }];
    assert(turns.length <= job.actor_ids.length, 'Có nhiều lượt hơn số yêu cầu.');
    assert(response.scene.ended || turns.length === job.actor_ids.length, 'Nếu cảnh chưa kết thúc, cần trả đủ số lượt trong prompt.');
    for (const [i, t] of turns.entries()) {
      if (job.kind === 'resolution') assert(t.actor_id === job.actor_ids[i], `Lượt ${i + 1} sai người hành động, cần ${job.actor_ids[i]}.`);
      validateBeliefs(project, t.actor_id, t.belief_updates);
      applyTurn(project, scene, t);
    }
    assert(project.characters.some(c => c.id === response.scene.pov_id), 'POV không có trong dàn nhân vật.');
    assert(scene.turns.some(t => t.witnesses.includes(response.scene.pov_id) || t.world_event?.witnesses.includes(response.scene.pov_id)), 'POV phải là người chứng kiến ít nhất một sự kiện của cảnh.');
    assert(!response.scene.ended || response.scene.end_reason.trim(), 'Cảnh kết thúc cần có lý do.');
    assert(response.scene.ended || !response.scene.end_reason.trim(), 'Cảnh chưa kết thúc thì end_reason phải rỗng.');
    if (response.scene.next_actor_id) assert(project.characters.some(c => c.id === response.scene.next_actor_id && c.status === 'active'), 'Người hành động tiếp theo phải tồn tại và có status active.');
    project.next_actor_id = response.scene.next_actor_id;
    Object.assign(scene, { title: response.scene.title, location: response.scene.location, time: response.scene.time, atmosphere: response.scene.atmosphere, pov_id: response.scene.pov_id, end_reason: response.scene.end_reason });
    Object.assign(project.world, { location: scene.location, time: scene.time, pressure: response.scene.pressure });
    if (response.scene.ended || scene.turns.length >= project.config.max_turns || !project.characters.some(c => c.status === 'active')) {
      scene.status = 'awaiting_narration';
      if (!scene.end_reason) scene.end_reason = project.characters.some(c => c.status === 'active') ? 'Đạt số lượt tối đa của cảnh.' : 'Không còn nhân vật sẵn sàng hành động.';
    }
    project.pending_action = null;
  } else {
    assert(response.pov_id === scene.pov_id, 'POV bản thảo không khớp POV của cảnh.');
    const observableIds = scene.turns.filter(t => t.witnesses.includes(scene.pov_id) || t.world_event?.witnesses.includes(scene.pov_id)).map(t => t.id);
    assert(new Set(response.used_turn_ids).size === response.used_turn_ids.length, 'used_turn_ids có ID trùng.');
    assert(response.used_turn_ids.length === observableIds.length && response.used_turn_ids.every(id => observableIds.includes(id)), 'used_turn_ids phải khớp các lượt POV chứng kiến.');
    applyReaderUpdates(project, scene, response);
    scene.prose = response.prose; scene.summary = response.summary; scene.status = 'complete';
    summarizeScene(project, scene);
    if (project.scenes.length >= project.config.max_scenes || !project.characters.some(c => c.status === 'active')) project.status = 'complete';
    else addScene(project);
  }
  job.status = 'consumed'; job.raw_response = raw; job.response = response; job.consumed_at = new Date().toISOString();
  project.pending_job_id = null;
  project.revision++; project.updated_at = new Date().toISOString();
  job.consumed_revision = project.revision;
  return response;
}

function validateBeliefs(project, actorId, beliefs = []) {
  for (const b of beliefs) for (const f of b.evidence_fact_ids) assert(project.world.facts.some(x => x.id === f && x.known_by.includes(actorId)), `Nhân vật ${actorId} dùng sự thật chưa biết làm căn cứ: ${f}.`);
}
function applyFacts(project, newFacts, reveals, witnesses, outcome, source, discoveries = []) {
  const validIds = project.characters.map(c => c.id);
  for (const witness of witnesses) assert(validIds.includes(witness), `Người chứng kiến không tồn tại: ${witness}.`);
  assert(new Set(witnesses).size === witnesses.length, 'Danh sách người chứng kiến có ID trùng.');
  validateClaims(project.world.facts, newFacts);
  for (const f of newFacts) {
    assert(!project.world.facts.some(x => x.id === f.id), `Sự thật ${f.id} đã tồn tại. Không thể ghi đè sự thật.`);
    assert(f.known_by.length > 0 && f.known_by.every(id => witnesses.includes(id)), `Người biết ${f.id} phải thuộc nhóm chứng kiến.`);
    assert(new Set(f.known_by).size === f.known_by.length, `Người biết ${f.id} có ID trùng.`);
    project.world.facts.push(structuredClone(f));
  }
  applyDiscoveries(project, discoveries, witnesses, outcome, source);
  for (const r of reveals) {
    const f = project.world.facts.find(x => x.id === r.fact_id);
    assert(f, `Không tồn tại sự thật cần tiết lộ: ${r.fact_id}.`);
    assert(r.to.every(id => witnesses.includes(id)), 'Chỉ người chứng kiến mới có thể nhận tiết lộ.');
    assert(new Set(r.to).size === r.to.length, 'Người nhận tiết lộ có ID trùng.');
    validateEvidenceReveal(project, r, witnesses, outcome, source);
    f.known_by = [...new Set([...f.known_by, ...r.to])];
  }
}
function applyTurn(project, scene, turn) {
  assert(turn.witnesses.includes(turn.actor_id), 'Người hành động phải có trong witnesses.');
  const c = project.characters.find(x => x.id === turn.actor_id);
  assert(c?.status === 'active', 'Người hành động không sẵn sàng.');
  validateInterpretations(project, c.id, turn.interpretation_updates);
  const source = { scene_number: scene.number, turn_id: `t_${scene.number}_${scene.turns.length + 1}`, source: 'action' };
  project.case_ledger.interpretations.push(...(turn.interpretation_updates || []).map(i => ({ ...i, character_id: c.id, ...source })));
  applyFacts(project, turn.new_facts, turn.reveals, turn.witnesses, turn.outcome, source, turn.clue_discoveries);
  if (turn.world_event) applyFacts(project, turn.world_event.new_facts, turn.world_event.reveals, turn.world_event.witnesses, turn.world_event.text, { ...source, source: 'world_event' }, turn.world_event.clue_discoveries);
  c.mood = turn.mood;
  for (const b of turn.belief_updates || []) {
    const old = c.beliefs.find(x => x.text === b.text);
    if (old) Object.assign(old, b); else c.beliefs.push(b);
  }
  for (const t of turn.trust_updates || []) {
    assert(t.target_id !== c.id && project.characters.some(x => x.id === t.target_id), 'Quan hệ phải trỏ đến nhân vật khác có trong dàn vai.');
    c.trust[t.target_id] = Math.max(-100, Math.min(100, (c.trust[t.target_id] || 0) + t.delta));
  }
  const saved = { ...turn, id: `t_${scene.number}_${scene.turns.length + 1}`, number: scene.turns.length + 1 };
  scene.turns.push(saved);
  remember(project, c.id, 'reflection', turn.thought, scene.number, 7, saved.id);
  for (const witness of turn.witnesses) remember(project, witness, 'observation', `${c.name}: ${turn.action}\nKết quả: ${turn.outcome}`, scene.number, 6, saved.id);
  if (turn.world_event) for (const witness of turn.world_event.witnesses) remember(project, witness, 'observation', `Sự kiện thế giới: ${turn.world_event.text}`, scene.number, 8, saved.id);
  applyStatuses(project, turn.status_updates || [], turn.witnesses);
  if (turn.world_event) applyStatuses(project, turn.world_event.status_updates || [], turn.world_event.witnesses);
}

function applyStatuses(project, updates, witnesses) {
  for (const update of updates) {
    const c = project.characters.find(c => c.id === update.character_id);
    assert(c && witnesses.includes(c.id), 'Thay đổi trạng thái cần nhân vật tồn tại và có mặt trong witnesses.');
    assert(c.status !== 'dead' || update.status === 'dead', 'Không thể hồi sinh nhân vật trong thế giới hiện thực.');
    c.status = update.status;
  }
}

export function patchSetup(project, { name, preset, config }) {
  assert(project.revision === 0 && !project.exchanges.length, 'Chỉ sửa dàn dựng trước khi tạo prompt đầu tiên. Tạo truyện mới để thử cấu hình khác.');
  const fresh = createProject({ name: name || project.name, preset: preset || exportPreset(project), config: config || project.config });
  Object.assign(project, fresh, { id: project.id, created_at: project.created_at });
}
export function exportPreset(project) {
  return { name: project.name, genre: project.genre, premise: project.premise, source: project.source, description: project.description,
    world: structuredClone(project.world), casefile: structuredClone(project.casefile || null),
    characters: project.characters.map(({ id, name, role, personality, background, goals, secret, limitations, mood, color, beliefs, trust, status }) => ({ id, name, role, personality, background, goals, secret, limitations, mood, color, beliefs, trust, status })), style: project.style };
}
export function exportStory(project) {
  const chapters = project.scenes.filter(s => s.prose).map(s => `## Cảnh ${s.number}: ${s.title}\n\n${s.prose}`).join('\n\n');
  return `# ${project.name}\n\n${chapters || '*Chưa có cảnh văn xuôi nào.*'}\n`;
}
