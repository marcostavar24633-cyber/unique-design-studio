// Формат проекта: нормализация ввода (включая JSON старого Landing Studio) и экспорт.
import { ARCHETYPES, LEGACY_FAMILIES } from './data.js';
import { BRANDS } from './brands.js';
import { normalizeHex } from './color.js';
import { safeUrl, slugify, str } from './util.js';

export const FORMAT_VERSION = 2;

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
];

/** Элемент списка: принимает ["Заголовок","Текст","Цена","Картинка","ALT"] или объект. */
function item(raw) {
  if (Array.isArray(raw)) return { title: str(raw[0]), text: str(raw[1]), price: str(raw[2]), image: safeUrl(raw[3], { image: true }), alt: str(raw[4]) };
  if (raw && typeof raw === 'object') {
    return { title: str(raw.title ?? raw.name), text: str(raw.text ?? raw.description), price: str(raw.price), image: safeUrl(raw.image, { image: true }), alt: str(raw.alt) };
  }
  return { title: str(raw), text: '', price: '', image: '' };
}
const items = raw => (Array.isArray(raw) ? raw.map(item).filter(i => i.title || i.text) : []);

function paletteMode(value) {
  const v = str(value).toLowerCase();
  if (['тёмная', 'темная', 'dark'].includes(v)) return 'dark';
  if (['светлая', 'light'].includes(v)) return 'light';
  return 'auto';
}

/** Разбирает выбор архитектуры: точный id, семейство из старого редактора или авто. */
export function resolveArchitecture(raw = {}) {
  const exact = str(raw.architecture).toLowerCase();
  if (ARCHETYPES[exact]) return { mode: 'exact', exact, family: null, legacy: ARCHETYPES[exact].legacy };
  const legacy = str(raw.designArchitecture).toLowerCase() || (LEGACY_FAMILIES[exact] ? exact : '');
  // «catalog» есть и в старом, и в новом формате: в поле designArchitecture это всегда семейство.
  if (LEGACY_FAMILIES[legacy]) return { mode: 'family', exact: null, family: legacy, legacy };
  if (ARCHETYPES[legacy]) return { mode: 'exact', exact: legacy, family: null, legacy: ARCHETYPES[legacy].legacy };
  return { mode: 'auto', exact: null, family: null, legacy: '' };
}

export function normalizeProject(raw = {}) {
  if (raw && raw.__normalized) return raw;
  raw = raw && typeof raw === 'object' ? { ...raw } : {};
  // Собственный экспорт помечает авто-значения: они не превращаются в жёсткий выбор при импорте.
  if (raw.paletteLocked === false) raw.palette = '';
  if (raw.accentLocked === false) raw.accent = '';
  if (raw.architectureMode === 'auto') { delete raw.designArchitecture; delete raw.architecture; }
  const p = { __normalized: true, formatVersion: FORMAT_VERSION };
  for (const f of TEXT_FIELDS) p[f] = str(raw[f]);
  p.lang = str(raw.lang) || 'ru';
  p.id = slugify(str(raw.id) || p.brand || p.niche);
  p.architecture = resolveArchitecture(raw);
  const secondary = str(raw.secondaryArchitecture).toLowerCase();
  p.secondaryArchitecture = ARCHETYPES[secondary] ? secondary : '';
  p.palette = paletteMode(raw.palette);
  // Класс проекта: standard | premium | luxury (влияет на композицию, типографику, палитру и тон текстов).
  p.tier = tierOf(raw.tier);
  // Фирменный профиль живого проекта (src/engine/brands.js): цвета, гарнитуры и скругления бренда.
  const brandId = str(raw.brandProfile).toLowerCase();
  p.brandProfile = BRANDS[brandId] ? brandId : '';
  // Шрифты: "system" (страница без внешних запросов) или "web" (Google Fonts с кириллицей).
  // С фирменным профилем по умолчанию "web": иначе гарнитуры бренда не загрузятся.
  const fonts = str(raw.fonts).toLowerCase();
  p.fonts = fonts === 'web' || fonts === 'system' ? fonts : p.brandProfile ? 'web' : 'system';
  p.accent = normalizeHex(raw.accent);
  p.services = items(raw.services ?? raw.items);
  p.advantages = items(raw.advantages);
  p.process = items(raw.process);
  p.faqs = items(raw.faqs);
  p.categories = Array.isArray(raw.categories) ? raw.categories.map(str).filter(Boolean) : [];
  p.assumptions = Array.isArray(raw.assumptions) ? raw.assumptions.map(str).filter(Boolean) : [];
  p.gallery = (Array.isArray(raw.gallery) ? raw.gallery : []).map(g => (typeof g === 'string' ? { src: g } : g || {}))
    .map(g => ({ src: safeUrl(g.src, { image: true }), alt: str(g.alt), caption: str(g.caption) })).filter(g => g.src);
  const img = raw.images && typeof raw.images === 'object' ? raw.images : {};
  p.images = { hero: safeUrl(img.hero ?? raw.heroImage, { image: true }), heroAlt: str(img.heroAlt) };
  const c = raw.contacts && typeof raw.contacts === 'object' ? raw.contacts : {};
  p.contacts = { phone: str(c.phone), email: str(c.email), address: str(c.address), hours: str(c.hours) };
  p.ctaUrl = safeUrl(raw.ctaUrl);
  p.formAction = /^https:\/\//i.test(str(raw.formAction)) ? str(raw.formAction) : '';
  // Поля, которых движок не знает (marketResearch, researchSources и т.п.), сохраняются для обратного экспорта.
  const known = new Set([...TEXT_FIELDS, 'lang', 'id', 'architecture', 'designArchitecture', 'secondaryArchitecture', 'palette', 'accent', 'fonts', 'brandProfile', 'tier',
    'services', 'items', 'advantages', 'process', 'faqs', 'categories', 'assumptions', 'gallery', 'images', 'heroImage', 'contacts',
    'ctaUrl', 'formAction', 'formatVersion', 'concept', '__normalized', 'paletteLocked', 'accentLocked', 'architectureMode']);
  p.passthrough = Object.fromEntries(Object.entries(raw).filter(([k]) => !known.has(k)));
  return p;
}

const toRow = i => { const row = [i.title, i.text]; if (i.price || i.image || i.alt) row.push(i.price); if (i.image || i.alt) row.push(i.image); if (i.alt) row.push(i.alt); return row; };

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
  // Шрифты пишутся, только если отличаются от умолчания: иначе после импорта «system» стал бы
  // явным выбором и перекрыл бы веб-шрифты, которые фирменный профиль включает по умолчанию.
  if (p.fonts !== (p.brandProfile ? 'web' : 'system')) out.fonts = p.fonts;
  out.services = p.services.map(toRow);
  out.advantages = p.advantages.map(toRow);
  out.process = p.process.map(toRow);
  out.faqs = p.faqs.map(toRow);
  out.categories = p.categories;
  out.assumptions = p.assumptions;
  out.gallery = p.gallery;
  out.images = p.images;
  out.contacts = p.contacts;
  out.ctaUrl = p.ctaUrl;
  out.formAction = p.formAction;
  if (concept) {
    const { visualSystem, ...contract } = concept;
    out.concept = contract;
  }
  return out;
}
