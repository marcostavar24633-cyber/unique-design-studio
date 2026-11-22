// Проверка раскладки и найденные ею исправления: контраст на тонированном фоне и компактная колода.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/engine/index.js';
import { contrast } from '../src/engine/color.js';
import { MECHANICS, MECHANIC_CSS } from '../src/engine/mechanics.js';
import { MASKS } from '../src/engine/forms.js';
import { LAYOUT_QA_SOURCE, layoutQA } from '../src/engine/layout-qa.js';
import { BROKEN_PAGE, layoutPages } from './e2e/layout-matrix.mjs';

test('вторичный и акцентный текст читаются и на тонированной поверхности (блок контактов, карточки)', () => {
  for (const niche of ['кафе вьетнамская кухня', 'стоматология', 'бар', 'ювелирный магазин', 'магазин мебели', 'фотограф']) for (const palette of ['', 'dark', 'light']) {
    const p = generate({ niche, brand: niche, palette, contacts: { email: 'a@b.ru' } }).concept.visualSystem.palette;
    assert.ok(contrast(p.muted, p.tint) >= 4.5, `${niche}/${palette}: вторичный ${contrast(p.muted, p.tint)}`);
    assert.ok(contrast(p.accentInk, p.tint) >= 4.5, `${niche}/${palette}: акцентный ${contrast(p.accentInk, p.tint)}`);
    assert.ok(p.pairs.some(x => x.name === 'вторичный текст / тонированная поверхность'));
  }
});

test('колода: карточка с фото компактная — фото слева, высота ограничена, фон непрозрачный', () => {
  assert.match(MECHANIC_CSS.stack, /\.items--mech-stack \.item:has\(\.item__media\)\{display:grid;grid-template-columns:minmax\(0,2fr\) minmax\(0,3fr\)/);
  assert.match(MECHANIC_CSS.stack, /max-height:min\(300px,42vh\)/);
  assert.match(MECHANIC_CSS.stack, /background:var\(--ds-bg\)/);
});

test('матрица проверки раскладки покрывает механики и маски без разделителей секций', () => {
  const pages = layoutPages();
  const names = pages.map(p => p.name).join('\n');
  for (const m of Object.keys(MECHANICS)) assert.match(names, new RegExp(`/${m}/`), m);
  for (const m of Object.keys(MASKS)) assert.match(names, new RegExp(`/${m}$`, 'm'), m);
  assert.ok(pages.some(p => /color-scheme:dark/.test(p.html)), 'есть тёмная палитра');
  for (const page of pages) assert.doesNotMatch(page.html, /ds-divider--|uds-divider/, page.name);
});

test('проверка раскладки — самодостаточная функция для запуска внутри страницы', () => {
  assert.equal(typeof layoutQA, 'function');
  assert.match(LAYOUT_QA_SOURCE, /^function layoutQA\(opts = \{\}\)/);
  assert.doesNotMatch(LAYOUT_QA_SOURCE, /\bimport\b|\brequire\(/, 'без зависимостей вне страницы');
  for (const kind of ["'covered'", "'offscreen'", "'clipped'", "'contrast'"]) assert.ok(LAYOUT_QA_SOURCE.includes(kind), kind);
  for (const id of ['covered', 'offscreen', 'clipped', 'contrast']) assert.match(BROKEN_PAGE, new RegExp(`id="${id}"`));
});
