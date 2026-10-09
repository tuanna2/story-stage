import { z } from 'zod';

const text = z.string().trim().min(1).max(12000);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const moodSchema = z.object({ fear: z.number().min(0).max(100), anger: z.number().min(0).max(100), hope: z.number().min(0).max(100), guilt: z.number().min(0).max(100) }).strict();
export const factSchema = z.object({ id, text, known_by: z.array(id).max(12), claim: z.object({ key: id, value: text.max(300) }).strict().optional() }).strict();
const beliefSchema = z.object({ text, confidence: z.number().min(0).max(100), evidence_fact_ids: z.array(id).max(12) }).strict();
export const casefileSchema = z.object({
  central_question: text.max(1600),
  truths: z.array(z.object({ fact_id: id, required_clue_ids: z.array(id).max(12) }).strict()).min(1).max(24),
  timeline: z.array(z.object({ id, at: text.max(200), text: text.max(3000), fact_ids: z.array(id).min(1).max(12) }).strict()).min(1).max(24),
  clues: z.array(z.object({ id, title: text.max(200), evidence_fact_id: id, location: text.max(300), discovery_condition: text.max(2000), surface_reading: text.max(2000), deeper_reading: text.max(2000), truth_fact_ids: z.array(id).min(1).max(12) }).strict()).min(1).max(16),
  questions: z.array(z.object({ id, text: text.max(1600), answer_fact_ids: z.array(id).min(1).max(12), required_clue_ids: z.array(id).max(12) }).strict()).min(1).max(12),
}).strict();
const interpretationUpdates = z.array(z.object({ clue_id: id, text: text.max(1600), confidence: z.number().min(0).max(100) }).strict()).max(6).default([]);
const clueDiscoveries = z.array(z.object({ clue_id: id, by: z.array(id).min(1).max(8), excerpt: text.max(2000) }).strict()).max(6).default([]);
const quotedFact = z.object({ fact_id: id, excerpt: text.max(2000) }).strict();
const quotedClue = z.object({ clue_id: id, excerpt: text.max(2000) }).strict();
export const readerUpdatesSchema = z.object({
  facts: z.array(quotedFact).max(24), clues: z.array(quotedClue).max(16),
  interpretations: z.array(z.object({ clue_id: id, text: text.max(1600), confidence: z.number().min(0).max(100), excerpt: text.max(2000) }).strict()).max(12),
  answers: z.array(z.object({ question_id: id, excerpt: text.max(2000) }).strict()).max(12),
}).strict();
const editorialCheck = z.object({ pov_consistent: z.boolean(), no_new_events: z.boolean(), ground_truth_consistent: z.boolean(), clues_supported: z.boolean(), notes: z.array(text.max(2000)).max(12) }).strict();
export const configSchema = z.object({ mode: z.enum(['batch', 'isolated']), max_scenes: z.number().int().min(1).max(30), max_turns: z.number().int().min(1).max(20), batch_size: z.number().int().min(1).max(6), memory_limit: z.number().int().min(4).max(24) }).strict();
export const presetSchema = z.object({
  name: text.max(120), genre: text.max(120), description: text.optional(), source: text.optional(), premise: text,
  world: z.object({ setting: text, rules: z.array(text).min(1).max(20), location: text.max(200), time: text.max(200), pressure: z.number().min(0).max(100), facts: z.array(factSchema).max(100) }).strict(),
  characters: z.array(z.object({
    id, name: text.max(120), role: text.max(200), personality: text, background: text,
    goals: z.array(text).min(1).max(8), secret: z.string().max(12000), limitations: z.array(text).max(12),
    mood: moodSchema, color: z.string().regex(/^#[0-9a-fA-F]{6}$/), status: z.enum(['active', 'absent', 'dead']).default('active'), beliefs: z.array(beliefSchema).max(24).default([]), trust: z.record(id, z.number().min(-100).max(100)).default({}),
  }).strict()).min(2).max(8),
  style: z.object({ voice: text, guidance: text, words: z.number().int().min(200).max(2000) }).strict(),
  casefile: casefileSchema.nullable().default(null),
}).strict();

const reveal = z.object({ fact_id: id, to: z.array(id).min(1).max(8), evidence_clue_ids: z.array(id).max(12).default([]), source_character_id: id.nullable().default(null), excerpt: z.string().max(2000).default('') }).strict();
const statusUpdates = z.array(z.object({ character_id: id, status: z.enum(['active', 'absent', 'dead']), reason: text.max(1200) }).strict()).max(8).default([]);
const turnSchema = z.object({
  actor_id: id, thought: text.max(1600), intention: text.max(1600), mood: moodSchema, action: text.max(3000), outcome: text.max(4000),
  witnesses: z.array(id).min(1).max(8), new_facts: z.array(factSchema).max(8), reveals: z.array(reveal).max(8),
  belief_updates: z.array(beliefSchema).max(4).default([]), status_updates: statusUpdates,
  clue_discoveries: clueDiscoveries, interpretation_updates: interpretationUpdates,
  trust_updates: z.array(z.object({ target_id: id, delta: z.number().min(-30).max(30), reason: text.max(800) }).strict()).max(8).default([]),
  world_event: z.object({ text: text.max(3000), witnesses: z.array(id).min(1).max(8), new_facts: z.array(factSchema).max(8), reveals: z.array(reveal).max(8), status_updates: statusUpdates, clue_discoveries: clueDiscoveries }).strict().nullable(),
}).strict();
const sceneSchema = z.object({ title: text.max(200), location: text.max(200), time: text.max(200), atmosphere: text.max(1600), pressure: z.number().min(0).max(100), ended: z.boolean(), end_reason: z.string().max(1600), pov_id: id, next_actor_id: id.nullable().default(null) }).strict();
const envelope = { exchange_id: id, revision: z.number().int().min(0), scene_number: z.number().int().min(1) };
export const batchResponseSchema = z.object({ ...envelope, kind: z.literal('simulation'), scene: sceneSchema, turns: z.array(turnSchema).min(1).max(6) }).strict();
export const actorResponseSchema = z.object({ ...envelope, kind: z.literal('character'), character_id: id, thought: text.max(1600), intention: text.max(1600), mood: moodSchema, action: text.max(3000), belief_updates: z.array(beliefSchema).max(4).default([]), interpretation_updates: interpretationUpdates }).strict();
export const resolutionResponseSchema = z.object({ ...envelope, kind: z.literal('resolution'), scene: sceneSchema, outcome: text.max(4000), witnesses: z.array(id).min(1).max(8), new_facts: z.array(factSchema).max(8), reveals: z.array(reveal).max(8), status_updates: statusUpdates, clue_discoveries: clueDiscoveries, trust_updates: turnSchema.shape.trust_updates, world_event: turnSchema.shape.world_event }).strict();
export const narrationResponseSchema = z.object({ ...envelope, kind: z.literal('narration'), pov_id: id, prose: text.max(80000), summary: text.max(4000), used_turn_ids: z.array(id).min(1).max(20), reader_updates: readerUpdatesSchema.optional(), editorial_check: editorialCheck.optional() }).strict();
export const caseSetupResponseSchema = z.object({ ...envelope, kind: z.literal('case_setup'), casefile: casefileSchema, new_facts: z.array(factSchema).max(80), initial_beliefs: z.array(z.object({ character_id: id, ...beliefSchema.shape }).strict()).max(24) }).strict();

export class DomainError extends Error {
  constructor(message, status = 422, details = []) { super(message); this.statusCode = status; this.details = details; }
}
export function parseSchema(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new DomainError('Dữ liệu chưa đúng cấu trúc. Hãy sửa các trường được đánh dấu.', 422, result.error.issues.map(x => ({ path: x.path.join('.'), message: x.message })));
  return result.data;
}
export function parseResponse(raw) {
  if (typeof raw !== 'string' || raw.length > 1000000) throw new DomainError('Câu trả lời phải là văn bản JSON, tối đa 1 MB.');
  const clean = raw.trim().replace(/^\uFEFF/, '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(clean); } catch { throw new DomainError('Không đọc được JSON. Sao chép toàn bộ đối tượng từ { đến }, hoặc cả khối ```json. Không cần dán phần giải thích.'); }
}
