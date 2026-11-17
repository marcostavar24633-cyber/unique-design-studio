// Проверка реальных действий магазина в уже сгенерированной автономной странице.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { generate } from '../../src/engine/index.js';
import { root } from '../helpers.mjs';

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { console.error('Playwright не найден. Установите его перед запуском E2E.'); process.exit(1); }

const source = JSON.parse(readFileSync(root + 'examples/doma-tech.json', 'utf8'));
source.commerce = true;
source.contacts = { phone: '+7 900 000-00-00' };
source.services = [
  { title: 'Холодильник', text: 'Двухкамерная модель', price: '45 000 ₽', category: 'Холодильники' },
  { title: 'Морозильник', text: 'Компактная модель', price: '30 000 ₽', category: 'Холодильники' },
  { title: 'Стиральная машина', text: 'Узкая модель', price: '25 000 ₽', category: 'Стирка' }
];
const { html } = generate(source);
const browser = await chromium.launch();
const page = await browser.newPage({ acceptDownloads: true });
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
try {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await page.setContent(html, { waitUntil: 'load' });
  check(await page.locator('[data-catalog-tools]').isVisible(), 'панель фильтров/сортировки не появилась');
  check(await page.locator('[data-cart]').isVisible().catch(() => false) === false, 'пустая корзина должна быть скрыта');
  check(await page.locator('[data-add]').count() === 3, 'кнопки добавления товаров не активированы');

  await page.click('[data-filter="Стирка"]');
  check(await page.locator('#items .item:visible').count() === 1, 'фильтр категории не отфильтровал каталог');
  await page.click('[data-filter=""]');
  check(await page.locator('#items .item:visible').count() === 3, 'кнопка «Все» не восстановила каталог');

  await page.selectOption('[data-sort]', 'asc');
  const sorted = await page.locator('#items .item h3').allTextContents();
  check(sorted[0] === 'Стиральная машина' && sorted[2] === 'Холодильник', 'сортировка по цене работает неверно');

  await page.locator('[data-add="0"]').click();
  check(await page.locator('[data-cart]').isVisible(), 'корзина не показалась после добавления товара');
  await page.click('[data-cart-toggle]');
  check(await page.locator('[data-cart-toggle]').getAttribute('aria-expanded') === 'true', 'корзина не раскрылась');
  check((await page.locator('[data-cart-count]').textContent()).trim() === '1', 'счётчик корзины не обновился');
  await page.getByRole('button', { name: 'Увеличить количество: Холодильник' }).click();
  check((await page.locator('[data-cart-count]').textContent()).trim() === '2', 'увеличение количества не сработало');
  check((await page.locator('[data-cart-total]').textContent()).includes('90'), 'итоговая сумма не пересчиталась');
  await page.getByRole('button', { name: 'Уменьшить количество: Холодильник' }).click();
  check((await page.locator('[data-cart-count]').textContent()).trim() === '1', 'уменьшение количества не сработало');

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-cart-send]')]);
  check(download.suggestedFilename() === 'order-request.txt', 'fallback отправки списка не скачал TXT');
  await page.click('[data-cart-clear]');
  check(await page.locator('[data-cart]').isHidden(), 'очистка не скрыла пустую корзину');
} finally {
  await browser.close();
}
if (failures.length) { console.error('Проверка магазина провалена: ' + failures.join('\\n- ')); process.exit(1); }
console.log('Интерактивность магазина пройдена: фильтры, сортировка, корзина, количество, сумма, очистка и TXT fallback.');
