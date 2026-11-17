// Механики карточек: раскрытие, переворот, колода, лента, мозаика — доступно и без JavaScript.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, normalizeProject, exportProject } from '../src/engine/index.js';
import { chooseMechanic, MECHANICS, MECHANIC_CSS, mechanicBody } from '../src/engine/mechanics.js';

const svc = n => Array.from({ length: n }, (_, i) => [`Позиция ${i + 1}`, `Описание позиции номер ${i + 1}`, `${(i + 1) * 100} ₽`, `https://example.com/${i}.jpg`]);
const site = (mech, n = 5, extra = {}) => generate({ niche: 'кафе вьетнамская кухня', brand: 'Ханой', contacts: { email: 'a@b.ru' }, itemsMechanic: mech, services: svc(n), ...extra });

test('каждая механика рендерится, проходит аудит и подключает свои стили', () => {
  for (const mech of Object.keys(MECHANICS).filter(m => m !== 'none')) {
    const g = site(mech);
    assert.equal(g.concept.visualSystem.variants.itemsMechanic, mech);
    assert.match(g.html, new RegExp(`items--mech-${mech}`), mech);
    assert.ok(g.audit.ok, `${mech}: ${g.audit.errors.map(e => e.message).join('; ')}`);
  }
});

test('раскрытие: подробности в <details>, работает без JavaScript и с клавиатуры', () => {
  const g = site('expand');
  assert.match(g.html, /<details class="item__more"><summary>Подробнее<\/summary><p>Описание позиции номер 1<\/p><\/details>/);
  assert.match(g.html, /\.items--mech-expand \.item:has\(\.item__more\[open\]\)\{grid-column:span 2\}/);
});

test('переворот: карточка фокусируемая, движение только для мыши и без reduced-motion', () => {
  const g = site('flip');
  assert.match(g.html, /<li class="item item--flip" id="item-0"[^>]* tabindex="0"/);
  assert.match(g.html, /class="flip__back"><p>Описание позиции номер 1<\/p><p class="price">100 ₽<\/p>/);
  assert.match(MECHANIC_CSS.flip, /@media \(hover:hover\) and \(pointer:fine\) and \(prefers-reduced-motion:no-preference\)/);
  assert.match(MECHANIC_CSS.flip, /\.item--flip:focus-within \.flip__inner\{transform:rotateY\(180deg\)\}/);
});

test('лента: прокручиваемая область с подписью и фокусом, без колонок базовой сетки', () => {
  const g = site('rail');
  assert.match(g.html, /<div class="rail" role="region" aria-label="[^"]+: прокрутите вбок" tabindex="0">/);
  assert.match(MECHANIC_CSS.rail, /grid-template-columns:none/);
});

test('колода: ступенчатый sticky только на широких экранах, одна колонка', () => {
  const g = site('stack');
  assert.match(g.html, /style="--stack-i:2"/);
  assert.match(MECHANIC_CSS.stack, /@media\(min-width:700px\)\{[^}]*position:sticky/);
  assert.match(MECHANIC_CSS.stack, /grid-template-columns:minmax\(0,1fr\)/);
});

test('выбор учитывает данные: без фото нет переворота, мало позиций — без механики', () => {
  const noImages = normalizeProject({ niche: 'юрист', services: [['А', 'текст'], ['Б', 'текст'], ['В', 'текст'], ['Г', 'текст']] });
  for (let seed = 0; seed < 40; seed++) assert.notEqual(chooseMechanic(noImages, 'modular-grid', seed), 'flip');
  assert.equal(chooseMechanic(normalizeProject({ niche: 'юрист', services: [['А', '']] }), 'editorial', 1), 'none');
  const shop = normalizeProject({ niche: 'магазин', services: svc(6).map(r => ({ title: r[0], text: r[1], price: r[2], image: r[3] })) });
  for (let seed = 0; seed < 40; seed++) assert.notEqual(chooseMechanic(shop, 'brutalist', seed, { tools: true }), 'stack', 'колода ломается при фильтрах магазина');
});

test('выбор воспроизводим и разнообразен по архитектурам', () => {
  const p = normalizeProject({ niche: 'кафе', services: svc(6).map(r => ({ title: r[0], text: r[1], image: r[3] })) });
  assert.equal(chooseMechanic(p, 'storytelling', 7), chooseMechanic(p, 'storytelling', 7));
  const seen = new Set();
  for (const arch of ['product-first', 'editorial', 'immersive', 'asymmetric', 'catalog', 'storytelling', 'modular-grid', 'brutalist']) for (let s = 0; s < 6; s++) seen.add(chooseMechanic(p, arch, s));
  assert.ok(seen.size >= 5, [...seen].join(', '));
});

test('ручной выбор механики сохраняется в экспорте проекта', () => {
  const p = normalizeProject({ niche: 'кафе', itemsMechanic: 'masonry', services: svc(5) });
  assert.equal(exportProject(p).itemsMechanic, 'masonry');
});

test('без описания раскрытие и переворот не прячут пустоту', () => {
  assert.doesNotMatch(mechanicBody('expand', { media: '', title: '<h3>А</h3>', text: '', price: '', action: '' }), /details/);
  assert.doesNotMatch(mechanicBody('flip', { media: '<img>', title: '<h3>А</h3>', text: '', price: '', action: '' }), /flip/);
});
