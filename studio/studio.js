// Веб-студия: редактор проекта, живой предпросмотр, концепция, проверка и реестр проектов.
import { ARCHETYPES, BRANDS, LEGACY_LABELS, TIERS, autopilot, buildSpec, fromAiLanding, buildPrompt, exportProject, generate, normalizeProject, similarity } from '../src/engine/index.js';

const STORE = 'uds:studio:v1';
const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_IMAGE_DATA = 3_800_000;
const MAX_IMAGE_EDGE = 1800;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const $ = sel => document.querySelector(sel);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const EMPTY = { formatVersion: 2, brand: '', niche: '', architecture: 'auto', architectureMode: 'auto' };
let state = { raw: { ...EMPTY }, library: [] };
let result = null;

try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved && saved.raw) state = { raw: saved.raw, library: Array.isArray(saved.library) ? saved.library : [], analysis: saved.analysis || null };
} catch { /* хранилище недоступно — работаем без сохранения */ }
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { toast('Не удалось сохранить проект в браузере: возможно, закончилось место. Скачайте JSON, чтобы не потерять изменения.'); } };

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
    ['@tier', 'Класс', 'tier', 'Премиум и люкс меняют композицию, шрифты, палитру, кнопки и тон текстов'],
    ['@brand', 'Фирменный стиль', 'brand', 'Цвета, шрифты и скругления живого проекта. Композицию по-прежнему выбирает движок. Перекрывает «Палитру»'],
    ['@fonts', 'Шрифты', 'fonts', 'Системные — страница без внешних запросов. Google Fonts — характерные шрифты с кириллицей, одинаковые на всех устройствах'],
    ['targetAudience', 'Аудитория', 'area', 'Если пусто — будет использована явно помеченная гипотеза'],
    ['brandCharacter', 'Характер бренда'],
  ]],
  ['Изображения', false, [
    ['images.hero', 'Изображение первого экрана (URL)'], ['images.heroAlt', 'Описание изображения (alt)'],
    ['@heroUpload', 'Загрузить фото первого экрана', 'upload-hero', 'JPG/PNG/WebP: до 8 МБ до оптимизации, WebP до 1 МБ после. GIF/AVIF: до 1 МБ.'],
    ['gallery', 'Галерея', 'list', 'Одна картинка на строку: URL | Подпись'],
    ['@galleryUpload', 'Добавить фотографии в галерею', 'upload-gallery', 'Можно выбрать несколько снимков. Автооптимизация WebP; до 8 МБ исходник, до 1 МБ результат.'],
    ['@serviceUpload', 'Фото товара или услуги', 'upload-service', 'Выберите позицию и загрузите фото (автооптимизация WebP, до 8 МБ исходник).'],
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
  if (path === 'gallery') return String(r.src || '').startsWith('data:image/') ? '' : [r.src, r.caption].filter(Boolean).join(' | ');
  const a = Array.isArray(r) ? r : [r.title, r.text, r.price, r.image];
  const cells = a.map(x => x ?? '');
  if (path === 'services' && String(cells[3] || '').startsWith('data:image/')) cells[3] = '';
  while (cells.length > 1 && !cells.at(-1)) cells.pop();
  return cells.join(' | ');
}).join('\n');
function textToRows(text, path) {
  const rows = text.split('\n').map(l => l.split('|').map(s => s.trim())).filter(r => r.some(Boolean));
  if (path === 'categories') return rows.map(r => r[0]);
  if (path === 'gallery') {
    const embedded = (state.raw.gallery || []).filter(g => String(g.src || '').startsWith('data:image/'));
    return [...rows.map(r => ({ src: r[0], caption: r[1] || '', alt: r[1] || '' })), ...embedded];
  }
  if (path === 'services') return rows.map((row, i) => {
    const old = (state.raw.services || []).find(s => (Array.isArray(s) ? s[0] : s.title) === row[0]);
    const image = Array.isArray(old) ? old[3] : old?.image;
    if (String(image || '').startsWith('data:image/')) row[3] = image;
    return row;
  });
  return rows;
}

function cropEditor(role, index = 0) {
  const root = state.raw.imageArtDirection || {};
  const entry = role === 'hero' ? root.hero : (root[role] || {})[index];
  const viewports = [['desktop','Компьютер'],['tablet','Планшет'],['mobile','Телефон']];
  return '<details class="crop-editor"><summary>Кадрирование для экранов</summary>' + viewports.map(([key,label]) => { const v = entry && entry[key] || {}; return '<fieldset><legend>' + label + '</legend>' + ['x','y'].map(axis => { const n = Math.max(0,Math.min(100,Number(v[axis]) || 50)); return '<label>' + (axis === 'x' ? 'По горизонтали' : 'По вертикали') + ' <output>' + n + '%</output><input type="range" min="0" max="100" value="' + n + '" data-crop="' + role + '" data-crop-index="' + index + '" data-crop-viewport="' + key + '" data-crop-axis="' + axis + '"></label>'; }).join('') + '</fieldset>'; }).join('') + '<p class="note">0% — левый/верхний край, 50% — центр, 100% — правый/нижний край.</p></details>';
}
function writeCrop(role, index, viewport, axis, value) {
  const root = state.raw.imageArtDirection || (state.raw.imageArtDirection = {});
  const bucket = role === 'hero' ? (root.hero || (root.hero = {})) : ((root[role] || (root[role] = {}))[index] || (root[role][index] = {}));
  bucket[viewport] = bucket[viewport] || { x: 50, y: 50 };
  bucket[viewport][axis] = Math.max(0, Math.min(100, Number(value) || 0));
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
    else if (type === 'tier') control = `<select id="${id}" data-special="tier"${d}>${Object.entries(TIERS).map(([k, v]) => `<option value="${k}"${p.tier === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'brand') control = `<select id="${id}" data-special="brand"${d}>${[['', 'Нет — подобрать по нише'], ...Object.entries(BRANDS).map(([k, b]) => [k, b.name])].map(([k, v]) => `<option value="${k}"${p.brandProfile === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    else if (type === 'fonts') control = `<select id="${id}" data-special="fonts"${d}>${[['system', 'Системные'], ['web', 'Google Fonts (с кириллицей)']].map(([k, v]) => `<option value="${k}"${p.fonts === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'accent') control = `<div class="row"><input type="color" id="${id}" data-special="accent" value="${p.accent || '#888888'}"${p.accent ? '' : ' disabled'}><input type="checkbox" id="${id}-auto" data-special="accent-auto"${p.accent ? '' : ' checked'}><label for="${id}-auto">подобрать автоматически</label></div>`;
    else if (type === 'upload-hero') control = `<input id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="hero"><div class="media-preview">${p.images.hero ? `<figure><img src="${esc(p.images.hero)}" alt=""><button type="button" data-remove-image="hero">Удалить фото</button></figure>${cropEditor("hero")}` : '<span class="note">Фото пока не загружено — будет использован графический мотив.</span>'}</div>`;
    else if (type === 'upload-gallery') control = `<input id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple data-upload="gallery"><div class="media-preview media-preview--grid">${(p.gallery || []).map((g,i) => `<figure><img src="${esc(g.src)}" alt="${esc(g.alt)}"><figcaption>${esc(g.caption || `Фото ${i+1}`)}</figcaption><button type="button" data-remove-image="gallery:${i}">Удалить</button>${cropEditor("gallery", i)}</figure>`).join('') || '<span class="note">Галерея пока пуста.</span>'}</div>`;
    else if (type === 'upload-service') { const services = Array.isArray(state.raw.services) ? state.raw.services : []; control = `<label for="${id}-target">Для какой позиции</label><select id="${id}-target" data-service-target>${services.map((s,i) => `<option value="${i}">${esc(Array.isArray(s) ? s[0] : s.title || `Позиция ${i+1}`)}</option>`).join('') || '<option value="">Сначала добавьте позиции выше</option>'}</select><input id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="service"><div class="media-preview media-preview--grid">${services.map((s,i) => { const src = Array.isArray(s) ? s[3] : s.image; return src ? `<figure><img src="${esc(src)}" alt=""><figcaption>${esc(Array.isArray(s) ? s[0] : s.title || `Позиция ${i+1}`)}</figcaption><button type="button" data-remove-image="service:${i}">Удалить</button>${cropEditor("services", i)}</figure>` : ''; }).join('') || '<span class="note">Пока нет фотографий товаров и услуг.</span>'}</div>`; }
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
  renderSpec(); renderConcept(); renderAudit(); renderRegistry();
  persist();
}

// ---------- ТЗ и анализ ----------
// Анализ хранится вместе с проектом, для которого его сделал автопилот; у проектов из редактора — пусто.
const currentAnalysis = () => (state.analysis && state.analysis.projectId === state.raw.id ? state.analysis.data : null);
function renderSpec() {
  const a = currentAnalysis();
  const spec = buildSpec(result.project, result.concept, a || {});
  const src = a && a.sources && a.sources.length
    ? `<h2>Источники исследования</h2><ul class="chips-src">${a.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>` : '';
  $('#view-spec').innerHTML = `
<div class="spec-actions"><button type="button" data-spec="copy">Скопировать ТЗ</button><button type="button" data-spec="md">Скачать ТЗ (.md)</button><button type="button" data-spec="prompt">Скопировать промт для нейросети</button></div>
<p class="note">${a ? (a.source === 'ai' ? 'Анализ и тексты подготовил AI с поиском в интернете — проверьте факты по источникам.' : 'Анализ и тексты собраны локальным автопилотом по знаниям о нише — это стартовая гипотеза. Для исследования в интернете укажите адрес AI-сервера в автопилоте или отдайте промт нейросети.') : 'ТЗ собрано по текущему проекту. Автопилот добавит сюда анализ аудитории, возражения, поводы и ключевые запросы.'}</p>
<pre class="spec">${esc(spec)}</pre>${src}`;
}
$('#view-spec').addEventListener('click', async e => {
  const b = e.target.closest('[data-spec]'); if (!b) return;
  const a = currentAnalysis() || {};
  const copy = async (text, ok, file) => { try { await navigator.clipboard.writeText(text); toast(ok); } catch { download(file, text, 'text/plain'); } };
  if (b.dataset.spec === 'copy') copy(buildSpec(result.project, result.concept, a), 'ТЗ скопировано', `${result.project.id}-tz.md`);
  if (b.dataset.spec === 'md') download(`${result.project.id}-tz.md`, buildSpec(result.project, result.concept, a), 'text/markdown');
  if (b.dataset.spec === 'prompt') copy(buildPrompt(result.project, result.concept, a), 'Промт скопирован', `${result.project.id}-prompt.txt`);
});

// ---------- Автопилот ----------
try { $('#auto-endpoint').value = localStorage.getItem('uds:ai-endpoint') || ''; } catch { /* нет хранилища */ }
$('#auto').addEventListener('submit', async e => {
  e.preventDefault();
  const input = {
    niche: $('#auto-niche').value.trim(), tier: $('#auto-tier').value, brand: $('#auto-brand').value.trim(), city: $('#auto-city').value.trim(),
    details: $('#auto-details').value.trim(), email: $('#auto-email').value.trim(), phone: $('#auto-phone').value.trim(),
  };
  if (!input.niche) return $('#auto-niche').focus();
  const endpoint = $('#auto-endpoint').value.trim();
  try { localStorage.setItem('uds:ai-endpoint', endpoint); } catch { /* нет хранилища */ }
  const status = $('#auto-status'), go = $('#auto-go');
  go.disabled = true;
  let draft = null, note = '';
  if (endpoint) {
    status.textContent = 'AI изучает нишу в интернете и пишет тексты — обычно это занимает до минуты…';
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.landing) throw new Error(body.error || `сервер ответил ${res.status}`);
      draft = fromAiLanding(body.landing, input);
      note = `Готово: AI изучил нишу${draft.analysis.sources.length ? ` (источников: ${draft.analysis.sources.length})` : ''} и написал тексты.`;
    } catch (err) {
      note = `AI-сервер недоступен (${err.message}). Собрал сайт локальным автопилотом без интернета.`;
    }
  }
  if (!draft) {
    const local = autopilot(input, { registry: registry() });
    draft = { project: local.project, analysis: local.analysis };
    if (!note) note = 'Готово: сайт собран локальным автопилотом. Тексты — стартовая гипотеза, проверьте вкладку «ТЗ и анализ».';
  }
  state.analysis = { projectId: draft.project.id, data: draft.analysis };
  load(draft.project);
  status.textContent = note;
  go.disabled = false;
  selectTab($('#tab-preview'));
  toast(note);
});
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

let imageAuditRun = 0;
function collectImageAssets() {
  const out = [];
  const hero = state.raw.images?.hero;
  if (hero) out.push({ role: 'hero', label: 'Первый экран', src: hero });
  (state.raw.gallery || []).forEach((g, i) => { if (g?.src) out.push({ role: 'gallery', label: g.caption || `Галерея ${i + 1}`, src: g.src }); });
  (state.raw.services || []).forEach((s, i) => {
    const src = Array.isArray(s) ? s[3] : s?.image;
    if (src) out.push({ role: 'service', label: Array.isArray(s) ? s[0] : s.title || `Позиция ${i + 1}`, src });
  });
  return out;
}
function inspectImage(asset) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth, height = img.naturalHeight, ratio = width / Math.max(1, height);
      const warnings = [], tips = [], minSide = Math.min(width, height);
      if (asset.role === 'hero' && (width < 1200 || height < 650)) warnings.push('Для первого экрана разрешение может быть маловато; ориентир — от 1600 × 900 px.');
      if (asset.role === 'gallery' && minSide < 700) warnings.push('Для галереи желательно не менее 700 px по короткой стороне.');
      if (asset.role === 'service' && minSide < 600) warnings.push('Для карточки товара или услуги желательно не менее 600 px по короткой стороне.');
      if (asset.role === 'hero') {
        if (ratio < 1.25) tips.push('Широкий экран: кадр может выглядеть тесно. Подготовьте горизонтальную версию около 16:9.');
        if (ratio > 2.1) tips.push('Мобильный экран: при заполнении блока по ширине верх и низ могут обрезаться. Проверьте важный объект в центральной безопасной зоне или подготовьте вертикальный кадр 4:5.');
        else tips.push('Мобильный экран: проверьте, что главный объект остаётся в центральной части кадра; для портретного блока лучше отдельный кадр 4:5.');
      } else if (asset.role === 'service') {
        if (ratio < 0.78 || ratio > 1.35) tips.push('Карточка обычно лучше смотрится с квадратным кадром 1:1; при обрезке проверьте, что товар целиком виден.');
      } else if (ratio < 0.72 || ratio > 1.8) tips.push('Галерея: необычные пропорции могут обрезаться в сетке. Проверьте кадрирование и главный объект.');
      let brightness = null, detail = null;
      if (asset.src.startsWith('data:image/')) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 64; canvas.height = 64;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0, 64, 64);
            const pixels = ctx.getImageData(0, 0, 64, 64).data;
            let sum = 0, count = 0, edges = 0, edgeCount = 0, prev = null;
            for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
              const i = (y * 64 + x) * 4;
              const l = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
              sum += l; count++;
              if (x && prev !== null) { edges += Math.abs(l - prev); edgeCount++; }
              if (y) { const up = ((y - 1) * 64 + x) * 4; const ul = .2126 * pixels[up] + .7152 * pixels[up + 1] + .0722 * pixels[up + 2]; edges += Math.abs(l - ul); edgeCount++; }
              prev = l;
            }
            brightness = count ? sum / count : null;
            detail = edgeCount ? edges / edgeCount : null;
          }
        } catch { /* Проверка пикселей может быть недоступна для отдельных форматов. */ }
      }
      if (brightness !== null && brightness < 48) warnings.push('Кадр выглядит очень тёмным по средней яркости; проверьте детали в тенях.');
      if (detail !== null && detail < 5) warnings.push('Мало мелких деталей на уменьшенной копии: возможна мягкость или расфокус. Проверьте фото визуально.');
      resolve({ ...asset, width, height, ratio, warnings, tips, brightness, detail });
    };
    img.onerror = () => resolve({ ...asset, error: 'Не удалось прочитать изображение. Проверьте ссылку или формат.', warnings: [], tips: [] });
    img.src = asset.src;
  });
}
async function renderImageIntelligence() {
  const host = $('#image-intelligence');
  if (!host) return;
  const token = ++imageAuditRun;
  const assets = collectImageAssets();
  if (!assets.length) { host.innerHTML = '<p class="note">Фотографии пока не добавлены. Загрузите снимки в разделе «Изображения», чтобы проверить их качество и кадрирование.</p>'; return; }
  host.innerHTML = '<p class="note">Проверяем разрешение, пропорции, яркость и детализацию загруженных фотографий…</p>';
  const reports = await Promise.all(assets.map(inspectImage));
  if (token !== imageAuditRun || !host.isConnected) return;
  const warningCount = reports.reduce((n, r) => n + r.warnings.length, 0);
  const sourceCounts = new Map();
  reports.forEach(r => sourceCounts.set(r.src, (sourceCounts.get(r.src) || 0) + 1));
  const duplicateCount = [...sourceCounts.values()].filter(n => n > 1).reduce((n, count) => n + count - 1, 0);
  const missingRoles = ['hero','gallery','service'].filter(role => !reports.some(r => r.role === role));
  const visual = renderVisualAssetDirector(reports, duplicateCount, missingRoles);
  host.innerHTML = `<p class="summary ${warningCount || duplicateCount ? 'err' : 'ok'}">Проверено изображений: ${reports.length}. Замечаний по качеству: ${warningCount}. Возможных повторов: ${duplicateCount}.</p>
  <div class="image-audit-grid">${reports.map(r => `<article class="image-audit-card">
    <div class="image-audit-head"><b>${esc(r.label)}</b><span class="note">${r.role === 'hero' ? 'Первый экран' : r.role === 'service' ? 'Карточка' : 'Галерея'}</span></div>
    <div class="image-audit-body"><img src="${esc(r.src)}" alt="" loading="lazy"><div><b>${r.error ? 'Не удалось проверить' : `${r.width} × ${r.height} px`}</b><span class="note">${r.error ? esc(r.error) : `Пропорции: ${r.ratio.toFixed(2)}:1`}</span>
    ${r.warnings.map(w => `<p class="image-audit-warning">${esc(w)}</p>`).join('')}${r.tips.map(t => `<p class="image-audit-tip">${esc(t)}</p>`).join('')}${!r.warnings.length && !r.tips.length && !r.error ? '<p class="image-audit-ok">Явных проблем по базовым параметрам не обнаружено.</p>' : ''}</div></div>
  </article>`).join('')}</div>
  ${visual}
  <p class="note">Автоматическая оценка — ориентир, а не экспертное распознавание сюжета. Реальное размытие, важный объект и точку обрезки обязательно проверьте в предпросмотре на ширине 320, 768 и 1280 px.</p>`;
}
function renderVisualAssetDirector(reports, duplicateCount, missingRoles) {
  const p = normalizeProject(state.raw);
  const dna = result.concept?.designDNA || {};
  const direction = dna.imageDirection || result.analysis?.imageDirection || 'естественный свет, выразительная композиция и честные детали';
  const style = [p.tier === 'luxury' ? 'редакционная премиальная съёмка, много воздуха' : p.tier === 'premium' ? 'профессиональный естественный свет, аккуратный фон' : 'чистый естественный свет, живые цвета', dna.colorDirection].filter(Boolean).join('; ');
  const sourcePrompts = result.analysis?.imagePrompts || [];
  const roleLabels = { hero: 'Первый экран', gallery: 'Галерея и детали', service: 'Товары и услуги' };
  const fallback = {
    hero: `Для сайта «${p.brand || p.niche}»: главный выразительный кадр по теме «${p.niche}». ${direction}. ${style}. Горизонтальный 16:9, оставьте свободную область под заголовок, без текста и водяных знаков.`,
    gallery: `Фоторепортаж для сайта «${p.brand || p.niche}» о нише «${p.niche}»: реальные детали, фактуры и атмосфера. ${direction}. ${style}. Разнообразные планы, естественный свет, без надписей и водяных знаков.`,
    service: `Предметная фотография для карточки товара или услуги в нише «${p.niche}». Покажите реальный объект целиком и его важные детали. ${direction}. ${style}. Квадратный кадр 1:1, чистый фон, без текста и водяных знаков.`
  };
  const prompts = {
    hero: sourcePrompts[0] || fallback.hero,
    gallery: sourcePrompts[4] || fallback.gallery,
    service: sourcePrompts[1] || fallback.service
  };
  const coverage = ['hero','gallery','service'].map(role => {
    const count = reports.filter(r => r.role === role).length;
    return `<span class="asset-coverage ${count ? 'is-present' : 'is-missing'}">${esc(roleLabels[role])}: ${count ? count + ' шт.' : 'нет'}</span>`;
  }).join('');
  const notes = [];
  if (duplicateCount) notes.push(`Обнаружено ${duplicateCount} точных повторов одного и того же источника. Проверьте, не используется ли один кадр вместо разных ракурсов.`);
  if (missingRoles.length) notes.push(`Не заполнены роли: ${missingRoles.map(r => roleLabels[r]).join(', ')}. Это не ошибка для каждого типа сайта, но проверьте, нужны ли эти материалы.`);
  const promptCards = Object.entries(prompts).map(([role,prompt]) => `<article class="asset-prompt"><div><b>${esc(roleLabels[role])}</b><p>${esc(prompt)}</p></div><button type="button" data-copy-asset-prompt="${esc(prompt)}">Копировать промпт</button></article>`).join('');
  return `<section class="visual-asset-director" aria-labelledby="visual-asset-title">
    <h3 id="visual-asset-title">Visual Asset Director</h3>
    <p class="note">Сверка состава и визуального задания проекта. Ниша: <b>${esc(p.niche || 'не указана')}</b>; бренд: <b>${esc(p.brand || 'не указан')}</b>. Направление: ${esc(direction)}. Стиль: ${esc(style || 'автоматический')}.</p>
    <div class="asset-coverage-list">${coverage}</div>
    ${notes.length ? `<ul class="asset-director-notes">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="image-audit-ok">Повторов источника не обнаружено; все основные роли представлены.</p>'}
    <h4>Задания на замену или новую съёмку</h4>
    <p class="note">Промпты учитывают нишу и дизайн-направление проекта. Перед публикацией проверьте, что изображение действительно показывает ваш товар, услугу, помещение или команду.</p>
    <div class="asset-prompt-list">${promptCards}</div>
    <p class="note">Проверка не видит семантическое содержание фотографии и не может подтвердить соответствие сюжета нише. Она оценивает структуру материалов, точные повторы и технические признаки; визуальную релевантность подтверждает человек.</p>
  </section>`;
}
function renderAudit() {
  const a = result.audit;
  const badge = $('#audit-badge');
  badge.textContent = a.ok ? '✓' : a.errors.length; badge.className = 'badge ' + (a.ok ? 'ok' : 'err');
  $('#view-audit').innerHTML = `<p class="summary ${a.ok ? 'ok' : 'err'}">${a.ok ? `Проверка пройдена. Предупреждений: ${a.warnings.length}.` : `Проверка не пройдена. Ошибок: ${a.errors.length}, предупреждений: ${a.warnings.length}.`}</p>
<ul class="checks">${[...a.errors, ...a.warnings, ...a.checks.filter(c => c.level === 'ok')].map(c => `<li class="${c.level}"><span>${esc(c.message)}</span></li>`).join('')}</ul>
<h2 class="audit-section-title">Image Intelligence — проверка фотографий</h2><div id="image-intelligence" aria-live="polite"></div>
<p class="note" style="margin-top:16px">Статическая проверка не заменяет просмотр на реальных устройствах: используйте переключатель ширины 320 / 768 в предпросмотре.</p>`;
  renderImageIntelligence();
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
  if (t.dataset.crop) { writeCrop(t.dataset.crop, Number(t.dataset.cropIndex), t.dataset.cropViewport, t.dataset.cropAxis, t.value); const output = t.parentElement.querySelector('output'); if (output) output.value = t.value + '%'; }
  else if (t.dataset.path) set(t.dataset.path, t.value);
  else if (t.dataset.list) set(t.dataset.list, textToRows(t.value, t.dataset.list));
  else if (t.dataset.special === 'arch') {
    const [mode, id] = t.value.split(':');
    delete state.raw.designArchitecture;
    state.raw.architectureMode = mode; state.raw.architecture = mode === 'exact' ? id : 'auto';
    if (mode === 'family') state.raw.designArchitecture = id;
  } else if (t.dataset.special === 'palette') { state.raw.palette = { light: 'Светлая', dark: 'Тёмная', auto: '' }[t.value]; state.raw.paletteLocked = t.value !== 'auto'; }
  else if (t.dataset.special === 'fonts') state.raw.fonts = t.value;
  else if (t.dataset.special === 'tier') state.raw.tier = t.value;
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
function imageDataSize() {
  const values = [state.raw.images?.hero, ...(state.raw.gallery || []).map(g => g.src), ...(state.raw.services || []).map(s => Array.isArray(s) ? s[3] : s.image)];
  return values.filter(v => typeof v === 'string' && v.startsWith('data:image/')).reduce((n, v) => n + v.length, 0);
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать обработанное изображение.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}
function canvasBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}
async function optimizeImage(file) {
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Формат не поддерживается. Выберите JPG, PNG, WebP, GIF или AVIF.');
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('Исходный файл больше 8 МБ. Выберите изображение меньшего размера.');
  const preserveOriginal = file.type === 'image/gif' || file.type === 'image/avif';
  if (preserveOriginal) {
    if (file.size > MAX_IMAGE_BYTES) throw new Error('GIF и AVIF сохраняются без преобразования, чтобы не потерять анимацию или особенности формата. Для этого файла нужен размер до 1 МБ.');
    return { data: await blobToDataUrl(file), originalBytes: file.size, finalBytes: file.size, optimized: false };
  }
  if (typeof createImageBitmap !== 'function') {
    if (file.size <= MAX_IMAGE_BYTES) return { data: await blobToDataUrl(file), originalBytes: file.size, finalBytes: file.size, optimized: false };
    throw new Error('Этот браузер не поддерживает оптимизацию изображений. Попробуйте современный Chrome, Edge или Firefox.');
  }
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { 
    if (file.size <= MAX_IMAGE_BYTES) return { data: await blobToDataUrl(file), originalBytes: file.size, finalBytes: file.size, optimized: false };
    throw new Error('Не удалось открыть изображение для оптимизации. Проверьте файл или сохраните его как JPG/PNG.');
  }
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const initialWidth = Math.max(1, Math.round(bitmap.width * scale));
    const initialHeight = Math.max(1, Math.round(bitmap.height * scale));
    const edges = [...new Set([Math.max(initialWidth, initialHeight), 1400, 1100, 900, 720, 540, 360, 240].filter(n => n <= Math.max(initialWidth, initialHeight) && n > 0))];
    for (const edge of edges) {
      const factor = Math.min(1, edge / Math.max(initialWidth, initialHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(initialWidth * factor));
      canvas.height = Math.max(1, Math.round(initialHeight * factor));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Не удалось создать холст для оптимизации фотографии.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        const blob = await canvasBlob(canvas, 'image/webp', quality);
        if (!blob || blob.type !== 'image/webp') break;
        if (blob.size <= MAX_IMAGE_BYTES) {
          const data = await blobToDataUrl(blob);
          return { data, originalBytes: file.size, finalBytes: blob.size, optimized: true, width: canvas.width, height: canvas.height };
        }
      }
    }
    throw new Error('После оптимизации фото всё ещё больше 1 МБ. Выберите другой снимок или уменьшите исходное разрешение.');
  } finally { bitmap.close?.(); }
}
async function handleImageUpload(input) {
  const kind = input.dataset.upload, files = [...(input.files || [])];
  input.value = '';
  if (!files.length) return;
  if (kind === 'service' && !Array.isArray(state.raw.services)) return toast('Сначала добавьте позиции в разделе «Каталог / услуги / меню».');
  const target = kind === 'service' ? Number($('#f--serviceUpload-target')?.value) : -1;
  if (kind === 'service' && (!Number.isInteger(target) || target < 0 || target >= state.raw.services.length)) return toast('Выберите позицию товара или услуги.');
  let added = 0;
  for (const file of files) {
    try {
      const optimized = await optimizeImage(file);
      const data = optimized.data;
      const current = kind === 'hero' ? state.raw.images?.hero : kind === 'service' ? (Array.isArray(state.raw.services[target]) ? state.raw.services[target][3] : state.raw.services[target].image) : '';
      const replacingSize = typeof current === 'string' && current.startsWith('data:image/') ? current.length : 0;
      if (imageDataSize() - replacingSize + data.length > MAX_IMAGE_DATA) throw new Error('Общий объём загруженных фото превышает лимит 3,8 МБ. Удалите лишние снимки или уменьшите их размер.');
      const imageName = file.name.replace(/\.[^.]+$/, '');
      if (kind === 'hero') state.raw.images = { ...(state.raw.images || {}), hero: data, heroAlt: state.raw.images?.heroAlt || imageName };
      else if (kind === 'gallery') state.raw.gallery = [...(state.raw.gallery || []), { src: data, caption: imageName, alt: imageName }];
      else { const row = state.raw.services[target]; const cells = Array.isArray(row) ? [...row] : [row.title || '', row.text || row.description || '', row.price || '']; cells[3] = data; state.raw.services[target] = cells; }
      added++;
      if (optimized.optimized) toast('Фото оптимизировано: ' + (optimized.width + '×' + optimized.height) + ', ' + Math.round(optimized.finalBytes / 1024) + ' КБ вместо ' + Math.round(optimized.originalBytes / 1024) + ' КБ');
    } catch (err) { toast(err.message); }
  }
  if (added) { buildForm(); run(); toast(added === 1 ? 'Фотография добавлена в проект' : 'Добавлено фотографий: ' + added); }
}
$('#form').addEventListener('change', e => { const input = e.target.closest('[data-upload]'); if (input) handleImageUpload(input); });
$('#form').addEventListener('click', e => {
  const b = e.target.closest('[data-remove-image]'); if (!b) return;
  const [kind, index] = b.dataset.removeImage.split(':');
  if (kind === 'hero') state.raw.images = { ...(state.raw.images || {}), hero: '' };
  if (kind === 'gallery') state.raw.gallery.splice(Number(index), 1);
  if (kind === 'service') { const row = state.raw.services[Number(index)]; if (Array.isArray(row)) row[3] = ''; else row.image = ''; }
  buildForm(); run(); toast('Фотография удалена из проекта');
});
$('#form').addEventListener('submit', e => e.preventDefault());
$('#view-audit').addEventListener('click', async e => {
  const button = e.target.closest('[data-copy-asset-prompt]');
  if (!button) return;
  try { await navigator.clipboard.writeText(button.dataset.copyAssetPrompt); toast('Промпт скопирован'); }
  catch { toast('Не удалось скопировать. Выделите текст промпта вручную.'); }
});

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
