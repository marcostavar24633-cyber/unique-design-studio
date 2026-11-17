// Формы страницы: маски фотографий и разделители секций. Второй слой «нестандартных» страниц
// после механик карточек. Форма выводится из характера бренда (форма углов, мотив, архитектура), а не случайна.
// Безопасность: маски применяются только к фото (не к карточкам и кнопкам — иначе обрезалась бы рамка фокуса),
// разделители — декоративные линии (aria-hidden), которые не перекрывают содержимое.
import { pick, stream } from './util.js';

export const MASKS = {
  none: 'прямоугольные фото',
  arch: 'арка: фото со скруглённым верхом',
  notch: 'срез: у фото срезаны противоположные углы',
  slant: 'диагональ: нижний край фото скошен',
  blob: 'капля: органичная форма фото',
  pill: 'пилюля: сильно скруглённые фото',
};
export const DIVIDERS = {
  none: 'без разделителей',
  line: 'тонкая линия между секциями',
  wave: 'волна между секциями',
  zigzag: 'зигзаг между секциями',
  steps: 'ступени между секциями',
  dots: 'пунктир из точек между секциями',
};

const MASK_BY_SHAPE = { sharp: ['notch', 'slant', 'none'], soft: ['arch', 'pill', 'slant'], round: ['blob', 'arch', 'pill'] };
const DIVIDER_BY_MOTIF = {
  waves: ['wave', 'line'], blobs: ['wave', 'dots'], dots: ['dots', 'line'], orbits: ['dots', 'wave'], rings: ['dots', 'line'],
  arcs: ['wave', 'line'], blocks: ['steps', 'zigzag'], bands: ['zigzag', 'steps'], horizon: ['line', 'wave'],
};

/** Маска фото и разделитель секций. Ручной выбор владельца (passthrough.imageMask / sectionDivider) главнее. */
export function chooseForms(project, { shape, motif, archetype }, seed) {
  const forced = project.passthrough || {};
  let maskPool = MASK_BY_SHAPE[shape] || ['none'];
  if (archetype === 'brutalist') maskPool = ['none', 'notch'];
  if (project.tier === 'luxury') maskPool = maskPool.filter(m => m !== 'blob' && m !== 'pill').concat('arch');
  let dividerPool = DIVIDER_BY_MOTIF[motif] || ['line', 'none'];
  if (archetype === 'minimal') dividerPool = ['line', 'none'];
  if (archetype === 'brutalist') dividerPool = ['zigzag', 'steps', 'line'];
  return {
    mask: MASKS[forced.imageMask] ? forced.imageMask : pick(stream(seed, 'forms-mask'), maskPool),
    divider: DIVIDERS[forced.sectionDivider] ? forced.sectionDivider : pick(stream(seed, 'forms-divider'), dividerPool),
  };
}

// Фото, к которым применяется маска. Фон первого экрана (.hero__photo-bg) и мотивы-SVG не трогаем.
const MEDIA = ['.item__media img', '.gallery img', '.spotlight__media img', '.hero__figure img', '.bento__visual img', '.hero--asymmetric .visual img'];
const sel = MEDIA.join(',');
const MASK_RULES = {
  none: '',
  arch: `${sel}{border-radius:50% 50% var(--ds-radius-md,0) var(--ds-radius-md,0)/26% 26% var(--ds-radius-md,0) var(--ds-radius-md,0)}`,
  notch: `${sel}{clip-path:polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,26px 100%,0 calc(100% - 26px))}`,
  slant: `${sel}{clip-path:polygon(0 0,100% 0,100% 88%,0 100%)}`,
  blob: `${sel}{border-radius:42% 58% 55% 45%/48% 40% 60% 52%}`,
  pill: `${sel}{border-radius:clamp(24px,6vw,48px)}`,
};

// Разделители: SVG с vector-effect, чтобы толщина линии не растягивалась вместе с шириной.
const wavePath = () => { let d = 'M0 12'; for (let x = 0; x < 1200; x += 60) d += ` Q${x + 30} ${x / 60 % 2 ? 22 : 2} ${x + 60} 12`; return d; };
const zigzagPoints = () => Array.from({ length: 41 }, (_, i) => `${i * 30},${i % 2 ? 4 : 20}`).join(' ');
const stepsPath = () => { let d = 'M0 20'; for (let x = 0; x < 1200; x += 120) d += ` H${x + 60} V6 H${x + 120} V20`; return d; };
const svg = inner => `<svg viewBox="0 0 1200 24" preserveAspectRatio="none" focusable="false">${inner}</svg>`;
const DIVIDER_SVG = {
  wave: () => svg(`<path d="${wavePath()}" fill="none" vector-effect="non-scaling-stroke"/>`),
  zigzag: () => svg(`<polyline points="${zigzagPoints()}" fill="none" vector-effect="non-scaling-stroke"/>`),
  steps: () => svg(`<path d="${stepsPath()}" fill="none" vector-effect="non-scaling-stroke"/>`),
};

/** Разметка разделителя между секциями ('' — без разделителя). */
export function dividerHtml(divider) {
  if (!divider || divider === 'none') return '';
  const inner = DIVIDER_SVG[divider] ? DIVIDER_SVG[divider]() : '';
  return `<div class="ds-container ds-divider ds-divider--${divider}" aria-hidden="true">${inner}</div>`;
}

export function formsCss({ mask, divider }) {
  const out = [MASK_RULES[mask] || ''];
  if (divider && divider !== 'none') {
    out.push('.ds-divider{display:block;height:24px;margin-block:0;color:var(--ds-accent);opacity:.55;pointer-events:none}');
    out.push('.ds-divider svg{display:block;width:100%;height:100%;overflow:visible}.ds-divider path,.ds-divider polyline{stroke:currentColor;stroke-width:1.5}');
    if (divider === 'line') out.push('.ds-divider--line{height:1px;background:currentColor;opacity:.35}');
    if (divider === 'dots') out.push('.ds-divider--dots{height:8px;background:radial-gradient(circle,currentColor 1.6px,transparent 2.2px) 0 50%/18px 8px repeat-x}');
  }
  return out.filter(Boolean).join('\n');
}
