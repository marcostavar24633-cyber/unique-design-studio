import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('код веб-редактора синтаксически корректен и содержит загрузку фотографий', () => {
  const check = spawnSync(process.execPath, ['--check', 'studio/studio.js'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  for (const marker of [
    "data-upload=\"hero\"",
    "data-upload=\"hero-mobile\"",
    "data-upload=\"gallery-mobile\"",
    "data-upload=\"service-mobile\"",
    "mobileSources?.services",
    "mobileSources?.gallery",
    "gallery-mobile:${i}",
    "Отдельная композиция для телефона",
    "state.raw.images?.heroMobile",
    "data-upload=\"gallery\"",
    "data-upload=\"service\"",
    "image/jpeg,image/png,image/webp,image/gif,image/avif",
    "MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024",
    "MAX_IMAGE_BYTES = 1024 * 1024",
    "MAX_IMAGE_DATA = 3_800_000",
    "MAX_IMAGE_EDGE = 1800",
    "async function optimizeImage(file, maxEdge = MAX_IMAGE_EDGE)",
    "canvasBlob(canvas, 'image/webp', quality)",
    "image/webp",
    "data-remove-image",
    "FileReader",
    "createImageBitmap(file)",
    "let imageAuditRun = 0",
    "function collectImageAssets()",
    "function hammingDistance(a, b)",
    "visualHash",
    "Локальное сравнение обнаружило",
    "Похожие кадры — проверьте разнообразие",
    "внешние URL не анализируются по пикселям",
    "различие hash: ${distance}/64",
    "function inspectImage(asset)",
    "async function renderImageIntelligence()",
    "Проверяем разрешение, пропорции, яркость и детализацию",
    "image-audit-warning",
    "image-audit-tip",
    "image-intelligence",
    "function cropEditor(role, index = 0, src = '')",
    "crop-live-previews",
    "crop-live__frame",
    "Предпросмотр показывает обрезку для пропорций экранов",
    'cropEditor("hero", 0, p.images.hero)',
    'cropEditor("gallery", i, g.src)',
    'cropEditor("services", i, src)',
    "function writeCrop(role, index, viewport, axis, value)",
    "data-crop-viewport",
    "Кадрирование для экранов",
    "function buildAssetRecommendations(reports, nearDuplicateCount = 0)",
    "Рекомендации по фотоконтенту",
    "Проверить свободную зону под текст",
    "Расширить фотогалерею",
    "Разнообразить композицию галереи",
    "Добавить фото к позициям",
    "function renderVisualAssetDirector(reports, duplicateCount, nearDuplicateCount, missingRoles, nearDuplicatePairs = [])",
    "Люкс-арт-дирекшн",
    "Премиум-арт-дирекшн",
    "Серия из 4–6 РАЗНЫХ фотографий",
    "roleDirections",
    "каждый кадр должен добавлять новую информацию",
    "data-copy-asset-prompt",
    "Обнаружено",
    "точных повторов",
    "не может подтвердить соответствие сюжета нише",
    "asset-coverage-list",
    "data-hero-alt",
    "data-gallery-alt",
    "data-service-alt",
    "data-copy-asset-prompt",
    "ALT-текст",
    "Image SEO & Accessibility",
    "Performance & Core Web Vitals",
  ]) assert.ok(source.includes(marker), marker);
  assert.match(source, /if \(Array\.isArray\(mobileGallery\)\) mobileGallery\.splice\(idx, 1\)/);
  assert.match(source, /Number\(key\) > idx\) mobileGallery\[Number\(key\) - 1\] = value/);
  assert.match(source, /if \(Array\.isArray\(mobileServices\)\) delete mobileServices\[idx\]/);
});

test('Asset library compares responsive crop frames and opens the matching crop editor', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../studio/studio.css', import.meta.url), 'utf8');
  for (const marker of ['const cropPreview = (item, role, index)', "['desktop','Компьютер','16 / 9']", "['tablet','Планшет','4 / 3']", "['mobile','Телефон','3 / 4']", 'data-open-crop-role', 'data-open-crop-index', 'data-crop-index="${index}"', 'Настроить кадрирование']) assert.ok(source.includes(marker), marker);
  assert.match(css, /\.asset-library__crops\{display:grid/);
  assert.match(css, /\.asset-library__crop-frame img\{display:block;width:100%;height:100%;object-fit:cover\}/);
});

test('Visual asset library summarizes desktop and mobile image variants and links to controls', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../studio/studio.css', import.meta.url), 'utf8');
  for (const marker of ['function renderVisualAssetLibrary()', 'state.raw.images?.heroMobile', 'mobile.gallery?.[index]', 'mobile.services?.[index]', 'data-open-image-settings', 'data-open-image-audit', 'asset-library__stats', 'asset-library__mobile', 'Библиотека изображений', 'Управлять фотографиями', 'Проверить качество фото']) assert.ok(source.includes(marker), marker);
  assert.match(css, /\.asset-library__grid\{display:grid/);
  assert.match(css, /@media\(max-width:560px\)\{\.asset-library\{padding:12px\}/);
});

test('Mobile crop previews remain readable and horizontally scrollable on narrow screens', () => {
  const css = readFileSync(new URL('../studio/studio.css', import.meta.url), 'utf8');
  assert.match(css, /@media\(max-width:520px\)\{\.crop-editor__grid\{grid-template-columns:1fr\}/);
  assert.match(css, /\.crop-live-previews\{grid-template-columns:repeat\(3,minmax\(88px,1fr\)\);overflow-x:auto/);
  assert.match(css, /scroll-snap-type:x proximity/);
  assert.match(css, /\.crop-live\{scroll-snap-align:start\}/);
});

test('Smart Crop preserves valid zero-percent focal points in previews and controls', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.ok(source.includes('function cropCoordinate(value)'));
  assert.ok(source.includes("value !== undefined && value !== null && value !== '' && Number.isFinite(n)"));
  assert.ok(source.includes('const x = cropCoordinate(v.x), y = cropCoordinate(v.y);'));
  assert.ok(source.includes('const n = cropCoordinate(v[axis]);'));
});

test('Smart Crop previews update live when focal point sliders move', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.ok(source.includes('data-crop-preview-role='));
  assert.ok(source.includes('data-crop-preview-index='));
  assert.ok(source.includes('data-crop-preview-viewport='));
  assert.ok(source.includes("const preview = editor?.querySelector("));
  assert.ok(source.includes("preview.style.objectPosition = x + '%' + ' ' + y + '%'") || source.includes("preview.style.objectPosition = x + '% ' + y + '%'"));
  assert.ok(source.includes("writeCrop(role, index, viewport, axis, t.value)"));
});

test('Photo Art Direction creates a detailed niche-aware shot list', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  for (const marker of ['function buildPhotoShotList(niche, tier)','function formatPhotoShotList(shots)','PHOTO ART DIRECTION — ПЛАН ФОТОСЪЁМКИ','Контекст и пространство','Процесс / работа','Макродеталь / фактура','Мобильный вертикальный кадр','Скопировать весь план фотосъёмки','data-copy-photo-shotlist','не инсценировать несуществующие действия','От 2400 × 1350 px']) assert.ok(source.includes(marker), marker);
});

test('Smart Image Matching ranks image candidates using role-specific technical signals', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  for (const marker of ['function scoreAssetForRole(report, role)','function buildSmartImageMatches(reports)','Smart Image Matching — подбор по техническим параметрам','Хорошее техническое соответствие','пропорциям, разрешению, средней яркости и локальной детализации','содержание и композицию проверяйте глазами']) assert.ok(source.includes(marker), marker);
  assert.ok(source.includes("role === 'hero'"));
  assert.ok(source.includes("role === 'gallery'"));
  assert.ok(source.includes("role === 'service'"));
});

test('Hero Readability QA measures actual preview at three responsive widths', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  for (const marker of ['function parseRgb(color)','function relativeLuminance(rgb)','function contrastRatio(a,b)','function auditHeroReadability()','width:320,label:\'Телефон 320 px\'','width:768,label:\'Планшет 768 px\'','width:1280,label:\'Компьютер 1280 px\'','data-run-hero-readability','hero-readability-results','Контраст текста кнопки ниже 4.5:1']) assert.ok(source.includes(marker), marker);
});

test('Hero image QA checks loading, intrinsic resolution, ALT and loading priority', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  for (const marker of ['doc.querySelectorAll(\'.hero img\')','img.complete','img.naturalWidth === 0','img.naturalWidth','img.hasAttribute(\'alt\')','img.getAttribute(\'loading\') === \'lazy\'','img.getAttribute(\'fetchpriority\') !== \'high\'','Hero без фотографии','возможно недостаточно разрешения']) assert.ok(source.includes(marker), marker);
});

test('Hero image resolution is checked independently at each responsive viewport', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const start = source.indexOf('function auditHeroReadability()');
  const end = source.indexOf('function renderHeroReadabilityChecks()', start);
  const audit = source.slice(start, end);
  assert.ok(audit.includes('heroImages.forEach((img,index) => {'));
  assert.ok(audit.includes("title:viewport.label + ': ' + label + ' — возможно недостаточно разрешения'"));
  assert.ok(audit.indexOf("frame.style.width = viewport.width + 'px'") < audit.indexOf('img.getBoundingClientRect()'));
});

test('Hero Readability QA restores preview sizing after responsive checks', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.match(source, /finally\s*\{\s*frame\.style\.width = originalWidth;\s*frame\.style\.height = originalHeight;/);
});

test('Responsive Layout and Accessibility QA checks overflow, overlaps and accessible controls', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  for (const marker of ['function auditResponsiveLayoutAndAccessibility()','width:320,label:\'Телефон 320 px\'','width:375,label:\'Телефон 375 px\'','width:768,label:\'Планшет 768 px\'','горизонтальная прокрутка','элементы без доступного имени','маленькие интерактивные области','пересечение интерактивных элементов','поля без подписи','data-run-responsive-a11y','responsive-a11y-results']) assert.ok(source.includes(marker), marker);
});

test('Responsive QA restores preview dimensions after testing each viewport', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const start = source.indexOf('function auditResponsiveLayoutAndAccessibility()');
  const end = source.indexOf('function renderResponsiveAccessibilityChecks()', start);
  const audit = source.slice(start, end);
  assert.ok(audit.includes('finally {'));
  assert.ok(audit.includes('frame.style.width = originalWidth;'));
  assert.ok(audit.includes('frame.style.height = originalHeight;'));
  assert.ok(audit.includes('frame.style.maxWidth = originalMaxWidth;'));
});

test('Site Content & Interaction QA checks images, links, CTAs and forms in the preview', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  for (const marker of ['function auditSiteContentAndInteractions()','function renderSiteContentInteractionChecks()','data-run-site-content-qa','site-content-qa-results','naturalWidth===0','Пустые или небезопасные ссылки','Внешние адреса требуют проверки','доставка не подтверждена','поля без подписи','aria-disabled']) assert.ok(source.includes(marker), marker);
});


test('Gallery reordering controls are available and preserve image art direction variants', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  for (const marker of [
    'data-move-gallery=',
    'data-direction="-1"',
    'data-direction="1"',
    'Переместить фото выше',
    'Переместить фото ниже',
    'function swapIndexedEntries(bucket, from, to)',
    'function moveGalleryImage(from, direction)',
    'swapIndexedEntries(art.gallery, from, to)',
    'swapIndexedEntries(mobile, from, to)',
    "moveGalleryImage(Number(move.dataset.moveGallery), Number(move.dataset.direction))",
    'Порядок фотографий обновлён'
  ]) assert.ok(source.includes(marker), marker);
});


test('Gallery supports drag-and-drop ordering and shifts associated indexed variants', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../studio/studio.css', import.meta.url), 'utf8');
  for (const marker of [
    'draggable="true" data-gallery-item=',
    "addEventListener('dragstart'",
    "addEventListener('dragover'",
    "addEventListener('drop'",
    "addEventListener('dragend'",
    'function reorderIndexedEntries(bucket, from, to)',
    'function reorderGalleryImage(from, to)',
    'reorderIndexedEntries(art.gallery, from, to)',
    'reorderIndexedEntries(art.mobileSources?.gallery, from, to)',
    'reorderGalleryImage(from, target)'
  ]) assert.ok(source.includes(marker), marker);
  assert.match(css, /\.is-dragging/);
  assert.match(css, /\.is-drop-target/);
});


test('Gallery supports primary image selection and accessible fullscreen preview', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../studio/studio.css', import.meta.url), 'utf8');
  for (const marker of [
    'data-gallery-primary=',
    'Сделать главным',
    'gallery-primary-badge',
    'data-preview-gallery=',
    'Просмотр',
    'function openGalleryLightbox(index)',
    'function closeGalleryLightbox()',
    'function renderGalleryLightbox()',
    'aria-modal',
    'ArrowLeft',
    'ArrowRight',
    'reorderGalleryImage(Number(primary.dataset.galleryPrimary), 0)'
  ]) assert.ok(source.includes(marker), marker);
  assert.match(css, /\.gallery-lightbox/);
  assert.match(css, /\.gallery-primary-badge/);
});

test('Visual asset library applies the saved mobile focal point to a separate mobile photo', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const start = source.indexOf('const cropPreview = (item, role, index) => {');
  const end = source.indexOf('return `<section class="asset-library"', start);
  const cropPreview = source.slice(start, end);
  assert.ok(cropPreview.includes("const src = viewport === 'mobile' && item.phone ? item.phone : item.desktop;"));
  assert.ok(cropPreview.includes("const position = cropCoordinate(focal.x) + '% ' + cropCoordinate(focal.y) + '%';"));
  assert.ok(!cropPreview.includes("? '50% 50%'"));
});

test('Opening a crop editor reveals collapsed settings and updates the toggle state', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  // Логика вынесена в openPhotoGroup(): её используют «Настроить кадрирование» и «Управлять фотографиями».
  const helper = source.slice(source.indexOf('function openPhotoGroup()'), source.indexOf('const GROUPS = ['));
  assert.ok(helper.includes("document.body.classList.contains('workspace-settings-collapsed')"));
  assert.ok(helper.includes("document.body.classList.remove('workspace-settings-collapsed')"));
  assert.ok(helper.includes("toggle.setAttribute('aria-expanded', 'true')"));
  assert.ok(helper.includes("toggle.textContent = 'Скрыть настройки'"));
  assert.ok(helper.indexOf("classList.remove('workspace-settings-collapsed')") < helper.indexOf('group.open = true'));
  assert.ok(helper.includes('=== PHOTO_GROUP'), 'группа ищется по тому же названию, что и в GROUPS');
  assert.ok(source.includes('[PHOTO_GROUP, false, ['), 'группа фотографий в GROUPS использует ту же константу');
  const start = source.indexOf("$('#view-concept').addEventListener('click', e => {");
  const handler = source.slice(start, source.indexOf("$('#form').addEventListener('submit'", start));
  assert.equal(handler.split('openPhotoGroup()').length - 1, 2, 'обе кнопки используют общий помощник');
  assert.ok(!source.includes("=== 'Изображения')"), 'группы «Изображения» в форме нет');
});

test('AI Image Director handlers are delegated from the audit view that renders its controls', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.ok(source.includes("$('#view-audit').addEventListener('input', e => {"));
  assert.ok(source.includes("$('#view-audit').addEventListener('click', async e => {"));
  assert.ok(!source.includes("$('#view-concept').addEventListener('input', e => {"));
  // Кнопки AI Image Director рисуются в «Проверке», поэтому их обработчик не должен жить в «Концепции».
  const concept = source.slice(source.indexOf("$('#view-concept').addEventListener('click', e => {"));
  assert.ok(!concept.slice(0, concept.indexOf('\n});')).includes('data-image-director'));
});

test('Asset library buttons in the concept view keep a click handler there', () => {
  // Библиотека изображений рисуется во вкладке «Концепция» (renderConcept → renderVisualAssetLibrary):
  // без обработчика на #view-concept кнопки «Управлять фотографиями» и «Проверить фото» ничего не делают.
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const render = source.slice(source.indexOf('function renderConcept()'));
  assert.ok(render.slice(0, render.indexOf('\n}\n')).includes('${renderVisualAssetLibrary()}'));
  const start = source.indexOf("$('#view-concept').addEventListener('click', e => {");
  assert.ok(start > 0, 'обработчик кликов вкладки «Концепция»');
  const handler = source.slice(start, source.indexOf('\n});', start));
  for (const marker of ['[data-open-image-settings]', '[data-open-image-audit]', '[data-open-crop-role]']) assert.ok(handler.includes(marker), marker);
});

test('AI Image Director package uses actual newline separators', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const start = source.indexOf('function imageDirectorPackage()');
  const end = source.indexOf('\n}', start);
  const body = source.slice(start, end);
  assert.ok(body.includes(".join('\\n')"));
  assert.ok(body.includes("card.innerText + '\\n' + additions"));
  assert.ok(body.includes(".join('\\n\\n'"));
  assert.ok(!body.includes(".join('\\\\n')"));
});

test('AI Image Director brief edits refresh exported JSON before save or export', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const start = source.indexOf("$('#view-audit').addEventListener('input', e => {");
  const end = source.indexOf('\n});', start);
  const handler = source.slice(start, end);
  assert.ok(handler.includes('root.brief[field.dataset.imageBrief] = field.value;'));
  assert.ok(handler.includes('result.exported = exportProject(state.raw, result.concept);'));
  assert.ok(handler.indexOf('result.exported = exportProject') < handler.indexOf('persist();'));
});

test('Studio stylesheet URL is versioned to refresh mobile navigation styles in cached browsers', () => {
  const html = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('href="studio.css?v=mobile-workspace-controls-20261117"'));
});

test('Mobile workspace tabs and preview controls wrap without horizontal clipping', () => {
  const css = readFileSync(new URL('../studio/studio.css', import.meta.url), 'utf8');
  const start = css.indexOf('/* Mobile-first workspace controls */');
  const end = css.indexOf('/* Visual asset library */', start);
  const mobile = css.slice(start, end);
  assert.ok(mobile.includes('.tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))'));
  assert.ok(mobile.includes('.tabs button{min-width:0;max-width:100%'));
  assert.ok(mobile.includes('.sizes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert.ok(mobile.includes('#toggle-settings{grid-column:1/-1}'));
  assert.ok(!mobile.includes('.sizes{width:100%;flex-wrap:nowrap;overflow-x:auto'));
});

test('Mobile dashboard navigation is compact behind an accessible expandable menu', () => {
  const html = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../studio/studio.css', import.meta.url), 'utf8');
  assert.ok(html.includes('id="dash-menu-toggle" aria-expanded="false" aria-controls="dash-nav"'));
  assert.ok(html.includes('class="dash-nav" id="dash-nav"'));
  assert.ok(js.includes("e.target.closest('#dash-menu-toggle')"));
  assert.ok(js.includes("menuToggle.setAttribute('aria-expanded', String(expanded))"));
  assert.ok(css.includes('.dash-sidebar.is-menu-open .dash-nav{display:grid}'));
});

test('Expanded mobile dashboard navigation uses a two-column grid without horizontal clipping', () => {
  const css = readFileSync(new URL('../studio/studio.css', import.meta.url), 'utf8');
  const mobile = css.slice(css.indexOf('@media(max-width:760px){body.dashboard-mode'), css.indexOf('@media(max-width:420px){.dash-projects'));
  assert.ok(mobile.includes('.dash-nav{display:none;grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert.ok(mobile.includes('.dash-sidebar.is-menu-open .dash-nav{display:grid}'));
  assert.ok(mobile.includes('.dash-nav button,.dash-nav-link{min-width:0'));
  assert.ok(!mobile.includes('.dash-nav{display:flex;overflow:auto'));
});
test('AI generation copy does not claim web research when the Worker has no search tool', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
  const docs = readFileSync(new URL('../docs/cloudflare-workers-ai.md', import.meta.url), 'utf8');
  assert.ok(source.includes('AI формирует тексты и структуру проекта по вашему брифу'));
  assert.ok(source.includes('Готово: AI сформировал тексты и структуру проекта по вашему брифу.'));
  assert.ok(!source.includes('AI изучает нишу в интернете'));
  assert.ok(!source.includes('Готово: AI изучил нишу'));
  assert.ok(html.includes('AI-генерация по брифу'));
  assert.ok(!html.includes('Исследовать нишу в интернете'));
  assert.ok(docs.includes('«AI-генерация по брифу»'));
  assert.ok(!docs.includes('«Исследовать нишу в интернете (AI)»'));
});

test('журнал AI-операций: тексты и каждое фото, токены только из ответа, ориентир лимита помечен', () => {
  const js = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert.match(js, /logAi\(\{ kind: 'text', label: 'Тексты сайта: ' \+ input\.niche, status: res\.ok && body\.landing && body\.generation\?\.status === 'completed' \? 'ok' : 'error'/);
  assert.match(js, /tokens: body\.usage\?\.totalTokens \|\| null/);
  assert.match(js, /Частичная генерация:/);
  assert.match(js, /logAi\(\{ kind: 'image', label: 'Фото: ' \+ slot\.label/);
  assert.match(js, /ориентир по документации Cloudflare/);
  assert.match(html, /<h3 id="journal-h">Журнал AI-операций<\/h3><div id="dash-ai-journal"><\/div>/);
  // Вызов отрисовки — после объявления журнала и esc, иначе студия падает при загрузке.
  assert.ok(js.indexOf('\nrenderAiJournal();') > js.indexOf('function renderAiJournal()'));
  assert.ok(js.indexOf('\nrenderAiJournal();') > js.indexOf('const esc ='));
});

test('расход AI: до сброса лимита (00:00 UTC) и за текущую сессию; задание для Worker без расширенного контракта', () => {
  const js = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert.match(html, /<h3 id="budget-h">Расход AI<\/h3><div id="dash-ai-budget"><\/div>/);
  assert.match(js, /u\.search = '\?range=today'/);
  assert.match(js, /Date\.UTC\(now\.getUTCFullYear\(\), now\.getUTCMonth\(\), now\.getUTCDate\(\) \+ 1\)/);
  assert.match(js, /journal\.filter\(e => e\.at >= sessionStart\)/);
  assert.match(js, /timeZone: 'Asia\/Baku'/);
  assert.match(js, /bakuDate\(new Date\(e\.at\)\)/);
  assert.match(js, /эта вкладка/);
  assert.match(js, /Cloudflare с 00:00 UTC/);
  assert.match(js, /До сброса Cloudflare/);
  assert.match(js, /Worker не обновлён \(нужна публикация\)/);
  assert.match(js, /autopilot\(input, \{ registry: registry\(\), forWorker: true \}\)\.prompt/);
  assert.match(js, /До сброса Cloudflare/);
});


test('AI free quota panel warns at 70%, 85%, and 100% using the UTC reset', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.ok(source.includes('pct >= 100'));
  assert.ok(source.includes('pct >= 85'));
  assert.ok(source.includes('pct >= 70'));
  assert.ok(source.includes('data-ai-budget-alert='));
  assert.ok(source.includes('aria-live="polite"'));
  assert.ok(source.includes('платный резервный провайдер отключён'));
  assert.ok(source.includes('00:00 UTC'));
  assert.ok(!source.includes('после 4:00'));
});

test('«Новый сайт» разделён на вкладки: AI-генерация, свои настройки, редактор', () => {
  const html = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  for (const block of ['ai', 'own', 'editor']) {
    assert.ok(html.includes('id="ptab-' + block + '"'), 'нет вкладки ' + block);
    assert.ok(html.includes('id="pblock-' + block + '"'), 'нет блока ' + block);
  }
  // Свой промт, контакты и AI-сервер живут во вкладке «Свои настройки», редактор — отдельно.
  const own = html.slice(html.indexOf('id="pblock-own"'), html.indexOf('id="pblock-editor"'));
  for (const id of ['auto-prompt', 'auto-email', 'auto-phone', 'auto-endpoint', 'ai-connection-check']) assert.ok(own.includes('id="' + id + '"'), id + ' не во вкладке «Свои настройки»');
  const ai = html.slice(html.indexOf('id="pblock-ai"'), html.indexOf('id="pblock-own"'));
  for (const id of ['auto-niche', 'auto-go', 'auto-progress']) assert.ok(ai.includes('id="' + id + '"'), id + ' не во вкладке «AI-генерация»');
  assert.ok(html.slice(html.indexOf('id="pblock-editor"')).includes('<form id="form"'));
  // Вкладки результата не должны переключать вкладки панели (и наоборот).
  assert.ok(js.includes("const tabs = [...document.querySelectorAll('.tabs [role=tab]')]"));
  assert.ok(js.includes("if (section === 'editor' || section === 'settings') showPanelBlock('editor');"));
  assert.ok(js.includes("function openPhotoGroup() {\n  showPanelBlock('editor');"));
});

test('AI Content Director перегенерирует только выбранный раздел, сохраняет остальные поля и поддерживает undo', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../studio/studio.css', import.meta.url), 'utf8');
  for (const marker of [
    'data-regenerate-stage="strategy"', 'data-regenerate-stage="about"',
    'data-regenerate-stage="services"', 'data-regenerate-stage="trust"', 'data-regenerate-stage="seo"',
    'function regenerateProjectStage(stageId)', 'contentStage: stageId',
    'existingLanding: projectContentForStage()', 'Object.assign(state.raw, patch)',
    'const CONTENT_HISTORY_KEY', 'data-content-undo', 'Последняя AI-правка отменена.',
    'STAGE_PROJECT_FIELDS', 'content-regenerate-status',
  ]) assert.ok(source.includes(marker), marker);
  assert.match(source, /for \(const key of fields\) if \(Object\.prototype\.hasOwnProperty\.call\(payload\.content, key\)\) patch\[key\] = payload\.content\[key\]/);
  assert.match(css, /\.content-regenerate__actions\{display:flex;flex-wrap:wrap/);
  assert.match(css, /@media\(max-width:600px\)\{\.content-regenerate__actions\{display:grid/);
});


test('AI Content Director exposes Rewrite Expand Shorten for one selected field with undo', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../studio/studio.css', import.meta.url), 'utf8');
  for (const marker of [
    'CONTENT_FIELD_OPTIONS', 'id="content-edit-field"', 'id="content-edit-value"',
    'data-content-edit-action="rewrite"', 'data-content-edit-action="expand"',
    'data-content-edit-action="shorten"', 'async function editProjectField(action)',
    'contentField:field', 'editAction:action', 'currentValue', 'state.raw[field] = payload.value',
    'stageId:\'field\'', 'uds:content-edit-field', 'Отменить последнюю AI-правку',
  ]) assert.ok(source.includes(marker), marker);
  assert.match(source, /const before = \{ \[field\]: Object\.prototype\.hasOwnProperty\.call\(result\.project,field\) \? result\.project\[field\] : null \}/);
  assert.match(css, /\.content-field-editor select,\.content-field-editor textarea\{display:block;width:100%/);
  assert.ok(source.includes("[data-content-quality-review], [data-content-edit-action]"), 'click delegation includes field editor actions');
});


test('AI Content Director запускает безопасную проверку качества и SEO без автоприменения', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../studio/studio.css', import.meta.url), 'utf8');
  for (const marker of [
    'data-content-quality-review', 'async function runContentQualityReview()',
    'contentQualityReview:true', 'project:projectContentForStage()',
    'content-quality-review-result', 'review.score', 'review.findings',
    'review.recommendations', 'Веб-поиск не выполнялся.',
    'Проверка качества завершена. Контент не изменён.',
  ]) assert.ok(source.includes(marker), marker);
  assert.ok(css.includes('.content-quality-review{margin:16px 0'));
});

test('генерация: режим auto, живой прогресс ожидания, сбой одного фото не обрывает остальные', () => {
  const js = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.ok(js.includes("contentEngine: 'auto',"));
  assert.ok(js.includes("'Прошло ' + seconds + ' с · обычно 20–40 с'"));
  assert.ok(js.includes('clearInterval(aiTicker);'));
  assert.ok(js.includes('for (let attempt = 0; attempt < 2; attempt++) {\n      try {\n        response = await fetch(imageEndpoint'));
  assert.ok(js.includes("if (!outcome?.data) { failed++;"));
  assert.ok(js.includes("if (!generated && failed) throw new Error(lastImageError"));
  // Кадры запрашиваются параллельно (FLUX.2 klein ~10–15 с на кадр), а записываются в проект по порядку.
  assert.ok(js.includes('const IMAGE_CONCURRENCY = 1;'));\n  assert.ok(js.includes("response?.status === 429 ? (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 60_000) : 1_500"));
  assert.ok(js.includes('await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, targets.length) }, worker));'));
});

test('автопилот создаёт фото для всех карточек услуг (до 6), а не только для первых двух', () => {
  const js = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.ok(js.includes('const MAX_SERVICE_PHOTOS = 6;'));
  assert.ok(js.includes("slots.filter(slot => slot.role === 'service' && !slot.filled).slice(0, MAX_SERVICE_PHOTOS)"));
  assert.ok(!js.includes("slots.filter(slot => slot.role === 'service').slice(0, 2)"));
});

test('Preview accessibility QA resolves accessible names without trusting entered field values', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const start = source.indexOf('function previewAccessibleName(el, doc)');
  const end = source.indexOf('function auditResponsiveLayoutAndAccessibility()', start);
  const helper = source.slice(start, end);
  assert.ok(start >= 0 && end > start, 'accessible-name helper exists before responsive QA');
  assert.ok(helper.includes('aria-labelledby'), 'supports ID-referenced accessible names');
  assert.ok(helper.includes('aria-label'), 'supports explicit accessible names');
  assert.ok(helper.includes('el.labels'), 'supports native associated labels');
  assert.ok(helper.includes("querySelectorAll?.('img[alt]')"), 'uses image alt text inside controls');
  assert.ok(helper.includes("querySelectorAll?.('svg title')"), 'uses SVG title text inside controls');
  assert.ok(helper.includes("['button','submit','reset'].includes(el.type)"), 'uses value only for button-like inputs');
  assert.ok(!helper.includes('el.value ||'), 'does not mistake entered text for a field label');
  assert.ok(source.includes('const hasName = el => Boolean(previewAccessibleName(el, doc));'));
  assert.ok(source.includes('const nameOf = el => previewAccessibleName(el, doc);'));
});


test('Responsive accessibility QA does not infer missing keyboard focus from the unfocused style', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const start = source.indexOf('function auditResponsiveLayoutAndAccessibility()');
  const end = source.indexOf('function renderResponsiveAccessibilityChecks()', start);
  const audit = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(!audit.includes('focusMissing'));
  assert.ok(!audit.includes('style.outlineStyle === \'none\''));
  assert.ok(audit.includes(':focus-visible'));
  assert.ok(audit.includes('Отсутствие outline в обычном состоянии не считается ошибкой.'));
});

test('44px touch target guidance is reported as a manual recommendation, not an automatic WCAG failure', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const start = source.indexOf('function auditResponsiveLayoutAndAccessibility()');
  const end = source.indexOf('function renderResponsiveAccessibilityChecks()', start);
  const audit = source.slice(start, end);
  assert.ok(audit.includes("results.push({level:'manual',title:size.label + ': маленькие интерактивные области'"));
  assert.ok(audit.includes('рекомендуемого ориентира 44 × 44 px'));
  assert.ok(audit.includes('не само по себе доказательство нарушения WCAG 2.2 AA'));
});


test('Responsive accessibility QA verifies the actual iframe viewport before labeling a breakpoint', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const start = source.indexOf('function auditResponsiveLayoutAndAccessibility()');
  const end = source.indexOf('function renderResponsiveAccessibilityChecks()', start);
  const audit = source.slice(start, end);
  assert.ok(audit.includes("frame.style.maxWidth = 'none';"));
  assert.ok(audit.includes('const viewportWidth = doc.defaultView.innerWidth;'));
  assert.ok(audit.includes('Math.abs(viewportWidth - size.width) > 2'));
  assert.ok(audit.includes('Проверки для этого размера пропущены'));
  assert.ok(!audit.includes('doc.defaultView.innerWidth || size.width'));
});


test('Responsive overlap audit uses a horizontal sweep to avoid comparing separated controls', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  const start = source.indexOf('function auditResponsiveLayoutAndAccessibility()');
  const end = source.indexOf('function renderResponsiveAccessibilityChecks()', start);
  const audit = source.slice(start, end);
  assert.ok(audit.includes('.sort((a,b) => a.rect.left - b.rect.left)'));
  assert.ok(audit.includes('active[i].rect.right <= current.rect.left + 2'));
  assert.ok(audit.includes('intersects(previous.rect,current.rect)'));
  assert.ok(!audit.includes('for (let j=i+1;j<candidates.length;j++)'));
});
