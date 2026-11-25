// One-time project-local Playwright browser installation.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(root, 'node_modules/.cache/pw-browsers');
const cli = resolve(root, 'node_modules/playwright/cli.js');
const result = spawnSync(process.execPath, [cli, 'install', 'chromium'], { cwd: root, env: process.env, stdio: 'inherit' });
if (result.error) { console.error(result.error); process.exit(1); }
process.exit(result.status ?? 1);
