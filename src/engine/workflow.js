// Единый производственный конвейер UNIQUE DESIGN STUDIO.
// Оркестрирует существующий локальный движок; внешние AI-сервисы подключаются адаптерами.
import { draftFromNiche, buildSpec } from './autopilot.js';
import { generate } from './index.js';
import { reviewDesign } from './design-director.js';
import { fixAndRecheck } from './quality.js';
import { runMarketIntelligence } from './market-intelligence.js';

const isFunction = value => typeof value === 'function';

function stage(id, status, details = {}) {
  return { id, status, ...details };
}

/**
 * Полный цикл: brief → analysis → concept → visual brief → HTML → audit → review → export.
 *
 * imageDirector и designDirector — необязательные async-адаптеры.
 * Исправления применяются только при явной передаче applyApprovedFixes:
 * без него рекомендации остаются на проверке пользователя.
 * Публикация намеренно не имитируется: для неё нужен отдельный deploy adapter.
 */
export async function runWorkflow(input, {
  registry = [],
  draft: suppliedDraft,
  imageDirector,
  designDirector,
  marketSearch,
  marketFetchPage,
  marketResearchLimit = 10,
  applyApprovedFixes,
  autoFix = true,
  maxFixPasses = 2,
  onStage,
} = {}) {
  const stages = [];
  const report = (id, status, details) => {
    const item = stage(id, status, details);
    stages.push(item);
    if (isFunction(onStage)) onStage(item);
    return item;
  };

  report('brief', 'running');
  const { project, analysis } = suppliedDraft?.project && suppliedDraft?.analysis
    ? suppliedDraft
    : draftFromNiche(input || {});
  report('brief', 'completed', { assumptions: project.assumptions || [] });

  report('market_research', 'running');
  const marketIntelligence = await runMarketIntelligence({
    project,
    search: marketSearch,
    fetchPage: marketFetchPage,
    limit: marketResearchLimit,
  });
  analysis.marketIntelligence = marketIntelligence;
  analysis.researchStatus = marketIntelligence.status;
  analysis.researchSources = marketIntelligence.sources;
  analysis.marketResearch = marketIntelligence.competitors.map(item =>
    item.analysis
      ? `${item.name} (${item.url}): проанализирована публичная страница; структура: ${(item.analysis.structure?.order || []).join(', ') || 'не определена'}.`
      : `${item.name} (${item.url}): доступен только поисковый результат, полноценный анализ страницы не выполнен.`
  ).join('\\n');
  report('market_research', marketIntelligence.status === 'performed' ? 'completed' : marketIntelligence.status === 'partial' ? 'needs_attention' : 'needs_input', marketIntelligence);

  report('analysis', 'completed', {
    source: analysis.source,
    niche: analysis.niche,
    audience: analysis.audience,
    segments: analysis.segments || [],
    objections: analysis.objections || [],
    keywords: analysis.keywords || [],
    researchStatus: marketIntelligence.status,
    researchSources: marketIntelligence.sources,
  });

  report('concept', 'running');
  // generate() выбирает Design DNA с учётом реестра, строит HTML и выполняет аудит.
  let generated = generate(project, { registry });
  const spec = buildSpec(generated.project, generated.concept, analysis);
  report('concept', 'completed', {
    architecture: generated.concept.designDNA.primaryArchetype,
    rationale: generated.concept.designDNA.selectionRationale,
  });

  const imageBrief = {
    direction: analysis.imageDirection || generated.concept.designDNA.imageDirection,
    prompts: analysis.imagePrompts || [],
    hero: generated.concept.designDNA.imageDirection,
    requiredSlots: ['hero', 'product-or-service', 'process', 'people', 'atmosphere'],
  };
  let visualAssets = null;
  if (isFunction(imageDirector)) {
    report('visual', 'running');
    visualAssets = await imageDirector({ project: generated.project, analysis, concept: generated.concept, brief: imageBrief });
    report('visual', 'completed', { integrated: Boolean(visualAssets) });
  } else {
    report('visual', 'needs_input', { brief: imageBrief, reason: 'Image Director adapter is not configured; upload real photos in the studio.' });
  }

  report('generation', 'completed', {
    html: generated.html,
    format: 'self-contained-html',
  });
  report('audit', generated.audit?.errors?.length ? 'needs_attention' : 'completed', {
    errors: generated.audit?.errors || [],
    warnings: generated.audit?.warnings || [],
  });

  // Контроль качества: замечания по 14 направлениям и безопасные автоисправления с повторной проверкой.
  // Проходов не больше maxFixPasses; цикл останавливается, если исправлять нечего или ничего не изменилось.
  report('quality', 'running');
  const quality = fixAndRecheck(generated.project, raw => generate(raw, { registry }), { maxPasses: autoFix ? maxFixPasses : 0 });
  if (quality.passes.length) generated = quality.generated;
  report('quality', quality.after.counts.critical ? 'needs_attention' : 'completed', {
    before: quality.before.counts, after: quality.after.counts, score: quality.after.score,
    autoFixed: quality.passes.flatMap(p => p.applied), stoppedBy: quality.stoppedBy,
    remaining: quality.after.findings,
  });

  let designReview = null;
  const runDesignReview = isFunction(designDirector)
    ? designDirector
    : async context => ({ ...reviewDesign(context.project, { concept: context.concept, audit: context.audit }), mode: 'rules-based' });
  if (isFunction(runDesignReview)) {
    report('design_review', 'running');
    designReview = await runDesignReview({
      project: generated.project,
      analysis,
      marketIntelligence,
      concept: generated.concept,
      html: generated.html,
      audit: generated.audit,
      imageBrief,
      visualAssets,
    });
    report('design_review', 'completed', { mode: designReview?.mode || 'adapter', review: designReview });
  } else {
    report('design_review', 'needs_input', { reason: 'AI Design Director adapter is not configured.' });
  }

  let fixes = { status: 'not_requested', result: null };
  if (designReview && isFunction(applyApprovedFixes)) {
    report('approved_fixes', 'running');
    const updated = await applyApprovedFixes({ generated, review: designReview });
    if (updated && typeof updated === 'object') generated = updated;
    fixes = { status: 'applied', result: updated || null };
    report('approved_fixes', 'completed');
  } else if (designReview) {
    fixes = { status: 'awaiting_approval', result: null };
    report('approved_fixes', 'needs_approval', { reason: 'Review findings are not applied automatically; provide an explicit approval adapter.' });
  } else {
    report('approved_fixes', 'blocked', { reason: 'A design review is required before applying fixes.' });
  }

  const exported = generated.exported;
  report('export', 'completed', { available: Boolean(exported), format: 'project-json' });
  report('publish', 'manual', { reason: 'Publishing requires a configured hosting/deployment integration.' });

  return {
    project: generated.project,
    analysis,
    marketIntelligence,
    concept: generated.concept,
    spec,
    imageBrief,
    visualAssets,
    html: generated.html,
    audit: generated.audit,
    designReview,
    quality: quality.after,
    autoFixes: quality.passes,
    fixes,
    exported,
    stages,
    registry: generated.registry,
  };
}

export const WORKFLOW_STAGES = Object.freeze([
  'brief', 'market_research', 'analysis', 'concept', 'visual', 'generation',
  'audit', 'quality', 'design_review', 'approved_fixes', 'export', 'publish',
]);
