import { DomainError } from './errors.js';
import { hasExcerpt } from './mystery.js';
import { createHash } from 'node:crypto';

export const wordCount = text => String(text || '').trim().split(/\s+/u).filter(Boolean).length;
const check = (ok, message) => { if (!ok) throw new DomainError(message); };
const emptyReader = () => ({ facts: [], clues: [], interpretations: [], answers: [] });
export function hydrateStory(project) {
  project.threads ??= project.characters.flatMap(c => c.goals.map((title, i) => ({ id: `goal_${c.id.length > 60 ? createHash('sha256').update(c.id).digest('hex').slice(0, 32) : c.id}_${i + 1}`, kind: 'goal', title, character_ids: [c.id], known_by: [c.id], status: 'open', evidence_fact_ids: [], history: [{ scene_number: 0, turn_id: null, excerpt: title, status: 'open', known_by: [c.id], evidence_fact_ids: [] }] })));
  project.manuscript_revision ??= 0;
  project.manuscript_events ??= [];
  project.pending_rewrite_job_id ??= null;
  for (const scene of project.scenes) {
    scene.versions ??= [];
    if (scene.prose && !scene.versions.length) {
      const version = { id: `v_legacy_${scene.number}`, number: 1, source: 'legacy', created_at: project.updated_at, prose: scene.prose, summary: scene.summary || scene.prose.slice(0, 280), reader_updates: scene.reader_updates || null, editorial_check: scene.editorial_check || null, continuity_review: scene.continuity_review || null };
      scene.versions.push(structuredClone(version)); scene.current_version_id = version.id;
    }
  }
  if (!project.chapters) project.chapters = project.scenes.filter(s => s.prose).reduce((chapters, scene, i) => {
    const n = Math.floor(i / 2);
    chapters[n] ??= { id: `ch_${n + 1}`, title: `Chương ${n + 1}`, scene_numbers: [] };
    chapters[n].scene_numbers.push(scene.number); return chapters;
  }, []);
  return project;
}
export function storyThreads(project, characterId) {
  hydrateStory(project);
  return project.threads.filter(t => !characterId || t.known_by.includes(characterId)).flatMap(({ history, ...t }) => {
    const source = characterId ? history.findLast(h => (h.known_by || t.known_by).includes(characterId)) : history.at(-1);
    if (!source) return [];
    return [{ ...t, status: source.status, evidence_fact_ids: source.evidence_fact_ids || [], last_source: source }];
  });
}
export function applyThreads(project, scene, turn, turnId, responsePath = '') {
  const ids = new Set();
  for (const [updateIndex, update] of (turn.thread_updates || []).entries()) {
    check(!ids.has(update.thread_id), 'Một lượt không cập nhật cùng mạch truyện hai lần.'); ids.add(update.thread_id);
    check(update.character_ids.includes(turn.actor_id) && new Set(update.character_ids).size === update.character_ids.length && update.character_ids.every(id => turn.witnesses.includes(id)), 'Mạch truyện cần người hành động và những người có mặt trong witnesses.');
    check(hasExcerpt(`${turn.action}\n${turn.outcome}`, update.excerpt), 'Mạch truyện cần excerpt trích nguyên văn hành động hoặc kết quả.');
    const path = `${responsePath ? `${responsePath}.` : ''}thread_updates.${updateIndex}.evidence_fact_ids`;
    const actor = project.characters.find(c => c.id === turn.actor_id);
    const details = [];
    const seenEvidence = new Set();
    for (const [index, id] of update.evidence_fact_ids.entries()) {
      const fact = project.world.facts.find(f => f.id === id);
      let message;
      if (seenEvidence.has(id)) message = `ID ${id} bị lặp trong căn cứ của mạch ${update.thread_id}. Chỉ giữ một lần.`;
      else if (!fact) message = `Sự thật ${id} chưa tồn tại tại lượt ${scene.turns.length + 1}. Dùng ID đã có trong dữ liệu; không dùng sự thật của lượt tương lai.`;
      else if (!fact.known_by.includes(turn.actor_id)) {
        const people = fact.known_by.map(person => project.characters.find(c => c.id === person)?.name || person);
        message = `${actor.name} (${actor.id}) chưa biết ${id}. Hiện người biết: ${people.join(', ') || 'chỉ Thế giới'}. Bỏ ID này khỏi căn cứ nếu không cần, hoặc dùng một sự thật phù hợp mà actor đã biết. Chỉ thêm reveals khi hành động/kết quả thực sự có nguồn tiết lộ; không tự mở quyền biết để qua kiểm tra.`;
      }
      if (message) details.push({ path: `${path}.${index}`, message });
      seenEvidence.add(id);
    }
    if (details.length) throw new DomainError(`Lượt ${scene.turns.length + 1} · ${actor.name} (${actor.id}): căn cứ mạch ${update.thread_id} chưa hợp lệ.`, 422, details);
    let thread = project.threads.find(t => t.id === update.thread_id);
    if (thread) {
      check(thread.known_by.includes(turn.actor_id), 'Người hành động chưa biết mạch truyện này.');
      check(thread.kind === update.kind && thread.title === update.title && [...thread.character_ids].sort().join('|') === [...update.character_ids].sort().join('|'), 'Giữ loại, tiêu đề và nhân vật của mạch đã có; dùng ID mới nếu là một mạch khác.');
    } else {
      check(update.status === 'open', 'Mạch mới bắt đầu với status open.');
      check(project.threads.length < 200, 'Đã đạt 200 mạch truyện.');
      thread = { id: update.thread_id, kind: update.kind, title: update.title, character_ids: update.character_ids,
        known_by: turn.witnesses.filter(id => update.evidence_fact_ids.every(fId => project.world.facts.find(f => f.id === fId).known_by.includes(id))), history: [] };
      project.threads.push(thread);
    }
    Object.assign(thread, { status: update.status, evidence_fact_ids: update.evidence_fact_ids });
    thread.history.push({ scene_number: scene.number, turn_id: turnId, excerpt: update.excerpt, status: update.status,
      known_by: thread.known_by.filter(id => turn.witnesses.includes(id) && update.evidence_fact_ids.every(fId => project.world.facts.find(f => f.id === fId).known_by.includes(id))), evidence_fact_ids: [...update.evidence_fact_ids] });
  }
}
export function checkpoint(project, scene, replace = false) {
  if (scene.turns.length || (scene.checkpoint && !replace)) return;
  scene.checkpoint = structuredClone(Object.fromEntries(['world', 'characters', 'casefile', 'case_ledger', 'reader', 'threads', 'memory_sequence', 'next_actor_id'].map(k => [k, project[k]])));
}
export function qualityNotes(project, response) {
  const notes = [];
  const scene = project.scenes.find(s => s.number === response.scene_number);
  if (response.prose) {
    const count = wordCount(response.prose), target = project.style.words;
    if (count < target * .65) notes.push(`Bản thảo có ${count} từ, ngắn hơn mục tiêu ${target} từ. Có thể nhờ viết lại nếu log có đủ chất liệu.`);
  }
  for (const [i, turn] of (response.turns || []).entries()) {
    if (wordCount(`${turn.action} ${turn.outcome}`) < 80) notes.push(`Lượt ${i + 1} còn ít chất liệu: nên có đối thoại/hành động cụ thể, phản ứng và hệ quả.`);
    if (scene?.turns.some(old => old.action.trim() === turn.action.trim())) notes.push(`Lượt ${i + 1} lặp lại một hành động đã có trong cảnh; kiểm tra xem hệ quả có thay đổi.`);
  }
  return notes;
}
export function readerBefore(project, number) {
  return Object.fromEntries(Object.entries(project.reader || emptyReader()).map(([key, entries]) => [key, entries.filter(e => e.scene_number < number)]));
}
