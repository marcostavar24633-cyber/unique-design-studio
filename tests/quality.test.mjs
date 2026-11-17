// Контроль качества: направления, уровни, безопасные автоисправления и защита от бесконечного цикла.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/engine/index.js';
import { autopilot } from '../src/engine/autopilot.js';
import { CATEGORIES, SEVERITIES, applyAutoFixes, clipWords, fixAndRecheck, qualityReport } from '../src/engine/quality.js';
import { runWorkflow, WORKFLOW_STAGES } from '../src/engine/workflow.js';

const project = niche => autopilot({ niche, email: 'hello@example.com' }, { registry: [] }).project;

test('14 направлений и 4 уровня серьёзности; каждое замечание классифицировано', () => {
  assert.equal(Object.keys(CATEGORIES).length, 14);
  assert.deepEqual(SEVERITIES, ['critical', 'high', 'medium', 'low']);
  const r = qualityReport(generate(project('кофейня')));
  assert.ok(r.findings.length > 0);
  for (const f of r.findings) {
    assert.ok(CATEGORIES[f.category], `направление ${f.category}`);
    assert.ok(SEVERITIES.includes(f.severity), `уровень ${f.severity}`);
    assert.equal(typeof f.message, 'string');
  }
  // Сначала самые серьёзные.
  const ranks = r.findings.map(f => SEVERITIES.indexOf(f.severity));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  assert.equal(r.counts.critical + r.counts.high + r.counts.medium + r.counts.low, r.findings.length);
});

test('опасные ссылки и выдуманные цены — Critical', () => {
  const g = generate({ ...project('кофейня'), ctaUrl: 'javascript:alert(1)' });
  const fake = { ...g, audit: { ...g.audit, errors: [{ id: 'no-invented-prices', level: 'error', message: 'цена' }, { id: 'safe-urls', level: 'error', message: 'ссылка' }] } };
  const r = qualityReport(fake);
  assert.equal(r.findings.find(f => f.id === 'audit:no-invented-prices').severity, 'critical');
  assert.equal(r.findings.find(f => f.id === 'audit:safe-urls').category, 'security');
});

test('нераспознанная ниша отмечается как проблема соответствия нише', () => {
  const r = qualityReport(generate({ brand: 'X', niche: 'нечто совсем непонятное', title: 'Заголовок', cta: 'Связаться' }));
  assert.ok(r.findings.some(f => f.id === 'niche:generic' && f.category === 'niche'));
});

test('автоисправление SEO-описания собирает текст только из фраз проекта и попадает в норму', () => {
  const p = project('кофейня');
  const g = generate(p);
  const r = qualityReport(g);
  const seo = r.findings.find(f => f.id === 'audit:seo-description-length');
  assert.ok(seo && seo.autoFix, 'замечание помечено как исправимое');
  const { project: fixed, applied } = applyAutoFixes(p, r.findings);
  assert.deepEqual(applied.map(a => a.id), ['audit:seo-description-length']);
  assert.ok(fixed.seoDescription.length >= 120 && fixed.seoDescription.length <= 160);
  const source = [p.description, p.mainOffer, p.servicesIntro, p.aboutText].join(' ');
  for (const sentence of fixed.seoDescription.split(/(?<=[.!?])\s+/)) assert.ok(source.includes(sentence), `фраза из проекта: ${sentence}`);
  assert.equal(p.seoDescription, undefined, 'исходный проект не изменён');
  assert.match(generate(fixed).html, new RegExp(`<meta name="description" content="${fixed.seoDescription.slice(0, 30)}`));
});

test('если норму не достичь имеющимся текстом — исправление не предлагается', () => {
  const r = qualityReport(generate(project('ремонт велосипедов')));
  const seo = r.findings.find(f => f.id === 'audit:seo-description-length');
  if (seo) assert.equal(seo.autoFix, false);
});

test('цикл исправлений ограничен и останавливается, когда менять нечего', () => {
  let calls = 0;
  const regenerate = raw => { calls++; return generate(raw); };
  const r = fixAndRecheck(project('кофейня'), regenerate, { maxPasses: 5 });
  assert.ok(r.passes.length <= 1, 'одно исправление — один проход');
  assert.equal(r.stoppedBy, 'nothing-to-fix');
  assert.ok(r.after.counts.medium < r.before.counts.medium);
  assert.equal(calls, r.passes.length + 1);
  // Жёсткий предел: даже если «исправление» всегда находится, проходов не больше maxPasses.
  let n = 0;
  const flaky = raw => { const g = generate(raw); g.audit = { ...g.audit, warnings: [{ id: 'seo-title-length', level: 'warn', message: 'x' }] }; g.project = { ...g.project, title: `Заголовок номер ${++n} для бесконечной проверки` }; return g; };
  const limited = fixAndRecheck(project('кофейня'), flaky, { maxPasses: 2 });
  assert.ok(limited.passes.length <= 2);
});

test('clipWords режет по границе слова', () => {
  assert.equal(clipWords('Свежая обжарка каждый день', 14), 'Свежая обжарка');
  assert.equal(clipWords('коротко', 60), 'коротко');
});

test('конвейер: этап качества между аудитом и Design Director, автоисправления фиксируются', async () => {
  assert.deepEqual(WORKFLOW_STAGES.slice(6, 9), ['audit', 'quality', 'design_review']);
  const r = await runWorkflow({ niche: 'кофейня', email: 'hello@example.com' });
  const q = r.stages.findLast(s => s.id === 'quality');
  assert.ok(['completed', 'needs_attention'].includes(q.status));
  assert.ok(q.before && q.after && typeof q.score === 'number');
  assert.ok(r.quality.findings);
  if (q.autoFixed.length) assert.ok(r.project.seoDescription || r.project.seoTitle);
  const off = await runWorkflow({ niche: 'кофейня', email: 'hello@example.com' }, { autoFix: false });
  assert.equal(off.autoFixes.length, 0, 'без autoFix проект не меняется');
  assert.equal(off.stages.find(s => s.id === 'publish').status, 'manual', 'публикация не объявляется выполненной');
});

test('вкладка «Производство» подключена к студии, а публикация не объявляется выполненной', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.match(html, /id="tab-production" aria-controls="view-production"/);
  assert.match(html, /<section id="view-production" role="tabpanel"/);
  assert.match(js, /renderAudit\(\); renderProduction\(\);/);
  assert.match(js, /fixAndRecheck\(state\.raw, raw => generate\(raw, \{ registry: registry\(\) \}\), \{ maxPasses: 2 \}\)/, 'ограниченное число проходов');
  assert.match(js, /\['Публикация', 'manual'/);
  assert.match(js, /\['seoTitle', 'SEO-заголовок \(title\)'/);
  assert.match(js, /\$\{esc\(f\.message\)\}/, 'тексты замечаний экранируются');
});
