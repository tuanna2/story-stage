import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildApp } from '../src/server.js';
import { FileStore, MySQLStore } from '../src/store.js';
import { batch, narration } from './fixtures.js';

test('Phase 3 HTTP: rewrite và mô phỏng xen kẽ, lưu đồng thời, audit, chương, nhánh và restart', async t => {
  const dir = await mkdtemp(resolve(tmpdir(), 'story-phase3-')), file = resolve(dir, 'projects.json');
  const factory = () => process.env.TEST_MYSQL === '1' ? new MySQLStore() : new FileStore(file);
  const store = factory(); await store.init(); const app = await buildApp({ store }); const ids = [];
  t.after(async () => {
    if (store.mode === 'mysql') for (const id of ids) {
      await store.pool.execute('DELETE FROM simulation_events WHERE project_id = ?', [id]);
      await store.pool.execute('DELETE FROM prompt_jobs WHERE project_id = ?', [id]);
      await store.pool.execute('DELETE FROM projects WHERE id = ?', [id]);
    }
    await app.close(); await rm(dir, { recursive: true, force: true });
  });
  const request = (method, url, payload) => app.inject({ method, url, payload });
  const created = await request('POST', '/api/projects', { name: 'Phase 3 integration', config: { max_turns: 1, batch_size: 1, max_scenes: 4 } });
  assert.equal(created.statusCode, 201); let p = created.json(); ids.push(p.id);
  const url = `/api/projects/${p.id}`;
  const job1 = (await request('POST', `${url}/jobs`, {})).json();
  p = (await request('POST', `${url}/jobs/${job1.id}/commit`, { raw: JSON.stringify(batch(p, job1)) })).json();
  const n = (await request('POST', `${url}/jobs`, {})).json();
  p = (await request('POST', `${url}/jobs/${n.id}/commit`, { raw: JSON.stringify(narration(p, n)) })).json();
  assert.equal(p.scenes[0].versions.length, 1); const original = structuredClone(p.scenes[0].versions[0]);
  const pending = (await request('POST', `${url}/jobs`, {})).json();
  const rewrite = await request('POST', `${url}/scenes/1/rewrite`, { base_version_id: p.scenes[0].current_version_id, guidance: 'Giọng văn trầm tĩnh.' });
  assert.equal(rewrite.statusCode, 200); const j = rewrite.json();
  p = (await request('POST', `${url}/jobs/${pending.id}/commit`, { raw: JSON.stringify(batch(p, pending)) })).json();
  assert.equal(p.revision, 3); assert.equal(p.pending_rewrite_job_id, j.id);
  const raw = 'Tôi lắng nghe câu hỏi về hồ sơ cũ. Ngoài cửa, tiếng mưa vẫn rơi. Chưa ai đưa ra câu trả lời.';
  const preview = await request('POST', `${url}/jobs/${j.id}/preview`, { raw });
  assert.equal(preview.statusCode, 200); assert.equal((await store.get(p.id)).scenes[0].versions.length, 1);
  const commits = await Promise.all([request('POST', `${url}/jobs/${j.id}/commit`, { raw }), request('POST', `${url}/jobs/${j.id}/commit`, { raw })]);
  assert.deepEqual(commits.map(r => r.statusCode).sort(), [200, 409]);
  p = await store.get(p.id); assert.equal(p.revision, 3); assert.equal(p.manuscript_revision, 2);
  const beforeSimulation = JSON.stringify({ world: p.world, characters: p.characters, turns: p.scenes.map(s => s.turns) });
  const body = { base_version_id: p.scenes[0].current_version_id, prose: 'Tôi nghe mưa gõ bên cửa. Câu hỏi về hồ sơ vẫn chưa có lời đáp.', summary: 'Một câu hỏi chờ lời đáp.', confirmed: true };
  const edits = await Promise.all([request('POST', `${url}/scenes/1/versions`, body), request('POST', `${url}/scenes/1/versions`, body)]);
  assert.deepEqual(edits.map(r => r.statusCode).sort(), [200, 409]); p = await store.get(p.id);
  assert.equal(p.scenes[0].versions.length, 3);
  const restored = await request('POST', `${url}/scenes/1/restore`, { base_version_id: p.scenes[0].current_version_id, version_id: original.id });
  assert.equal(restored.statusCode, 200); p = restored.json(); assert.equal(p.scenes[0].prose, original.prose);
  assert.equal(JSON.stringify({ world: p.world, characters: p.characters, turns: p.scenes.map(s => s.turns) }), beforeSimulation);
  const chapters = await request('PUT', `${url}/chapters`, { manuscript_revision: p.manuscript_revision, chapters: [{ id: 'ch_edited', title: 'Những câu hỏi chưa đáp', scene_numbers: [1] }] });
  assert.equal(chapters.statusCode, 200); p = chapters.json();
  const writing = await request('PATCH', `${url}/writing`, { manuscript_revision: p.manuscript_revision, words: 1800, batch_size: 6, voice: p.style.voice, guidance: p.style.guidance });
  assert.equal(writing.statusCode, 200); p = writing.json(); assert.equal(p.manuscript_revision, 6);
  const exported = await request('GET', `${url}/export?format=markdown`); assert.match(exported.body, /Những câu hỏi chưa đáp/);
  assert.equal((await request('POST', `${url}/scenes/1/versions`, { ...body, new_facts: [] })).statusCode, 400);
  const branch = await request('POST', `${url}/scenes/2/fork`, { name: 'Nhánh kiểm thử' });
  assert.equal(branch.statusCode, 201); ids.push(branch.json().id);
  assert.equal(branch.json().scenes[1].turns.length, 0); assert.equal(branch.json().revision, 0);
  assert.equal((await request('POST', `${url}/scenes/0/fork`, {})).statusCode, 400);
  const pendingNarration = (await request('POST', `${url}/jobs`, {})).json(); assert.equal(pendingNarration.kind, 'narration');
  const reopened = factory(); await reopened.init();
  try {
    const saved = await reopened.get(p.id);
    assert.equal(saved.scenes[0].versions.length, 4); assert.equal(saved.pending_job_id, pendingNarration.id);
    assert.equal(saved.manuscript_revision, 6); assert.equal(saved.style.words, 1800);
  } finally { await reopened.close(); }
  if (store.mode === 'mysql') {
    const [jobs] = await store.pool.execute('SELECT id, status FROM prompt_jobs WHERE project_id = ?', [p.id]);
    assert.equal(jobs.find(job => job.id === pending.id).status, 'consumed');
    assert.equal(jobs.find(job => job.id === j.id).status, 'consumed');
    const [[events]] = await store.pool.execute('SELECT COUNT(*) AS count FROM simulation_events WHERE project_id = ?', [p.id]); assert.equal(events.count, 3);
    const [[manuscripts]] = await store.pool.execute('SELECT COUNT(*) AS count FROM manuscript_events WHERE project_id = ?', [p.id]); assert.equal(manuscripts.count, 6);
  }
});
