// Graphic Art Direction — каталог визуальных концепций первого экрана и нишевой подбор.
// Это слой арт-дирекшена: он задаёт визуальное направление и требования к ассетам,
// но не притворяется, что WebGL/видео/3D-рендер уже реализованы в HTML-рендерере.
import { hash, pick, stream } from './util.js';

export const GRAPHIC_DIRECTIONS = Object.freeze({
  cinematic: { label: 'Cinematic Photography', ru: 'Кинематографическая фотография', techniques: ['hero-photography', 'dramatic-light', 'depth-of-field', 'cinematic-grade'], asset: 'Широкий выразительный кадр с главным объектом и свободной зоной под текст', motion: ['cinematic-reveal', 'subtle-parallax'], fit: ['photo', 'architecture', 'travel', 'hospitality', 'automotive'] },
  '3d-object': { label: '3D Object / Product Render', ru: 'Объектная 3D-визуализация', techniques: ['3d-render', 'studio-lighting', 'material-shading', 'soft-shadow'], asset: 'Один главный предмет, фотореалистичный рендер, контролируемые отражения и тени', motion: ['slow-float', 'pointer-tilt'], fit: ['jewelry', 'product', 'technology', 'furniture', 'beauty'] },
  'abstract-3d': { label: 'Abstract 3D', ru: 'Абстрактная 3D-графика', techniques: ['abstract-geometry', 'procedural-material', 'gradient-light', 'depth'], asset: 'Абстрактная объёмная композиция, согласованная с палитрой бренда', motion: ['slow-rotation', 'light-shift'], fit: ['technology', 'creative', 'agency', 'fashion'] },
  collage: { label: 'Photo Collage', ru: 'Фотоколлаж', techniques: ['layered-photography', 'cutout', 'overlap', 'editorial-frame'], asset: 'Несколько реальных кадров с разным масштабом и намеренными перекрытиями', motion: ['staggered-reveal', 'depth-parallax'], fit: ['fashion', 'photography', 'culture', 'food', 'creative'] },
  typography: { label: 'Typography-led', ru: 'Типографический экран', techniques: ['kinetic-type', 'oversized-type', 'type-as-image', 'high-contrast-layout'], asset: 'Типографика — главный визуал; фото вторично или отсутствует', motion: ['kinetic-type', 'masked-reveal'], fit: ['editorial', 'agency', 'culture', 'education'] },
  gradient: { label: 'Gradient Atmosphere', ru: 'Градиентная атмосфера', techniques: ['mesh-gradient', 'ambient-glow', 'color-fields', 'soft-blur'], asset: 'Многослойный цветовой фон с мягкими локальными источниками света', motion: ['slow-gradient-drift', 'glow-pulse'], fit: ['technology', 'beauty', 'wellness', 'creative'] },
  glass: { label: 'Glass Interface', ru: 'Стеклянный интерфейс', techniques: ['glass-panels', 'backdrop-blur', 'specular-edge', 'layered-depth'], asset: 'Полупрозрачные панели поверх контрастного, но спокойного фона', motion: ['subtle-float', 'light-sweep'], fit: ['technology', 'finance', 'architecture', 'premium-service'] },
  blueprint: { label: 'Technical Blueprint', ru: 'Технический чертёж', techniques: ['technical-lines', 'dimension-labels', 'grid-system', 'schematic-illustration'], asset: 'Чертёж, схема или точная техническая иллюстрация без фиктивных характеристик', motion: ['line-draw', 'grid-reveal'], fit: ['construction', 'engineering', 'architecture', 'industrial'] },
  editorial: { label: 'Editorial Art Direction', ru: 'Редакционная арт-фотография', techniques: ['art-direction', 'editorial-crop', 'cutout-subject', 'print-inspired-layout'], asset: 'Авторский журнальный кадр с выразительным кадрированием и типографической иерархией', motion: ['editorial-reveal', 'image-mask'], fit: ['fashion', 'jewelry', 'photography', 'beauty', 'culture'] },
  hud: { label: 'Futuristic HUD', ru: 'Футуристический интерфейс HUD', techniques: ['interface-overlays', 'micro-labels', 'reticles', 'data-ornaments'], asset: 'Декоративные интерфейсные слои; только реальные данные, если показаны показатели', motion: ['scan-reveal', 'interface-pulse'], fit: ['technology', 'gaming', 'engineering', 'automotive'] },
  lineart: { label: 'Line Art', ru: 'Контурная графика', techniques: ['svg-line-art', 'monoline-illustration', 'geometric-outline', 'stroke-animation'], asset: 'Оригинальная векторная иллюстрация с ясным силуэтом и минимумом деталей', motion: ['stroke-draw', 'path-reveal'], fit: ['education', 'wellness', 'architecture', 'service'] },
  macro: { label: 'Macro Texture', ru: 'Макрофактура', techniques: ['macro-photography', 'material-detail', 'tactile-light', 'surface-texture'], asset: 'Макрокадр реального материала или поверхности, точная передача фактуры', motion: ['slow-zoom', 'focus-transition'], fit: ['jewelry', 'furniture', 'construction', 'beauty', 'food'] },
  surreal: { label: 'Surreal Scene', ru: 'Сюрреалистическая сцена', techniques: ['surreal-compositing', 'impossible-scale', 'dreamscape', 'atmospheric-depth'], asset: 'Концептуальная сцена с одной ясной метафорой бренда, без случайного декора', motion: ['depth-drift', 'object-float'], fit: ['creative', 'fashion', 'travel', 'culture'] },
  data: { label: 'Data Visualization', ru: 'Визуализация данных', techniques: ['data-viz', 'charts', 'diagrammatic-layout', 'visual-metrics'], asset: 'График или диаграмма на основе подтверждённых данных; без выдуманных цифр', motion: ['chart-reveal', 'number-count-up'], fit: ['finance', 'technology', 'education', 'analytics'] },
  floating: { label: 'Floating Composition', ru: 'Парящая композиция', techniques: ['floating-objects', 'layered-shadows', 'studio-composition', 'spatial-layout'], asset: 'Несколько изолированных объектов в едином пространстве с реалистичными тенями', motion: ['slow-float', 'depth-parallax'], fit: ['product', 'beauty', 'jewelry', 'furniture', 'food'] },
});

const NICHE_RULES = [
  [/фото|фотограф|photograph|photo|видеограф/, ['cinematic', 'editorial', 'collage']],
  [/ювелир|украш|jewel|watch|часы/, ['3d-object', 'macro', 'editorial']],
  [/строит|ремонт|архитект|интерьер|строймат|construction|architect/, ['blueprint', 'cinematic', 'macro']],
  [/магазин|товар|мебел|диван|техник|телескоп|product|shop|store/, ['3d-object', 'floating', 'macro']],
  [/кофе|кафе|кухн|ресторан|бистро|бар(?![а-яё])|раков|пекарн|кондитер|пицц|суши|еда|доставк|food|cafe|restaurant|bakery/, ['cinematic', 'macro', 'collage']],
  // Короткие латинские «it» и «ai» — только целым словом: иначе ловились thai, fitness и т. п.
  [/\bit\b|\bai\b|saas|технолог|разработ|нейросет|software|tech/, ['abstract-3d', 'glass', 'hud', 'gradient']],
  [/финанс|банк|аналит|finance|bank|analytics/, ['data', 'glass', 'blueprint']],
  [/мода|одежд|fashion|beauty|космет|салон|spa/, ['editorial', 'collage', 'macro', '3d-object']],
  [/образован|курс|школ|education|учеб/, ['typography', 'lineart', 'data']],
  [/туризм|отел|путешеств|travel|hotel/, ['cinematic', 'surreal', 'collage']],
  [/креатив|дизайн|студия|агентств|creative|agency/, ['abstract-3d', 'typography', 'surreal']],
];

export function chooseGraphicDirection(project = {}, visual = {}) {
  project = project && typeof project === 'object' ? project : {};
  visual = visual && typeof visual === 'object' ? visual : {};
  const niche = String(project.niche || '').toLowerCase();
  const context = [project.description, project.mainOffer, project.brandCharacter].join(' ').toLowerCase();
  const source = niche + ' ' + context;
  const match = NICHE_RULES.find(([re]) => re.test(source));
  const candidates = match?.[1] || (visual.archetype === 'editorial' ? ['editorial', 'typography', 'collage'] : visual.archetype === 'immersive' ? ['cinematic', 'surreal', 'abstract-3d'] : ['cinematic', 'lineart', 'gradient']);
  const seed = hash([project.brand, project.niche, visual.archetype, visual.seed].join('|'));
  const id = pick(stream(seed, 'graphic-art-direction'), candidates);
  const direction = GRAPHIC_DIRECTIONS[id];
  const secondary = candidates.find(item => item !== id) || null;
  const restrained = /спокой|надёж|медицин|юрид|официаль|conservative|medical|legal/.test(source);
  const techniques = restrained ? direction.techniques.slice(0, 3) : direction.techniques;
  return {
    id, label: direction.label, ru: direction.ru, secondary,
    techniques, assetBrief: direction.asset,
    motion: restrained ? [] : direction.motion.slice(0, 2),
    rationale: match ? 'Подобрано по тематике и предложению проекта' : 'Подобрано по архитектуре и характеру проекта',
    implementation: 'art-direction', // Не означает, что все перечисленные технологии уже отрисовываются движком.
  };
}

export const GRAPHIC_DIRECTION_IDS = Object.keys(GRAPHIC_DIRECTIONS);
