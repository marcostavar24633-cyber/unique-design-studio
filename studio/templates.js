// Библиотека шаблонов: анализ публичных страниц, редактируемый профиль, поиск, импорт и экспорт.
// Данные хранятся только в localStorage этого браузера. Сторонние сайты напрямую не запрашиваются:
// HTML приходит либо от анализатора-сервера (Cloudflare Worker, если пользователь его подключил),
// либо вставляется пользователем вручную.
import { analyzePage, buildProfile, stylesheetLinks } from '../src/engine/site-analysis.js';
import {
  CATEGORIES, LIBRARY_KEY, PROFILE_FIELDS, PROFILE_GROUPS, SECTION_IDS, SECTION_LABELS, duplicateTemplate, exportLibrary, filterLibrary,
  isProfileEmpty, mergeLibrary, normalizeLibrary, normalizeTemplate, paletteToText, parseLibraryImport, parsePalette,
} from '../src/engine/library.js';
import { ARCHETYPES, NAV_LABELS, SHAPES, TYPES } from '../src/engine/data.js';

const ENDPOINT_KEY = 'uds:analyzer-endpoint';
const MAX_PAGES = 9;
const MAX_STYLESHEETS = 6;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SNIPPET = "copy(document.documentElement.outerHTML+(()=>{let s=0;const c=[...document.styleSheets].map(x=>{try{return[...x.cssRules].map(r=>r.cssText).join('\\n')}catch(e){s++;return''}}).join('\\n');return'<style data-uds-collected data-uds-skipped=\"'+s+'\">'+c.replace(/<\\/style/gi,'')+'</style>'})())";

// ---------- Хранилище ----------
function readLibrary() {
  try { return normalizeLibrary(JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]')); } catch { return []; }
}
let items = readLibrary();
function persist() {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(items)); return true; }
  catch { toast('Не удалось сохранить: хранилище браузера переполнено или недоступно. Сделайте экспорт JSON.', true); return false; }
}
const getEndpoint = () => { try { return localStorage.getItem(ENDPOINT_KEY) || ''; } catch { return ''; } };

// ---------- Уведомления и диалоги ----------
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg; t.style.borderColor = isError ? 'var(--err)' : ''; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), isError ? 5200 : 2800);
}
function setStatus(msg, isError = false) { const s = $('#status'); s.textContent = msg; s.classList.toggle('is-error', isError); }
function confirmAction(title, text, yes) {
  return new Promise(resolve => {
    const d = $('#confirm');
    $('#confirm-title').textContent = title; $('#confirm-text').textContent = text; $('#confirm-yes').textContent = yes;
    const done = v => { d.close(); $('#confirm-yes').onclick = $('#confirm-no').onclick = d.oncancel = null; resolve(v); };
    $('#confirm-yes').onclick = () => done(true); $('#confirm-no').onclick = () => done(false);
    d.oncancel = e => { e.preventDefault(); done(false); };
    d.showModal(); $('#confirm-no').focus();
  });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-close]'); if (b) b.closest('dialog').close(); });
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Форма источника ----------
const options = (list, selected, first = '') => (first ? `<option value="">${esc(first)}</option>` : '') + list.map(c => `<option${c === selected ? ' selected' : ''}>${esc(c)}</option>`).join('');
$('#template-category').innerHTML = options(CATEGORIES, 'Универсальный');
$('#snippet').textContent = SNIPPET;

function validUrl(value) { try { const u = new URL(value.trim()); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
/** Читает форму. При ошибке показывает её и возвращает null. */
function readSource({ needName = true } = {}) {
  const url = validUrl($('#source-url').value);
  if (!url) { setStatus('Укажите корректный адрес сайта: он должен начинаться с http:// или https://', true); $('#source-url').focus(); return null; }
  const pages = [];
  for (const line of $('#page-urls').value.split(/\n+/).map(s => s.trim()).filter(Boolean)) {
    const u = validUrl(line);
    if (!u) { setStatus(`Проверьте дополнительный адрес: ${line}`, true); $('#page-urls').focus(); return null; }
    if (u !== url && !pages.includes(u)) pages.push(u);
  }
  if (pages.length > MAX_PAGES - 1) { setStatus(`Слишком много страниц: не больше ${MAX_PAGES - 1} дополнительных.`, true); return null; }
  const name = $('#template-name').value.trim();
  if (needName && !name) { setStatus('Укажите название проекта.', true); $('#template-name').focus(); return null; }
  return { url, pages, name, category: $('#template-category').value, notes: $('#template-notes').value.trim() };
}

const pasted = new Map(); // url → html, чтобы текст не терялся при изменении списка страниц
function currentUrls() {
  const main = validUrl($('#source-url').value);
  const extra = $('#page-urls').value.split(/\n+/).map(s => validUrl(s)).filter(Boolean);
  return [...new Set([main, ...extra].filter(Boolean))].slice(0, MAX_PAGES);
}
function renderHtmlInputs() {
  const urls = currentUrls();
  $('#html-inputs').innerHTML = urls.length
    ? urls.map((u, i) => `<div class="field"><label for="html-${i}">HTML страницы <span class="muted">${esc(u)}</span></label><textarea class="code" id="html-${i}" data-url="${esc(u)}" rows="4" spellcheck="false" placeholder="&lt;!doctype html&gt;…">${esc(pasted.get(u) || '')}</textarea></div>`).join('')
    : '<p class="notice">Сначала укажите адрес сайта — появятся поля для HTML каждой страницы.</p>';
}
$('#html-inputs').addEventListener('input', e => { if (e.target.dataset.url) pasted.set(e.target.dataset.url, e.target.value); });
for (const id of ['#source-url', '#page-urls']) $(id).addEventListener('change', renderHtmlInputs);

const mode = () => document.querySelector('input[name=mode]:checked').value;
function renderMode() {
  const m = mode();
  for (const id of ['worker', 'github', 'html', 'manual']) $(`#mode-${id}`).hidden = id !== m;
  $('#start').textContent = m === 'manual' ? 'Открыть пустой профиль' : 'Начать анализ';
  if (m === 'html') renderHtmlInputs();
  renderWorker();
}

// Импорт публичного GitHub-репозитория: читаем только git blobs и не выполняем код источника.
let githubRepo = null;
let githubLoadedKey = '';
const githubApi = 'https://api.github.com';
const githubHeaders = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
function parseGitHubRepo(value) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2 || !/^[a-z\d-]+$/i.test(parts[0]) || !/^[a-z\d_.-]+$/i.test(parts[1])) return null;
    return { owner: parts[0], name: parts[1].replace(/\.git$/i, '') };
  } catch { return null; }
}
async function githubJson(url) {
  const response = await fetch(url, { headers: githubHeaders, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) throw new Error('GitHub ограничил частоту запросов. Подождите минуту и повторите.');
    if (response.status === 404) throw new Error('Репозиторий недоступен: проверьте ссылку и убедитесь, что он публичный.');
    throw new Error(data?.message || `GitHub ответил кодом ${response.status}`);
  }
  return data;
}
function decodeGitHubBlob(blob, limit) {
  if (blob?.encoding !== 'base64' || !blob.content) throw new Error('GitHub не вернул содержимое файла.');
  const bytes = Uint8Array.from(atob(blob.content.replace(/\s/g, '')), ch => ch.charCodeAt(0));
  if (bytes.byteLength > limit) throw new Error('Файл слишком большой для импорта в браузер.');
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}
$('#github-connect').addEventListener('click', async () => {
  const parsed = parseGitHubRepo($('#github-repo-url').value);
  if (!parsed) { $('#github-import-status').textContent = 'Введите ссылку вида https://github.com/owner/repository на публичный репозиторий.'; return; }
  const button = $('#github-connect'); button.disabled = true;
  $('#github-import-status').textContent = 'Читаю сведения о репозитории и ищу HTML-страницы…';
  try {
    const base = `${githubApi}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}`;
    const repo = await githubJson(base);
    if (repo.private) throw new Error('Поддерживаются только публичные репозитории.');
    const branch = String(repo.default_branch || 'main');
    const tree = await githubJson(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if (tree.truncated) throw new Error('Репозиторий слишком большой для полного списка файлов. Уменьшите его или выберите конкретную страницу в HTML-режиме.');
    const pages = (tree.tree || []).filter(file => file.type === 'blob' && /\.html?$/i.test(file.path) && Number(file.size) <= 4_000_000);
    if (!pages.length) throw new Error('В репозитории не найден подходящий HTML-файл (лимит 4 МБ).');
    const rank = path => /(^|\/)index\.html?$/i.test(path) ? (path === 'index.html' ? 0 : /^(public|dist|build)\//i.test(path) ? 1 : 2) : 3;
    pages.sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path));
    githubRepo = { ...parsed, branch, base, files: tree.tree || [], pages };
    githubLoadedKey = '';
    const select = $('#github-html-file'); select.replaceChildren(...pages.slice(0, 100).map(file => new Option(file.path, file.path)));
    $('#github-files').hidden = false;
    $('#source-url').value = `https://github.com/${parsed.owner}/${parsed.name}`;
    if (!$('#template-name').value.trim()) $('#template-name').value = `${parsed.name} — копия сайта`.slice(0, 120);
    $('#github-import-status').textContent = `Найдено HTML-страниц: ${pages.length}. Ветка: ${branch}. Выбранная страница загрузится автоматически при начале анализа.`;
  } catch (error) {
    githubRepo = null; $('#github-files').hidden = true;
    $('#github-import-status').textContent = error.message || 'Не удалось прочитать репозиторий.';
  } finally { button.disabled = false; }
});
$('#github-html-file').addEventListener('change', () => { githubLoadedKey = ''; });
async function loadGitHubPage() {
  if (!githubRepo) return false;
  const button = $('#github-load-page'); button.disabled = true;
  try {
    const path = $('#github-html-file').value;
    const file = githubRepo.pages.find(item => item.path === path);
    if (!file) throw new Error('Выберите HTML-страницу из списка.');
    const loadedKey = `${githubRepo.owner}/${githubRepo.name}@${githubRepo.branch}:${path}`;
    if (githubLoadedKey === loadedKey && (pasted.get(validUrl($('#source-url').value)) || '').trim()) return true;
    githubLoadedKey = '';
    $('#github-import-status').textContent = `Загружаю ${path} и связанные таблицы стилей…`;
    const htmlBlob = await githubJson(`${githubRepo.base}/git/blobs/${file.sha}`);
    const html = decodeGitHubBlob(htmlBlob, 4_000_000);
    const byPath = new Map(githubRepo.files.filter(entry => entry.type === 'blob').map(entry => [entry.path, entry]));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    const cssPaths = [...doc.querySelectorAll('link[rel~="stylesheet"][href]')].map(link => {
      const href = link.getAttribute('href')?.trim() || '';
      if (!href || /^(?:[a-z]+:|\/\/|data:|#)/i.test(href)) return '';
      let clean = href.split(/[?#]/, 1)[0];
      try { clean = decodeURIComponent(clean); } catch { /* Некорректный URL пропускается ниже. */ }
      clean = clean.replace(/^\.\//, '');
      const parts = (clean.startsWith('/') ? clean.slice(1) : folder + clean).split('/');
      const resolved = [];
      for (const part of parts) { if (!part || part === '.') continue; if (part === '..') resolved.pop(); else resolved.push(part); }
      return resolved.join('/');
    }).filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).slice(0, MAX_STYLESHEETS);
    const cssParts = [];
    for (const cssPath of cssPaths) {
      const cssFile = byPath.get(cssPath);
      if (!cssFile || cssFile.size > 2_000_000) continue;
      try {
        const blob = await githubJson(`${githubRepo.base}/git/blobs/${cssFile.sha}`);
        cssParts.push(`/* ${cssPath} */\n${decodeGitHubBlob(blob, 2_000_000)}`);
      } catch { /* Недоступный внешний или динамический стиль не блокирует разбор HTML. */ }
    }
    const sourceUrl = `https://github.com/${githubRepo.owner}/${githubRepo.name}`;
    $('#source-url').value = sourceUrl; $('#page-urls').value = '';
    if (!$('#template-name').value.trim()) $('#template-name').value = `${githubRepo.name} — копия сайта`.slice(0, 120);
    renderHtmlInputs();
    const canonicalUrl = validUrl(sourceUrl);
    pasted.set(canonicalUrl, html);
    const textarea = $('#html-inputs textarea'); if (textarea) textarea.value = html;
    $('#css-input').value = cssParts.join('\n\n');
    githubLoadedKey = loadedKey;
    $('#github-import-status').textContent = `Загружена копия ${path}; CSS-файлов: ${cssParts.length}. Код сайта не запускался. Запускаю анализ…`;
    return true;
  } catch (error) {
    $('#github-import-status').textContent = error.message || 'Не удалось загрузить файлы репозитория.';
    setStatus(error.message || 'Не удалось загрузить файлы GitHub.', true);
    return false;
  } finally { button.disabled = false; }
}
$('#github-load-page').addEventListener('click', loadGitHubPage);
function renderWorker() {
  const ep = getEndpoint();
  const chip = $('#worker-chip');
  chip.textContent = ep ? 'адрес задан' : 'не подключён'; chip.className = `chip ${ep ? 'chip--on' : 'chip--off'}`;
  $('#worker-endpoint').value = ep;
  $('#worker-note').className = 'notice';
  $('#worker-note').textContent = ep
    ? `Страницы будут загружаться через ${ep}. Сервер читает только общедоступные страницы и не обходит авторизацию, CAPTCHA и запреты robots.txt.`
    : 'Анализатор-сервер не подключён. Браузер не может сам читать чужие сайты (ограничение CORS), поэтому автоматическая загрузка по адресу сейчас недоступна. Разверните Worker по инструкции или выберите «HTML-код страницы» / «Ручной ввод».';
  if (!ep) $('#worker-settings').open = true;
}
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', renderMode));

async function workerCall(path, timeout = 20000, signal) {
  const ep = getEndpoint().replace(/\/+$/, '');
  const ctrl = new AbortController();
  const abortFromCaller = () => ctrl.abort(signal?.reason);
  if (signal?.aborted) ctrl.abort(signal.reason);
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(ep + path, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    const body = await res.json().catch(() => null);
    if (!body) return { ok: false, message: `Сервер ответил ${res.status} без данных` };
    return body;
  } catch (err) {
    return { ok: false, message: signal?.aborted ? 'Анализ остановлен пользователем' : err.name === 'AbortError' ? 'Сервер не ответил вовремя' : 'Сервер недоступен или не разрешает запросы с этого сайта' };
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abortFromCaller); }
}
$('#worker-save').addEventListener('click', async () => {
  const raw = $('#worker-endpoint').value.trim();
  let ep = '';
  try { const u = new URL(raw); if (u.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(u.hostname)) ep = u.origin + u.pathname.replace(/\/+$/, ''); } catch { /* ниже */ }
  if (!ep) { toast('Адрес Worker должен начинаться с https://', true); return; }
  try { localStorage.setItem(ENDPOINT_KEY, ep); } catch { toast('Не удалось сохранить адрес в браузере', true); return; }
  renderWorker();
  $('#worker-note').textContent = 'Проверяем соединение с сервером…';
  const r = await workerCall('/health', 8000);
  if (r.ok && r.service === 'uds-site-fetch') { $('#worker-chip').textContent = 'подключён'; $('#worker-note').textContent = `Сервер отвечает (версия ${r.version}). Можно запускать анализ по адресу.`; toast('Анализатор-сервер подключён'); }
  else { $('#worker-chip').textContent = 'нет ответа'; $('#worker-chip').className = 'chip chip--off'; $('#worker-note').className = 'notice notice--err'; $('#worker-note').textContent = `Сервер не подтвердил работу: ${r.message || 'неожиданный ответ'}. Проверьте адрес и список ALLOWED_ORIGINS в настройках Worker.`; }
});
$('#worker-clear').addEventListener('click', () => { try { localStorage.removeItem(ENDPOINT_KEY); } catch { /* нет хранилища */ } renderWorker(); toast('Анализатор-сервер отключён'); });

$('#copy-snippet').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(SNIPPET); toast('Команда скопирована'); } catch { toast('Не удалось скопировать — выделите команду вручную', true); }
});
$('#upload-trigger').addEventListener('click', () => $('#upload-files').click());
$('#upload-files').addEventListener('change', async e => {
  let html = 0, css = 0;
  for (const file of e.target.files || []) {
    if (file.size > 4_000_000) { toast(`Файл ${file.name} больше 4 МБ — пропущен`, true); continue; }
    const text = await file.text();
    if (/\.css$/i.test(file.name) || file.type === 'text/css') { $('#css-input').value += `\n/* ${file.name} */\n${text}`; css++; continue; }
    const slot = [...document.querySelectorAll('#html-inputs textarea')].find(t => !t.value.trim());
    if (!slot) { toast('Для этого файла нет свободной страницы — добавьте её адрес в форму', true); continue; }
    slot.value = text; pasted.set(slot.dataset.url, text); html++;
  }
  e.target.value = '';
  if (html || css) toast(`Загружено: HTML — ${html}, CSS — ${css}`);
});

// ---------- Анализ ----------
let reanalyzeId = '';
let activeAnalysisController = null;
$('#analysis-cancel').addEventListener('click', () => {
  if (!activeAnalysisController) return;
  $('#analysis-cancel').disabled = true;
  $('#analysis-cancel').textContent = 'Останавливаем…';
  activeAnalysisController.abort();
});
const ICON = { wait: ['•', ''], run: ['◠', 'st--run'], ok: ['✓', 'st--ok'], err: ['!', 'st--err'], skip: ['–', 'st--skip'] };
function renderProgress(rows, done, title) {
  $('#progress').hidden = false;
  $('#progress-title').textContent = title;
  $('#progress-count').textContent = `${done} из ${rows.length}`;
  const pct = rows.length ? Math.round(done / rows.length * 100) : 0;
  $('#progress-bar').setAttribute('aria-valuenow', pct); $('#progress-bar').firstElementChild.style.width = pct + '%';
  $('#progress-list').innerHTML = rows.map(r => `<li><span class="st ${ICON[r.state][1]}" aria-hidden="true">${ICON[r.state][0]}</span><span><b>${esc(r.url)}</b><small>${esc(r.note)}</small></span></li>`).join('');
}
const tick = () => new Promise(r => setTimeout(r, 30));

async function runAnalysis(src, how) {
  const controller = new AbortController();
  activeAnalysisController = controller;
  const urls = [src.url, ...src.pages];
  const rows = urls.map(url => ({ url, state: 'wait', note: 'ожидает' }));
  const analyses = [];
  let done = 0;
  $('#progress-result').innerHTML = '';
  $('#start').disabled = true;
  $('#analysis-cancel').hidden = false;
  $('#analysis-cancel').disabled = false;
  $('#analysis-cancel').textContent = 'Отменить';
  const css = $('#css-input').value;
  for (const [i, url] of urls.entries()) {
    const row = rows[i];
    let html = '', sheetCss = '', loaded = 0, failedStylesheets = 0, stylesheetCount = 0, truncated = false, finalUrl = url;
    if (controller.signal.aborted) { row.state = 'skip'; row.note = 'отменено пользователем'; done++; renderProgress(rows, done, 'Останавливаем анализ'); continue; }
    row.state = 'run';
    if (how === 'worker') {
      row.note = 'загрузка страницы через анализатор-сервер…'; renderProgress(rows, done, 'Идёт анализ');
      const r = await workerCall(`/fetch?kind=html&url=${encodeURIComponent(url)}`, 20000, controller.signal);
      if (controller.signal.aborted) { row.state = 'skip'; row.note = 'отменено пользователем'; done++; renderProgress(rows, done, 'Останавливаем анализ'); break; }
      if (!r.ok) { row.state = 'err'; row.note = `Не получено: ${r.message || 'ошибка сервера'}`; done++; renderProgress(rows, done, 'Идёт анализ'); continue; }
      html = r.text;
      finalUrl = r.finalUrl || url;
      truncated = Boolean(r.truncated);
      const sheets = stylesheetLinks(html, finalUrl).slice(0, MAX_STYLESHEETS);
      stylesheetCount = sheets.length;
      for (const [k, sheet] of sheets.entries()) {
        row.note = `загрузка стилей: ${k + 1} из ${sheets.length}…`; renderProgress(rows, done, 'Идёт анализ');
        const c = await workerCall(`/fetch?kind=css&url=${encodeURIComponent(sheet)}`, 20000, controller.signal);
        if (controller.signal.aborted) { row.state = 'skip'; row.note = 'отменено пользователем'; break; }
        if (c.ok) { sheetCss += '\n' + c.text; loaded++; }
        else failedStylesheets++;
      }
      if (controller.signal.aborted) { done++; renderProgress(rows, done, 'Останавливаем анализ'); break; }
    } else {
      html = pasted.get(url) || '';
      if (!html.trim()) { row.state = 'skip'; row.note = 'HTML не добавлен — страница пропущена'; done++; renderProgress(rows, done, 'Идёт анализ'); continue; }
    }
    row.note = 'разбор разметки и стилей…'; renderProgress(rows, done, 'Идёт анализ');
    await tick();
    try {
      const a = analyzePage({ url: finalUrl, html, css: how === 'worker' ? sheetCss : css, cssLoaded: loaded });
      // Сервер отдаёт не больше 1,5 МБ разметки: неполная страница должна быть явно помечена в профиле.
      if (truncated) a.warnings.push(`Страница ${url} больше 1,5 МБ и получена не целиком — блоки в конце страницы могли не попасть в анализ. Проверьте структуру вручную.`);
      if (failedStylesheets) a.warnings.push(`Не удалось получить ${failedStylesheets} из ${stylesheetCount} файлов CSS. Визуальные признаки в профиле могут быть неполными.`);
      const blocks = a.structure.order.length;
      if (!blocks && a.stats.textLength < 200) { row.state = 'err'; row.note = a.warnings[0] || 'В разметке нет содержимого для анализа'; }
      else { analyses.push(a); row.state = 'ok'; row.note = `Блоков: ${blocks}; элементов: ${a.stats.elements}; стили: ${a.visual.available ? `получены ${loaded}${stylesheetCount ? ` из ${stylesheetCount}` : ''}` : 'недостаточно данных'}${truncated ? '; страница получена не целиком' : ''}${failedStylesheets ? `; CSS с ошибкой: ${failedStylesheets}` : ''}`; }
    } catch (err) { row.state = 'err'; row.note = `Ошибка разбора: ${err.message}`; }
    done++; renderProgress(rows, done, 'Идёт анализ');
  }
  if (controller.signal.aborted) {
    for (const row of rows) if (row.state === 'wait') { row.state = 'skip'; row.note = 'отменено пользователем'; done++; }
    renderProgress(rows, done, 'Анализ остановлен');
  }
  $('#start').disabled = false;
  $('#analysis-cancel').hidden = true;
  $('#analysis-cancel').disabled = false;
  $('#analysis-cancel').textContent = 'Отменить';
  activeAnalysisController = null;
  if (!analyses.length) {
    renderProgress(rows, done, controller.signal.aborted ? 'Анализ остановлен' : 'Анализ не выполнен');
    $('#progress-result').innerHTML = `<p class="notice${controller.signal.aborted ? '' : ' notice--err'}">${controller.signal.aborted ? 'Анализ остановлен до получения страниц. Профиль не создан.' : `Ни одну страницу не удалось проанализировать, поэтому профиль не создан — выдуманных данных студия не показывает. ${how === 'worker' ? 'Попробуйте вставить HTML-код страницы или заполните профиль вручную.' : 'Проверьте, что вставлен код страницы целиком, или заполните профиль вручную.'}`}</p><div class="actions"><button type="button" data-fallback="html">Вставить HTML-код</button><button type="button" data-fallback="manual">Заполнить вручную</button></div>`;
    setStatus(controller.signal.aborted ? 'Анализ отменён.' : 'Анализ не выполнен: данные страниц не получены.', false);
    return;
  }
  renderProgress(rows, done, controller.signal.aborted ? 'Собран частичный анализ' : 'Анализ завершён');
  const { profile, traits, warnings: profileWarnings } = buildProfile(analyses);
  const warnings = [...profileWarnings];
  if (controller.signal.aborted) warnings.push(`Анализ остановлен пользователем: профиль построен по ${analyses.length} из ${urls.length} страниц.`);
  const draft = normalizeTemplate({
    ...src, profile, traits,
    analysis: { source: how, analyzedAt: new Date().toISOString(), warnings, pages: rows.map(r => ({ url: r.url, status: r.state === 'ok' ? 'ok' : 'error', note: r.note })) },
    provenance: Object.fromEntries(PROFILE_FIELDS.map(f => [f.key, 'auto'])),
  });
  setStatus(`${controller.signal.aborted ? 'Анализ остановлен. Частичный профиль:' : 'Проанализировано страниц:'} ${analyses.length} из ${urls.length}. Проверьте профиль и сохраните его.`);
  openEditor(draft, { isNew: true });
}
$('#progress-result').addEventListener('click', e => {
  const b = e.target.closest('[data-fallback]'); if (!b) return;
  document.querySelector(`input[name=mode][value=${b.dataset.fallback}]`).checked = true; renderMode();
  $(`#mode-${b.dataset.fallback}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('#template-form').addEventListener('submit', async e => {
  e.preventDefault();
  setStatus('');
  const src = readSource();
  if (!src) return;
  const m = mode();
  if (m === 'manual') return openEditor(normalizeTemplate({ ...src, analysis: { source: 'manual' } }), { isNew: true, manual: true });
  if (m === 'github') {
    if (!githubRepo) { setStatus('Сначала найдите публичный GitHub-репозиторий и выберите HTML-страницу.', true); return; }
    if (!await loadGitHubPage()) return;
    await runAnalysis(src, 'github'); return;
  }
  if (m === 'worker' && !getEndpoint()) { setStatus('Анализатор-сервер не подключён. Укажите адрес Worker в настройках или выберите другой способ.', true); $('#worker-settings').open = true; $('#worker-endpoint').focus(); return; }
  if (m === 'html' && ![src.url, ...src.pages].some(u => (pasted.get(u) || '').trim())) {
    const workerMode = document.querySelector('input[name=mode][value="worker"]');
    workerMode.checked = true; renderMode();
    if (!getEndpoint()) {
      setStatus('Чтобы анализировать по адресу, нужен Worker-анализатор. Он не подключён; браузер не может сам читать чужой сайт из-за CORS. Настройте Worker ниже или вставьте HTML-код страницы.', true);
      $('#worker-settings').open = true; $('#worker-endpoint').focus();
      return;
    }
    await runAnalysis(src, 'worker'); return;
  }
  await runAnalysis(src, m);
});
$('#save-link').addEventListener('click', () => {
  setStatus('');
  const src = readSource();
  if (!src) return;
  items.unshift(normalizeTemplate(src));
  if (!persist()) { items.shift(); return; }
  render(); resetForm();
  toast('Ссылка сохранена без анализа. Профиль можно заполнить позже.');
});
function resetForm() {
  $('#template-form').reset(); pasted.clear(); reanalyzeId = '';
  $('#template-category').value = 'Универсальный';
  $('#progress').hidden = true; setStatus(''); renderMode();
}
$('#template-form').addEventListener('reset', () => setTimeout(() => { pasted.clear(); reanalyzeId = ''; $('#progress').hidden = true; setStatus(''); renderMode(); }));

// ---------- Редактор профиля ----------
let editing = null; // { draft, isNew, original }
const provLabel = { auto: ['из анализа', 'chip--auto'], manual: ['вручную', 'chip--manual'], empty: ['не заполнено', 'chip--empty'] };
const fieldText = (t, f) => (f.kind === 'palette' ? paletteToText(t.profile[f.key]) : t.profile[f.key].join('\n'));

function openEditor(draft, { isNew = false, manual = false } = {}) {
  editing = { draft, isNew, original: Object.fromEntries(PROFILE_FIELDS.map(f => [f.key, fieldText(draft, f)])) };
  $('#editor-kicker').textContent = isNew ? (manual ? 'НОВЫЙ ПРОФИЛЬ · РУЧНОЙ ВВОД' : 'НОВЫЙ ПРОФИЛЬ · РЕЗУЛЬТАТ АНАЛИЗА') : 'РЕДАКТИРОВАНИЕ ПРОФИЛЯ';
  $('#editor-title').textContent = draft.name;
  $('#editor-save').textContent = isNew ? 'Сохранить в библиотеку' : 'Сохранить изменения';
  $('#editor-status').textContent = '';
  const a = draft.analysis, tr = draft.traits;
  const sourceNote = a.source === 'manual' || a.source === 'none'
    ? '<p class="notice">Профиль заполняется вручную: автоматический анализ не выполнялся. Вносите только то, что действительно есть на сайте.</p>'
    : `<p class="notice">Поля с меткой «из анализа» получены из ${a.source === 'worker' ? 'страниц, загруженных анализатором-сервером' : 'вставленного HTML-кода'}: это статический разбор разметки и стилей, а не просмотр сайта глазами. Проверьте и поправьте всё, что считаете нужным. Блок «Идеи» — черновые предложения студии.</p>`;
  const warn = a.warnings.length ? `<div class="notice notice--err"><b>Ограничения этого анализа</b><ul>${a.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '';
  const sel = (id, label, dict, value, text) => `<div class="field"><label for="${id}">${label}</label><select id="${id}"><option value="">не задано</option>${Object.keys(dict).map(k => `<option value="${k}"${k === value ? ' selected' : ''}>${esc(text(k))}</option>`).join('')}</select></div>`;
  $('#editor-body').innerHTML = `${sourceNote}${warn}
<div class="cols">
  <div class="field"><label for="ed-name">Название *</label><input id="ed-name" required maxlength="120" value="${esc(draft.name)}"></div>
  <div class="field"><label for="ed-category">Категория</label><select id="ed-category">${options([...new Set([...CATEGORIES, draft.category])], draft.category)}</select></div>
</div>
<div class="cols">
  <div class="field"><label for="ed-url">Источник (адрес сайта)</label><input id="ed-url" type="url" value="${esc(draft.url)}" placeholder="https://"></div>
  <div class="field"><label for="ed-business">Ниша / тип бизнеса</label><input id="ed-business" maxlength="160" value="${esc(draft.business)}" placeholder="Например: мебель на заказ"></div>
</div>
<div class="cols">
  <div class="field"><label for="ed-pages">Дополнительные страницы</label><textarea id="ed-pages" rows="2">${esc(draft.pages.join('\n'))}</textarea></div>
  <div class="field"><label for="ed-notes">Комментарии</label><textarea id="ed-notes" rows="2" maxlength="4000">${esc(draft.notes)}</textarea></div>
</div>
${PROFILE_GROUPS.map(g => `<section class="group"><h3>${esc(g.title)}</h3><div class="cols">${g.fields.map(([key, label, kind = 'lines']) => {
    const f = { key, kind }; const text = fieldText(draft, f); const p = text ? draft.provenance[key] || 'manual' : 'empty';
    return `<div class="field"><div class="lbl"><label for="pf-${key}">${esc(label)}</label><span class="chip ${provLabel[p][1]}" data-prov="${key}">${provLabel[p][0]}</span></div><textarea id="pf-${key}" data-field="${key}" rows="${Math.min(8, Math.max(3, text.split('\n').length))}" placeholder="${kind === 'palette' ? '#f6f1e8 — фон' : 'Каждый пункт с новой строки'}">${esc(text)}</textarea>${kind === 'palette' ? `<div class="swatches" id="pf-swatches">${swatches(draft.profile.palette)}</div>` : ''}</div>`;
  }).join('')}</div></section>`).join('')}
<section class="group"><h3>Признаки для генератора</h3>
  <p class="hint">По этим признакам студия подбирает профиль под нишу и следит, чтобы новая концепция не повторяла композицию источника.${a.source === 'worker' || a.source === 'html' ? ' Значения — оценка по разметке, поправьте при необходимости.' : ''}</p>
  <div class="field"><span>Близкие архитектуры первого экрана (до трёх)</span><div class="checks" id="tr-archetypes">${Object.entries(ARCHETYPES).map(([id, x]) => `<label><input type="checkbox" value="${id}"${tr.archetypes.includes(id) ? ' checked' : ''}>${esc(x.name)}</label>`).join('')}</div></div>
  <div class="field"><label for="tr-order">Порядок смысловых блоков</label><input id="tr-order" value="${esc(tr.sectionOrder.join(', '))}" aria-describedby="tr-order-h"><small class="hint" id="tr-order-h">Через запятую: ${SECTION_IDS.map(id => `${id} — ${SECTION_LABELS[id].toLowerCase()}`).join('; ')}.</small></div>
  <div class="cols">${sel('tr-nav', 'Навигация', NAV_LABELS, tr.nav, k => NAV_LABELS[k])}${sel('tr-shape', 'Форма элементов', SHAPES, tr.shape, k => SHAPES[k].label)}</div>
  <div class="cols">${sel('tr-type', 'Характер типографики', TYPES, tr.typeCharacter, k => TYPES[k].label)}${sel('tr-mode', 'Тема', { light: 1, dark: 1 }, tr.mode, k => (k === 'dark' ? 'тёмная' : 'светлая'))}</div>
</section>`;
  $('#editor').showModal();
  $('#ed-name').focus();
}
const swatches = palette => (palette || []).map(p => `<i style="background:${esc(p.hex)}" title="${esc(p.hex + (p.role ? ' — ' + p.role : ''))}"></i>`).join('');
$('#editor-body').addEventListener('input', e => {
  const key = e.target.dataset.field; if (!key || !editing) return;
  const chip = $(`[data-prov="${key}"]`);
  const p = !e.target.value.trim() ? 'empty' : e.target.value.trim() === editing.original[key].trim() ? editing.draft.provenance[key] || 'manual' : 'manual';
  chip.textContent = provLabel[p][0]; chip.className = `chip ${provLabel[p][1]}`;
  if (key === 'palette') $('#pf-swatches').innerHTML = swatches(parsePalette(e.target.value));
});
document.addEventListener('change', e => {
  if (!e.target.closest('#tr-archetypes')) return;
  const on = [...document.querySelectorAll('#tr-archetypes input:checked')];
  if (on.length > 3) { e.target.checked = false; $('#editor-status').textContent = 'Можно выбрать не больше трёх архитектур.'; }
});
$('#editor-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!editing) return;
  const name = $('#ed-name').value.trim();
  if (!name) { $('#editor-status').textContent = 'Укажите название профиля.'; $('#ed-name').focus(); return; }
  const rawUrl = $('#ed-url').value.trim();
  if (rawUrl && !validUrl(rawUrl)) { $('#editor-status').textContent = 'Адрес источника должен начинаться с http:// или https://'; $('#ed-url').focus(); return; }
  const d = editing.draft;
  const profile = {}, provenance = {};
  for (const f of PROFILE_FIELDS) {
    const value = $(`#pf-${f.key}`).value;
    profile[f.key] = value;
    if (value.trim()) provenance[f.key] = value.trim() === editing.original[f.key].trim() ? d.provenance[f.key] || 'manual' : 'manual';
  }
  const now = new Date().toISOString();
  const saved = normalizeTemplate({
    ...d, name, category: $('#ed-category').value, url: validUrl(rawUrl), business: $('#ed-business').value, notes: $('#ed-notes').value,
    pages: $('#ed-pages').value.split(/\n+/), profile, provenance, updatedAt: now,
    traits: {
      archetypes: [...document.querySelectorAll('#tr-archetypes input:checked')].map(i => i.value), sectionOrder: $('#tr-order').value.split(/[,\s>→]+/),
      nav: $('#tr-nav').value, shape: $('#tr-shape').value, typeCharacter: $('#tr-type').value, mode: $('#tr-mode').value,
      heroVisual: d.traits.heroVisual, heroForm: d.traits.heroForm,
    },
  }, now);
  const before = items;
  const replaceId = editing.isNew ? reanalyzeId : d.id;
  if (replaceId && items.some(x => x.id === replaceId)) {
    const old = items.find(x => x.id === replaceId);
    items = items.map(x => (x.id === replaceId ? { ...saved, id: old.id, createdAt: old.createdAt } : x));
  } else items = [saved, ...items];
  if (!persist()) { items = before; $('#editor-status').textContent = 'Не удалось сохранить профиль в браузере.'; return; }
  const wasNew = editing.isNew;
  editing = null;
  reanalyzeId = '';
  $('#editor').close();
  render();
  if (wasNew) resetForm();
  toast(wasNew ? `Профиль «${saved.name}» сохранён в библиотеку` : 'Изменения сохранены');
});

// Редактор закрыт без сохранения (кнопка, Esc): повторный анализ отменён, и следующий новый профиль
// не должен заменить старую запись.
$('#editor').addEventListener('close', () => {
  if (!editing) return;
  if (editing.isNew && reanalyzeId) { reanalyzeId = ''; setStatus('Повторный анализ отменён: существующий профиль не изменён.'); }
  editing = null;
});

// ---------- Библиотека ----------
const statusChip = t => (t.status === 'analyzed' ? ['проанализирован', 'chip--auto'] : t.status === 'manual' ? ['заполнен вручную', 'chip--manual'] : ['только ссылка', 'chip--empty']);
const dateRu = iso => new Date(iso).toLocaleDateString('ru-RU');

function render() {
  $('#count').textContent = items.length;
  const cats = [...new Set(items.map(t => t.category))].sort((a, b) => a.localeCompare(b, 'ru'));
  const current = $('#filter-category').value;
  $('#filter-category').innerHTML = options(cats, cats.includes(current) ? current : '', 'Все категории');
  $('#clear-library').disabled = $('#export-library').disabled = !items.length;
  const box = $('#templates');
  if (!items.length) { box.innerHTML = '<div class="empty"><b>Библиотека пока пуста</b>Проанализируйте первый сайт в форме выше или импортируйте JSON с ранее сохранёнными профилями.</div>'; return; }
  const shown = filterLibrary(items, { query: $('#search').value, category: $('#filter-category').value });
  if (!shown.length) { box.innerHTML = '<div class="empty"><b>Ничего не найдено</b>Измените запрос или сбросьте фильтр по категории.<div class="actions" style="justify-content:center;margin-top:12px"><button type="button" data-reset-filter>Сбросить фильтры</button></div></div>'; return; }
  box.innerHTML = shown.map(t => {
    const [label, cls] = statusChip(t);
    const blocks = t.profile.blocks.filter(b => !b.startsWith('—')).length;
    return `<article class="template" data-id="${esc(t.id)}">
<div class="meta"><span class="tag">${esc(t.category)}</span><span class="chip ${cls}">${label}</span></div>
<h3>${esc(t.name)}</h3>
${t.url ? `<p><a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.url.replace(/^https?:\/\//, ''))}</a></p>` : '<p>Источник не указан</p>'}
${t.profile.palette.length ? `<div class="swatches" aria-label="Палитра источника">${swatches(t.profile.palette.slice(0, 8))}</div>` : ''}
<p>${isProfileEmpty(t) ? 'Профиль не заполнен' : `Страниц: ${1 + t.pages.length}${blocks ? ` · блоков: ${blocks}` : ''}${t.traits.archetypes.length ? ` · ${esc(ARCHETYPES[t.traits.archetypes[0]].name)}` : ''}`}</p>
${t.notes ? `<p>${esc(t.notes.length > 110 ? t.notes.slice(0, 109) + '…' : t.notes)}</p>` : ''}
<small class="hint">Обновлён: ${dateRu(t.updatedAt)}</small>
<div class="actions"><button type="button" data-act="view">Подробнее</button><button type="button" data-act="edit">Редактировать</button><button type="button" data-act="copy" aria-label="Дублировать «${esc(t.name)}»">Дублировать</button><button type="button" data-act="delete" class="danger" aria-label="Удалить «${esc(t.name)}»">Удалить</button></div>
</article>`;
  }).join('');
}
$('#search').addEventListener('input', render);
$('#filter-category').addEventListener('change', render);

async function act(action, id) {
  const t = items.find(x => x.id === id);
  if (!t) return;
  if (action === 'view') return openDetails(t);
  if (action === 'edit') { $('#details').close(); return openEditor(JSON.parse(JSON.stringify(t))); }
  if (action === 'copy') {
    const copy = duplicateTemplate(t);
    items.splice(items.indexOf(t) + 1, 0, copy);
    if (!persist()) { items = items.filter(x => x !== copy); return; }
    render(); toast(`Создана копия: «${copy.name}»`); return;
  }
  if (action === 'export') return download(`uds-template-${id.slice(0, 8)}.json`, JSON.stringify(exportLibrary([t]), null, 2));
  if (action === 'reanalyze') {
    $('#details').close();
    $('#source-url').value = t.url; $('#page-urls').value = t.pages.join('\n'); $('#template-name').value = t.name; $('#template-notes').value = t.notes;
    $('#template-category').innerHTML = options([...new Set([...CATEGORIES, t.category])], t.category);
    reanalyzeId = t.id; renderMode();
    $('#analyze-h').scrollIntoView({ behavior: 'smooth' });
    setStatus(`Повторный анализ «${t.name}»: после сохранения профиль будет заменён.`); return;
  }
  if (action === 'delete') {
    if (!await confirmAction('Удалить профиль?', `«${t.name}» будет удалён из библиотеки этого браузера. Отменить действие нельзя.`, 'Удалить')) return;
    const before = items;
    items = items.filter(x => x.id !== id);
    if (!persist()) { items = before; return; }
    $('#details').close(); render(); toast('Профиль удалён');
  }
}
$('#templates').addEventListener('click', e => {
  if (e.target.closest('[data-reset-filter]')) { $('#search').value = ''; $('#filter-category').value = ''; return render(); }
  const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b.closest('[data-id]').dataset.id);
});

function openDetails(t) {
  const [label] = statusChip(t);
  $('#details-kicker').textContent = `${t.category.toUpperCase()} · ${label.toUpperCase()}`;
  $('#details-title').textContent = t.name;
  const ul = arr => `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const a = t.analysis;
  const how = { worker: 'страницы загружены анализатором-сервером', html: 'анализ вставленного HTML-кода', manual: 'заполнен вручную', none: 'анализ не выполнялся' }[a.source];
  const groups = PROFILE_GROUPS.map(g => {
    const rows = g.fields.filter(([key]) => t.profile[key].length).map(([key, name, kind]) => `<dt>${esc(name)} <span class="chip ${provLabel[t.provenance[key] || 'manual'][1]}">${provLabel[t.provenance[key] || 'manual'][0]}</span></dt><dd>${kind === 'palette' ? `<div class="swatches">${swatches(t.profile.palette)}</div>${ul(t.profile.palette.map(p => `${p.hex}${p.role ? ' — ' + p.role : ''}`))}` : ul(t.profile[key])}</dd>`).join('');
    return rows ? `<section class="group"><h3>${esc(g.title)}</h3><dl class="kv">${rows}</dl></section>` : '';
  }).join('');
  const tr = t.traits;
  const traitRows = [
    tr.archetypes.length && ['Близкие архитектуры', tr.archetypes.map(id => ARCHETYPES[id].name).join(', ')],
    tr.sectionOrder.length && ['Порядок блоков', tr.sectionOrder.map(id => SECTION_LABELS[id]).join(' → ')],
    tr.nav && ['Навигация', NAV_LABELS[tr.nav]], tr.shape && ['Форма', SHAPES[tr.shape].label], tr.typeCharacter && ['Типографика', TYPES[tr.typeCharacter].label],
    tr.mode && ['Тема', tr.mode === 'dark' ? 'тёмная' : 'светлая'],
  ].filter(Boolean);
  $('#details-body').innerHTML = `
<dl class="kv">
  <dt>Источник</dt><dd>${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.url)}</a>` : '—'}</dd>
  ${t.pages.length ? `<dt>Страницы</dt><dd>${ul(t.pages)}</dd>` : ''}
  ${t.business ? `<dt>Ниша</dt><dd>${esc(t.business)}</dd>` : ''}
  <dt>Происхождение данных</dt><dd>${how}${a.analyzedAt ? `, ${dateRu(a.analyzedAt)}` : ''}</dd>
  ${t.notes ? `<dt>Комментарии</dt><dd>${esc(t.notes)}</dd>` : ''}
</dl>
${a.warnings.length ? `<div class="notice notice--err" style="margin-top:14px"><b>Ограничения анализа</b>${ul(a.warnings)}</div>` : ''}
${groups || '<p class="notice" style="margin-top:14px">Профиль не заполнен: сохранена только ссылка. Запустите анализ или заполните поля вручную.</p>'}
${traitRows.length ? `<section class="group"><h3>Признаки для генератора</h3><dl class="kv">${traitRows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>` : ''}`;
  $('#details-actions').innerHTML = `<button type="button" data-dact="edit" class="primary">Редактировать</button><button type="button" data-dact="reanalyze">Анализировать заново</button><button type="button" data-dact="copy">Дублировать</button><button type="button" data-dact="export">Экспорт JSON</button><button type="button" data-dact="delete" class="danger">Удалить</button>`;
  $('#details-actions').dataset.id = t.id;
  $('#details').showModal();
}
$('#details-actions').addEventListener('click', e => {
  const b = e.target.closest('[data-dact]'); if (!b) return;
  if (b.dataset.dact === 'copy') $('#details').close();
  act(b.dataset.dact, $('#details-actions').dataset.id);
});

// ---------- Импорт и экспорт ----------
$('#export-library').addEventListener('click', () => { download('unique-design-templates.json', JSON.stringify(exportLibrary(items), null, 2)); toast(`Экспортировано профилей: ${items.length}`); });
$('#import-trigger').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 12_000_000) throw new Error('Файл больше 12 МБ');
    let data;
    try { data = JSON.parse(await file.text()); } catch { throw new Error('Файл не является корректным JSON'); }
    const { templates, rejected } = parseLibraryImport(data);
    if (!templates.length) throw new Error('В файле нет ни одного шаблона');
    const before = items;
    const merged = mergeLibrary(items, templates);
    items = merged.items;
    if (!persist()) { items = before; return; }
    render();
    toast(`Импорт: добавлено ${merged.added}, обновлено ${merged.updated}, без изменений ${merged.skipped}${rejected ? `, отклонено ${rejected}` : ''}`);
  } catch (err) { toast(`Импорт не выполнен: ${err.message}`, true); }
});
$('#clear-library').addEventListener('click', async () => {
  if (!items.length) return;
  if (!await confirmAction('Очистить библиотеку?', `Будут удалены все профили (${items.length}). Сначала сделайте экспорт JSON, если они ещё нужны.`, 'Удалить всё')) return;
  const before = items;
  items = [];
  if (!persist()) { items = before; return; }
  render(); toast('Библиотека очищена');
});

// Синхронизация между вкладками: библиотеку могли изменить на другой вкладке.
window.addEventListener('storage', e => { if (e.key === LIBRARY_KEY) { items = readLibrary(); render(); } });

renderMode();
render();
