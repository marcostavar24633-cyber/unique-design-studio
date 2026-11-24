// Формы фотографий выводятся из характера бренда; элементы управления не обрезаются масками.
export const MASKS = {
  'rounded-rect': 'прямоугольник со скруглёнными углами',
};
// Оставлено как совместимый sentinel для старых интеграций; разделители больше не генерируются.
export const DIVIDERS = Object.freeze({ none: 'без разделителей' });

/** Маска фото; прежнее поле sectionDivider намеренно игнорируется. */
export function chooseForms(project) {
  return { mask: 'rounded-rect', divider: 'none' };
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
  'rounded-rect': `${sel}{border-radius:18px}`,
};

export function dividerHtml() { return ''; }
export function formsCss(options = {}) {
  const mask = options && typeof options === 'object' ? options.mask : '';
  return Object.hasOwn(MASK_RULES, mask) ? MASK_RULES[mask] : MASK_RULES['rounded-rect'];
}
