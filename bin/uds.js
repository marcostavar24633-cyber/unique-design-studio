#!/usr/bin/env node
// CLI Unique Design Studio.
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHETYPES, buildConcept, buildPrompt, generate, normalizeProject } from '../src/engine/index.js';
import { buildCloudflarePagesDeployArgs, shellQuoteArgs } from '../src/engine/cloudflare-pages.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const HELP = `Unique Design Studio — генератор уникальных главных страниц

Использование:
  uds generate <project.json> [--out <папка>] [--registry <файл>] [--no-registry]
      Концепция, index.html, concept.json, project.json и отчёт проверки.
  uds concept <project.json> [--registry <файл>]   Напечатать Design Brief / Design DNA (JSON)
  uds audit <project.json> [--registry <файл>]     Только проверка перед выдачей
  uds prompt <project.json>                         Промт с концепцией для AI-помощника
  uds init [файл]                                   Создать заготовку проекта
  uds archetypes                                    Список архитектур
  uds deploy <project.json> --project-name <имя> [--branch production] [--out <папка>]
      Аудит и публикация в существующий Cloudflare Pages project через Wrangler.
      При ошибках аудита сайт не отправляется. Нужен npx wrangler login.
  uds serve [--port 4173]                           Запустить веб-студию

Реестр (по умолчанию .uds-registry.json) хранит «отпечатки» прошлых проектов:
по нему новая генерация проверяется на шаблонность.`;

function parse(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--no-')) args[a.slice(5)] = false;
    else if (a.startsWith('--')) args[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    else args._.push(a);
  }
  return args;
}
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
function loadProject(file) {
  if (!file) fail('Укажите файл проекта (.json). Заготовку создаёт команда: uds init');
  if (!existsSync(file)) fail(`Файл не найден: ${file}`);
  try { return readJson(file); } catch (e) { fail(`Не удалось прочитать JSON ${file}: ${e.message}`); }
}
function loadRegistry(args) {
  if (args.registry === false) return { file: null, list: [] };
  const file = resolve(typeof args.registry === 'string' ? args.registry : '.uds-registry.json');
  if (!existsSync(file)) return { file, list: [] };
  try { const list = readJson(file); return { file, list: Array.isArray(list) ? list : [] }; } catch { fail(`Реестр повреждён: ${file}`); }
}
function fail(msg) { console.error(`Ошибка: ${msg}`); process.exit(2); }

function printAudit(audit) {
  const mark = { ok: '✓', warn: '!', error: '✗' };
  for (const c of audit.checks) console.log(`  ${mark[c.level]} ${c.message}`);
  console.log(audit.ok ? `\nПроверка пройдена. Предупреждений: ${audit.warnings.length}.` : `\nПроверка не пройдена. Ошибок: ${audit.errors.length}.`);
}
function printConcept(concept) {
  const d = concept.designDNA, h = concept.homepage, u = concept.uniquenessCheck;
  console.log(`Архитектура:  ${ARCHETYPES[d.primaryArchetype].name}${d.secondaryArchetype ? ' + ' + ARCHETYPES[d.secondaryArchetype].name : ''}`);
  console.log(`Первый экран: ${h.heroComposition}`);
  console.log(`Навигация:    ${h.navigationPattern}`);
  console.log(`Цвет:         ${d.colorDirection}`);
  console.log(`Типографика:  ${d.typographyDirection}`);
  console.log(`Секции:       ${h.sectionOrder.join(' → ')}`);
  console.log(`Обоснование:  ${d.selectionRationale}`);
  for (const a of u.differentiationActions) console.log(`Антишаблон:   ${a}`);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8' };
function serve(port) {
  createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') { res.writeHead(302, { Location: '/studio/' }); return res.end(); }
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Не найдено'); }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(file));
  }).listen(port, '127.0.0.1', () => console.log(`Студия запущена: http://127.0.0.1:${port}/studio/`));
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parse(rest);
switch (cmd) {
  case 'generate': {
    const raw = loadProject(args._[0]);
    const reg = loadRegistry(args);
    const r = generate(raw, { registry: reg.list });
    const out = resolve(typeof args.out === 'string' ? args.out : join('out', r.project.id));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'index.html'), r.html);
    const { visualSystem, ...contract } = r.concept;
    writeFileSync(join(out, 'concept.json'), JSON.stringify(contract, null, 2) + '\n');
    writeFileSync(join(out, 'project.json'), JSON.stringify(r.exported, null, 2) + '\n');
    if (reg.file) { mkdirSync(dirname(reg.file), { recursive: true }); writeFileSync(reg.file, JSON.stringify(r.registry, null, 2) + '\n'); }
    printConcept(r.concept);
    console.log('\nПроверка перед выдачей:');
    printAudit(r.audit);
    console.log(`\nГотово: ${join(out, 'index.html')}`);
    process.exit(r.audit.ok ? 0 : 1);
  }
  case 'concept': {
    const { visualSystem, ...contract } = buildConcept(loadProject(args._[0]), { registry: loadRegistry(args).list });
    console.log(JSON.stringify(contract, null, 2));
    break;
  }
  case 'audit': {
    const r = generate(loadProject(args._[0]), { registry: loadRegistry(args).list });
    printAudit(r.audit);
    process.exit(r.audit.ok ? 0 : 1);
  }
  case 'prompt': {
    const raw = loadProject(args._[0]);
    console.log(buildPrompt(raw, buildConcept(raw, { registry: loadRegistry(args).list })));
    break;
  }
  case 'init': {
    const file = args._[0] || 'project.json';
    if (existsSync(file)) fail(`Файл уже существует: ${file}`);
    writeFileSync(file, JSON.stringify({
      formatVersion: 2, brand: '', niche: '', title: '', description: '', cta: '', architecture: 'auto', palette: '', accent: '',
      targetAudience: '', brandCharacter: '', aboutTitle: '', aboutText: '', servicesTitle: '', services: [['', '']],
      advantagesTitle: '', advantages: [['', '']], processTitle: '', process: [['', '']], faqs: [['', '']],
      contactTitle: '', contactText: '', contacts: { phone: '', email: '', address: '', hours: '' }, formAction: '',
      images: { hero: '', heroAlt: '' }, gallery: [], categories: [], assumptions: [],
    }, null, 2) + '\n');
    console.log(`Создана заготовка: ${file}. Заполните brand и niche, затем: uds generate ${file}`);
    break;
  }
  case 'archetypes':
    for (const [id, a] of Object.entries(ARCHETYPES)) console.log(`${id.padEnd(15)} ${a.name} — ${a.summary}`);
    break;
  case 'deploy': {
    const projectName = args['project-name'];
    const branch = typeof args.branch === 'string' ? args.branch : 'production';
    if (!projectName || typeof projectName !== 'string') fail('Укажите --project-name с именем уже созданного Cloudflare Pages project.');
    const r = generate(loadProject(args._[0]), { registry: loadRegistry(args).list });
    printConcept(r.concept);
    console.log('\nПроверка перед публикацией:');
    printAudit(r.audit);
    if (!r.audit.ok) fail('Публикация отменена: исправьте ошибки аудита и повторите команду.');
    const out = resolve(typeof args.out === 'string' ? args.out : join('out', r.project.id, 'cloudflare-pages'));
    let deployArgs;
    try { deployArgs = buildCloudflarePagesDeployArgs(out, projectName, branch); } catch (error) { fail(error.message); }
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'index.html'), r.html);
    console.log('\nОтправляю сайт в Cloudflare Pages…');
    const windows = process.platform === 'win32';
    const result = spawnSync(windows ? 'npx.cmd' : 'npx', shellQuoteArgs(['wrangler', ...deployArgs], windows), { stdio: 'inherit', shell: windows });
    if (result.error) fail(`Не удалось запустить Wrangler: ${result.error.message}. Установите Node.js/npm и выполните npx wrangler login.`);
    if (result.status !== 0) process.exit(result.status || 1);
    console.log('\nWrangler завершился без ошибок. Проверьте адрес deployment в его выводе — публикация считается подтверждённой, когда сайт открывается по этому адресу.');
    break;
  }
  case 'serve': serve(Number(args.port) || 4173); break;
  case undefined: case 'help': case '--help': case '-h': console.log(HELP); break;
  default: console.error(`Неизвестная команда: ${cmd}\n`); console.log(HELP); process.exit(2);
}
