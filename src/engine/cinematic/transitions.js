// Переходы между секциями: мягкий градиентный ореол на стыке, без отдельной полосы и дополнительного отступа.
// Градиент настраивается: цвета начала и конца, угол, высота и интенсивность. Пустой цвет — «авто»:
// акцент и его более глубокий оттенок (смесь с цветом текста), поэтому переход всегда согласован с дизайном.
import { normalizeHex } from '../color.js';

export const TRANSITIONS = Object.freeze({
  none: 'Без перехода',
  fade: 'Мягкий градиент',
  glow: 'Свечение',
  diagonal: 'Диагональный срез',
  arch: 'Арка',
  wave: 'Волна',
  split: 'Двухцветный срез',
  mesh: 'Сетчатый градиент',
});
export const TRANSITION_IDS = Object.keys(TRANSITIONS);

export const TRANSITION_LIMITS = Object.freeze({ height: [24, 200], intensity: [0, 100], angle: [0, 360] });
const DEFAULTS = { height: 72, intensity: 40, angle: 180 };

const clamp = (v, [a, b], fallback) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, Math.round(n))) : fallback; };

/**
 * Настройки перехода. Ручные поля проекта (passthrough.transition*) главнее автоматики.
 * @returns {{type, from:string, to:string, angle:number, height:number, intensity:number, rationale:string}}
 */
export function chooseTransition(project = {}, visual = {}) {
  project = project && typeof project === 'object' ? project : {};
  visual = visual && typeof visual === 'object' ? visual : {};
  const t = project.passthrough || {};
  // Переходы теперь всегда градиентные и одинаково читаются между любыми блоками.
  // Старые значения transitionType сохраняем в проекте, но не используем при рендере.
  const type = 'fade';
  const rationale = 'Постоянный градиентный переход между блоками';
  const calm = project.tier === 'luxury' && project.passthrough?.motionStyle !== 'cinematic';
  return Object.freeze({
    type,
    from: normalizeHex(t.transitionFrom),
    to: normalizeHex(t.transitionTo),
    angle: clamp(t.transitionAngle, TRANSITION_LIMITS.angle, DEFAULTS.angle),
    height: clamp(t.transitionHeight, TRANSITION_LIMITS.height, DEFAULTS.height),
    intensity: clamp(t.transitionIntensity, TRANSITION_LIMITS.intensity, calm ? 28 : DEFAULTS.intensity),
    rationale,
  });
}

/** Разметка перехода между секциями. */
export function transitionHtml(tr) {
  if (!tr || tr.type === 'none') return '';
  return `<div class="uds-transition uds-transition--${tr.type}" aria-hidden="true"></div>`;
}

const svgMask = path => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 100' preserveAspectRatio='none'><path d='${path}'/></svg>`)}")`;
const WAVE = 'M0 60 C150 20 300 20 450 55 S750 95 900 55 S1100 25 1200 45 V100 H0Z';

/** CSS перехода. Цвета: заданные владельцем или акцент/поверхность палитры.
 *  Слой занимает нулевое место в потоке и мягко перекрывает стык соседних секций. */
export function transitionCss(tr, sectionLayout = '') {
  if (!tr || tr.type === 'none') return '';
  const k = tr.intensity;
  const from = tr.from ? `color-mix(in srgb,${tr.from} ${k}%,transparent)` : `color-mix(in srgb,var(--ds-accent) ${k}%,transparent)`;
  const to = tr.to ? `color-mix(in srgb,${tr.to} ${Math.min(100, k + 20)}%,transparent)` : `color-mix(in srgb,color-mix(in srgb,var(--ds-accent) 55%,var(--ds-text)) ${Math.round(k * 0.7)}%,transparent)`;
  // Градиент лежит поверх стыка, но переход не добавляет секциям пустую полосу в потоке.
  const base = `.uds-transition{display:block;position:relative;z-index:1;width:100%;height:0;pointer-events:none;--ut-from:${from};--ut-to:${to}}.uds-transition::before{content:"";position:absolute;inset-inline:0;top:-${tr.height}px;height:${tr.height * 2}px;pointer-events:none}`;
  const looks = {
    fade: `.uds-transition--fade::before{background:radial-gradient(ellipse 72% 90% at 50% 50%,var(--ut-from),transparent 72%),radial-gradient(ellipse 46% 78% at 24% 50%,var(--ut-to),transparent 76%);filter:blur(12px)}`,
    glow: `.uds-transition--glow::before{background:radial-gradient(ellipse 55% 60% at 50% 50%,var(--ut-from),var(--ut-to) 55%,transparent 75%)}`,
    diagonal: `.uds-transition--diagonal::before{background:linear-gradient(${tr.angle}deg,var(--ut-from),var(--ut-to));clip-path:polygon(0 35%,100% 0,100% 65%,0 100%)}`,
    arch: `.uds-transition--arch::before{background:linear-gradient(${tr.angle}deg,var(--ut-from),var(--ut-to));border-radius:0 0 50% 50%/0 0 100% 100%}`,
    wave: `.uds-transition--wave::before{background:linear-gradient(${tr.angle}deg,var(--ut-from),var(--ut-to));-webkit-mask:${svgMask(WAVE)} center/100% 100% no-repeat;mask:${svgMask(WAVE)} center/100% 100% no-repeat}`,
    split: `.uds-transition--split::before{background:linear-gradient(${tr.angle}deg,var(--ut-from) 0 50%,var(--ut-to) 50% 100%);-webkit-mask-image:linear-gradient(180deg,transparent,#000 35%,#000 65%,transparent);mask-image:linear-gradient(180deg,transparent,#000 35%,#000 65%,transparent)}`,
    mesh: `.uds-transition--mesh::before{background:radial-gradient(ellipse 40% 90% at 22% 50%,var(--ut-from),transparent 70%),radial-gradient(ellipse 45% 90% at 78% 50%,var(--ut-to),transparent 70%)}`,
  };
  // В «рамках» полоса продолжает заливку секций, а линии на стыке с переходом убираются — секции перетекают,
  // а не разделяются плашкой фона страницы. Перед контактами (у них фон страницы) заливки нет.
  const framed = sectionLayout === 'framed'
    ? '.uds-transition{background-color:var(--ds-surface)}.uds-transition:has(+ .sec--contact){background-color:transparent}.uds-transition + .ds-section.section-layout--framed:not(.sec--contact){border-top:0}.ds-section.section-layout--framed:not(.sec--contact):has(+ .uds-transition){border-bottom:0}'
    : '';
  return base + (looks[tr.type] || '') + framed;
}

/** Краткое описание для концепции и ТЗ. */
export function describeTransition(tr) {
  if (!tr || tr.type === 'none') return 'Без перехода между секциями';
  const colors = tr.from || tr.to ? `цвета ${tr.from || 'акцент'} → ${tr.to || 'глубокий акцент'}` : 'цвета палитры';
  return `${TRANSITIONS[tr.type]}: ${colors}, угол ${tr.angle}°, высота ${tr.height} px, интенсивность ${tr.intensity}%`;
}
