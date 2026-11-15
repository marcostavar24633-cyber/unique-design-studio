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
  ]) assert.ok(source.includes(marker), marker);
});
