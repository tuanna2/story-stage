import { knownClues } from './mystery.js';
const terms = text => new Set(text.toLocaleLowerCase('vi').match(/[\p{L}\p{N}]{2,}/gu) || []);
export function retrieveMemories(character, query, limit = 12) {
  const keywords = terms(query);
  const memories = character.memories;
  return memories.map((m, i) => {
    const matches = [...terms(m.text)].filter(x => keywords.has(x)).length;
    return { memory: m, score: matches * 2 + m.importance + (i / Math.max(memories.length, 1)) * 5 + (m.type === 'summary' ? 3 : 0) };
  }).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.memory).sort((a, b) => a.sequence - b.sequence);
}

export function remember(project, characterId, type, text, sceneNumber, importance = 5, sourceId = null) {
  const c = project.characters.find(x => x.id === characterId);
  c.memories.push({ id: `m_${project.memory_sequence++}`, sequence: project.memory_sequence, type, text, scene_number: sceneNumber, importance, source_id: sourceId });
}

export function summarizeScene(project, scene) {
  for (const c of project.characters) {
    const memories = c.memories.filter(m => m.scene_number === scene.number && m.type !== 'summary');
    if (!memories.length) continue;
    const observations = memories.filter(m => m.type === 'observation');
    const reflection = memories.filter(m => m.type === 'reflection').at(-1);
    const text = [observations.map(m => m.text).join(' '), reflection ? `Cảm nhận của tôi: ${reflection.text}` : ''].filter(Boolean).join('\n').slice(0, 3200);
    remember(project, c.id, 'summary', text, scene.number, 8, scene.id);
  }
}

export function characterView(project, characterId) {
  const c = project.characters.find(x => x.id === characterId);
  const scene = project.scenes.at(-1);
  return {
    id: c.id, name: c.name, role: c.role, personality: c.personality, background: c.background, status: c.status,
    goals: c.goals, secret: c.secret, limitations: c.limitations, mood: c.mood, beliefs: c.beliefs, trust: c.trust,
    known_facts: project.world.facts.filter(f => f.known_by.includes(c.id)).map(({ id, text }) => ({ id, text })),
    known_clues: knownClues(project, c.id), own_interpretations: project.case_ledger?.interpretations.filter(i => i.character_id === c.id) || [],
    memories: retrieveMemories(c, `${c.goals.join(' ')} ${project.world.location}`, project.config.memory_limit),
    observable_scene: { number: scene.number, location: scene.location || project.world.location, time: scene.time || project.world.time },
    others: project.characters.filter(x => x.id !== c.id).map(({ id, name, role }) => ({ id, name, role })),
  };
}
