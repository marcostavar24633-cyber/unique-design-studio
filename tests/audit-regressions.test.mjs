// Регрессии, найденные при аудите студии 17.11.2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { autopilot } from '../src/engine/autopilot.js';
import { detectNiche } from '../src/engine/concept.js';
import { normalizeProject } from '../src/engine/project.js';

const root = fileURLToPath(new URL('..', import.meta.url));

test('все скрипты студии и движка синтаксически корректны', () => {
  // Синтаксическая ошибка в studio.js молча выключает всю студию: строковые тесты её не замечают.
  const files = [
    ...readdirSync(root + 'studio').filter(f => f.endsWith('.js')).map(f => 'studio/' + f),
    ...readdirSync(root + 'src/engine').filter(f => f.endsWith('.js')).map(f => 'src/engine/' + f),
    ...readdirSync(root + 'worker').filter(f => f.endsWith('.js')).map(f => 'worker/' + f),
  ];
  for (const file of files) {
    const r = spawnSync(process.execPath, ['--check', root + file], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${file}: ${r.stderr.split('\n').slice(0, 4).join(' ')}`);
  }
});

test('кнопки AI Content Director видят задание, собранное при отрисовке вкладки', () => {
  const src = readFileSync(root + 'studio/studio.js', 'utf8');
  // Объявление на уровне модуля, присваивание в renderSpec, вызов из обработчика кнопок.
  const declared = src.indexOf("let contentPrompt = () => '';");
  const render = src.indexOf('function renderSpec()');
  assert.ok(declared > 0 && declared < render, 'contentPrompt объявлена до renderSpec на уровне модуля');
  assert.ok(!src.includes('const contentPrompt = () =>'), 'локальная константа скрывала функцию от обработчика');
  assert.match(src, /\n  contentPrompt = \(\) => \{/);
  const body = src.slice(src.indexOf('contentPrompt = () => {'), src.indexOf("$('#view-spec').innerHTML"));
  assert.ok(body.includes(".join('\\n\\n')"), 'части задания разделены настоящими переводами строк');
  assert.ok(!body.includes(".join('\\\\n\\\\n')"), 'а не буквальными «\\n»');
});

test('ниша определяется по смыслу, а не по первому общему слову', () => {
  const cases = {
    'студия красоты': 'beauty', 'салон красоты': 'beauty', 'ремонт велосипедов': 'repair', 'ремонт телефонов': 'repair',
    'автосервис': 'repair', 'ремонт квартир': 'construction', 'строительная компания': 'construction',
    'магазин мебели': 'furniture', 'интернет-магазин одежды': 'apparel', 'магазин обуви': 'apparel',
    'музыкальный магазин': 'music', 'магазин телескопов': 'optics', 'ювелирный магазин': 'boutique',
    'дизайн-студия': 'studio', 'магазин': 'shop',
  };
  for (const [niche, id] of Object.entries(cases)) assert.equal(detectNiche(normalizeProject({ niche })).id, id, niche);
});

test('у новых профилей свои тексты: без общих фраз магазина и заглушек категорий', () => {
  for (const niche of ['магазин мебели', 'интернет-магазин одежды', 'музыкальный магазин', 'ремонт велосипедов', 'студия красоты']) {
    const p = autopilot({ niche }, { registry: [] }).project;
    assert.notEqual(p.title, 'Нужное — в пару кликов', niche);
    assert.ok(!p.services.some(s => /\[Категория/.test(s[0])), `${niche}: заглушки категорий`);
    assert.ok(!/стратег|разработк/i.test(p.services.map(s => s[0]).join(' ')) || niche !== 'студия красоты', 'студия красоты — не агентство');
  }
});

test('ссылки телефона и почты в контактах удобно нажимать на телефоне', async () => {
  const { generate } = await import('../src/engine/index.js');
  const { html } = generate({ brand: 'Тест', niche: 'фотограф', contacts: { email: 'hello@example.com', phone: '+7 900 000-00-00' } });
  assert.match(html, /\.contact__list a\{display:inline-flex;align-items:center;min-height:44px/);
});

test('компактная кнопка в навигации сохраняет сенсорную высоту 44 px', async () => {
  const { NAV_CSS } = await import('../src/engine/css.js');
  assert.match(NAV_CSS.compact, /\.nav--compact \.nav__cta\{min-height:44px/);
});
