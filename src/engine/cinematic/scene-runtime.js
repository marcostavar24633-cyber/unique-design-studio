import { SCENE_PROFILES } from './scene-profiles.js';

const escClass = value => Object.hasOwn(SCENE_PROFILES, value) ? value : 'immersive-environment';

/** Декоративные слои сцены. Контент и CTA остаются поверх и доступны без JS. */
export function sceneMarkup(scene) {
  const type = escClass(scene?.type);
  const count = Math.min(3, Math.max(1, Number(scene?.layers) || 2));
  return `<div class="uds-scene uds-scene--${type}" data-cinematic-scene aria-hidden="true">${Array.from({ length: count }, (_, i) => `<span class="uds-scene__layer uds-scene__layer--${i + 1}"></span>`).join('')}</div>`;
}

export function sceneCss(scene) {
  if (!scene) return '';
  const type = escClass(scene.type);
  const active = scene.intensity !== 'calm';
  const common = '.hero{isolation:isolate;overflow:hidden}.uds-scene{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;contain:paint}.uds-scene__layer{position:absolute;inset:-8%;display:block;pointer-events:none}.hero>.hero__content,.hero>.ds-container,.hero>.hero__grid,.hero>.hero__canvas,.hero>.hero__wrap,.hero>.hero__split,.hero>.hero__story,.hero>.hero__stack,.hero>.hero__frame{position:relative;z-index:1}.uds-scene__layer--1{background:radial-gradient(ellipse at 72% 28%,color-mix(in srgb,var(--ds-accent) 24%,transparent),transparent 48%);opacity:.8}.uds-scene__layer--2{background:linear-gradient(115deg,transparent 28%,color-mix(in srgb,var(--ds-text) 5%,transparent) 50%,transparent 72%);opacity:.65}.uds-scene__layer--3{background:radial-gradient(ellipse at 18% 82%,color-mix(in srgb,var(--ds-accent) 13%,transparent),transparent 42%);opacity:.8}';
  const looks = {
    'luxury-cinematic': '.uds-scene--luxury-cinematic .uds-scene__layer--1{background:radial-gradient(ellipse at 68% 35%,color-mix(in srgb,var(--ds-accent) 20%,transparent),transparent 42%)}.uds-scene--luxury-cinematic .uds-scene__layer--2{background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.12) 50%,transparent 65%);mix-blend-mode:screen}',
    'immersive-environment': '.uds-scene--immersive-environment .uds-scene__layer--1{background:radial-gradient(ellipse at 75% 35%,color-mix(in srgb,var(--ds-accent) 28%,transparent),transparent 55%)}.uds-scene--immersive-environment .uds-scene__layer--2{background:radial-gradient(ellipse at 20% 80%,rgba(90,110,160,.13),transparent 52%)}',
    'living-photography': '.uds-scene--living-photography .uds-scene__layer--1{background:linear-gradient(120deg,transparent 35%,rgba(255,255,255,.14) 50%,transparent 65%);mix-blend-mode:screen}.uds-scene--living-photography .uds-scene__layer--2{background:linear-gradient(180deg,transparent 45%,var(--ds-bg) 120%);opacity:.22}',
    'editorial-motion': '.uds-scene--editorial-motion .uds-scene__layer--1{background:linear-gradient(120deg,transparent 48%,color-mix(in srgb,var(--ds-accent) 15%,transparent) 49%,transparent 50%)}.uds-scene--editorial-motion .uds-scene__layer--2{border:1px solid color-mix(in srgb,var(--ds-text) 12%,transparent);inset:8% 5%;opacity:.45}',
    'particle-universe': '.uds-scene--particle-universe .uds-scene__layer--1{background-image:radial-gradient(circle,rgba(255,255,255,.65) 1px,transparent 1.8px);background-size:54px 54px;mask-image:linear-gradient(90deg,transparent,#000 25%,#000 80%,transparent);opacity:.24}.uds-scene--particle-universe .uds-scene__layer--2{background:radial-gradient(ellipse at 50% 50%,color-mix(in srgb,var(--ds-accent) 20%,transparent),transparent 60%)}',
    'clean-product': '.uds-scene--clean-product .uds-scene__layer--1{background:radial-gradient(ellipse at 72% 48%,color-mix(in srgb,var(--ds-accent) 16%,transparent),transparent 44%)}.uds-scene--clean-product .uds-scene__layer--2{background:linear-gradient(180deg,transparent 55%,color-mix(in srgb,var(--ds-bg) 30%,transparent))}',
  };
  const motion = active ? '@media(prefers-reduced-motion:no-preference){.uds-scene__layer--1{animation:uds-scene-breathe 18s ease-in-out infinite alternate}.uds-scene__layer--2{animation:uds-scene-drift 26s ease-in-out infinite alternate}@keyframes uds-scene-breathe{from{transform:scale(1);opacity:.55}to{transform:scale(1.08);opacity:.95}}@keyframes uds-scene-drift{from{transform:translate3d(-1%,0,0)}to{transform:translate3d(1%,1%,0)}}}@media(max-width:700px){.uds-scene__layer{animation:none!important;transform:none!important}.uds-scene__layer--3{display:none}}' : '@media(prefers-reduced-motion:reduce){.uds-scene__layer{animation:none!important;transform:none!important}}';
  return common + (looks[type] || '') + motion;
}

/** Runtime только включает сцену после первого кадра; при ошибке остаётся статичный CSS fallback. */
export function sceneScript(scene) {
  if (!scene) return '';
  return `if(!matchMedia('(prefers-reduced-motion: reduce)').matches){requestAnimationFrame(function(){var s=document.querySelector('[data-cinematic-scene]');if(s)s.classList.add('is-ready')})}`;
}
