// Формы фотографий выводятся из характера бренда; элементы управления не обрезаются масками.
import { pick, stream } from './util.js';

export const MASKS = {
  none: 'прямоугольные фото',
  arch: 'арка: фото со скруглённым верхом',
  notch: 'срез: у фото срезаны противоположные углы',
  slant: 'диагональ: нижний край фото скошен',
  blob: 'капля: органичная форма фото',
  pill: 'пилюля: сильно скруглённые фото',
  circle: 'круг: круглая фотография',
  ellipse: 'овал: вытянутая фотография',
  diamond: 'ромб: диагональный портрет',
  hexagon: 'шестиугольник: огранённая форма',
  octagon: 'восьмиугольник: мягкая геометрическая рамка',
  chevron: 'шеврон: срезы по бокам',
  parallelogram: 'параллелограмм: наклонные края',
  'wave-edge': 'волна: мягкая волнистая кромка',
  scallop: 'фестоны: округлённые выемки по краю',
  frame: 'рамка: фото с контуром и полем',
};
// Оставлено как совместимый sentinel для старых интеграций; разделители больше не генерируются.
export const DIVIDERS = Object.freeze({ none: 'без разделителей' });

const MASK_BY_SHAPE = {
  sharp: ['notch', 'slant', 'diamond', 'hexagon', 'octagon', 'chevron', 'parallelogram'],
  soft: ['arch', 'pill', 'wave-edge', 'scallop', 'frame'],
  round: ['blob', 'arch', 'pill', 'circle', 'ellipse', 'scallop', 'frame'],
};
/** Маска фото; прежнее поле sectionDivider намеренно игнорируется. */
export function chooseForms(project, { shape, motif, archetype }, seed) {
  const forced = project.passthrough || {};
  let maskPool = MASK_BY_SHAPE[shape] || ['none'];
  if (archetype === 'brutalist') maskPool = ['none', 'notch'];
  if (project.tier === 'luxury') maskPool = maskPool.filter(m => m !== 'blob' && m !== 'pill').concat('arch');
  return {
    mask: MASKS[forced.imageMask] ? forced.imageMask : pick(stream(seed, 'forms-mask'), maskPool),
    divider: 'none',
  };
}

// Фото, к которым применяется маска. Фон первого экрана (.hero__photo-bg) и мотивы-SVG не трогаем.
const MEDIA = [
  '.item__media img', '.gallery img', '.spotlight__media img', '.hero__figure img', '.bento__visual img', '.hero--asymmetric .visual img',
  '.proof-led__visual img', '.service-picker__panel img', '.portfolio-mosaic__photo img', '.portfolio-mosaic__fallback img',
  '.process-roadmap__visual img', '.local-presence__visual img', '.story-timeline__visual img', '.price-comparison__visual img',
  '.brand-manifesto__visual img', '.campaign-landing__visual img',
];
const sel = MEDIA.join(',');
const MASK_RULES = {
  none: '',
  arch: `${sel}{border-radius:50% 50% var(--ds-radius-md,0) var(--ds-radius-md,0)/26% 26% var(--ds-radius-md,0) var(--ds-radius-md,0)}`,
  notch: `${sel}{clip-path:polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,26px 100%,0 calc(100% - 26px))}`,
  slant: `${sel}{clip-path:polygon(0 0,100% 0,100% 88%,0 100%)}`,
  blob: `${sel}{border-radius:42% 58% 55% 45%/48% 40% 60% 52%}`,
  pill: `${sel}{border-radius:clamp(24px,6vw,48px)}`,
  circle: `${sel}{aspect-ratio:1/1;object-fit:cover;border-radius:50%}`,
  ellipse: `${sel}{border-radius:50%/38%;object-fit:cover}`,
  diamond: `${sel}{clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}`,
  hexagon: `${sel}{clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)}`,
  octagon: `${sel}{clip-path:polygon(29% 0,71% 0,100% 29%,100% 71%,71% 100%,29% 100%,0 71%,0 29%)}`,
  chevron: `${sel}{clip-path:polygon(12% 0,88% 0,100% 50%,88% 100%,12% 100%,0 50%)}`,
  parallelogram: `${sel}{clip-path:polygon(16% 0,100% 0,84% 100%,0 100%)}`,
  'wave-edge': `${sel}{clip-path:polygon(0 7%,10% 0,20% 7%,30% 0,40% 7%,50% 0,60% 7%,70% 0,80% 7%,90% 0,100% 7%,100% 100%,0 100%)}`,
  scallop: `${sel}{clip-path:polygon(0 12%,5% 4%,10% 12%,15% 4%,20% 12%,25% 4%,30% 12%,35% 4%,40% 12%,45% 4%,50% 12%,55% 4%,60% 12%,65% 4%,70% 12%,75% 4%,80% 12%,85% 4%,90% 12%,95% 4%,100% 12%,100% 88%,95% 96%,90% 88%,85% 96%,80% 88%,75% 96%,70% 88%,65% 96%,60% 88%,55% 96%,50% 88%,45% 96%,40% 88%,35% 96%,30% 88%,25% 96%,20% 88%,15% 96%,10% 88%,5% 96%,0 88%)}`,
  frame: `${sel}{border:10px solid var(--ds-surface);box-shadow:0 0 0 1px var(--ds-border),0 10px 24px color-mix(in srgb,var(--ds-text) 14%,transparent);box-sizing:border-box}`,
};

export function dividerHtml() { return ''; }
export function formsCss({ mask }) { return MASK_RULES[mask] || ''; }
