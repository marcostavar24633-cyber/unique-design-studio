import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHtml, findAll, textOf } from '../src/engine/html-lite.js';
import { analyzePage, buildProfile, headingType, stylesheetLinks } from '../src/engine/site-analysis.js';
import { root } from './helpers.mjs';

const html = readFileSync(root + 'tests/fixtures/sample-site.html', 'utf8');
const page = analyzePage({ url: 'https://demo-site.ru/', html });

test('разбор HTML терпим к незакрытым тегам, сущностям и «сырым» элементам', () => {
  const tree = parseHtml('<ul><li>Один<li>Два &amp; три</ul><script>if (a < b) { x = "</div>"; }</script><p>После<br>скрипта');
  assert.deepEqual(findAll(tree, 'li').map(textOf), ['Один', 'Два & три']);
  assert.equal(findAll(tree, 'div').length, 0, 'содержимое script не разбирается как разметка');
  assert.equal(textOf(findAll(tree, 'p')[0]), 'После скрипта');
  assert.doesNotThrow(() => parseHtml('<div><span>обрыв'));
  assert.doesNotThrow(() => analyzePage({ html: '' }));
});

test('структура: блоки, навигация, карточки, формы, CTA и функциональные элементы', () => {
  const s = page.structure;
  assert.deepEqual(s.order, ['hero', 'items', 'advantages', 'process', 'reviews', 'faq', 'contact']);
  assert.equal(s.nav.items, 5);
  assert.ok(s.nav.burger && s.nav.anchors === 5 && s.nav.cta === 'Обсудить проект');
  const catalog = s.cards.find(c => c.block === 'items');
  assert.equal(catalog.count, 3);
  assert.equal(catalog.kind, 'товарная карточка');
  assert.ok(catalog.parts.includes('цена') && catalog.parts.includes('изображение'));
  assert.deepEqual(s.forms.map(f => f.fields), [['имя', 'телефон', 'сообщение']]);
  assert.equal(s.forms[0].required, 2);
  assert.ok(s.cta.some(c => c.kind === 'якорь на блок страницы') && s.cta.some(c => c.kind === 'отправка формы'));
  for (const f of ['слайдер / карусель', 'аккордеон', 'онлайн-чат', 'кликабельный телефон', 'ссылки в мессенджеры']) assert.ok(s.features.includes(f), f);
});

test('визуальная система читается из стилей: палитра, контраст, шрифты, сетка, отступы, радиусы', () => {
  const v = page.visual;
  assert.equal(v.available, true);
  assert.equal(v.background, '#f6f1e8');
  assert.equal(v.text, '#1d1a16');
  assert.equal(v.accent, '#b4552d', 'акцент определяется через var(--accent) у кнопок и ссылок');
  assert.equal(v.mode, 'light');
  assert.ok(v.contrast.textOnBackground > 12);
  assert.equal(v.headingFont.family, 'Playfair Display');
  assert.equal(v.bodyFont.family, 'Inter');
  assert.deepEqual(v.googleFonts, ['Playfair Display', 'Inter']);
  assert.match(v.sizes.h1, /^clamp\(/);
  assert.deepEqual(v.layout.breakpoints, [480, 760]);
  assert.equal(v.layout.approach, 'desktop-first');
  assert.deepEqual(v.layout.containers, [1180]);
  assert.equal(v.spacing.unit, 8);
  assert.equal(v.radii.shape, 'soft');
  assert.equal(v.stickyHeader, true);
});

test('UX и контент: реальные проверки, а не общие слова', () => {
  assert.ok(page.ux.issues.some(i => /без атрибута alt: 1 из 4/.test(i)));
  assert.ok(page.ux.issues.some(i => /поля без подписи/.test(i)));
  assert.equal(page.ux.firstCtaIndex, 0);
  assert.deepEqual(page.ux.contacts, ['телефон', 'мессенджеры', 'форма', 'чат']);
  assert.deepEqual(page.content.headings.levels, [1, 6, 6]);
  assert.equal(page.content.primaryCta.label, 'обсудить проект');
  assert.equal(headingType('Сколько стоит замер?'), 'вопрос');
  assert.equal(headingType('Закажите проект'), 'призыв');
  assert.equal(headingType('Гарантия 5 лет'), 'с цифрой');
});

test('честность: без стилей визуальная система не выдумывается, пустые и закрытые страницы помечаются', () => {
  const bare = analyzePage({ url: 'https://a.ru/', html: '<html><head><link rel="stylesheet" href="/s.css"></head><body><main><section><h1>Заголовок страницы</h1><p>Текст первого экрана без стилей.</p></section></main></body></html>' });
  assert.equal(bare.visual.available, false);
  assert.ok(bare.warnings.some(w => /таблицы стилей не получены/.test(w)));
  const { profile } = buildProfile([bare]);
  assert.equal(profile.palette, undefined, 'палитра не заполняется без данных');
  assert.equal(profile.typography, undefined);

  const spa = analyzePage({ html: '<html><body><div id="root"></div><script src="/app.js"></script></body></html>' });
  assert.equal(spa.rendering, 'js-app');
  assert.ok(spa.warnings.some(w => /JavaScript/.test(w)));

  const captcha = analyzePage({ html: '<html><body><div class="cf-challenge">Checking your browser</div></body></html>' });
  assert.ok(captcha.warnings.some(w => /не обходит/.test(w)));
});

test('разметка из сниппета студии считается со стилями; ссылки на стили собираются без шрифтовых сервисов', () => {
  const collected = analyzePage({ url: 'https://demo-site.ru/', html: html + '<style data-uds-collected data-uds-skipped="0">.x{color:#333}</style>' });
  assert.ok(!collected.warnings.some(w => /таблицы стилей/.test(w)));
  assert.deepEqual(stylesheetLinks(html, 'https://demo-site.ru/page'), ['https://demo-site.ru/assets/main.css']);
});

test('профиль: все группы заполнены строками, признаки для генератора корректны, несколько страниц сводятся', () => {
  const second = analyzePage({ url: 'https://demo-site.ru/catalog', html: '<html lang="ru"><body><main><section><h1>Каталог</h1><p>Все позиции мастерской в одном месте.</p></section></main></body></html>' });
  const { profile, traits } = buildProfile([page, second]);
  assert.equal(profile.pageStructure.length, 2);
  assert.match(profile.pageStructure[1], /^\/catalog/);
  for (const key of ['blocks', 'navigation', 'cards', 'forms', 'cta', 'features', 'contrast', 'typography', 'headingSizes', 'composition', 'grid', 'spacing', 'radii', 'hierarchy', 'userPath', 'actions', 'navUx', 'mobile', 'issues', 'headingTypes', 'benefits', 'offer', 'cardTypes', 'ctaLogic', 'ideas']) {
    assert.ok(Array.isArray(profile[key]) && profile[key].length && profile[key].every(x => typeof x === 'string' && x), key);
  }
  assert.deepEqual(profile.palette.slice(0, 3), [{ hex: '#f6f1e8', role: 'фон' }, { hex: '#1d1a16', role: 'текст' }, { hex: '#b4552d', role: 'акцент' }]);
  assert.deepEqual(traits.sectionOrder, ['items', 'advantages', 'process', 'faq', 'contact']);
  assert.equal(traits.archetypes[0], 'product-first');
  assert.equal(traits.shape, 'soft');
  assert.equal(traits.typeCharacter, 'didone-contrast');
});

test('анализ большого документа укладывается в разумное время', () => {
  const big = html.replace('</main>', '<section><h2>Блок страницы</h2><p>Текст блока для проверки скорости.</p></section>'.repeat(3000) + '</main>');
  const t = Date.now();
  const a = analyzePage({ html: big });
  assert.ok(a.structure.blocks.length > 3000);
  assert.ok(Date.now() - t < 4000, `медленно: ${Date.now() - t} мс`);
});
