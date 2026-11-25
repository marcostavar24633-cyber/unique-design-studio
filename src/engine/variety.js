// Генератор закрепляет скруглённые прямоугольники. Реестр CSS-форм оставлен для совместимости,
// но альтернативная геометрия не выбирается автоматической сборкой. В редакторе есть собственные настройки.
// Эффекты появления работают с JavaScript и отключаются при prefers-reduced-motion.
import { pick, stream } from './util.js';

export const CARD_SHAPES = Object.freeze({
  square: 'Прямые углы',
  rounded: 'Мягкие скругления',
  capsule: 'Капсула',
  leaf: 'Лист',
  'leaf-reverse': 'Лист, зеркальный',
  tab: 'Вкладка',
  ticket: 'Билет с вырезами',
  chamfer: 'Срезанные углы',
  'cut-corner': 'Диагональный срез',
  notch: 'Вырез в углу',
  folded: 'Загнутый угол',
  'offset-frame': 'Смещённая рамка',
  blob: 'Органичная форма',
  squircle: 'Суперэллипс',
});
export const CARD_SHAPE_IDS = Object.keys(CARD_SHAPES);

export const REVEALS = Object.freeze({
  'fade-up': 'Подъём с проявлением',
  'fade-in': 'Мягкое проявление',
  'fade-down': 'Опускание с проявлением',
  'slide-left': 'Выезд слева',
  'slide-right': 'Выезд справа',
  'zoom-in': 'Приближение',
  'zoom-out': 'Отдаление',
  'blur-in': 'Проявление из размытия',
  'rotate-in': 'Лёгкий поворот',
  'flip-x': 'Переворот по горизонтали',
  'flip-y': 'Переворот по вертикали',
  'clip-up': 'Шторка снизу вверх',
  'clip-left': 'Шторка слева направо',
  'skew-in': 'Наклонный вход',
  'rise-scale': 'Подъём с увеличением',
  'slide-up-long': 'Дальний выезд снизу',
  'slide-left-deep': 'Выезд слева с глубиной',
  'slide-right-deep': 'Выезд справа с глубиной',
  'rotate-right': 'Поворот по часовой стрелке',
  'flip-diagonal': 'Объёмный диагональный вход',
  'zoom-blur': 'Резкое проявление из мягкого размытия',
  'clip-right': 'Шторка справа налево',
  'clip-center': 'Раскрытие из центра',
  'fold-open': 'Разворот сверху вниз',
  'soft-pop': 'Мягкое появление с масштабом',
});
export const REVEAL_IDS = Object.keys(REVEALS);

const REVEAL_POOL = {
  calm: ['fade-in', 'fade-up', 'blur-in', 'clip-up'],
  balanced: ['fade-up', 'slide-left', 'slide-right', 'zoom-in', 'clip-up', 'clip-left', 'rise-scale', 'fade-down', 'zoom-out', 'slide-up-long', 'slide-left-deep', 'slide-right-deep', 'rotate-right', 'flip-diagonal', 'zoom-blur', 'clip-right', 'clip-center', 'fold-open', 'soft-pop'],
  expressive: ['flip-x', 'flip-y', 'rotate-in', 'skew-in', 'rise-scale', 'clip-left', 'zoom-in', 'slide-right', 'slide-up-long', 'slide-left-deep', 'slide-right-deep', 'rotate-right', 'flip-diagonal', 'zoom-blur', 'clip-right', 'clip-center', 'fold-open', 'soft-pop'],
};

/** Генерация всегда использует прямоугольные карточки со скруглением; альтернативы остаются в canvas editor. */
export function chooseVariety(project = {}, options = {}) {
  const { archetype = '', intensity = 'balanced', seed = 0 } = options && typeof options === 'object' ? options : {};
  project = project && typeof project === 'object' ? project : {};
  const f = project.passthrough || {};
  let reveals = REVEAL_POOL[intensity] || REVEAL_POOL.balanced;
  if (project.tier === 'luxury') reveals = REVEAL_POOL.calm;
  if (archetype === 'brutalist') reveals = ['clip-up', 'clip-left', 'skew-in', 'slide-left'];
  return Object.freeze({
    cardShape: 'rounded',
    reveal: Object.hasOwn(REVEALS, f.revealEffect) ? f.revealEffect : pick(stream(seed, 'reveal-effect'), reveals),
    revealForced: Object.hasOwn(REVEALS, f.revealEffect),
  });
}

export const PHOTO_COMPOSITIONS = Object.freeze({
  grid: 'Ровная сетка',
  fan: 'Веер с перекрытием',
  overlap: 'Слоистая раскладка',
  stagger: 'Шахматный ритм',
  masonry: 'Редакционная колонная сетка',
  filmstrip: 'Горизонтальная карусель',
  feature: 'Один крупный кадр',
});

export const SECTION_COMPOSITIONS = Object.freeze({
  about: Object.freeze({ columns: 'Заголовок и текст в две колонки', centered: 'Центрированный рассказ', reading: 'Узкая колонка для чтения' }),
  faq: Object.freeze({ columns: 'Вопросы в две колонки', cards: 'Карточная раскладка', list: 'Последовательный список' }),
  contact: Object.freeze({ split: 'Контакты рядом с формой', stacked: 'Контакты и форма друг под другом', panel: 'Контакты на выделенной панели' }),
});

/** Независимая компоновка ключевых секций, выбранная по объёму контента и архитектуре. */
export function chooseSectionCompositions(project = {}, options = {}) {
  project = project && typeof project === 'object' ? project : {};
  const seed = options && typeof options === 'object' ? options.seed ?? project.id : project.id;
  const archetype = options?.archetype || '';
  const requested = project.passthrough?.sectionCompositions || {};
  const pickSection = (id, available, automatic) => Object.hasOwn(available, requested[id]) ? requested[id] : pick(stream(seed, `section-composition:${id}`), automatic);
  const compositions = {};
  if (project.aboutText) compositions.about = pickSection('about', SECTION_COMPOSITIONS.about,
    archetype === 'editorial' || archetype === 'storytelling' ? ['columns', 'reading', 'centered'] : ['reading', 'columns', 'centered']);
  if (Array.isArray(project.faqs) && project.faqs.length) compositions.faq = pickSection('faq', SECTION_COMPOSITIONS.faq,
    project.faqs.length >= 5 ? ['columns', 'cards', 'list'] : ['list', 'cards', 'columns']);
  compositions.contact = pickSection('contact', SECTION_COMPOSITIONS.contact,
    project.formAction ? ['split', 'stacked', 'panel'] : ['panel', 'stacked', 'split']);
  return Object.freeze(compositions);
}

/** Выбирает композицию фотогалереи по объёму материала и seed проекта. */
export function choosePhotoComposition(project = {}, options = {}) {
  project = project && typeof project === 'object' ? project : {};
  const count = Array.isArray(project.gallery) ? project.gallery.filter(photo => photo && (typeof photo === 'string' || photo.src)).length : 0;
  const requested = project.passthrough?.photoComposition;
  if (requested === 'fan' && count > 5) return 'overlap';
  if (Object.hasOwn(PHOTO_COMPOSITIONS, requested) && count >= 3) return requested;
  if (count < 3) return 'grid';
  const seed = options && typeof options === 'object' ? options.seed ?? project.id : project.id;
  const layouts = count <= 5
    ? ['fan', 'overlap', 'stagger', 'feature']
    : count <= 8
      ? ['overlap', 'stagger', 'masonry', 'filmstrip', 'feature']
      : ['masonry', 'filmstrip', 'stagger', 'grid'];
  return pick(stream(seed, 'photo-composition'), layouts);
}

/** Стили композиции фотографий. Все варианты сохраняют прямоугольные фото со скруглением. */
export function photoCompositionCss(id) {
  const shared = `.gallery img{border-radius:18px!important;clip-path:none!important;mask:none!important;-webkit-mask:none!important}`;
  const desktop = {
    fan: `@media(min-width:761px){.gallery--fan{display:flex;justify-content:center;align-items:center;gap:0;padding:clamp(24px,4vw,52px) 0}.gallery--fan>li{position:relative;flex:0 1 19%;min-width:0;margin-inline:-.5%;transform:rotate(var(--photo-tilt,0deg)) translateY(var(--photo-rise,0px));transition:transform .3s var(--ds-ease),z-index .3s}.gallery--fan>li:nth-child(1){--photo-tilt:-11deg;--photo-rise:22px}.gallery--fan>li:nth-child(2){--photo-tilt:-5deg;--photo-rise:4px}.gallery--fan>li:nth-child(3){--photo-tilt:0deg;--photo-rise:-8px}.gallery--fan>li:nth-child(4){--photo-tilt:5deg;--photo-rise:4px}.gallery--fan>li:nth-child(5){--photo-tilt:11deg;--photo-rise:22px}.gallery--fan--count-3>li:nth-child(1){--photo-tilt:-8deg;--photo-rise:12px}.gallery--fan--count-3>li:nth-child(2){--photo-tilt:0deg;--photo-rise:-6px}.gallery--fan--count-3>li:nth-child(3){--photo-tilt:8deg;--photo-rise:12px}.gallery--fan--count-4>li:nth-child(1){--photo-tilt:-9deg;--photo-rise:16px}.gallery--fan--count-4>li:nth-child(2){--photo-tilt:-3deg;--photo-rise:-4px}.gallery--fan--count-4>li:nth-child(3){--photo-tilt:3deg;--photo-rise:-4px}.gallery--fan--count-4>li:nth-child(4){--photo-tilt:9deg;--photo-rise:16px}.gallery--fan>li:hover{z-index:5;transform:translateY(-10px) rotate(0) scale(1.045)}.gallery--fan>li[data-reveal].is-in{transform:rotate(var(--photo-tilt,0deg)) translateY(var(--photo-rise,0px))}.gallery--fan>li[data-reveal].is-in:hover{transform:translateY(-10px) rotate(0) scale(1.045)}.gallery--fan figure{padding:7px;border:1px solid var(--ds-border);border-radius:var(--ds-radius-lg);background:var(--ds-surface);box-shadow:0 14px 32px color-mix(in srgb,var(--ds-text) 13%,transparent)}.gallery--fan img{aspect-ratio:4/5}}@media(prefers-reduced-motion:reduce){.gallery--fan>li{transition:none}.gallery--fan>li:hover,.gallery--fan>li[data-reveal].is-in:hover{transform:none}}`,
    overlap: `@media(min-width:761px){.gallery--overlap{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 10px;align-items:center;padding-block:16px}.gallery--overlap>li{position:relative;grid-column:span 4;margin-block:10px;transition:transform .25s var(--ds-ease),z-index .25s}.gallery--overlap>li:nth-child(3n+2){transform:translate(-12px,18px);z-index:2}.gallery--overlap>li:nth-child(3n){transform:translate(-24px,-10px);z-index:1}.gallery--overlap>li:nth-child(3n+2):hover,.gallery--overlap>li:nth-child(3n):hover{z-index:5;transform:translateY(-8px) scale(1.035)}.gallery--overlap>li[data-reveal].is-in:nth-child(3n+2){transform:translate(-12px,18px);z-index:2}.gallery--overlap>li[data-reveal].is-in:nth-child(3n){transform:translate(-24px,-10px);z-index:1}.gallery--overlap>li[data-reveal].is-in:nth-child(3n+2):hover,.gallery--overlap>li[data-reveal].is-in:nth-child(3n):hover{transform:translateY(-8px) scale(1.035);z-index:5}.gallery--overlap img{aspect-ratio:4/5}}@media(prefers-reduced-motion:reduce){.gallery--overlap>li{transition:none}.gallery--overlap>li:nth-child(3n+2):hover,.gallery--overlap>li:nth-child(3n):hover,.gallery--overlap>li[data-reveal].is-in:nth-child(3n+2):hover,.gallery--overlap>li[data-reveal].is-in:nth-child(3n):hover{transform:none}}`,
    stagger: `@media(min-width:761px){.gallery--stagger{grid-template-columns:repeat(4,minmax(0,1fr));align-items:start}.gallery--stagger>li:nth-child(even){margin-top:clamp(24px,5vw,64px)}.gallery--stagger>li:nth-child(4n+3){margin-top:clamp(12px,2.5vw,32px)}.gallery--stagger img{aspect-ratio:4/5}}`,
    masonry: `@media(min-width:761px){.gallery--masonry{display:block;columns:3;column-gap:clamp(12px,2vw,24px)}.gallery--masonry>li{break-inside:avoid;margin:0 0 clamp(12px,2vw,24px)}.gallery--masonry img{aspect-ratio:auto;max-height:460px;object-fit:cover}.gallery--masonry>li:nth-child(3n+2) img{aspect-ratio:4/3}}@media(min-width:761px) and (max-width:1000px){.gallery--masonry{columns:2}}`,
    filmstrip: `.gallery-carousel{position:relative;min-width:0}.gallery--filmstrip{display:flex;gap:clamp(12px,2vw,22px);overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;overscroll-behavior-y:none;scroll-snap-type:x mandatory;scrollbar-width:none;padding:4px 2px 16px;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch}.gallery--filmstrip::-webkit-scrollbar{display:none}.gallery--filmstrip>li{flex:0 0 min(82%,360px);min-width:0;scroll-snap-align:start}.gallery--filmstrip img{aspect-ratio:4/5}.gallery-carousel__controls{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}.gallery-carousel__button{display:grid;place-items:center;width:42px;min-height:42px;padding:0;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-surface);color:var(--ds-text);cursor:pointer}.gallery-carousel__button:hover:not(:disabled){border-color:var(--ds-accent);color:var(--ds-accent)}.gallery-carousel__button:disabled{opacity:.4;cursor:default}.gallery-carousel__button:focus-visible{outline:2px solid var(--ds-accent);outline-offset:3px}`,
    feature: `@media(min-width:761px){.gallery--feature{grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:minmax(110px,auto);align-items:stretch}.gallery--feature>li{grid-column:span 4}.gallery--feature>li:first-child{grid-column:span 8;grid-row:span 2}.gallery--feature>li:first-child img{height:100%;min-height:320px;aspect-ratio:auto}.gallery--feature>li:nth-child(2) img,.gallery--feature>li:nth-child(3) img{aspect-ratio:4/3}}`,
  };
  const mobile = id && id !== 'grid' && id !== 'filmstrip'
    ? `@media(max-width:760px){.gallery--${id}{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(10px,2vw,16px);overflow:visible}.gallery--${id}>li{position:static;grid-column:auto;grid-row:auto;flex:initial;transform:none!important;margin:0}.gallery--${id} img{aspect-ratio:4/5}.gallery--${id}>li:first-child img{min-height:0;aspect-ratio:4/5}}@media(max-width:420px){.gallery--${id}{grid-template-columns:1fr}}`
    : '';
  return shared + (desktop[id] || '') + mobile;
}

/** Стили автономных раскладок «О нас», FAQ и контактов. */
export function sectionCompositionsCss(compositions = {}) {
  const css = [];
  if (compositions.about === 'columns') css.push('@media(min-width:800px){.sec--about.section-composition--columns .ds-container{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:0 clamp(28px,6vw,88px);align-items:start}.sec--about.section-composition--columns .sec__head{position:sticky;top:24px}.sec--about.section-composition--columns .about__text{max-width:64ch}}');
  if (compositions.about === 'centered') css.push('.sec--about.section-composition--centered .sec__head,.sec--about.section-composition--centered .about__text{margin-inline:auto;text-align:center}.sec--about.section-composition--centered .about__text{max-width:60ch}');
  if (compositions.about === 'reading') css.push('.sec--about.section-composition--reading .ds-container{max-width:min(100% - 2 * var(--ds-gutter),860px)}.sec--about.section-composition--reading .about__text{max-width:68ch}');
  if (compositions.faq === 'columns') css.push('@media(min-width:760px){.faq--columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 32px}.faq--columns details:nth-child(odd):last-child{grid-column:1/-1}}');
  if (compositions.faq === 'cards') css.push('.faq--cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}.faq--cards details{padding:0 16px;border:1px solid var(--ds-border);border-radius:var(--ds-radius-md);background:var(--ds-surface)}.faq--cards details:last-child{border-bottom:1px solid var(--ds-border)}.faq--cards details[open] summary{border-bottom:1px solid var(--ds-border)}.faq--cards details p{padding-top:14px}');
  if (compositions.faq === 'list') css.push('.faq--list{max-width:780px}.faq--list details{border-top:1px solid var(--ds-border)}');
  if (compositions.contact === 'stacked') css.push('.sec--contact .contact--layout-stacked{max-width:820px;grid-template-columns:1fr}.sec--contact .contact--layout-stacked>div:first-child{max-width:62ch}');
  if (compositions.contact === 'panel') css.push('.sec--contact .contact--layout-panel{padding:clamp(20px,4vw,44px);border:1px solid var(--ds-border);border-radius:var(--ds-radius-lg);background:var(--ds-surface);box-shadow:0 18px 42px color-mix(in srgb,var(--ds-text) 7%,transparent)}');
  if (compositions.contact === 'split') css.push('@media(min-width:860px){.sec--contact .contact--layout-split{grid-template-columns:minmax(0,1fr) minmax(0,.9fr);align-items:start}}');
  return css.join('');
}

// Коробочные карточки, к которым применяется форма.
// Карточки с переворотом исключены: у них 3D-трансформация, а обрезка формой рассчитана на плоский блок.
const CARDS = ['.items--cards .item:not(.item--flip)', '.items--product .item:not(.item--flip)', '.items--bento .item:not(.item--flip)', '.adv--cards>li'];
const sel = suffix => CARDS.map(c => c + suffix).join(',');
const PHOTO_CARDS = ['.items--cards .item--photo', '.items--product .item--photo', '.items--bento .item--photo', '.adv--cards>li.item--photo'];
const photoSel = suffix => PHOTO_CARDS.map(c => c + suffix).join(',');

const SHAPE_CSS = {
  square: `${sel('')}{border-radius:0}`,
  rounded: `${sel('')}{border-radius:20px}`,
  capsule: `${sel('')}{border-radius:clamp(28px,4vw,44px)}`,
  leaf: `${sel('')}{border-radius:32px 6px 32px 6px}`,
  'leaf-reverse': `${sel('')}{border-radius:6px 32px 6px 32px}`,
  tab: `${sel('')}{border-radius:4px 26px 4px 4px}`,
  ticket: `${sel('')}{border-radius:10px;-webkit-mask:radial-gradient(circle 9px at 0 50%,transparent 98%,#000) left/51% 100% no-repeat,radial-gradient(circle 9px at 100% 50%,transparent 98%,#000) right/51% 100% no-repeat;mask:radial-gradient(circle 9px at 0 50%,transparent 98%,#000) left/51% 100% no-repeat,radial-gradient(circle 9px at 100% 50%,transparent 98%,#000) right/51% 100% no-repeat}`,
  chamfer: `${sel('')}{border-radius:0;clip-path:polygon(12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px),0 12px)}`,
  'cut-corner': `${sel('')}{border-radius:0;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))}`,
  notch: `${sel('')}{border-radius:8px;clip-path:polygon(0 0,100% 0,100% calc(100% - 22px),calc(100% - 22px) 100%,0 100%)}`,
  folded: `${sel('')}{border-radius:4px;clip-path:polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,0 100%)}${sel('::after')}{content:"";position:absolute;top:0;right:0;width:20px;height:20px;background:linear-gradient(225deg,transparent 50%,color-mix(in srgb,var(--ds-text) 14%,var(--ds-surface)) 50%);pointer-events:none}${sel('')}{position:relative}`,
  'offset-frame': `${sel('')}{border-radius:0;box-shadow:7px 7px 0 -1px var(--ds-bg),7px 7px 0 0 var(--ds-accent);margin:0 7px 7px 0}`,
  blob: `${sel('')}{border-radius:32px 14px 38px 18px/20px 36px 16px 32px}`,
  squircle: `${sel('')}{border-radius:30px/24px}`,
};

/** CSS формы карточек. */
const PHOTO_CARD_SHAPE_CSS = `${photoSel('')}{border-radius:20px;clip-path:none!important;mask:none!important;-webkit-mask:none!important}${photoSel(' .item__media')}{overflow:hidden;border-radius:18px}${photoSel(' .item__media img')}{border-radius:18px!important}`;
export function cardShapeCss(id) {
  return (Object.hasOwn(SHAPE_CSS, id) ? SHAPE_CSS[id] : '') + PHOTO_CARD_SHAPE_CSS;
}

// Начальное состояние элемента до появления; конечное — общее: исходное положение и полная видимость.
const REVEAL_FROM = {
  'fade-up': 'opacity:0;transform:translateY(18px)',
  'fade-in': 'opacity:0',
  'fade-down': 'opacity:0;transform:translateY(-16px)',
  'slide-left': 'opacity:0;transform:translateX(-36px)',
  'slide-right': 'opacity:0;transform:translateX(36px)',
  'zoom-in': 'opacity:0;transform:scale(.92)',
  'zoom-out': 'opacity:0;transform:scale(1.06)',
  'blur-in': 'opacity:0;filter:blur(10px)',
  'rotate-in': 'opacity:0;transform:rotate(-3deg) translateY(14px)',
  'flip-x': 'opacity:0;transform:perspective(900px) rotateX(18deg)',
  'flip-y': 'opacity:0;transform:perspective(900px) rotateY(-20deg)',
  'clip-up': 'opacity:.001;clip-path:inset(100% 0 0 0)',
  'clip-left': 'opacity:.001;clip-path:inset(0 100% 0 0)',
  'skew-in': 'opacity:0;transform:skewY(4deg) translateY(16px)',
  'rise-scale': 'opacity:0;transform:translateY(22px) scale(.96)',
  'slide-up-long': 'opacity:0;transform:translateY(54px)',
  'slide-left-deep': 'opacity:0;transform:translateX(-64px) scale(.97)',
  'slide-right-deep': 'opacity:0;transform:translateX(64px) scale(.97)',
  'rotate-right': 'opacity:0;transform:rotate(5deg) translateY(18px)',
  'flip-diagonal': 'opacity:0;transform:perspective(900px) rotate3d(1,1,0,-18deg) scale(.96)',
  'zoom-blur': 'opacity:0;transform:scale(.84);filter:blur(8px)',
  'clip-right': 'opacity:.001;clip-path:inset(0 0 0 100%)',
  'clip-center': 'opacity:.001;clip-path:inset(50% 50% 50% 50%)',
  'fold-open': 'opacity:0;transform:perspective(900px) rotateX(-32deg);transform-origin:top center',
  'soft-pop': 'opacity:0;transform:translateY(10px) scale(.88)',
  'luxury-reveal': 'opacity:0;transform:translateY(9px);filter:blur(6px)',
};

/** CSS эффекта появления. Перекрывает базовое появление; при reduced-motion всё сразу видно. */
export function revealCss(id) {
  const from = REVEAL_FROM[id];
  if (!from) return '';
  return `html.js-reveal [data-reveal]{${from};transition:opacity var(--ds-duration-slow) var(--ds-ease),transform var(--ds-duration-slow) var(--ds-ease),filter var(--ds-duration-slow) var(--ds-ease),clip-path var(--ds-duration-slow) var(--ds-ease);transition-delay:var(--uds-reveal-delay,0ms)}`
    + 'html.js-reveal [data-reveal].is-in{opacity:1;transform:none;filter:none;clip-path:inset(0 0 0 0)}'
    + 'html.js-reveal li[data-reveal]:nth-child(2){--uds-reveal-delay:70ms}html.js-reveal li[data-reveal]:nth-child(3){--uds-reveal-delay:140ms}html.js-reveal li[data-reveal]:nth-child(n+4){--uds-reveal-delay:200ms}'
    + '@media(prefers-reduced-motion:reduce){html.js-reveal [data-reveal]{opacity:1;transform:none;filter:none;clip-path:none;transition:none}}';
}

