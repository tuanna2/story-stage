export function batch(project, job, overrides = {}) {
  return {
    exchange_id: job.id, revision: job.revision, scene_number: job.scene_number, kind: 'simulation',
    scene: { title: 'Một lời bị bỏ qua', location: project.world.location, time: '20:12', atmosphere: 'Mưa gõ lên cửa kính, tiếng đồng hồ đều đều.', pressure: 54, ended: false, end_reason: '', pov_id: job.actor_ids[0] },
    turns: job.actor_ids.map((actor_id, i) => ({ actor_id, thought: `Nội tâm riêng của ${actor_id}.`, intention: 'Tìm người lắng nghe.', mood: { fear: 30 + i, anger: 40, hope: 35, guilt: 20 }, action: `Nhân vật ${actor_id} hỏi về một hồ sơ cũ.`, outcome: 'Câu hỏi được ghi lại nhưng chưa có câu trả lời.', witnesses: [actor_id], new_facts: [], reveals: [], belief_updates: [], trust_updates: [], world_event: null })),
    ...overrides,
  };
}
export function narration(project, job) {
  const scene = project.scenes.at(-1);
  return { exchange_id: job.id, revision: job.revision, scene_number: job.scene_number, kind: 'narration', pov_id: scene.pov_id,
    prose: 'Tôi nghe mưa gõ lên khung cửa. Câu hỏi về hồ sơ cũ vẫn treo giữa chúng tôi, chưa có lời đáp.\n\nTiếng đồng hồ nhắc tôi rằng đêm vẫn đang trôi.', summary: 'Một câu hỏi về hồ sơ cũ chưa được trả lời.', used_turn_ids: scene.turns.filter(t => t.witnesses.includes(scene.pov_id) || t.world_event?.witnesses.includes(scene.pov_id)).map(t => t.id) };
}
export function actor(project, job) {
  return { exchange_id: job.id, revision: job.revision, scene_number: job.scene_number, kind: 'character', character_id: job.actor_ids[0], thought: 'Tôi cần biết họ có nhớ chuyện cũ không.', intention: 'Yêu cầu tìm hồ sơ.', mood: { fear: 34, anger: 51, hope: 40, guilt: 20 }, action: 'Tôi hỏi tên người đã tiếp nhận phản ánh về Tiểu Thu.', belief_updates: [] };
}
export function resolution(project, job, ended = true) {
  return { exchange_id: job.id, revision: job.revision, scene_number: job.scene_number, kind: 'resolution',
    scene: { title: 'Hồ sơ cũ', location: project.world.location, time: '20:13', atmosphere: 'Cuộc trò chuyện ngừng lại khi tên Tiểu Thu được nhắc đến.', pressure: 60, ended, end_reason: ended ? 'Người ghi lời khai cần quyết định có tìm hồ sơ không.' : '', pov_id: project.pending_action.character_id }, outcome: 'Tề Quân dừng bút, nhưng chưa trả lời câu hỏi.', witnesses: [project.pending_action.character_id, 'quan'], new_facts: [], reveals: [], trust_updates: [], world_event: null };
}
