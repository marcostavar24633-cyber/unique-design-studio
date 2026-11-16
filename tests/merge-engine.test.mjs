// Merge Engine: правила допуска, клиент GitHub, слияние, идемпотентность и анализ git.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, REVIEWED_LABEL, evaluate, publicStatus, summarizeCi, allowedMergeMethods, isSensitivePath } from '../src/merge/rules.mjs';
import { createGitHub } from '../scripts/merge-engine/github.mjs';
import { createJournal, doctor, mergePr, deleteHeadBranch, verifyAfterMerge } from '../scripts/merge-engine/engine.mjs';
import { mergeTree, removalReport, scanSecrets, behindAhead, changedFiles } from '../scripts/merge-engine/git-analysis.mjs';

const NOW = Date.parse('2026-11-17T00:00:00Z');
const good = (over = {}) => ({
  repo: REPO, number: 1, state: 'open', merged: false, draft: false, baseRef: 'main', headSha: 'a'.repeat(40), labels: [],
  updatedAt: '2026-11-16T00:00:00Z', ci: { total: 3, success: 3, pending: 0, failed: [] }, conflicts: false, behindBy: 0,
  removal: { mainLinesRemoved: 2, filesRemoved: [], symbolsRemoved: [] }, secrets: [], sensitiveFiles: [],
  testsPassed: true, buildPassed: true, allowedMergeMethods: ['squash', 'merge'], ...over,
});
const failedIds = d => d.checks.filter(c => !c.ok).map(c => c.id);

// ---------- Правила ----------
test('PR, выполнивший все условия, допускается к слиянию', () => {
  const d = evaluate(good(), { now: NOW });
  assert.equal(d.eligible, true);
  assert.equal(d.status, 'ready');
});

test('каждое обязательное условие блокирует слияние', () => {
  const cases = [
    [{ repo: 'someone/fork' }, 'repo'], [{ baseRef: 'dev' }, 'base'], [{ draft: true }, 'draft', 'draft'],
    [{ ci: { total: 3, success: 2, pending: 0, failed: ['test (20) (failure)'] } }, 'ci', 'ci-failed'],
    [{ ci: { total: 3, success: 2, pending: 1, failed: [] } }, 'ci', 'ci-pending'],
    [{ ci: { total: 0, success: 0, pending: 0, failed: [] } }, 'ci'],
    [{ conflicts: true }, 'conflicts', 'conflict'],
    [{ removal: { mainLinesRemoved: 500, filesRemoved: [], symbolsRemoved: [] } }, 'removal'],
    [{ removal: { mainLinesRemoved: 3, filesRemoved: ['src/engine/brands.js'], symbolsRemoved: [] } }, 'removal'],
    [{ removal: { mainLinesRemoved: 3, filesRemoved: [], symbolsRemoved: ['autopilot'] } }, 'removal'],
    [{ secrets: ['токен GitHub в a.js'] }, 'secrets'],
    [{ sensitiveFiles: ['.github/workflows/ci.yml'] }, 'security'],
    [{ testsPassed: false }, 'tests'], [{ buildPassed: false }, 'tests'],
    [{ allowedMergeMethods: ['merge'] }, 'method'],
    [{ merged: true }, 'open', 'closed'], [{ state: 'closed' }, 'open', 'closed'],
  ];
  for (const [over, id, status = 'blocked'] of cases) {
    const d = evaluate(good(over), { now: NOW });
    assert.equal(d.eligible, false, JSON.stringify(over));
    assert.ok(failedIds(d).includes(id), `${JSON.stringify(over)} → ${id}`);
    assert.equal(d.status, status, JSON.stringify(over));
  }
});

test('неизвестный факт считается невыполненным условием', () => {
  for (const key of ['ci', 'conflicts', 'removal', 'secrets', 'sensitiveFiles', 'testsPassed', 'buildPassed', 'allowedMergeMethods']) {
    assert.equal(evaluate(good({ [key]: null }), { now: NOW }).eligible, false, key);
  }
});

test('чувствительные файлы допускаются только после метки владельца', () => {
  const f = good({ sensitiveFiles: ['worker/wrangler.toml'] });
  assert.equal(evaluate(f, { now: NOW }).eligible, false);
  assert.equal(evaluate({ ...f, labels: [REVIEWED_LABEL] }, { now: NOW }).eligible, true);
  for (const p of ['.github/workflows/x.yml', 'worker/wrangler.jsonc', 'package.json', 'src/auth.js', 'db/migrations/001.sql', '.env.local']) assert.ok(isSensitivePath(p), p);
  for (const p of ['studio/studio.js', 'src/engine/render.js', 'tests/studio.test.mjs']) assert.ok(!isSensitivePath(p), p);
});

test('устаревшая ветка — предупреждение, а не запрет', () => {
  const d = evaluate(good({ behindBy: 7, updatedAt: '2026-10-01T00:00:00Z' }), { now: NOW });
  assert.equal(d.eligible, true);
  assert.equal(d.warnings.length, 2);
});

test('сводка CI учитывает перезапуски и статусы коммита', () => {
  const runs = [
    { name: 'test', status: 'completed', conclusion: 'failure', started_at: '2026-11-16T10:00:00Z' },
    { name: 'test', status: 'completed', conclusion: 'success', started_at: '2026-11-16T11:00:00Z' },
    { name: 'e2e', status: 'in_progress', conclusion: null, started_at: '2026-11-16T11:00:00Z' },
  ];
  assert.deepEqual(summarizeCi(runs, [{ context: 'deploy', state: 'failure' }]), { total: 3, success: 1, pending: 1, failed: ['deploy (failure)'] });
  assert.deepEqual(allowedMergeMethods({ allow_squash_merge: true, allow_merge_commit: false, allow_rebase_merge: true }), ['squash', 'rebase']);
  assert.equal(allowedMergeMethods({}), null, 'без токена GitHub не отдаёт настройки');
});

test('предварительный статус панели никогда не говорит «готов»', () => {
  const base = { state: 'open', merged: false, draft: false, baseRef: 'main', mergeable: true, mergeableState: 'clean', ci: { total: 2, success: 2, pending: 0, failed: [] } };
  assert.equal(publicStatus(base), 'candidate');
  assert.equal(publicStatus({ ...base, draft: true }), 'draft');
  assert.equal(publicStatus({ ...base, mergeable: false, mergeableState: 'dirty' }), 'conflict');
  assert.equal(publicStatus({ ...base, mergeable: null, mergeableState: 'unknown' }), 'checking');
  assert.equal(publicStatus({ ...base, ci: { total: 2, success: 1, pending: 0, failed: ['x'] } }), 'ci-failed');
});

// ---------- Поддельный GitHub ----------
function fakeGitHub({ token = 'test-token', pr = {}, mergeResponse, branchProtected = false, otherPrs = [], runs } = {}) {
  const calls = [];
  const state = { mainSha: 'm'.repeat(40), merged: false };
  const prData = () => ({
    number: 7, title: 'Тестовый PR', html_url: `https://github.com/${REPO}/pull/7`, state: state.merged ? 'closed' : 'open', merged: state.merged, draft: false,
    base: { ref: 'main', repo: { full_name: REPO } }, head: { ref: 'feature/x', sha: 'h'.repeat(40), repo: { full_name: REPO } },
    labels: [], updated_at: '2026-11-16T00:00:00Z', user: { login: 'owner' }, mergeable: true, ...pr,
  });
  const routes = [
    ['GET', /\/repos\/[^/]+\/[^/]+$/, () => [200, { full_name: REPO, permissions: token ? { push: true } : undefined, ...(token ? { allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: false, delete_branch_on_merge: false } : {}) }]],
    ['GET', /\/pulls\/7$/, () => [200, prData()]],
    ['GET', /\/check-runs/, () => [200, { check_runs: [{ name: 'test', status: 'completed', conclusion: 'success', started_at: '2026-11-16T00:00:00Z' }] }]],
    ['GET', /\/status$/, () => [200, { statuses: [] }]],
    ['PUT', /\/pulls\/7\/merge$/, body => { if (!token) return [401, { message: 'Requires authentication' }]; if (body.sha !== 'h'.repeat(40)) return [409, { message: 'Head branch was modified' }]; state.merged = true; state.mainSha = 's'.repeat(40); return mergeResponse || [200, { merged: true, sha: 's'.repeat(40) }]; }],
    ['GET', /\/branches\/main$/, () => [200, { protected: false, commit: { sha: state.mainSha } }]],
    ['GET', /\/branches\/feature%2Fx$|\/branches\/feature\/x$/, () => [200, { protected: branchProtected, commit: { sha: 'h'.repeat(40) } }]],
    ['GET', /\/pulls\?state=open&head=/, () => [200, otherPrs]],
    ['DELETE', /\/git\/refs\/heads\/feature\/x$/, () => [204, null]],
    ['POST', /\/actions\/workflows\/pages\.yml\/dispatches$/, () => [204, null]],
    ['GET', /\/actions\/workflows\/pages\.yml\/runs/, () => [200, { workflow_runs: runs || [{ head_sha: state.mainSha, status: 'completed', conclusion: 'success', html_url: 'https://github.com/run/1' }] }]],
  ];
  const fetchImpl = async (url, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, auth: Boolean(init.headers?.Authorization), body });
    const route = routes.find(([m, re]) => m === method && re.test(url));
    const [status, data] = route ? route[2](body) : [404, { message: 'Not Found' }];
    return { status, ok: status >= 200 && status < 300, json: async () => data };
  };
  return { gh: createGitHub({ repo: REPO, token, fetchImpl }), calls, state };
}
const passingAnalysis = () => ({ headSha: 'h'.repeat(40), behindBy: 2, aheadBy: 1, conflicts: false, conflictFiles: [], removal: { mainLinesRemoved: 1, filesRemoved: [], symbolsRemoved: [] }, secrets: [], sensitiveFiles: [], changedFiles: ['studio/a.js'], testsPassed: true, buildPassed: true, testLog: [] });
const tmpJournal = () => createJournal(mkdtempSync(join(tmpdir(), 'me-journal-')));
const noSleep = async () => {};

test('проверка доступа: без токена — только чтение, с токеном — права и способы слияния', async () => {
  const anon = await doctor(fakeGitHub({ token: '' }).gh);
  assert.equal(anon.authenticated, false);
  assert.ok(anon.problems.some(p => /только чтение/.test(p)));
  const auth = await doctor(fakeGitHub().gh);
  assert.equal(auth.authenticated, true);
  assert.deepEqual(auth.allowedMergeMethods, ['squash', 'merge']);
  assert.equal(auth.problems.length, 0);
});

test('токен отправляется только в заголовке и не попадает в ошибки', async () => {
  const { gh, calls } = fakeGitHub({ token: 'ghp_secretvalue' });
  await assert.rejects(gh.api('/nope'), err => !String(err.message).includes('ghp_secretvalue'));
  assert.ok(calls.every(c => c.auth && !c.url.includes('ghp_secretvalue')));
});

test('пробный прогон проверяет всё и ничего не сливает', async () => {
  const { gh, calls } = fakeGitHub();
  const r = await mergePr(gh, 7, { cwd: '.', journal: tmpJournal(), analyze: passingAnalysis, sleep: noSleep });
  assert.equal(r.result, 'dry-run');
  assert.ok(!calls.some(c => c.method === 'PUT'));
});

test('слияние: squash с sha головы, удаление ветки, проверка main и публикации', async () => {
  const { gh, calls } = fakeGitHub();
  const journal = tmpJournal();
  const r = await mergePr(gh, 7, { cwd: '.', journal, execute: true, analyze: passingAnalysis, sleep: noSleep });
  assert.equal(r.result, 'merged');
  const put = calls.find(c => c.method === 'PUT');
  assert.equal(put.body.merge_method, 'squash');
  assert.equal(put.body.sha, 'h'.repeat(40));
  assert.equal(r.verify.mainMatches, true);
  assert.equal(r.verify.deploy, 'deployed');
  assert.equal(r.branch.deleted, true);
  assert.ok(calls.some(c => c.method === 'POST' && /pages\.yml\/dispatches/.test(c.url)), 'публикация запущена явно');
  assert.ok(journal.read().some(e => e.op === 'merge' && e.result === 'merged'));
});

test('повторный запуск не сливает PR второй раз', async () => {
  const { gh, calls } = fakeGitHub();
  const journal = tmpJournal();
  await mergePr(gh, 7, { cwd: '.', journal, execute: true, analyze: passingAnalysis, sleep: noSleep });
  const again = await mergePr(gh, 7, { cwd: '.', journal, execute: true, analyze: passingAnalysis, sleep: noSleep });
  assert.equal(again.result, 'already-merged');
  assert.equal(calls.filter(c => c.method === 'PUT').length, 1);
});

test('одновременный запуск блокируется', async () => {
  const { gh } = fakeGitHub();
  const journal = tmpJournal();
  assert.ok(journal.acquire());
  const r = await mergePr(gh, 7, { cwd: '.', journal, execute: true, analyze: passingAnalysis, sleep: noSleep });
  assert.equal(r.result, 'locked');
  journal.release();
});

test('без токена слияние невозможно', async () => {
  const { gh, calls } = fakeGitHub({ token: '' });
  const r = await mergePr(gh, 7, { cwd: '.', journal: tmpJournal(), execute: true, analyze: passingAnalysis, sleep: noSleep });
  // Без токена неизвестны настройки слияния — правило «Способ слияния» уже запрещает операцию.
  assert.equal(r.result, 'blocked');
  assert.ok(!calls.some(c => c.method === 'PUT'));
});

test('неуспешный CI, конфликт, черновик и упавшие тесты блокируют слияние', async () => {
  const scenarios = [
    [{ ci: true }, 'ci'], [{ conflicts: true }, 'conflicts'], [{ draft: true }, 'draft'], [{ tests: false }, 'tests'],
  ];
  for (const [s, id] of scenarios) {
    const { gh, calls } = fakeGitHub({ pr: s.draft ? { draft: true } : {} });
    if (s.ci) gh.checkRuns = async () => [{ name: 'test', status: 'completed', conclusion: 'failure', started_at: '2026-11-16T00:00:00Z' }];
    const analyze = () => ({ ...passingAnalysis(), conflicts: Boolean(s.conflicts), removal: s.conflicts ? null : passingAnalysis().removal, testsPassed: s.tests ?? true });
    const r = await mergePr(gh, 7, { cwd: '.', journal: tmpJournal(), execute: true, analyze, sleep: noSleep });
    assert.equal(r.result, 'blocked', id);
    assert.ok(r.inspection.decision.checks.some(c => c.id === id && !c.ok), id);
    assert.ok(!calls.some(c => c.method === 'PUT'), id);
  }
});

test('если голова PR изменилась после анализа — слияние не выполняется', async () => {
  const { gh, calls } = fakeGitHub();
  const r = await mergePr(gh, 7, { cwd: '.', journal: tmpJournal(), execute: true, analyze: () => ({ ...passingAnalysis(), headSha: 'z'.repeat(40) }), sleep: noSleep });
  assert.equal(r.result, 'blocked');
  assert.ok(!calls.some(c => c.method === 'PUT'));
});

test('ветка не удаляется, если она защищена, нужна другому PR или из форка', async () => {
  const pr = { head: 'feature/x', headRepo: REPO };
  assert.equal((await deleteHeadBranch(fakeGitHub({ branchProtected: true }).gh, pr, 7)).deleted, false);
  assert.equal((await deleteHeadBranch(fakeGitHub({ otherPrs: [{ number: 9 }] }).gh, pr, 7)).deleted, false);
  assert.equal((await deleteHeadBranch(fakeGitHub().gh, { head: 'feature/x', headRepo: 'other/fork' }, 7)).deleted, false);
  assert.equal((await deleteHeadBranch(fakeGitHub().gh, { head: 'main', headRepo: REPO }, 7)).deleted, false);
});

test('публикация не считается успешной без подтверждения', async () => {
  const { gh } = fakeGitHub({ runs: [] });
  const v = await verifyAfterMerge(gh, { mergeSha: 'm'.repeat(40), sleep: noSleep, attempts: 2 });
  assert.equal(v.deploy, 'unknown');
  const failed = await verifyAfterMerge(fakeGitHub({ runs: [{ head_sha: 'm'.repeat(40), status: 'completed', conclusion: 'failure' }] }).gh, { mergeSha: 'm'.repeat(40), sleep: noSleep, attempts: 1 });
  assert.equal(failed.deploy, 'failed (failure)');
});

// ---------- Анализ git на временном репозитории ----------
function repoWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'me-git-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main'); g('config', 'user.email', 'test@example.com'); g('config', 'user.name', 'Test'); g('config', 'commit.gpgsign', 'false');
  const write = obj => { for (const [p, c] of Object.entries(obj)) { mkdirSync(join(dir, p, '..'), { recursive: true }); if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c); } };
  write(files); g('add', '-A'); g('commit', '-qm', 'base');
  return { dir, g, write, commit: (msg, obj) => { write(obj); g('add', '-A'); g('commit', '-qm', msg); return g('rev-parse', 'HEAD'); } };
}

test('git: конфликт, отставание, удаление кода и секреты определяются по реальному репозиторию', () => {
  const r = repoWith({ 'src/a.js': 'export function keep() {}\nexport function gone() {}\n', 'src/b.js': 'line\n', 'README.md': 'v1\n' });
  try {
    r.g('checkout', '-q', '-b', 'pr');
    const token = ['ghp', 'A'.repeat(36)].join('_');
    r.commit('pr', { 'src/a.js': 'export function keep() {}\n', 'README.md': 'v-pr\n', 'src/c.js': `const t = "${token}";\n`, 'tests/x.test.mjs': 'const phone = "+7 900 123-45-67";\n' });
    r.g('checkout', '-q', 'main');
    r.commit('main moves', { 'README.md': 'v-main\n', 'src/d.js': 'new\n' });
    assert.deepEqual(behindAhead(r.dir, 'main', 'pr'), { behind: 1, ahead: 1 });
    assert.deepEqual(mergeTree(r.dir, 'main', 'pr').conflicts, ['README.md']);
    r.g('checkout', '-q', 'pr'); r.commit('resolve', { 'README.md': 'v-main\n' }); r.g('checkout', '-q', 'main');
    const m = mergeTree(r.dir, 'main', 'pr');
    assert.equal(m.conflicts.length, 0);
    const rem = removalReport(r.dir, 'main', m.tree);
    assert.deepEqual(rem.symbolsRemoved, ['gone']);
    assert.deepEqual(rem.filesRemoved, [], 'src/d.js из main не должен пропасть');
    const secrets = scanSecrets(r.dir, 'main', 'pr');
    assert.ok(secrets.some(s => /токен GitHub в src\/c\.js/.test(s)));
    assert.ok(!secrets.some(s => /телефон/.test(s)), 'телефон-заглушка в тестах допустим');
    assert.ok(!secrets.join(' ').includes(token), 'значение секрета не выводится');
    assert.ok(changedFiles(r.dir, 'main', 'pr').includes('src/c.js'));
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('git: устаревшая ветка, откатывающая чужие изменения main, попадает под запрет удаления', () => {
  const r = repoWith({ 'src/a.js': 'export const a = 1;\n' });
  try {
    r.g('checkout', '-q', '-b', 'old');
    r.g('checkout', '-q', 'main');
    r.commit('main grows', { 'src/feature.js': Array.from({ length: 200 }, (_, i) => `export const f${i} = ${i};`).join('\n') + '\n' });
    // Ветка удаляет файл, появившийся в main после её создания (типичная «перенесённая вручную» устаревшая ветка).
    r.g('checkout', '-q', 'old'); r.g('merge', '-q', 'main'); r.commit('drop feature', { 'src/feature.js': null }); r.g('checkout', '-q', 'main');
    const m = mergeTree(r.dir, 'main', 'old');
    const rem = removalReport(r.dir, 'main', m.tree);
    assert.deepEqual(rem.filesRemoved, ['src/feature.js']);
    assert.ok(rem.mainLinesRemoved >= 200);
    const d = evaluate(good({ removal: rem }), { now: NOW });
    assert.equal(d.eligible, false);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('рабочий процесс GitHub Actions: минимальные права, ручное слияние, ввод через переменные окружения', () => {
  const wf = readFileSync(new URL('../.github/workflows/merge-engine.yml', import.meta.url), 'utf8');
  const perms = wf.match(/\npermissions:\n((?:\s+[\w-]+: \w+[^\n]*\n)+)/)[1].split('\n').filter(Boolean).map(l => l.trim().split('#')[0].trim());
  assert.deepEqual(perms, ['contents: write', 'pull-requests: write', 'checks: read', 'statuses: read', 'actions: write']);
  assert.doesNotMatch(wf, /administration|admin|--admin|force/i);
  assert.match(wf, /concurrency:\n\s+group: merge-engine\n\s+cancel-in-progress: false/);
  assert.match(wf, /execute:[\s\S]*?default: false/);
  assert.doesNotMatch(wf, /run:.*\$\{\{\s*inputs\./, 'ввод не подставляется прямо в команду');
  assert.match(wf, /secrets\.GITHUB_TOKEN/);
});

test('панель Merge Control Center подключена к студии и не хранит токены', () => {
  const html = readFileSync(new URL('../studio/merge.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../studio/merge.js', import.meta.url), 'utf8');
  for (const label of ['Проверить PR', 'Проверить конфликты', 'Запустить тесты', 'Подготовить к merge', 'Автоматический merge', 'История операций']) assert.ok(html.includes(label), label);
  assert.match(readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8'), /href="merge\.html"/);
  assert.doesNotMatch(js, /Authorization|token|localStorage\.setItem/i);
  assert.match(js, /esc\(i\.title\)/, 'заголовки PR экранируются');
});
