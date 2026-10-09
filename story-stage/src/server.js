import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { presets } from './presets.js';
import { createStore } from './store.js';
import { createProject, cleanPreset, nextJob, caseSetupJob, cancelJob, acceptResponse, previewResponse, patchSetup, exportPreset, exportStory } from './engine.js';
import { readerView } from './mystery.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const objectBody = properties => ({ type: 'object', properties, additionalProperties: false });
const rawBody = { ...objectBody({ raw: { type: 'string', minLength: 2, maxLength: 1000000 } }), required: ['raw'] };
const params = { type: 'object', properties: { id: { type: 'string', pattern: '^p_[a-f0-9-]+$' }, job: { type: 'string', pattern: '^x_[a-f0-9-]+$' } }, required: ['id'] };

export async function buildApp({ store, logger = false } = {}) {
  store ||= await createStore();
  const app = Fastify({ logger, bodyLimit: 1200000, ajv: { customOptions: { removeAdditional: false, coerceTypes: false } } });
  app.decorate('store', store);
  app.addHook('onClose', async () => store.close());
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/api/') && !['GET', 'HEAD'].includes(req.method)) {
      const site = req.headers['sec-fetch-site'];
      const origin = req.headers.origin;
      let originHost;
      try { originHost = origin ? new URL(origin).host : null; } catch { originHost = 'invalid'; }
      if (site === 'cross-site' || (originHost && originHost !== req.headers.host)) return reply.code(403).send({ error: 'Yêu cầu cần xuất phát từ chính trang ứng dụng.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return reply.code(415).send({ error: 'Cần gửi dữ liệu application/json.' });
    }
  });
  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
  });
  app.setErrorHandler((error, req, reply) => {
    const status = error.statusCode || 500;
    if (status >= 500) req.log.error(error);
    reply.code(status).send({ error: status >= 500 ? 'Không lưu được dữ liệu. Kiểm tra kết nối cơ sở dữ liệu và thử lại.' : error.validation ? 'Yêu cầu không đúng cấu trúc.' : error.message, details: error.details || error.validation?.map(x => ({ path: x.instancePath, message: x.message })) || [] });
  });
  app.get('/api/health', async () => ({ ok: true, storage: store.mode }));
  app.get('/api/presets', async () => presets.map(p => ({ id: p.id, ...cleanPreset(p) })));
  app.get('/api/projects', async () => store.list());
  app.post('/api/projects', { schema: { body: objectBody({ name: { type: 'string', maxLength: 120 }, preset_id: { type: 'string' }, preset: { type: 'object' }, config: { type: 'object' } }) } }, async (req, reply) => reply.code(201).send(await store.create(createProject(req.body))));
  app.get('/api/projects/:id', { schema: { params } }, req => store.get(req.params.id));
  app.get('/api/projects/:id/reader', { schema: { params } }, async req => readerView(await store.get(req.params.id)));
  app.patch('/api/projects/:id/setup', { schema: { params, body: objectBody({ name: { type: 'string', maxLength: 120 }, preset: { type: 'object' }, config: { type: 'object' } }) } }, async req => store.mutate(req.params.id, p => { patchSetup(p, req.body); return p; }));
  app.post('/api/projects/:id/jobs', { schema: { params, body: objectBody({ guidance: { type: 'string', maxLength: 4000 } }) } }, req => store.mutate(req.params.id, p => nextJob(p, req.body.guidance || '')));
  app.post('/api/projects/:id/case/jobs', { schema: { params, body: objectBody({ guidance: { type: 'string', maxLength: 4000 } }) } }, req => store.mutate(req.params.id, p => caseSetupJob(p, req.body.guidance || '')));
  app.post('/api/projects/:id/jobs/:job/preview', { schema: { params, body: rawBody } }, async req => previewResponse(await store.get(req.params.id), req.params.job, req.body.raw));
  app.post('/api/projects/:id/jobs/:job/commit', { schema: { params, body: rawBody } }, req => store.mutate(req.params.id, p => { acceptResponse(p, req.params.job, req.body.raw); return p; }));
  app.post('/api/projects/:id/jobs/:job/cancel', { schema: { params, body: objectBody({}) } }, req => store.mutate(req.params.id, p => { cancelJob(p, req.params.job); return p; }));
  app.get('/api/projects/:id/export', { schema: { params, querystring: { type: 'object', properties: { format: { type: 'string', enum: ['markdown', 'json', 'preset'] } }, additionalProperties: false } } }, async (req, reply) => {
    const p = await store.get(req.params.id), format = req.query.format || 'markdown';
    reply.header('Content-Disposition', `attachment; filename="story-${p.id}.${format === 'markdown' ? 'md' : 'json'}"`);
    if (format === 'markdown') return reply.type('text/markdown; charset=utf-8').send(exportStory(p));
    return reply.type('application/json; charset=utf-8').send(JSON.stringify(format === 'preset' ? exportPreset(p) : p, null, 2));
  });
  app.get('/api/research', async () => ({ sources: [
    { name: 'Generative Agents: Interactive Simulacra of Human Behavior', url: 'https://arxiv.org/abs/2304.03442', note: 'Tham khảo cơ chế memory stream, reflection và planning; bản này dùng truy xuất ký ức bằng từ khóa để không gọi thêm API.' },
    { name: 'Fastify — Validation and Serialization', url: 'https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/', note: 'Schema cho đầu vào HTTP.' },
    { name: 'mysql2 — Promise Wrappers', url: 'https://sidorares.github.io/node-mysql2/docs/documentation/promise-wrapper', note: 'Kết nối MySQL và transaction trên cùng một connection.' },
  ], observations: [
    { title: '“Tần Phong – Vụ án người mù giết người”', finding: 'Thông tin đổi nghĩa theo góc nhìn: Tiểu Thu, lời tự thú, hồ sơ và động cơ riêng. Truyện chuyển từ Tần Phong sang Lâm Tước sau một biến cố. Lời kể của một nhân vật có thể thiếu hoặc sai; engine cần tách niềm tin khỏi sự thật.', application: 'Ledger sự thật có known_by; giới hạn cảm giác của POV; người kể chỉ nhận log được chứng kiến. Bí mật có thể được phát hiện qua hành động và không bị ghi đè để tạo twist.' },
    { title: '“Việc trốn thoát khó đến mức nào”', finding: 'Tiểu Hoa thay đổi từ tin tưởng sang hoài nghi; Lý Tử có đặc quyền nên động cơ thay đổi; Thiếu Hoàn tạo liên minh nhưng kế hoạch phải phản ứng với sự việc ngoài ý muốn. Văn bản dừng ở câu hỏi nhận ra người trong phòng bệnh, chưa cung cấp câu trả lời cuối.', application: 'Mỗi nhân vật giữ cảm xúc và trust riêng; WorldAgent phân xử kết quả không theo ý định. Preset để mở kết cục, không ép thoát hoặc thất bại, tiết chế chi tiết bạo lực.' },
  ] }));
  await app.register(fastifyStatic, { root: resolve(root, 'public') });
  app.setNotFoundHandler((req, reply) => req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Không tìm thấy endpoint.' }) : reply.code(404).send('Không tìm thấy trang.'));
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const app = await buildApp({ logger: true });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
    await app.listen({ port: Number(process.env.PORT || 4317), host: process.env.HOST || '127.0.0.1' });
  } catch (e) { console.error('Không khởi động được Story Stage:', e.message); console.error('Dùng MySQL theo README, hoặc npm run demo để thử bằng dữ liệu file.'); process.exitCode = 1; }
}
