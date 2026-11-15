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
    "function inspectImage(asset)",
    "async function renderImageIntelligence()",
    "Проверяем разрешение, пропорции, яркость и детализацию",
    "image-audit-warning",
    "image-audit-tip",
    "image-intelligence",
    "function cropEditor(role, index = 0)",
    "function writeCrop(role, index, viewport, axis, value)",
    "data-crop-viewport",
    "Кадрирование для экранов",
    "function renderVisualAssetDirector(reports, duplicateCount, missingRoles)",
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
    "performance-inline-images",
    "performance-lazy-images",
    "performance-image-dimensions",
  ]) assert.ok(source.includes(marker), marker);
});
