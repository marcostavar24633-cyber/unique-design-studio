import test from 'node:test';
import assert from 'node:assert/strict';
import { runMarketIntelligence } from '../src/engine/market-intelligence.js';

const html = '<html><head><title>Мастерская</title></head><body><header><nav>Главная Каталог Контакты</nav></header><main><section class="hero"><h1>Мебель на заказ</h1><p>Проектируем и изготавливаем мебель для дома</p></section><section id="services"><h2>Услуги</h2><article><h3>Кухни</h3><p>Кухни по размерам</p></article><article><h3>Шкафы</h3><p>Шкафы по размерам</p></article><article><h3>Столы</h3><p>Столы из дерева</p></article></section></main><footer>Контакты</footer></body></html>';

test('без поискового адаптера движок честно сообщает, что исследование не проводилось', async () => {
  const result = await runMarketIntelligence({ project: { niche: 'мебель' } });
  assert.equal(result.status, 'not_performed');
  assert.deepEqual(result.sources, []);
});

test('ищет конкурентов, проверяет URL, удаляет дубли и анализирует полученные страницы', async () => {
  const result = await runMarketIntelligence({
    project: { niche: 'мебель на заказ', city: 'Казань' },
    search: async input => {
      assert.match(input.query, /мебель на заказ/);
      return [
        { title: 'Конкурент 1', url: 'https://one.example.org/' },
        { title: 'Дубль', url: 'https://one.example.org/#top' },
        { title: 'Локальный адрес', url: 'http://localhost/admin' },
        { title: 'Конкурент 2', url: 'https://two.example.org/' },
      ];
    },
    fetchPage: async url => ({ html, fetchedAt: '2026-11-18T00:00:00.000Z' }),
  });
  assert.equal(result.status, 'performed');
  assert.equal(result.competitors.length, 2);
  assert.equal(result.sources.length, 2);
  assert.ok(result.competitors.every(item => item.evidence === 'page_analyzed'));
  assert.ok(result.profile && Array.isArray(result.profile.blocks));
});

test('ошибка загрузки не превращает сниппет в анализ сайта', async () => {
  const result = await runMarketIntelligence({
    project: { niche: 'фотограф' },
    search: async () => [{ title: 'Студия', url: 'https://photo.example.org', snippet: 'Портфолио фотографа' }],
    fetchPage: async () => { throw new Error('timeout'); },
  });
  assert.equal(result.status, 'partial');
  assert.equal(result.competitors[0].evidence, 'search_result_only');
  assert.match(result.competitors[0].warning, /timeout/);
});
