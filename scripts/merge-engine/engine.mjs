// Merge Engine: сбор фактов о PR, решение по правилам, безопасное слияние и проверка результата.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, MERGE_METHOD, REPO, allowedMergeMethods, evaluate, summarizeCi } from '../../src/merge/rules.mjs';
import { analyzePr } from './git-analysis.mjs';

const LOCK_TTL_MS = 30 * 60 * 1000;
const PROTECTED_BRANCHES = new Set(['main', 'master', 'gh-pages', 'production', 'release']);

/** Журнал операций (JSON Lines) и блокировка от одновременного запуска. */
export function createJournal(dir) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'history.jsonl');
  const lock = join(dir, 'lock');
  return {
    file,
    read() {
      if (!existsSync(file)) return [];
      return readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    },
    write(entry) { appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n'); },
    /** Повторное слияние той же головы PR не выполняется. */
    alreadyMerged(number, sha) { return this.read().some(e => e.op === 'merge' && e.result === 'merged' && e.pr === number && e.headSha === sha); },
    acquire() {
      try {
        if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs > LOCK_TTL_MS) rmSync(lock, { force: true });
        writeFileSync(lock, String(process.pid), { flag: 'wx' });
        return true;
      } catch { return false; }
    },
    release() { rmSync(lock, { force: true }); },
  };
}

/** Проверка доступа: авторизация, права на запись и слияние, настройки репозитория. */
export async function doctor(gh) {
  const report = { authenticated: gh.authenticated, repoAccessible: false, permissions: null, allowedMergeMethods: null, deleteBranchOnMerge: null, mainProtected: null, problems: [] };
  try {
    const repo = await gh.getRepo();
    report.repoAccessible = true;
    report.permissions = repo.permissions || null;
    report.allowedMergeMethods = allowedMergeMethods(repo);
    report.deleteBranchOnMerge = repo.delete_branch_on_merge ?? null;
  } catch (e) { report.problems.push(e.message); }
  try { report.mainProtected = Boolean((await gh.getBranch(BASE)).protected); } catch (e) { report.problems.push(e.message); }
  if (!gh.authenticated) report.problems.push('Нет токена: доступно только чтение. Для слияния нужен GITHUB_TOKEN с правами contents:write и pull-requests:write.');
  else if (report.permissions && !report.permissions.push) report.problems.push('У токена нет права записи (push) в репозиторий.');
  return report;
}

/** Собирает факты о PR из GitHub и локального анализа и выносит решение. */
export async function inspectPr(gh, number, { cwd, runTests = true, analyze = analyzePr, repoInfo } = {}) {
  const pr = await gh.getPr(number);
  const [runs, statuses] = await Promise.all([gh.checkRuns(pr.head.sha), gh.statuses(pr.head.sha)]);
  const repo = repoInfo || await gh.getRepo().catch(() => null);
  let local = null, analysisError = null;
  if (pr.state === 'open') {
    try { local = analyze(cwd, number, { runTests, base: BASE }); } catch (e) { analysisError = e.message; }
  }
  // Анализ и GitHub должны говорить об одной и той же голове PR.
  const sameHead = local && local.headSha === pr.head.sha;
  const facts = {
    repo: pr.base.repo.full_name, number, state: pr.state, merged: Boolean(pr.merged), draft: Boolean(pr.draft),
    baseRef: pr.base.ref, headSha: pr.head.sha, labels: (pr.labels || []).map(l => l.name), updatedAt: pr.updated_at,
    ci: summarizeCi(runs, statuses),
    conflicts: sameHead ? local.conflicts : (pr.mergeable === false ? true : null),
    behindBy: sameHead ? local.behindBy : null,
    removal: sameHead ? local.removal : null,
    secrets: sameHead ? local.secrets : null,
    sensitiveFiles: sameHead ? local.sensitiveFiles : null,
    testsPassed: sameHead ? local.testsPassed : null,
    buildPassed: sameHead ? local.buildPassed : null,
    allowedMergeMethods: allowedMergeMethods(repo),
  };
  const decision = evaluate(facts);
  if (analysisError) decision.checks.push({ id: 'analysis', label: 'Локальный анализ', ok: false, detail: analysisError });
  if (local && !sameHead) decision.checks.push({ id: 'analysis', label: 'Локальный анализ', ok: false, detail: 'голова PR изменилась во время проверки — повторите' });
  if (decision.checks.some(c => !c.ok)) decision.eligible = false;
  return {
    pr: { number, title: pr.title, url: pr.html_url, head: pr.head.ref, headRepo: pr.head.repo?.full_name || null, author: pr.user?.login },
    facts, decision,
    details: local ? { conflictFiles: local.conflictFiles, changedFiles: local.changedFiles.length, aheadBy: local.aheadBy, testLog: local.testLog } : null,
  };
}

/**
 * Слияние одного PR. По умолчанию — пробный прогон (execute=false): всё проверяется, но ничего не меняется.
 * Слияние выполняется только при eligible === true; используется sha головы, поэтому изменённый после проверки PR
 * GitHub не сольёт (ответ 409).
 */
export async function mergePr(gh, number, { cwd, journal, execute = false, runTests = true, analyze, dispatchDeploy = true, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  if (!journal.acquire()) return { result: 'locked', message: 'Другой запуск Merge Engine ещё выполняется.' };
  try {
    const inspection = await inspectPr(gh, number, { cwd, runTests, analyze });
    const { facts, decision, pr } = inspection;
    if (facts.merged || journal.alreadyMerged(number, facts.headSha)) {
      journal.write({ op: 'merge', pr: number, headSha: facts.headSha, result: 'skipped', reason: 'уже слит' });
      return { result: 'already-merged', inspection };
    }
    if (!decision.eligible) {
      journal.write({ op: 'merge', pr: number, headSha: facts.headSha, result: 'blocked', reasons: decision.checks.filter(c => !c.ok).map(c => `${c.label}: ${c.detail}`) });
      return { result: 'blocked', inspection };
    }
    if (!execute) {
      journal.write({ op: 'merge', pr: number, headSha: facts.headSha, result: 'dry-run' });
      return { result: 'dry-run', inspection };
    }
    if (!gh.authenticated) return { result: 'no-auth', inspection, message: 'Нет токена GitHub — слияние невозможно.' };

    const merged = await gh.merge(number, { sha: facts.headSha, method: MERGE_METHOD, title: `${pr.title} (#${number})` });
    if (!merged || !merged.merged) {
      journal.write({ op: 'merge', pr: number, headSha: facts.headSha, result: 'failed', reason: merged?.message || 'GitHub не подтвердил слияние' });
      return { result: 'failed', inspection, message: merged?.message };
    }
    journal.write({ op: 'merge', pr: number, headSha: facts.headSha, result: 'merged', mergeSha: merged.sha });

    const verify = await verifyAfterMerge(gh, { mergeSha: merged.sha, dispatchDeploy, sleep });
    const branch = await deleteHeadBranch(gh, pr, number);
    journal.write({ op: 'verify', pr: number, mergeSha: merged.sha, ...verify, branch });
    return { result: 'merged', mergeSha: merged.sha, verify, branch, inspection };
  } finally {
    journal.release();
  }
}

/** Удаляет ветку PR после слияния — только временную ветку этого же репозитория, не защищённую и не нужную другим PR. */
export async function deleteHeadBranch(gh, pr, number) {
  if (!pr.head || pr.headRepo !== REPO) return { deleted: false, reason: 'ветка из форка или неизвестна' };
  if (PROTECTED_BRANCHES.has(pr.head)) return { deleted: false, reason: 'защищённое имя ветки' };
  try {
    const branch = await gh.getBranch(pr.head);
    if (branch.protected) return { deleted: false, reason: 'ветка защищена' };
    const others = (await gh.listPrsForHead(REPO.split('/')[0], pr.head)).filter(p => p.number !== number);
    if (others.length) return { deleted: false, reason: `ветку использует PR #${others[0].number}` };
    await gh.deleteBranch(pr.head);
    return { deleted: true };
  } catch (e) {
    return { deleted: false, reason: e.message };
  }
}

/**
 * После слияния: main указывает на коммит слияния; публикация запущена и завершилась успешно.
 * Упавшую публикацию запускаем заново (до deployRetries раз) отдельным запуском workflow: «Re-run» того же
 * запуска не помогает — GitHub видит в нём два артефакта github-pages и снова падает.
 */
export async function verifyAfterMerge(gh, { mergeSha, dispatchDeploy = true, sleep, attempts = 20, intervalMs = 15000, deployRetries = 1 }) {
  const out = { mainSha: null, mainMatches: false, deploy: 'unknown', deployRetries: 0, failedRuns: [] };
  const main = await gh.getBranch(BASE);
  out.mainSha = main.commit.sha;
  out.mainMatches = main.commit.sha === mergeSha;
  const dispatch = async () => {
    try { await gh.dispatchWorkflow('pages.yml', BASE); return true; } catch (e) { out.deployError = e.message; return false; }
  };
  // Слияние токеном GITHUB_TOKEN не запускает workflow по push — публикацию запускаем явно.
  if (dispatchDeploy) out.deployDispatched = await dispatch();
  const failed = new Set();
  for (let i = 0; i < attempts; i++) {
    const runs = await gh.workflowRuns('pages.yml', `&branch=${BASE}`).catch(() => []);
    // Самый свежий запуск для коммита слияния, кроме уже признанных неудачными.
    const run = runs.filter(r => r.head_sha === mergeSha && !failed.has(r.id))
      .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0) || (b.id || 0) - (a.id || 0))[0];
    if (run) {
      out.deployRun = run.html_url;
      if (run.status !== 'completed') out.deploy = 'in-progress';
      else if (run.conclusion === 'success') { out.deploy = 'deployed'; return out; }
      else {
        out.deploy = `failed (${run.conclusion})`;
        out.failedRuns.push(run.html_url);
        failed.add(run.id);
        if (out.deployRetries >= deployRetries || !(await dispatch())) return out;
        out.deployRetries++;
        out.deploy = 'retrying';
      }
    }
    if (i < attempts - 1) await sleep(intervalMs);
  }
  return out; // не подтверждено — так и сообщаем, сайт не считается опубликованным
}

/** Сводка по всем открытым PR для панели и отчёта. */
export async function statusReport(gh, { cwd, runTests = false, analyze } = {}) {
  const [repoInfo, prs, main, merged] = await Promise.all([
    gh.getRepo().catch(() => null), gh.listOpenPrs(), gh.getBranch(BASE), gh.listMergedPrs().catch(() => []),
  ]);
  const items = [];
  for (const p of prs) items.push(await inspectPr(gh, p.number, { cwd, runTests, analyze, repoInfo }));
  const count = s => items.filter(i => i.decision.status === s).length;
  const deployRuns = await gh.workflowRuns('pages.yml', `&branch=${BASE}`).catch(() => []);
  return {
    checkedAt: new Date().toISOString(), repo: REPO, mainSha: main.commit.sha,
    totals: { open: items.length, ready: count('ready'), blocked: items.length - count('ready') - count('conflict'), conflict: count('conflict'), draft: count('draft') },
    deploy: deployRuns[0] ? { sha: deployRuns[0].head_sha, status: deployRuns[0].status, conclusion: deployRuns[0].conclusion, url: deployRuns[0].html_url } : null,
    recentMerges: merged.slice(0, 5).map(p => ({ number: p.number, title: p.title, mergedAt: p.merged_at, sha: p.merge_commit_sha })),
    items,
  };
}
