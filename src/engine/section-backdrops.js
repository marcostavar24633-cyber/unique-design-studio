// Лёгкие статичные фоновые акценты для выбранных секций. Не добавляют разметку и не перекрывают контент.
import { pick, stream } from './util.js';

const CANDIDATES = ['about', 'items', 'advantages', 'process', 'gallery', 'faq'];
const TECH_NICHES = new Set(['saas', 'optics', 'appliances', 'construction']);

/** Назначает один подходящий фон одной секции: декор остаётся редким и не спорит с содержанием. */
export function chooseSectionBackdrops(project = {}, options = {}) {
  let { sections = [], archetype = '', nicheId = '', seed = 0 } = options && typeof options === 'object' ? options : {};
  project = project && typeof project === 'object' ? project : {};
  sections = Array.isArray(sections) ? sections : [];
  const available = CANDIDATES.filter(id => sections.includes(id));
  if (!available.length) return Object.freeze({});

  const technical = TECH_NICHES.has(nicheId) || /tech|digital|engineering/.test(nicheId) || ['clean-tech', 'editorial-tech'].includes(archetype);
  const preferred = project.tier === 'luxury'
    ? ['about', 'gallery', 'items']
    : technical
      ? ['items', 'process', 'faq']
      : ['about', 'gallery', 'advantages', 'items'];
  const section = pick(stream(seed, 'section-backdrop-target'), [...new Set(preferred.filter(id => available.includes(id)).concat(available))]);
  const style = project.tier === 'luxury'
    ? 'soft-wash'
    : technical
      ? 'technical-grid'
      : pick(stream(seed, 'section-backdrop-style'), ['accent-glow', 'soft-wash']);
  return Object.freeze({ [section]: style });
}

/** CSS-подложки используют только градиенты: они не влияют на контраст текста и не двигают разметку. */
export function sectionBackdropsCss(backdrops = {}) {
  if (!backdrops || typeof backdrops !== 'object' || Array.isArray(backdrops)) return '';
  const safeIds = new Set(CANDIDATES);
  const styles = {
    'accent-glow': 'radial-gradient(ellipse 62% 48% at 8% 4%,color-mix(in srgb,var(--ds-accent) 10%,transparent),transparent 76%),radial-gradient(ellipse 45% 42% at 94% 92%,color-mix(in srgb,var(--ds-accent) 7%,transparent),transparent 78%)',
    'soft-wash': 'radial-gradient(ellipse 75% 70% at 0% 0%,color-mix(in srgb,var(--ds-accent) 8%,transparent),transparent 74%),radial-gradient(ellipse 60% 55% at 100% 100%,color-mix(in srgb,var(--ds-text) 4%,transparent),transparent 78%)',
    'technical-grid': 'linear-gradient(color-mix(in srgb,var(--ds-accent) 4%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--ds-accent) 4%,transparent) 1px,transparent 1px)',
  };
  return Object.entries(backdrops).filter(([id, style]) => safeIds.has(id) && Object.hasOwn(styles, style))
    .map(([id, style]) => `#${id}.ds-section{background-image:${styles[style]};${style === 'technical-grid' ? 'background-size:40px 40px' : ''}}`)
    .join('');
}
