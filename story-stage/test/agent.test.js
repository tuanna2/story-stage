import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildApp } from '../src/server.js';
import { FileStore, MySQLStore } from '../src/store.js';
import { agentNext, agentSubmit } from '../src/agent.js';
import { createProject } from '../src/engine.js';
import { createAgentClient, runCLI } from '../scripts/agent-story.js';
import { batch, narration, actor, resolution } from './fixtures.js';

test('Agent + CLI: tiếp tục job, lỗi rollback, gửi lại an toàn, viết hết, lưu và xuất qua HTTP', async t => {
  const dir = await mkdtemp(resolve(tmpdir(), 'story-agent-'));
  const factory = () => process.env.TEST_MYSQL === '1' ? new MySQLStore() : new FileStore(resolve(dir, 'projects.json'));
  const store = factory(); await store.init(); const app = await buildApp({ store });
  const ids = [];
  t.after(async () => {
    if (store.mode === 'mysql') for (const id of ids) {
      await store.pool.execute('DELETE FROM simulation_events WHERE project_id = ?', [id]);
      await store.pool.execute('DELETE FROM prompt_jobs WHERE project_id = ?', [id]);
      await store.pool.execute('DELETE FROM projects WHERE id = ?', [id]);
    }
    await app.close(); await rm(dir, { recursive: true, force: true });
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const request = createAgentClient(`http://127.0.0.1:${app.server.address().port}`);
  const cli = async args => { let result; await runCLI(args, { request, output: value => { result = value; } }); return result; };
  let p = await request('/projects', { method: 'POST', body: { name: 'Agent integration', config: { max_scenes: 2, max_turns: 1, batch_size: 1 } } }); ids.push(p.id);
  const prefix = `/projects/${p.id}`;
  assert.equal((await cli(['projects'])).find(x => x.id === p.id).name, p.name);
  const before = JSON.stringify(await store.get(p.id));
  assert.equal((await cli(['status', p.id])).next_kind, 'simulation');
  const task = await request(`${prefix}/agent/task`); assert.equal(task.project_id, p.id); assert.match(task.task, /story-stage-writer/);
  assert.equal(JSON.stringify(await store.get(p.id)), before);
  const manual = await request(`${prefix}/jobs`, { method: 'POST', body: {} });
  const jobFile = resolve(dir, 'nested/job.json');
  const first = await cli(['next', p.id, '--out', jobFile]); assert.equal(first.job.id, manual.id); assert.equal(first.job.prompt, undefined);
  assert.equal(JSON.parse(await readFile(jobFile, 'utf8')).job.prompt, manual.prompt);
  p = await store.get(p.id); const invalid = batch(p, manual); invalid.turns[0].actor_id = 'missing_actor';
  const responseFile = resolve(dir, 'response.json'); await writeFile(responseFile, JSON.stringify(invalid));
  const pending = JSON.stringify(await store.get(p.id));
  await assert.rejects(cli(['submit', p.id, manual.id, '--file', responseFile]), error => error.status === 422 && error.message.length > 0);
  assert.equal(JSON.stringify(await store.get(p.id)), pending);
  const raw = JSON.stringify(batch(p, manual)); await writeFile(responseFile, raw);
  const simultaneous = await Promise.all([cli(['submit', p.id, manual.id, '--file', responseFile]), cli(['submit', p.id, manual.id, '--file', responseFile])]);
  assert.deepEqual(simultaneous.map(x => x.reused).sort(), [false, true]);
  assert.equal((await cli(['status', p.id])).revision, 1);
  await writeFile(responseFile, `${raw}\n`);
  await assert.rejects(cli(['submit', p.id, manual.id, '--file', responseFile]), error => error.status === 409);
  const n = await cli(['next', p.id]); assert.equal(n.job.kind, 'narration');
  const reopened = factory(); await reopened.init();
  try { const saved = await reopened.get(p.id); assert.equal(saved.pending_job_id, n.job.id); assert.equal(saved.scenes[0].turns.length, 1); }
  finally { await reopened.close(); }
  p = await store.get(p.id); await writeFile(responseFile, JSON.stringify(narration(p, n.job)));
  assert.equal((await cli(['submit', p.id, n.job.id, '--file', responseFile])).completed_scenes, 1);
  await writeFile(responseFile, raw);
  const oldRetry = await cli(['submit', p.id, manual.id, '--file', responseFile]); assert.equal(oldRetry.revision, 2); assert.equal(oldRetry.reused, true);
  for (let i = 0; i < 2; i++) {
    const next = await cli(['next', p.id]); p = await store.get(p.id);
    const data = next.job.kind === 'simulation' ? batch(p, next.job) : narration(p, next.job);
    await writeFile(responseFile, JSON.stringify(data)); await cli(['submit', p.id, next.job.id, '--file', responseFile]);
  }
  const done = await cli(['next', p.id]); assert.equal(done.complete, true); assert.equal(done.job, null); assert.equal(done.completed_scenes, 2); assert.equal(done.revision, 4);
  const destination = resolve(dir, 'export/story.md'); await cli(['export', p.id, '--out', destination]);
  assert.match(await readFile(destination, 'utf8'), /Tôi nghe mưa/);
  const snapshotFile = resolve(dir, 'export/story.json'); await cli(['export', p.id, '--out', snapshotFile, '--format', 'json']);
  const exported = JSON.parse(await readFile(snapshotFile, 'utf8')); assert.equal(exported.status, 'complete'); assert.equal(exported.scenes.length, 2); assert.equal(exported.exchanges.filter(j => j.status === 'consumed').length, 4);
  assert.equal(exported.scenes.every(s => s.versions.length === 1), true);
  if (store.mode === 'mysql') {
    const [[events]] = await store.pool.execute('SELECT COUNT(*) AS count FROM simulation_events WHERE project_id = ?', [p.id]); assert.equal(events.count, 4);
    const [[versions]] = await store.pool.execute('SELECT COUNT(*) AS count FROM manuscript_events WHERE project_id = ?', [p.id]); assert.equal(versions.count, 2);
  }
});

test('Agent tách vai đi đủ character → resolution → narration, job lỗi không bị bỏ qua', () => {
  const p = createProject({ config: { mode: 'isolated', max_scenes: 1, max_turns: 1 } });
  const first = agentNext(p); assert.equal(first.job.kind, 'character');
  const a = JSON.stringify(actor(p, first.job)); agentSubmit(p, first.job.id, a);
  const second = agentNext(p); assert.equal(second.job.kind, 'resolution');
  const res = resolution(p, second.job); agentSubmit(p, second.job.id, JSON.stringify(res));
  const third = agentNext(p); assert.equal(third.job.kind, 'narration');
  const before = JSON.stringify(p);
  assert.throws(() => agentSubmit(p, third.job.id, JSON.stringify({ ...narration(p, third.job), pov_id: 'unknown' })), /POV/);
  assert.equal(JSON.stringify(p), before);
  agentSubmit(p, third.job.id, JSON.stringify(narration(p, third.job)));
  assert.equal(agentNext(p).complete, true); assert.equal(p.revision, 3);
});

test('Agent tiếp tục case_setup đang chờ và từ chối job viết lại', async () => {
  const { caseSetupJob } = await import('../src/engine.js');
  const { rewriteJob } = await import('../src/manuscript.js');
  const p = createProject({ config: { max_turns: 1 } });
  const caseJob = caseSetupJob(p); assert.equal(agentNext(p).job.id, caseJob.id); assert.equal(agentNext(p).job.kind, 'case_setup');
  assert.throws(() => agentSubmit(p, caseJob.id, '{}'));
  assert.equal(p.pending_job_id, caseJob.id);
  const q = createProject({ config: { max_turns: 1 } });
  let job = agentNext(q).job; agentSubmit(q, job.id, JSON.stringify(batch(q, job)));
  job = agentNext(q).job; agentSubmit(q, job.id, JSON.stringify(narration(q, job)));
  const edit = rewriteJob(q, 1, { base_version_id: q.scenes[0].current_version_id });
  const before = JSON.stringify(q);
  assert.throws(() => agentSubmit(q, edit.id, '{}'), /không thuộc luồng/); assert.equal(JSON.stringify(q), before);
});

test('CLI chỉ gọi web local, từ chối tham số sai trước khi gửi và giữ lỗi chi tiết', async () => {
  for (const url of ['https://example.com', 'http://localhost/path', 'http://user:pass@localhost', 'http://localhost?key=x', 'file:///tmp/story']) assert.throws(() => createAgentClient(url));
  let calls = 0;
  const request = async () => { calls++; };
  for (const args of [['next', 'wrong'], ['status', 'p_ab', '--file', '/tmp/x'], ['submit', 'p_ab', 'x_abc'], ['export', 'p_ab', '--out', '/tmp/x', '--format', 'exe'], ['projects', 'p_ab']]) await assert.rejects(runCLI(args, { request }));
  assert.equal(calls, 0);
  const client = createAgentClient('http://localhost:4317', async (url, options) => {
    assert.equal(options.redirect, 'error'); assert.equal(options.method, 'POST'); assert.ok(options.signal);
    return new Response(JSON.stringify({ error: 'Sai căn cứ', details: [{ path: 'turns.0', message: 'Chưa biết' }] }), { status: 422 });
  });
  await assert.rejects(client('/projects/p_ab/agent/next', { method: 'POST', body: {} }), error => error.status === 422 && error.details[0].path === 'turns.0');
});
