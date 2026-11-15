// Веб-студия: редактор проекта, живой предпросмотр, концепция, проверка и реестр проектов.
import { ARCHETYPES, BRANDS, LEGACY_LABELS, buildPrompt, exportProject, generate, normalizeProject, similarity } from '../src/engine/index.js';

const STORE = 'uds:studio:v1';
const $ = sel => document.querySelector(sel);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const EMPTY = { formatVersion: 2, brand: '', niche: '', architecture: 'auto', architectureMode: 'auto' };
let state = { raw: { ...EMPTY }, library: [] };
let result = null;

try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved && saved.raw) state = { raw: saved.raw, library: Array.isArray(saved.library) ? saved.library : [] };
} catch { /* хранилище недоступно — работаем без сохранения */ }
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* нет хранилища */ } };

// ---------- Описание формы ----------
const LIST_HINT = 'Одна позиция на строку: Название | Описание';
const GROUPS = [
  ['Основа', true, [
    ['brand', 'Бренд'], ['niche', 'Ниша', 'text', 'Например: кофейня, магазин телескопов, салон красоты'],
    ['title', 'Заголовок первого экрана'], ['description', 'Описание предложения', 'area'],
    ['cta', 'Текст главной кнопки'], ['ctaUrl', 'Ссылка главной кнопки', 'text', 'Необязательно. По умолчанию ведёт к разделу контактов'],
  ]],
  ['Архитектура и стиль', true, [
    ['@arch', 'Архитектура главной страницы', 'arch'], ['@palette', 'Палитра', 'palette'], ['@accent', 'Акцентный цвет', 'accent'],
    ['@brand', 'Фирменный стиль', 'brand', 'Цвета, шрифты и скругления живого проекта. Композицию по-прежнему выбирает движок. Перекрывает «Палитру»'],
    ['@fonts', 'Шрифты', 'fonts', 'Системные — страница без внешних запросов. Google Fonts — характерные шрифты с кириллицей, одинаковые на всех устройствах'],
    ['targetAudience', 'Аудитория', 'area', 'Если пусто — будет использована явно помеченная гипотеза'],
    ['brandCharacter', 'Характер бренда'],
  ]],
  ['Изображения', false, [
    ['images.hero', 'Изображение первого экрана (URL)'], ['images.heroAlt', 'Описание изображения (alt)'],
    ['gallery', 'Галерея', 'list', 'Одна картинка на строку: URL | Подпись'],
  ]],
  ['Каталог / услуги / меню', false, [
    ['servicesTitle', 'Заголовок раздела'], ['servicesIntro', 'Вступление', 'area'],
    ['services', 'Позиции', 'list', 'Одна позиция на строку: Название | Описание | Цена | URL картинки. Цена и картинка необязательны'],
    ['categories', 'Категории', 'list', 'Одна категория на строку'],
  ]],
  ['О нас', false, [['aboutTitle', 'Заголовок'], ['aboutText', 'Текст', 'area']]],
  ['Преимущества', false, [['advantagesTitle', 'Заголовок'], ['advantages', 'Пункты', 'list', LIST_HINT]]],
  ['Этапы работы', false, [['processTitle', 'Заголовок'], ['process', 'Этапы', 'list', LIST_HINT]]],
  ['Вопросы и ответы', false, [['faqs', 'Вопросы', 'list', 'Один вопрос на строку: Вопрос | Ответ']]],
  ['Контакты и заявки', false, [
    ['contactTitle', 'Заголовок'], ['contactText', 'Текст', 'area'],
    ['contacts.phone', 'Телефон'], ['contacts.email', 'E-mail'], ['contacts.address', 'Адрес'], ['contacts.hours', 'Часы работы'],
    ['formAction', 'Адрес обработчика формы (https://…)', 'text', 'Если пусто и указан e-mail — форма откроет почтовую программу'],
  ]],
];

const get = path => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.raw);
function set(path, value) {
  const keys = path.split('.');
  let o = state.raw;
  for (const k of keys.slice(0, -1)) o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {};
  o[keys.at(-1)] = value;
}
const rowsToText = (rows, path) => (Array.isArray(rows) ? rows : []).map(r => {
  if (path === 'categories') return String(r);
  if (path === 'gallery') return [r.src, r.caption].filter(Boolean).join(' | ');
  const a = Array.isArray(r) ? r : [r.title, r.text, r.price, r.image];
  const cells = a.map(x => x ?? '');
  while (cells.length > 1 && !cells.at(-1)) cells.pop();
  return cells.join(' | ');
}).join('\n');
function textToRows(text, path) {
  const rows = text.split('\n').map(l => l.split('|').map(s => s.trim())).filter(r => r.some(Boolean));
  if (path === 'categories') return rows.map(r => r[0]);
  if (path === 'gallery') return rows.map(r => ({ src: r[0], caption: r[1] || '', alt: r[1] || '' }));
  return rows;
}

function buildForm() {
  const arch = normalizeProject(state.raw).architecture;
  const archValue = arch.mode === 'exact' ? `exact:${arch.exact}` : arch.mode === 'family' ? `family:${arch.family}` : 'auto';
  const p = normalizeProject(state.raw);
  const html = GROUPS.map(([title, open, fields]) => `<details class="group"${open ? ' open' : ''}><summary>${title}</summary><div class="fields">${fields.map(([path, label, type = 'text', hint = '']) => {
    const id = 'f-' + path.replace(/[^a-z]/gi, '-');
    const small = hint ? `<small id="${id}-h">${hint}</small>` : '';
    const d = hint ? ` aria-describedby="${id}-h"` : '';
    let control;
    if (type === 'area') control = `<textarea id="${id}" data-path="${path}"${d}>${esc(get(path))}</textarea>`;
    else if (type === 'list') control = `<textarea id="${id}" class="list" data-list="${path}"${d} spellcheck="false">${esc(rowsToText(get(path), path))}</textarea>`;
    else if (type === 'arch') control = `<select id="${id}" data-special="arch">
<option value="auto">${LEGACY_LABELS.auto}</option>
<optgroup label="Семейства (как в редакторе Landing Studio)">${Object.entries(LEGACY_LABELS).filter(([k]) => k !== 'auto').map(([k, v]) => `<option value="family:${k}">${v}</option>`).join('')}</optgroup>
<optgroup label="Точная архитектура">${Object.entries(ARCHETYPES).map(([k, a]) => `<option value="exact:${k}">${a.name} — ${a.ru}</option>`).join('')}</optgroup></select>`.replace(`value="${archValue}"`, `value="${archValue}" selected`);
    else if (type === 'palette') control = `<select id="${id}" data-special="palette">${[['auto', 'Автоматически по нише'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([k, v]) => `<option value="${k}"${p.palette === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'brand') control = `<select id="${id}" data-special="brand"${d}>${[['', 'Нет — подобрать по нише'], ...Object.entries(BRANDS).map(([k, b]) => [k, b.name])].map(([k, v]) => `<option value="${k}"${p.brandProfile === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    else if (type === 'fonts') control = `<select id="${id}" data-special="fonts"${d}>${[['system', 'Системные'], ['web', 'Google Fonts (с кириллицей)']].map(([k, v]) => `<option value="${k}"${p.fonts === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'accent') control = `<div class="row"><input type="color" id="${id}" data-special="accent" value="${p.accent || '#888888'}"${p.accent ? '' : ' disabled'}><input type="checkbox" id="${id}-auto" data-special="accent-auto"${p.accent ? '' : ' checked'}><label for="${id}-auto">подобрать автоматически</label></div>`;
    else control = `<input id="${id}" data-path="${path}" value="${esc(get(path))}"${d}>`;
    return `<div class="field"><label for="${id}">${label}</label>${control}${small}</div>`;
  }).join('')}</div></details>`).join('');
  $('#form').innerHTML = html;
}

// ---------- Генерация и отображение ----------
const registry = () => state.library.map(l => l.entry);

function run() {
  result = generate(state.raw, { registry: registry() });
  $('#frame').srcdoc = result.html;
  renderConcept(); renderAudit(); renderRegistry();
  persist();
}
let timer;
const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 220); };

const ul = arr => (arr.length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<span class="note">—</span>');
const kv = rows => `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

function renderConcept() {
  const c = result.concept, b = c.designBrief, d = c.designDNA, h = c.homepage, u = c.uniquenessCheck, vs = c.visualSystem;
  const name = id => (id ? `${ARCHETYPES[id].name} <span class="note">(${ARCHETYPES[id].ru})</span>` : '<span class="note">—</span>');
  const pal = vs.palette;
  const sw = [['Фон', pal.bg, pal.text], ['Поверхность', pal.surface, pal.text], ['Текст', pal.text, pal.bg], ['Вторичный текст', pal.muted, pal.bg], ['Акцент', pal.accent, pal.accentText], ['Тон', pal.tint, pal.text]];
  $('#view-concept').innerHTML = `
<h2>Design Brief</h2><div class="card">${kv([
    ['Бизнес', esc(b.businessType)], ['Продукт', esc(b.product) || '—'], ['Аудитория', esc(b.audience)], ['Целевое действие', esc(b.primaryGoal)],
    ['Характер бренда', esc(b.brandCharacter)], ['Приоритет контента', `<div class="chips">${b.contentPriority.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>`],
    ['Доказательства доверия', ul(b.trustProofs)], ['Ограничения', ul(b.constraints)], ['Гипотезы', ul(b.assumptions)],
  ])}</div>
<h2>Design DNA</h2><div class="card">${kv([
    ['Основная архитектура', name(d.primaryArchetype)], ['Вспомогательная', name(d.secondaryArchetype)], ['Обоснование', esc(d.selectionRationale)],
    ['Цвет', esc(d.colorDirection)], ['Типографика', esc(d.typographyDirection)], ['Изображения', esc(d.imageDirection)], ['Движение', esc(d.motionDirection)],
    ['Форма', esc(vs.shape.label)], ['Кнопки', esc(vs.button.label)],
  ])}</div>
<h2>Палитра и контраст</h2>
<div class="swatches">${sw.map(([n, bg, fg]) => `<div class="swatch" style="background:${bg};color:${fg}"><b>${n}</b>${bg}</div>`).join('')}</div>
<table style="margin-top:12px"><thead><tr><th>Пара</th><th>Контраст</th></tr></thead><tbody>${pal.pairs.map(p => `<tr><td>${esc(p.name)}</td><td>${p.ratio}:1 ${p.ratio >= 4.5 ? '✓' : '✗'}</td></tr>`).join('')}</tbody></table>
<h2>Главная страница</h2><div class="card">${kv([
    ['Первый экран', esc(h.heroComposition)], ['Навигация', esc(h.navigationPattern)], ['Основной CTA', esc(h.primaryCTA)],
    ['Секции', `<ol style="margin:0;padding-left:20px">${h.sections.map(s => `<li><b>${esc(s.id)}</b> — ${esc(s.role)}</li>`).join('')}</ol>`],
  ])}</div>
<h2>Антишаблонная проверка</h2><div class="card">${kv([
    ['Шаблонность', u.templateReuseDetected ? '<b style="color:var(--err)">обнаружена и не устранена</b>' : 'не обнаружена или устранена'],
    ['Найденные повторы', ul(u.repeatedPatterns)], ['Что изменено', ul(u.differentiationActions)],
    ['Сравнение с соседями', u.comparedWith.length ? ul(u.comparedWith.map(x => `${x.brand}: сходство ${Math.round(x.similarity * 100)}%`)) : '<span class="note">Реестр пуст — сохраните проекты кнопкой «В реестр», чтобы следующие генерации сравнивались с ними.</span>'],
  ])}</div>`;
}

function renderAudit() {
  const a = result.audit;
  const badge = $('#audit-badge');
  badge.textContent = a.ok ? '✓' : a.errors.length; badge.className = 'badge ' + (a.ok ? 'ok' : 'err');
  $('#view-audit').innerHTML = `<p class="summary ${a.ok ? 'ok' : 'err'}">${a.ok ? `Проверка пройдена. Предупреждений: ${a.warnings.length}.` : `Проверка не пройдена. Ошибок: ${a.errors.length}, предупреждений: ${a.warnings.length}.`}</p>
<ul class="checks">${[...a.errors, ...a.warnings, ...a.checks.filter(c => c.level === 'ok')].map(c => `<li class="${c.level}"><span>${esc(c.message)}</span></li>`).join('')}</ul>
<p class="note" style="margin-top:16px">Статическая проверка не заменяет просмотр на реальных устройствах: используйте переключатель ширины 320 / 768 в предпросмотре.</p>`;
}

function renderRegistry() {
  const badge = $('#registry-badge');
  badge.textContent = state.library.length || ''; badge.className = 'badge n';
  const fp = result.concept.uniquenessCheck.fingerprint;
  $('#view-registry').innerHTML = state.library.length ? `
<p class="note">Проекты в порядке сохранения. Новая генерация сравнивается с двумя последними: нельзя одновременно повторять архитектуру, расположение визуала и характер типографики.</p>
<table><thead><tr><th>Проект</th><th>Архитектура</th><th>Сходство с текущим</th><th></th></tr></thead><tbody>${state.library.map((l, i) => {
    const s = l.entry.id === result.project.id ? null : similarity(fp, l.entry.fingerprint);
    return `<tr><td><b>${esc(l.entry.brand)}</b></td><td>${esc(ARCHETYPES[l.entry.fingerprint.archetype]?.name || '')}</td><td>${s === null ? '<span class="note">это текущий проект</span>' : `<span class="meter"><i style="width:${s * 100}%"></i></span>${Math.round(s * 100)}%`}</td><td><button type="button" data-load="${i}">Открыть</button> <button type="button" data-del="${i}" aria-label="Удалить ${esc(l.entry.brand)} из реестра">Удалить</button></td></tr>`;
  }).join('')}</tbody></table>` : '<p class="note">Реестр пуст. Кнопка «В реестр» сохраняет проект и его визуальный «отпечаток» в этом браузере — следующие проекты будут проверяться на шаблонность относительно него.</p>';
}

// ---------- События ----------
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
function load(raw, message) {
  state.raw = exportProject(normalizeProject(raw));
  buildForm(); run();
  if (message) toast(message);
}
function download(name, text, type) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#form').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.path) set(t.dataset.path, t.value);
  else if (t.dataset.list) set(t.dataset.list, textToRows(t.value, t.dataset.list));
  else if (t.dataset.special === 'arch') {
    const [mode, id] = t.value.split(':');
    delete state.raw.designArchitecture;
    state.raw.architectureMode = mode; state.raw.architecture = mode === 'exact' ? id : 'auto';
    if (mode === 'family') state.raw.designArchitecture = id;
  } else if (t.dataset.special === 'palette') { state.raw.palette = { light: 'Светлая', dark: 'Тёмная', auto: '' }[t.value]; state.raw.paletteLocked = t.value !== 'auto'; }
  else if (t.dataset.special === 'fonts') state.raw.fonts = t.value;
  else if (t.dataset.special === 'brand') {
    if (t.value) state.raw.brandProfile = t.value; else delete state.raw.brandProfile;
    // С брендом шрифты по умолчанию веб: обновляем переключатель, чтобы он показывал фактическое значение.
    const fontsSel = document.querySelector('[data-special="fonts"]');
    if (fontsSel && !state.raw.fonts) fontsSel.value = normalizeProject(state.raw).fonts;
  }
  else if (t.dataset.special === 'accent') { state.raw.accent = t.value; state.raw.accentLocked = true; }
  else if (t.dataset.special === 'accent-auto') {
    const color = t.closest('.row').querySelector('[type=color]');
    color.disabled = t.checked; state.raw.accentLocked = !t.checked; state.raw.accent = t.checked ? '' : color.value;
  }
  schedule();
});
$('#form').addEventListener('submit', e => e.preventDefault());

const tabs = [...document.querySelectorAll('[role=tab]')];
function selectTab(tab) {
  for (const t of tabs) { const on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; $('#' + t.getAttribute('aria-controls')).hidden = !on; }
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; selectTab(n); n.focus(); }
  });
});
document.querySelectorAll('.sizes button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.sizes button').forEach(x => x.setAttribute('aria-pressed', x === b));
  const w = b.dataset.w; $('#frame').style.width = w ? w + 'px' : '100%'; $('#view-preview').classList.toggle('sized', Boolean(w));
  selectTab($('#tab-preview'));
}));

$('#new').addEventListener('click', () => load({ ...EMPTY }, 'Новый проект'));
$('#import').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('ожидался объект проекта');
    load(raw, `Импортирован проект: ${file.name}`);
  } catch (err) { toast(`Не удалось импортировать: ${err.message}`); }
});
$('#export').addEventListener('click', () => download(`${result.project.id}.json`, JSON.stringify(result.exported, null, 2) + '\n', 'application/json'));
$('#download').addEventListener('click', () => {
  download(`${result.project.id}.html`, result.html, 'text/html');
  if (!result.audit.ok) toast(`HTML скачан, но проверка не пройдена: ошибок — ${result.audit.errors.length}. См. вкладку «Проверка».`);
});
$('#prompt').addEventListener('click', async () => {
  const text = buildPrompt(result.project, result.concept);
  try { await navigator.clipboard.writeText(text); toast('Промт с концепцией скопирован в буфер обмена'); }
  catch { download(`${result.project.id}-prompt.txt`, text, 'text/plain'); }
});
$('#save').addEventListener('click', () => {
  if (!result.project.brand && !result.project.niche) return toast('Укажите бренд или нишу, чтобы сохранить проект');
  state.library = [...state.library.filter(l => l.entry.id !== result.entry.id), { raw: result.exported, entry: result.entry }];
  run(); toast(`«${result.entry.brand}» сохранён в реестр`);
});
$('#view-registry').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.load) load(state.library[b.dataset.load].raw, 'Проект открыт из реестра');
  if (b.dataset.del) { state.library.splice(Number(b.dataset.del), 1); run(); }
});

fetch('../examples/index.json').then(r => (r.ok ? r.json() : [])).then(list => {
  const sel = $('#examples');
  for (const ex of list) sel.append(Object.assign(document.createElement('option'), { value: ex.file, textContent: `${ex.brand} — ${ex.niche}` }));
  sel.addEventListener('change', async () => {
    if (!sel.value) return;
    const raw = await (await fetch('../examples/' + sel.value)).json();
    sel.value = ''; load(raw, `Открыт пример: ${raw.brand}`);
  });
  if (!state.raw.brand && !state.raw.niche && list[0]) fetch('../examples/' + list[0].file).then(r => r.json()).then(raw => load(raw));
}).catch(() => {});

buildForm();
run();
