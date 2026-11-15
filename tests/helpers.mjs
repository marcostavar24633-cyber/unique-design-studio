import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));
export const readJson = rel => JSON.parse(readFileSync(root + rel, 'utf8'));
export const exampleIndex = readJson('examples/index.json');
export const examples = exampleIndex.map(e => readJson('examples/' + e.file));
export const example = id => examples.find(e => e.id === id);
/** Проект с полным набором контента — для прогона всех архитектур. */
export const full = {
  ...example('hair'),
  services: [['Стрижка', 'Форма', '1 500 ₽'], ['Окрашивание', 'Цвет', 'от 4 000 ₽'], ['Уход', 'Блеск'], ['Укладка', 'На событие']],
  gallery: [{ src: 'https://example.com/a.jpg', alt: 'Работа мастера', caption: 'Каре' }],
  images: { hero: 'https://example.com/hero.jpg', heroAlt: 'Модель с каштановыми волосами' },
  contacts: { phone: '+7 000 000-00-00', email: 'salon@example.com', address: 'Город, улица, дом', hours: '10:00–20:00' },
};
