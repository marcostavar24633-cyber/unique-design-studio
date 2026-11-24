// Эффекты текста: «исчезающий» текст.
// - fade-words: под заголовком первого экрана по очереди проявляются и растворяются короткие фразы (преимущества);
// - scroll-fade: заголовки и вводные абзацы секций проявляются при входе в экран и мягко тают при уходе вверх.
// Доступность: фразы целиком доступны экранному диктору одной строкой; анимация только при
// prefers-reduced-motion: no-preference; без поддержки scroll-timeline текст просто виден. Чистый CSS, без JavaScript.
import { esc, pick, stream } from './util.js';

export const TEXT_EFFECTS = {
  none: 'без эффекта текста',
  'fade-words': 'сменяющиеся фразы: под заголовком по очереди проявляются и растворяются преимущества',
  'scroll-fade': 'текст при прокрутке: заголовки секций проявляются и мягко тают',
};

// Короткие фразы для смены: заголовки преимуществ (до 40 знаков), 2–4 штуки.
export function fadePhrases(project) {
  return (project.advantages || []).map(a => String(a.title || '').trim()).filter(t => t && t.length <= 40).slice(0, 4);
}

/** Эффект текста проекта: ручной выбор владельца главнее; иначе — по архитектуре, классу и данным. */
export function chooseTextEffect(project, { archetype, intensity }, seed) {
  const forced = project.passthrough?.textEffect;
  if (Object.hasOwn(TEXT_EFFECTS, forced)) return forced === 'fade-words' && fadePhrases(project).length < 2 ? 'none' : forced;
  if (archetype === 'brutalist' || archetype === 'split-utility') return 'none';
  const pool = ['none'];
  if (fadePhrases(project).length >= 2 && archetype !== 'catalog') pool.push('fade-words', 'fade-words');
  pool.push('scroll-fade');
  if (intensity !== 'calm' || ['editorial', 'storytelling', 'immersive'].includes(archetype)) pool.push('scroll-fade');
  return pick(stream(seed, 'text-effect'), pool);
}

/** Блок сменяющихся фраз под заголовком первого экрана. */
export function fadeWordsHtml(project) {
  const phrases = fadePhrases(project);
  if (phrases.length < 2) return '';
  const n = phrases.length;
  const words = phrases.map((t, i) => `<span style="--fw-i:${i}">${esc(t)}</span>`).join('');
  return `<p class="fade-words" style="--fw-n:${n}"><span class="vh">${esc(phrases.join(' · '))}</span><span class="fade-words__track" aria-hidden="true">${words}</span></p>`;
}

export function textEffectCss(effect) {
  if (effect === 'fade-words') return `
.fade-words{position:relative;margin:.2em 0 1.1em;font-family:var(--ds-font-accent,var(--ds-font-display));font-size:clamp(1.05rem,.9rem + .9vw,1.5rem);color:var(--u-accent-ink,var(--ds-accent));min-height:1.5em}
.fade-words__track{display:grid}
.is-headline-over-figure .fade-words{text-align:center}
.fade-words__track>span{grid-area:1/1}
.fade-words__track>span:not(:first-child){visibility:hidden}
@media (prefers-reduced-motion:no-preference){
  .fade-words__track>span{visibility:visible!important;opacity:0;filter:blur(6px);animation:fw-cycle calc(var(--fw-n) * 3.2s) infinite;animation-delay:calc(var(--fw-i) * 3.2s)}
  @keyframes fw-cycle{0%{opacity:0;filter:blur(6px);transform:translateY(.25em)}6%,24%{opacity:1;filter:blur(0);transform:none}32%,100%{opacity:0;filter:blur(6px);transform:translateY(-.25em)}}
}`;
  if (effect === 'scroll-fade') return `
@supports (animation-timeline:view()){
  @media (prefers-reduced-motion:no-preference){
    .ds-section .sec__head h2,.ds-section .sec__head p{animation:sf-life linear both;animation-timeline:view();animation-range:entry 0% exit 100%}
    @keyframes sf-life{0%{opacity:0;transform:translateY(18px)}18%,72%{opacity:1;transform:none}100%{opacity:.15;transform:translateY(-10px)}}
  }
}`;
  return '';
}
