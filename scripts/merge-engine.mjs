#!/usr/bin/env node
// Merge Engine — автономная проверка и безопасное слияние Pull Request в main.
//
//   node scripts/merge-engine.mjs doctor                 права доступа и настройки репозитория
//   node scripts/merge-engine.mjs status [--tests]       сводка по открытым PR (по умолчанию без запуска тестов)
//   node scripts/merge-engine.mjs check <PR>             все условия слияния, с тестами и сборкой на результате слияния
//   node scripts/merge-engine.mjs merge <PR>             пробный прогон: проверка без изменений
//   node scripts/merge-engine.mjs merge <PR> --execute   слияние (squash), удаление ветки, проверка main и публикации
//   node scripts/merge-engine.mjs history                журнал операций
//
// Токен — только в переменной окружения GITHUB_TOKEN (или GH_TOKEN). Без токена доступно только чтение.
// Флаги: --json <файл> — сохранить отчёт; --summary <файл> — дописать Markdown-сводку (GitHub Actions).
import { appendFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REPO, STATUS_LABELS } from '../src/merge/rules.mjs';
import { createJournal, doctor, inspectPr, mergePr, statusReport } from './merge-engine/engine.mjs';
import { createGitHub } from './merge-engine/github.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const [command = 'status', prArg] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--json', '--summary'].includes(args[i - 1])));

const gh = createGitHub({ repo: REPO });
const journal = createJournal(process.env.MERGE_ENGINE_STATE || `${root}.merge-engine`);

const mark = ok => (ok ? '✓' : '✗');
function printInspection(i) {
  console.log(`\n#${i.pr.number} ${i.pr.title}\n  ${STATUS_LABELS[i.decision.status]}${i.decision.eligible ? ' — все условия выполнены' : ''}`);
  for (const c of i.decision.checks) console.log(`  ${mark(c.ok)} ${c.label}${c.detail ? `: ${c.detail}` : ''}`);
  for (const w of i.decision.warnings) console.log(`  ! ${w}`);
  if (i.details?.conflictFiles?.length) console.log(`  Конфликтующие файлы: ${i.details.conflictFiles.join(', ')}`);
  for (const t of i.details?.testLog || []) if (!t.ok) console.log(`  --- ${t.command} ---\n${t.tail.replace(/^/gm, '    ')}`);
}
function markdown(i) {
  return [`### #${i.pr.number} ${i.pr.title}`, `**${STATUS_LABELS[i.decision.status]}**`, '',
    ...i.decision.checks.map(c => `- ${mark(c.ok)} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`),
    ...i.decision.warnings.map(w => `- ⚠ ${w}`), ''].join('\n');
}
function save(report) {
  const json = option('--json'); if (json) writeFileSync(json, JSON.stringify(report, null, 2));
  return report;
}
const summary = text => { const f = option('--summary'); if (f) appendFileSync(f, text + '\n'); };

async function main() {
  const pr = Number(prArg);
  if (['check', 'merge'].includes(command) && !Number.isInteger(pr)) throw new Error('Укажите номер PR, например: merge 45');

  if (command === 'doctor') {
    const d = save(await doctor(gh));
    console.log(`Репозиторий ${REPO}: ${d.repoAccessible ? 'доступен' : 'недоступен'}`);
    console.log(`Авторизация: ${d.authenticated ? 'токен задан' : 'нет (только чтение)'}`);
    if (d.permissions) console.log(`Права токена: ${Object.entries(d.permissions).filter(([, v]) => v).map(([k]) => k).join(', ') || 'нет'}`);
    console.log(`Способы слияния: ${d.allowedMergeMethods ? d.allowedMergeMethods.join(', ') : 'неизвестно без токена'}`);
    console.log(`Защита main: ${d.mainProtected === null ? 'неизвестно' : d.mainProtected ? 'включена' : 'выключена'}`);
    for (const p of d.problems) console.log(`! ${p}`);
    return;
  }
  if (command === 'status') {
    const r = save(await statusReport(gh, { cwd: root, runTests: flag('--tests') }));
    console.log(`main: ${r.mainSha.slice(0, 7)} · открыто ${r.totals.open} · готово ${r.totals.ready} · заблокировано ${r.totals.blocked} · конфликтов ${r.totals.conflict}`);
    if (r.deploy) console.log(`Последняя публикация: ${r.deploy.sha.slice(0, 7)} — ${r.deploy.conclusion || r.deploy.status}`);
    r.items.forEach(printInspection);
    summary(`## Merge Engine — сводка\n\nmain \`${r.mainSha.slice(0, 7)}\` · открыто ${r.totals.open} · готово ${r.totals.ready} · заблокировано ${r.totals.blocked} · конфликтов ${r.totals.conflict}\n\n${r.items.map(markdown).join('\n')}`);
    return;
  }
  if (command === 'check') {
    const i = save(await inspectPr(gh, pr, { cwd: root, runTests: !flag('--no-tests') }));
    printInspection(i);
    summary(markdown(i));
    process.exitCode = i.decision.eligible ? 0 : 3;
    return;
  }
  if (command === 'merge') {
    const execute = flag('--execute');
    const r = save(await mergePr(gh, pr, { cwd: root, journal, execute }));
    if (r.inspection) printInspection(r.inspection);
    const text = {
      'dry-run': 'Пробный прогон: все условия выполнены, слияние не выполнялось (добавьте --execute).',
      blocked: 'Слияние запрещено: не выполнены обязательные условия.',
      'already-merged': 'PR уже слит — повторная операция пропущена.',
      locked: r.message, 'no-auth': r.message, failed: `GitHub не подтвердил слияние: ${r.message || ''}`,
      merged: r.verify ? `Слито: ${r.mergeSha.slice(0, 7)}. main ${r.verify.mainMatches ? 'указывает на коммит слияния' : `указывает на ${r.verify.mainSha.slice(0, 7)} (проверьте)`}. Ветка: ${r.branch.deleted ? 'удалена' : `не удалена (${r.branch.reason})`}. Публикация: ${r.verify.deploy}.` : '',
    }[r.result];
    console.log(`\n${text}`);
    summary(`## Merge Engine — PR #${pr}\n\n${text}\n\n${r.inspection ? markdown(r.inspection) : ''}`);
    process.exitCode = r.result === 'merged' || r.result === 'dry-run' || r.result === 'already-merged' ? 0 : 3;
    return;
  }
  if (command === 'history') {
    for (const e of journal.read().slice(-30)) console.log(`${e.at} ${e.op} #${e.pr} ${e.result || ''} ${e.mergeSha ? e.mergeSha.slice(0, 7) : ''}${e.reasons ? ` — ${e.reasons.join('; ')}` : ''}`);
    return;
  }
  throw new Error(`Неизвестная команда: ${command}`);
}

main().catch(e => { console.error(`Ошибка: ${e.message}`); process.exitCode = 1; });
