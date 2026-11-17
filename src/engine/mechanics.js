// Механики карточек раздела «Позиции»: поверх визуального варианта (cards, product, menu…) карточки получают
// поведение — раскрытие, переворот, колоду при прокрутке, горизонтальную ленту или мозаику.
// Принципы: работает с клавиатуры и экранным диктором; без JavaScript (всё на HTML и CSS) и при
// prefers-reduced-motion карточки остаются обычным читаемым списком; ничего не прячется навсегда.
import { pick, stream } from './util.js';

export const MECHANICS = {
  none: 'обычная сетка карточек',
  expand: 'раскрытие: карточка разворачивается на две колонки с подробностями',
  flip: 'переворот: на лицевой стороне фото и название, на обороте описание и цена',
  stack: 'колода: карточки накладываются друг на друга при прокрутке',
  rail: 'горизонтальная лента с прокруткой и привязкой к карточкам',
  masonry: 'мозаика: колонки карточек разной высоты',
};

// Какие механики уместны для архитектуры: характер страницы задаёт поведение карточек.
const BY_ARCHETYPE = {
  'product-first': ['flip', 'rail', 'expand'],
  editorial: ['masonry', 'expand', 'stack'],
  immersive: ['rail', 'stack', 'flip'],
  asymmetric: ['masonry', 'stack', 'flip'],
  catalog: ['expand', 'rail', 'masonry'],
  'split-utility': ['expand', 'none'],
  storytelling: ['stack', 'rail', 'masonry'],
  'modular-grid': ['flip', 'masonry', 'expand'],
  brutalist: ['stack', 'expand', 'masonry'],
  minimal: ['expand', 'none', 'rail'],
};

/**
 * Механика карточек для проекта. Решение воспроизводимо (по seed) и учитывает данные:
 * для переворота нужны фото и описание, для колоды — 3–8 позиций, для ленты — от 4,
 * с фильтрами магазина — только механики, которые не ломаются при скрытии карточек.
 */
export function chooseMechanic(project, archetype, seed, commerce = {}) {
  const forced = project.passthrough?.itemsMechanic;
  if (forced && MECHANICS[forced]) return forced;
  const items = (project.services || []).filter(i => i.title);
  const n = items.length;
  if (n < 2) return 'none';
  const withImage = items.filter(i => i.image).length, withText = items.filter(i => i.text).length;
  const longText = items.some(i => (i.text || '').length > 90);
  const fits = {
    none: true,
    expand: withText >= Math.ceil(n / 2),
    flip: withImage === n && withText >= Math.ceil(n * 0.75) && n <= 9,
    stack: n >= 3 && n <= 8 && !commerce.tools,
    rail: n >= 4,
    masonry: n >= 5 && (longText || withImage > 0),
  };
  const pool = (BY_ARCHETYPE[archetype] || ['none']).filter(id => fits[id]);
  if (!pool.length) return 'none';
  return pick(stream(seed, 'items-mechanic'), pool);
}

// Стили механик. Всё, что движется, — только при prefers-reduced-motion: no-preference и для устройств с наведением.
export const MECHANIC_CSS = {
  none: '',
  expand: `
.items--mech-expand{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:var(--u-gap,20px);grid-auto-flow:dense}
.items--mech-expand .item:has(.item__more[open]){grid-column:span 2}
@media(max-width:640px){.items--mech-expand .item:has(.item__more[open]){grid-column:auto}}
.item__more{margin-top:10px}
.item__more>summary{display:inline-flex;align-items:center;gap:6px;min-height:44px;cursor:pointer;font-weight:600;color:var(--ds-accent-text,currentColor);list-style:none}
.item__more>summary::-webkit-details-marker{display:none}
.item__more>summary::after{content:"+";font-size:1.2em;line-height:1}
.item__more[open]>summary::after{content:"−"}
.item__more>summary:focus-visible{outline:2px solid var(--ds-focus,currentColor);outline-offset:3px}
.item__more p{margin:.4em 0 0}`,
  flip: `
.items--mech-flip{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:var(--u-gap,20px)}
.flip{display:grid}
.flip__back{padding-top:10px}
@media (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){
  .flip{perspective:1200px}
  .flip__inner{display:grid;transition:transform .6s cubic-bezier(.2,.7,.2,1);transform-style:preserve-3d}
  .flip__front,.flip__back{grid-area:1/1;backface-visibility:hidden;-webkit-backface-visibility:hidden}
  .flip__back{transform:rotateY(180deg);display:grid;align-content:center;padding:clamp(16px,2vw,24px);background:var(--ds-surface);border-radius:inherit}
  .item--flip:hover .flip__inner,.item--flip:focus-within .flip__inner{transform:rotateY(180deg)}
  .flip__hint{display:block;margin-top:6px;font-size:.85em;opacity:.7}
}
.flip__hint{display:none}`,
  stack: `
.items--mech-stack{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(14px,2vw,22px)}
@media(min-width:700px){
  .items--mech-stack .item{position:sticky;top:calc(var(--stack-top,84px) + var(--stack-i,0) * 14px);box-shadow:0 -10px 30px rgba(0,0,0,.12);background:var(--ds-bg);padding-block:clamp(12px,1.6vw,20px)}
  /* Карточка колоды должна помещаться в экран: иначе следующая «прилипает» поверх недочитанного текста.
     Фото слева, текст справа, высота фото ограничена. */
  .items--mech-stack .item:has(.item__media){display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);align-items:center;gap:clamp(16px,2.4vw,32px)}
  .items--mech-stack .item__media{position:relative;aspect-ratio:4/3;max-height:min(300px,42vh);overflow:hidden}
  .items--mech-stack .item__media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .items--mech-stack .item:last-child{margin-bottom:0}
}`,
  rail: `
.rail{overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding-inline:var(--u-pad,20px);padding-bottom:10px;scrollbar-width:thin}
.rail:focus-visible{outline:2px solid var(--ds-focus,currentColor);outline-offset:4px}
.items--mech-rail{display:grid;grid-template-columns:none;grid-template-rows:none;grid-auto-flow:column;grid-auto-columns:min(78vw,320px);gap:var(--u-gap,20px);margin:0;padding:0}
.items--mech-rail .item{scroll-snap-align:start}
.rail__hint{margin:.6em 0 0;font-size:.9em;opacity:.75}`,
  masonry: `
.items--mech-masonry{display:block;columns:3 260px;column-gap:var(--u-gap,20px)}
.items--mech-masonry .item{break-inside:avoid;margin-bottom:var(--u-gap,20px);display:block}`,
};

/** Разметка тела карточки с учётом механики. parts — готовые фрагменты HTML (экранированы вызывающим). */
export function mechanicBody(mechanic, { media, title, text, price, action }) {
  if (mechanic === 'expand' && text) {
    return `${media}<div class="item__body">${title}${price}<details class="item__more"><summary>Подробнее</summary>${text}</details>${action}</div>`;
  }
  if (mechanic === 'flip' && media && text) {
    return `<div class="flip"><div class="flip__inner"><div class="flip__front">${media}<div class="item__body">${title}<span class="flip__hint" aria-hidden="true">Наведите, чтобы узнать больше</span></div></div><div class="flip__back">${text}${price}${action}</div></div></div>`;
  }
  return `${media}<div class="item__body">${title}${text}${price}${action}</div>`;
}
