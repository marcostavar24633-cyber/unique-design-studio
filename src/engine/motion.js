// Motion Design Engine: подбирает набор анимационных механик и их интенсивность под характер бренда,
// класс проекта, нишу и архитектуру. Никогда не включает всё сразу: у каждой интенсивности свой бюджет.
// Все эффекты — только transform/opacity, без внешних библиотек; при prefers-reduced-motion выключаются целиком,
// эффекты наведения — только на устройствах с точным указателем.
import { stream } from './util.js';

/** Реализованные механики. Других движок не обещает. */
export const MECHANICS = Object.freeze({
  'scroll-reveal': 'Появление блоков при прокрутке',
  'glass-cards': 'Стеклянные карточки с мягким размытием и световой кромкой',
  'cinematic-reveal': 'Кинематографичное появление первого экрана: заголовок, текст и действие выходят по очереди',
  'kinetic-type': 'Кинетическая типографика: слова заголовка поднимаются по одному',
  parallax: 'Лёгкий параллакс визуала первого экрана',
  'tilt-cards': '3D-наклон карточек за курсором',
  'magnetic-buttons': 'Магнитные кнопки: главная кнопка слегка тянется к курсору',
  'dynamic-gradient': 'Медленно движущийся градиент в фоне первого экрана',
  'scroll-progress': 'Индикатор прочитанного для длинной истории',
  'nav-underline': 'Анимированное подчёркивание пунктов навигации',
  microinteractions: 'Микровзаимодействия: отклик кнопок на нажатие, плавные состояния ссылок',
});

export const MOTION_STYLES = Object.freeze({ auto: 'Автоматически по бренду и нише', cinematic: 'Cinematic Motion Design — полный набор эффектов', static: 'Минимум движения' });

export const INTENSITY = Object.freeze({
  calm: { label: 'спокойная', budget: 2, duration: 900, distance: 10 },
  balanced: { label: 'сбалансированная', budget: 3, duration: 650, distance: 16 },
  expressive: { label: 'выразительная', budget: 4, duration: 520, distance: 24 },
});

const CALM_NICHES = new Set(['medical', 'proservices', 'construction', 'repair', 'multi']);
const EXPRESSIVE_NICHES = new Set(['underground', 'events', 'music', 'apparel', 'studio', 'fitness']);
const SHOP_NICHES = new Set(['shop', 'appliances', 'optics', 'furniture', 'apparel', 'seafood', 'gifts', 'music']);
const CALM_WORDS = /спокойн|сдержан|строг|деловой|надёжн|медицин|точн|уважительн/i;
const LOUD_WORDS = /дерзк|ярк|энерги|смел|живой|игрив|драйв|экспериментал/i;

/**
 * @param {object} project нормализованный проект
 * @param {{archetype:string, motion:string, nicheId:string, seed:number}} ctx
 */
export function chooseMotion(project, { archetype, motion, nicheId, seed }) {
  const character = `${project.brandCharacter || ''} ${project.visualDirection || ''}`;
  const why = [];
  let intensity = 'balanced';
  if (project.tier === 'luxury') { intensity = 'calm'; why.push('люкс — сдержанное, медленное движение'); }
  else if (CALM_NICHES.has(nicheId) || CALM_WORDS.test(character)) { intensity = 'calm'; why.push('ниша и характер требуют спокойной подачи'); }
  else if (EXPRESSIVE_NICHES.has(nicheId) || LOUD_WORDS.test(character)) { intensity = 'expressive'; why.push('характер бренда допускает выразительное движение'); }
  else why.push('нейтральный характер — умеренное движение');
  if (archetype === 'minimal' || archetype === 'brutalist') { intensity = 'calm'; why.push(`архитектура «${archetype}» не терпит лишнего движения`); }

  const r = stream(seed, 'motion');
  const candidates = [];
  const want = (id, weight, reason) => candidates.push({ id, weight: weight + r() * 0.5, reason });

  if (motion === 'static') why.push('архитектура задаёт статичную подачу — только микровзаимодействия');
  else want('scroll-reveal', 5, 'появление блоков по мере чтения');
  if (motion === 'parallax' || (['immersive', 'editorial'].includes(archetype) && intensity !== 'calm')) want('parallax', 3.5, 'глубина первого экрана соответствует визуальной концепции');
  if (['luxury', 'premium'].includes(project.tier) || (['immersive', 'editorial'].includes(archetype) && intensity !== 'calm')) want('glass-cards', 3.8, 'стеклянные поверхности поддерживают выбранную визуальную систему');

  want('microinteractions', 3, 'понятный отклик интерфейса');
  if (motion !== 'static') {
    if (project.tier === 'luxury' || project.tier === 'premium' || archetype === 'editorial' || archetype === 'immersive') want('cinematic-reveal', 4, 'первый экран раскрывается как сцена');
    if (intensity !== 'calm') want('kinetic-type', archetype === 'brutalist' || archetype === 'asymmetric' ? 4 : 2, 'заголовок как главный визуальный приём');
    if (archetype === 'storytelling') want('scroll-progress', 4, 'длинная история — виден прогресс чтения');
    if (intensity === 'expressive') want('dynamic-gradient', 2, 'живой фон первого экрана');
  }
  // Отклик на курсор — не анимация появления, поэтому допустим и в статичных архитектурах.
  if (intensity === 'expressive') want('magnetic-buttons', 3, 'игровой отклик главного действия');
  if (SHOP_NICHES.has(nicheId) && intensity !== 'calm' && (archetype === 'catalog' || archetype === 'product-first' || archetype === 'modular-grid')) want('tilt-cards', 3, 'карточки товаров откликаются на курсор');
  else if (motion !== 'static' && intensity !== 'calm' && ['immersive', 'editorial', 'asymmetric', 'modular-grid'].includes(archetype)) want('tilt-cards', 2.8, 'объёмная глубина карточек поддерживает выразительную композицию');
  if (project.tier !== 'luxury' && intensity !== 'calm') want('nav-underline', 1, 'навигация подсказывает текущий выбор');

  // Бюджет: не больше N механик; кинематографичное появление и кинетика заголовка — взаимоисключающие.
  const budget = INTENSITY[intensity].budget;
  const chosen = [];
  for (const c of candidates.sort((a, b) => b.weight - a.weight)) {
    if (chosen.length >= budget) break;
    if (c.id === 'kinetic-type' && chosen.some(x => x.id === 'cinematic-reveal')) continue;
    if (c.id === 'cinematic-reveal' && chosen.some(x => x.id === 'kinetic-type')) continue;
    if (!chosen.some(x => x.id === c.id)) chosen.push(c);
  }
  const mechanics = chosen.map(c => c.id);
  return {
    intensity, mechanics,
    duration: INTENSITY[intensity].duration, distance: INTENSITY[intensity].distance,
    rationale: [...why, ...chosen.map(c => `${MECHANICS[c.id]} — ${c.reason}`)],
    label: `${capitalize(INTENSITY[intensity].label)} анимация: ${mechanics.map(m => MECHANICS[m].toLowerCase()).join('; ')}. Всё отключается при prefers-reduced-motion.`,
  };
}

const capitalize = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const has = (plan, id) => plan.mechanics.includes(id);

/** CSS выбранных механик. Всё движение — внутри prefers-reduced-motion: no-preference. */
export function motionCss(plan) {
  if (!plan) return '';
  const d = plan.duration, dist = plan.distance;
  const out = [`:root{--m-dur:${d}ms;--m-dist:${dist}px;--m-ease:cubic-bezier(.2,.7,.2,1)}`];
  const motionOk = [];
  // Premium interaction layer: consistent card, button and section treatments on every generated site.
  motionOk.push(`.ds-button{position:relative;isolation:isolate;overflow:hidden;transition:transform .24s var(--m-ease),box-shadow .24s var(--m-ease),background-color .24s var(--m-ease),border-color .24s var(--m-ease),filter .24s var(--m-ease)}.ds-button::after{content:"";position:absolute;inset:-2px auto -2px -45%;width:34%;pointer-events:none;background:linear-gradient(105deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-18deg) translateX(-160%);transition:transform .65s var(--m-ease)}.ds-button:hover::after,.ds-button:focus-visible::after{transform:skewX(-18deg) translateX(520%)}.ds-button:hover{box-shadow:0 10px 28px color-mix(in srgb,var(--ds-accent,currentColor) 22%,transparent);filter:brightness(1.035)}.ds-button:focus-visible{outline:2px solid var(--ds-accent);outline-offset:4px}.ds-card,.item,.spotlight,.tool,.gallery li{transition:box-shadow .3s var(--m-ease),border-color .3s var(--m-ease),background-color .3s var(--m-ease)}.ds-card:hover,.item:hover,.spotlight:hover,.tool:hover,.gallery li:hover{box-shadow:0 18px 48px rgba(0,0,0,.13);border-color:color-mix(in srgb,var(--ds-accent,currentColor) 38%,var(--ds-border,transparent))}.ds-card img,.item img,.spotlight img,.gallery img{transition:transform .65s var(--m-ease),filter .4s var(--m-ease)}.ds-card:hover img,.item:hover img,.spotlight:hover img,.gallery li:hover img{transform:scale(1.025);filter:saturate(1.04)}.ds-section{position:relative;isolation:isolate}.ds-section:not(.sec--contact){scroll-margin-top:2rem}.ds-section:not(:first-child)::before{content:"";position:absolute;z-index:-1;pointer-events:none;inset:calc(-1 * clamp(28px,5vw,72px)) 0 auto;height:clamp(56px,10vw,144px);background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--ds-bg) 72%,transparent),transparent);opacity:.72}`);
  if (has(plan, 'cinematic-reveal')) motionOk.push(`html.js-motion .hero h1,html.js-motion .hero .lede,html.js-motion .hero .actions{animation:m-rise var(--m-dur) var(--m-ease) both}html.js-motion .hero .lede{animation-delay:calc(var(--m-dur)*.22)}html.js-motion .hero .actions{animation-delay:calc(var(--m-dur)*.42)}html.js-motion .hero .visual,html.js-motion .hero .spotlight,html.js-motion .hero .hero__bg{animation:m-scene var(--m-dur) var(--m-ease) both;animation-delay:calc(var(--m-dur)*.12)}@keyframes m-rise{from{opacity:0;transform:translate3d(0,var(--m-dist),0)}to{opacity:1;transform:none}}@keyframes m-scene{from{opacity:0;transform:scale(1.035)}to{opacity:1;transform:scale(1)}}`);
  if (has(plan, 'kinetic-type')) motionOk.push(`.m-word{display:inline-block;white-space:pre}html.js-motion .m-word{animation:m-word var(--m-dur) var(--m-ease) both;animation-delay:calc(var(--i)*70ms)}@keyframes m-word{from{opacity:0;transform:translate3d(0,.6em,0)}to{opacity:1;transform:none}}`);
  if (has(plan, 'dynamic-gradient')) motionOk.push(`.hero{position:relative;isolation:isolate}.hero::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(60% 50% at 20% 30%,color-mix(in srgb,var(--ds-accent,currentColor) 18%,transparent),transparent 70%),radial-gradient(50% 40% at 80% 70%,color-mix(in srgb,var(--ds-accent,currentColor) 12%,transparent),transparent 70%);background-size:160% 160%;animation:m-drift 22s ease-in-out infinite alternate}@keyframes m-drift{from{background-position:0% 0%}to{background-position:100% 100%}}`);
  if (has(plan, 'scroll-progress')) motionOk.push(`.m-progress{position:fixed;inset:0 0 auto 0;height:3px;z-index:60;transform-origin:0 50%;transform:scaleX(var(--m-p,0));background:var(--ds-accent,currentColor);pointer-events:none}`);
  if (has(plan, 'nav-underline')) motionOk.push(`nav a:not(.ds-button){background:linear-gradient(currentColor,currentColor) 0 100%/0 1px no-repeat;transition:background-size var(--m-dur) var(--m-ease)}nav a:not(.ds-button):hover,nav a:not(.ds-button):focus-visible{background-size:100% 1px}`);
  if (has(plan, 'microinteractions')) motionOk.push(`.ds-button{transition:transform .22s var(--m-ease),box-shadow .22s var(--m-ease),filter .22s var(--m-ease)}.ds-button:active{filter:brightness(.96);transform:scale(.97)}`);
  if (has(plan, 'glass-cards')) motionOk.push(`.ds-card,.item,.ds-section .items .item,.spotlight,.tool{background:color-mix(in srgb,var(--ds-surface,var(--ds-bg)) 76%,transparent);border:1px solid color-mix(in srgb,var(--ds-text,currentColor) 14%,transparent);box-shadow:0 18px 55px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.16);backdrop-filter:blur(18px) saturate(135%);-webkit-backdrop-filter:blur(18px) saturate(135%)}@supports not (backdrop-filter:blur(1px)){.ds-card,.item,.ds-section .items .item,.spotlight,.tool{background:var(--ds-surface,var(--ds-bg))}}`);
  const pointer = [];
  if (has(plan, 'tilt-cards')) pointer.push(`.item,.ds-card{transition:transform .28s var(--m-ease),box-shadow .28s var(--m-ease);transform:perspective(1000px) rotateX(var(--m-rx,0deg)) rotateY(var(--m-ry,0deg));transform-style:preserve-3d;will-change:transform}`);
  if (has(plan, 'magnetic-buttons')) pointer.push(`[data-cta="primary"]{transition:transform .25s var(--m-ease),box-shadow .25s var(--m-ease);transform:translate3d(var(--m-mx,0px),var(--m-my,0px),0) translateY(var(--m-hover-y,0px))}`);
  if (motionOk.length) out.push(`@media(prefers-reduced-motion:no-preference){${motionOk.join('')}}`);
  if (pointer.length) out.push(`@media(prefers-reduced-motion:no-preference) and (hover:hover) and (pointer:fine){${pointer.join('')}}`);
  if (has(plan, 'scroll-progress')) out.push(`@media(prefers-reduced-motion:reduce){.m-progress{display:none}}`);
  return out.join('');
}

/** JS выбранных механик (кроме появления блоков и параллакса — они в основном скрипте страницы). */
export function motionScript(plan) {
  if (!plan) return '';
  const parts = [];
  const ok = `!matchMedia('(prefers-reduced-motion: reduce)').matches`;
  const fine = `matchMedia('(hover: hover) and (pointer: fine)').matches`;
  if (has(plan, 'cinematic-reveal') || has(plan, 'kinetic-type')) // Класс, прячущий элементы до анимации, ставится только в кадре отрисовки: если браузер не рисует кадры
  // (фоновая вкладка, слабое устройство), содержимое остаётся видимым, а не замирает в начальном состоянии.
  parts.push(`if(${ok}&&window.requestAnimationFrame)requestAnimationFrame(function(){document.documentElement.classList.add('js-motion')})`);
  // Слова заголовка оборачиваются только при разрешённом движении; текст для экранных дикторов сохраняется в aria-label.
  if (has(plan, 'kinetic-type')) parts.push(`var h=document.getElementById('hero-h');if(h&&${ok}&&!h.children.length){var t=h.textContent;h.setAttribute('aria-label',t);h.textContent='';t.split(/(\\s+)/).forEach(function(w,i){if(!w)return;if(/^\\s+$/.test(w)){h.appendChild(document.createTextNode(' '));return}var s=document.createElement('span');s.className='m-word';s.setAttribute('aria-hidden','true');s.style.setProperty('--i',String(Math.floor(i/2)));s.textContent=w;h.appendChild(s)})}`);
  if (has(plan, 'scroll-progress')) parts.push(`if(${ok}){var pb=document.createElement('div');pb.className='m-progress';pb.setAttribute('aria-hidden','true');document.body.appendChild(pb);var pt=false;addEventListener('scroll',function(){if(pt)return;pt=true;requestAnimationFrame(function(){var m=document.documentElement.scrollHeight-innerHeight;pb.style.setProperty('--m-p',m>0?String(Math.min(1,scrollY/m)):'0');pt=false})},{passive:true})}`);
  if (has(plan, 'tilt-cards')) parts.push(`if(${ok}&&${fine})document.querySelectorAll('.item,.ds-card').forEach(function(el){el.addEventListener('pointermove',function(e){var b=el.getBoundingClientRect();el.style.setProperty('--m-ry',((e.clientX-b.left)/b.width-.5)*6+'deg');el.style.setProperty('--m-rx',(.5-(e.clientY-b.top)/b.height)*6+'deg')});el.addEventListener('pointerleave',function(){el.style.removeProperty('--m-rx');el.style.removeProperty('--m-ry')})})`);
  if (has(plan, 'magnetic-buttons')) parts.push(`if(${ok}&&${fine})document.querySelectorAll('[data-cta="primary"]').forEach(function(el){el.addEventListener('pointerenter',function(){el.style.setProperty('--m-hover-y','-2px')});el.addEventListener('pointermove',function(e){var b=el.getBoundingClientRect();el.style.setProperty('--m-mx',(e.clientX-b.left-b.width/2)*.18+'px');el.style.setProperty('--m-my',(e.clientY-b.top-b.height/2)*.25+'px')});el.addEventListener('pointerleave',function(){el.style.removeProperty('--m-mx');el.style.removeProperty('--m-my');el.style.removeProperty('--m-hover-y')})})`);
  return parts.join(';');
}
