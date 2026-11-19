// Браузерная проверка библиотеки шаблонов: анализ вставленного HTML, анализ через Worker (локальная копия
// обработчика с подменённой сетью), редактор профиля, поиск, дублирование, удаление, импорт/экспорт, адаптивность.
// Запуск: npm run test:e2e
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { handle } from '../../worker/site-fetch.js';
import { root } from '../helpers.mjs';

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { console.error('Playwright не найден. Установите: npm i -D playwright && npx playwright install chromium'); process.exit(1); }

const fixture = readFileSync(root + 'tests/fixtures/sample-site.html', 'utf8');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

// Статический сервер репозитория + маршрут /worker/*, который исполняет настоящий код Worker.
// «Интернет» для Worker подменён: demo-site.ru отдаёт тестовую страницу, closed-site.ru — отказ 403.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = new URL(url);
  if (u.hostname === 'demo-site.ru') {
    if (u.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /private', { headers: { 'Content-Type': 'text/plain' } });
    if (u.pathname === '/assets/main.css') return new Response('.extra{color:#123456;border-radius:8px}', { headers: { 'Content-Type': 'text/css' } });
    return new Response(fixture, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (u.hostname === 'big-site.ru') return u.pathname === '/robots.txt' ? new Response('', { status: 404 }) : new Response(fixture + '<!-- ' + 'x'.repeat(1_600_000) + ' -->', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  if (u.hostname === 'closed-site.ru') return new Response(u.pathname === '/robots.txt' ? '' : 'Forbidden', { status: u.pathname === '/robots.txt' ? 404 : 403 });
  return realFetch(url, init);
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const file = join(root, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
// Worker — на отдельном порту: как и в жизни, это другой origin, и браузер присылает заголовок Origin.
const workerServer = createServer(async (req, res) => {
  const r = await handle(new Request(`https://worker.dev${req.url}`, { method: req.method, headers: req.headers }), {
    ALLOWED_ORIGINS: base,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  });
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text());
});
await new Promise(r => workerServer.listen(0, '127.0.0.1', r));
const workerUrl = `http://127.0.0.1:${workerServer.address().port}`;

const browser = await chromium.launch();
const failures = [];
let checks = 0;
const check = (ok, msg) => { checks++; if (!ok) failures.push(msg); };

try {
  // --- Адаптивность пустой страницы и диалогов ---
  for (const width of [320, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/studio/templates.html`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 0, `@${width}: горизонтальная прокрутка ${overflow}px`);
    check((await page.textContent('#templates')).includes('Библиотека пока пуста'), `@${width}: нет состояния пустой библиотеки`);
    const small = await page.evaluate(() => [...document.querySelectorAll('main button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && r.height < 38; }).length);
    check(small === 0, `@${width}: кнопок ниже 38px: ${small}`);
    await page.fill('#source-url', 'https://demo-site.ru/'); await page.fill('#template-name', 'Ручной профиль');
    await page.check('input[name=mode][value=manual]');
    await page.click('#start');
    await page.waitForSelector('#editor[open]');
    const dlg = await page.evaluate(() => { const r = document.querySelector('#editor').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; });
    check(dlg, `@${width}: редактор не помещается в экран`);
    check(errors.length === 0, `@${width}: ошибки скрипта: ${errors.join('; ')}`);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/studio/templates.html`);

  // --- Проверки формы ---
  await page.click('#start');
  check((await page.textContent('#status')).includes('корректный адрес'), 'нет сообщения о некорректном адресе');
  await page.fill('#source-url', 'https://demo-site.ru/');
  await page.fill('#template-name', 'Мебель — референс');
  await page.selectOption('#template-category', 'Услуги и бизнес');
  await page.dispatchEvent('#source-url', 'change');
  await page.click('#start');
  check((await page.textContent('#status')).includes('Вставьте HTML'), 'анализ без HTML должен быть остановлен с объяснением');

  // --- Анализ вставленного HTML ---
  await page.fill('#html-0', fixture);
  await page.click('#start');
  await page.waitForSelector('#editor[open]');
  check((await page.inputValue('#pf-blocks')).includes('Первый экран'), 'в профиле нет распознанных блоков');
  check((await page.inputValue('#pf-palette')).includes('#f6f1e8'), 'палитра не извлечена из стилей');
  check((await page.inputValue('#pf-typography')).includes('Playfair Display'), 'типографика не извлечена');
  check((await page.textContent('[data-prov="blocks"]')) === 'из анализа', 'нет метки происхождения «из анализа»');
  check((await page.textContent('#editor-body')).includes('Внешние таблицы стилей'), 'нет предупреждения о неполученных внешних стилях');
  await page.fill('#pf-ideas', 'Своя идея: нумерованные главы вместо карточек');
  check((await page.textContent('[data-prov="ideas"]')) === 'вручную', 'правка поля не меняет метку на «вручную»');
  await page.click('#editor-save');
  await page.waitForSelector('#editor:not([open])', { state: 'attached' });
  check(await page.locator('.template').count() === 1, 'профиль не появился в библиотеке');
  check((await page.textContent('.template')).includes('проанализирован'), 'нет статуса «проанализирован»');
  check((await page.textContent('#toast')).includes('сохранён'), 'нет уведомления о сохранении');

  // --- Подробности, редактирование без перезагрузки, дублирование ---
  await page.click('[data-act=view]');
  await page.waitForSelector('#details[open]');
  check((await page.textContent('#details-body')).includes('Своя идея'), 'в подробностях нет отредактированного поля');
  await page.click('[data-dact=edit]');
  await page.waitForSelector('#editor[open]');
  await page.fill('#ed-name', 'Мебель — обновлённый');
  await page.click('#editor-save');
  await page.waitForSelector('#editor:not([open])', { state: 'attached' });
  check((await page.textContent('.template h3')) === 'Мебель — обновлённый', 'название не обновилось без перезагрузки');
  await page.click('[data-act=copy]');
  check(await page.locator('.template').count() === 2, 'дублирование не создало копию');

  // --- Поиск и фильтр ---
  await page.fill('#search', 'копия');
  check(await page.locator('.template').count() === 1, 'поиск не фильтрует карточки');
  await page.fill('#search', 'нет-такого-слова');
  check((await page.textContent('#templates')).includes('Ничего не найдено'), 'нет состояния «ничего не найдено»');
  await page.click('[data-reset-filter]');
  check(await page.locator('.template').count() === 2, 'сброс фильтров не вернул карточки');

  // --- Удаление с подтверждением ---
  await page.locator('[data-act=delete]').first().click();
  await page.waitForSelector('#confirm[open]');
  await page.click('#confirm-no');
  check(await page.locator('.template').count() === 2, 'отмена удаления удалила профиль');
  await page.locator('[data-act=delete]').first().click();
  await page.click('#confirm-yes');
  check(await page.locator('.template').count() === 1, 'подтверждённое удаление не сработало');

  // --- Отменённый повторный анализ не заменяет существующий профиль ---
  const keptName = await page.textContent('.template h3');
  await page.click('[data-act=view]');
  await page.click('[data-dact=reanalyze]');
  await page.fill('#html-0', fixture);
  await page.click('#start');
  await page.waitForSelector('#editor[open]');
  await page.click('#editor [data-close]');
  // Событие close у <dialog> приходит асинхронно — ждём сообщение, а не читаем его сразу.
  const cancelled = await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Повторный анализ отменён'), null, { timeout: 5000 }).then(() => true, () => false);
  check(cancelled, 'нет сообщения об отмене повторного анализа');
  await page.fill('#template-name', 'Совсем другой профиль');
  await page.click('#start');
  await page.waitForSelector('#editor[open]');
  await page.click('#editor-save');
  await page.waitForSelector('#editor:not([open])', { state: 'attached' });
  const names = await page.locator('.template h3').allTextContents();
  check(names.length === 2 && names.includes(keptName) && names.includes('Совсем другой профиль'), `новый профиль заменил старый после отменённого повторного анализа: ${names.join(', ')}`);
  await page.locator('.template', { hasText: 'Совсем другой профиль' }).locator('[data-act=delete]').click();
  await page.click('#confirm-yes');

  // --- Экспорт и импорт, включая формат v1 из PR №36 ---
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-library')]);
  const exported = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  check(exported.version === 2 && exported.templates.length === 1 && exported.templates[0].profile.blocks.length > 0, 'экспорт не содержит профиль');
  const v1 = [{ id: 'old-1', url: 'https://old.example.org', pages: ['https://old.example.org/a'], name: 'Старый формат', category: 'Beauty', notes: 'из PR 36', createdAt: '2026-11-16T10:00:00.000Z', status: 'source-saved' }];
  await page.setInputFiles('#import-file', { name: 'v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, templates: v1 })) });
  await page.waitForFunction(() => document.querySelectorAll('.template').length === 2);
  check((await page.textContent('#templates')).includes('только ссылка'), 'запись формата v1 не импортирована как «только ссылка»');
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{oops') });
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Импорт не выполнен'));
  checks++;

  // --- Анализатор-сервер: честный отказ без подключения, затем настоящий обработчик Worker ---
  await page.check('input[name=mode][value=worker]');
  check((await page.textContent('#worker-note')).includes('не подключён'), 'нет сообщения, что сервер не подключён');
  await page.fill('#source-url', 'https://demo-site.ru/'); await page.fill('#template-name', 'Через сервер');
  await page.click('#start');
  check((await page.textContent('#status')).includes('не подключён'), 'анализ через сервер без адреса должен быть остановлен');
  await page.fill('#worker-endpoint', workerUrl);
  await page.click('#worker-save');
  await page.waitForFunction(() => document.querySelector('#worker-chip').textContent === 'подключён');
  await page.fill('#page-urls', 'https://closed-site.ru/page');
  await page.click('#start');
  await page.waitForSelector('#editor[open]');
  check((await page.inputValue('#pf-palette')).includes('#123456') || (await page.inputValue('#pf-radii')).includes('8px'), 'стили, загруженные через Worker, не учтены');
  check(!(await page.textContent('#editor-body')).includes('Внешние таблицы стилей'), 'при загруженных стилях не должно быть предупреждения');
  const list = await page.textContent('#progress-list');
  check(list.includes('авторизацию') || list.includes('Не получено'), 'закрытая страница должна быть честно помечена как неполученная');
  await page.click('#editor [data-close]');

  // Страница больше лимита сервера → профиль создаётся, но с явным предупреждением о неполных данных.
  await page.fill('#source-url', 'https://big-site.ru/'); await page.fill('#page-urls', ''); await page.fill('#template-name', 'Большая страница');
  await page.click('#start');
  await page.waitForSelector('#editor[open]');
  check((await page.textContent('#editor-body')).includes('получена не целиком'), 'нет предупреждения о неполностью полученной странице');
  await page.click('#editor [data-close]');

  // Сервер получил только отказ → профиль не создаётся.
  await page.fill('#source-url', 'https://closed-site.ru/'); await page.fill('#page-urls', ''); await page.fill('#template-name', 'Закрытый');
  await page.click('#start');
  await page.waitForFunction(() => document.querySelector('#progress-title').textContent === 'Анализ не выполнен');
  check((await page.textContent('#progress-result')).includes('выдуманных данных студия не показывает'), 'нет честного сообщения о невыполненном анализе');
  check(!(await page.locator('#editor[open]').count()), 'редактор не должен открываться без данных');

  // --- Сохранение между перезагрузками ---
  await page.reload();
  check(await page.locator('.template').count() === 2, 'библиотека не сохранилась после перезагрузки');
  check(errors.length === 0, `ошибки скрипта: ${errors.join('; ')}`);
  // --- Генератор студии использует сохранённые профили ---
  await page.evaluate(() => { const k = 'uds:template-library:v1'; const items = JSON.parse(localStorage.getItem(k)); for (const t of items) if (t.profile.blocks.length) { t.category = 'Услуги и бизнес'; t.business = 'мебель на заказ'; } localStorage.setItem(k, JSON.stringify(items)); });
  await page.goto(`${base}/studio/index.html`);
  await page.evaluate(() => document.querySelector('.dash-nav [data-dash=create]').click());
  const shell = await page.evaluate(() => ({ dash: getComputedStyle(document.querySelector('#dashboard')).display, h: document.querySelector('.layout').getBoundingClientRect().height }));
  check(shell.dash === 'none' && shell.h > 400, `рабочая область генератора не открывается (панель: ${shell.dash}, высота: ${Math.round(shell.h)})`);
  check((await page.textContent('#auto-library-h')).includes('Заполненных профилей: 1'), 'автопилот не видит профили библиотеки');
  // Контакты для заявок — во вкладке «Свои настройки», ниша и запуск — во вкладке «AI-генерация».
  await page.click('#ptab-own'); await page.fill('#auto-email', 'hello@example.com');
  await page.click('#ptab-ai'); await page.fill('#auto-niche', 'мебель на заказ');
  await page.click('#auto-go');
  try {
    await page.waitForFunction(() => document.querySelector('#auto-status')?.textContent.includes('Готово'), null, { timeout: 10000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      status: document.querySelector('#auto-status')?.textContent,
      endpoint: document.querySelector('#auto-endpoint')?.value,
      buttonDisabled: document.querySelector('#auto-go')?.disabled,
      formValid: document.querySelector('#auto')?.checkValidity(),
      niche: document.querySelector('#auto-niche')?.value,
    }));
    throw new Error('Автопилот не завершился: ' + JSON.stringify(diagnostic) + '; ошибки страницы: ' + errors.join('; ') + '; ' + error.message);
  }
  check((await page.textContent('#auto-status')).includes('Учтены профили библиотеки'), 'в статусе автопилота нет учтённых профилей');
  await page.click('#tab-concept');
  const conceptText = await page.textContent('#view-concept');
  check(conceptText.includes('Библиотека шаблонов') && conceptText.includes('Чем проект отличается'), 'во вкладке «Концепция» нет блока библиотеки');
  check(conceptText.includes('Концепция') && conceptText.includes('Что учтено'), 'во вкладке «Концепция» нет имени концепции и учтённых факторов');
  check(!conceptText.includes('#b4552d') && !conceptText.includes('Playfair'), 'в концепцию попали цвета или шрифты источника');
  await page.click('#tab-spec');
  check((await page.textContent('#view-spec')).includes('Профили библиотеки шаблонов'), 'в ТЗ нет раздела о профилях библиотеки');
  await page.click('#tab-concept');
  await page.click('#drop-references');
  check(!(await page.textContent('#view-concept')).includes('Чем проект отличается'), 'профили не убираются из проекта');
  await page.selectOption('#auto-library', 'off');
  await page.click('#auto-go');
  await page.waitForFunction(() => !document.querySelector('#auto-go').disabled);
  check(!(await page.textContent('#auto-status')).includes('Учтены профили'), 'режим «не использовать» всё равно применил библиотеку');
  await page.click('#tab-concept');
  check(!(await page.textContent('#view-concept')).includes('Чем проект отличается'), 'самостоятельная генерация содержит блок библиотеки');
  const studioOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(studioOverflow <= 0, `студия: горизонтальная прокрутка ${studioOverflow}px`);
  check(errors.length === 0, `ошибки скрипта студии: ${errors.join('; ')}`);
  if (process.argv.includes('--screenshots')) await page.screenshot({ path: `${root}tests/e2e/screenshots/templates-1280.png`, fullPage: true });
  await page.close();
} finally {
  await browser.close();
  server.close(); workerServer.close();
}
console.log(`Библиотека шаблонов: проверок ${checks}, ошибок ${failures.length}`);
if (failures.length) { console.error(failures.map(f => ' ✗ ' + f).join('\n')); process.exit(1); }
