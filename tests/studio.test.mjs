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
    "async function optimizeImage(file)",
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

test('AI Image Director handlers are delegated from the audit view that renders its controls', () => {
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.ok(source.includes("$('#view-audit').addEventListener('input', e => {"));
  assert.ok(source.includes("$('#view-audit').addEventListener('click', async e => {"));
  assert.ok(!source.includes("$('#view-concept').addEventListener('input', e => {"));
  assert.ok(!source.includes("$('#view-concept').addEventListener('click', e => {"));
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
