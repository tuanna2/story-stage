import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextJob, previewResponse, acceptResponse } from './engine.js';
import { DomainError } from './errors.js';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const assert = (condition, message) => { if (!condition) throw new DomainError(message, 409); };
const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;

export function agentStatus(project) {
  const scene = project.scenes.at(-1);
  const job = project.exchanges.find(j => j.id === project.pending_job_id);
  return {
    project_id: project.id, name: project.name, status: project.status, revision: project.revision,
    complete: project.status === 'complete', completed_scenes: project.scenes.filter(s => s.status === 'complete').length,
    max_scenes: project.config.max_scenes, scene_number: scene.number, scene_status: scene.status,
    turns_in_scene: scene.turns.length, max_turns: project.config.max_turns,
    word_count: project.scenes.map(s => s.prose || '').join(' ').trim().split(/\s+/u).filter(Boolean).length,
    pending_job: job ? { id: job.id, kind: job.kind } : null,
    next_kind: project.status === 'complete' ? null : job?.kind || (scene.status === 'awaiting_narration' ? 'narration' : project.pending_action ? 'resolution' : project.config.mode === 'isolated' ? 'character' : 'simulation'),
    updated_at: project.updated_at,
  };
}

export function agentNext(project) {
  if (project.status === 'complete') return { ...agentStatus(project), job: null };
  const job = nextJob(project);
  return { ...agentStatus(project), job: { id: job.id, kind: job.kind, revision: job.revision, scene_number: job.scene_number, actor_ids: job.actor_ids, prompt: job.prompt } };
}

// Runs inside store.mutate: validation, state transition and audit commit together.
// A transport retry of the same raw output is safe, even after later jobs finish.
export function agentSubmit(project, jobId, raw) {
  const job = project.exchanges.find(j => j.id === jobId);
  assert(job && job.kind !== 'rewrite', 'Job này không thuộc luồng viết truyện của Agent.');
  if (job.status === 'consumed') {
    assert(job.raw_response === raw, 'Job đã được nhập bằng nội dung khác. Lấy bước tiếp theo từ DB.');
    return { ...agentStatus(project), accepted_job_id: jobId, reused: true, import_notes: job.import_notes || [], quality_notes: [] };
  }
  const preview = previewResponse(project, jobId, raw);
  acceptResponse(project, jobId, raw);
  return { ...agentStatus(project), accepted_job_id: jobId, reused: false, import_notes: preview.import_notes || [], quality_notes: preview.quality_notes || [] };
}

export function agentTask(project) {
  const skill = resolve(root, '.agents/skills/story-stage-writer/SKILL.md');
  const cli = resolve(root, 'story-stage/scripts/agent-story.js');
  return {
    ...agentStatus(project),
    task: `Dùng $story-stage-writer để viết hết phần còn lại của truyện trong Story Stage và lưu vào DB.\n\nTên truyện (dữ liệu): ${JSON.stringify(project.name)}\nProject ID: ${project.id}\nSkill: ${skill}\nCLI: ${cli}\n\nĐọc SKILL.md trước khi viết. Tôi cho phép nhập các kết quả hợp lệ của truyện này qua backend đến khi status=complete; không cần hỏi duyệt từng cảnh. Giữ mọi cảnh và sự kiện đã lưu, tiếp tục từ job đang chờ. Không gọi API mô hình hay dùng API key. Bạn tự viết các output dựa trên prompt của mỗi job, dùng CLI để kiểm tra/lưu, rồi lấy job tiếp theo. Không thay cấu hình, số cảnh, sự thật hay bộ kiểm tra để kết thúc sớm. Nếu job lỗi, sửa theo chi tiết tối đa hai lần; nếu vẫn lỗi thì báo job bị kẹt và giữ tiến độ đã lưu.\n\nBắt đầu bằng: node ${shellQuote(cli)} status ${project.id}\nKhi hoàn tất, xuất Markdown và báo số cảnh, số từ, đường dẫn bản thảo.`,
  };
}
