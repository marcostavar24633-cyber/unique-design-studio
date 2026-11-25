// Браузерная проверка: все архитектуры × все расположения на ширинах 320 / 768 / 1280.
// Проверяет отсутствие горизонтальной прокрутки, видимость заголовка и CTA, клавиатурный фокус и reduced motion.
// Запуск: npm run test:e2e (нужен Playwright с Chromium: npm i -D playwright && npx playwright install chromium).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { ARCHETYPES, ARCHETYPE_IDS, buildConcept, generate } from '../../src/engine/index.js';
import { examples, full, root } from '../helpers.mjs';
import { hiddenCheck, runLayoutMatrix, selfCheck } from './layout-matrix.mjs';

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { console.error('Playwright не найден. Установите: npm i -D playwright && npx playwright install chromium'); process.exit(1); }

const WIDTHS = [320, 768, 1280];
const pages = [];
for (const id of ARCHETYPE_IDS) for (const placement of Object.keys(ARCHETYPES[id].placements)) {
  for (let i = 0; i < 80; i++) {
    const project = { ...full, brand: `Hair ${i}`, id: `e2e-${id}`, architecture: id, images: {}, gallery: [] };
    if (buildConcept(project).visualSystem.placement === placement) {
      pages.push({ name: `${id}/${placement}`, html: generate(project).html });
      break;
    }
  }
}
let registry = [];
for (const ex of examples) { const r = generate(ex, { registry }); registry = r.registry; pages.push({ name: `пример/${ex.id}`, html: r.html }); }
// Длинные слова и длинный список — стресс-тест переполнения.
pages.push({ name: 'стресс/длинные-слова', html: generate({ ...full, images: {}, gallery: [], brand: 'Достопримечательности', title: 'Высококвалифицированное электрооборудование Сверхпроизводительность', cta: 'Зарегистрироваться на консультацию', architecture: 'brutalist' }).html });

const shots = process.argv.includes('--screenshots');
if (shots) mkdirSync(root + 'tests/e2e/screenshots', { recursive: true });
const browser = await chromium.launch();
const failures = [];
let checks = 0;
const matrixPage = await browser.newPage({ viewport: { width: WIDTHS[0], height: 800 } });
await matrixPage.route(/^https?:\/\//, route => route.abort());
for (const { name, html } of pages) {
  for (const width of WIDTHS) {
    await matrixPage.setViewportSize({ width, height: 800 });
    await matrixPage.setContent(html, { waitUntil: 'load' });
    await matrixPage.evaluate(async () => { if (document.fonts) await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const res = await matrixPage.evaluate(() => {
      const de = document.documentElement;
      const h1 = document.querySelector('h1').getBoundingClientRect();
      const cta = document.querySelector('[data-cta="primary"]');
      const c = cta.getBoundingClientRect();
      const small = [...document.querySelectorAll('a.ds-button, button, .nav__links a, summary')].filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height < 40; }).length;
      const fitOverflow = [...document.querySelectorAll('.uds-fit-text')].map(el => { const range = document.createRange(); range.selectNodeContents(el); const style = getComputedStyle(el); const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight); const border = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth); return { el, text: range.getBoundingClientRect().width, available: el.clientWidth - (padding || 0) - (border || 0) }; }).filter(item => item.available > 2 && item.text > item.available + 2).map(({ el, text, available }) => `${el.tagName}.${String(el.className).replace(/\s+/g, '.')}: ${el.textContent.trim().slice(0, 24)} (${Math.round(text)}/${Math.round(available)})`);
      return { overflow: de.scrollWidth - de.clientWidth, h1ok: h1.width > 0 && h1.left >= 0 && h1.right <= de.clientWidth + 1, ctaOk: c.width > 0 && c.left >= 0 && c.right <= de.clientWidth + 1, small, fitOverflow };
    });
    checks++;
    // Игнорируем единичный субпиксельный край декоративного слоя; видимые элементы проверяются отдельно.
    if (res.overflow > 1) failures.push(`${name} @${width}: горизонтальная прокрутка ${res.overflow}px`);
    if (!res.h1ok) failures.push(`${name} @${width}: заголовок выходит за экран`);
    if (!res.ctaOk) failures.push(`${name} @${width}: CTA выходит за экран`);
    if (res.small) failures.push(`${name} @${width}: интерактивных элементов ниже 40px: ${res.small}`);
    if (res.fitOverflow.length) failures.push(`${name} @${width}: текст не помещается: ${res.fitOverflow.slice(0, 3).join('; ')}`);
    if (width === 320) {
      // Клавиатура: первый Tab — skip-link, дальше фокус должен быть видимым.
      await matrixPage.keyboard.press('Tab');
      const first = await matrixPage.evaluate(() => document.activeElement.className);
      if (first !== 'skip') failures.push(`${name}: первый фокус не на skip-link`);
      await matrixPage.keyboard.press('Tab');
      const outline = await matrixPage.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
      if (outline === 'none') failures.push(`${name}: нет видимого фокуса`);
    }
    if (shots) await matrixPage.screenshot({ path: `${root}tests/e2e/screenshots/${name.replace(/[^\wа-яё-]+/gi, '_')}-${width}.png` });
  }
}
await matrixPage.close();
// Reduced motion: контент остаётся видимым, класс анимации не включается.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route(/^https?:\/\//, route => route.abort());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setContent(generate({ ...full, architecture: 'immersive' }).html, { waitUntil: 'load' });
  if (await page.evaluate(() => document.documentElement.classList.contains('js-reveal'))) failures.push('reduced motion: анимация появления не отключена');
  await page.close(); checks++;
}
// Без JavaScript весь контент виден.
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
  await ctx.route(/^https?:\/\//, route => route.abort());
  const page = await ctx.newPage();
  await page.setContent(generate({ ...full, architecture: 'editorial' }).html, { waitUntil: 'load' });
  const hidden = await page.locator('[data-reveal]').evaluateAll(els => els.filter(el => getComputedStyle(el).opacity !== '1').length);
  if (hidden) failures.push(`без JS скрыто блоков: ${hidden}`);
  await ctx.close(); checks++;
}
// Раскладка в браузере: перекрытый, обрезанный и выходящий за экран текст, контраст на фактическом фоне —
// на матрице архитектур × механик карточек × форм × эффектов текста, светлая и тёмная палитры.
const missed = await selfCheck(browser);
if (missed.length) failures.push(`проверка раскладки не нашла на сломанной странице: ${missed.join(', ')}`);
const falseHidden = await hiddenCheck(browser);
if (falseHidden.length) failures.push(`проверка раскладки ругается на скрытый текст: ${falseHidden.map(f => f.text).join(', ')}`);
const layoutRuns = await runLayoutMatrix(browser, failures);
checks += layoutRuns;
await browser.close();
if (failures.length) { console.error(`Провалено проверок: ${failures.length}\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`Браузерные проверки пройдены: ${pages.length} страниц × ${WIDTHS.length} ширины и ${layoutRuns} прогонов проверки раскладки, всего ${checks}.`);
