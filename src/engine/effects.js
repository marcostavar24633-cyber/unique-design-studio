// Эффекты карточек (22) и первого экрана (20).
// Правила: эффекты наведения дублируются фокусом с клавиатуры (:focus-within); на сенсорных экранах скрытое
// наведением содержимое показано сразу; при prefers-reduced-motion всё статично; декоративные слои aria-hidden;
// фотоэффекты включаются только при наличии фото; бейджи и счётчики — только из данных проекта.
import { hexToHsl } from './color.js';
import { esc, pick, stream } from './util.js';

export const CARD_EFFECTS = Object.freeze({
  spotlight: 'Прожектор за курсором',
  sheen: 'Бегущий блик',
  'gradient-border': 'Градиентная рамка',
  'border-glow': 'Свечение рамки у курсора',
  holo: 'Голографический отлив',
  grain: 'Фактура на карточке',
  'layered-shadow': 'Многослойные тени',
  'inner-parallax': 'Параллакс внутри карточки',
  stack: 'Стопка листов',
  neumorph: 'Неоморфизм',
  isometric: 'Изометрия',
  curtain: 'Шторка с описанием',
  'mask-reveal': 'Маска-проявление фото',
  'color-photo': 'Фото из ч/б в цвет',
  'photo-zoom': 'Зум фото в рамке',
  'underline-arrow': 'Подчёркивание и стрелка',
  'bento-accent': 'Акцентная карточка',
  stagger: 'Шахматный сдвиг',
  magnetic: 'Магнитные карточки',
  'focus-dim': 'Расфокус соседей',
  badges: 'Ленты-бейджи',
  counter: 'Счётчики чисел',
});
export const CARD_EFFECT_IDS = Object.keys(CARD_EFFECTS);

export const HERO_EFFECTS = Object.freeze({
  aurora: 'Аврора',
  grid: 'Перспективная сетка',
  fog: 'Туман',
  bokeh: 'Боке',
  starfield: 'Звёздное поле',
  'wave-lines': 'Волны-линии',
  morph: 'Морфинг формы',
  'ken-burns': 'Кен Бёрнс (наезд на фото)',
  'double-exposure': 'Двойная экспозиция',
  'photo-wipe': 'Шторка-раскрытие фото',
  duotone: 'Дуотон фото',
  slideshow: 'Слайд-шоу фото',
  'text-mask': 'Градиент в буквах',
  marquee: 'Бегущая строка',
  'outline-fill': 'Обводка → заливка',
  typewriter: 'Печатная машинка',
  'line-split': 'Раскрытие строк',
  'depth-parallax': 'Слоистый параллакс',
  'magnetic-cta': 'Магнитная кнопка',
  'hero-spotlight': 'Прожектор',
});
export const HERO_EFFECT_IDS = Object.keys(HERO_EFFECTS);
const PHOTO_HERO = new Set(['ken-burns', 'double-exposure', 'photo-wipe', 'duotone', 'slideshow']);

/** Выбор эффектов. Ручной выбор владельца (passthrough.cardEffect / heroEffect) главнее; 'none' — без эффекта. */
export function chooseEffects(project = {}, { archetype = '', tier = 'standard', intensity = 'balanced', seed = 0 } = {}) {
  const f = project.passthrough || {};
  const photos = [project.images?.hero, ...(project.gallery || []).map(g => g.src)].filter(Boolean);
  const calm = tier === 'luxury' || intensity === 'calm';
  let card;
  if (f.cardEffect === 'none' || CARD_EFFECTS[f.cardEffect]) card = f.cardEffect;
  else {
    let pool = calm ? ['layered-shadow', 'underline-arrow', 'photo-zoom', 'color-photo', 'stack', 'grain']
      : ['spotlight', 'sheen', 'gradient-border', 'border-glow', 'layered-shadow', 'stack', 'curtain', 'photo-zoom', 'underline-arrow', 'stagger', 'focus-dim', 'bento-accent', 'mask-reveal'];
    if (archetype === 'brutalist') pool = ['stagger', 'underline-arrow', 'isometric'];
    if (archetype === 'catalog' || archetype === 'product-first') pool = ['photo-zoom', 'layered-shadow', 'badges', 'spotlight', 'sheen'];
    card = pick(stream(seed, 'card-effect'), pool);
  }
  let hero;
  if (f.heroEffect === 'none' || HERO_EFFECTS[f.heroEffect]) hero = f.heroEffect;
  else {
    let pool = calm ? ['fog', 'aurora', 'line-split', 'outline-fill', 'typewriter'] : ['aurora', 'grid', 'bokeh', 'starfield', 'wave-lines', 'morph', 'text-mask', 'marquee', 'line-split', 'depth-parallax', 'hero-spotlight', 'magnetic-cta'];
    if (photos.length) pool = pool.concat(calm ? ['ken-burns', 'duotone'] : ['ken-burns', 'photo-wipe', 'duotone', 'double-exposure']);
    if (photos.length >= 2 && !calm) pool.push('slideshow');
    if (archetype === 'brutalist') pool = ['marquee', 'grid', 'outline-fill', 'line-split'];
    hero = pick(stream(seed, 'hero-effect'), pool);
  }
  // Фотоэффект без фото (или слайд-шоу без двух снимков) не применяется — честно отмечаем.
  const heroUnavailable = (PHOTO_HERO.has(hero) && !photos.length) || (hero === 'slideshow' && photos.length < 2);
  return Object.freeze({ card, hero: heroUnavailable ? 'none' : hero, heroRequested: hero, heroUnavailable, calm });
}

// ---------------- Карточки ----------------
const BOX = ['.items--cards .item', '.items--product .item', '.items--bento .item', '.items--menu .item', '.adv--cards>li'];
const ANY = ['.items>.item', '.adv>li'];
const s = (list, suf = '') => list.map(x => x + suf).join(',');
const hov = (list, suf = '') => list.flatMap(x => [`${x}:hover${suf}`, `${x}:focus-within${suf}`]).join(',');
const MOTION = css => `@media(prefers-reduced-motion:no-preference){${css}}`;
const TOUCH = css => `@media(hover:none){${css}}`;

const CARD_CSS = {
  spotlight: `${s(BOX)}{position:relative;isolation:isolate}${s(BOX, '::before')}{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s;background:radial-gradient(240px circle at var(--mx,50%) var(--my,50%),color-mix(in srgb,var(--ds-accent) 16%,transparent),transparent 70%)}${hov(BOX, '::before')}{opacity:1}`,
  sheen: `${s(BOX)}{position:relative;overflow:hidden}${s(BOX, '::after')}{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 35%,color-mix(in srgb,#fff 32%,transparent) 50%,transparent 65%);transform:translateX(-120%)}` + MOTION(`${hov(BOX, '::after')}{transform:translateX(120%);transition:transform .9s var(--ds-ease)}`),
  'gradient-border': `${s(BOX)}{border:2px solid transparent;background:linear-gradient(var(--ds-surface),var(--ds-surface)) padding-box,conic-gradient(from var(--gb,0deg),var(--ds-accent),color-mix(in srgb,var(--ds-accent) 30%,var(--ds-text)),var(--ds-accent)) border-box}@property --gb{syntax:'<angle>';inherits:false;initial-value:0deg}` + MOTION(`${hov(BOX)}{animation:uds-gb 2.4s linear infinite}@keyframes uds-gb{to{--gb:360deg}}`),
  'border-glow': `${s(BOX)}{position:relative}${s(BOX, '::after')}{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;pointer-events:none;background:radial-gradient(180px circle at var(--mx,50%) var(--my,50%),var(--ds-accent),transparent 70%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);opacity:0;transition:opacity .3s}${hov(BOX, '::after')}{opacity:1}`,
  holo: `${s(BOX)}{position:relative;overflow:hidden}${s(BOX, '::after')}{content:"";position:absolute;inset:0;pointer-events:none;mix-blend-mode:soft-light;opacity:0;transition:opacity .3s;background:linear-gradient(calc(var(--hx,0.5) * 180deg + 45deg),#ff8ad8,#8ad4ff,#b6ff8a,#ffd88a,#ff8ad8)}${hov(BOX, '::after')}{opacity:.55}`,
  grain: `${s(BOX)}{background-image:url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0.09 0 0 0 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>").replace(/'/g, '%27')}");background-size:200px}`,
  'layered-shadow': `${s(BOX)}{box-shadow:0 1px 2px color-mix(in srgb,var(--ds-text) 8%,transparent),0 6px 14px color-mix(in srgb,var(--ds-text) 7%,transparent),0 18px 36px color-mix(in srgb,var(--ds-text) 6%,transparent);transition:box-shadow .35s,transform .35s}${hov(BOX)}{box-shadow:0 2px 4px color-mix(in srgb,var(--ds-text) 9%,transparent),0 12px 26px color-mix(in srgb,var(--ds-text) 9%,transparent),0 34px 64px color-mix(in srgb,var(--ds-text) 10%,transparent)}` + MOTION(`${hov(BOX)}{transform:translateY(-4px)}`),
  'inner-parallax': MOTION(`${s(BOX, ' img')}{transform:translate(calc((var(--hx,.5) - .5) * -14px),calc((var(--hy,.5) - .5) * -14px)) scale(1.06);transition:transform .2s}${s(BOX, ' h3')}{transform:translate(calc((var(--hx,.5) - .5) * 6px),calc((var(--hy,.5) - .5) * 6px));transition:transform .2s}`),
  stack: `${s(BOX)}{position:relative;box-shadow:6px 6px 0 -1px var(--ds-surface),6px 6px 0 0 var(--ds-border),12px 12px 0 -1px var(--ds-surface),12px 12px 0 0 var(--ds-border);margin:0 12px 12px 0}` + MOTION(`${s(BOX)}{transition:box-shadow .35s,transform .35s}${hov(BOX)}{transform:translate(-3px,-3px);box-shadow:10px 10px 0 -1px var(--ds-surface),10px 10px 0 0 var(--ds-border),20px 20px 0 -1px var(--ds-surface),20px 20px 0 0 var(--ds-border)}`),
  neumorph: `${s(BOX)}{border-color:transparent;background:var(--ds-bg);box-shadow:8px 8px 18px color-mix(in srgb,var(--ds-text) 12%,transparent),-8px -8px 18px color-mix(in srgb,#fff 70%,transparent)}${hov(BOX)}{box-shadow:inset 6px 6px 14px color-mix(in srgb,var(--ds-text) 10%,transparent),inset -6px -6px 14px color-mix(in srgb,#fff 65%,transparent)}`,
  isometric: MOTION(`${s(BOX)}{transform:perspective(900px) rotateX(10deg) rotateZ(-2deg);transition:transform .45s var(--ds-ease),box-shadow .45s;box-shadow:0 18px 30px color-mix(in srgb,var(--ds-text) 12%,transparent)}${hov(BOX)}{transform:none;box-shadow:0 8px 16px color-mix(in srgb,var(--ds-text) 10%,transparent)}`),
  curtain: `${s(BOX)}{position:relative;overflow:hidden}${s(BOX, ' h3 ~ p:not(.price)')}{transition:opacity .35s,transform .35s}` + `@media(hover:hover){${s(BOX, ':not(:hover):not(:focus-within) h3 ~ p:not(.price)')}{opacity:0;transform:translateY(10px)}}`,
  'mask-reveal': `${s(BOX, ' .item__media img')}{transition:clip-path .6s var(--ds-ease)}` + `@media(hover:hover) and (prefers-reduced-motion:no-preference){${s(BOX, ' .item__media img')}{clip-path:circle(38% at 50% 50%)}${hov(BOX, ' .item__media img')}{clip-path:circle(75% at 50% 50%)}}`,
  'color-photo': `@media(hover:hover){${s(BOX, ' img')}{filter:grayscale(1);transition:filter .5s}${hov(BOX, ' img')}{filter:var(--uds-grade,) grayscale(0)}}`,
  'photo-zoom': `${s(BOX, ' .item__media')}{overflow:hidden}` + MOTION(`${s(BOX, ' .item__media img')}{transition:transform .6s var(--ds-ease)}${hov(BOX, ' .item__media img')}{transform:scale(1.08)}`),
  'underline-arrow': `${s(ANY, ' h3')}{display:inline;background:linear-gradient(var(--ds-accent),var(--ds-accent)) 0 100%/0 2px no-repeat;transition:background-size .35s var(--ds-ease)}${hov(ANY, ' h3')}{background-size:100% 2px}${s(ANY, ' h3::after')}{content:" →";display:inline-block;color:var(--u-accent-ink);transition:transform .3s}${hov(ANY, ' h3::after')}{transform:translateX(5px)}`,
  'bento-accent': `@media(min-width:760px){.items--cards,.items--product,.adv--cards{grid-auto-flow:dense}.items--cards>.item:first-child,.items--product>.item:first-child,.adv--cards>li:first-child{grid-column:span 2;background:var(--u-tint)}}`,
  stagger: `@media(min-width:760px){.items--cards>.item:nth-child(even),.items--product>.item:nth-child(even),.adv--cards>li:nth-child(even),.items--bento>.item:nth-child(even){transform:translateY(clamp(18px,3vw,36px))}.items--cards,.items--product,.adv--cards,.items--bento{padding-bottom:clamp(18px,3vw,36px)}}`,
  magnetic: MOTION(`${s(BOX)}{transform:translate(var(--mgx,0px),var(--mgy,0px));transition:transform .25s var(--ds-ease)}`),
  'focus-dim': `@media(hover:hover){.items:has(>.item:hover)>.item:not(:hover),.adv:has(>li:hover)>li:not(:hover){opacity:.55;filter:saturate(.7)}.items>.item,.adv>li{transition:opacity .3s,filter .3s}}`,
  badges: `${s(BOX, ' .item__badge')}{position:absolute;top:0;right:16px;max-width:calc(100% - 32px);margin:0;padding:8px 10px 14px;border-radius:0;clip-path:polygon(0 0,100% 0,100% 100%,50% calc(100% - 6px),0 100%);background:var(--ds-accent);color:var(--ds-accent-contrast);font-size:.72rem;font-weight:800;letter-spacing:.08em;text-align:center;text-transform:uppercase;box-shadow:0 4px 10px color-mix(in srgb,var(--ds-text) 18%,transparent)}${s(BOX)}{position:relative;overflow:hidden}`,
  counter: '',
};
// Бейдж показывается всегда, если задан в данных; эффект «Ленты-бейджи» превращает его в угловую ленту.
const BADGE_BASE = '.item__badge{display:inline-block;align-self:flex-start;margin-bottom:8px;padding:3px 10px;border-radius:999px;background:var(--u-tint);color:var(--ds-text);font-size:.75rem;font-weight:700}';

export function cardEffectCss(id) {
  return BADGE_BASE + (CARD_CSS[id] || '');
}

/** Скрипты эффектов: только мелкие обработчики, отключаются при reduced-motion и на сенсорных экранах. */
export function effectsScript(fx) {
  if (!fx) return '';
  const ok = "!matchMedia('(prefers-reduced-motion: reduce)').matches";
  const fine = "matchMedia('(hover: hover) and (pointer: fine)').matches";
  const box = BOX.join(',');
  const parts = [];
  if (['spotlight', 'border-glow', 'holo', 'inner-parallax'].includes(fx.card)) parts.push(`if(${fine}){document.querySelectorAll(${JSON.stringify(box)}).forEach(function(c){c.addEventListener('pointermove',function(e){var r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;c.style.setProperty('--mx',(x*100)+'%');c.style.setProperty('--my',(y*100)+'%');c.style.setProperty('--hx',x.toFixed(3));c.style.setProperty('--hy',y.toFixed(3))})})}`);
  if (fx.card === 'magnetic') parts.push(`if(${fine}&&${ok}){document.querySelectorAll(${JSON.stringify(box)}).forEach(function(c){c.addEventListener('pointermove',function(e){var r=c.getBoundingClientRect();c.style.setProperty('--mgx',((e.clientX-r.left)/r.width-.5)*8+'px');c.style.setProperty('--mgy',((e.clientY-r.top)/r.height-.5)*8+'px')});c.addEventListener('pointerleave',function(){c.style.setProperty('--mgx','0px');c.style.setProperty('--mgy','0px')})})}`);
  // Счётчик: число из текста набирается при появлении. Текст для чтения с экрана остаётся итоговым.
  if (fx.card === 'counter') parts.push(`if(${ok}&&'IntersectionObserver'in window){var cio=new IntersectionObserver(function(es){es.forEach(function(en){if(!en.isIntersecting)return;cio.unobserve(en.target);var el=en.target,full=el.textContent,m=full.match(/\\d[\\d\\s]*/);if(!m)return;var target=parseInt(m[0].replace(/\\s/g,''),10);if(!(target>1))return;el.setAttribute('aria-label',full);var t0=performance.now();(function step(t){var k=Math.min(1,(t-t0)/1200),v=Math.round(target*(1-Math.pow(1-k,3)));el.textContent=full.replace(m[0],String(v)+(/\\s$/.test(m[0])?' ':''));if(k<1)requestAnimationFrame(step);else el.textContent=full})(t0)})},{threshold:.6});document.querySelectorAll('.adv>li h3,.items>.item h3').forEach(function(h){if(/\\d/.test(h.textContent))cio.observe(h)})}`);
  // Первый экран.
  const h = fx.hero;
  if (['depth-parallax', 'hero-spotlight'].includes(h)) parts.push(`if(${fine}&&${ok}){var hero=document.querySelector('.hero');if(hero)hero.addEventListener('pointermove',function(e){var r=hero.getBoundingClientRect();hero.style.setProperty('--px',((e.clientX-r.left)/r.width).toFixed(3));hero.style.setProperty('--py',((e.clientY-r.top)/r.height).toFixed(3))})}`);
  if (h === 'magnetic-cta') parts.push(`if(${fine}&&${ok}){var mb=document.querySelector('.hero [data-cta="primary"]');if(mb){mb.addEventListener('pointermove',function(e){var r=mb.getBoundingClientRect();mb.style.transform='translate('+((e.clientX-r.left)/r.width-.5)*12+'px,'+((e.clientY-r.top)/r.height-.5)*10+'px)'});mb.addEventListener('pointerleave',function(){mb.style.transform=''})}}`);
  // Раскрытие строк: слова заголовка группируются в строки по их положению, строки выезжают по очереди.
  if (h === 'line-split') parts.push(`var lh=document.getElementById('hero-h');if(lh&&${ok}&&!lh.children.length){var txt=lh.textContent;lh.setAttribute('aria-label',txt);lh.textContent='';var ws=txt.split(/\\s+/).filter(Boolean).map(function(w){var s=document.createElement('span');s.textContent=w;s.style.display='inline-block';lh.appendChild(s);lh.appendChild(document.createTextNode(' '));return s});var lines=[],top=null;ws.forEach(function(s){if(top===null||Math.abs(s.offsetTop-top)>4){lines.push([]);top=s.offsetTop}lines[lines.length-1].push(s.textContent)});lh.textContent='';lines.forEach(function(l,i){var o=document.createElement('span');o.className='uds-line';o.setAttribute('aria-hidden','true');var n=document.createElement('span');n.textContent=l.join(' ');n.style.animationDelay=(i*120)+'ms';o.appendChild(n);lh.appendChild(o);lh.appendChild(document.createTextNode(' '))})}`);
  return parts.join(';');
}

// ---------------- Первый экран ----------------
const svgUrl = svg => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
const HERO_IMG = '.hero img.ds-media,.hero img[data-decorative="hero-bg"]';

/** Декоративная разметка эффекта (вставляется в aria-hidden сцену первого экрана). */
export function heroEffectMarkup(fx, project = {}) {
  const h = fx?.hero;
  if (!h || h === 'none') return '';
  if (h === 'slideshow') {
    const photos = (project.gallery || []).map(g => g.src).filter(Boolean).slice(0, 4);
    return `<span class="uds-hfx uds-hfx--slideshow">${photos.map((src, i) => `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" style="--i:${i};--n:${photos.length}">`).join('')}</span>`;
  }
  if (h === 'double-exposure') {
    const src = (project.gallery || []).map(g => g.src).find(Boolean) || project.images?.hero;
    return src ? `<span class="uds-hfx uds-hfx--double-exposure"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"></span>` : '';
  }
  if (['aurora', 'grid', 'fog', 'bokeh', 'starfield', 'wave-lines', 'morph', 'hero-spotlight', 'depth-parallax'].includes(h)) return `<span class="uds-hfx uds-hfx--${h}"></span>`;
  return '';
}

/** Бегущая строка — отдельный декоративный элемент после заголовка. */
export function heroMarqueeHtml(fx, project = {}) {
  if (fx?.hero !== 'marquee') return '';
  const word = esc(project.niche || project.brand || '');
  if (!word) return '';
  const run = Array.from({ length: 8 }, () => `<span>${word}</span><span aria-hidden="true">✦</span>`).join('');
  return `<div class="uds-marquee" aria-hidden="true"><div class="uds-marquee__track">${run}${run}</div></div>`;
}

export function heroEffectCss(fx, palette = {}) {
  const h = fx?.hero;
  if (!h || h === 'none') return '';
  const calm = fx.calm;
  const t = calm ? 1.6 : 1;
  const base = '.uds-hfx{position:absolute;inset:0;pointer-events:none;overflow:hidden}';
  const dark = palette.mode === 'dark';
  const hue = palette.accent ? Math.round(hexToHsl(palette.accent)[0]) : 30;
  const css = {
    aurora: `.uds-hfx--aurora{background:radial-gradient(40% 50% at 20% 30%,color-mix(in srgb,var(--ds-accent) ${dark ? 34 : 22}%,transparent),transparent 70%),radial-gradient(45% 55% at 80% 40%,color-mix(in srgb,oklch(from var(--ds-accent) l c calc(h + 60)) ${dark ? 30 : 18}%,transparent),transparent 70%),radial-gradient(50% 60% at 50% 90%,color-mix(in srgb,oklch(from var(--ds-accent) l c calc(h - 50)) ${dark ? 26 : 14}%,transparent),transparent 70%);filter:blur(30px)}` + MOTION(`.uds-hfx--aurora{animation:uds-aurora ${18 * t}s ease-in-out infinite alternate}@keyframes uds-aurora{to{transform:translate3d(4%,-3%,0) scale(1.12) rotate(6deg)}}`),
    grid: `.uds-hfx--grid{inset:40% -50% -20% -50%;background-image:linear-gradient(color-mix(in srgb,var(--ds-accent) 40%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--ds-accent) 40%,transparent) 1px,transparent 1px);background-size:60px 60px;transform:perspective(500px) rotateX(62deg);-webkit-mask:linear-gradient(transparent,#000 40%);mask:linear-gradient(transparent,#000 40%);opacity:.45}` + MOTION(`.uds-hfx--grid{animation:uds-grid ${6 * t}s linear infinite}@keyframes uds-grid{to{background-position:0 60px,0 0}}`),
    fog: `.uds-hfx--fog{background:radial-gradient(60% 40% at 30% 70%,color-mix(in srgb,var(--ds-surface) 70%,transparent),transparent 70%),radial-gradient(50% 35% at 75% 40%,color-mix(in srgb,var(--ds-surface) 55%,transparent),transparent 70%);filter:blur(24px);opacity:.8}` + MOTION(`.uds-hfx--fog{animation:uds-fog ${26 * t}s ease-in-out infinite alternate}@keyframes uds-fog{to{transform:translate3d(-8%,2%,0) scale(1.15)}}`),
    bokeh: `.uds-hfx--bokeh{background-image:${[[15, 30, 70], [70, 20, 110], [40, 70, 90], [85, 75, 60], [55, 45, 50]].map(([x, y, r]) => `radial-gradient(circle ${r}px at ${x}% ${y}%,color-mix(in srgb,var(--ds-accent) ${dark ? 26 : 16}%,transparent),transparent)`).join(',')};filter:blur(6px)}` + MOTION(`.uds-hfx--bokeh{animation:uds-bokeh ${20 * t}s ease-in-out infinite alternate}@keyframes uds-bokeh{to{transform:translate3d(0,-5%,0) scale(1.08)}}`),
    starfield: `.uds-hfx--starfield{background-image:radial-gradient(1.5px 1.5px at 20px 30px,${dark ? '#fff' : 'var(--ds-text)'},transparent),radial-gradient(1px 1px at 80px 120px,${dark ? '#fff' : 'var(--ds-text)'},transparent),radial-gradient(2px 2px at 160px 60px,var(--ds-accent),transparent),radial-gradient(1px 1px at 230px 170px,${dark ? '#fff' : 'var(--ds-text)'},transparent);background-size:260px 220px;opacity:${dark ? .55 : .22}}` + MOTION(`.uds-hfx--starfield{animation:uds-stars ${60 * t}s linear infinite}@keyframes uds-stars{to{background-position:260px -220px}}`),
    'wave-lines': `.uds-hfx--wave-lines{top:auto;height:60%;background:${svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 300' preserveAspectRatio='none'>${Array.from({ length: 6 }, (_, i) => `<path d='M0 ${120 + i * 22} C300 ${60 + i * 22} 600 ${200 + i * 22} 1200 ${110 + i * 22}' fill='none' stroke='hsl(${hue} 60% ${dark ? 70 : 40}%)' stroke-opacity='${0.35 - i * 0.04}' stroke-width='1.5'/>`).join('')}</svg>`)} 0 100%/200% 100% repeat-x}` + MOTION(`.uds-hfx--wave-lines{animation:uds-waves ${24 * t}s linear infinite}@keyframes uds-waves{to{background-position:-200% 100%}}`),
    morph: `.uds-hfx--morph{inset:auto 6% 10% auto;width:min(46vw,520px);aspect-ratio:1;background:radial-gradient(circle at 30% 30%,color-mix(in srgb,var(--ds-accent) ${dark ? 40 : 26}%,transparent),color-mix(in srgb,var(--ds-accent) 6%,transparent));border-radius:42% 58% 63% 37%/45% 38% 62% 55%;filter:blur(2px)}` + MOTION(`.uds-hfx--morph{animation:uds-morph ${14 * t}s ease-in-out infinite alternate}@keyframes uds-morph{50%{border-radius:58% 42% 35% 65%/56% 61% 39% 44%}to{border-radius:38% 62% 52% 48%/38% 49% 51% 62%;transform:rotate(18deg)}}`),
    'ken-burns': MOTION(`${HERO_IMG}{animation:uds-kb ${22 * t}s ease-in-out infinite alternate;transform-origin:60% 40%}@keyframes uds-kb{from{transform:scale(1.02)}to{transform:scale(1.14) translate(-2%,-1%)}}`) + `.hero .ds-hero-picture,.hero__figure,.hero__frame{overflow:hidden}`,
    'double-exposure': `.uds-hfx--double-exposure img{width:100%;height:100%;object-fit:cover;mix-blend-mode:${dark ? 'screen' : 'multiply'};opacity:.16;filter:grayscale(1) contrast(1.1)}`,
    'photo-wipe': MOTION(`${HERO_IMG}{animation:uds-wipe 1.4s var(--ds-ease) both}@keyframes uds-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}`),
    duotone: `${HERO_IMG}{filter:grayscale(1) sepia(1) hue-rotate(${(hue - 38 + 360) % 360}deg) saturate(${dark ? 1.2 : 0.9}) contrast(1.05)}`,
    slideshow: `.uds-hfx--slideshow img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0}.uds-hfx--slideshow img:first-child{opacity:.22}.uds-hfx--slideshow::after{content:"";position:absolute;inset:0;background:color-mix(in srgb,var(--ds-bg) 55%,transparent)}` + MOTION(`.uds-hfx--slideshow img{animation:uds-slides calc(var(--n) * 6s) infinite;animation-delay:calc(var(--i) * 6s)}.uds-hfx--slideshow img:first-child{opacity:0}@keyframes uds-slides{0%,100%{opacity:0}8%,30%{opacity:.22}38%{opacity:0}}`),
    // Градиент между цветом текста и акцентным текстом: оба пары проверены на контраст с фоном.
    'text-mask': `@supports (-webkit-background-clip:text) or (background-clip:text){.hero h1{background:linear-gradient(100deg,var(--ds-text) 20%,var(--u-accent-ink) 55%,var(--ds-text) 90%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}}` + MOTION(`.hero h1{animation:uds-tm ${8 * t}s ease-in-out infinite alternate}@keyframes uds-tm{to{background-position:100% 0}}`),
    marquee: `.uds-marquee{overflow:hidden;max-width:100%;min-width:0;contain:inline-size;margin-top:clamp(14px,2vw,24px);-webkit-mask:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);mask:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}.uds-marquee__track{display:flex;gap:1.2em;width:max-content;font-family:var(--ds-font-display);font-size:clamp(1rem,.8rem + 1vw,1.5rem);font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--u-accent-ink);white-space:nowrap}` + MOTION(`.uds-marquee__track{animation:uds-marquee ${30 * t}s linear infinite}@keyframes uds-marquee{to{transform:translateX(-50%)}}`),
    'outline-fill': MOTION(`.hero h1{-webkit-text-stroke:1.5px var(--ds-text);animation:uds-of 2.2s .2s var(--ds-ease) both}@keyframes uds-of{from{color:transparent}to{color:var(--ds-text)}}`),
    typewriter: MOTION(`.hero .lede{animation:uds-type 2.6s .4s steps(28) both}@keyframes uds-type{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}`),
    'line-split': `.uds-line{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.08em}.uds-line>span{display:inline-block}` + MOTION(`.uds-line>span{animation:uds-line .9s var(--ds-ease) both}@keyframes uds-line{from{transform:translateY(105%)}to{transform:none}}`),
    'depth-parallax': `.uds-hfx--depth-parallax{background:radial-gradient(30% 40% at 25% 35%,color-mix(in srgb,var(--ds-accent) 18%,transparent),transparent 70%),radial-gradient(25% 35% at 75% 65%,color-mix(in srgb,var(--ds-accent) 12%,transparent),transparent 70%)}` + MOTION(`.uds-hfx--depth-parallax{transform:translate(calc((var(--px,.5) - .5) * -40px),calc((var(--py,.5) - .5) * -30px));transition:transform .3s}.hero .hero__copy,.hero h1{transform:translate(calc((var(--px,.5) - .5) * 10px),calc((var(--py,.5) - .5) * 8px));transition:transform .3s}.hero img.ds-media{transform:translate(calc((var(--px,.5) - .5) * -18px),calc((var(--py,.5) - .5) * -14px)) scale(1.04);transition:transform .3s}`),
    'magnetic-cta': MOTION(`.hero [data-cta="primary"]{transition:transform .25s var(--ds-ease)}`),
    'hero-spotlight': `.uds-hfx--hero-spotlight{background:radial-gradient(420px circle at calc(var(--px,.5) * 100%) calc(var(--py,.4) * 100%),color-mix(in srgb,var(--ds-accent) ${dark ? 22 : 12}%,transparent),transparent 70%)}`,
  };
  return base + (css[h] || '');
}

/** Описание для концепции. */
export function describeEffects(fx) {
  if (!fx) return '';
  const card = fx.card === 'none' ? 'без эффекта' : CARD_EFFECTS[fx.card];
  const hero = fx.hero === 'none' ? (fx.heroUnavailable ? `без эффекта (для «${HERO_EFFECTS[fx.heroRequested]}» нужны фото)` : 'без эффекта') : HERO_EFFECTS[fx.hero];
  return `Карточки — ${card}; первый экран — ${hero}`;
}
