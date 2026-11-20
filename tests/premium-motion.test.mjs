import test from 'node:test';
import assert from 'node:assert/strict';
import { motionCss } from '../src/engine/motion.js';

test('premium motion layer adds button light sweep and card hover states', () => {
  const css = motionCss({ duration: 650, distance: 16, mechanics: [] });
  assert.match(css, /\.ds-button::after/);
  assert.match(css, /translateX\(520%\)/);
  assert.match(css, /\.ds-card:hover/);
  assert.match(css, /\.item:hover/);
});

test('premium motion layer respects reduced motion', () => {
  const css = motionCss({ duration: 650, distance: 16, mechanics: [] });
  assert.match(css, /prefers-reduced-motion:no-preference/);
});

test('premium motion layer uses valid CSS for negative clamp offsets', () => {
  const css = motionCss({ duration: 650, distance: 16, mechanics: [] });
  // «-clamp(...)» — недопустимый CSS: браузер отбрасывает всё свойство. Отрицательное значение — только через calc().
  assert.doesNotMatch(css, /[:\s,]-clamp\(/);
  assert.match(css, /inset:calc\(-1 \* clamp\(28px,5vw,72px\)\) 0 auto/);
});
