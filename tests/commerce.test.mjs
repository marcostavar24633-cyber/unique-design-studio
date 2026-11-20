// Каталог магазина: категории, фильтры, сортировка и корзина-заявка без имитации оплаты.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { generate } from '../src/engine/index.js';
import { autopilot } from '../src/engine/autopilot.js';
import { exportProject, normalizeProject } from '../src/engine/project.js';
import { cartPanel, commerceEnabled, commerceScript, parsePrice } from '../src/engine/commerce.js';

const furniture = (extra = {}) => ({
  id: 'mebel', brand: 'Дом и диван', niche: 'магазин мебели', title: 'Мебель по размерам', cta: 'Подобрать мебель',
  contacts: { email: 'hello@example.com' },
  services: [
    ['Диван «Осло»', 'Трёхместный.', '49 900 ₽', '', '', 'Гостиная'],
    ['Кресло «Берген»', 'Дуб.', '18 500 ₽', '', '', 'Гостиная'],
    ['Кровать «Нордик»', '160×200.', '37 200 ₽', '', '', 'Спальня'],
    ['Матрас «Сон»', 'Пружины.', 'от 21 000 ₽', '', '', 'Спальня'],
  ],
  ...extra,
});

test('цена из строки владельца: «от» и диапазоны не суммируются', () => {
  assert.equal(parsePrice('49 900 ₽'), 49900);
  assert.equal(parsePrice('12 500,50 руб.'), 12500.5);
  assert.equal(parsePrice('от 21 000 ₽'), null);
  assert.equal(parsePrice('3 000 – 5 000 ₽'), null);
  assert.equal(parsePrice('по запросу'), null);
  assert.equal(parsePrice(''), null);
});

test('категория позиции сохраняется при экспорте и повторном импорте', () => {
  const p = normalizeProject(furniture());
  assert.equal(p.services[2].category, 'Спальня');
  const again = normalizeProject(exportProject(p));
  assert.deepEqual(again.services.map(s => s.category), ['Гостиная', 'Гостиная', 'Спальня', 'Спальня']);
});

test('магазин с ценами и категориями получает фильтры, сортировку и корзину-заявку', () => {
  const g = generate(furniture());
  assert.deepEqual(g.concept.visualSystem.commerce, { tools: true, cart: true });
  assert.match(g.html, /data-filter="Гостиная" aria-pressed="false"/);
  assert.match(g.html, /<label class="sort" for="catalog-sort">/);
  assert.match(g.html, /data-category="Спальня" data-price="37200"/);
  assert.match(g.html, /data-add="0" hidden/, 'кнопки скрыты без JS');
  assert.match(g.html, /<aside class="cart" data-cart data-cart-via="email"/);
  assert.match(g.html, /Это заявка, а не оплата/);
  assert.doesNotMatch(g.html, /оплатить|оформить оплату|card number|номер карты/i, 'оплата не имитируется');
  assert.ok(g.audit.ok, g.audit.errors.map(e => e.message).join('; '));
});

test('черновик автопилота без цен: фильтров по ценам и корзины нет', () => {
  const p = autopilot({ niche: 'магазин мебели', email: 'hello@example.com' }, { registry: [] }).project;
  const g = generate(p);
  assert.equal(g.concept.visualSystem.commerce.cart, false);
  assert.doesNotMatch(g.html, /data-cart\b/);
  assert.doesNotMatch(g.html, /data-add=/);
});

test('услуги не превращаются в магазин, а владелец может выключить или включить каталог явно', () => {
  assert.deepEqual(commerceEnabled(normalizeProject({ niche: 'стоматология', services: [['Лечение', '', '3 000 ₽'], ['Чистка', '', '4 000 ₽']] }), 'medical'), { tools: false, cart: false });
  assert.deepEqual(commerceEnabled(normalizeProject(furniture({ commerce: false })), 'furniture'), { tools: false, cart: false });
  assert.equal(commerceEnabled(normalizeProject({ niche: 'юрист', commerce: true, services: [['Консультация', ''], ['Договор', '']] }), 'proservices').cart, true);
});

test('способ отправки — только настроенный владельцем; без контактов корзины нет', () => {
  assert.match(cartPanel(normalizeProject(furniture({ formAction: 'https://forms.example.com/x' }))), /data-cart-via="form"/);
  assert.match(cartPanel(normalizeProject(furniture({ contacts: { phone: '+7 900 000-00-00' } }))), /data-cart-via="phone"[^]*href="tel:\+79000000000"/);
  assert.equal(cartPanel(normalizeProject(furniture({ contacts: {} }))), '');
});

test('скрипт каталога синтаксически корректен и не использует внешние ресурсы', () => {
  const js = commerceScript(normalizeProject(furniture()));
  assert.doesNotThrow(() => new vm.Script(`(function(){${js}})`));
  assert.doesNotMatch(js, /https?:\/\//);
  assert.match(js, /try\{localStorage\.setItem/, 'хранилище — с защитой от ошибок');
  assert.match(js, /Стоимость уточним при подтверждении заявки/);
  assert.match(js, /e\.key==='Escape'/);
});

test('поиск и фильтр категорий применяются совместно, не сбрасывая друг друга', () => {
  const js = commerceScript(normalizeProject(furniture()));
  assert.match(js, /var sf=document\.querySelector\('\[data-search\] input'\)/);
  assert.match(js, /categoryOk=!cat\|\|li\.getAttribute\('data-category'\)===cat/);
  assert.match(js, /searchOk=!q\|\|li\.textContent\.toLowerCase\(\)\.indexOf\(q\)>-1/);
  assert.match(js, /tools\.addEventListener\('uds:catalog-search',apply\)/);
});

test('названия позиций в атрибутах и подписях экранируются', () => {
  const g = generate(furniture({ services: [['Диван "<b>x</b>"', '', '1 000 ₽', '', '', 'Кат"<i>'], ['Кресло', '', '2 000 ₽', '', '', 'Б']] }));
  assert.doesNotMatch(g.html, /<b>x<\/b>|<i>/);
  assert.match(g.html, /aria-label="Добавить «Диван &quot;&lt;b&gt;x&lt;\/b&gt;&quot;» в заявку"/);
});

test('выбор владельца «каталог вкл/выкл» сохраняется в экспорте', () => {
  assert.equal(exportProject(normalizeProject(furniture({ commerce: false }))).commerce, false);
  assert.equal('commerce' in exportProject(normalizeProject(furniture())), false);
});

test('студия: категория позиции редактируется в списке «Позиции» и не теряется', async () => {
  const { readFileSync } = await import('node:fs');
  const js = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.match(js, /Название \| Описание \| Цена \| URL картинки \| ALT-текст \| Категория/);
  assert.match(js, /\[r\.title, r\.text, r\.price, r\.image, r\.alt, r\.category(, r\.badge)?\]/);
});
