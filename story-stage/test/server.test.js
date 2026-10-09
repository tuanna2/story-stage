import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { FileStore, MySQLStore } from '../src/store.js';
import { buildApp } from '../src/server.js';
import { batch } from './fixtures.js';

test('HTTP + lưu trữ: preview, commit đồng thời, restart, export và lỗi', async t => {
  const dir = await mkdtemp(resolve(tmpdir(), 'story-stage-'));
  const file = resolve(dir, 'projects.json');
  const factory = () => process.env.TEST_MYSQL === '1' ? new MySQLStore() : new FileStore(file);
  const store = factory(); await store.init(); const app = await buildApp({ store });
  const createdIds = [];
  t.after(async () => {
    if (store.mode === 'mysql' && createdIds.length) {
      const marks = createdIds.map(() => '?').join(',');
      await store.pool.execute(`DELETE FROM simulation_events WHERE project_id IN (${marks})`, createdIds);
      await store.pool.execute(`DELETE FROM prompt_jobs WHERE project_id IN (${marks})`, createdIds);
      await store.pool.execute(`DELETE FROM projects WHERE id IN (${marks})`, createdIds);
    }
    await app.close(); await rm(dir, { recursive: true, force: true });
  });
  const request = (method, url, payload, headers) => app.inject({ method, url, payload, headers });
  let project;
  await t.test('Tạo truyện qua API và phục vụ UI', async () => {
    const response = await request('POST', '/api/projects', { name: 'Test transaction', config: { max_turns: 3 } });
    assert.equal(response.statusCode, 201); project = response.json(); createdIds.push(project.id);
    const html = await request('GET', '/'); assert.equal(html.statusCode, 200); assert.ok(html.body.includes('Story Stage'));
    assert.ok((await request('GET', '/app.js')).headers['content-security-policy']);
  });
  await t.test('Rejection không tạo project, bảo vệ request ngoài origin', async () => {
    assert.equal((await request('POST', '/api/projects', { name: 'Bad', unknown: true })).statusCode, 400);
    assert.equal((await request('POST', '/api/projects', {}, { origin: 'https://unrelated.example' })).statusCode, 403);
    assert.equal((await request('POST', '/api/projects', {}, { origin: 'not-a-url' })).statusCode, 403);
  });
  let job, raw;
  await t.test('Prompt pending và preview không ghi state', async () => {
    job = (await request('POST', `/api/projects/${project.id}/jobs`, {})).json();
    raw = JSON.stringify(batch(project, job));
    const preview = await request('POST', `/api/projects/${project.id}/jobs/${job.id}/preview`, { raw });
    assert.equal(preview.statusCode, 200); assert.equal(preview.json().new_turns.length, 3);
    assert.equal((await store.get(project.id)).revision, 0);
  });
  await t.test('Hai request commit đồng thời: chỉ một request được ghi', async () => {
    const results = await Promise.all([request('POST', `/api/projects/${project.id}/jobs/${job.id}/commit`, { raw }), request('POST', `/api/projects/${project.id}/jobs/${job.id}/commit`, { raw })]);
    assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
    assert.equal((await store.get(project.id)).scenes[0].turns.length, 3);
    assert.equal((await store.get(project.id)).revision, 1);
  });
  await t.test('Câu trả lời lỗi không làm thay đổi state và export chứa hồ sơ', async () => {
    const nj = (await request('POST', `/api/projects/${project.id}/jobs`, {})).json();
    const before = JSON.stringify(await store.get(project.id));
    assert.equal((await request('POST', `/api/projects/${project.id}/jobs/${nj.id}/commit`, { raw: '{broken' })).statusCode, 422);
    assert.equal(JSON.stringify(await store.get(project.id)), before);
    const exported = await request('GET', `/api/projects/${project.id}/export?format=json`);
    assert.equal(exported.statusCode, 200); assert.equal(exported.json().characters.length, 4);
    assert.ok(exported.headers['content-disposition'].startsWith('attachment'));
  });
  await t.test('Mở store mới vẫn còn prompt đang chờ và revision', async () => {
    const reopened = factory(); await reopened.init();
    const saved = await reopened.get(project.id);
    assert.equal(saved.revision, 1); assert.ok(saved.pending_job_id); await reopened.close();
  });
  if (store.mode === 'mysql') await t.test('Audit MySQL lưu job và sự kiện đúng một lần', async () => {
    const [[row]] = await store.pool.execute('SELECT COUNT(*) AS count FROM simulation_events WHERE project_id = ?', [project.id]);
    assert.equal(row.count, 1);
    const [jobs] = await store.pool.execute('SELECT status FROM prompt_jobs WHERE project_id = ?', [project.id]);
    assert.deepEqual(jobs.map(x => x.status).sort(), ['consumed', 'pending']);
  });
});
