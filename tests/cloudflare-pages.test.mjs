import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCloudflarePagesDeployArgs, validateCloudflarePagesTarget } from '../src/engine/cloudflare-pages.js';

test('Cloudflare Pages deploy target is normalized only by validation, never guessed', () => {
  assert.deepEqual(validateCloudflarePagesTarget('my-store', 'production'), {
    projectName: 'my-store',
    branch: 'production',
  });
});

test('Cloudflare Pages deploy command uses explicit project and branch', () => {
  assert.deepEqual(buildCloudflarePagesDeployArgs('out/site', 'my-store', 'preview/rev-12'), [
    'pages', 'deploy', 'out/site', '--project-name', 'my-store', '--branch', 'preview/rev-12',
  ]);
});

test('Cloudflare Pages deploy rejects unsafe or missing targets', () => {
  assert.throws(() => buildCloudflarePagesDeployArgs('out/site', '', 'production'), /project/i);
  assert.throws(() => buildCloudflarePagesDeployArgs('out/site', 'My Store', 'production'), /project/i);
  assert.throws(() => buildCloudflarePagesDeployArgs('out/site', 'my-store', '../production'), /ветки/i);
  assert.throws(() => buildCloudflarePagesDeployArgs('', 'my-store', 'production'), /папка/i);
});

test('путь к папке с символами оболочки отклоняется (на Windows Wrangler идёт через cmd)', () => {
  for (const bad of ['out & calc', 'out|x', 'out>x', 'out%PATH%', 'a"b', 'out;rm']) assert.throws(() => buildCloudflarePagesDeployArgs(bad, 'my-store'), /символы оболочки/, bad);
  assert.deepEqual(buildCloudflarePagesDeployArgs('C:\\sites\\out site', 'my-store').slice(0, 3), ['pages', 'deploy', 'C:\\sites\\out site']);
});

test('CLI: команда deploy публикует только после успешного аудита', async () => {
  const { readFileSync } = await import('node:fs');
  const cli = readFileSync(new URL('../bin/uds.js', import.meta.url), 'utf8');
  assert.match(cli, /case 'deploy'/);
  assert.ok(cli.includes("if (!r.audit.ok) fail('Публикация отменена"), 'аудит блокирует публикацию');
  assert.ok(cli.indexOf("if (!r.audit.ok) fail('Публикация отменена") < cli.indexOf('spawnSync('), 'аудит раньше запуска Wrangler');
});

test('на Windows аргументы с пробелами берутся в кавычки, на других системах не меняются', async () => {
  const { shellQuoteArgs } = await import('../src/engine/cloudflare-pages.js');
  const args = ['pages', 'deploy', 'C:\для сайта\out', '--project-name', 'my-store'];
  assert.deepEqual(shellQuoteArgs(args, true), ['pages', 'deploy', '"C:\для сайта\out"', '--project-name', 'my-store']);
  assert.deepEqual(shellQuoteArgs(args, false), args);
});
