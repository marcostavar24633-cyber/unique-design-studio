// Cinematic Visual (D03): фактуры, свет и визуальные слои страницы.
// Воплощает выбранное направление графики (graphic-art-direction.js) в реальном CSS:
//  • фактура — фоновое изображение body: она всегда позади контента и не меняет контраст текста;
//  • свет первого экрана — слои внутри hero-сцены (виньетка только для тёмных палитр, засвет — у края);
//  • свечение секций — только background-image, цвет фона секции сохраняется.
// Всё статично (без анимации): перерисовка фона всей страницы дорога на телефонах.
// Без сетевых запросов: фактуры — встроенные SVG или CSS-градиенты.
import { pick, stream } from '../util.js';

/** Пресеты: фактура + световые слои. Порядок важен только для списка в редакторе. */
export const CINEMATIC_PRESETS = Object.freeze({
  film: { label: 'Плёночное зерно и свет', texture: 'grain', lights: ['vignette', 'leak'] },
  'soft-grain': { label: 'Мягкое зерно и свечение', texture: 'grain', lights: ['glow'] },
  paper: { label: 'Бумажная фактура', texture: 'paper', lights: [] },
  'paper-light': { label: 'Бумага и тёплый засвет', texture: 'paper', lights: ['leak'] },
  halftone: { label: 'Печатный полутон', texture: 'halftone', lights: [] },
  blueprint: { label: 'Сетка чертежа', texture: 'blueprint', lights: [] },
  scanlines: { label: 'Сканлинии интерфейса', texture: 'scanlines', lights: ['vignette'] },
  dotgrid: { label: 'Точечная сетка', texture: 'dotgrid', lights: [] },
  none: { label: 'Без фактуры', texture: 'none', lights: [] },
});
export const CINEMATIC_PRESET_IDS = Object.keys(CINEMATIC_PRESETS);

/** Направление графики → уместные пресеты (первый — основной, второй — вариант для разнообразия). */
const BY_DIRECTION = {
  cinematic: ['film', 'soft-grain'],
  '3d-object': ['soft-grain', 'none'],
  'abstract-3d': ['soft-grain', 'film'],
  collage: ['paper', 'halftone'],
  typography: ['halftone', 'none'],
  gradient: ['soft-grain'],
  glass: ['soft-grain'],
  blueprint: ['blueprint'],
  editorial: ['paper', 'paper-light'],
  hud: ['scanlines'],
  lineart: ['dotgrid', 'paper'],
  macro: ['paper-light', 'film'],
  surreal: ['film', 'soft-grain'],
  data: ['dotgrid'],
  floating: ['soft-grain'],
};

/** Цветокоррекция фотографий в тон фактуры: [контраст, насыщенность, сепия]. Сдвиги намеренно малы —
 *  это реальные снимки владельца, коррекция только объединяет их с фоном страницы в одну «съёмку». */
const GRADES = {
  film: { label: 'тёплый плёночный тон', c: 1.06, s: 0.92, sepia: 0.06 },
  'soft-grain': { label: 'мягкий тон', c: 1.02, s: 0.96, sepia: 0 },
  paper: { label: 'тёплая печать', c: 1.0, s: 0.9, sepia: 0.08 },
  'paper-light': { label: 'тёплая печать', c: 1.02, s: 0.9, sepia: 0.1 },
  halftone: { label: 'печатный контраст', c: 1.08, s: 0.86, sepia: 0 },
  blueprint: { label: 'приглушённый технический тон', c: 1.04, s: 0.82, sepia: 0 },
  scanlines: { label: 'контрастный экранный тон', c: 1.08, s: 1.05, sepia: 0 },
};

/** Значение CSS filter для фотографий или пустая строка (без коррекции). */
export function photoGrade(layers) {
  const g = layers && GRADES[layers.id];
  if (!g) return '';
  const k = layers.intensity === 'calm' ? 0.5 : 1;
  const ease = v => Math.round((1 + (v - 1) * k) * 1000) / 1000;
  const parts = [`contrast(${ease(g.c)})`, `saturate(${ease(g.s)})`];
  if (g.sepia) parts.push(`sepia(${Math.round(g.sepia * k * 1000) / 1000})`);
  return parts.filter(p => !/\(1\)$/.test(p)).join(' ');
}

const LIGHT_LABELS = { vignette: 'виньетка', leak: 'световой засвет', glow: 'свечение секций' };
const TEXTURE_LABELS = { grain: 'зерно', paper: 'волокна бумаги', halftone: 'полутон', blueprint: 'сетка', scanlines: 'сканлинии', dotgrid: 'точки', none: 'нет' };

/**
 * Выбирает слои для проекта. Ручной выбор владельца (passthrough.cinematicLayers) главнее.
 * @returns {{id, label, texture, lights:string[], intensity:'calm'|'balanced', mode:'light'|'dark', rationale}}
 */
export function chooseCinematicLayers(project = {}, visual = {}) {
  const forced = project.passthrough?.cinematicLayers;
  const mode = visual.palette?.mode === 'dark' ? 'dark' : 'light';
  const calm = project.passthrough?.motionStyle !== 'cinematic' && (project.tier === 'luxury' || visual.motionPlan?.intensity === 'calm');
  let id, rationale;
  if (CINEMATIC_PRESETS[forced]) { id = forced; rationale = 'Выбрано владельцем проекта'; }
  else {
    const candidates = BY_DIRECTION[visual.graphicDirection?.id] || ['soft-grain', 'paper'];
    id = pick(stream(visual.seed || 0, 'cinematic-layers'), candidates);
    rationale = `Подобрано к направлению графики «${visual.graphicDirection?.ru || 'по умолчанию'}»`;
  }
  const preset = CINEMATIC_PRESETS[id];
  // Тёмная виньетка на светлом фоне затемнила бы края под тёмным текстом — на светлых палитрах её нет.
  const lights = preset.lights.filter(l => l !== 'vignette' || mode === 'dark');
  return Object.freeze({ id, label: preset.label, texture: preset.texture, lights: Object.freeze(lights), intensity: calm ? 'calm' : 'balanced', mode, rationale });
}

/** Короткое описание для концепции и ТЗ. */
export function describeCinematicLayers(layers) {
  if (!layers || layers.texture === 'none') return 'Без фактуры: чистые плоскости цвета';
  const parts = [`фактура — ${TEXTURE_LABELS[layers.texture]}`];
  if (layers.lights.length) parts.push(`свет — ${layers.lights.map(l => LIGHT_LABELS[l]).join(', ')}`);
  if (photoGrade(layers)) parts.push(`фото — ${GRADES[layers.id].label}`);
  return `${layers.label}: ${parts.join('; ')}${layers.intensity === 'calm' ? ' (сдержанно)' : ''}`;
}

const svgUrl = svg => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}")`;

/** Шумовая фактура: цвет и максимальная прозрачность зашиты в SVG, поэтому слой не требует opacity. */
// Плитка сшивается без швов (stitchTiles), только если частота × размер плитки — целое число:
// бумага 0.035 × 200 = 7 и 0.55 × 200 = 110, зерно 0.85 × 200 = 170.
export const NOISE_TILE = 200;
function noise(kind, mode, strength) {
  const c = mode === 'dark' ? 1 : 0;
  const freq = kind === 'paper' ? '0.035 0.55' : '0.85';
  const octaves = kind === 'paper' ? 2 : 3;
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='${NOISE_TILE}' height='${NOISE_TILE}'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 0 ${c} ${strength} 0 0 0 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
}

/** Прозрачность фактуры. На тёмном фоне светлое зерно заметнее, поэтому слабее. */
export function textureStrength(layers) {
  const base = layers.mode === 'dark' ? 0.09 : 0.12;
  return Math.round(base * (layers.intensity === 'calm' ? 0.6 : 1) * 1000) / 1000;
}

function textureCss(layers) {
  const s = textureStrength(layers);
  const ink = layers.mode === 'dark' ? '255,255,255' : '0,0,0';
  const a = k => (s * k).toFixed(3);
  switch (layers.texture) {
    case 'grain': return `body{background-image:${noise('grain', layers.mode, s)};background-size:${NOISE_TILE}px ${NOISE_TILE}px}`;
    case 'paper': return `body{background-image:${noise('paper', layers.mode, s)};background-size:${NOISE_TILE}px ${NOISE_TILE}px}`;
    case 'halftone': return `body{background-image:radial-gradient(rgba(${ink},${a(0.55)}) 0.8px,transparent 1.2px);background-size:7px 7px}`;
    case 'blueprint': return `body{background-image:linear-gradient(rgba(${ink},${a(0.5)}) 1px,transparent 1px),linear-gradient(90deg,rgba(${ink},${a(0.5)}) 1px,transparent 1px),linear-gradient(rgba(${ink},${a(0.22)}) 1px,transparent 1px),linear-gradient(90deg,rgba(${ink},${a(0.22)}) 1px,transparent 1px);background-size:120px 120px,120px 120px,24px 24px,24px 24px}`;
    case 'scanlines': return `body{background-image:repeating-linear-gradient(180deg,rgba(${ink},${a(0.35)}) 0 1px,transparent 1px 4px)}`;
    case 'dotgrid': return `body{background-image:radial-gradient(rgba(${ink},${a(0.7)}) 1px,transparent 1.4px);background-size:22px 22px}`;
    default: return '';
  }
}

function lightCss(layers) {
  const calm = layers.intensity === 'calm';
  const out = [];
  if (layers.lights.includes('vignette')) out.push(`.uds-light--vignette{position:absolute;inset:0;background:radial-gradient(ellipse 120% 90% at 50% 45%,transparent 55%,rgba(0,0,0,${calm ? 0.28 : 0.42}) 100%)}`);
  if (layers.lights.includes('leak')) out.push(`.uds-light--leak{position:absolute;inset:-10% -10% auto auto;width:70%;height:80%;background:radial-gradient(ellipse at 85% 10%,color-mix(in srgb,var(--ds-accent) ${calm ? 14 : 22}%,transparent),transparent 62%);mix-blend-mode:${layers.mode === 'dark' ? 'screen' : 'multiply'}}`);
  if (layers.lights.includes('glow')) out.push(`.ds-section:nth-of-type(even){background-image:radial-gradient(ellipse 60% 70% at 88% 20%,color-mix(in srgb,var(--ds-accent) ${calm ? 6 : 9}%,transparent),transparent 70%)}.ds-section:nth-of-type(odd):not(.sec--contact){background-image:radial-gradient(ellipse 55% 65% at 8% 85%,color-mix(in srgb,var(--ds-accent) ${calm ? 4 : 6}%,transparent),transparent 70%)}`);
  return out.join('');
}

/** CSS слоёв. Пустая строка, если фактура и свет отключены. */
export function cinematicLayersCss(layers) {
  if (!layers || (layers.texture === 'none' && !layers.lights.length)) return '';
  const grade = photoGrade(layers);
  // Коррекция через переменную: правило наведения в motion.js дописывает к ней свой фильтр, а не заменяет её.
  const photos = grade ? `:root{--uds-grade:${grade}}img.ds-media,.gallery img,.item__media img,img[data-decorative="hero-bg"]{filter:var(--uds-grade)}` : '';
  return textureCss(layers) + lightCss(layers) + photos + '.uds-light{pointer-events:none}';
}

/** Световые слои первого экрана: вставляются внутрь декоративной hero-сцены (aria-hidden). */
export function cinematicLightMarkup(layers) {
  if (!layers) return '';
  return layers.lights.filter(l => l !== 'glow').map(l => `<span class="uds-light uds-light--${l}"></span>`).join('');
}
