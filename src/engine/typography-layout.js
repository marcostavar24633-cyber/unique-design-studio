// Типографика (15 стилей оформления заголовков), раскладки секций (15), анимации текста и кнопок.
// Стили типографики работают поверх выбранной пары шрифтов и не меняют цвета: контраст остаётся прежним
// (маркер — тон палитры, пара «текст / тон» проверена). Анимации — только без prefers-reduced-motion;
// эффекты при прокрутке — только где браузер поддерживает animation-timeline, иначе текст просто виден.
import { pick, stream } from './util.js';

export const TYPE_STYLES = Object.freeze({
  'tight-display': 'Плотный дисплейный',
  'airy-light': 'Воздушный лёгкий',
  'caps-wide': 'Прописные с разрядкой',
  'italic-accent': 'Курсивный акцент',
  oversized: 'Крупный заголовок',
  'condensed-stack': 'Узкий столбик',
  'mono-labels': 'Моноширинные подписи',
  'small-caps': 'Капитель',
  'underline-accent': 'Акцентное подчёркивание',
  'marker-highlight': 'Маркер',
  'numbered-headings': 'Нумерованные заголовки',
  'slash-kicker': 'Подпись со слэшем',
  'centered-headings': 'Центр с орнаментом',
  'tall-leading': 'Просторный ритм',
  compact: 'Компактный',
});
export const TYPE_STYLE_IDS = Object.keys(TYPE_STYLES);

const H2 = '.ds-section .sec__head h2,.ds-section>.ds-container>h2,.contact h2';
const TYPE_CSS = {
  'tight-display': `h1{font-weight:800;letter-spacing:-.045em;line-height:.98}${H2}{font-weight:750;letter-spacing:-.03em}`,
  'airy-light': `h1{font-weight:300;letter-spacing:-.01em;line-height:1.12}${H2}{font-weight:350;letter-spacing:0}`,
  'caps-wide': `h1{text-transform:uppercase;letter-spacing:.06em;line-height:1.08;font-size:clamp(1.8rem,1.1rem + 3.2vw,3.6rem)}${H2}{text-transform:uppercase;letter-spacing:.1em;font-size:clamp(1.05rem,.9rem + .8vw,1.45rem)}`,
  'italic-accent': `h1,${H2}{font-style:italic}.hero .lede{font-style:italic}`,
  oversized: `@media(min-width:900px){h1{font-size:clamp(3rem,1rem + 6.4vw,7rem);line-height:.96;letter-spacing:-.04em}}`,
  'condensed-stack': `h1{text-transform:uppercase;letter-spacing:-.01em;line-height:.92;max-width:14ch}${H2}{text-transform:uppercase;letter-spacing:.01em}`,
  'mono-labels': `.kicker,.ds-section .sec__head p,.price,.item__badge{font-family:ui-monospace,"JetBrains Mono","SF Mono",Menlo,Consolas,monospace;letter-spacing:.02em}.kicker{text-transform:uppercase;font-size:.78rem}`,
  'small-caps': `${H2},.kicker{font-variant-caps:all-small-caps;letter-spacing:.06em}h1{font-variant-caps:small-caps}`,
  'underline-accent': `h1{text-decoration:underline;text-decoration-color:var(--ds-accent);text-decoration-thickness:.08em;text-underline-offset:.14em;text-decoration-skip-ink:auto}${H2}{text-decoration:underline;text-decoration-color:var(--ds-accent);text-decoration-thickness:3px;text-underline-offset:.22em}`,
  'marker-highlight': `${H2}{display:inline;background:linear-gradient(transparent 58%,var(--u-tint) 58%,var(--u-tint) 92%,transparent 92%);box-decoration-break:clone;-webkit-box-decoration-break:clone}`,
  'numbered-headings': `main{counter-reset:uds-sec}.ds-section .sec__head h2{counter-increment:uds-sec}.ds-section .sec__head h2::before{content:counter(uds-sec,decimal-leading-zero) " ";color:var(--u-accent-ink);font-variant-numeric:tabular-nums;margin-right:.35em;font-size:.6em;vertical-align:.35em;letter-spacing:.04em}`,
  'slash-kicker': `.kicker{display:flex;align-items:center;gap:.6em;text-transform:uppercase;letter-spacing:.12em}.kicker::before{content:"/";color:var(--u-accent-ink);font-weight:800}.kicker::after{content:"";flex:0 0 48px;height:1px;background:currentColor;opacity:.4}`,
  'centered-headings': `.ds-section .sec__head{text-align:center;justify-content:center}.ds-section .sec__head h2::after{content:"✦";display:block;margin-top:.3em;color:var(--u-accent-ink);font-size:.5em}`,
  'tall-leading': `h1{line-height:1.18}${H2}{line-height:1.25}p,li{line-height:1.75}.hero .lede{max-width:52ch}`,
  compact: `h1{font-size:clamp(1.9rem,1.2rem + 2.6vw,3.2rem);line-height:1.04}${H2}{font-size:clamp(1.25rem,1rem + 1vw,1.8rem)}p{line-height:1.5}`,
};

export const typeStyleCss = id => TYPE_CSS[id] || '';

// ---------- Раскладки секций ----------
export const SECTION_LAYOUTS = Object.freeze({
  editorial: 'журнальная сетка',
  offset: 'смещённая двухколоночная сетка',
  framed: 'выделенные фоновые секции',
  quiet: 'минималистичный ритм и воздух',
  centered: 'центрированные секции',
  'sticky-head': 'липкий заголовок слева',
  alternating: 'чередование сторон',
  bands: 'цветные полосы через одну',
  magazine: 'журнальные колонки текста',
  'inset-panel': 'секции-панели со скруглением',
  rail: 'акцентный рельс слева',
  narrow: 'узкая колонка для чтения',
  wide: 'широкое полотно',
  'index-number': 'крупный номер секции',
  'stacked-cards': 'секции-карточки с тенью',
});
export const SECTION_LAYOUT_IDS = Object.keys(SECTION_LAYOUTS);
/** Новые раскладки используют порядок секций одной из четырёх базовых. */
export const LAYOUT_ORDER_FAMILY = {
  centered: 'quiet', 'sticky-head': 'offset', alternating: 'offset', bands: 'framed', magazine: 'editorial', 'inset-panel': 'framed',
  rail: 'editorial', narrow: 'quiet', wide: 'framed', 'index-number': 'editorial', 'stacked-cards': 'framed',
};
/** Раскладки, у которых секции залиты фоном: переходы-полосы между ними по умолчанию не ставятся. */
export const FILLED_LAYOUTS = new Set(['framed', 'bands', 'inset-panel', 'stacked-cards']);

const S = id => `.ds-section.section-layout--${id}:not(.sec--contact)`;
export const EXTRA_LAYOUT_CSS = {
  centered: `${S('centered')} .sec__head{text-align:center;margin-inline:auto;max-width:46rem}${S('centered')} .sec__head p{margin-inline:auto}`,
  'sticky-head': `@media(min-width:900px){${S('sticky-head')} .ds-container{display:grid;grid-template-columns:minmax(0,.62fr) minmax(0,1.38fr);gap:clamp(24px,5vw,72px);align-items:start}${S('sticky-head')} .sec__head{position:sticky;top:clamp(16px,6vh,72px)}}`,
  alternating: `@media(min-width:900px){${S('alternating')} .ds-container{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:clamp(24px,5vw,72px);align-items:start}${S('alternating')}:nth-of-type(even) .ds-container{grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr)}${S('alternating')}:nth-of-type(even) .sec__head{order:2;text-align:right}}`,
  bands: `${S('bands')}:nth-of-type(even){background:var(--u-tint)}${S('bands')}:nth-of-type(odd){background:var(--ds-bg)}`,
  magazine: `@media(min-width:900px){${S('magazine')} .about__text,${S('magazine')} .sec__head p{columns:2 18rem;column-gap:clamp(24px,4vw,56px)}}${S('magazine')} .sec__head{border-top:3px double var(--ds-border);padding-top:14px}`,
  'inset-panel': `${S('inset-panel')}>.ds-container{background:var(--ds-surface);border:1px solid var(--ds-border);border-radius:var(--ds-radius-lg,20px);padding:clamp(20px,4vw,56px)}`,
  rail: `${S('rail')} .ds-container{border-left:3px solid var(--ds-accent);padding-left:clamp(16px,3vw,40px)}`,
  narrow: `${S('narrow')}>.ds-container{max-width:min(100% - 2 * var(--ds-gutter,20px),760px)}`,
  wide: `${S('wide')}>.ds-container{max-width:min(100% - 2 * var(--ds-gutter,20px),1440px)}`,
  'index-number': `main{counter-reset:uds-ix}${S('index-number')}{counter-increment:uds-ix}${S('index-number')} .sec__head::before{content:counter(uds-ix,decimal-leading-zero);display:block;font-family:var(--ds-font-display);font-size:clamp(2.4rem,1.6rem + 3vw,4.6rem);line-height:1;color:var(--u-accent-ink);opacity:.9;margin-bottom:.15em}`,
  'stacked-cards': `${S('stacked-cards')}>.ds-container{background:var(--ds-surface);border-radius:var(--ds-radius-lg,20px);padding:clamp(20px,4vw,52px);box-shadow:0 2px 6px color-mix(in srgb,var(--ds-text) 6%,transparent),0 18px 40px color-mix(in srgb,var(--ds-text) 8%,transparent)}${S('stacked-cards')}{padding-block:clamp(12px,2vw,24px)}`,
};

// ---------- Анимации текста (дополнение к text-effects.js) ----------
export const TEXT_ANIMATIONS = Object.freeze({
  'tracking-in': 'Сжатие трекинга заголовка',
  'blur-in': 'Заголовок из размытия',
  'highlight-sweep': 'Маркер проходит по заголовкам секций',
  'underline-draw': 'Подчёркивание рисуется при прокрутке',
  'rise-headings': 'Заголовки секций поднимаются',
  'typewriter-kicker': 'Печать надписи над заголовком',
  'skew-headings': 'Наклонный вход заголовков',
});
const MOTION = css => `@media(prefers-reduced-motion:no-preference){${css}}`;
const VIEW = css => `@supports (animation-timeline:view()){${MOTION(css)}}`;
const TEXT_ANIM_CSS = {
  'tracking-in': MOTION('.hero h1{animation:uds-track 1.4s var(--ds-ease) both}@keyframes uds-track{from{letter-spacing:.25em;opacity:0}to{opacity:1}}'),
  'blur-in': MOTION('.hero h1{animation:uds-blur 1.2s var(--ds-ease) both}@keyframes uds-blur{from{filter:blur(14px);opacity:0}to{filter:none;opacity:1}}'),
  'highlight-sweep': `${H2}{background:linear-gradient(transparent 60%,var(--u-tint) 60%,var(--u-tint) 92%,transparent 92%) 0 0/100% 100% no-repeat;box-decoration-break:clone;-webkit-box-decoration-break:clone}` + VIEW(`.ds-section .sec__head h2{animation:uds-hl linear both;animation-timeline:view();animation-range:entry 10% cover 35%}@keyframes uds-hl{from{background-size:0 100%}to{background-size:100% 100%}}`),
  'underline-draw': `.ds-section .sec__head h2{background:linear-gradient(var(--ds-accent),var(--ds-accent)) 0 100%/100% 3px no-repeat;padding-bottom:.12em}` + VIEW(`.ds-section .sec__head h2{animation:uds-ud linear both;animation-timeline:view();animation-range:entry 10% cover 35%}@keyframes uds-ud{from{background-size:0 3px}to{background-size:100% 3px}}`),
  'rise-headings': VIEW('.ds-section .sec__head h2{animation:uds-rise linear both;animation-timeline:view();animation-range:entry 0% cover 30%}@keyframes uds-rise{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}'),
  'typewriter-kicker': MOTION('.hero .kicker{animation:uds-tk 1.6s .2s steps(22) both}@keyframes uds-tk{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}'),
  'skew-headings': VIEW('.ds-section .sec__head h2{animation:uds-skew linear both;animation-timeline:view();animation-range:entry 0% cover 30%}@keyframes uds-skew{from{opacity:0;transform:skewY(5deg) translateY(24px)}to{opacity:1;transform:none}}'),
};
export const textAnimationCss = id => TEXT_ANIM_CSS[id] || '';

// ---------- Анимации кнопок ----------
export const BUTTON_ANIMATIONS = Object.freeze({
  pulse: 'Пульс-кольцо у главной кнопки',
  shine: 'Периодический блик',
  ripple: 'Волна от нажатия',
  nudge: 'Толчок стрелки',
  'border-draw': 'Обводка при наведении',
  lift: 'Подъём с тенью',
  press: 'Упругое нажатие',
  'glow-breath': 'Дыхание свечения',
  jelly: 'Желе при наведении',
  'underline-grow': 'Растущее подчёркивание',
});
export const BUTTON_ANIMATION_IDS = Object.keys(BUTTON_ANIMATIONS);
const P = '[data-cta="primary"]';
const BTN_CSS = {
  pulse: MOTION(`.hero ${P}{position:relative}.hero ${P}::after{content:"";position:absolute;inset:-4px;border-radius:inherit;border:2px solid var(--ds-accent);opacity:0;animation:uds-pulse 2.6s 1.5s infinite;pointer-events:none}@keyframes uds-pulse{0%{opacity:.7;transform:scale(1)}70%,100%{opacity:0;transform:scale(1.18)}}`),
  shine: `.ds-button{position:relative;overflow:hidden}` + MOTION(`.hero ${P}::before{content:"";position:absolute;top:0;bottom:0;width:40%;left:-60%;background:linear-gradient(105deg,transparent,color-mix(in srgb,#fff 45%,transparent),transparent);animation:uds-shine 4.5s 1s infinite;pointer-events:none}@keyframes uds-shine{0%,70%{left:-60%}100%{left:130%}}`),
  ripple: `.ds-button{position:relative;overflow:hidden}.uds-ripple{position:absolute;border-radius:50%;background:currentColor;opacity:.25;transform:scale(0);pointer-events:none}` + MOTION(`.uds-ripple{animation:uds-ripple .6s ease-out forwards}@keyframes uds-ripple{to{transform:scale(4);opacity:0}}`),
  nudge: `.hero ${P}::after{content:"→";display:inline-block}` + MOTION(`.hero ${P}::after{animation:uds-nudge 2.4s 1.2s ease-in-out infinite}@keyframes uds-nudge{0%,60%,100%{transform:none}70%{transform:translateX(5px)}80%{transform:none}90%{transform:translateX(3px)}}`),
  'border-draw': `.ds-button{position:relative}.ds-button::after{content:"";position:absolute;inset:-4px;border-radius:inherit;border:2px solid var(--ds-accent);clip-path:inset(0 100% 100% 0);pointer-events:none}` + MOTION(`.ds-button::after{transition:clip-path .45s var(--ds-ease)}`) + `.ds-button:is(:hover,:focus-visible)::after{clip-path:inset(0 0 0 0)}`,
  lift: MOTION(`.ds-button{transition:transform .25s var(--ds-ease),box-shadow .25s}.ds-button:is(:hover,:focus-visible){transform:translateY(-3px);box-shadow:0 12px 24px color-mix(in srgb,var(--ds-accent) 28%,transparent)}`),
  press: MOTION(`.ds-button{transition:transform .18s cubic-bezier(.3,1.6,.5,1)}.ds-button:active{transform:scale(.94)}`),
  'glow-breath': MOTION(`.hero ${P}{animation:uds-breath 3.2s ease-in-out infinite}@keyframes uds-breath{50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--ds-accent) 16%,transparent),0 8px 30px color-mix(in srgb,var(--ds-accent) 35%,transparent)}}`),
  jelly: MOTION(`.ds-button:is(:hover,:focus-visible){animation:uds-jelly .55s}@keyframes uds-jelly{30%{transform:scale(1.07,.93)}50%{transform:scale(.95,1.05)}70%{transform:scale(1.02,.98)}100%{transform:none}}`),
  'underline-grow': `.ds-button{background-image:linear-gradient(currentColor,currentColor);background-repeat:no-repeat;background-position:50% calc(100% - 8px);background-size:0 1.5px}` + MOTION(`.ds-button{transition:background-size .3s var(--ds-ease)}`) + `.ds-button:is(:hover,:focus-visible){background-size:calc(100% - 44px) 1.5px}`,
};
export const buttonAnimationCss = id => BTN_CSS[id] || '';
export function buttonAnimationScript(id) {
  if (id !== 'ripple') return '';
  return `if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.addEventListener('pointerdown',function(e){var b=e.target.closest&&e.target.closest('.ds-button');if(!b)return;var r=b.getBoundingClientRect(),d=Math.max(r.width,r.height),s=document.createElement('span');s.className='uds-ripple';s.setAttribute('aria-hidden','true');s.style.cssText='width:'+d+'px;height:'+d+'px;left:'+(e.clientX-r.left-d/2)+'px;top:'+(e.clientY-r.top-d/2)+'px';b.appendChild(s);setTimeout(function(){s.remove()},700)})}`;
}

/** Выбор стиля типографики, анимации текста и кнопок. Ручной выбор (passthrough.*) главнее; 'none' — без. */
export function chooseTypography(project = {}, { archetype = '', typeCharacter = '', intensity = 'balanced', seed = 0 } = {}) {
  const f = project.passthrough || {};
  const calm = project.tier === 'luxury' || intensity === 'calm';
  const serif = /serif|didone|slab/.test(typeCharacter);
  let styles = serif ? ['italic-accent', 'small-caps', 'tall-leading', 'centered-headings', 'airy-light', 'numbered-headings', 'slash-kicker'] : ['tight-display', 'caps-wide', 'mono-labels', 'underline-accent', 'marker-highlight', 'oversized', 'condensed-stack', 'compact', 'numbered-headings', 'slash-kicker'];
  if (archetype === 'brutalist') styles = ['condensed-stack', 'caps-wide', 'oversized', 'mono-labels'];
  if (project.tier === 'luxury') styles = ['airy-light', 'small-caps', 'italic-accent', 'tall-leading', 'centered-headings'];
  const texts = calm ? ['tracking-in', 'blur-in', 'underline-draw', 'none'] : ['tracking-in', 'blur-in', 'highlight-sweep', 'underline-draw', 'rise-headings', 'typewriter-kicker', 'skew-headings', 'none'];
  const buttons = calm ? ['lift', 'border-draw', 'underline-grow', 'none'] : ['pulse', 'shine', 'ripple', 'nudge', 'border-draw', 'lift', 'press', 'glow-breath', 'jelly', 'none'];
  const choose = (key, dict, pool, name) => (f[key] === 'none' || dict[f[key]] ? f[key] : pick(stream(seed, name), pool));
  return Object.freeze({
    typeStyle: choose('typeStyle', TYPE_STYLES, styles, 'type-style'),
    textAnimation: choose('textAnimation', TEXT_ANIMATIONS, texts, 'text-animation'),
    buttonAnimation: choose('buttonAnimation', BUTTON_ANIMATIONS, buttons, 'button-animation'),
  });
}
