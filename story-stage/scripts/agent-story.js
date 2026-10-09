import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectPattern = /^p_[a-f0-9-]+$/;
const jobPattern = /^x_[a-f0-9-]+$/;
const usage = 'node scripts/agent-story.js projects | status PROJECT | next PROJECT [--out FILE] | submit PROJECT JOB --file FILE | export PROJECT --out FILE [--format markdown|json]';
const fail = message => { throw new Error(message); };

export function createAgentClient(base = process.env.STORY_STAGE_URL || 'http://127.0.0.1:4317', fetcher = fetch) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) fail('STORY_STAGE_URL cần là địa chỉ gốc của web local, ví dụ http://127.0.0.1:4317.');
  return async (path, { method = 'GET', body, plain = false } = {}) => {
    const response = await fetcher(`${url.origin}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(30000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const data = await response.json();
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status; error.details = data.details || []; throw error;
    }
    return plain ? response.text() : response.json();
  };
}

const save = async (path, data) => {
  const destination = resolve(path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, data, 'utf8');
  return destination;
};

export async function runCLI(args, { request = createAgentClient(), output = value => console.log(JSON.stringify(value, null, 2)) } = {}) {
  const [command, ...rest] = args;
  if (!['projects', 'status', 'next', 'submit', 'export'].includes(command)) fail(usage);
  const positional = [], options = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2);
      if (!['out', 'file', 'format'].includes(key) || options[key] !== undefined || !rest[i + 1] || rest[i + 1].startsWith('--')) fail(usage);
      options[key] = rest[++i];
    } else positional.push(rest[i]);
  }
  const allowed = { projects: [], status: [], next: ['out'], submit: ['file'], export: ['out', 'format'] }[command];
  if (Object.keys(options).some(key => !allowed.includes(key))) fail(usage);
  const [project, job] = positional;
  if (positional.length !== (command === 'projects' ? 0 : command === 'submit' ? 2 : 1) || (command !== 'projects' && !projectPattern.test(project)) || (command === 'submit' && !jobPattern.test(job))) fail(usage);
  const base = `/projects/${project}`;
  if (command === 'projects') { output(await request('/projects')); return; }
  if (command === 'status') { output(await request(`${base}/agent/status`)); return; }
  if (command === 'next') {
    const data = await request(`${base}/agent/next`, { method: 'POST', body: {} });
    if (options.out) { const path = await save(options.out, JSON.stringify(data, null, 2)); output({ ...data, job: data.job ? { ...data.job, prompt: undefined } : null, output_file: path }); }
    else output(data);
    return;
  }
  if (command === 'submit') {
    if (!options.file) fail(usage);
    if ((await stat(options.file)).size > 1000000) fail('Output vượt 1 MB. Chia theo job được cấp; không gửi cả truyện trong một output.');
    const raw = await readFile(options.file, 'utf8');
    output(await request(`${base}/agent/jobs/${job}/submit`, { method: 'POST', body: { raw } }));
    return;
  }
  if (!options.out || (options.format && !['markdown', 'json'].includes(options.format))) fail(usage);
  const format = options.format || 'markdown';
  const content = await request(`${base}/export?format=${format}`, { plain: true });
  output({ project_id: project, format, output_file: await save(options.out, content) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runCLI(process.argv.slice(2)); }
  catch (error) {
    console.error(JSON.stringify({ error: error.message, status: error.status, details: error.details || [] }));
    process.exitCode = 1;
  }
}
