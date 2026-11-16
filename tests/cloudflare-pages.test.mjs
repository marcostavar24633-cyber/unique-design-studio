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
