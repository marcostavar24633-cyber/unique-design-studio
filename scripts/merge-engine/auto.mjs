#!/usr/bin/env node
// Автоматическое слияние: не более одного PR за запуск.
// Только PR из основного репозитория, созданные владельцем репозитория.
// Все обязательные проверки и локальные тесты/сборка повторно выполняются перед squash.
import { fileURLToPath } from 'node:url';
import { REPO } from '../../src/merge/rules.mjs';
import { createJournal, mergePr } from './engine.mjs';
import { createGitHub } from './github.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const owner = REPO.split('/')[0];
const gh = createGitHub({ repo: REPO });
const journal = createJournal(process.env.MERGE_ENGINE_STATE || `${root}/.merge-engine`);
const summaryFile = process.env.GITHUB_STEP_SUMMARY;

const writeSummary = async text => {
  console.log(text);
  if (summaryFile) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(summaryFile, text + '\n');
  }
};

async function main() {
  if (!gh.authenticated) throw new Error('GITHUB_TOKEN отсутствует: автоматическое слияние отключено.');
  const prs = await gh.listOpenPrs();
  // Не сливаем PR внешних авторов и PR из форков автоматически.
  const candidates = prs
    .filter(p => p.user?.login === owner && p.base?.ref === 'main' && p.base?.repo?.full_name === REPO && !p.draft)
    .sort((a, b) => Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0));

  await writeSummary(`## Автоматический Merge Engine\nОткрытых PR: ${prs.length}; кандидатов владельца: ${candidates.length}. За один запуск будет слит не более одного PR.`);
  if (!candidates.length) {
    await writeSummary('Нет PR владельца, подходящих для автоматической проверки. Внешние PR автоматически не сливаются.');
    return;
  }

  for (const pr of candidates) {
    const result = await mergePr(gh, pr.number, { cwd: root, journal, execute: true, runTests: true });
    const checks = result.inspection?.decision?.checks || [];
    await writeSummary(`### PR #${pr.number}: ${result.result}\n${checks.map(c => `- ${c.ok ? '✓' : '✗'} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`).join('\n')}`);
    if (result.result === 'merged') {
      await writeSummary(`Слияние: ${result.mergeSha}. Публикация Pages: ${result.verify?.deploy || 'не подтверждена'}. Запуск Worker: ${result.verify?.workerDeployDispatched ? 'отправлен' : 'не подтверждён'}.`);
      return;
    }
    if (result.result === 'locked') throw new Error(result.message);
    // Заблокированный PR не останавливает проверку следующих собственных PR.
  }
  await writeSummary('В этом запуске нет PR, прошедших все проверки. Слияния не выполнялись.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
