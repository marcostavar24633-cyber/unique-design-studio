import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('корень собранного сайта перенаправляет в студию без галереи примеров', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'ignore' });
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(html, /http-equiv="refresh" content="0; url=studio\/"/);
  assert.match(html, /href="studio\/"/);
  assert.doesNotMatch(html, /<ul|sites\//);
  assert.doesNotMatch(readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8'), /examples\/index\.json/);
  assert.equal(existsSync(new URL('../dist/examples', import.meta.url)), false);
  assert.equal(existsSync(new URL('../dist/sites', import.meta.url)), false);
});
