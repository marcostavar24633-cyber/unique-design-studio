import { modelOutput, usageOf, addUsage } from './ai-utils.js';

export const CONTENT_STAGES = [
  { id: 'strategy', label: 'Стратегия и первый экран', fields: ['brand','niche','title','description','cta','targetAudience','mainOffer','visualDirection','strategySummary'], required: ['title','description','cta'], maxTokens: 1800 },
  { id: 'about', label: 'О компании', fields: ['aboutTitle','aboutText'], required: ['aboutTitle','aboutText'], maxTokens: 900 },
  { id: 'services', label: 'Услуги', fields: ['servicesTitle','servicesIntro','services'], required: ['services'], maxTokens: 1500 },
  { id: 'trust', label: 'Преимущества, процесс и FAQ', fields: ['advantagesTitle','advantages','processTitle','process','faqs'], required: ['advantages','process','faqs'], maxTokens: 1700 },
  { id: 'seo', label: 'Контакты и SEO', fields: ['contactTitle','contactText','assumptions','marketResearch','researchSources','segments','objections','triggers','keywords','competitors','seoTitle','seoDescription','imagePrompts'], required: ['contactTitle','contactText','seoTitle','seoDescription'], maxTokens: 1400 },
];

function parseJson(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error('Модель вернула невалидный JSON');
}

export function validateContentStage(stage, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, missing: ['JSON-объект'] };
  const missing = stage.required.filter(key => {
    const item = value[key];
    if (Array.isArray(item)) return item.length === 0;
    return typeof item !== 'string' || !item.trim();
  });
  return { ok: missing.length === 0, missing };
}

export function mergeContentStage(target, stage, value) {
  for (const key of stage.fields) {
    if (Object.prototype.hasOwnProperty.call(value, key)) target[key] = value[key];
  }
  return target;
}

/**
 * Generates independent content groups. A failed group is retried without discarding
 * successful groups; callers receive a partial landing plus an explicit failed-stage record.
 */
export async function generateContentInStages({
  env, model, brief, facts, studioPrompt, formatNote, runTextModel, preferNvidia = false,
}) {
  const landing = { brand: brief.brand || '', niche: brief.niche };
  const stages = [];
  let usage = null;
  let provider = 'cloudflare';
  let usedModel = model;
  const started = Date.now();
  let strategySummary = '';

  for (const stage of CONTENT_STAGES) {
    const allowed = stage.fields.join(', ');
    const context = stage.id === 'strategy'
      ? [facts, studioPrompt].filter(Boolean).join('\n\n')
      : [
          facts,
          strategySummary ? 'Стратегия бренда: ' + strategySummary : '',
          'Уже созданные данные (не повторяй их дословно): ' + JSON.stringify(landing),
        ].filter(Boolean).join('\n');
    const prompt = [
      'Ты AI Content Engine коммерческого сайта. Пиши на русском, конкретно и естественно.',
      'Ниша и факты владельца имеют приоритет. Не выдумывай цены, адреса, отзывы, сертификаты, гарантии, статистику и конкурентов.',
      'Если данных недостаточно, обозначь это в assumptions; не утверждай, что проводил веб-поиск.',
      'Верни только валидный JSON-объект. Разрешённые ключи этого этапа: ' + allowed + '. Не добавляй другие ключи.',
      'Для services верни массив элементов [название, описание, цена]; неизвестную цену оставляй пустой строкой.',
      'Для advantages, process, faqs, assumptions, marketResearch, researchSources, segments, objections, triggers, keywords, competitors, imagePrompts используй массивы строк или массивы массивов строк только там, где это очевидно по смыслу.',
      'Этап: ' + stage.label + '.',
      context,
    ].filter(Boolean).join('\n\n');

    let stageResult = null;
    let stageError = '';
    let stageUsage = null;
    let stageProvider = provider;
    let stageModel = usedModel;
    let attempts = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      attempts++;
      try {
        const execution = await runTextModel(env, model, {
          messages: [{ role: 'user', content: attempt === 0 ? prompt : prompt + '\n\nПредыдущий ответ был неполным. Сократи тексты и верни все обязательные ключи этапа в полном JSON.' }],
          max_tokens: stage.maxTokens,
          temperature: 0.45,
        }, { preferNvidia });
        stageProvider = execution.provider;
        stageModel = execution.model;
        preferNvidia = stageProvider === 'nvidia';
        const raw = execution.result;
        stageUsage = addUsage(stageUsage, usageOf(raw));
        const parsed = parseJson(modelOutput(raw));
        const validation = validateContentStage(stage, parsed);
        if (!validation.ok) {
          stageError = 'Нет обязательных полей: ' + validation.missing.join(', ');
          continue;
        }
        stageResult = parsed;
        stageError = '';
        break;
      } catch (error) {
        stageError = error?.message || 'Ошибка этапа генерации';
      }
    }
    usage = addUsage(usage, stageUsage);
    provider = stageProvider;
    usedModel = stageModel;
    if (stageResult) {
      mergeContentStage(landing, stage, stageResult);
      if (stage.id === 'strategy') strategySummary = String(stageResult.strategySummary || '').slice(0, 1200);
      stages.push({ id: stage.id, label: stage.label, status: 'completed', attempts, usage: stageUsage });
    } else {
      stages.push({ id: stage.id, label: stage.label, status: 'failed', attempts, error: stageError, usage: stageUsage });
      return {
        landing, provider, model: usedModel, usage, durationMs: Date.now() - started,
        generation: { mode: 'staged', status: 'partial', stages, completedStages: stages.filter(item => item.status === 'completed').length, failedStage: stage.id },
      };
    }
  }

  return {
    landing, provider, model: usedModel, usage, durationMs: Date.now() - started,
    generation: { mode: 'staged', status: 'completed', stages, completedStages: stages.length, failedStage: null },
  };
}
