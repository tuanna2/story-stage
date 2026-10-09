import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createProject, exportPreset } from '../src/engine.js';
import { buildCustomPreset, buildSetupPrompt, importSetup } from '../src/creator.js';
import { buildApp } from '../src/server.js';
import { FileStore, MySQLStore } from '../src/store.js';
import { batch } from './fixtures.js';

export const customFixture = (genre = 'Kỳ ảo', count = 2) => ({ name: 'Bến cảng trên mây', genre,
  premise: 'Một chuyến tàu mắc kẹt; mỗi người có một lý do khác nhau để rời bến.', setting: 'Thành phố nổi trên tầng mây, tàu bay bằng tinh thể.',
  location: 'Bến cảng phía đông', time: 'Sáng sớm', rules: ['Tinh thể cạn năng lượng sẽ khiến tàu không thể bay.'],
  voice: 'Tiếng Việt, POV giới hạn, nhẹ nhàng.', guidance: 'Để lựa chọn của nhân vật dẫn dắt câu chuyện.', words: 700,
  characters: Array.from({ length: count }, (_, i) => ({ name: `Hành khách ${i + 1}`, role: 'Người đi tàu',
    personality: 'Tò mò nhưng thận trọng.', background: 'Lần đầu đến thành phố nổi.', goals: ['Tìm một chuyến đi phù hợp.'],
    secret: `Một lá thư riêng của người ${i + 1}.`, limitations: ['Chưa biết lái tàu.'] })),
});

test('Tạo 2–8 nhân vật với thể loại bất kỳ, bí mật và ký ức riêng, xuất lại dàn dựng', () => {
  for (const [genre, count] of [['Kỳ ảo', 2], ['Tình cảm', 3], ['Khoa học viễn tưởng', 8]]) {
    const p = createProject({ custom: customFixture(genre, count) });
    assert.equal(p.genre, genre); assert.equal(p.characters.length, count); assert.equal(p.casefile, null);
    for (const c of p.characters) {
      assert.ok(c.memories.length); assert.deepEqual(p.world.facts.find(f => f.id === `secret_${c.id}`).known_by, [c.id]);
      assert.equal(c.trust && Object.keys(c.trust).length, 0);
    }
    const reloaded = createProject({ preset: exportPreset(p) }); assert.equal(reloaded.genre, genre);
  }
});

test('Dàn dựng riêng vẫn kiểm tra trường bắt buộc, giới hạn và xung đột nguồn', () => {
  assert.throws(() => createProject({ custom: { ...customFixture(), characters: [] } }), /cấu trúc/);
  assert.throws(() => createProject({ custom: { ...customFixture(), genre: '' } }), /cấu trúc/);
  assert.throws(() => createProject({ custom: customFixture(), preset: buildCustomPreset(customFixture()) }), /Chọn một/);
});

test('Prompt dàn dựng đầy đủ, output dán có Markdown và lớp preset đọc lại được', () => {
  const result = buildSetupPrompt({ name: 'Thành phố nổi', genre: 'Kỳ ảo', idea: 'Một con tàu chưa thể rời bến.', character_count: 5 });
  assert.equal(result.example.characters.length, 5); assert.match(result.prompt, /casefile để null/);
  const imported = importSetup(`Kết quả:\n\`\`\`json\n${JSON.stringify({ preset: result.example })}\n\`\`\``);
  assert.equal(imported.preset.name, 'Thành phố nổi'); assert.equal(imported.preset.characters.length, 5);
  assert.ok(imported.import_notes.length); createProject({ preset: imported.preset });
});

test('HTTP: dàn dựng ChatGPT chưa tạo truyện; tạo từ ý tưởng, nhập bản chuẩn hóa và mở lại store', async t => {
  const dir = await mkdtemp(resolve(tmpdir(), 'story-creator-')), file = resolve(dir, 'projects.json');
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
  const post = (url, payload) => app.inject({ method: 'POST', url, payload });
  const prior = (await store.list()).map(p => p.id);
  const prompt = await post('/api/setup/prompt', { name: 'Riêng', genre: 'Đời thường', idea: 'Quán cà phê đóng cửa bất ngờ.' });
  assert.equal(prompt.statusCode, 200);
  const setup = await post('/api/setup/preview', { raw: `\`\`\`json\n${JSON.stringify(prompt.json().example)}\n\`\`\`` });
  assert.equal(setup.statusCode, 200); assert.equal(setup.json().valid, true);
  assert.ok(!(await store.list()).some(p => p.name === 'Riêng' && !prior.includes(p.id)));
  const bad = structuredClone(prompt.json().example); bad.world.facts = [{ id: 'f_bad', text: 'Sai người biết.', known_by: ['missing'] }];
  assert.equal((await post('/api/setup/preview', { raw: JSON.stringify(bad) })).statusCode, 422);
  for (const body of [{ custom: customFixture() }, { preset: setup.json().preset }]) {
    const created = await post('/api/projects', { ...body, config: { batch_size: 1 } }); assert.equal(created.statusCode, 201);
    const p = created.json(); ids.push(p.id);
    const job = (await post(`/api/projects/${p.id}/jobs`, {})).json(), r = batch(p, job); delete r.exchange_id;
    const raw = `Câu trả lời:\n\`\`\`json\n${JSON.stringify(r).replace(/}$/, ',}')}\n\`\`\``;
    const preview = await post(`/api/projects/${p.id}/jobs/${job.id}/preview`, { raw });
    assert.equal(preview.statusCode, 200); assert.ok(preview.json().import_notes.length);
    assert.equal((await store.get(p.id)).revision, 0);
    assert.equal((await post(`/api/projects/${p.id}/jobs/${job.id}/commit`, { raw })).statusCode, 200);
    const reopened = factory(); await reopened.init();
    try {
      const saved = await reopened.get(p.id); assert.equal(saved.genre, p.genre); assert.equal(saved.revision, 1);
      assert.deepEqual(saved.exchanges[0].response, preview.json().normalized_response); assert.equal(saved.exchanges[0].raw_response, raw);
      assert.deepEqual(saved.exchanges[0].import_notes, preview.json().import_notes);
    } finally { await reopened.close(); }
  }
});
