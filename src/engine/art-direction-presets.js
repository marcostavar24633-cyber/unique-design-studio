// Coordinated art-direction recipes: hero composition, navigation, typography,
// controls, texture, light and section rhythm are chosen as one visual system.
import { GRAPHIC_DIRECTIONS } from './graphic-art-direction.js';
import { CINEMATIC_PRESETS } from './cinematic/visual-layers.js';
import { TRANSITIONS } from './cinematic/transitions.js';
import { CARD_EFFECTS, HERO_EFFECTS } from './effects.js';
import { TEXT_EFFECTS } from './text-effects.js';
import { TYPE_STYLES, TEXT_ANIMATIONS, BUTTON_ANIMATIONS, SECTION_LAYOUTS } from './typography-layout.js';
import { ARCHETYPES, BUTTONS, DIRECTIONS, NAV_LABELS } from './data.js';
import { MASKS } from './forms.js';

export const ART_DIRECTION_PRESETS = Object.freeze({
  cinema: {
    label: 'Кино и атмосфера', description: 'Полноэкранный сюжет, глубокий свет, мягкое движение и выразительная журнальная шапка.',
    archetypes: ['immersive', 'editorial'], placements: { immersive: 'bleed-bottom-left', editorial: 'column-and-plate' }, navStyle: 'overlay',
    directions: ['night-sky', 'gallery-black'], graphicDirection: 'cinematic', cinematicLayers: 'film',
    heroWithPhoto: 'ken-burns', heroWithGallery: 'slideshow', heroWithoutPhoto: 'aurora', cardEffect: 'photo-zoom',
    textEffect: 'scroll-fade',
    buttonStyle: 'glass', typeStyle: 'italic-accent', textAnimation: 'blur-in', buttonAnimation: 'shine',
    sectionLayout: 'alternating', transitionType: 'glow', imageMask: 'rounded-rect', motionStyle: 'cinematic',
  },
  aurora: {
    label: 'Световая аврора', description: 'Многослойные цветовые поля, крупный заголовок, светящиеся CTA и плавный ритм.',
    archetypes: ['immersive', 'asymmetric', 'modular-grid'], placements: { immersive: 'bleed-center', asymmetric: 'offset-right' }, navStyle: 'overlay',
    directions: ['graphite-coral', 'night-sky', 'clean-tech'], graphicDirection: 'gradient', cinematicLayers: 'soft-grain',
    heroWithPhoto: 'duotone', heroWithGallery: 'slideshow', heroWithoutPhoto: 'aurora', cardEffect: 'gradient-border',
    textEffect: 'scroll-fade',
    buttonStyle: 'glow', typeStyle: 'oversized', textAnimation: 'highlight-sweep', buttonAnimation: 'pulse',
    sectionLayout: 'bands', transitionType: 'mesh', imageMask: 'rounded-rect', motionStyle: 'cinematic',
  },
  editorial: {
    label: 'Журнальная типографика', description: 'Мастхед, колонная композиция, бумажная фактура и выразительная работа с заголовками.',
    archetypes: ['editorial', 'storytelling', 'brand-manifesto'], placements: { editorial: 'column-and-plate', storytelling: 'chapter-side', 'brand-manifesto': 'manifesto-center' }, navStyle: 'masthead',
    directions: ['warm-paper', 'gallery-white', 'aubergine'], graphicDirection: 'editorial', cinematicLayers: 'paper-light',
    heroWithPhoto: 'line-split', heroWithGallery: 'line-split', heroWithoutPhoto: 'line-split', cardEffect: 'underline-arrow',
    textEffect: 'scroll-fade',
    buttonStyle: 'outline', typeStyle: 'italic-accent', textAnimation: 'rise-headings', buttonAnimation: 'underline-grow',
    sectionLayout: 'magazine', transitionType: 'fade', imageMask: 'rounded-rect', motionStyle: 'cinematic',
  },
  product: {
    label: 'Предметная сцена', description: 'Товар или работа становится главным объектом, навигация поддерживает каталог, CTA получает чёткий акцент.',
    archetypes: ['product-first', 'portfolio-mosaic', 'immersive'], placements: { 'product-first': 'spotlight-stage', 'portfolio-mosaic': 'mosaic-visual-first', immersive: 'bleed-center' }, navStyle: 'bar',
    directions: ['clean-tech', 'gallery-white', 'night-sky'], graphicDirection: '3d-object', cinematicLayers: 'soft-grain',
    heroWithPhoto: 'ken-burns', heroWithGallery: 'slideshow', heroWithoutPhoto: 'morph', cardEffect: 'spotlight',
    textEffect: 'scroll-fade',
    buttonStyle: 'gradient', typeStyle: 'tight-display', textAnimation: 'tracking-in', buttonAnimation: 'shine',
    sectionLayout: 'inset-panel', transitionType: 'glow', imageMask: 'rounded-rect', motionStyle: 'cinematic',
  },
  graphic: {
    label: 'Графический контраст', description: 'Плакатная композиция, крупная типографика, полутон и контрастные блоки.',
    archetypes: ['brutalist', 'asymmetric', 'modular-grid'], placements: { brutalist: 'type-wall', asymmetric: 'offset-left' }, navStyle: 'minimal',
    directions: ['signal', 'sunny-ink', 'graphite-coral'], graphicDirection: 'collage', cinematicLayers: 'halftone',
    heroWithPhoto: 'photo-wipe', heroWithGallery: 'double-exposure', heroWithoutPhoto: 'grid', cardEffect: 'stack',
    textEffect: 'scroll-fade',
    buttonStyle: 'block', typeStyle: 'oversized', textAnimation: 'skew-headings', buttonAnimation: 'nudge',
    sectionLayout: 'index-number', transitionType: 'split', imageMask: 'rounded-rect', motionStyle: 'cinematic',
  },
  'atelier-luxe': {
    label: 'Ателье — тихая роскошь', description: 'Тёплая журнальная подача, деликатный свет и сатиновые детали без навязчивого движения.',
    archetypes: ['editorial', 'immersive', 'storytelling'], placements: { editorial: 'column-and-plate', immersive: 'bleed-bottom-left', storytelling: 'chapter-side' }, navStyle: 'masthead',
    directions: ['warm-paper', 'aubergine', 'gallery-white'], graphicDirection: 'editorial', cinematicLayers: 'paper-light',
    heroWithPhoto: 'focus-pull', heroWithGallery: 'duotone', heroWithoutPhoto: 'atelier-light', cardEffect: 'satin-edge',
    textEffect: 'scroll-fade',
    buttonStyle: 'outline', typeStyle: 'italic-accent', textAnimation: 'rise-headings', buttonAnimation: 'underline-grow',
    sectionLayout: 'magazine', transitionType: 'fade', imageMask: 'rounded-rect', motionStyle: 'luxury',
  },
  'black-tie': {
    label: 'Black Tie — вечерняя галерея', description: 'Глубокий тёмный фон, крупная антиква, точечный свет и строгие контурные элементы.',
    archetypes: ['immersive', 'editorial', 'brand-manifesto'], placements: { immersive: 'bleed-center', editorial: 'column-and-plate', 'brand-manifesto': 'manifesto-center' }, navStyle: 'overlay',
    directions: ['gallery-black', 'night-sky', 'aubergine'], graphicDirection: 'cinematic', cinematicLayers: 'film',
    heroWithPhoto: 'duotone', heroWithGallery: 'slideshow', heroWithoutPhoto: 'atelier-light', cardEffect: 'layered-shadow',
    textEffect: 'scroll-fade',
    buttonStyle: 'outline', typeStyle: 'small-caps', textAnimation: 'tracking-in', buttonAnimation: 'border-draw',
    sectionLayout: 'wide', transitionType: 'glow', imageMask: 'rounded-rect', motionStyle: 'luxury',
  },
  'modern-heirloom': {
    label: 'Modern Heirloom — наследие сегодня', description: 'Материалы и оттенки ремесленной мастерской в чистой современной композиции.',
    archetypes: ['editorial', 'product-first', 'portfolio-mosaic'], placements: { editorial: 'column-and-plate', 'product-first': 'spotlight-stage', 'portfolio-mosaic': 'mosaic-visual-first' }, navStyle: 'bar',
    directions: ['chestnut', 'warm-paper', 'forest'], graphicDirection: 'macro', cinematicLayers: 'soft-grain',
    heroWithPhoto: 'focus-pull', heroWithGallery: 'duotone', heroWithoutPhoto: 'line-split', cardEffect: 'satin-edge',
    textEffect: 'scroll-fade',
    buttonStyle: 'underline', typeStyle: 'small-caps', textAnimation: 'rise-headings', buttonAnimation: 'underline-grow',
    sectionLayout: 'inset-panel', transitionType: 'fade', imageMask: 'rounded-rect', motionStyle: 'luxury',
  },
});

export const ART_DIRECTION_PRESET_IDS = Object.keys(ART_DIRECTION_PRESETS);

/** Apply a recipe to automatic choices while retaining every explicit field override. */
export function applyArtDirectionPreset(project) {
  const id = project?.passthrough?.artDirectionPreset;
  const preset = Object.hasOwn(ART_DIRECTION_PRESETS, id) ? ART_DIRECTION_PRESETS[id] : null;
  if (!preset) return project;
  const passthrough = { ...project.passthrough };
  const uniqueGalleryCount = new Set((Array.isArray(project.gallery) ? project.gallery : []).map(photo => typeof photo === 'string' ? photo : photo?.src).filter(Boolean)).size;
  const hasPhoto = Boolean(project.images?.hero || uniqueGalleryCount);
  const settings = {
    navStyle: preset.navStyle,
    heroPlacement: preset.placements?.[project.architecture?.exact] || '',
    graphicDirection: preset.graphicDirection,
    cinematicLayers: preset.cinematicLayers,
    heroEffect: uniqueGalleryCount >= 2 ? preset.heroWithGallery : hasPhoto ? preset.heroWithPhoto : preset.heroWithoutPhoto,
    cardEffect: preset.cardEffect,
    textEffect: preset.textEffect,
    buttonStyle: preset.buttonStyle,
    typeStyle: preset.typeStyle,
    textAnimation: preset.textAnimation,
    buttonAnimation: preset.buttonAnimation,
    sectionLayout: preset.sectionLayout,
    transitionType: preset.transitionType,
    imageMask: preset.imageMask,
    motionStyle: preset.motionStyle,
  };
  for (const [key, value] of Object.entries(settings)) {
    if (value && (passthrough[key] === undefined || passthrough[key] === '')) passthrough[key] = value;
  }
  return { ...project, passthrough };
}

/** Validation for recipes; useful to keep UI options synchronized with engine capabilities. */
export function validateArtDirectionPresets() {
  const checks = {
    directions: Object.keys(DIRECTIONS), graphics: Object.keys(GRAPHIC_DIRECTIONS),
    layers: Object.keys(CINEMATIC_PRESETS), heroes: Object.keys(HERO_EFFECTS), cards: Object.keys(CARD_EFFECTS),
    text: Object.keys(TEXT_EFFECTS), types: Object.keys(TYPE_STYLES), textAnimations: Object.keys(TEXT_ANIMATIONS),
    buttonAnimations: Object.keys(BUTTON_ANIMATIONS), sectionLayouts: Object.keys(SECTION_LAYOUTS),
    transitions: Object.keys(TRANSITIONS), masks: Object.keys(MASKS),
    buttons: Object.keys(BUTTONS), navs: Object.keys(NAV_LABELS), architectures: Object.keys(ARCHETYPES),
  };
  const errors = [];
  for (const [id, preset] of Object.entries(ART_DIRECTION_PRESETS)) {
    for (const field of ['directions', 'archetypes']) for (const value of preset[field] || []) if (!checks[field === 'directions' ? 'directions' : 'architectures'].includes(value)) errors.push(`${id}.${field}: ${value}`);
    for (const field of ['graphicDirection', 'cinematicLayers', 'heroWithPhoto', 'heroWithGallery', 'heroWithoutPhoto', 'cardEffect', 'textEffect', 'typeStyle', 'textAnimation', 'buttonAnimation', 'sectionLayout', 'transitionType', 'imageMask', 'buttonStyle', 'navStyle']) {
      const map = { graphicDirection: 'graphics', cinematicLayers: 'layers', heroWithPhoto: 'heroes', heroWithGallery: 'heroes', heroWithoutPhoto: 'heroes', cardEffect: 'cards', textEffect: 'text', typeStyle: 'types', textAnimation: 'textAnimations', buttonAnimation: 'buttonAnimations', sectionLayout: 'sectionLayouts', transitionType: 'transitions', imageMask: 'masks', buttonStyle: 'buttons', navStyle: 'navs' };
      if (!checks[map[field]]?.includes(preset[field])) errors.push(`${id}.${field}: ${preset[field]}`);
    }
    for (const [architecture, placement] of Object.entries(preset.placements || {})) {
      if (!Object.hasOwn(ARCHETYPES, architecture) || !Object.hasOwn(ARCHETYPES[architecture].placements, placement)) errors.push(`${id}.placements.${architecture}: ${placement}`);
    }
  }
  return errors;
}
