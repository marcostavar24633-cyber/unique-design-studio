// Формат проекта: нормализация ввода (включая JSON старого Landing Studio) и экспорт.
import { ARCHETYPES, LEGACY_FAMILIES } from './data.js';
import { BRANDS } from './brands.js';
import { normalizeHex } from './color.js';
import { hash, safeUrl, slugify, str } from './util.js';

export const FORMAT_VERSION = 2;
export const FIELD_STATES = Object.freeze({ unset: 'не задано', manual: 'вручную', hidden: 'скрыто вручную' });
const NORMALIZED_PROJECTS = new WeakSet();

/** Resolves page override → site default → generated value, preserving explicit hiding. */
export function resolveLayeredValue(options = {}) {
  const { pageValue, siteValue, autoValue, pageState = 'unset', siteState = 'unset' } = options && typeof options === 'object' ? options : {};
  if (pageState === 'hidden') return { value: '', source: 'page', state: 'hidden' };
  if (pageState === 'manual' || (pageValue !== undefined && pageValue !== null && pageValue !== '')) return { value: pageValue ?? '', source: 'page', state: 'manual' };
  if (siteState === 'hidden') return { value: '', source: 'site', state: 'hidden' };
  if (siteState === 'manual' || (siteValue !== undefined && siteValue !== null && siteValue !== '')) return { value: siteValue ?? '', source: 'site', state: 'manual' };
  return { value: autoValue ?? '', source: 'auto', state: 'unset' };
}

const normalizeFieldStates = raw => Object.fromEntries(Object.entries(raw && typeof raw === 'object' ? raw : {})
  .filter(([, state]) => Object.hasOwn(FIELD_STATES, state)));
const SITE_INHERITABLE_FIELDS = ['palette', 'accent', 'brandProfile', 'fonts', 'tier', 'navStyle', 'buttonStyle', 'sectionLayout', 'motionStyle', 'imageMask', 'artDirectionPreset', 'cta', 'ctaUrl', 'formAction'];

export const TIERS = { standard: 'Стандарт', premium: 'Премиум', luxury: 'Люкс' };
/** Класс проекта из любой записи: id, русское название или синоним. */
export function tierOf(value) {
  const v = str(value).toLowerCase();
  if (['luxury', 'lux', 'люкс', 'лакшери', 'лакшери-класс'].includes(v)) return 'luxury';
  if (['premium', 'премиум', 'премиальный', 'премиум-класс'].includes(v)) return 'premium';
  return 'standard';
}

const TEXT_FIELDS = [
  'brand', 'niche', 'title', 'description', 'cta', 'targetAudience', 'mainOffer', 'brandCharacter', 'visualDirection',
  'primaryGoal', 'strategySummary', 'style', 'aboutTitle', 'aboutText', 'servicesTitle', 'servicesIntro',
  'advantagesTitle', 'advantagesIntro', 'processTitle', 'faqTitle', 'galleryTitle', 'contactTitle', 'contactText',
  // SEO: необязательные отдельные title и description страницы (иначе берутся заголовок и описание).
  'seoTitle', 'seoDescription',
];

/** Элемент списка: принимает ["Заголовок","Текст","Цена","Картинка","ALT","Категория","Бейдж"] или объект. */
function item(raw) {
  if (Array.isArray(raw)) return { id: str(raw[7]), title: str(raw[0]), text: str(raw[1]), price: str(raw[2]), image: safeUrl(raw[3], { image: true }), alt: str(raw[4]), category: str(raw[5]), badge: str(raw[6]).slice(0, 24) };
  if (raw && typeof raw === 'object') {
    return { id: str(raw.id), title: str(raw.title ?? raw.name), text: str(raw.text ?? raw.description), price: str(raw.price), image: safeUrl(raw.image, { image: true }), alt: str(raw.alt), category: str(raw.category), badge: str(raw.badge).slice(0, 24) };
  }
  return { id: '', title: str(raw), text: '', price: '', image: '' };
}
const items = (raw, prefix) => {
  const used = new Set();
  return (Array.isArray(raw) ? raw.slice(0, 100).map(item).filter(i => i.title || i.text) : []).map((entry, index) => {
    const content = [entry.title, entry.text, entry.price, entry.image, entry.alt, entry.category].join('|');
    const base = slugify(entry.id || `${prefix}-${slugify(entry.title || 'item')}-${hash(`${prefix}:${content}`).toString(36)}`);
    let id = base, suffix = 1;
    while (used.has(id)) id = `${base}-${++suffix}`;
    used.add(id);
    return { ...entry, id: id.slice(0, 64) || `${prefix}-${index + 1}` };
  });
};

function paletteMode(value) {
  const v = str(value).toLowerCase();
  if (['тёмная', 'темная', 'dark'].includes(v)) return 'dark';
  if (['светлая', 'light'].includes(v)) return 'light';
  return 'auto';
}

/** Разбирает выбор архитектуры: точный id, семейство из старого редактора или авто. */
export function resolveArchitecture(raw = {}) {
  raw = raw && typeof raw === 'object' ? raw : {};
  // Generated/normalized projects store the choice as a descriptor. Preserve it
  // when a project is generated again (for example after adding a hero image).
  const descriptor = raw.architecture && typeof raw.architecture === 'object' ? raw.architecture : null;
  if (descriptor?.mode === 'exact' && Object.hasOwn(ARCHETYPES, str(descriptor.exact).toLowerCase())) {
    const exactId = str(descriptor.exact).toLowerCase();
    return { mode: 'exact', exact: exactId, family: null, legacy: ARCHETYPES[exactId].legacy };
  }
  if (descriptor?.mode === 'family' && Object.hasOwn(LEGACY_FAMILIES, str(descriptor.family).toLowerCase())) {
    const family = str(descriptor.family).toLowerCase();
    return { mode: 'family', exact: null, family, legacy: family };
  }
  if (descriptor?.mode === 'auto') return { mode: 'auto', exact: null, family: null, legacy: '' };
  const exact = str(raw.architecture).toLowerCase();
  if (Object.hasOwn(ARCHETYPES, exact)) return { mode: 'exact', exact, family: null, legacy: ARCHETYPES[exact].legacy };
  const legacy = str(raw.designArchitecture).toLowerCase() || (Object.hasOwn(LEGACY_FAMILIES, exact) ? exact : '');
  // «catalog» есть и в старом, и в новом формате: в поле designArchitecture это всегда семейство.
  if (Object.hasOwn(LEGACY_FAMILIES, legacy)) return { mode: 'family', exact: null, family: legacy, legacy };
  if (Object.hasOwn(ARCHETYPES, legacy)) return { mode: 'exact', exact: legacy, family: null, legacy: ARCHETYPES[legacy].legacy };
  return { mode: 'auto', exact: null, family: null, legacy: '' };
}

export function normalizeProject(raw = {}) {
  if (raw && typeof raw === 'object' && NORMALIZED_PROJECTS.has(raw)) return raw;
  raw = raw && typeof raw === 'object' ? { ...raw } : {};
  const siteRaw = raw.site && typeof raw.site === 'object' ? raw.site : {};
  const fieldStates = normalizeFieldStates(raw.fieldStates);
  const siteFieldStates = normalizeFieldStates(siteRaw.fieldStates);
  const siteSettings = siteRaw.settings && typeof siteRaw.settings === 'object' ? siteRaw.settings : {};
  const inheritedSiteFields = [];
  // Import markers mean the page field is automatic; site defaults may still fill it.
  if (raw.paletteLocked === false) raw.palette = '';
  if (raw.accentLocked === false) raw.accent = '';
  if (raw.architectureMode === 'auto') { delete raw.designArchitecture; delete raw.architecture; }
  // Site defaults fill only genuinely unset page fields. A page-level hidden state blocks inheritance.
  for (const key of SITE_INHERITABLE_FIELDS) {
    if (fieldStates[key] === 'hidden' || fieldStates[key] === 'manual' || siteFieldStates[key] === 'hidden' || raw[key] !== undefined && raw[key] !== '') continue;
    if (siteSettings[key] !== undefined && siteSettings[key] !== null && siteSettings[key] !== '') {
      raw[key] = siteSettings[key];
      inheritedSiteFields.push(key);
    }
  }
  // Собственный экспорт помечает авто-значения: они не превращаются в жёсткий выбор при импорте.
  const p = { __normalized: true, formatVersion: FORMAT_VERSION };
  for (const f of TEXT_FIELDS) p[f] = str(raw[f]);
  const lang = str(raw.lang);
  try { p.lang = lang && Intl.getCanonicalLocales(lang)[0] || 'ru'; }
  catch { p.lang = 'ru'; }
  p.id = slugify(str(raw.id) || p.brand || p.niche);
  p.architecture = resolveArchitecture(raw);
  const secondary = str(raw.secondaryArchitecture).toLowerCase();
  p.secondaryArchitecture = Object.hasOwn(ARCHETYPES, secondary) ? secondary : '';
  p.palette = paletteMode(raw.palette);
  // Класс проекта: standard | premium | luxury (влияет на композицию, типографику, палитру и тон текстов).
  p.tier = tierOf(raw.tier);
  // Свой промт заказчика: дополняет стандартный (append) или заменяет его (replace) — см. prompt.js.
  p.customPrompt = str(raw.customPrompt).slice(0, 8000);
  p.customPromptMode = raw.customPromptMode === 'replace' ? 'replace' : 'append';
  // Фирменный профиль живого проекта (src/engine/brands.js): цвета, гарнитуры и скругления бренда.
  const brandId = str(raw.brandProfile).toLowerCase();
  p.brandProfile = Object.hasOwn(BRANDS, brandId) ? brandId : '';
  // Шрифты: "system" (страница без внешних запросов) или "web" (Google Fonts с кириллицей).
  // С фирменным профилем по умолчанию "web": иначе гарнитуры бренда не загрузятся.
  const fonts = str(raw.fonts).toLowerCase();
  p.fonts = fonts === 'web' || fonts === 'system' ? fonts : p.brandProfile ? 'web' : 'system';
  p.accent = normalizeHex(raw.accent);
  p.services = items(raw.services ?? raw.items, 'service');
  p.advantages = items(raw.advantages, 'advantage');
  p.process = items(raw.process, 'process');
  p.faqs = items(raw.faqs, 'faq');
  p.categories = [...new Set((Array.isArray(raw.categories) ? raw.categories : typeof raw.categories === 'string' ? raw.categories.split(/[\r\n,;]/) : [])
    .map(value => str(value && typeof value === 'object' ? value.name ?? value.title ?? value.label : value)).filter(Boolean))].slice(0, 50);
  // Каталог с корзиной-заявкой: true — включить, false — выключить, иначе решает движок по нише и ценам.
  if (typeof raw.commerce === 'boolean') p.commerce = raw.commerce;
  p.assumptions = (Array.isArray(raw.assumptions) ? raw.assumptions : typeof raw.assumptions === 'string' ? [raw.assumptions] : [])
    .map(value => str(value && typeof value === 'object' ? value.text ?? value.note ?? value.message : value)).filter(Boolean).slice(0, 50);
  const galleryIds = new Set();
  p.gallery = (Array.isArray(raw.gallery) ? raw.gallery.slice(0, 100) : []).map(g => (typeof g === 'string' ? { src: g } : g || {}))
    .map((g, index) => {
      const src = safeUrl(g.src, { image: true });
      const base = slugify(str(g.id) || `gallery-${hash(src || `${g.caption || ''}:${index}`).toString(36)}`);
      let id = base, suffix = 1;
      while (galleryIds.has(id)) id = `${base}-${++suffix}`;
      galleryIds.add(id);
      return { id: id.slice(0, 64) || `gallery-${index + 1}`, src, alt: str(g.alt), caption: str(g.caption) };
    }).filter(g => g.src);
  const img = raw.images && typeof raw.images === 'object' ? raw.images : {};
  p.site = {
    logo: safeUrl(siteRaw.logo, { image: true }),
    socialImage: safeUrl(siteRaw.socialImage, { image: true }),
    contacts: Object.fromEntries(['phone', 'email', 'address', 'hours'].map(key => [key, str(siteRaw.contacts?.[key])])),
    links: (Array.isArray(siteRaw.links) ? siteRaw.links.slice(0, 30) : []).map(link => ({ label: str(link?.label).slice(0, 80), href: safeUrl(link?.href) })).filter(link => link.label && link.href),
    header: { tagline: str(siteRaw.header?.tagline), ctaLabel: str(siteRaw.header?.ctaLabel) },
    footer: { note: str(siteRaw.footer?.note), copyright: str(siteRaw.footer?.copyright) },
    fieldStates: siteFieldStates,
    settings: Object.fromEntries(SITE_INHERITABLE_FIELDS.filter(key => siteSettings[key] !== undefined && siteFieldStates[key] !== 'hidden').map(key => [key, siteSettings[key]])),
  };
  p.fieldStates = fieldStates;
  p.inheritedSiteFields = inheritedSiteFields;
  p.images = {
    hero: safeUrl(img.hero ?? raw.heroImage, { image: true }),
    heroMobile: safeUrl(img.heroMobile, { image: true }),
    heroAlt: str(img.heroAlt),
    social: fieldStates['images.social'] === 'hidden' ? ''
      : fieldStates['images.social'] === 'manual' ? safeUrl(img.social, { image: true })
      : safeUrl(img.social, { image: true }) || (siteFieldStates['images.social'] === 'hidden' ? '' : p.site.socialImage),
  };
  if (!fieldStates['images.social'] && !safeUrl(img.social, { image: true })
    && siteFieldStates['images.social'] !== 'hidden' && p.site.socialImage) inheritedSiteFields.push('images.social');
  const c = raw.contacts && typeof raw.contacts === 'object' ? raw.contacts : {};
  p.contacts = Object.fromEntries(['phone', 'email', 'address', 'hours'].map(key => {
    const resolved = resolveLayeredValue({
      pageValue: str(c[key]), siteValue: p.site.contacts[key],
      pageState: fieldStates[`contacts.${key}`] || 'unset',
      siteState: siteFieldStates[`contacts.${key}`] || 'unset',
    });
    return [key, str(resolved.value)];
  }));
  // Keep page overrides separate so inherited site contacts remain live after export/import.
  p.pageContacts = Object.fromEntries(['phone', 'email', 'address', 'hours'].map(key => [key, str(c[key])]));
  p.ctaUrl = fieldStates.ctaUrl === 'hidden' ? '' : safeUrl(raw.ctaUrl);
  const formAction = safeUrl(raw.formAction);
  p.formAction = fieldStates.formAction === 'hidden' ? '' : /^https:\/\//i.test(formAction) ? formAction : '';
  // Поля, которых движок не знает (marketResearch, researchSources и т.п.), сохраняются для обратного экспорта.
  const known = new Set([...TEXT_FIELDS, 'lang', 'id', 'architecture', 'designArchitecture', 'secondaryArchitecture', 'palette', 'accent', 'fonts', 'brandProfile', 'tier', 'customPrompt', 'customPromptMode',
    'services', 'items', 'advantages', 'process', 'faqs', 'categories', 'commerce', 'assumptions', 'gallery', 'images', 'heroImage', 'contacts',
    'ctaUrl', 'formAction', 'site', 'fieldStates', 'pageContacts', 'inheritedSiteFields', 'formatVersion', 'concept', '__normalized', 'paletteLocked', 'accentLocked', 'architectureMode', 'sectionDivider']);
  p.passthrough = Object.fromEntries(Object.entries(raw).filter(([k]) => !known.has(k)));
  NORMALIZED_PROJECTS.add(p);
  return p;
}

// The eighth tuple slot is ignored by older Landing Studio imports and preserves IDs in round trips.
const toRow = i => [i.title, i.text, i.price || '', i.image || '', i.alt || '', i.category || '', i.badge || '', i.id || ''];

/** Экспорт в JSON, который читают и этот продукт, и редактор Landing Studio
 *  (списки — массивы строк, designArchitecture — значение из старого перечисления). */
export function exportProject(input, concept) {
  const p = normalizeProject(input);
  const out = { ...p.passthrough, formatVersion: FORMAT_VERSION, id: p.id };
  for (const f of TEXT_FIELDS) out[f] = p[f];
  out.lang = p.lang;
  out.architecture = p.architecture.mode === 'exact' ? p.architecture.exact : 'auto';
  out.architectureMode = p.architecture.mode;
  const primary = concept?.designDNA?.primaryArchetype;
  const legacy = p.architecture.legacy || (primary && ARCHETYPES[primary]?.legacy) || '';
  if (legacy) out.designArchitecture = legacy;
  if (p.secondaryArchitecture) out.secondaryArchitecture = p.secondaryArchitecture;
  const mode = p.palette !== 'auto' ? p.palette : concept?.visualSystem?.palette?.mode;
  out.palette = mode === 'dark' ? 'Тёмная' : mode === 'light' ? 'Светлая' : '';
  out.paletteLocked = p.palette !== 'auto';
  out.accent = p.accent || concept?.visualSystem?.palette?.accent || '';
  out.accentLocked = Boolean(p.accent);
  if (p.brandProfile) out.brandProfile = p.brandProfile;
  if (p.tier !== 'standard') out.tier = p.tier;
  if (p.customPrompt) { out.customPrompt = p.customPrompt; out.customPromptMode = p.customPromptMode; }
  // Шрифты пишутся, только если отличаются от умолчания: иначе после импорта «system» стал бы
  // явным выбором и перекрыл бы веб-шрифты, которые фирменный профиль включает по умолчанию.
  if (p.fonts !== (p.brandProfile ? 'web' : 'system')) out.fonts = p.fonts;
  out.services = p.services.map(toRow);
  out.advantages = p.advantages.map(toRow);
  out.process = p.process.map(toRow);
  out.faqs = p.faqs.map(toRow);
  out.categories = p.categories;
  if (typeof p.commerce === 'boolean') out.commerce = p.commerce;
  out.assumptions = p.assumptions;
  out.gallery = p.gallery;
  out.images = p.images;
  out.site = p.site;
  out.fieldStates = p.fieldStates;
  out.contacts = p.pageContacts;
  out.ctaUrl = p.ctaUrl;
  out.formAction = p.formAction;
  for (const key of p.inheritedSiteFields || []) {
    if (key === 'palette') { out.palette = ''; out.paletteLocked = false; }
    else if (key === 'accent') { out.accent = ''; out.accentLocked = false; }
    else if (key === 'images.social') out.images = { ...out.images, social: '' };
    else delete out[key];
  }
  if (concept) {
    const { visualSystem, ...contract } = concept;
    out.concept = contract;
  }
  return out;
}
