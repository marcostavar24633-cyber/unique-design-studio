// End-to-end проверка основного пользовательского цикла студии:
// генерация → сохранение в реестр → перезагрузка → повторное открытие → экспорт JSON/HTML.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { root } from '../helpers.mjs';

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { console.error('Playwright не найден. Установите его перед запуском E2E.'); process.exit(1); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = normalize(pathname).replace(/^[/\\]+/, '');
  const file = join(root, relative);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/studio/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('#examples option').length > 1);

  // Открываем автопилот и создаём уникальный тестовый проект без обращения к внешнему AI.
  await page.click('#dashboard [data-dash="create"]');
  await page.fill('#auto-niche', 'Тестовая студия интерьерного света');
  await page.fill('#auto-brand', 'LUMEN E2E');
  await page.click('#auto-go');
  await page.waitForFunction(() => document.querySelector('#auto-status').textContent.includes('Готово'), null, { timeout: 20000 });
  check((await page.locator('#frame').getAttribute('srcdoc')).includes('LUMEN E2E'), 'генератор не сформировал предпросмотр с тестовым брендом');

  // Проверяем вкладки результата, размеры предпросмотра и сворачивание панели.
  for (const tab of ['spec', 'concept', 'audit', 'production', 'registry', 'preview']) {
    await page.click('#tab-' + tab);
    check(await page.locator('#view-' + tab).isVisible(), 'вкладка «' + tab + '» не открылась');
  }
  for (const width of ['390', '768', '1280', '']) {
    await page.click('.sizes button[data-w="' + width + '"]');
    const actualWidth = await page.locator('#frame').evaluate(node => node.style.width);
    check(actualWidth === (width ? width + 'px' : '100%'), 'режим ширины ' + (width || 'full') + ' не применился');
  }
  await page.click('#toggle-settings');
  check(await page.locator('#toggle-settings').getAttribute('aria-expanded') === 'false', 'панель настроек не скрылась');
  await page.click('#toggle-settings');
  check(await page.locator('#toggle-settings').getAttribute('aria-expanded') === 'true', 'панель настроек не раскрылась');
  await page.click('#tab-preview');

  // Упрощённая навигация ведёт в объединённые рабочие разделы.
  check(await page.locator('#dash-nav [data-dash]').count() === 8, 'главное меню не сокращено до основных разделов');
  check(await page.locator('#dash-nav').textContent().then(t => t.includes('Дизайн и визуал') && t.includes('Проверка и выпуск')), 'объединённые разделы не отображаются');
  await page.click('#dashboard-back');
  await page.click('#dashboard [data-dash="visual"]');
  check(await page.locator('#tab-concept').getAttribute('aria-selected') === 'true', 'раздел «Дизайн и визуал» не открыл концепцию');
  await page.click('#dashboard-back');
  await page.click('#dashboard [data-dash="qa"]');
  check(await page.locator('#tab-production').getAttribute('aria-selected') === 'true', 'раздел «Проверка и выпуск» не открыл производственный конвейер');

  // Навигация «Настройки» должна открывать существующие поля проекта.
  await page.click('#dashboard-back');
  await page.click('#dashboard [data-dash="settings"]');
  check(!await page.locator('body').evaluate(node => node.classList.contains('dashboard-mode')), 'пункт «Настройки» не открыл рабочую область');
  check(await page.locator('#form .group').first().evaluate(node => node.open), 'пункт «Настройки» не раскрыл поля проекта');
  check(await page.locator('#form .group').nth(1).evaluate(node => !node.open), 'второстепенные настройки должны быть свёрнуты по умолчанию');
  check(await page.locator('#form .group').count() === 6, 'настройки не сгруппированы в шесть понятных разделов');
  // Загрузка фото: главное изображение, мобильная версия и галерея должны сохраняться в свои поля.
  const photoGroup = page.locator('#form .group').nth(2);
  await photoGroup.locator('summary').click();
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=', 'base64');
  const testImage = { name: 'test-photo.png', mimeType: 'image/png', buffer: tinyPng };
  await page.locator('[data-upload="hero"]').setInputFiles(testImage);
  await page.waitForFunction(() => document.querySelector('#form .media-preview img'));
  check(await page.locator('#form .media-preview img').count() > 0, 'главное фото не появилось в предпросмотре');
  await page.locator('[data-upload="hero-mobile"]').setInputFiles(testImage);
  await page.waitForFunction(() => document.querySelector('#form .mobile-hero-asset img'));
  check(await page.locator('#form .mobile-hero-asset img').count() > 0, 'мобильное фото первого экрана не сохранилось');
  await page.locator('[data-upload="gallery"]').setInputFiles(testImage);
  await page.waitForFunction(() => document.querySelectorAll('#form [data-gallery-item]').length > 0);
  check(await page.locator('#form [data-gallery-item]').count() > 0, 'фото галереи не появилось');
  await page.locator('[data-upload="gallery-mobile"]').first().setInputFiles(testImage);
  await page.waitForFunction(() => document.querySelector('#form .mobile-hero-asset img'));
  check(await page.locator('#form .mobile-hero-asset img').count() > 0, 'мобильное фото галереи не сохранилось');

  // Кнопки библиотеки изображений во вкладке «Концепция» должны открывать группу «Фотографии»,
  // даже если панель настроек свёрнута. Раньше они искали группу «Изображения», которой нет, и молча не работали.
  const photoGroupState = () => page.evaluate(() => {
    const group = [...document.querySelectorAll('#form .group')].find(g => g.querySelector('summary')?.textContent.trim() === 'Фотографии');
    return { open: Boolean(group?.open), collapsed: document.body.classList.contains('workspace-settings-collapsed') };
  });
  const collapsePhotos = () => page.evaluate(() => {
    const group = [...document.querySelectorAll('#form .group')].find(g => g.querySelector('summary')?.textContent.trim() === 'Фотографии');
    if (group) group.open = false;
    document.querySelectorAll('#form .crop-editor').forEach(d => { d.open = false; });
    if (!document.body.classList.contains('workspace-settings-collapsed')) document.querySelector('#toggle-settings')?.click();
  });
  await collapsePhotos();
  await page.click('#tab-concept');
  await page.locator('[data-open-image-settings]').click();
  let photos = await photoGroupState();
  check(photos.open && !photos.collapsed, `«Управлять фотографиями» не открыла группу фото: ${JSON.stringify(photos)}`);
  await collapsePhotos();
  await page.click('#tab-concept');
  await page.locator('[data-open-crop-role="hero"]').first().click();
  photos = await photoGroupState();
  const cropOpen = await page.evaluate(() => [...document.querySelectorAll('#form .crop-editor')].some(d => d.open && d.querySelector('[data-crop="hero"]')));
  check(photos.open && !photos.collapsed && cropOpen, `«Настроить кадрирование» не открыла редактор кадра: ${JSON.stringify({ ...photos, cropOpen })}`);

  // Проверяем кнопку плана фотосъёмки: она должна выполнять копирование, а не быть декоративной.
  await page.click('#tab-audit');
  await page.waitForSelector('[data-copy-photo-shotlist]');
  await page.locator('[data-copy-photo-shotlist]').click();
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('План фотосъёмки скопирован') || document.querySelector('#toast').textContent.includes('план фотосъёмки скачан'));

  await page.click('#dashboard-back');
  await page.click('#dashboard [data-dash="create"]');

  // Передаём тестовый AI-анализ так же, как пользователь: импортом JSON проекта с __udsAnalysis.
  // Раньше тест писал анализ прямо в localStorage, а отложенное автосохранение студии (220 мс)
  // иногда срабатывало до перезагрузки и затирало запись состоянием из памяти — тест падал случайно.
  const currentRaw = await page.evaluate(() => JSON.parse(localStorage.getItem('uds:studio:v1')).raw);
  const withAnalysis = { ...currentRaw, __udsAnalysis: { data: { source: 'ai', audience: 'Покупатели интерьерного света', segments: [{ name: 'Дизайнеры', need: 'Подбор освещения' }], objections: ['Сложность выбора'], triggers: ['Новый интерьер'], keywords: ['интерьерный свет'], imagePrompts: ['Тёплый свет в интерьере'] } } };
  await page.locator('#file').setInputFiles({ name: 'with-analysis.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(withAnalysis)) });
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Импортирован проект'));
  // Анализ должен попасть в сохранённое состояние и пережить перезагрузку.
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('uds:studio:v1') || '{}').analysis?.data?.source === 'ai');
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('uds:studio:v1') || '{}').analysis?.data?.source === 'ai'), 'AI-анализ потерян после перезагрузки');

  // После перезагрузки открываем рабочую область: кнопки экспорта и сохранения скрыты на главной панели.
  await page.click('#dashboard [data-dash="create"]');

  // Сохраняем проект в реестр, затем возвращаемся на главную панель.
  await page.click('#save');
  await page.click('#dashboard-back');
  await page.waitForFunction(() => document.querySelector('#dash-project-count').textContent === '1');
  check((await page.textContent('#dash-projects')).includes('LUMEN E2E'), 'сохранённый проект не появился на главной панели');

  // Поиск и фильтры главной панели должны находить проект и переключать набор карточек.
  await page.fill('#dash-search', 'LUMEN');
  check((await page.textContent('#dash-projects')).includes('LUMEN E2E'), 'поиск не нашёл сохранённый проект');
  await page.fill('#dash-search', 'несуществующий проект');
  check((await page.textContent('#dash-projects')).includes('Ничего не найдено'), 'пустой результат поиска не показан');
  await page.fill('#dash-search', '');
  await page.click('#dashboard [data-filter="examples"]');
  check(await page.locator('#dash-projects [data-open-example]').count() > 0, 'фильтр примеров не показал проекты');
  await page.click('#dashboard [data-filter="saved"]');
  check(await page.locator('#dash-projects [data-open-project]').count() === 1, 'фильтр реестра показал неверное число проектов');
  await page.click('#dashboard [data-filter="all"]');

  // Перезагрузка должна восстановить проект и реестр из localStorage.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#dash-project-count').textContent === '1');
  check((await page.textContent('#dash-projects')).includes('LUMEN E2E'), 'проект или реестр потерян после перезагрузки');

  // Повторное открытие записи должно вернуть рабочую область с тем же проектом.
  await page.click('#dash-projects [data-open-project="0"]');
  check((await page.locator('#frame').getAttribute('srcdoc')).includes('LUMEN E2E'), 'проект не открылся из реестра');

  // Проверяем скачивание JSON и готового HTML — не только наличие кнопок.
  const [jsonDownload] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const jsonPath = await jsonDownload.path();
  const { readFileSync: readDownloaded } = await import('node:fs');
  const exported = JSON.parse(readDownloaded(jsonPath, 'utf8'));
  check(exported.brand === 'LUMEN E2E' || exported.niche === 'Тестовая студия интерьерного света', 'экспорт JSON не содержит текущий проект');
  check(exported.__udsAnalysis?.data?.segments?.[0]?.name === 'Дизайнеры', 'экспорт JSON потерял AI-анализ аудитории');
  // Импортируем тот же файл и проверяем, что анализ не теряется при повторном экспорте.
  await page.locator('#file').setInputFiles({ name: 'analysis-roundtrip.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Импортирован проект'));
  const [roundtripDownload] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const roundtripPath = await roundtripDownload.path();
  const roundtrip = JSON.parse(readDownloaded(roundtripPath, 'utf8'));
  check(roundtrip.__udsAnalysis?.data?.segments?.[0]?.name === 'Дизайнеры', 'AI-анализ не пережил импорт и повторный экспорт');
  const [htmlDownload] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
  const htmlPath = await htmlDownload.path();
  check(readDownloaded(htmlPath, 'utf8').includes('LUMEN E2E'), 'экспорт HTML не содержит текущий проект');
  check(errors.length === 0, `ошибки браузерного JavaScript: ${errors.join('; ')}`);
  await context.close();
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(`Проверка рабочего цикла провалена: ${failures.length}\\n- ${failures.join('\\n- ')}`); process.exit(1); }
console.log('Рабочий цикл студии пройден: генерация, сохранение, восстановление, повторное открытие, экспорт JSON и HTML.');
