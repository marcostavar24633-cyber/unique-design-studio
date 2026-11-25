// Keep Playwright browsers in the repository's ignored node_modules cache.
// Codex and CI shells can use ephemeral default browser-cache paths.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= resolve(root, 'node_modules/.cache/pw-browsers');

const quick = process.argv.includes('--quick');
const suites = quick
  ? ['tests/e2e/generator-sections-quiz.mjs']
  : [
      'tests/e2e/scroll-behavior.mjs', 'tests/e2e/responsive.mjs', 'tests/e2e/templates.mjs',
      'tests/e2e/repo-editor.mjs', 'tests/e2e/studio-workflow.mjs', 'tests/e2e/prompt-manager.mjs',
      'tests/e2e/commerce-interactions.mjs', 'tests/e2e/project-history.mjs', 'tests/e2e/project-storage.mjs',
      'tests/e2e/ai-usage.mjs', 'tests/e2e/editor-controls.mjs', 'tests/e2e/image-generation.mjs',
    ];

for (const suite of suites) {
  const result = spawnSync(process.execPath, [resolve(root, suite)], { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.error) { console.error(result.error); process.exit(1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
