import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { FileStore, MySQLStore } from '../src/store.js';
import { buildApp } from '../src/server.js';
import { caseScenes, simulation, proseResponse } from '../examples/case-fixture.js';

test('Phase 2 HTTP: sáu cảnh, reader không lộ hồ sơ, audit một lần, mở lại store', async t => {
  const dir = await mkdtemp(resolve(tmpdir(), 'story-case-'));
  const factory = () => process.env.TEST_MYSQL === '1' ? new MySQLStore() : new FileStore(resolve(dir, 'projects.json'));
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
  const created = await request('POST', '/api/projects', { preset_id: 'rain-case', config: { max_scenes: 6, batch_size: 1 } });
  assert.equal(created.statusCode, 201); let project = created.json(); ids.push(project.id);
  const path = `/api/projects/${project.id}`;
  const reader = await request('GET', `${path}/reader`); assert.equal(reader.json().facts.length, 0);
  assert.ok(!reader.body.includes('f-report')); assert.ok(!reader.body.includes('deeper_reading'));
  for (const data of caseScenes) {
    let job = (await request('POST', `${path}/jobs`, {})).json();
    const raw = JSON.stringify(simulation(project, job, data.sim));
    const beforeReader = (await request('GET', `${path}/reader`)).body;
    const preview = await request('POST', `${path}/jobs/${job.id}/preview`, { raw }); assert.equal(preview.statusCode, 200);
    const commits = await Promise.all([request('POST', `${path}/jobs/${job.id}/commit`, { raw }), request('POST', `${path}/jobs/${job.id}/commit`, { raw })]);
    assert.deepEqual(commits.map(c => c.statusCode).sort(), [200, 409]);
    project = commits.find(c => c.statusCode === 200).json();
    assert.equal((await request('GET', `${path}/reader`)).body, beforeReader);
    job = (await request('POST', `${path}/jobs`, {})).json();
    const narrated = await request('POST', `${path}/jobs/${job.id}/commit`, { raw: JSON.stringify(proseResponse(project, job, data.prose, data.updates)) });
    assert.equal(narrated.statusCode, 200, narrated.body); project = narrated.json();
  }
  const reopened = factory(); await reopened.init();
  const saved = await reopened.get(project.id); await reopened.close();
  assert.equal(saved.status, 'complete'); assert.equal(saved.revision, 12); assert.equal(saved.reader.answers.length, 4);
  const exported = await request('GET', `${path}/export?format=json`); assert.equal(exported.json().case_ledger.discoveries.length, 6);
  if (store.mode === 'mysql') {
    const [[row]] = await store.pool.execute('SELECT COUNT(*) AS count FROM simulation_events WHERE project_id = ?', [project.id]); assert.equal(row.count, 12);
    const [migrations] = await store.pool.query('SELECT version FROM schema_migrations'); assert.ok(migrations.some(m => m.version === '002_case_setup.sql'));
  }
  // The new enum is exercised through HTTP and persisted as a pending job.
  const custom = (await request('POST', '/api/projects', { preset_id: 'interrogation' })).json(); ids.push(custom.id);
  const setup = await request('POST', `/api/projects/${custom.id}/case/jobs`, { guidance: 'Tạo manh mối từ biên bản cũ.' }); assert.equal(setup.statusCode, 200); assert.equal(setup.json().kind, 'case_setup');
  const library = await request('GET', '/api/projects');
  assert.equal(library.statusCode, 200, library.body);
  assert.equal(library.json().find(p => p.id === project.id).scene_count, 6);
  assert.equal(library.json().find(p => p.id === custom.id).scene_count, 0);
  assert.ok(library.json().findIndex(p => p.id === custom.id) < library.json().findIndex(p => p.id === project.id));
  const second = await request('POST', `/api/projects/${custom.id}/case/jobs`, {}); assert.equal(second.statusCode, 422);
  assert.equal((await store.get(custom.id)).pending_job_id, setup.json().id);
  if (store.mode === 'mysql') {
    const [[row]] = await store.pool.execute('SELECT kind FROM prompt_jobs WHERE id = ?', [setup.json().id]); assert.equal(row.kind, 'case_setup');
  }
});
