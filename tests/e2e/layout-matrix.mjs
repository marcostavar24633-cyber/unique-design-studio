// Проверка раскладки на матрице сгенерированных сайтов: все архитектуры × механики карточек × формы ×
// эффекты текста, с фотографиями (встроенные SVG — без сети), на ширинах 390 / 768 / 1280.
// Ищет перекрытый, обрезанный и выходящий за экран текст и слабый контраст на фактическом фоне.
import { ARCHETYPE_IDS, generate } from '../../src/engine/index.js';
import { MECHANICS } from '../../src/engine/mechanics.js';
import { MASKS } from '../../src/engine/forms.js';
import { LAYOUT_QA_SOURCE } from '../../src/engine/layout-qa.js';
import { CARD_SHAPE_IDS, PHOTO_COMPOSITIONS, REVEAL_IDS } from '../../src/engine/variety.js';
import { BUTTONS } from '../../src/engine/data.js';
import { CINEMATIC_PRESET_IDS } from '../../src/engine/cinematic/visual-layers.js';

// Фото-заглушка нужных пропорций: встроенный SVG, чтобы раскладка была как с настоящими снимками.
const photo = (w, h, hue) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="hsl(${hue} 40% 45%)"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="hsl(${hue} 50% 70%)"/></svg>`);

const base = {
  brand: 'Ханой', niche: 'кафе вьетнамская кухня', city: 'Ульяновск', title: 'Вьетнамская кухня в центре города',
  description: 'Фо, нем и бан ми по семейным рецептам. Готовим при вас из свежих продуктов.', cta: 'Забронировать стол',
  contacts: { email: 'hello@example.com', phone: '+7 900 000-00-00', address: 'ул. Ленина, 1' },
  images: { hero: photo(1600, 900, 20), heroAlt: 'Зал кафе' },
  gallery: [0, 1, 2, 3].map(i => ({ src: photo(800, 1000, 30 + i * 40), alt: `Кадр ${i + 1}` })),
  services: [
    ['Фо Бо', 'Говяжий бульон, рисовая лапша, зелень и лайм', '450 ₽', photo(800, 600, 10)],
    ['Нем', 'Хрустящие спринг-роллы с соусом нуок-чам', '320 ₽', photo(800, 600, 60)],
    ['Бан Ми', 'Багет со свининой, маринованной морковью и кинзой', '380 ₽', photo(800, 600, 110)],
    ['Бун Ча', 'Свинина на гриле, рисовая вермишель и корзина свежей зелени к бульону', '490 ₽', photo(800, 600, 160)],
    ['Вьетнамский кофе', 'Капельный фин со сгущённым молоком', '220 ₽', photo(800, 600, 210)],
  ],
  advantages: [['Свежие травы каждый день', 'Кинза, тайский базилик и мята'], ['Бульон варим 12 часов', 'Как в Ханое'], ['Кухня открытая', 'Готовим при гостях']],
  process: [['Бронь', 'Звонок или заявка'], ['Встреча', 'Стол готов к приходу'], ['Ужин', 'Подаём по готовности']],
  faqs: [['Есть ли вегетарианские блюда?', 'Да, фо с тофу и овощные роллы.']],
};

export function layoutPages() {
  const pages = [];
  const mechs = Object.keys(MECHANICS), masks = Object.keys(MASKS);
  ARCHETYPE_IDS.forEach((arch, i) => {
    const raw = { ...base, id: `qa-${arch}`, architecture: arch, designArchitecture: arch, architectureMode: 'manual',
      itemsMechanic: mechs[i % mechs.length], imageMask: masks[i % masks.length],
      textEffect: i % 2 ? 'fade-words' : 'scroll-fade', fonts: 'system',
      // Фактура и свет (D03): каждая архитектура проверяется со своим пресетом слоёв.
      cinematicLayers: CINEMATIC_PRESET_IDS[i % CINEMATIC_PRESET_IDS.length],
      // Формы карточек, эффекты появления и стили кнопок: каждая архитектура — со своим набором.
      cardShape: CARD_SHAPE_IDS[i % CARD_SHAPE_IDS.length], revealEffect: REVEAL_IDS[(i * 2) % REVEAL_IDS.length], buttonStyle: Object.keys(BUTTONS)[(i * 3) % 15] };
    const g = generate(raw);
    pages.push({ name: `${arch}/${raw.itemsMechanic}/${raw.imageMask}`, html: g.html });
    // Второй проход: тёмная палитра, Google Fonts и другие сочетания механик и форм.
    const dark = { ...raw, id: `qa-dark-${arch}`, brand: 'Ночной Сайгон', niche: 'бар вьетнамской кухни', palette: 'dark',
      itemsMechanic: mechs[(i + 3) % mechs.length], imageMask: masks[(i + 2) % masks.length],
      textEffect: i % 2 ? 'scroll-fade' : 'fade-words', fonts: 'web' };
    pages.push({ name: `тёмная/${arch}/${dark.itemsMechanic}/${dark.imageMask}`, html: generate(dark).html });
  });
  return pages;
}

export function photoCompositionPages() {
  return Object.keys(PHOTO_COMPOSITIONS).map(composition => ({
    name: `фото/${composition}`,
    html: generate({ ...base, id: `qa-photo-${composition}`, photoComposition: composition }).html,
  }));
}

// Самопроверка: на нарочно сломанной странице проверка обязана найти все четыре вида проблем.
export const BROKEN_PAGE = `<!doctype html><html lang="ru"><body style="margin:0;background:#fff;font:16px sans-serif">
<p id="covered" style="margin:40px">Текст под картинкой</p>
<div style="position:absolute;top:30px;left:20px;width:300px;height:60px;background:#c00"></div>
<p id="offscreen" style="position:relative;left:2000px">Текст за экраном</p>
<h2 id="clipped" style="width:80px;overflow:hidden;white-space:nowrap">Очень длинный заголовок</h2>
<p id="contrast" style="color:#bbb">Бледный текст</p>
</body></html>`;

export async function selfCheck(browser) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(BROKEN_PAGE);
  const found = await page.evaluate(`(${LAYOUT_QA_SOURCE})()`);
  await page.close();
  const kinds = new Set(found.map(f => f.kind));
  return ['covered', 'offscreen', 'clipped', 'contrast'].filter(k => !kinds.has(k));
}

/** Прогоняет матрицу и добавляет замечания в failures. Возвращает число прогонов. */
export async function runLayoutMatrix(browser, failures, widths = [390, 768, 1280]) {
  let runs = 0;
  const page = await browser.newPage({ viewport: { width: widths[0], height: 820 } });
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, route => route.abort());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const { name, html } of layoutPages()) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 820 });
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-in')));
      const found = await page.evaluate(`(${LAYOUT_QA_SOURCE})({ limit: 12 })`);
      for (const f of found) failures.push(`раскладка ${name} @${width}: ${f.kind} — ${f.el} «${f.text}» (${f.detail})`);
      runs++;
    }
  }
  // Every photo layout gets an explicit responsive pass; the architecture matrix's seeded layouts
  // cannot guarantee that fan, overlap, and filmstrip are all represented on a given run.
  for (const { name, html } of photoCompositionPages()) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 820 });
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-in')));
      const check = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      if (check.overflow > 1) failures.push(`раскладка ${name} @${width}: горизонтальный выход за экран ${check.overflow}px`);
      const found = await page.evaluate(`(${LAYOUT_QA_SOURCE})({ limit: 12 })`);
      for (const f of found) failures.push(`раскладка ${name} @${width}: ${f.kind} — ${f.el} «${f.text}» (${f.detail})`);
      runs++;
    }
  }
  await page.close();
  // Второй проход — с включённым движением: стеклянные поверхности, наклон, параллакс, эффекты текста
  // действуют только без reduced-motion, и именно они могут ухудшить контраст или наложить блоки.
  const motionPage = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  await motionPage.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, route => route.abort());
  await motionPage.emulateMedia({ reducedMotion: 'no-preference' });
  for (const { name, html } of layoutPages()) {
    await motionPage.setContent(html, { waitUntil: 'load' });
    await motionPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await motionPage.evaluate(() => document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-in')));
    await motionPage.waitForTimeout(1600); // появление первого экрана и блоков завершилось
    const found = await motionPage.evaluate(`(${LAYOUT_QA_SOURCE})({ limit: 12 })`);
    for (const f of found) failures.push(`раскладка ${name} @1280 с движением: ${f.kind} — ${f.el} «${f.text}» (${f.detail})`);
    runs++;
  }
  await motionPage.close();
  return runs;
}

// Скрытое содержимое не должно попадать в замечания: закрытый <details> и content-visibility:hidden.
export const HIDDEN_PAGE = `<!doctype html><html lang="ru"><body style="margin:0;font:16px sans-serif">
<details><summary>Подробнее</summary><p id="in-details">Скрытый текст под картинкой</p></details>
<div style="content-visibility:hidden;height:40px"><p>Ещё скрытый текст</p></div>
<div style="position:absolute;top:0;left:0;width:400px;height:120px;background:#c00;z-index:-1"></div>
</body></html>`;

export async function hiddenCheck(browser) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(HIDDEN_PAGE);
  const found = await page.evaluate(`(${LAYOUT_QA_SOURCE})()`);
  await page.close();
  return found.filter(f => /Скрытый|скрытый/.test(f.text));
}

