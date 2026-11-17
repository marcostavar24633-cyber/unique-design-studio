// Исчезающий текст и пары шрифтов: доступно, без JavaScript, с кириллицей.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, normalizeProject, exportProject } from '../src/engine/index.js';
import { WEB_FONTS, WEB_FONT_PAIRS } from '../src/engine/data.js';
import { chooseTextEffect, fadePhrases, fadeWordsHtml, textEffectCss } from '../src/engine/text-effects.js';

const adv = [['Ручная работа', ''], ['Сертификат на металл', ''], ['Гравировка', '']];
const site = extra => generate({ niche: 'ювелирная мастерская', brand: 'Аурум', contacts: { email: 'a@b.ru' }, advantages: adv, ...extra });

test('сменяющиеся фразы: под заголовком, целиком для экранного диктора, анимация скрыта от него', () => {
  const g = site({ textEffect: 'fade-words' });
  assert.equal(g.concept.visualSystem.textEffect, 'fade-words');
  assert.match(g.html, /<\/h1><p class="fade-words" style="--fw-n:3"><span class="vh">Ручная работа · Сертификат на металл · Гравировка<\/span><span class="fade-words__track" aria-hidden="true">/);
  assert.ok(g.audit.ok, g.audit.errors.map(e => e.message).join('; '));
});

test('анимация фраз только без reduced-motion; без неё виден первый вариант', () => {
  const css = textEffectCss('fade-words');
  assert.match(css, /\.fade-words__track>span:not\(:first-child\)\{visibility:hidden\}/);
  assert.match(css, /@media \(prefers-reduced-motion:no-preference\)\{[^]*animation:fw-cycle/);
  assert.match(css, /font-family:var\(--ds-font-accent,var\(--ds-font-display\)\)/);
});

test('текст при прокрутке — только при поддержке scroll-timeline и без reduced-motion', () => {
  const css = textEffectCss('scroll-fade');
  assert.match(css, /^\s*@supports \(animation-timeline:view\(\)\)\{\s*@media \(prefers-reduced-motion:no-preference\)/);
  assert.ok(site({ textEffect: 'scroll-fade' }).audit.ok);
});

test('фразы — короткие заголовки преимуществ; меньше двух — эффекта нет', () => {
  assert.deepEqual(fadePhrases({ advantages: [{ title: 'А' }, { title: 'Очень длинный заголовок преимущества, который не поместится' }, { title: 'Б' }] }), ['А', 'Б']);
  assert.equal(fadeWordsHtml({ advantages: [{ title: 'Одно' }] }), '');
  const p = normalizeProject({ niche: 'кафе', textEffect: 'fade-words', advantages: [['Одно', '']] });
  assert.equal(chooseTextEffect(p, { archetype: 'editorial', intensity: 'balanced' }, 1), 'none');
});

test('брутализм и деловая архитектура — без эффектов текста', () => {
  const p = normalizeProject({ niche: 'кафе', advantages: adv });
  for (let s = 0; s < 20; s++) {
    assert.equal(chooseTextEffect(p, { archetype: 'brutalist', intensity: 'balanced' }, s), 'none');
    assert.equal(chooseTextEffect(p, { archetype: 'split-utility', intensity: 'balanced' }, s), 'none');
  }
});

test('пары шрифтов: первая — прежняя, несколько на характер, одноначертательные без искусственного жирного', () => {
  for (const [type, pairs] of Object.entries(WEB_FONT_PAIRS)) {
    assert.deepEqual(pairs[0].display, WEB_FONTS[type][0], type);
    assert.ok(pairs.length >= 3, type);
    for (const p of pairs) if (p.display[1] === '400') assert.equal(p.dw, 400, `${p.display[0]} — один вес, нужен dw:400`);
  }
});

test('ручная пара шрифтов подключает заголовки, текст и акцент с Google Fonts', () => {
  const g = site({ fonts: 'web', fontPair: 'Cormorant Garamond', textEffect: 'fade-words' });
  const t = g.concept.visualSystem.typography;
  assert.equal(t.pair, 'Cormorant Garamond + Montserrat');
  assert.match(g.html, /family=Cormorant\+Garamond:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Marck\+Script:wght@400&display=swap/);
  assert.match(g.html, /--ds-font-accent:"Marck Script", cursive;/);
});

test('пара с одним весом задаёт вес заголовков 400', () => {
  const g = site({ fonts: 'web', fontPair: 'Prata' });
  assert.equal(g.concept.visualSystem.typography.weight, 400);
  assert.match(g.html, /--u-dw:400;/);
});

test('без Google Fonts пары не подключаются и внешних запросов нет', () => {
  const g = site({ fontPair: 'Prata' });
  assert.equal(g.concept.visualSystem.typography.pair, '');
  assert.doesNotMatch(g.html, /fonts\.googleapis/);
});

test('выбор эффекта и пары сохраняется в экспорте', () => {
  const e = exportProject(normalizeProject({ niche: 'кафе', textEffect: 'scroll-fade', fontPair: 'Lora' }));
  assert.equal(e.textEffect, 'scroll-fade');
  assert.equal(e.fontPair, 'Lora');
});
