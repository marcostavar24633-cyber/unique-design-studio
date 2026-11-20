// Разнообразие оформления: 15 форм карточек и 15 эффектов появления блоков.
// Формы применяются только к «коробочным» карточкам (позиции-карточки, товарные, бенто, карточки преимуществ):
// списки-линейки и нумерованные позиции не меняются. Срезы углов не глубже внутреннего отступа карточек,
// поэтому текст не обрезается. Появление работает только с JavaScript и без prefers-reduced-motion:
// без них контент сразу виден.
import { pick, stream } from './util.js';

export const CARD_SHAPES = Object.freeze({
  square: 'Прямые углы',
  rounded: 'Мягкие скругления',
  capsule: 'Капсула',
  leaf: 'Лист',
  'leaf-reverse': 'Лист, зеркальный',
  arch: 'Арка сверху',
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
});
export const REVEAL_IDS = Object.keys(REVEALS);

// Пулы авто-выбора: по форме палитры и архитектуре.
const SHAPE_POOL = {
  sharp: ['square', 'chamfer', 'cut-corner', 'notch', 'folded', 'offset-frame', 'tab', 'ticket'],
  soft: ['rounded', 'tab', 'leaf', 'ticket', 'squircle', 'folded', 'notch'],
  round: ['capsule', 'blob', 'leaf', 'arch', 'squircle', 'leaf-reverse'],
};
const REVEAL_POOL = {
  calm: ['fade-in', 'fade-up', 'blur-in', 'clip-up'],
  balanced: ['fade-up', 'slide-left', 'slide-right', 'zoom-in', 'clip-up', 'clip-left', 'rise-scale', 'fade-down', 'zoom-out'],
  expressive: ['flip-x', 'flip-y', 'rotate-in', 'skew-in', 'rise-scale', 'clip-left', 'zoom-in', 'slide-right'],
};

/** Форма карточек и эффект появления. Ручной выбор владельца (passthrough.cardShape / revealEffect) главнее. */
export function chooseVariety(project = {}, { shape = 'soft', archetype = '', intensity = 'balanced', seed = 0 } = {}) {
  const f = project.passthrough || {};
  let shapes = SHAPE_POOL[shape] || SHAPE_POOL.soft;
  if (archetype === 'brutalist') shapes = ['square', 'chamfer', 'offset-frame'];
  if (project.tier === 'luxury') shapes = ['square', 'arch', 'leaf', 'rounded'];
  let reveals = REVEAL_POOL[intensity] || REVEAL_POOL.balanced;
  if (project.tier === 'luxury') reveals = REVEAL_POOL.calm;
  if (archetype === 'brutalist') reveals = ['clip-up', 'clip-left', 'skew-in', 'slide-left'];
  return Object.freeze({
    cardShape: CARD_SHAPES[f.cardShape] ? f.cardShape : pick(stream(seed, 'card-shape'), shapes),
    reveal: REVEALS[f.revealEffect] ? f.revealEffect : pick(stream(seed, 'reveal-effect'), reveals),
    revealForced: Boolean(REVEALS[f.revealEffect]),
  });
}

// Коробочные карточки, к которым применяется форма.
// Карточки с переворотом исключены: у них 3D-трансформация, а обрезка формой рассчитана на плоский блок.
const CARDS = ['.items--cards .item:not(.item--flip)', '.items--product .item:not(.item--flip)', '.items--bento .item:not(.item--flip)', '.adv--cards>li'];
const sel = suffix => CARDS.map(c => c + suffix).join(',');

const SHAPE_CSS = {
  square: `${sel('')}{border-radius:0}`,
  rounded: `${sel('')}{border-radius:20px}`,
  capsule: `${sel('')}{border-radius:clamp(28px,4vw,44px)}`,
  leaf: `${sel('')}{border-radius:32px 6px 32px 6px}`,
  'leaf-reverse': `${sel('')}{border-radius:6px 32px 6px 32px}`,
  arch: `${sel('')}{border-radius:56px 56px 10px 10px}`,
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
export function cardShapeCss(id) {
  return SHAPE_CSS[id] || '';
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
};

/** CSS эффекта появления. Перекрывает базовое появление; при reduced-motion всё сразу видно. */
export function revealCss(id) {
  const from = REVEAL_FROM[id];
  if (!from) return '';
  return `html.js-reveal [data-reveal]{${from};transition:opacity var(--ds-duration-slow) var(--ds-ease),transform var(--ds-duration-slow) var(--ds-ease),filter var(--ds-duration-slow) var(--ds-ease),clip-path var(--ds-duration-slow) var(--ds-ease)}`
    + 'html.js-reveal [data-reveal].is-in{opacity:1;transform:none;filter:none;clip-path:inset(0 0 0 0)}'
    + 'html.js-reveal li[data-reveal]:nth-child(2){transition-delay:70ms}html.js-reveal li[data-reveal]:nth-child(3){transition-delay:140ms}html.js-reveal li[data-reveal]:nth-child(n+4){transition-delay:200ms}'
    + '@media(prefers-reduced-motion:reduce){html.js-reveal [data-reveal]{opacity:1;transform:none;filter:none;clip-path:none;transition:none}}';
}
