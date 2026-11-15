// Сборка статического сайта в dist/: веб-студия + галерея примеров, сгенерированных подряд с общим реестром.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ARCHETYPES, generate } from '../src/engine/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = root + 'dist/';
rmSync(dist, { recursive: true, force: true });
for (const dir of ['studio', 'src', 'examples', 'design-system']) cpSync(root + dir, dist + dir, { recursive: true });

const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const index = JSON.parse(readFileSync(root + 'examples/index.json', 'utf8'));
let registry = [], failed = 0;
const cards = [];
for (const ex of index) {
  const r = generate(JSON.parse(readFileSync(root + 'examples/' + ex.file, 'utf8')), { registry });
  registry = r.registry;
  mkdirSync(`${dist}sites/${r.project.id}`, { recursive: true });
  writeFileSync(`${dist}sites/${r.project.id}/index.html`, r.html);
  const { visualSystem, ...contract } = r.concept;
  writeFileSync(`${dist}sites/${r.project.id}/concept.json`, JSON.stringify(contract, null, 2) + '\n');
  if (!r.audit.ok) { failed++; console.error(`✗ ${r.project.id}: ${r.audit.errors.map(e => e.message).join('; ')}`); }
  const d = r.concept.designDNA, p = r.concept.visualSystem.palette;
  cards.push(`<li><a href="sites/${r.project.id}/"><span class="sw" style="background:${p.bg};color:${p.text};border-color:${p.accent}"><b style="background:${p.accent}"></b>${esc(ARCHETYPES[d.primaryArchetype].name)}</span><strong>${esc(ex.brand)}</strong><span>${esc(ex.niche)}</span><small>${esc(r.concept.homepage.heroComposition)}</small></a></li>`);
  console.log(`✓ ${r.project.id.padEnd(14)} ${ARCHETYPES[d.primaryArchetype].name}`);
}
writeFileSync(dist + 'index.html', `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unique Design Studio — примеры</title>
<meta name="description" content="Главные страницы, сгенерированные Unique Design Studio: у каждой ниши своя архитектура, палитра и типографика.">
<style>
:root{color-scheme:light dark;--bg:#f3f2ee;--ink:#1c1d1a;--muted:#62645d;--line:#dcdad2;--card:#fff;--accent:#2f5d50}
@media(prefers-color-scheme:dark){:root{--bg:#161715;--ink:#eceae4;--muted:#a3a59c;--line:#373a34;--card:#242622;--accent:#8fc7b3}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,sans-serif}
main{width:min(100% - 32px,1100px);margin:0 auto;padding:clamp(32px,6vw,80px) 0}
h1{margin:0 0 .4em;font-size:clamp(1.8rem,1rem + 3vw,3rem);line-height:1.1;letter-spacing:-.02em;text-wrap:balance}
p{max-width:62ch;color:var(--muted)}a{color:inherit}
.cta{display:inline-flex;align-items:center;min-height:48px;margin:10px 0 36px;padding:10px 22px;border-radius:8px;background:var(--accent);color:var(--bg);font-weight:650;text-decoration:none}
ul{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:16px;margin:0;padding:0;list-style:none}
li a{display:grid;gap:4px;height:100%;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--card);text-decoration:none}
li a:hover{border-color:var(--ink)}li span{color:var(--muted);font-size:.92rem}li small{color:var(--muted);font-size:.82rem;line-height:1.4}
.sw{display:flex;align-items:center;gap:10px;min-height:84px;margin-bottom:8px;padding:12px;border-radius:6px;border:1px solid;font-weight:650;font-size:.95rem}.sw b{width:14px;height:14px;border-radius:50%}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
</style></head><body><main>
<h1>Unique Design Studio</h1>
<p>Каждая страница ниже сгенерирована из JSON-проекта: сначала Design Brief и Design DNA, затем композиция и разметка. Проекты генерировались подряд с общим реестром, поэтому соседние не повторяют друг друга.</p>
<a class="cta" href="studio/">Открыть студию</a>
<ul>${cards.join('')}</ul>
</main></body></html>
`);
console.log(`\nСобрано в dist/: студия и ${index.length} примеров.`);
if (failed) process.exit(1);
