const $ = (q, root = document) => root.querySelector(q);
const countWords = text => String(text || '').trim().split(/\s+/u).filter(Boolean).length;
const sources = { narration: 'Người kể', manual: 'Sửa trực tiếp', rewrite: 'ChatGPT viết lại', restore: 'Khôi phục', legacy: 'Bản cũ' };
const threadKinds = { goal: 'Mục tiêu', conflict: 'Mâu thuẫn', promise: 'Lời hứa', question: 'Nghi vấn', relationship: 'Quan hệ' };
const threadStatuses = { open: 'Đang mở', resolved: 'Đã giải quyết', abandoned: 'Đã từ bỏ' };

export function diffParagraphs(before, after) {
  const a = before.split(/\n\s*\n/u), b = after.split(/\n\s*\n/u);
  if (a.length * b.length > 250000) return [...a.map(text => ({ type: 'removed', text })), ...b.map(text => ({ type: 'added', text }))];
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const result = []; let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { result.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (i < a.length && (j >= b.length || table[i + 1][j] >= table[i][j + 1])) result.push({ type: 'removed', text: a[i++] });
    else result.push({ type: 'added', text: b[j++] });
  }
  return result;
}

export function createManuscriptUI(ctx) {
  const { state, api, esc, icon, badge, heading, showDialog, toast, renderError, copy } = ctx;
  let editing = null, versionDialog = null, rewrite = null, chapterDraft = null, writingRevision = null;
  let threadFilter = 'open';
  const sceneOf = number => state.project.scenes.find(s => s.number === Number(number));
  const selected = () => state.project.scenes.find(s => s.number === state.chapter && s.prose) || state.project.scenes.filter(s => s.prose).at(-1);
  const name = id => state.project.characters.find(c => c.id === id)?.name || id;
  const errorAtDialog = e => { if ($('#dialog-error')) $('#dialog-error').innerHTML = renderError(e); else toast(e.message); };
  async function refresh(number) { await ctx.loadProject(state.project.id); if (number) { state.chapter = Number(number); state.view = 'manuscript'; ctx.render(); } }
  function renderDiff(before, after) {
    return `<p class="text-helper">${countWords(before)} → ${countWords(after)} từ · Đỏ: đoạn bỏ/thay. Xanh: đoạn thêm/thay.</p><div class="version-diff">${diffParagraphs(before, after).map(d => `<div class="diff-block ${d.type}"><small>${d.type === 'added' ? 'Thêm' : d.type === 'removed' ? 'Bỏ' : 'Giữ'}</small><p>${esc(d.text)}</p></div>`).join('')}</div>`;
  }
  function renderQuality(notes = []) { return notes.length ? `<div class="quality-note"><strong>Đọc duyệt chất liệu</strong><ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''; }
  function renderThreadChanges(threads = []) { return threads.length ? `<div class="quality-note"><strong>Mạch truyện sẽ cập nhật</strong>${threads.map(t => `<p>${esc(t.title)} · ${threadStatuses[t.status]}<br><small>${esc(t.history.at(-1).excerpt)}</small></p>`).join('')}</div>` : ''; }
  function renderManuscript() {
    const scene = selected(), chapters = state.project.chapters || [];
    const actions = `<button class="btn secondary" data-action="edit-writing">${icon('settings')}Độ dài & cách kể</button>${scene ? '<button class="btn secondary" data-action="edit-chapters">Chia chương</button>' : ''}<button class="btn secondary" data-action="download-story">${icon('download')}Tải Markdown</button>`;
    const intro = heading('Bản thảo', 'Đọc theo chương, biên tập từng cảnh và giữ lại các phiên bản.', actions, state.project.name);
    if (!scene) return `${intro}<section class="panel page-empty"><h2>Người kể đang chờ sự kiện.</h2><p>Mô phỏng một cảnh, rồi nhập bản thảo Người kể. Truyện mới mặc định gộp 6 lượt và viết khoảng 1.500 từ mỗi cảnh.</p><button class="btn primary" data-action="nav" data-view="stage">Trở về sân khấu</button></section>`;
    const version = scene.versions.find(v => v.id === scene.current_version_id);
    return `${intro}${state.project.pending_rewrite_job_id ? '<div class="rewrite-pending"><span>Đang có prompt viết lại chờ bạn dán.</span><button class="btn secondary small" data-action="edit-open-rewrite">Mở prompt viết lại</button></div>' : ''}<div class="manuscript-layout"><nav class="chapter-menu" aria-label="Các cảnh bản thảo">${chapters.map(c => `<div class="chapter-group"><h3>${esc(c.title)}</h3>${c.scene_numbers.map(n => sceneOf(n)).filter(s => s?.prose).map(s => `<button class="${s.number === scene.number ? 'active' : ''}" data-action="chapter" data-number="${s.number}">Cảnh ${s.number}<small>${esc(s.title)}</small></button>`).join('')}</div>`).join('')}</nav><article class="manuscript"><p class="eyebrow">${esc(chapters.find(c => c.scene_numbers.includes(scene.number))?.title || '')} · Cảnh ${scene.number}</p><h2>${esc(scene.title)}</h2><p class="pov-note">Góc nhìn: ${esc(name(scene.pov_id))} · ${esc(scene.location)} · ${countWords(scene.prose)} từ · Bản ${version?.number || 1}</p><div class="manuscript-tools"><button class="btn secondary small" data-action="edit-scene" data-number="${scene.number}">Sửa văn xuôi</button><button class="btn secondary small" data-action="edit-rewrite" data-number="${scene.number}">Nhờ ChatGPT viết lại</button><button class="btn secondary small" data-action="edit-versions" data-number="${scene.number}">Phiên bản & so sánh (${scene.versions.length})</button><button class="btn ghost small" data-action="edit-fork" data-number="${scene.number}" ${!scene.checkpoint ? 'disabled title="Cảnh cũ chưa có mốc trước mô phỏng"' : ''}>Tạo nhánh trước cảnh</button></div><div class="prose">${esc(scene.prose)}</div>${scene.continuity_review ? `<div class="editorial-note">Người kể đã tự rà dòng thời gian, tính cách và đoạn lặp.${scene.continuity_review.notes.length ? `<p>${scene.continuity_review.notes.map(esc).join('; ')}</p>` : ''}</div>` : ''}${scene.editorial_check ? `<div class="editorial-note">Nguồn trích đoạn đã được kiểm tra. Nội dung được ${scene.editorial_check.semantic_check === 'human_review' ? 'người biên tập xác nhận' : 'Người kể tự đánh giá'}; đọc duyệt để kiểm tra ý nghĩa và tính hợp lý.</div>` : ''}</article></div>`;
  }
  function renderThreads() {
    const threads = (state.project.threads || []).filter(t => threadFilter === 'all' || t.status === threadFilter);
    return `${heading('Mạch truyện', 'Theo dõi mục tiêu, lời hứa và xung đột từ những tương tác đã xảy ra.', badge('Góc nhìn người dàn dựng'), 'Phase 3')}<div class="thread-toolbar"><label>Hiển thị <select id="thread-filter" aria-label="Lọc mạch truyện">${[['open', 'Đang mở'], ['resolved', 'Đã giải quyết'], ['abandoned', 'Đã từ bỏ'], ['all', 'Tất cả']].map(([v, label]) => `<option value="${v}" ${v === threadFilter ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button class="btn secondary" data-action="edit-writing">Độ dài & cách kể</button></div><div class="threads-grid">${threads.map(t => `<section class="panel thread-card"><div class="panel-body"><div class="button-row">${badge(threadKinds[t.kind])}${badge(threadStatuses[t.status], t.status === 'open' ? 'amber' : 'gray')}</div><h2>${esc(t.title)}</h2><p>${t.character_ids.map(id => esc(name(id))).join(', ')}</p><small>Người biết: ${t.known_by.map(id => esc(name(id))).join(', ')}</small><details><summary>Nguồn và thay đổi · ${t.history.length}</summary>${t.history.map(h => `<blockquote>${esc(h.excerpt)}<small>${h.scene_number ? `Cảnh ${h.scene_number} · ${esc(h.turn_id)}` : 'Mục tiêu riêng từ hồ sơ'} · ${threadStatuses[h.status]}</small></blockquote>`).join('')}</details></div></section>`).join('') || '<section class="panel page-empty"><p>Chưa có mạch ở trạng thái này.</p></section>'}</div>`;
  }
  function openWriting() {
    writingRevision = state.project.manuscript_revision;
    const p = state.project;
    showDialog('Độ dài & cách kể', `<form id="writing-form"><p class="creator-intro">Thiết lập áp dụng cho prompt mới. Prompt đang chờ giữ nguyên nội dung và số lượt đã yêu cầu.</p><div class="creator-pair"><label class="field"><span>Số từ mỗi cảnh</span><input class="input" name="words" type="number" min="200" max="2000" value="${p.style.words}" required></label><label class="field"><span>Lượt gộp mỗi prompt</span><select name="batch_size">${[1,2,3,4,5,6].map(n => `<option value="${n}" ${n === p.config.batch_size ? 'selected' : ''}>${n} lượt</option>`).join('')}</select></label></div><label class="field"><span>Giọng kể</span><textarea name="voice" required maxlength="12000">${esc(p.style.voice)}</textarea></label><label class="field"><span>Chỉ dẫn Người kể</span><textarea name="guidance" required maxlength="12000">${esc(p.style.guidance)}</textarea></label><p class="text-helper">Với 6 lượt/cảnh, gộp 6 lượt thường cần một prompt mô phỏng và một prompt Người kể. Chọn 3 lượt nếu câu trả lời thường bị cắt dở.</p><div id="dialog-error"></div></form>`, '<button class="btn primary" type="submit" form="writing-form">Lưu cách kể</button>');
  }
  function openEditor(number) {
    const scene = sceneOf(number);
    editing = { project_id: state.project.id, number: scene.number, base_version_id: scene.current_version_id, reader_updates: structuredClone(scene.reader_updates), prose: scene.prose };
    const quotes = scene.reader_updates ? Object.entries(scene.reader_updates).flatMap(([key, entries]) => entries.map((e, i) => `<label class="field"><span>Trích đoạn ${esc(e.fact_id || e.clue_id || e.question_id)}${key === 'interpretations' ? ` · ${esc(e.text)}` : ''}</span><textarea name="quote_${key}_${i}" maxlength="2000" required>${esc(e.excerpt)}</textarea></label>`)).join('') : '';
    showDialog(`Biên tập cảnh ${number}`, `<form id="manuscript-form"><label class="field"><span>Văn xuôi của cảnh</span><textarea class="manuscript-editor" name="prose" required maxlength="80000">${esc(scene.prose)}</textarea></label><label class="field"><span>Tóm tắt biên tập</span><textarea name="summary" required maxlength="4000">${esc(scene.summary)}</textarea></label>${quotes ? `<details class="edit-evidence" open><summary>Trích đoạn nguồn tiết lộ</summary><p class="text-helper">Giữ thông tin đã kể; sửa trích đoạn để khớp câu chữ mới trong văn xuôi.</p>${quotes}</details>` : ''}<label class="review-confirm"><input name="confirmed" type="checkbox" required> Tôi đã đọc lại, giữ sự kiện, POV và nguồn tiết lộ của cảnh.</label><button class="btn secondary small" type="button" data-action="edit-preview-diff">Xem thay đổi trước khi lưu</button><div id="edit-diff"></div><div id="dialog-error"></div></form>`, '<small>Mỗi lần lưu tạo một phiên bản mới.</small><button class="btn primary" type="submit" form="manuscript-form">Lưu phiên bản mới</button>');
  }
  function openVersions(number) {
    const scene = sceneOf(number), versions = scene.versions;
    versionDialog = { number: scene.number, base_version_id: scene.current_version_id };
    const options = chosen => versions.map(v => `<option value="${esc(v.id)}" ${v.id === chosen ? 'selected' : ''}>Bản ${v.number} · ${sources[v.source] || v.source} · ${countWords(v.prose)} từ</option>`).join('');
    showDialog(`Phiên bản cảnh ${number}`, `<div class="creator-pair"><label class="field"><span>So sánh từ</span><select id="version-from">${options(versions[0].id)}</select></label><label class="field"><span>Đến phiên bản</span><select id="version-to">${options(scene.current_version_id)}</select></label></div><div id="version-comparison"></div><div id="dialog-error"></div>`, '<small>Khôi phục cũng được ghi thành một phiên bản mới.</small><button class="btn secondary" data-action="edit-restore">Dùng lại bản được chọn bên phải</button>');
    updateComparison();
  }
  function updateComparison() {
    const scene = sceneOf(versionDialog.number), from = scene.versions.find(v => v.id === $('#version-from').value), to = scene.versions.find(v => v.id === $('#version-to').value);
    $('#version-comparison').innerHTML = renderDiff(from.prose, to.prose);
    $('[data-action="edit-restore"]').disabled = to.id === scene.current_version_id;
  }
  function openChapters() {
    chapterDraft = { revision: state.project.manuscript_revision, chapters: structuredClone(state.project.chapters), assignments: Object.fromEntries(state.project.chapters.flatMap((c, i) => c.scene_numbers.map(n => [n, i]))) };
    renderChapters();
  }
  function captureChapters() {
    const form = $('#chapters-form');
    chapterDraft.chapters.forEach((c, i) => { c.title = form.elements[`title_${i}`].value; });
    for (const s of state.project.scenes.filter(s => s.prose)) chapterDraft.assignments[s.number] = Number(form.elements[`scene_${s.number}`].value);
  }
  function renderChapters() {
    showDialog('Chia cảnh thành chương', `<form id="chapters-form"><label class="field"><span>Số chương</span><input class="input" id="chapter-count" type="number" min="1" max="30" value="${chapterDraft.chapters.length}" required></label>${chapterDraft.chapters.map((c, i) => `<label class="field"><span>Tên chương ${i + 1}</span><input class="input" name="title_${i}" value="${esc(c.title)}" maxlength="200" required></label>`).join('')}<p class="text-helper">Mỗi cảnh thuộc một chương. Giữ thứ tự cảnh để dòng thời gian và nguồn tiết lộ liên tục.</p>${state.project.scenes.filter(s => s.prose).map(s => `<label class="field"><span>Chương của cảnh ${s.number} · ${esc(s.title)}</span><select name="scene_${s.number}">${chapterDraft.chapters.map((c, i) => `<option value="${i}" ${i === chapterDraft.assignments[s.number] ? 'selected' : ''}>Chương ${i + 1}</option>`).join('')}</select></label>`).join('')}<div id="dialog-error"></div></form>`, '<button class="btn primary" type="submit" form="chapters-form">Lưu các chương</button>');
  }
  function openRewrite(number) {
    const pending = state.project.exchanges.find(j => j.id === state.project.pending_rewrite_job_id);
    if (pending) { rewrite = { job: pending, raw: localStorage.getItem(`draft:${pending.id}`) || '', preview: null, reviewedRaw: null, error: null }; renderRewrite(); return; }
    const scene = sceneOf(number);
    editing = { number: scene.number, base_version_id: scene.current_version_id };
    showDialog(`Nhờ ChatGPT viết lại cảnh ${number}`, '<form id="rewrite-form"><label class="field"><span>Yêu cầu viết lại</span><textarea name="guidance" maxlength="4000" placeholder="Ví dụ: tăng nhịp đối thoại, tiết chế lời giải thích, giữ sự do dự của POV."></textarea></label><p class="text-helper">Prompt dùng nguồn của cảnh này, giữ sự kiện, POV và những thông tin đã tiết lộ.</p><div id="dialog-error"></div></form>', '<button class="btn primary" type="submit" form="rewrite-form">Tạo prompt viết lại</button>');
  }
  function renderRewrite() {
    const r = rewrite, v = r.preview;
    showDialog(`Viết lại cảnh ${r.job.scene_number} · copy/paste`, `<section class="creator-step"><h3>1. Prompt gửi ChatGPT</h3><textarea class="prompt-text" aria-label="Prompt viết lại gửi ChatGPT" readonly>${esc(r.job.prompt)}</textarea><button class="btn secondary" data-action="edit-copy-rewrite">Sao chép prompt viết lại</button><a class="btn secondary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Mở ChatGPT</a></section><section class="creator-step"><h3>2. Dán bản viết lại</h3><textarea class="prompt-text" id="rewrite-response" aria-label="Câu trả lời viết lại">${esc(r.raw)}</textarea><button class="btn primary" data-action="edit-preview-rewrite">Kiểm tra bản viết lại</button><button class="btn secondary" data-action="edit-repair-rewrite">Prompt sửa bản viết lại</button><div id="dialog-error">${renderError(r.error)}</div></section>${v ? `<section class="creator-step" id="rewrite-review"><h3>3. Đọc thay đổi trước khi nhập</h3>${renderQuality(v.quality_notes)}${v.import_notes.length ? `<ul>${v.import_notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}${renderDiff(sceneOf(r.job.scene_number).prose, v.response.prose)}<details><summary>JSON sẽ được lưu</summary><pre class="large-json">${esc(JSON.stringify(v.response, null, 2))}</pre></details></section>` : ''}`, `<button class="btn ghost" data-action="edit-cancel-rewrite">Hủy prompt viết lại</button>${v ? '<button class="btn primary" data-action="edit-commit-rewrite">Nhập bản viết lại</button>' : ''}`);
  }
  function openFork(number) {
    editing = { number: Number(number) };
    showDialog(`Tạo nhánh trước cảnh ${number}`, `<form id="fork-form"><p class="creator-intro">Nhánh bắt đầu lại từ trạng thái trước cảnh ${number}, giữ các cảnh trước đó và ký ức tại mốc ấy. Bạn có thể cho nhân vật thử lựa chọn khác trên nhánh mới.</p><label class="field"><span>Tên nhánh truyện</span><input class="input" name="name" value="${esc(state.project.name.slice(0, 90))} · Nhánh cảnh ${number}" maxlength="120" required></label><div id="dialog-error"></div></form>`, '<button class="btn primary" type="submit" form="fork-form">Tạo nhánh truyện</button>');
  }
  async function action(action, target) {
    try {
      const number = Number(target.dataset.number);
      if (action === 'edit-writing') openWriting();
      if (action === 'edit-scene') openEditor(number);
      if (action === 'edit-versions') openVersions(number);
      if (action === 'edit-preview-diff') $('#edit-diff').innerHTML = renderDiff(editing.prose, $('#manuscript-form').elements.prose.value);
      if (action === 'edit-chapters') openChapters();
      if (action === 'edit-rewrite' || action === 'edit-open-rewrite') openRewrite(number || selected().number);
      if (action === 'edit-fork') openFork(number);
      if (action === 'edit-copy-rewrite') await copy(rewrite.job.prompt);
      if (action === 'edit-restore') {
        await api(`/projects/${state.project.id}/scenes/${versionDialog.number}/restore`, { method: 'POST', body: { base_version_id: versionDialog.base_version_id, version_id: $('#version-to').value } });
        $('#dialog').close(); await refresh(versionDialog.number); toast('Đã khôi phục thành một phiên bản mới.');
      }
      if (action === 'edit-preview-rewrite') {
        const current = rewrite, raw = rewrite.raw;
        try {
          const preview = await api(`/projects/${state.project.id}/jobs/${current.job.id}/preview`, { method: 'POST', body: { raw } });
          if (rewrite !== current || rewrite.raw !== raw) { toast('Bản dán đã đổi. Kiểm tra lại bản mới.'); return; }
          rewrite.preview = preview; rewrite.reviewedRaw = raw; rewrite.error = null;
        } catch (e) { if (rewrite !== current || rewrite.raw !== raw) return; rewrite.error = e; rewrite.preview = null; rewrite.reviewedRaw = null; }
        renderRewrite(); $('#dialog-error').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (action === 'edit-commit-rewrite') {
        if (!rewrite.preview || rewrite.raw !== rewrite.reviewedRaw) throw new Error('Kiểm tra lại bản viết trước khi nhập.');
        const number = rewrite.job.scene_number;
        await api(`/projects/${state.project.id}/jobs/${rewrite.job.id}/commit`, { method: 'POST', body: { raw: rewrite.raw } });
        localStorage.removeItem(`draft:${rewrite.job.id}`); $('#dialog').close(); await refresh(number); toast('Đã lưu phiên bản viết lại.');
      }
      if (action === 'edit-cancel-rewrite') {
        await api(`/projects/${state.project.id}/jobs/${rewrite.job.id}/cancel`, { method: 'POST', body: {} });
        $('#dialog').close(); await refresh(rewrite.job.scene_number); toast('Đã hủy prompt viết lại.');
      }
      if (action === 'edit-repair-rewrite') await copy(`Sửa bản viết lại theo mẫu gốc. Giữ sự kiện, POV, lượt nguồn và thông tin độc giả; excerpt cần khớp prose mới. Chỉ trả một JSON đầy đủ.\nLỖI\n${rewrite.error?.message || 'Kiểm tra cấu trúc và nguồn trích đoạn.'}\n${JSON.stringify(rewrite.error?.details || [])}\nPROMPT GỐC\n${rewrite.job.prompt}\nBẢN CẦN SỬA\n${rewrite.raw}`);
    } catch (e) { errorAtDialog(e); }
  }
  const forms = ['manuscript-form', 'writing-form', 'rewrite-form', 'chapters-form', 'fork-form'];
  async function submit(form, submitter) {
    try {
      submitter.disabled = true;
      if (form.id === 'manuscript-form') {
        const updates = structuredClone(editing.reader_updates);
        if (updates) for (const [key, entries] of Object.entries(updates)) entries.forEach((e, i) => { e.excerpt = form.elements[`quote_${key}_${i}`].value; });
        await api(`/projects/${editing.project_id}/scenes/${editing.number}/versions`, { method: 'POST', body: { base_version_id: editing.base_version_id, prose: form.elements.prose.value, summary: form.elements.summary.value, confirmed: form.elements.confirmed.checked, ...(updates ? { reader_updates: updates } : {}) } });
        $('#dialog').close(); await refresh(editing.number); toast('Đã lưu phiên bản mới.');
      }
      if (form.id === 'writing-form') {
        await api(`/projects/${state.project.id}/writing`, { method: 'PATCH', body: { manuscript_revision: writingRevision, words: Number(form.elements.words.value), batch_size: Number(form.elements.batch_size.value), voice: form.elements.voice.value, guidance: form.elements.guidance.value } });
        $('#dialog').close(); await refresh(); toast('Đã lưu thiết lập cho prompt mới.');
      }
      if (form.id === 'rewrite-form') {
        await api(`/projects/${state.project.id}/scenes/${editing.number}/rewrite`, { method: 'POST', body: { base_version_id: editing.base_version_id, guidance: form.elements.guidance.value } });
        await refresh(); openRewrite(editing.number);
      }
      if (form.id === 'chapters-form') {
        captureChapters();
        const chapters = chapterDraft.chapters.map((c, i) => ({ ...c, scene_numbers: state.project.scenes.filter(s => s.prose && chapterDraft.assignments[s.number] === i).map(s => s.number) }));
        await api(`/projects/${state.project.id}/chapters`, { method: 'PUT', body: { manuscript_revision: chapterDraft.revision, chapters } });
        $('#dialog').close(); await refresh(); toast('Đã lưu cách chia chương.');
      }
      if (form.id === 'fork-form') {
        const branch = await api(`/projects/${state.project.id}/scenes/${editing.number}/fork`, { method: 'POST', body: { name: form.elements.name.value } });
        $('#dialog').close(); await ctx.loadProject(branch.id, true); toast('Nhánh truyện đã sẵn sàng.');
      }
    } catch (e) { errorAtDialog(e); }
    finally { submitter.disabled = false; }
  }
  function input(event) {
    if (event.target.id === 'rewrite-response') {
      rewrite.raw = event.target.value; rewrite.preview = null; rewrite.reviewedRaw = null;
      localStorage.setItem(`draft:${rewrite.job.id}`, rewrite.raw); $('#rewrite-review')?.remove(); $('[data-action="edit-commit-rewrite"]')?.remove();
    }
    if (event.target.closest('#manuscript-form')) { if ($('#edit-diff')) $('#edit-diff').innerHTML = ''; }
  }
  function change(event) {
    if (['version-from', 'version-to'].includes(event.target.id)) updateComparison();
    if (event.target.id === 'thread-filter') { threadFilter = event.target.value; ctx.render(); }
    if (event.target.id === 'chapter-count') {
      const n = Number(event.target.value); if (!Number.isInteger(n) || n < 1 || n > 30) return;
      captureChapters(); chapterDraft.chapters = Array.from({ length: n }, (_, i) => chapterDraft.chapters[i] || { id: `ch_${crypto.randomUUID()}`, title: `Chương ${i + 1}`, scene_numbers: [] });
      for (const key of Object.keys(chapterDraft.assignments)) chapterDraft.assignments[key] = Math.min(chapterDraft.assignments[key], n - 1);
      renderChapters();
    }
  }
  return { renderManuscript, renderThreads, renderQuality, renderThreadChanges, action, submit, input, change, isForm: id => forms.includes(id), handlesAction: action => action.startsWith('edit-') };
}
