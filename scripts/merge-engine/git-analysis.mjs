// Локальный анализ PR средствами git: отставание, конфликты, удаление кода, секреты, тесты на результате слияния.
// Ничего не пушит и не меняет рабочую копию: результат слияния строится как отдельное дерево (git merge-tree).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isSensitivePath } from '../../src/merge/rules.mjs';

export function git(cwd, args, { allowFail = false, input, env } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024, env: env ? { ...process.env, ...env } : process.env });
  if (r.status !== 0 && !allowFail) throw new Error(`git ${args[0]} завершился с ошибкой: ${(r.stderr || '').trim().slice(0, 300)}`);
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

/** Загружает main и голову PR в служебные ссылки refs/merge-engine/*. */
export function fetchPr(cwd, number, { remote = 'origin', base = 'main' } = {}) {
  git(cwd, ['fetch', '--quiet', '--no-tags', remote, `+refs/heads/${base}:refs/merge-engine/base`, `+refs/pull/${number}/head:refs/merge-engine/pr-${number}`]);
  return { baseRef: 'refs/merge-engine/base', headRef: `refs/merge-engine/pr-${number}` };
}

/** Строит дерево слияния. conflicts — список файлов с конфликтами. */
export function mergeTree(cwd, baseRef, headRef) {
  const r = git(cwd, ['merge-tree', '--write-tree', '--name-only', '--no-messages', baseRef, headRef], { allowFail: true });
  const lines = r.out.split('\n').filter(Boolean);
  if (r.ok) return { tree: lines[0], conflicts: [] };
  if (!/^[0-9a-f]{40}$/.test(lines[0] || '')) throw new Error(`git merge-tree: ${r.err || r.out}`.slice(0, 300));
  return { tree: lines[0], conflicts: [...new Set(lines.slice(1))] };
}

const EXPORT_RE = /^[-+]\s*export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/;

/**
 * Что слияние уберёт из main: строки, файлы и экспортируемые имена.
 * Сравнивается main с деревом слияния — так видно и то, что PR удаляет нарочно, и то, что «откатывает»
 * устаревшая ветка.
 */
export function removalReport(cwd, baseRef, tree) {
  let mainLinesRemoved = 0;
  const filesRemoved = [];
  for (const line of git(cwd, ['diff', '--numstat', '--no-renames', baseRef, tree]).out.split('\n').filter(Boolean)) {
    const [, del] = line.split('\t');
    if (del !== '-') mainLinesRemoved += Number(del) || 0;
  }
  for (const line of git(cwd, ['diff', '--name-status', '--no-renames', '--diff-filter=D', baseRef, tree]).out.split('\n').filter(Boolean)) filesRemoved.push(line.split('\t')[1]);
  const removed = new Set(), added = new Set();
  for (const line of git(cwd, ['diff', '--unified=0', '--no-renames', baseRef, tree, '--', '*.js', '*.mjs', '*.cjs', '*.ts']).out.split('\n')) {
    if (line.startsWith('---') || line.startsWith('+++')) continue;
    const m = line.match(EXPORT_RE);
    if (m) (line[0] === '-' ? removed : added).add(m[1]);
  }
  return { mainLinesRemoved, filesRemoved, symbolsRemoved: [...removed].filter(n => !added.has(n)) };
}

const SECRET_PATTERNS = [
  ['токен GitHub', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['ключ OpenAI/Anthropic', /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{24,}\b/],
  ['ключ AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['ключ Google', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['токен Slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['закрытый ключ', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['пароль в коде', /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i],
];
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SAFE_EMAIL = /@(?:example\.(?:com|org|net|ru)|users\.noreply\.github\.com|anthropic\.com|test|localhost)$/i;
const PHONE_RE = /(?:\+7|\b8)[\s(-]*9\d{2}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b/;
// В тестах и примерах допускаются только явные заглушки: 123-45-67, 000-00-00, адреса вида test@a.ru.
const TEST_PATH = /(^|\/)(tests?|__tests__|fixtures|examples?)\//;
const PLACEHOLDER_PHONE = /(1234567|0000000|1111111|9999999)$/;
const PLACEHOLDER_EMAIL = /^(test|pass|user|demo|foo|bar|a|b|x)[\w.+-]*@[a-z]{1,3}\.[a-z]{2,3}$|@(?:a|b|x|test|demo)\.(?:ru|com)$/i;

/** Ищет секреты и персональные данные в ДОБАВЛЯЕМЫХ строках PR (merge-base..head). Значения не выводит. */
export function scanSecrets(cwd, baseRef, headRef) {
  const mb = git(cwd, ['merge-base', baseRef, headRef]).out;
  const findings = [];
  let file = '';
  for (const line of git(cwd, ['diff', '--unified=0', '--no-renames', mb, headRef]).out.split('\n')) {
    if (line.startsWith('+++ ')) { file = line.slice(6); continue; }
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    for (const [kind, re] of SECRET_PATTERNS) if (re.test(line)) findings.push(`${kind} в ${file}`);
    const testFile = TEST_PATH.test(file);
    for (const email of line.match(EMAIL_RE) || []) if (!SAFE_EMAIL.test(email) && !/\.(png|jpe?g|webp|svg|gif)$/i.test(email) && !(testFile && PLACEHOLDER_EMAIL.test(email))) findings.push(`адрес e-mail в ${file}`);
    const phone = line.match(PHONE_RE);
    if (phone && !(testFile && PLACEHOLDER_PHONE.test(phone[0].replace(/\D/g, '')))) findings.push(`номер телефона в ${file}`);
  }
  return [...new Set(findings)];
}

export function changedFiles(cwd, baseRef, headRef) {
  const mb = git(cwd, ['merge-base', baseRef, headRef]).out;
  return git(cwd, ['diff', '--name-only', '--no-renames', mb, headRef]).out.split('\n').filter(Boolean);
}

export const behindAhead = (cwd, baseRef, headRef) => {
  const [behind, ahead] = git(cwd, ['rev-list', '--left-right', '--count', `${baseRef}...${headRef}`]).out.split(/\s+/).map(Number);
  return { behind, ahead };
};

/** Запускает npm test и npm run build на результате слияния во временной копии. */
export function testMergedTree(cwd, tree, { commands = [['npm', ['test']], ['npm', ['run', 'build']]], timeoutMs = 10 * 60 * 1000 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'merge-engine-'));
  try {
    // Отдельный индекс: рабочая копия и подготовленные изменения пользователя не затрагиваются.
    git(cwd, ['--work-tree', dir, 'checkout', tree, '--', '.'], { env: { GIT_INDEX_FILE: join(dir, '.merge-engine-index') } });
    const results = [];
    for (const [cmd, args] of commands) {
      // Команды — фиксированные константы, не пользовательский ввод; на Windows npm запускается только через оболочку.
      const opts = { cwd: dir, encoding: 'utf8', timeout: timeoutMs, env: { ...process.env, CI: '1' } };
      const r = process.platform === 'win32' ? spawnSync([cmd, ...args].join(' '), { ...opts, shell: true }) : spawnSync(cmd, args, opts);
      results.push({ command: [cmd, ...args].join(' '), ok: r.status === 0, tail: `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-15).join('\n') });
    }
    return results;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Полный локальный анализ одного PR. */
export function analyzePr(cwd, number, { runTests = true, base = 'main', remote = 'origin' } = {}) {
  const { baseRef, headRef } = fetchPr(cwd, number, { remote, base });
  const headSha = git(cwd, ['rev-parse', headRef]).out;
  const { behind, ahead } = behindAhead(cwd, baseRef, headRef);
  const merged = mergeTree(cwd, baseRef, headRef);
  const files = changedFiles(cwd, baseRef, headRef);
  const out = {
    headSha, behindBy: behind, aheadBy: ahead,
    conflicts: merged.conflicts.length > 0, conflictFiles: merged.conflicts,
    removal: merged.conflicts.length ? null : removalReport(cwd, baseRef, merged.tree),
    secrets: scanSecrets(cwd, baseRef, headRef),
    sensitiveFiles: files.filter(isSensitivePath),
    changedFiles: files,
    testsPassed: null, buildPassed: null, testLog: [],
  };
  if (runTests && !merged.conflicts.length) {
    const results = testMergedTree(cwd, merged.tree);
    out.testLog = results;
    out.testsPassed = results[0]?.ok ?? null;
    out.buildPassed = results[1]?.ok ?? null;
  }
  return out;
}

export function currentSha(cwd, ref) {
  return execFileSync('git', ['rev-parse', ref], { cwd, encoding: 'utf8' }).trim();
}
