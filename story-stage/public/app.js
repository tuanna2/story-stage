import { createManuscriptUI } from './manuscript-ui.js';
const $ = (q, root = document) => root.querySelector(q);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icons = {
  stage: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 9h18"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/>',
  world: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  book: '<path d="M12 5v15M12 5C8 2 4 3 2 4v15c3-1 6-1 10 1 4-2 7-2 10-1V4c-2-1-6-2-10 1Z"/>',
  exchange: '<path d="M4 6h16M4 12h12M4 18h8"/><rect x="2" y="2" width="20" height="20" rx="3"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
  research: '<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5M14 3h7v7M21 3l-9 9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="white"/><circle cx="16" cy="12" r="2" fill="white"/><circle cx="10" cy="18" r="2" fill="white"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.spark}</svg>`;
const labels = { stage: 'Sân khấu', exchange: 'Trao đổi ChatGPT', characters: 'Dàn nhân vật', world: 'Thế giới', mystery: 'Hồ sơ vụ án', reader: 'Góc nhìn độc giả', manuscript: 'Bản thảo', threads: 'Mạch truyện', history: 'Lịch sử prompt', research: 'Từ hai truyện mẫu' };
const kinds = { simulation: 'Mô phỏng cụm lượt', character: 'Nhân vật chọn hành động', resolution: 'Thế giới phân xử', narration: 'Người kể viết cảnh', case_setup: 'Chuẩn bị hồ sơ vụ án', rewrite: 'Viết lại bản thảo' };
const moods = { fear: 'Sợ hãi', anger: 'Giận dữ', hope: 'Hy vọng', guilt: 'Day dứt' };
const statuses = { active: 'Có thể hành động', absent: 'Tạm vắng', dead: 'Đã chết' };
const state = { projects: [], presets: [], project: null, reader: null, view: 'stage', sceneNumber: null, chapter: null, storage: null, job: null, raw: '', preview: null, reviewedRaw: null, error: null, research: null };

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || 'Không hoàn thành được yêu cầu.'); error.details = result.details; throw error; }
  return result;
}
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500); }
const current = () => state.project?.scenes.at(-1);
const selectedScene = () => state.project?.scenes.find(s => s.number === state.sceneNumber) || current();
const nameOf = id => state.project?.characters.find(c => c.id === id)?.name || id;
const initials = name => name.split(/\s+/).map(x => x[0]).slice(-2).join('').toLocaleUpperCase('vi');
function avatar(c, mini = false) { return `<span class="${mini ? 'mini-avatar' : 'char-avatar'}" style="--color:${esc(c.color)}">${esc(initials(c.name))}</span>`; }
const badge = (label, tone = '') => `<span class="badge ${tone}">${esc(label)}</span>`;
const manuscriptUI = createManuscriptUI({ state, api, esc, icon, badge, heading, showDialog, toast, renderError, copy, loadProject, render });
function budget(config) { return config.mode === 'batch' ? Math.ceil(config.max_turns / config.batch_size) + 1 : config.max_turns * 2 + 1; }

async function loadProject(id, resetView = false) {
  state.project = await api(`/projects/${id}`);
  state.reader = await api(`/projects/${id}/reader`);
  state.job = state.project.exchanges.find(x => x.id === state.project.pending_job_id) || null;
  state.raw = state.job ? localStorage.getItem(`draft:${state.job.id}`) || '' : '';
  state.preview = null; state.error = null; state.reviewedRaw = null;
  state.sceneNumber = current().number;
  if (resetView) state.view = 'stage';
  localStorage.setItem('selectedProject', id);
  state.projects = await api('/projects');
  render();
}
function render() {
  const p = state.project;
  const nav = [ ['stage', 'stage'], ['exchange', 'exchange'], ['characters', 'people'], ['threads', 'spark'], ['mystery', 'lock'], ['reader', 'book'], ['world', 'world'], ['manuscript', 'book'] ];
  $('#app').innerHTML = `<div class="shell">
    <aside class="sidebar" aria-label="Điều hướng chính">
      <div class="brand"><span class="brand-mark">${icon('spark')}</span>story stage<span style="color:#8d83a7;font-weight:400">.</span></div>
      <p class="sidebar-label">Phòng viết</p>
      <nav>${nav.map(([v, i]) => `<button class="nav-button ${state.view === v ? 'active' : ''}" data-action="nav" data-view="${v}">${icon(i)}${labels[v]}${v === 'exchange' && state.job ? '<span class="count">1</span>' : ''}</button>`).join('')}</nav>
      <div class="library"><p class="sidebar-label">Truyện của bạn</p><div class="project-list">${state.projects.map(x => `<button class="project-link ${p?.id === x.id ? 'selected' : ''}" data-action="project" data-id="${esc(x.id)}" title="${esc(x.name)}">${esc(x.name)}</button>`).join('')}</div><button class="new-project" data-action="new">${icon('plus')}Dàn dựng truyện mới</button></div>
      <div class="library"><button class="nav-button ${state.view === 'history' ? 'active' : ''}" data-action="nav" data-view="history">${icon('history')}${labels.history}</button><button class="nav-button ${state.view === 'research' ? 'active' : ''}" data-action="nav" data-view="research">${icon('research')}${labels.research}</button></div>
      <div class="sidebar-bottom"><strong>${state.storage === 'mysql' ? 'Lưu bằng MySQL' : 'Bản thử · lưu trong file'}</strong>ChatGPT thủ công · AI Agent</div>
    </aside>
    <main class="main"><header class="topbar"><div class="breadcrumb"><button class="mobile-menu" data-action="menu" aria-label="Mở điều hướng">${icon('menu')}</button><span>Phòng viết</span><span style="color:#b8b2c6">/</span><strong>${esc(p?.name || 'Sân khấu mới')}</strong></div><div class="topbar-right"><span class="local-label">Không cần API key</span>${p ? `<button class="btn secondary small" data-action="export">${icon('download')}Xuất truyện</button>` : ''}<span class="avatar" title="Phòng viết của bạn">TV</span></div></header>
    <div class="content">${state.view === 'research' ? renderResearch() : !p ? renderWelcome() : renderView()}</div></main></div>`;
}
function heading(title, subtitle = '', actions = '', eyebrow = '') {
  return `<div class="page-heading"><div>${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h1>${esc(title)}</h1>${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ''}</div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}
function renderView() {
  switch (state.view) {
    case 'exchange': return renderExchange();
    case 'characters': return renderCharacters();
    case 'world': return renderWorld();
    case 'mystery': return renderMystery();
    case 'reader': return renderReader();
    case 'manuscript': return renderManuscript();
    case 'threads': return manuscriptUI.renderThreads();
    case 'history': return renderHistory();
    default: return renderStage();
  }
}
function renderWelcome() {
  return `<div class="welcome"><div class="welcome-intro"><p class="eyebrow">Một thế giới. Nhiều ý muốn.</p><h1>Đưa các nhân vật lên sân khấu.</h1><p>Bắt đầu từ một tình huống mở. Cho mỗi nhân vật ký ức và động cơ riêng, rồi để câu chuyện xuất hiện từ những lựa chọn của họ.</p><button class="btn primary" data-action="new">${icon('plus')}Bắt đầu từ ý tưởng riêng</button></div><div class="preset-grid">${state.presets.map((p, i) => `<article class="preset-card"><div class="preset-art">${icon(i ? 'world' : 'stage')}<span class="line-art">${String(i + 1).padStart(2, '0')}</span></div><div class="preset-body">${badge(p.casefile ? 'Phase 2 · Hồ sơ sẵn' : p.genre)}<h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><div class="button-row"><button class="btn primary" data-action="new" data-preset="${esc(p.id)}">${icon('play')}Dàn dựng câu chuyện</button><span class="text-helper">${p.characters.length} nhân vật</span></div></div></article>`).join('')}</div><div class="welcome-guide">${icon('info')}<p>Mỗi cụm lượt: sao chép prompt, gửi vào ChatGPT, dán JSON trở lại và duyệt kết quả. Cuối cảnh, Người kể chuyện chuyển các sự kiện đã xảy ra thành văn xuôi. Bạn có thể chỉnh thế giới, dàn vai và cách kể trước khi bắt đầu.</p></div></div>`;
}
function renderStage() {
  const p = state.project, s = selectedScene(), active = current();
  const completed = p.scenes.filter(s => s.status === 'complete').length;
  const stat = (i, label, value) => `<div class="stat"><div class="stat-icon">${icon(i)}</div><div><p class="stat-label">${label}</p><p class="stat-value">${value}</p></div></div>`;
  return `${heading('Sân khấu câu chuyện', 'Theo dõi những gì đã xảy ra, trước khi chúng trở thành văn xuôi.', `${p.status !== 'complete' ? `<button class="btn primary" data-action="agent">${icon('spark')}Viết hết bằng AI Agent</button>` : ''}<button class="btn secondary" data-action="setup">${icon('settings')}Dàn dựng</button>`, p.genre)}
  ${p.fixture_notice ? `<div class="sample-box">${esc(p.fixture_notice)}</div>` : ''}${renderCaseProgress()}<div class="stats-row">${stat('stage', 'Cảnh đã viết', `${completed} <span>/ ${p.config.max_scenes}</span>`)}${stat('people', 'Nhân vật tự chủ', `${p.characters.length}`)}${stat('exchange', 'Lượt trong cảnh', `${active.turns.length} <span>/ ${p.config.max_turns}</span>`)}${stat('book', 'Số từ bản thảo', `${p.scenes.map(s => s.prose || '').join(' ').trim().split(/\s+/).filter(Boolean).length.toLocaleString('vi')}`)}</div>
  <div class="workspace"><section class="panel"><div class="panel-head"><div class="panel-title">${icon('stage')}<h2>Cảnh ${s.number}</h2>${badge(s.status === 'complete' ? 'Đã viết' : s.status === 'awaiting_narration' ? 'Chờ người kể' : 'Đang mô phỏng', s.status === 'complete' ? 'green' : '')}</div><select class="scene-select" id="scene-select" aria-label="Chọn cảnh">${p.scenes.map(x => `<option value="${x.number}" ${s.number === x.number ? 'selected' : ''}>Cảnh ${x.number}${x.title ? ` · ${esc(x.title)}` : ''}</option>`).join('')}</select></div>
  <div class="stage-top"><div class="scene-meta"><span>${icon('pin')}${esc(s.location)}</span><span>${icon('clock')}${esc(s.time)}</span>${s.pov_id ? `<span>${icon('book')}POV: ${esc(nameOf(s.pov_id))}</span>` : ''}</div><h2>${esc(s.title || 'Trước khi màn mở')}</h2><p class="scene-description">${esc(s.atmosphere || p.premise)}</p><div class="cast-line">${p.characters.map(c => avatar(c, true)).join('')}<small>${p.characters.map(c => esc(c.name)).join(' · ')}</small></div></div>
  <div class="timeline">${s.turns.length ? s.turns.map(renderTurn).join('') : `<div class="timeline-empty"><div class="empty-icon">${icon('spark')}</div><h3>Mọi lựa chọn vẫn còn ở phía trước.</h3><p>Tạo prompt đầu tiên để khởi tạo cảnh và cho các nhân vật bắt đầu tương tác.</p></div>`}</div>${s.end_reason ? `<div class="scene-summary">Điểm dừng: ${esc(s.end_reason)}</div>` : ''}<div class="scene-footer"><span>Áp lực thế giới</span><div class="pressure-track"><div style="width:${p.world.pressure}%"></div></div><span>${p.world.pressure}/100</span><span style="margin-left:auto">${p.world.facts.length} sự thật đã lưu</span></div></section>
  <aside class="side-stack"><section class="panel"><div class="panel-head"><div class="panel-title">${icon('exchange')}<h2>Lượt tiếp theo</h2></div>${badge(p.config.mode === 'batch' ? 'Gộp lượt' : 'Tách nhân vật', 'gray')}</div><div class="workflow"><div class="workflow-step ${active.turns.length ? 'done' : 'current'}"><span class="step-number">1</span><div><strong>Mô phỏng tương tác</strong><small>${p.config.mode === 'batch' ? `${p.config.batch_size} lượt trong một prompt` : 'Prompt riêng cho nhân vật và thế giới'}</small></div></div><div class="workflow-step ${active.status === 'awaiting_narration' ? 'current' : ''}"><span class="step-number">2</span><div><strong>Viết thành văn xuôi</strong><small>Người kể chỉ dùng sự kiện đã xác nhận</small></div></div><div class="workflow-step ${p.status === 'complete' ? 'done' : ''}"><span class="step-number">3</span><div><strong>Ghi nhớ & tiếp tục</strong><small>Ký ức được lưu theo từng người chứng kiến</small></div></div></div><div class="workflow-action">${p.status === 'complete' ? `<button class="btn primary" data-action="nav" data-view="manuscript">${icon('book')}Đọc bản thảo</button>` : `<button class="btn primary" data-action="next">${icon(state.job ? 'exchange' : 'play')}${state.job ? 'Mở prompt đang chờ' : active.status === 'awaiting_narration' ? 'Tạo prompt Người kể' : p.pending_action ? 'Tạo prompt Thế giới' : 'Tạo prompt tiếp theo'}</button>`}<p>${p.status === 'complete' ? 'Đã hoàn thành số cảnh đã chọn. Bản thảo và log có thể xuất thành file.' : state.job ? 'Prompt đã lưu. Bạn có thể quay lại và tiếp tục bất cứ lúc nào.' : `Tối đa khoảng ${budget(p.config)} lần trao đổi mỗi cảnh theo cấu hình hiện tại.`}</p></div></section>
  <section class="panel"><div class="panel-head"><div class="panel-title">${icon('people')}<h2>Đằng sau hành động</h2></div><button class="btn ghost small" data-action="nav" data-view="characters">Xem tất cả</button></div><div class="cast-list">${p.characters.map(c => { const [key, value] = Object.entries(c.mood).sort((a, b) => b[1] - a[1])[0]; return `<button class="cast-member" data-action="character" data-id="${esc(c.id)}">${avatar(c)}<span><strong>${esc(c.name)}</strong><small>${esc(c.role)}</small></span><span class="mood-chip">${moods[key]} ${value}</span></button>`; }).join('')}</div></section></aside></div>
  <div class="info-note">${icon('info')}<span>${p.config.mode === 'batch' ? 'Chế độ gộp lượt giảm thao tác. Một phiên ChatGPT thấy toàn bộ hồ sơ; việc giữ bí mật giữa nhân vật dựa trên chỉ dẫn. Chọn “Tách nhân vật” khi cần prompt không chứa bí mật người khác.' : 'Mỗi prompt nhân vật chỉ chứa ký ức và sự thật người đó biết. Gửi mỗi nhân vật vào một cuộc trò chuyện ChatGPT riêng; dùng cuộc trò chuyện khác cho Thế giới và Người kể.'}</span></div>`;
}
function renderTurn(t) {
  const c = state.project.characters.find(c => c.id === t.actor_id);
  return `<article class="turn"><span class="turn-dot">${avatar(c, true)}</span><div class="turn-head"><strong>${esc(c.name)}</strong>${badge('Hành động', 'gray')}<span class="turn-number">Lượt ${t.number}</span></div><p class="turn-action">${esc(t.action)}</p><div class="outcome"><strong>Kết quả thực tế</strong>${esc(t.outcome)}</div>${t.world_event ? `<div class="event">${esc(t.world_event.text)}</div>` : ''}<details><summary>Nội tâm riêng · ${esc(c.name)}</summary><p>${esc(t.thought)}<br><br>Ý định: ${esc(t.intention)}</p></details><small style="display:block;margin-top:9px">Người chứng kiến: ${t.witnesses.map(id => esc(nameOf(id))).join(', ')}</small></article>`;
}
function renderExchange() {
  const p = state.project, j = state.job;
  return `${heading('Trao đổi với ChatGPT', 'Prompt đã có đủ trạng thái. Dán câu trả lời trở lại để kiểm tra và tiếp tục.', j ? badge(kinds[j.kind]) : '', 'Cầu nối thủ công')}
  <div class="protocol"><div>${icon('copy')}<span><strong>1. Sao chép prompt</strong><small>Gửi vào ChatGPT</small></span></div><div>${icon('exchange')}<span><strong>2. Dán câu trả lời</strong><small>Có thể kèm lời dẫn và Markdown</small></span></div><div>${icon('check')}<span><strong>3. Duyệt & nhập</strong><small>Cập nhật trạng thái mô phỏng</small></span></div></div>
  ${!j ? `<section class="panel"><div class="panel-body"><h2>${p.status === 'complete' ? 'Mô phỏng đã hoàn tất' : 'Sẵn sàng cho bước tiếp theo'}</h2><p class="subtitle">${p.status === 'complete' ? 'Đọc bản thảo hoặc tạo một truyện mới từ dàn dựng khác.' : `Cảnh ${current().number} · ${p.config.mode === 'batch' ? 'Gộp lượt' : 'Tách nhân vật'} · ${budget(p.config)} lần trao đổi/cảnh ở giới hạn tối đa.`}</p>${p.status !== 'complete' ? `<label class="field" style="margin-top:23px"><span>Chỉ dẫn dàn dựng cho lượt này (không bắt buộc)</span><textarea id="guidance" placeholder="Ví dụ: giữ cảnh tập trung vào cuộc trò chuyện; để nhân vật tự quyết định."></textarea><p class="text-helper">Chỉ dẫn không thay thế luật thế giới và không sửa những việc đã xảy ra.</p></label><button class="btn primary" data-action="next">${icon('play')}Tạo prompt</button>` : `<button class="btn primary" style="margin-top:23px" data-action="nav" data-view="manuscript">${icon('book')}Đọc bản thảo</button>`}</div></section>` : `
  <div class="exchange-grid"><section class="panel"><div class="panel-head"><div class="panel-title">${icon('copy')}<h2>Prompt gửi đi</h2></div><span class="badge gray">Cảnh ${j.scene_number} · v${j.revision}</span></div><div class="panel-body"><div class="exchange-title">${badge(kinds[j.kind])}<small>${j.actor_ids.map(id => esc(nameOf(id))).join(', ')}</small></div><textarea class="prompt-text" id="prompt-text" aria-label="Prompt gửi ChatGPT" readonly>${esc(j.prompt)}</textarea><div class="button-row" style="margin-top:15px"><button class="btn primary" data-action="copy-prompt">${icon('copy')}Sao chép prompt</button><a class="btn secondary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Mở ChatGPT</a><button class="btn ghost small" data-action="cancel-job">Hủy prompt</button></div><p class="text-helper">${j.kind === 'character' ? 'Dùng cuộc trò chuyện riêng của nhân vật này. Đừng gửi vào cuộc trò chuyện đã thấy bí mật của nhân vật khác.' : p.config.mode === 'isolated' ? 'Dùng cuộc trò chuyện dành cho vai trò này, tách khỏi cuộc trò chuyện của các nhân vật.' : 'Câu trả lời cần giữ nguyên exchange_id và revision có trong prompt.'}</p></div></section>
  <section class="panel"><div class="panel-head"><div class="panel-title">${icon('exchange')}<h2>Câu trả lời nhận về</h2></div>${badge('Chờ bạn dán', 'amber')}</div><div class="panel-body"><textarea class="prompt-text" id="raw-response" placeholder="Dán toàn bộ câu trả lời ChatGPT vào đây…" aria-label="Câu trả lời JSON">${esc(state.raw)}</textarea><div class="button-row" style="margin-top:15px"><button class="btn primary" data-action="preview">${icon('check')}Kiểm tra & xem trước</button><button class="btn secondary" data-action="repair">${icon('copy')}Prompt sửa câu trả lời</button></div><p class="text-helper">${j.kind === 'narration' ? p.casefile ? 'Vụ án cần JSON gồm prose, reader_updates và editorial_check để kiểm tra nguồn tiết lộ.' : 'Bước Người kể này nhận cả JSON lẫn văn xuôi thuần; POV và lượt nguồn lấy từ cảnh đã mô phỏng.' : 'Nhận JSON kèm lời dẫn/Markdown và chuẩn hóa lỗi cú pháp phổ biến.'} Bản dán được giữ đến khi nhập thành công; đọc bản chuẩn hóa trước khi lưu.</p><div id="response-error">${renderError(state.error)}</div></div></section></div><div id="response-preview">${renderPreview()}</div>`}`;
}
function renderError(error) {
  if (!error) return '';
  return `<div class="error-box" role="alert">${esc(error.message)}${error.details?.length ? `<ul>${error.details.map(d => `<li><strong>${esc(d.path)}</strong>: ${esc(d.message)}</li>`).join('')}</ul>` : ''}</div>`;
}
function renderPreview() {
  const v = state.preview;
  if (!v) return '';
  return `<section class="panel review-panel"><div class="panel-head"><div class="panel-title">${icon('check')}<h2>Kết quả sẽ được nhập</h2></div>${badge('Cấu trúc hợp lệ', 'green')}</div><div class="panel-body">${manuscriptUI.renderQuality(v.quality_notes)}${manuscriptUI.renderThreadChanges(v.changed_threads)}${v.import_notes?.length ? `<div class="normalization-note"><h3>Web đã chuẩn hóa bản dán</h3><ul>${v.import_notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}<details class="normalized-output"><summary>Xem JSON sẽ được lưu</summary><pre class="large-json">${esc(JSON.stringify(v.normalized_response, null, 2))}</pre><button class="btn secondary small" data-action="copy-normalized">Sao chép JSON chuẩn hóa</button></details>${v.casefile_created ? '' : v.prose ? `<div class="review-prose">${esc(v.prose)}</div>` : `<div class="review-columns"><div><h3 style="margin-bottom:12px">${v.proposed_action ? 'Hành động dự định' : 'Diễn biến mới'}</h3>${v.proposed_action ? `<div class="review-item"><strong>${esc(nameOf(v.proposed_action.actor_id))}</strong>${esc(v.proposed_action.action)}<br><br>Nội tâm: ${esc(v.proposed_action.thought)}</div>` : v.new_turns.map(t => `<div class="review-item"><strong>Lượt ${t.number} · ${esc(nameOf(t.actor_id))}</strong>${esc(t.action)}<br><br>Kết quả: ${esc(t.outcome)}${t.world_event ? `<br><br>Sự kiện: ${esc(t.world_event.text)}` : ''}</div>`).join('')}</div><div><h3 style="margin-bottom:12px">Thông tin & cảm xúc</h3>${v.reveals.map(f => `<div class="review-item"><strong>${esc(f.id)}</strong>${esc(f.text)}<br>Người biết: ${f.known_by.length ? f.known_by.map(id => esc(nameOf(id))).join(', ') : 'Chỉ Thế giới'}</div>`).join('')}${v.changed_moods.map(c => `<div class="review-item"><strong>${esc(c.name)}</strong>${Object.entries(c.mood).map(([k, value]) => `${moods[k]}: ${value}`).join(' · ')}</div>`).join('')}${(v.changed_statuses || []).map(c => `<div class="review-item"><strong>${esc(c.name)}</strong>Trạng thái mới: ${statuses[c.status]}</div>`).join('')}${!v.reveals.length && !v.changed_moods.length && !v.changed_statuses?.length ? '<p class="summary-text">Chưa có cập nhật sự thật hoặc cảm xúc ở bước này.</p>' : ''}</div></div>`}${renderMysteryPreview(v)}<div class="info-note">${icon('info')}<span>Cấu trúc và phạm vi người biết đã được kiểm tra. Đọc lại kết quả để xác nhận nguyên nhân, cảm giác của POV và tính hợp lý của câu chuyện.</span></div><div class="button-row right" style="margin-top:20px"><button class="btn secondary" data-action="discard-preview">Quay lại chỉnh JSON</button><button class="btn primary" data-action="commit">${icon('check')}Nhập kết quả & tiếp tục</button></div></div></section>`;
}
function moodBars(c) { return `<div class="moods">${Object.entries(c.mood).map(([key, value]) => `<div class="mood-item"><div><span>${moods[key]}</span><span>${value}/100</span></div><div class="mood-bar"><div style="width:${value}%;--color:${esc(c.color)}"></div></div></div>`).join('')}</div>`; }
function renderCharacters() {
  return `${heading('Dàn nhân vật', 'Mỗi người có điều muốn đạt được, điều muốn giấu và cách nhìn riêng về thế giới.', `<button class="btn secondary" data-action="setup">${icon('settings')}Chỉnh dàn dựng</button>`, `${state.project.characters.length} luồng ký ức riêng`)}<div class="characters-grid">${state.project.characters.map(c => `<article class="panel character-card"><div class="panel-head">${avatar(c)}<div><h2>${esc(c.name)}</h2><small>${esc(c.role)}</small></div><span style="margin-left:auto">${badge(`${c.memories.length} ký ức`, 'gray')}</span></div><div class="panel-body"><div class="character-section"><h3>Trạng thái cảm xúc</h3>${moodBars(c)}</div><div class="character-section"><h3>Tính cách</h3><p>${esc(c.personality)}</p></div><div class="character-section"><h3>Động cơ</h3><ul>${c.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div><div class="character-section"><div class="secret">${icon('lock')} <strong>Bí mật riêng</strong><br>${esc(c.secret || 'Chưa có bí mật.')}</div></div>${Object.keys(c.trust).length ? `<div class="character-section"><h3>Niềm tin vào người khác</h3>${Object.entries(c.trust).map(([id, value]) => `<p>${esc(nameOf(id))}: ${value > 0 ? '+' : ''}${value}/100</p>`).join('')}</div>` : ''}<div class="button-row"><button class="btn secondary small" data-action="character" data-id="${esc(c.id)}">Xem hồ sơ & ký ức</button><small>${state.project.world.facts.filter(f => f.known_by.includes(c.id)).length} sự thật đã biết</small></div></div></article>`).join('')}</div>`;
}
function renderWorld() {
  const p = state.project;
  return `${heading('Thế giới & sự thật', 'Điều đã xảy ra được giữ nguyên. Điều một nhân vật tin có thể khác với sự thật.', badge(`${p.world.facts.length} sự thật`), 'World Agent')}<div class="world-layout"><section class="panel"><div class="panel-head"><div class="panel-title">${icon('world')}<h2>Sổ sự thật</h2></div>${badge('Góc nhìn biên tập', 'gray')}</div><div class="facts">${p.world.facts.map(f => `<article class="fact"><p>${esc(f.text)}</p><div class="fact-meta"><span>${icon(f.known_by.length === p.characters.length ? 'people' : 'lock')} ${f.known_by.length ? `Người biết: ${f.known_by.map(id => esc(nameOf(id))).join(', ')}` : 'Chỉ Thế giới biết'}</span><code>${esc(f.id)}</code></div></article>`).join('')}</div></section><section class="panel"><div class="panel-head"><div class="panel-title">${icon('settings')}<h2>Quy tắc sân khấu</h2></div></div><div class="world-setting"><h3>Bối cảnh</h3><p>${esc(p.world.setting)}</p><h3>Quy tắc bất biến</h3><ul>${p.world.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul><div class="info-note">${icon('info')}<span>Đây là toàn bộ sự thật cho người biên tập. Prompt nhân vật ở chế độ tách chỉ nhận phần họ biết.</span></div></div></section></div>`;
}
function renderManuscript() { return manuscriptUI.renderManuscript(); }
function renderCaseProgress() {
  const p = state.project, file = p.casefile;
  if (!file) return '';
  const completed = p.scenes.filter(s => s.status === 'complete').length;
  const last = Math.max(0, ...Object.values(p.reader).flat().map(entry => entry.scene_number));
  return `<div class="case-progress"><div><strong>${esc(file.central_question)}</strong><p>${p.reader.clues.length}/${file.clues.length} manh mối đã kể · ${file.questions.length - p.reader.answers.length} câu hỏi còn mở · ${p.config.max_scenes - completed} cảnh còn lại${completed - last >= 2 ? ' · Hai cảnh chưa thêm thông tin cho độc giả: prompt tiếp sẽ gợi ý cơ hội điều tra.' : ''}</p></div><button class="btn secondary small" data-action="nav" data-view="mystery">Xem hồ sơ</button></div>`;
}
function renderMystery() {
  const p = state.project, file = p.casefile;
  if (!file) {
    const ready = !state.job && !p.pending_action && !p.scenes.some(s => s.turns.length);
    return `${heading('Hồ sơ vụ án', 'Chuẩn bị sự thật nền và dấu vết trước khi các nhân vật bắt đầu điều tra.', '', 'Phase 2')}<section class="panel page-empty"><div class="empty-icon">${icon('lock')}</div><h2>Truyện này chưa có hồ sơ.</h2><p>${ready ? 'Dùng một prompt để tạo hồ sơ từ dàn dựng hiện tại, hoặc chọn preset “Hồ sơ dưới cơn mưa” đã có sẵn.' : 'Truyện đã bắt đầu. Tạo truyện mới với hồ sơ nền để giữ quá khứ nhất quán.'}</p><div class="button-row">${ready ? '<button class="btn primary" data-action="case-setup">Tạo hồ sơ bằng ChatGPT</button>' : ''}<button class="btn secondary" data-action="new" data-preset="rain-case">Dùng preset có hồ sơ</button></div></section>`;
  }
  const fact = id => p.world.facts.find(f => f.id === id);
  return `${heading('Hồ sơ vụ án', 'Theo dõi dấu vết, người phát hiện và những cách hiểu thay đổi trong cuộc điều tra.', badge('Dành cho người dàn dựng', 'amber'), 'Phase 2 · Quá khứ cố định')}${renderCaseProgress()}
    <details class="panel truth-panel"><summary>${icon('lock')}Sự thật nền & dòng thời gian · chứa đáp án</summary><div class="panel-body"><div class="case-grid"><div><h2>Sự thật quá khứ</h2>${file.truths.map(t => `<article class="case-entry"><p>${esc(fact(t.fact_id).text)}</p><small>${esc(t.fact_id)} · Người biết: ${fact(t.fact_id).known_by.map(id => esc(nameOf(id))).join(', ') || 'Chỉ Thế giới'}<br>Chứng cứ cần: ${t.required_clue_ids.map(esc).join(', ') || 'Lời thú nhận có nguồn'}</small></article>`).join('')}</div><div><h2>Dòng thời gian nền</h2>${file.timeline.map(t => `<article class="case-entry"><strong>${esc(t.at)}</strong><p>${esc(t.text)}</p><small>${t.fact_ids.map(esc).join(', ')}</small></article>`).join('')}</div></div><p class="summary-text">Hồ sơ xác định quá khứ; động cơ, lựa chọn và kết cục tương lai tiếp tục được mô phỏng. Để thay đáp án, tạo một truyện mới.</p></div></details>
    <div class="case-grid clue-grid">${file.clues.map(c => {
      const found = p.case_ledger.discoveries.filter(d => d.clue_id === c.id), people = [...new Set(found.flatMap(d => d.by))];
      const shown = p.reader.clues.find(d => d.clue_id === c.id), interpretations = p.case_ledger.interpretations.filter(i => i.clue_id === c.id);
      return `<article class="panel clue-card"><div class="panel-head"><h2>${esc(c.title)}</h2>${badge(found.length ? 'Đã phát hiện' : 'Chưa phát hiện', found.length ? 'green' : 'gray')}</div><div class="panel-body"><p class="clue-observation">${esc(fact(c.evidence_fact_id).text)}</p><p class="summary-text">${esc(c.id)} · ${esc(c.location)}<br>Người biết: ${people.map(id => esc(nameOf(id))).join(', ') || 'Chưa ai'}<br>Độc giả: ${shown ? `Được kể ở cảnh ${shown.scene_number}` : 'Chưa được kể'}</p><details><summary>Cách tiếp cận & ý nghĩa trong hồ sơ</summary><p><strong>Điều kiện:</strong> ${esc(c.discovery_condition)}</p><p><strong>Bề mặt:</strong> ${esc(c.surface_reading)}</p><p><strong>Đọc lại:</strong> ${esc(c.deeper_reading)}</p><small>Sự thật liên kết: ${c.truth_fact_ids.map(esc).join(', ')}</small></details>${found.length ? `<details><summary>Nguồn phát hiện · ${found.length}</summary>${found.map(d => `<blockquote>${esc(d.excerpt)}<small>${d.scene_number ? `Cảnh ${d.scene_number} · ${esc(d.turn_id)} · ${d.source === 'world_event' ? 'Sự kiện thế giới' : 'Hành động'}` : 'Đã biết từ dàn dựng'} · ${d.by.map(id => esc(nameOf(id))).join(', ')}</small></blockquote>`).join('')}</details>` : ''}${interpretations.length ? `<div class="hypotheses"><h3>Cách hiểu của nhân vật</h3>${interpretations.map(i => `<p><strong>${esc(nameOf(i.character_id))}</strong> · ${i.confidence}% · cảnh ${i.scene_number}<br>${esc(i.text)}</p>`).join('')}</div>` : ''}</div></article>`;
    }).join('')}</div>`;
}
function renderReader() {
  const r = state.reader;
  if (!r?.central_question) return `${heading('Góc nhìn độc giả', 'Chỉ cập nhật từ những chi tiết đã xuất hiện trong văn xuôi.')}<section class="panel page-empty"><h2>Chưa có hồ sơ để theo dõi tiết lộ.</h2><p>Tạo truyện với preset “Hồ sơ dưới cơn mưa” để dùng sổ thông tin độc giả.</p><button class="btn primary" data-action="new" data-preset="rain-case">Dàn dựng vụ án mới</button></section>`;
  return `${heading('Góc nhìn độc giả', r.central_question, badge(`${r.clues.length} manh mối đã kể`), 'Thông tin từ bản thảo')}<div class="case-grid"><section class="panel"><div class="panel-head"><h2>Câu hỏi trong truyện</h2></div><div class="panel-body">${r.questions.map(q => `<article class="case-entry">${badge(q.answer ? `Có đáp án · cảnh ${q.answer.scene_number}` : 'Còn mở', q.answer ? 'green' : 'gray')}<h3>${esc(q.text)}</h3>${q.answer ? `<blockquote>${esc(q.answer.excerpt)}</blockquote>` : ''}</article>`).join('')}</div></section><section class="panel"><div class="panel-head"><h2>Manh mối đã đọc</h2></div><div class="panel-body">${r.clues.length ? r.clues.map(c => `<article class="case-entry"><h3>${esc(c.title)}</h3><blockquote>${esc(c.excerpt)}<small>Xuất hiện lần đầu · cảnh ${c.scene_number}</small></blockquote>${r.interpretations.filter(i => i.clue_id === c.clue_id).map(i => `<p class="summary-text">Cách hiểu ở cảnh ${i.scene_number} · ${i.confidence}%: ${esc(i.text)}</p>`).join('')}</article>`).join('') : '<p class="summary-text">Chưa có manh mối nào được kể. Mô phỏng xong chưa tự mở thông tin cho độc giả; cần nhập bản thảo Người kể.</p>'}</div></section></div>${r.facts.length ? `<section class="panel reader-facts"><div class="panel-head"><h2>Sự thật đã được kể</h2></div><div class="panel-body">${r.facts.map(f => `<article class="case-entry"><small>${esc(f.fact_id)} · Cảnh ${f.scene_number}</small><blockquote>${esc(f.excerpt)}</blockquote></article>`).join('')}</div></section>` : ''}`;
}
function renderMysteryPreview(v) {
  if (!v.casefile_created && !v.discoveries?.length && !v.interpretations?.length && !v.reader_updates) return '';
  return `<div class="mystery-preview">${v.casefile_created ? `<h3>Hồ sơ nền sẽ được giữ cố định</h3><p>${esc(v.casefile_created.central_question)}</p><p>${v.casefile_created.truths.length} sự thật · ${v.casefile_created.clues.length} manh mối · ${v.casefile_created.questions.length} câu hỏi</p><details><summary>Đọc toàn bộ hồ sơ và sự thật mới trước khi nhập</summary><pre class="large-json">${esc(JSON.stringify({ casefile: v.casefile_created, new_facts: v.new_facts, initial_beliefs: v.initial_beliefs }, null, 2))}</pre></details>` : ''}${v.discoveries?.length ? `<h3>Phát hiện có nguồn</h3>${v.discoveries.map(d => `<blockquote>${esc(d.excerpt)}<small>${esc(d.clue_id)} · ${d.by.map(id => esc(nameOf(id))).join(', ')}</small></blockquote>`).join('')}` : ''}${v.interpretations?.length ? `<h3>${v.proposed_action ? 'Cách hiểu trong kế hoạch riêng' : 'Cách hiểu sẽ được lưu'}</h3>${v.interpretations.map(i => `<p>${esc(nameOf(i.character_id))}: ${esc(i.text)} (${i.confidence}%)</p>`).join('')}` : ''}${v.reader_updates ? `<h3>Thông tin sẽ mở cho độc giả</h3><p>${v.reader_updates.clues.length} manh mối · ${v.reader_updates.facts.length} sự thật · ${v.reader_updates.answers.length} đáp án · ${v.reader_updates.interpretations.length} cách hiểu</p><details><summary>Xem trích đoạn chứng minh</summary><pre class="large-json">${esc(JSON.stringify(v.reader_updates, null, 2))}</pre></details><p class="summary-text">Nguồn và phạm vi biết đã kiểm tra bằng ID. Bốn tiêu chí nội dung do Người kể tự đánh giá; đọc lại văn xuôi trước khi nhập.</p>${v.editorial_check?.notes.length ? `<p>${v.editorial_check.notes.map(esc).join('; ')}</p>` : ''}` : ''}</div>`;
}
function renderHistory() {
  const jobs = [...state.project.exchanges].reverse();
  return `${heading('Lịch sử prompt', 'Mọi trao đổi đã tạo, kể cả prompt đã hủy, được lưu cùng trạng thái của truyện.', badge(`${jobs.length} prompt`, 'gray'))}<section class="panel">${jobs.length ? jobs.map(j => `<div class="history-row"><span class="stat-icon">${icon(j.kind === 'narration' ? 'book' : 'exchange')}</span><div class="history-main"><strong>${kinds[j.kind]}</strong><small>Cảnh ${j.scene_number} · v${j.revision} · ${new Date(j.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</small></div>${badge(j.status === 'consumed' ? 'Đã nhập' : j.status === 'cancelled' ? 'Đã hủy' : 'Đang chờ', j.status === 'consumed' ? 'green' : j.status === 'cancelled' ? 'gray' : 'amber')}<button class="btn secondary small" data-action="history-detail" data-id="${esc(j.id)}">Xem</button></div>`).join('') : '<div class="page-empty"><p>Chưa có prompt nào. Tạo lượt đầu tiên trên sân khấu.</p></div>'}</section>`;
}
function renderResearch() {
  const r = state.research;
  if (!r) return '<div class="busy-indicator">Đang mở ghi chú tham khảo…</div>';
  return `${heading('Từ hai truyện mẫu', 'Chuyển cơ chế tạo căng thẳng thành quy tắc mô phỏng, để mở những kết cục mới.', '', 'Ghi chú thiết kế')}<div class="research-grid">${r.observations.map(o => `<section class="panel"><div class="panel-head"><h2>${esc(o.title)}</h2></div><div class="research-body"><h3>Điều rút ra từ văn bản</h3><p>${esc(o.finding)}</p><h3>Cách đưa vào sân khấu</h3><p>${esc(o.application)}</p></div></section>`).join('')}</div><div class="research-flow"><span>Động cơ riêng</span><span>Ký ức có phạm vi</span><span>Hành động công khai</span><span>Kết quả thực tế</span><span>POV giới hạn</span><span>Văn xuôi</span></div><section class="panel"><div class="panel-head"><h2>Luồng trao đổi đã rút gọn</h2></div><div class="research-body"><p>Một prompt gộp khởi tạo cảnh, chạy từng lượt với phản ứng của nhân vật, phân xử hành động và sự kiện. Một prompt khác viết văn xuôi ở cuối cảnh. Việc chọn người theo vòng, lưu kết quả, truy xuất ký ức và tóm tắt theo người chứng kiến do web thực hiện.</p><p>Ví dụ 6 lượt/cảnh, gộp 3 lượt/prompt: tối đa 2 prompt mô phỏng + 1 prompt Người kể = 3 lần trao đổi. Gộp cả 6 lượt còn 2 lần/cảnh. Tách từng nhân vật giữ dữ liệu riêng nhưng cần 13 lần/cảnh ở cùng giới hạn.</p><p>Chế độ gộp vẫn dùng một phiên LLM để đóng nhiều vai; đây là đánh đổi để giảm copy/paste. Chế độ tách tạo các prompt có dữ liệu riêng. Để tránh lịch sử hội thoại làm lộ thông tin, gửi mỗi nhân vật vào một cuộc trò chuyện riêng.</p><h3>Tài liệu tham khảo</h3><div class="source-links">${r.sources.map(s => `<div><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a><small>${esc(s.note)}</small></div>`).join('')}</div></div></section>`;
}

function showDialog(title, body, footer = '') {
  const d = $('#dialog');
  d.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button class="close-dialog" data-action="close" aria-label="Đóng">${icon('close')}</button></div><div class="dialog-body">${body}</div>${footer ? `<div class="dialog-foot">${footer}</div>` : ''}`;
  if (!d.open) d.showModal();
}
function configInputs(c) {
  return `<div class="radio-cards"><label class="radio-card"><input type="radio" name="mode" value="batch" ${c.mode === 'batch' ? 'checked' : ''}><strong>Gộp lượt · ít thao tác</strong><small>2–3 lần trao đổi/cảnh. Một phiên ChatGPT đóng nhiều vai, giữ bí mật bằng chỉ dẫn.</small></label><label class="radio-card"><input type="radio" name="mode" value="isolated" ${c.mode === 'isolated' ? 'checked' : ''}><strong>Tách nhân vật · dữ liệu riêng</strong><small>Mỗi nhân vật có prompt riêng, rồi Thế giới phân xử. Dùng các cuộc trò chuyện riêng.</small></label></div><div class="setup-controls"><label class="field"><span>Số cảnh tối đa</span><input class="input" name="max_scenes" type="number" min="1" max="30" value="${c.max_scenes}" required></label><label class="field"><span>Lượt mỗi cảnh</span><input class="input" name="max_turns" type="number" min="1" max="20" value="${c.max_turns}" required></label><label class="field"><span>Lượt gộp / prompt</span><select name="batch_size">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${n === c.batch_size ? 'selected' : ''}>${n} lượt</option>`).join('')}</select></label><label class="field"><span>Ký ức gửi mỗi nhân vật</span><input class="input" name="memory_limit" type="number" min="4" max="24" value="${c.memory_limit}" required></label></div><div class="budget"><span class="budget-total" id="budget-count">${budget(c)} <span>lần trao đổi / cảnh</span></span><p>Số lần tối đa theo cấu hình. Cảnh có thể kết thúc sớm.</p></div>`;
}
function readConfig(form) { return Object.fromEntries(['mode', 'max_scenes', 'max_turns', 'batch_size', 'memory_limit'].map(key => [key, key === 'mode' ? new FormData(form).get(key) : Number(form.elements[key].value)])); }
const blankCharacter = () => ({ name: '', role: '', personality: '', background: '', goals: [], secret: '', limitations: [] });
const lines = text => text.split('\n').map(x => x.trim()).filter(Boolean);
let creator = null;
function openNew(presetId) {
  creator = {
    mode: presetId ? 'preset' : 'manual', presetId: presetId || 'rain-case', presetJSON: null, presetName: null,
    config: { mode: 'batch', max_scenes: presetId && state.presets.find(p => p.id === presetId)?.casefile ? 8 : 6, max_turns: 6, batch_size: 6, memory_limit: 12 },
    manual: { name: '', genre: '', premise: '', setting: '', location: '', time: '',
      rules: ['Mỗi nhân vật chỉ biết những gì mình đã quan sát hoặc được kể.', 'Hành động có hệ quả theo quy tắc của thế giới; kết cục để mở.'],
      voice: 'Văn xuôi tiếng Việt, POV giới hạn, đối thoại tự nhiên.', guidance: 'Kể từ sự kiện đã mô phỏng; để động cơ riêng dẫn dắt lựa chọn.', words: 1500,
      characters: [blankCharacter(), blankCharacter()] },
    brief: { name: '', genre: '', idea: '', constraints: '', character_count: 4, voice: 'Văn xuôi tiếng Việt, POV giới hạn, đối thoại tự nhiên.', words: 1500 },
    prompt: '', raw: '', preview: null, reviewedRaw: null, error: null,
  };
  renderCreator();
}
function creatorTabs() {
  return `<div class="creator-tabs" role="tablist" aria-label="Cách tạo truyện">${[['manual', 'Tự dàn dựng'], ['ai', 'Nhờ ChatGPT'], ['preset', 'Dùng preset']].map(([mode, label]) => `<button type="button" role="tab" aria-selected="${creator.mode === mode}" data-action="creator-mode" data-mode="${mode}">${label}</button>`).join('')}</div>`;
}
function creatorField(key, label, value, { multiline = false, required = true, placeholder = '', max = 12000 } = {}) {
  return `<label class="field"><span>${esc(label)}</span>${multiline ? `<textarea name="${key}" maxlength="${max}" ${required ? 'required' : ''} placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input class="input" name="${key}" maxlength="${max}" value="${esc(value)}" ${required ? 'required' : ''} placeholder="${esc(placeholder)}">`}</label>`;
}
function creatorCharacter(c, i) {
  return `<fieldset class="creator-character" data-index="${i}"><legend>Nhân vật ${i + 1}</legend><div class="creator-pair">${creatorField('char_name', 'Tên nhân vật', c.name, { max: 120 })}${creatorField('char_role', 'Vai trò', c.role, { max: 200 })}</div>${creatorField('char_personality', 'Tính cách', c.personality, { multiline: true, placeholder: 'Cách phản ứng, ưu điểm và điểm yếu' })}${creatorField('char_background', 'Câu chuyện nền', c.background, { multiline: true })}${creatorField('char_goals', 'Mục tiêu riêng · mỗi dòng một mục tiêu', c.goals.join('\n'), { multiline: true })}${creatorField('char_secret', 'Bí mật riêng (không bắt buộc)', c.secret, { multiline: true, required: false })}${creatorField('char_limitations', 'Giới hạn · mỗi dòng một điều', c.limitations.join('\n'), { multiline: true, required: false })}<button type="button" class="btn ghost small" data-action="creator-remove" data-index="${i}" ${creator.manual.characters.length <= 2 ? 'disabled' : ''}>Bỏ nhân vật ${i + 1}</button></fieldset>`;
}
function captureCreator() {
  const form = $('#custom-form') || $('#ai-brief-form') || $('#new-form');
  if (!form) return;
  creator.config = readConfig(form);
  if (form.id === 'custom-form') {
    for (const key of ['name', 'genre', 'premise', 'setting', 'location', 'time', 'voice', 'guidance']) creator.manual[key] = form.elements[key].value;
    creator.manual.words = Number(form.elements.words.value); creator.manual.rules = lines(form.elements.rules.value);
    creator.manual.characters = [...form.querySelectorAll('.creator-character')].map(card => {
      const get = key => $(`[name="char_${key}"]`, card).value;
      return { name: get('name'), role: get('role'), personality: get('personality'), background: get('background'), goals: lines(get('goals')), secret: get('secret'), limitations: lines(get('limitations')) };
    });
  } else if (form.id === 'ai-brief-form') {
    for (const key of ['name', 'genre', 'idea', 'constraints', 'voice']) creator.brief[key] = form.elements[key].value;
    for (const key of ['words', 'character_count']) creator.brief[key] = Number(form.elements[key].value);
    creator.raw = $('#setup-response')?.value || creator.raw;
  } else {
    creator.presetId = form.elements.preset_id.value; creator.presetName = form.elements.name.value; creator.presetJSON = form.elements.preset_json.value;
  }
}
function renderCreator() {
  if (creator.mode === 'preset') {
    openPresetNew(creator.presetId);
    const form = $('#new-form');
    if (creator.presetJSON) { form.elements.preset_json.value = creator.presetJSON; form.elements.name.value = creator.presetName; }
    return;
  }
  if (creator.mode === 'ai') {
    const b = creator.brief, v = creator.preview;
    showDialog('Dàn dựng từ ý tưởng với ChatGPT', `${creatorTabs()}<p class="creator-intro">Viết ý tưởng → sao chép prompt → dán dàn dựng ChatGPT trả về → duyệt và tạo truyện.</p><form id="ai-brief-form"><div class="creator-pair">${creatorField('name', 'Tên dự án / truyện', b.name, { max: 120 })}${creatorField('genre', 'Thể loại', b.genre, { max: 120, placeholder: 'Ví dụ: tình cảm, kỳ ảo, khoa học viễn tưởng…' })}</div>${creatorField('idea', 'Ý tưởng và xung đột ban đầu', b.idea, { multiline: true })}${creatorField('constraints', 'Yêu cầu riêng (không bắt buộc)', b.constraints, { multiline: true, required: false })}${creatorField('voice', 'Giọng kể', b.voice, { multiline: true })}<div class="creator-pair"><label class="field"><span>Số nhân vật</span><input class="input" type="number" name="character_count" min="2" max="8" value="${b.character_count}" required></label><label class="field"><span>Số từ mỗi cảnh</span><input class="input" type="number" name="words" min="200" max="2000" value="${b.words}" required></label></div>${configInputs(creator.config)}<button class="btn primary" type="submit">Tạo prompt dàn dựng</button></form>${creator.prompt ? `<section class="creator-step"><h3>1. Gửi prompt này vào ChatGPT</h3><textarea class="prompt-text" aria-label="Prompt dàn dựng gửi ChatGPT" readonly>${esc(creator.prompt)}</textarea><button class="btn secondary" data-action="creator-copy">${icon('copy')}Sao chép prompt dàn dựng</button><a class="btn secondary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Mở ChatGPT</a></section><section class="creator-step"><h3>2. Dán câu trả lời</h3><textarea class="prompt-text" id="setup-response" aria-label="Dàn dựng ChatGPT trả về" placeholder="Dán toàn bộ JSON, có thể kèm lời dẫn và Markdown">${esc(creator.raw)}</textarea><button class="btn primary" data-action="creator-preview">Kiểm tra dàn dựng</button><button class="btn secondary" data-action="creator-repair">Prompt sửa dàn dựng</button></section>` : ''}<div id="dialog-error">${renderError(creator.error)}</div>${v ? `<section class="creator-step" id="setup-review"><h3>3. Dàn dựng sẽ được tạo</h3><p><strong>${esc(v.preset.name)}</strong> · ${esc(v.preset.genre)} · ${v.preset.characters.length} nhân vật</p><p>${esc(v.preset.premise)}</p>${v.import_notes.length ? `<ul>${v.import_notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}<div class="creator-cast">${v.preset.characters.map(c => `<article><strong>${esc(c.name)}</strong> · ${esc(c.role)}<p>${esc(c.personality)}</p><p>Mục tiêu: ${esc(c.goals.join('; '))}</p></article>`).join('')}</div><details><summary>Đọc thế giới, hồ sơ riêng và giọng kể trước khi tạo</summary><pre class="large-json">${esc(JSON.stringify(v.preset, null, 2))}</pre></details></section>` : ''}`, `<small>Copy/paste thủ công; tạo truyện sau khi bạn duyệt dàn dựng.</small>${v ? '<button class="btn primary" data-action="creator-create">Mở sân khấu từ dàn dựng này</button>' : ''}`);
    return;
  }
  const m = creator.manual;
  showDialog('Dàn dựng từ ý tưởng riêng', `${creatorTabs()}<p class="creator-intro">Tạo một thế giới và 2–8 nhân vật theo bất kỳ thể loại nào. Bạn có thể nhờ ChatGPT điền dàn dựng ở tab bên cạnh.</p><form id="custom-form"><div class="creator-pair">${creatorField('name', 'Tên dự án / truyện', m.name, { max: 120 })}${creatorField('genre', 'Thể loại', m.genre, { max: 120, placeholder: 'Ví dụ: tình cảm, kỳ ảo, đời thường…' })}</div>${creatorField('premise', 'Tình huống và xung đột mở màn', m.premise, { multiline: true })}${creatorField('setting', 'Bối cảnh thế giới', m.setting, { multiline: true })}<div class="creator-pair">${creatorField('location', 'Địa điểm mở màn', m.location, { max: 200 })}${creatorField('time', 'Thời điểm mở màn', m.time, { max: 200 })}</div>${creatorField('rules', 'Quy tắc thế giới · mỗi dòng một điều', m.rules.join('\n'), { multiline: true })}<h3 class="creator-section-title">Dàn nhân vật tự chủ</h3>${m.characters.map(creatorCharacter).join('')}<button type="button" class="btn secondary" data-action="creator-add" ${m.characters.length >= 8 ? 'disabled' : ''}>${icon('plus')}Thêm nhân vật</button><h3 class="creator-section-title">Cách kể và mô phỏng</h3>${creatorField('voice', 'Giọng kể', m.voice, { multiline: true })}${creatorField('guidance', 'Chỉ dẫn cho Người kể', m.guidance, { multiline: true })}<label class="field"><span>Số từ mỗi cảnh</span><input class="input" name="words" type="number" min="200" max="2000" value="${m.words}" required></label>${configInputs(creator.config)}<div id="dialog-error"></div></form>`, `<small>Bí mật chỉ được lưu cho nhân vật sở hữu. Cảm xúc ban đầu có thể đổi qua từng lượt.</small><button type="submit" form="custom-form" class="btn primary">${icon('play')}Mở sân khấu</button>`);
}
function openPresetNew(presetId = 'rain-case') {
  const preset = state.presets.find(p => p.id === presetId) || state.presets[0];
  const { id, ...editable } = structuredClone(preset);
  const config = creator.config;
  showDialog('Dàn dựng một câu chuyện', `${creatorTabs()}<form id="new-form"><label class="field"><span>Chọn tình huống khởi đầu</span><select name="preset_id" id="new-preset">${state.presets.map(p => `<option value="${esc(p.id)}" ${preset.id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label><label class="field"><span>Tên truyện của bạn</span><input class="input" name="name" value="${esc(preset.name)}" maxlength="120" required></label>${configInputs(config)}<details><summary>Chỉnh thế giới, nhân vật và giọng kể bằng JSON</summary><p>Đây là toàn bộ dàn dựng. Bạn có thể thay tình huống, tên và hồ sơ nhân vật, mục tiêu, bí mật, cảm xúc, sự thật với known_by và phong cách kể. Giữ cấu trúc và ID nhất quán.</p><textarea class="preset-json" name="preset_json" aria-label="JSON dàn dựng">${esc(JSON.stringify(editable, null, 2))}</textarea></details><div id="dialog-error"></div></form>`, `<small>Chưa tạo prompt hay gửi dữ liệu tới ChatGPT.</small><button type="submit" form="new-form" class="btn primary">${icon('play')}Mở sân khấu</button>`);
}
async function openSetup() {
  const p = state.project;
  if (p.revision > 0 || p.exchanges.length) {
    showDialog('Dàn dựng đang sử dụng', `<div class="plain-text">Chế độ: ${p.config.mode === 'batch' ? 'Gộp lượt' : 'Tách nhân vật'}\nSố cảnh tối đa: ${p.config.max_scenes}\nSố lượt/cảnh: ${p.config.max_turns}\nSố lượt gộp: ${p.config.batch_size}\nKý ức gửi mỗi nhân vật: ${p.config.memory_limit}</div><div class="info-note">${icon('info')}<span>Dàn dựng đã bắt đầu nên cấu hình được giữ để bảo toàn tiến trình. Tải preset để tạo truyện mới với những điều chỉnh của bạn.</span></div>`, `<a class="btn secondary" href="/api/projects/${p.id}/export?format=preset">${icon('download')}Tải preset hiện tại</a><button class="btn primary" data-action="close">Đã hiểu</button>`);
    return;
  }
  const response = await fetch(`/api/projects/${p.id}/export?format=preset`);
  if (!response.ok) throw new Error('Không tải được dàn dựng.');
  const preset = await response.json();
  showDialog('Chỉnh dàn dựng', `<form id="setup-form"><label class="field"><span>Tên truyện</span><input class="input" name="name" value="${esc(p.name)}" maxlength="120" required></label>${configInputs(p.config)}<details><summary>Thế giới, nhân vật và giọng kể</summary><textarea class="preset-json" name="preset_json" aria-label="JSON dàn dựng">${esc(JSON.stringify(preset, null, 2))}</textarea></details><div id="dialog-error"></div></form>`, `<small>Có thể chỉnh trước prompt đầu tiên.</small><button type="submit" form="setup-form" class="btn primary">${icon('check')}Lưu dàn dựng</button>`);
}
function openCharacter(id) {
  const c = state.project.characters.find(c => c.id === id);
  const facts = state.project.world.facts.filter(f => f.known_by.includes(c.id));
  const section = (title, content) => `<div class="character-section"><h3>${title}</h3>${content}</div>`;
  showDialog(`${c.name} · Hồ sơ riêng`, `${section('Cảm xúc hiện tại', moodBars(c))}${section('Câu chuyện nền', `<p>${esc(c.background)}</p>`)}${section('Giới hạn', `<p>${esc(c.limitations.join('\n') || 'Không có giới hạn đặc biệt; vẫn tuân thủ quy tắc thế giới.')}</p>`)}${section('Niềm tin chủ quan', c.beliefs.length ? c.beliefs.map(b => `<p>${esc(b.text)} <small>(${b.confidence}% tin tưởng)</small></p>`).join('') : '<p>Chưa ghi nhận niềm tin mới.</p>')}${section('Những sự thật đã biết', `<ul>${facts.map(f => `<li>${esc(f.text)}</li>`).join('')}</ul>`)}${section(`Dòng ký ức · ${c.memories.length} bản ghi`, c.memories.slice(-24).reverse().map(m => `<div class="memory-row"><small>${m.type === 'summary' ? 'Tóm tắt' : m.type === 'observation' ? 'Quan sát' : m.type === 'reflection' ? 'Nội tâm' : 'Câu chuyện nền'} · Cảnh ${m.scene_number} · mức quan trọng ${m.importance}/10</small>${esc(m.text)}</div>`).join(''))}`, `<small>Đang hiển thị tối đa 24 ký ức gần nhất. Log xuất chứa toàn bộ.</small><button class="btn primary" data-action="close">Đóng hồ sơ</button>`);
}
function openExport() {
  const p = state.project;
  showDialog('Xuất câu chuyện', `<p class="plain-text">Bản thảo chứa các cảnh đã được Người kể chuyện viết. Log chứa toàn bộ hồ sơ nhân vật, ký ức riêng, sự thật, prompt và câu trả lời.</p><div class="modal-actions" style="margin-top:23px"><a class="btn primary" href="/api/projects/${p.id}/export?format=markdown">${icon('book')}Bản thảo Markdown</a><a class="btn secondary" href="/api/projects/${p.id}/export?format=json">${icon('download')}Toàn bộ log JSON</a><a class="btn secondary" href="/api/projects/${p.id}/export?format=preset">${icon('settings')}Preset hiện tại</a></div>`);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Đã sao chép.'); }
  catch { showDialog('Sao chép văn bản', `<p class="text-helper">Trình duyệt chưa cho phép sao chép tự động. Chọn văn bản và dùng ⌘C hoặc Ctrl+C.</p><textarea class="preset-json" id="copy-fallback" readonly>${esc(text)}</textarea>`); $('#copy-fallback').select(); }
}
async function next() {
  if (!state.job) state.job = await api(`/projects/${state.project.id}/jobs`, { method: 'POST', body: { guidance: $('#guidance')?.value || '' } });
  state.raw = localStorage.getItem(`draft:${state.job.id}`) || '';
  state.project.pending_job_id = state.job.id;
  if (!state.project.exchanges.some(j => j.id === state.job.id)) state.project.exchanges.push(state.job);
  state.view = 'exchange'; state.preview = null; state.error = null;
  render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function openAgent() {
  const task = await api(`/projects/${state.project.id}/agent/task`);
  showDialog('Viết hết bằng AI Agent', `<p class="plain-text">Sao chép yêu cầu dưới đây vào Codex hoặc Agent có quyền đọc file và chạy lệnh trong dự án này. Agent sẽ tự mô phỏng, viết các cảnh còn lại và lưu DB; bạn không cần dán từng output.</p><div class="info-note">${icon('info')}<span>Đã viết ${task.completed_scenes}/${task.max_scenes} cảnh. Web và DB cần đang chạy trên cùng máy Agent có thể truy cập. Skill chạy trong phiên Agent đang hoạt động.</span></div><label class="field" style="margin-top:20px"><span>Yêu cầu giao cho Agent</span><textarea id="agent-task" aria-label="Yêu cầu giao cho Agent" class="prompt-text" rows="10" readonly>${esc(task.task)}</textarea></label>`, '<small>Không cần API key. Tiến độ được lưu sau mỗi bước hợp lệ.</small><button class="btn secondary" data-action="agent-refresh">Cập nhật tiến độ</button><button class="btn primary" data-action="copy-agent-task">Sao chép yêu cầu cho Agent</button>');
}

document.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  try {
    target.disabled = true;
    if (manuscriptUI.handlesAction(action)) { await manuscriptUI.action(action, target); return; }
    switch (action) {
      case 'menu': $('.sidebar').classList.toggle('open'); break;
      case 'close': $('#dialog').close(); break;
      case 'new': openNew(target.dataset.preset); break;
      case 'creator-mode': captureCreator(); creator.mode = target.dataset.mode; renderCreator(); break;
      case 'creator-add': captureCreator(); if (creator.manual.characters.length < 8) creator.manual.characters.push(blankCharacter()); renderCreator(); break;
      case 'creator-remove': captureCreator(); if (creator.manual.characters.length > 2) creator.manual.characters.splice(Number(target.dataset.index), 1); renderCreator(); break;
      case 'creator-copy': await copy(creator.prompt); break;
      case 'creator-preview': {
        captureCreator();
        const draft = creator, raw = creator.raw;
        try {
          const preview = await api('/setup/preview', { method: 'POST', body: { raw } });
          if (creator !== draft || creator.raw !== raw) { toast('Bản dán đã đổi. Kiểm tra lại dàn dựng mới.'); break; }
          creator.preview = preview; creator.reviewedRaw = raw; creator.error = null;
        }
        catch (e) { if (creator !== draft || creator.raw !== raw) break; creator.error = e; creator.preview = null; creator.reviewedRaw = null; }
        renderCreator();
        $('#dialog-error').scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      case 'creator-repair':
        captureCreator();
        await copy(`Sửa dàn dựng sau theo mẫu trong prompt gốc. Giữ ý tưởng, nhân vật và bí mật; chỉ sửa định dạng và tham chiếu bị lỗi. Trả một JSON đầy đủ, không dấu ba chấm.\n\nLỖI\n${creator.error?.message || 'Kiểm tra tên trường, kiểu dữ liệu và ID.'}\n${JSON.stringify(creator.error?.details || [])}\n\nPROMPT GỐC\n${creator.prompt}\n\nDÀN DỰNG CẦN SỬA\n${creator.raw}`);
        break;
      case 'creator-create': {
        captureCreator();
        if (!creator.preview || creator.raw !== creator.reviewedRaw) throw new Error('Kiểm tra lại dàn dựng trước khi tạo truyện.');
        try {
          const p = await api('/projects', { method: 'POST', body: { preset: creator.preview.preset, config: creator.config } });
          $('#dialog').close(); await loadProject(p.id, true); toast('Truyện riêng đã được tạo.');
        } catch (e) { $('#dialog-error').innerHTML = renderError(e); }
        break;
      }
      case 'setup': await openSetup(); break;
      case 'case-setup': showDialog('Chuẩn bị hồ sơ bằng ChatGPT', '<form id="case-form"><p class="plain-text">Một prompt đầu truyện để tạo sự thật quá khứ, dòng thời gian và manh mối. Sau khi nhập, hồ sơ sẽ được giữ cố định trong mô phỏng.</p><label class="field" style="margin-top:20px"><span>Ý tưởng vụ án</span><textarea name="guidance" maxlength="4000" placeholder="Ví dụ: một biên bản bị sửa; nhân chứng có động cơ che giấu; kết cục để mở."></textarea></label><div id="dialog-error"></div></form>', '<small>Chỉ tạo prompt, bạn sẽ xem và duyệt JSON trước khi lưu hồ sơ.</small><button class="btn primary" type="submit" form="case-form">Tạo prompt hồ sơ</button>'); break;
      case 'project': await loadProject(target.dataset.id, true); break;
      case 'nav': state.view = target.dataset.view; if (state.view === 'research' && !state.research) state.research = await api('/research'); render(); break;
      case 'next': await next(); break;
      case 'agent': await openAgent(); break;
      case 'copy-agent-task': await copy($('#agent-task').value); break;
      case 'agent-refresh': $('#dialog').close(); await loadProject(state.project.id, true); toast('Đã cập nhật tiến độ từ DB.'); break;
      case 'character': openCharacter(target.dataset.id); break;
      case 'chapter': state.chapter = Number(target.dataset.number); render(); break;
      case 'export': openExport(); break;
      case 'download-story': location.href = `/api/projects/${state.project.id}/export?format=markdown`; break;
      case 'copy-prompt': await copy(state.job.prompt); break;
      case 'copy-normalized': await copy(JSON.stringify(state.preview.normalized_response, null, 2)); break;
      case 'preview': {
        const jobId = state.job.id, projectId = state.project.id, raw = state.raw;
        try {
          const preview = await api(`/projects/${projectId}/jobs/${jobId}/preview`, { method: 'POST', body: { raw } });
          if (state.job?.id !== jobId || state.raw !== raw) { toast('Bản dán đã đổi. Kiểm tra lại câu trả lời mới.'); break; }
          state.preview = preview; state.reviewedRaw = raw; state.error = null;
        }
        catch (e) { if (state.job?.id !== jobId || state.raw !== raw) break; state.error = e; state.preview = null; state.reviewedRaw = null; }
        if ($('#response-error')) $('#response-error').innerHTML = renderError(state.error);
        if ($('#response-preview')) $('#response-preview').innerHTML = renderPreview();
        if (state.preview) $('#response-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'commit': {
        if (!state.preview || state.raw !== state.reviewedRaw) throw new Error('Hãy kiểm tra lại JSON trước khi nhập.');
        const oldJobId = state.job.id;
        await api(`/projects/${state.project.id}/jobs/${oldJobId}/commit`, { method: 'POST', body: { raw: state.raw } });
        localStorage.removeItem(`draft:${oldJobId}`);
        await loadProject(state.project.id, true);
        toast('Đã lưu kết quả. Sân khấu đã cập nhật.');
        break;
      }
      case 'discard-preview': state.preview = null; state.reviewedRaw = null; $('#response-preview').innerHTML = ''; $('#raw-response').focus(); break;
      case 'cancel-job': showDialog('Hủy prompt đang chờ?', '<p class="plain-text">Prompt này sẽ không còn nhận câu trả lời. Diễn biến đã nhập và ký ức của nhân vật vẫn được giữ. Bạn có thể tạo prompt khác cho cùng bước.</p>', '<button class="btn secondary" data-action="close">Giữ prompt</button><button class="btn danger" data-action="confirm-cancel">Hủy prompt này</button>'); break;
      case 'confirm-cancel': await api(`/projects/${state.project.id}/jobs/${state.job.id}/cancel`, { method: 'POST', body: {} }); $('#dialog').close(); await loadProject(state.project.id); toast('Đã hủy prompt.'); break;
      case 'repair': {
        const errors = state.error ? `${state.error.message}\n${JSON.stringify(state.error.details || [])}` : 'Kiểm tra cấu trúc JSON và giữ nguyên ID, revision, kind.';
        const rules = 'Với thread_updates, evidence_fact_ids phải có known_by chứa actor_id tại cuối lượt tương ứng. Bỏ căn cứ không phù hợp; không tự mở quyền biết hoặc thêm reveals không có nguồn. Giữ sự kiện và lời thoại.' + (!state.project.casefile ? ' Dự án chưa có hồ sơ vụ án: clue_discoveries và interpretation_updates cần [], kể cả trong world_event. Giữ quan sát đã xảy ra trong new_facts; không tự tạo clue_id.' : '');
        await copy(`Sửa câu trả lời sau để khớp hợp đồng gốc. Chỉ sửa cấu trúc/ID/căn cứ lỗi, không tạo lượt mới hay đổi diễn biến để lách kiểm tra. Giữ nguyên exchange_id, revision, scene_number, kind trong prompt. Chỉ trả một JSON đầy đủ.\n${rules}\n\nLỖI\n${errors}\n\nPROMPT GỐC\n${state.job.prompt}\n\nCÂU TRẢ LỜI CẦN SỬA\n${state.raw}`);
        break;
      }
      case 'history-detail': {
        const j = state.project.exchanges.find(x => x.id === target.dataset.id);
        showDialog(`${kinds[j.kind]} · Cảnh ${j.scene_number}`, `<h3>Prompt đã gửi</h3><pre class="large-json">${esc(j.prompt)}</pre>${j.raw_response ? `<h3 style="margin-top:22px">Câu trả lời đã nhập</h3><pre class="large-json">${esc(j.raw_response)}</pre><h3>JSON đã lưu sau kiểm tra</h3><pre class="large-json">${esc(JSON.stringify(j.response, null, 2))}</pre>${j.import_notes?.length ? `<ul>${j.import_notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}` : ''}`);
        break;
      }
    }
  } catch (e) { toast(e.message); }
  finally { target.disabled = false; }
});

document.addEventListener('input', event => {
  manuscriptUI.input(event);
  if (event.target.id === 'raw-response') {
    state.raw = event.target.value; state.preview = null; state.reviewedRaw = null;
    localStorage.setItem(`draft:${state.job.id}`, state.raw);
    $('#response-preview').innerHTML = '';
  }
  if (event.target.id === 'setup-response') {
    creator.raw = event.target.value; creator.preview = null; creator.reviewedRaw = null;
    $('[data-action="creator-create"]')?.remove(); $('#setup-review')?.remove();
  }
  const form = event.target.closest('#new-form, #setup-form, #custom-form, #ai-brief-form');
  if (form) $('#budget-count').innerHTML = `${budget(readConfig(form))} <span>lần trao đổi / cảnh</span>`;
});
document.addEventListener('change', event => {
  manuscriptUI.change(event);
  if (event.target.id === 'scene-select') { state.sceneNumber = Number(event.target.value); render(); }
  if (event.target.id === 'new-preset') {
    const form = $('#new-form'), preset = state.presets.find(p => p.id === event.target.value);
    const { id, ...editable } = structuredClone(preset);
    form.elements.name.value = preset.name; form.elements.preset_json.value = JSON.stringify(editable, null, 2);
    form.elements.max_scenes.value = preset.casefile ? 8 : 6;
  }
  const form = event.target.closest('#new-form, #setup-form, #custom-form, #ai-brief-form');
  if (form) $('#budget-count').innerHTML = `${budget(readConfig(form))} <span>lần trao đổi / cảnh</span>`;
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if (manuscriptUI.isForm(form.id)) { event.preventDefault(); await manuscriptUI.submit(form, event.submitter); return; }
  if (['custom-form', 'ai-brief-form'].includes(form.id)) {
    event.preventDefault();
    const submit = event.submitter;
    try {
      submit.disabled = true; captureCreator();
      if (form.id === 'ai-brief-form') {
        const result = await api('/setup/prompt', { method: 'POST', body: creator.brief });
        creator.prompt = result.prompt; creator.preview = null; creator.reviewedRaw = null; creator.error = null;
        renderCreator(); $('#setup-response').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const p = await api('/projects', { method: 'POST', body: { custom: creator.manual, config: creator.config } });
        $('#dialog').close(); await loadProject(p.id, true); toast('Truyện riêng đã được tạo.');
      }
    } catch (e) { $('#dialog-error').innerHTML = renderError(e); }
    finally { submit.disabled = false; }
    return;
  }
  if (form.id === 'case-form') {
    event.preventDefault();
    try {
      event.submitter.disabled = true;
      await api(`/projects/${state.project.id}/case/jobs`, { method: 'POST', body: { guidance: form.elements.guidance.value } });
      $('#dialog').close(); await loadProject(state.project.id); state.view = 'exchange'; render();
    } catch (e) { $('#dialog-error').innerHTML = renderError(e); }
    finally { event.submitter.disabled = false; }
    return;
  }
  if (!['new-form', 'setup-form'].includes(form.id)) return;
  event.preventDefault();
  const submit = event.submitter;
  try {
    submit.disabled = true;
    let preset;
    try { preset = JSON.parse(form.elements.preset_json.value); } catch { throw new Error('JSON dàn dựng chưa hợp lệ. Kiểm tra dấu phẩy, ngoặc và dấu nháy.'); }
    const body = { name: form.elements.name.value, preset, config: readConfig(form) };
    const p = await api(form.id === 'new-form' ? '/projects' : `/projects/${state.project.id}/setup`, { method: form.id === 'new-form' ? 'POST' : 'PATCH', body });
    $('#dialog').close(); await loadProject(p.id, true); toast('Sân khấu đã sẵn sàng.');
  } catch (e) { $('#dialog-error').innerHTML = renderError(e); }
  finally { submit.disabled = false; }
});

async function init() {
  try {
    const results = await Promise.allSettled([api('/health'), api('/presets'), api('/projects')]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;
    state.storage = results[0].value.storage; state.presets = results[1].value; state.projects = results[2].value;
    const last = localStorage.getItem('selectedProject');
    const project = state.projects.find(p => p.id === last) || state.projects[0];
    if (project) await loadProject(project.id); else render();
  } catch (e) { $('#app').innerHTML = `<div class="content"><h1>Chưa mở được sân khấu</h1>${renderError(e)}<button class="btn primary" style="margin-top:20px" data-action="reload">Thử lại</button></div>`; $('[data-action="reload"]').addEventListener('click', () => location.reload()); }
}
await init();
