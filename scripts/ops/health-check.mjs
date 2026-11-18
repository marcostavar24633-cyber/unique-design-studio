#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const DEFAULT_SITE_URL = 'https://marcostavar24633-cyber.github.io/unique-design-studio/';
const DEFAULT_WORKER_URL = 'https://unique-design-studio-ai.marcostavar24633.workers.dev';
const ORIGIN = 'https://marcostavar24633-cyber.github.io';
const TIMEOUT_MS = 15_000;

export function isWorkerHealthPayload(value) {
  return value?.ok === true && value?.service === 'unique-design-studio-ai';
}

export function isAiProbePayload(value) {
  return Boolean(value?.review && typeof value.review === 'object'
    && Array.isArray(value.review.recommendations)
    && ['review-needed', 'looks-good'].includes(value.review.status)
    && value.review.safety?.autoApplied === false);
}

async function requestJson(url, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs || TIMEOUT_MS),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { response, data, text };
}

async function checkUrl(label, url, options = {}) {
  const { response, data, text } = await requestJson(url, options);
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  return { label, status: response.status, data, text };
}

async function reportFailure(failures) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY || 'marcostavar24633-cyber/unique-design-studio';
  if (!token) throw new Error('GITHUB_TOKEN отсутствует: не удалось создать Issue');
  const api = `https://api.github.com/repos/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const title = '[Autonomy Monitor] Проверка доступности Unique Design Studio';
  const body = [
    'Автоматический монитор обнаружил сбой.',
    '',
    `Время UTC: ${new Date().toISOString()}`,
    '',
    ...failures.map(item => `- **${item.label}**: ${item.message}`),
    '',
    'Проверьте GitHub Actions → Health Monitor. Секреты и тела пользовательских запросов в отчёт не включаются.',
  ].join('\n');

  const list = await fetch(`${api}/issues?state=open&per_page=100`, { headers });
  if (!list.ok) throw new Error(`GitHub issue lookup failed: HTTP ${list.status}`);
  const issues = await list.json();
  const existing = Array.isArray(issues) ? issues.find(item => item.title === title && !item.pull_request) : null;
  const endpoint = existing ? `${api}/issues/${existing.number}` : `${api}/issues`;
  const payload = existing ? { body } : { title, body };
  const result = await fetch(endpoint, { method: existing ? 'PATCH' : 'POST', headers, body: JSON.stringify(payload) });
  if (!result.ok) throw new Error(`GitHub issue report failed: HTTP ${result.status}`);
  const issue = await result.json();
  console.log(`Health failure recorded: ${existing ? existing.html_url : issue.html_url}`);
}

export async function runHealthChecks({ siteUrl = process.env.SITE_URL || DEFAULT_SITE_URL, workerUrl = process.env.WORKER_URL || DEFAULT_WORKER_URL, aiProbe = false, workerOnly = false } = {}) {
  const failures = [];
  const results = [];
  if (!workerOnly) {
    try {
      const site = await checkUrl('Studio Pages', siteUrl, { headers: { Accept: 'text/html' } });
      if (!/<!doctype html|<html/i.test(site.text)) throw new Error('ответ не похож на HTML-страницу');
      results.push('Studio Pages: OK');
    } catch (error) { failures.push({ label: 'Studio Pages', message: error.message }); }
  }

  try {
    const health = await checkUrl('AI Worker /health', new URL('/health', workerUrl));
    if (!isWorkerHealthPayload(health.data)) throw new Error('неожиданный JSON health-ответ');
    results.push('AI Worker /health: OK');
  } catch (error) { failures.push({ label: 'AI Worker /health', message: error.message }); }

  try {
    const diagnostics = await checkUrl('AI Worker /api/diagnostics', new URL('/api/diagnostics', workerUrl), {
      headers: { Origin: ORIGIN, Accept: 'application/json' },
    });
    if (diagnostics.data?.ok !== true || diagnostics.data?.runtime?.workersAiBindingConfigured !== true) {
      throw new Error('Workers AI binding не подтверждён диагностикой');
    }
    results.push('Workers AI binding: OK');
  } catch (error) { failures.push({ label: 'Workers AI binding', message: error.message }); }

  if (aiProbe) {
    try {
      const probe = await checkUrl('Workers AI inference probe', new URL('/api/generate-landing', workerUrl), {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          task: 'design-review',
          project: {
            niche: 'кофейня',
            brand: 'Тестовая кофейня',
            title: 'Кофе каждый день',
            description: 'Небольшая проверка структуры ответа',
            cta: 'Посмотреть меню',
            targetAudience: 'Гости кофейни',
            mainOffer: 'Кофе и выпечка',
            services: ['Кофе'],
            advantages: ['Свежая обжарка'],
            faqs: [],
          },
          designPrompt: 'Сделай одну короткую рекомендацию для smoke test. Не используй внешние данные.',
        }),
        timeoutMs: 120_000,
      });
      if (!isAiProbePayload(probe.data)) throw new Error('инференция не вернула корректный контракт Design Review');
      results.push('Workers AI inference: OK');
    } catch (error) { failures.push({ label: 'Workers AI inference', message: error.message }); }
  }

  for (const item of results) console.log(item);
  if (failures.length) {
    try { await reportFailure(failures); }
    catch (error) { console.error(`Не удалось создать Issue: ${error.message}`); }
    for (const item of failures) console.error(`FAIL ${item.label}: ${item.message}`);
    process.exitCode = 1;
  }
  return { ok: failures.length === 0, results, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runHealthChecks({ aiProbe: process.argv.includes('--ai'), workerOnly: process.argv.includes('--worker-only') }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
