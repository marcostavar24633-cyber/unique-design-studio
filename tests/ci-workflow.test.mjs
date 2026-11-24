import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('CI запускается на PR в main и на push только в main без повторных прогонов', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(workflow, /^  push:\n    branches: \[main\]$/m);
  assert.match(workflow, /^  pull_request:\n    branches: \[main\]$/m);
  assert.match(workflow, /^  group: ci-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}$/m);
  assert.match(workflow, /^  cancel-in-progress: true$/m);
});

