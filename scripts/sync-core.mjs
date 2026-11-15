// Переносит ядро дизайн-системы (design-system/*.css) в модуль движка,
// чтобы генератор и в браузере, и в Node использовал одни и те же токены и компоненты.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export function buildCoreModule() {
  const css = ['tokens.css', 'components.css'].map(f => readFileSync(`${root}design-system/${f}`, 'utf8').trim()).join('\n');
  const min = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '').replace(/\s*([{};,])\s*/g, '$1').replace(/:\s+/g, ':');
  return `// Сгенерировано scripts/sync-core.mjs из design-system/tokens.css и components.css. Не редактировать вручную.\nexport const CORE_CSS = ${JSON.stringify(min)};\n`;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(`${root}src/engine/core-css.js`, buildCoreModule());
  console.log('src/engine/core-css.js обновлён');
}
