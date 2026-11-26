// Библиотека шаблонов: формат профиля, нормализация, импорт/экспорт, подбор профилей под нишу
// и превращение профилей в «референсы» для генератора. Без DOM и сети — работает в браузере и в Node.
import { ARCHETYPES, SHAPES, TYPES, NAV_LABELS } from './data.js';
import { detectNiche } from './concept.js';
import { normalizeHex } from './color.js';
import { hash, str } from './util.js';

export const LIBRARY_KEY = 'uds:template-library:v1';
export const LIBRARY_VERSION = 2;
export const SECTION_IDS = ['about', 'items', 'advantages', 'process', 'gallery', 'pricing', 'cases', 'comparisons', 'metrics', 'beforeAfter', 'calculator', 'quiz', 'faq', 'contact'];
export const SECTION_LABELS = { about: 'О компании', items: 'Каталог / услуги', advantages: 'Преимущества', process: 'Этапы', gallery: 'Галерея', pricing: 'Тарифы и пакеты', cases: 'Кейсы и результаты', comparisons: 'Сравнение вариантов', metrics: 'Данные и показатели', beforeAfter: 'До и после', calculator: 'Предварительный расчёт', quiz: 'Подбор по квизу', testimonials: 'Отзывы клиентов', team: 'Команда', stats: 'Показатели', faq: 'Вопросы', contact: 'Контакты' };

/** Категория → профили ниш движка, для которых шаблон уместен. Первые восемь — категории формата v1. */
export const CATEGORY_NICHES = {
  'Универсальный': [],
  'Интернет-магазин': ['shop', 'appliances', 'optics', 'gifts', 'seafood', 'boutique'],
  'Услуги и бизнес': ['generic', 'construction', 'proservices', 'multi', 'events'],
  'Каталог': ['shop', 'appliances', 'optics', 'multi'],
  'Портфолио': ['photo', 'studio'],
  'Beauty': ['beauty'],
  'Недвижимость': ['construction', 'proservices'],
  'Кафе и рестораны': ['cafe', 'seafood'],
  'Медицина': ['medical'],
  'Образование': ['education'],
  'IT и цифровые продукты': ['saas'],
  'Спорт и фитнес': ['fitness'],
  'События': ['events'],
  'Премиум и люкс': ['boutique'],
  'Другое': [],
};
export const CATEGORIES = Object.keys(CATEGORY_NICHES);

/** Схема редактируемого профиля: группы и поля. kind: lines — список строк, palette — цвета с ролями. */
export const PROFILE_GROUPS = [
  { id: 'structure', title: 'Структура', fields: [
    ['pageStructure', 'Структура страниц'], ['blocks', 'Список и порядок блоков'], ['navigation', 'Навигация'], ['cards', 'Карточки'],
    ['forms', 'Формы'], ['cta', 'CTA-кнопки'], ['features', 'Функциональные элементы'] ] },
  { id: 'visual', title: 'Визуальная система', fields: [
    ['palette', 'Цветовая палитра', 'palette'], ['contrast', 'Контрастность'], ['typography', 'Типографика'], ['headingSizes', 'Размеры заголовков'],
    ['composition', 'Композиция'], ['grid', 'Сетка'], ['spacing', 'Отступы'], ['radii', 'Радиусы и формы элементов'], ['hierarchy', 'Визуальная иерархия'] ] },
  { id: 'ux', title: 'UX-паттерны', fields: [
    ['userPath', 'Путь пользователя'], ['actions', 'Расположение основных действий'], ['navUx', 'Удобство навигации'],
    ['mobile', 'Мобильная версия'], ['issues', 'Возможные проблемы интерфейса'] ] },
  { id: 'content', title: 'Контент', fields: [
    ['headingTypes', 'Типы заголовков'], ['benefits', 'Подача преимуществ'], ['offer', 'Структура коммерческого предложения'],
    ['cardTypes', 'Типы карточек'], ['ctaLogic', 'Логика CTA'] ] },
  { id: 'ideas', title: 'Оригинальное применение', fields: [['ideas', 'Идеи для оригинального применения']] },
];
export const PROFILE_FIELDS = PROFILE_GROUPS.flatMap(g => g.fields.map(([key, label, kind = 'lines']) => ({ key, label, kind, group: g.id })));

const clip = (v, n) => str(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
const httpUrl = v => { try { const u = new URL(str(v)); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const lines = v => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\n+/) : []).map(x => clip(x, 400)).filter(Boolean).slice(0, 60);
const isoDate = (v, fallback) => { const d = new Date(v); return v && !Number.isNaN(d.getTime()) ? d.toISOString() : fallback; };
export const newId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now().toString(36)}-${hash(String(Math.random())).toString(36)}`);

/** Палитра из массива объектов или строк вида «#aabbcc — роль». */
export function parsePalette(value) {
  const rows = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\n+/) : [];
  const out = [];
  for (const row of rows) {
    let hex = '', role = '';
    if (row && typeof row === 'object') { hex = normalizeHex(row.hex); role = clip(row.role, 60); }
    else { const m = /#?([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(str(row)); if (m) { hex = normalizeHex(m[1]); role = clip(str(row).replace(m[0], '').replace(/^[\s—–:-]+/, ''), 60); } }
    if (hex && !out.some(p => p.hex === hex)) out.push({ hex, role });
  }
  return out.slice(0, 12);
}
export const paletteToText = palette => (palette || []).map(p => `${p.hex}${p.role ? ' — ' + p.role : ''}`).join('\n');

export function normalizeTraits(raw) {
  const t = raw && typeof raw === 'object' ? raw : {};
  const list = (v, ok) => [...new Set((Array.isArray(v) ? v : []).map(x => str(x).toLowerCase()).filter(ok))];
  const one = (v, dict) => (Object.hasOwn(dict, str(v).toLowerCase()) ? str(v).toLowerCase() : '');
  return {
    archetypes: list(t.archetypes, id => Object.hasOwn(ARCHETYPES, id)).slice(0, 3),
    sectionOrder: list(t.sectionOrder, id => SECTION_IDS.includes(id)),
    nav: one(t.nav, NAV_LABELS), shape: one(t.shape, SHAPES), typeCharacter: one(t.typeCharacter, TYPES),
    mode: ['light', 'dark'].includes(t.mode) ? t.mode : '',
    heroVisual: ['video', 'background', 'image', 'none'].includes(t.heroVisual) ? t.heroVisual : '',
    heroForm: Boolean(t.heroForm),
  };
}

/** Приводит запись библиотеки (в том числе формата v1 из PR №36) к текущему формату. Ничего не выдумывает: пустое остаётся пустым. */
export function normalizeTemplate(raw, now = new Date().toISOString()) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const rp = r.profile && typeof r.profile === 'object' ? r.profile : {};
  const profile = {};
  for (const f of PROFILE_FIELDS) profile[f.key] = f.kind === 'palette' ? parsePalette(rp[f.key]) : lines(rp[f.key]);
  const ra = r.analysis && typeof r.analysis === 'object' ? r.analysis : {};
  const filled = PROFILE_FIELDS.some(f => profile[f.key].length);
  const source = ['worker', 'html', 'manual'].includes(ra.source) ? ra.source : filled ? 'manual' : 'none';
  const prov = r.provenance && typeof r.provenance === 'object' ? r.provenance : {};
  const createdAt = isoDate(r.createdAt, now);
  return {
    formatVersion: LIBRARY_VERSION,
    id: clip(r.id, 80) || newId(),
    name: clip(r.name, 120) || 'Без названия',
    category: clip(r.category, 60) || 'Универсальный',
    business: clip(r.business, 160),
    url: httpUrl(r.url),
    pages: [...new Set((Array.isArray(r.pages) ? r.pages : []).map(httpUrl).filter(Boolean))].slice(0, 20),
    notes: clip(r.notes, 4000),
    createdAt, updatedAt: isoDate(r.updatedAt, createdAt),
    status: !filled ? 'source-saved' : source === 'manual' ? 'manual' : 'analyzed',
    analysis: {
      source, analyzedAt: source === 'none' ? '' : isoDate(ra.analyzedAt, createdAt),
      pages: (Array.isArray(ra.pages) ? ra.pages : []).slice(0, 21).map(p => ({ url: httpUrl(p && p.url), status: p && p.status === 'ok' ? 'ok' : 'error', note: clip(p && p.note, 300) })),
      warnings: lines(ra.warnings).slice(0, 20),
    },
    profile,
    traits: normalizeTraits(r.traits),
    provenance: Object.fromEntries(PROFILE_FIELDS.filter(f => profile[f.key].length).map(f => [f.key, prov[f.key] === 'auto' && source !== 'manual' ? 'auto' : 'manual'])),
  };
}

export const normalizeLibrary = list => (Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object').slice(0, 500).map(x => normalizeTemplate(x));
export const isProfileEmpty = t => !PROFILE_FIELDS.some(f => (t.profile[f.key] || []).length);

export function duplicateTemplate(t, now = new Date().toISOString()) {
  return normalizeTemplate({ ...JSON.parse(JSON.stringify(t)), id: newId(), name: `${t.name} (копия)`.slice(0, 120), createdAt: now, updatedAt: now }, now);
}

export function exportLibrary(items) {
  return { app: 'unique-design-studio', kind: 'template-library', version: LIBRARY_VERSION, exportedAt: new Date().toISOString(), templates: items };
}

/** Разбирает импортируемый JSON: массив v1, объект {version, templates} или один шаблон. */
export function parseLibraryImport(data) {
  const incoming = Array.isArray(data) ? data : data && Array.isArray(data.templates) ? data.templates : data && typeof data === 'object' && (data.name || data.url) ? [data] : null;
  if (!incoming) throw new Error('В файле нет списка шаблонов (ожидается массив или поле templates)');
  const valid = incoming.filter(x => x && typeof x === 'object' && !Array.isArray(x));
  return { templates: normalizeLibrary(valid), rejected: incoming.length - Math.min(valid.length, 500) };
}

/** Слияние при импорте: новые добавляются, совпавшие по id обновляются, только если импортируемая запись новее. */
export function mergeLibrary(existing, incoming) {
  const out = [...existing];
  let added = 0, updated = 0, skipped = 0;
  for (const t of incoming) {
    const i = out.findIndex(x => x.id === t.id);
    if (i < 0) { out.unshift(t); added++; }
    else if (t.updatedAt > out[i].updatedAt) { out[i] = t; updated++; }
    else skipped++;
  }
  return { items: out.slice(0, 500), added, updated, skipped };
}

export function filterLibrary(items, { query = '', category = '' } = {}) {
  const q = str(query).toLowerCase();
  return items.filter(t => {
    if (category && t.category !== category) return false;
    if (!q) return true;
    const hay = [t.name, t.category, t.business, t.url, t.notes, ...PROFILE_FIELDS.flatMap(f => (f.kind === 'palette' ? t.profile[f.key].map(p => `${p.hex} ${p.role}`) : t.profile[f.key]))].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  });
}

// ---------- Подбор профилей под новый проект ----------
const STOP = new Set(['сайт', 'сайта', 'сайты', 'магазин', 'интернет', 'компания', 'услуги', 'студия', 'для', 'это', 'premium', 'site', 'shop', 'template', 'шаблон']);
const stems = text => new Set(str(text).toLowerCase().split(/[^a-zа-яё0-9]+/i).filter(w => w.length >= 4 && !STOP.has(w)).map(w => w.slice(0, 5)));

/**
 * Подбирает профили библиотеки, уместные для ниши.
 * @returns {Array<{template, score, why:string[]}>} не больше limit, по убыванию уместности
 */
export function matchTemplates(library, input = {}, { limit = 3 } = {}) {
  const niche = str(input.niche);
  if (!niche) return [];
  const nicheProfile = detectNiche({ niche, brand: '', description: str(input.details), mainOffer: '' });
  const want = stems(`${niche} ${str(input.details)}`);
  const out = [];
  for (const t of normalizeLibrary(library)) {
    if (isProfileEmpty(t)) continue;
    let score = 0;
    const why = [];
    const own = detectNiche({ niche: `${t.business} ${t.name}`, brand: '', description: t.notes, mainOffer: '' });
    if (own.id !== 'generic' && own.id === nicheProfile.id) { score += 5; why.push(`та же сфера: ${nicheProfile.label.toLowerCase()}`); }
    if ((CATEGORY_NICHES[t.category] || []).includes(nicheProfile.id)) { score += 4; why.push(`категория «${t.category}» подходит нише`); }
    const common = [...stems(`${t.name} ${t.business} ${t.notes}`)].filter(w => want.has(w));
    if (common.length) { score += Math.min(6, common.length * 3); why.push('совпадают ключевые слова описания'); }
    if (t.category === 'Премиум и люкс' && ['premium', 'luxury'].includes(input.tier)) { score += 3; why.push('класс проекта — премиум/люкс'); }
    // «Универсальный» — явное решение пользователя применять профиль к любым нишам; он проходит порог, но уступает точным совпадениям.
    if (t.category === 'Универсальный') { score += 3; if (!why.length) why.push('универсальный профиль'); }
    if (score >= 3) out.push({ template: t, score, why });
  }
  return out.sort((a, b) => b.score - a.score || (a.template.updatedAt < b.template.updatedAt ? 1 : -1)).slice(0, limit);
}

// Цитаты из источника (тексты кнопок и заголовков в «ёлочках») в генератор не передаются.
const abstract = line => String(line).replace(/«[^»]*»/g, '«…»').replace(/https?:\/\/\S+/g, '').trim();
const takeLines = (t, keys, n) => keys.flatMap(k => t.profile[k] || []).map(abstract).filter(Boolean).slice(0, n);

/**
 * Профиль → компактный референс для генератора. Намеренно НЕ содержит палитру, гарнитуры, тексты и адрес источника:
 * в новый проект переходят только структурные, UX- и контентные принципы.
 */
export function toReference(match) {
  const t = match.template || match;
  return {
    id: t.id, name: t.name, category: t.category, why: match.why || [],
    traits: t.traits,
    patterns: {
      structure: takeLines(t, ['cards', 'forms', 'features', 'navigation'], 5),
      ux: takeLines(t, ['actions', 'navUx', 'mobile'], 5),
      content: takeLines(t, ['benefits', 'offer', 'ctaLogic', 'headingTypes'], 5),
      ideas: takeLines(t, ['ideas'], 4),
      avoid: takeLines(t, ['issues'], 3).filter(x => !/не нашли/.test(x)),
    },
  };
}

/** Очищает массив референсов, пришедший из проекта или импорта. */
export function normalizeReferences(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(r => r && typeof r === 'object' && str(r.name)).slice(0, 3).map(r => {
    const p = r.patterns && typeof r.patterns === 'object' ? r.patterns : {};
    const pl = (v, n) => lines(v).map(abstract).filter(Boolean).slice(0, n);
    return {
      id: clip(r.id, 80), name: clip(r.name, 120), category: clip(r.category, 60), why: lines(r.why).slice(0, 4),
      traits: normalizeTraits(r.traits),
      patterns: { structure: pl(p.structure, 5), ux: pl(p.ux, 5), content: pl(p.content, 5), ideas: pl(p.ideas, 4), avoid: pl(p.avoid, 3) },
    };
  });
}

/** Подбор по нише или применение одного явно выбранного профиля как референса. */
export const referencesFor = (library, input = {}, opts = {}) => {
  const profileId = str(opts.profileId);
  if (profileId) {
    const template = normalizeLibrary(library).find(t => t.id === profileId && !isProfileEmpty(t));
    return template ? [toReference({ template, why: ['выбран вручную'] })] : [];
  }
  return matchTemplates(library, input, opts).map(toReference);
};
