import mysql from 'mysql2/promise';
import { readFile, writeFile, rename, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError } from './schema.js';
import { hydrateMystery } from './mystery.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const projectSummary = p => ({ id: p.id, name: p.name, genre: p.genre, status: p.status, revision: p.revision, scene_count: p.scenes.filter(s => s.status === 'complete').length, max_scenes: p.config.max_scenes, updated_at: p.updated_at, cast_count: p.characters.length });
export class FileStore {
  constructor(path = resolve(root, '.data/projects.json')) { this.path = path; this.queue = Promise.resolve(); this.mode = 'file'; }
  async init() { await mkdir(dirname(this.path), { recursive: true }); try { await readFile(this.path, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; await writeFile(this.path, '{}', { flag: 'wx' }); } }
  async read() { const data = JSON.parse(await readFile(this.path, 'utf8')); Object.values(data).forEach(hydrateMystery); return data; }
  async locked(fn) {
    const previous = this.queue;
    let release;
    this.queue = new Promise(resolve => { release = resolve; });
    await previous;
    try { const data = await this.read(); const result = await fn(data); const temp = `${this.path}.${process.pid}.tmp`; await writeFile(temp, JSON.stringify(data)); await rename(temp, this.path); return structuredClone(result); } finally { release(); }
  }
  async list() { return Object.values(await this.read()).map(projectSummary).sort((a, b) => b.updated_at.localeCompare(a.updated_at)); }
  async get(id) { const p = (await this.read())[id]; if (!p) throw new DomainError('Không tìm thấy truyện.', 404); return p; }
  async create(p) { return this.locked(data => { if (data[p.id]) throw new DomainError('Truyện đã tồn tại.', 409); data[p.id] = p; return p; }); }
  async mutate(id, fn) { return this.locked(async data => { if (!data[id]) throw new DomainError('Không tìm thấy truyện.', 404); return fn(data[id]); }); }
  async close() {}
}

export class MySQLStore {
  constructor(options = {}) {
    this.mode = 'mysql';
    this.database = options.database || process.env.MYSQL_DATABASE || 'story_stage';
    this.pool = mysql.createPool({ host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER || 'story', password: process.env.MYSQL_PASSWORD || 'local_story_password', database: process.env.MYSQL_DATABASE || 'story_stage', connectionLimit: 8, charset: 'utf8mb4', ...options });
  }
  async init() {
    await this.pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(120) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    const conn = await this.pool.getConnection();
    let locked = false;
    try {
      const lockName = `story_stage_migrate_${this.database}`.slice(0, 64);
      const [[lock]] = await conn.query('SELECT GET_LOCK(?, 20) AS acquired', [lockName]);
      if (Number(lock.acquired) !== 1) throw new Error('Không lấy được khóa migration.');
      locked = lockName;
      for (const version of (await readdir(resolve(root, 'db'))).filter(x => /^\d+.*\.sql$/.test(x)).sort()) {
        const [rows] = await conn.execute('SELECT version FROM schema_migrations WHERE version = ?', [version]);
        if (rows.length) continue;
        const sql = await readFile(resolve(root, 'db', version), 'utf8');
        for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await conn.query(statement);
        await conn.execute('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
      }
    } finally { if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [locked]); conn.release(); }
  }
  parse(payload) { return hydrateMystery(typeof payload === 'string' ? JSON.parse(payload) : payload); }
  async list() { const [rows] = await this.pool.query('SELECT payload FROM projects ORDER BY updated_at DESC'); return rows.map(r => projectSummary(this.parse(r.payload))); }
  async get(id) { const [rows] = await this.pool.execute('SELECT payload FROM projects WHERE id = ?', [id]); if (!rows[0]) throw new DomainError('Không tìm thấy truyện.', 404); return this.parse(rows[0].payload); }
  async create(p) { await this.pool.execute('INSERT INTO projects (id, name, revision, payload) VALUES (?, ?, ?, ?)', [p.id, p.name, p.revision, JSON.stringify(p)]); return p; }
  async mutate(id, fn) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute('SELECT payload FROM projects WHERE id = ? FOR UPDATE', [id]);
      if (!rows[0]) throw new DomainError('Không tìm thấy truyện.', 404);
      const project = this.parse(rows[0].payload), oldRevision = project.revision;
      const result = await fn(project);
      await conn.execute('UPDATE projects SET name = ?, revision = ?, payload = ? WHERE id = ?', [project.name, project.revision, JSON.stringify(project), id]);
      const job = project.exchanges.at(-1);
      if (job) await conn.execute('INSERT INTO prompt_jobs (id, project_id, base_revision, kind, status, prompt, raw_response, parsed_response) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), raw_response = VALUES(raw_response), parsed_response = VALUES(parsed_response)', [job.id, id, job.revision, job.kind, job.status, job.prompt, job.raw_response, job.response ? JSON.stringify(job.response) : null]);
      if (project.revision > oldRevision && job?.status === 'consumed' && job.consumed_revision === project.revision) await conn.execute('INSERT INTO simulation_events (project_id, revision, exchange_id, payload) VALUES (?, ?, ?, ?)', [id, project.revision, job.id, JSON.stringify(job.response)]);
      await conn.commit(); return result;
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }
  async close() { await this.pool.end(); }
}

export async function createStore() {
  const mode = process.env.STORAGE || 'mysql';
  if (!['mysql', 'file'].includes(mode)) throw new Error('STORAGE phải là mysql hoặc file.');
  const store = mode === 'file' ? new FileStore(process.env.DATA_FILE) : new MySQLStore();
  await store.init(); return store;
}
