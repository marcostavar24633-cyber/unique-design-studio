// Единый производственный конвейер UNIQUE DESIGN STUDIO.
// Оркестрирует существующий локальный движок; внешние AI-сервисы подключаются адаптерами.
import { draftFromNiche, buildSpec } from './autopilot.js';
import { generate } from './index.js';

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
  applyApprovedFixes,
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

  report('analysis', 'completed', {
    source: analysis.source,
    niche: analysis.niche,
    audience: analysis.audience,
    segments: analysis.segments || [],
    objections: analysis.objections || [],
    keywords: analysis.keywords || [],
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

  let designReview = null;
  if (isFunction(designDirector)) {
    report('design_review', 'running');
    designReview = await designDirector({
      project: generated.project,
      analysis,
      concept: generated.concept,
      html: generated.html,
      audit: generated.audit,
      imageBrief,
      visualAssets,
    });
    report('design_review', 'completed', { review: designReview });
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
    concept: generated.concept,
    spec,
    imageBrief,
    visualAssets,
    html: generated.html,
    audit: generated.audit,
    designReview,
    fixes,
    exported,
    stages,
    registry: generated.registry,
  };
}

export const WORKFLOW_STAGES = Object.freeze([
  'brief', 'analysis', 'concept', 'visual', 'generation',
  'audit', 'design_review', 'approved_fixes', 'export', 'publish',
]);
