import test from 'node:test';
import assert from 'node:assert/strict';
import { compareProjectSnapshots, MAX_PROJECT_VERSIONS } from '../studio/project-history.js';

test('project history retains a bounded number of versions per project', () => {
  assert.equal(MAX_PROJECT_VERSIONS, 10);
});

test('project snapshot comparison reports changed copy, structure and asset counts', () => {
  const before = {
    brand: 'Lumen', niche: 'Освещение', title: 'Свет для дома',
    services: [{ title: 'Подбор' }], gallery: [{ src: 'one.webp' }],
    images: { hero: 'hero.webp' },
  };
  const after = {
    brand: 'Lumen', niche: 'Освещение', title: 'Свет, который меняет пространство',
    services: [{ title: 'Подбор' }, { title: 'Монтаж' }],
    gallery: [{ src: 'one.webp' }, { src: 'two.webp' }],
    images: { hero: 'hero.webp', heroMobile: 'mobile.webp' },
  };
  assert.deepEqual(compareProjectSnapshots(before, after), [
    { field: 'Заголовок', before: 'Свет для дома', after: 'Свет, который меняет пространство' },
    { field: 'Услуги / товары', before: '1', after: '2' },
    { field: 'Галерея', before: '1', after: '2' },
    { field: 'Изображения', before: '2', after: '4' },
  ]);
});

test('project snapshot comparison returns no differences for equivalent snapshots', () => {
  const snapshot = { brand: 'Studio', niche: 'Design', title: 'A', services: [], gallery: [], images: {} };
  assert.deepEqual(compareProjectSnapshots(snapshot, { ...snapshot }), []);
});
