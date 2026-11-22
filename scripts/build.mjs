// Сборка статического сайта в dist/: только веб-студия и перенаправление корня.
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = root + 'dist/';
rmSync(dist, { recursive: true, force: true });
for (const dir of ['studio', 'src', 'design-system']) cpSync(root + dir, dist + dir, { recursive: true });
writeFileSync(dist + 'index.html', `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=studio/">
<title>Unique Design Studio</title></head><body>
<p>Переходим в студию. Если переход не начался, <a href="studio/">откройте Unique Design Studio</a>.</p>
</body></html>
`);
console.log('\nСобрано в dist/: студия; корень ведёт в студию. Примеры не публикуются.');
