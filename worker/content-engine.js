import { modelOutput, usageOf, addUsage, aboutNiche } from './ai-utils.js';

export const CONTENT_STAGES = [
  { id: 'strategy', label: 'Стратегия и первый экран', schema: 'brand,niche,title,description,cta,targetAudience,mainOffer,visualDirection,strategySummary — строки', fields: ['brand','niche','title','description','cta','targetAudience','mainOffer','visualDirection','strategySummary'], required: ['title','description','cta'], maxTokens: 1800 },
  { id: 'about', label: 'О компании', schema: 'aboutTitle,aboutText — строки', fields: ['aboutTitle','aboutText'], required: ['aboutTitle','aboutText'], maxTokens: 900 },
  { id: 'services', label: 'Услуги', schema: 'servicesTitle,servicesIntro — строки; services — массив [название, описание, цена]', fields: ['servicesTitle','servicesIntro','services'], required: ['services'], maxTokens: 1500 },
  { id: 'trust', label: 'Преимущества, процесс и FAQ', schema: 'advantagesTitle,processTitle — строки; advantages,process — массивы [название, описание]; faqs — массив [вопрос, ответ]', fields: ['advantagesTitle','advantages','processTitle','process','faqs'], required: ['advantages','process','faqs'], maxTokens: 1700 },
  { id: 'seo', label: 'Контакты и SEO', schema: 'contactTitle,contactText,marketResearch,seoTitle,seoDescription — строки; assumptions,objections,triggers,keywords,competitors,imagePrompts — массивы строк; segments — массив объектов {name,need}; researchSources — массив объектов {title,url}, оставь пустым без проверенных источников', fields: ['contactTitle','contactText','assumptions','marketResearch','researchSources','segments','objections','triggers','keywords','competitors','seoTitle','seoDescription','imagePrompts'], required: ['contactTitle','contactText','seoTitle','seoDescription'], maxTokens: 1400 },
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
      'Формат полей: ' + stage.schema + '.',
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
        if (stage.id === 'strategy' && !aboutNiche(parsed, brief.niche)) {
          stageError = 'Текст первого экрана не соответствует нише «' + brief.niche + '»';
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


/** Regenerate exactly one content group against the current project, without touching other groups. */
export async function regenerateContentStage({
  env, model, brief, stageId, existingLanding = {}, editorialDirection = '', runTextModel, preferNvidia = false,
}) {
  const stage = CONTENT_STAGES.find(item => item.id === stageId);
  if (!stage) throw new Error('Неизвестный этап генерации');
  const landing = {};
  for (const key of new Set(['brand','niche', ...CONTENT_STAGES.flatMap(item => item.fields)])) {
    if (Object.prototype.hasOwnProperty.call(existingLanding, key)) landing[key] = existingLanding[key];
  }
  const facts = [
    'Ниша бизнеса клиента: ' + brief.niche + '.',
    brief.brand ? 'Название бренда: ' + brief.brand + '.' : 'Название бренда не указано — не придумывай его.',
    brief.city ? 'Город: ' + brief.city + '.' : '',
    'Уровень: ' + brief.tier + '.',
    brief.details ? 'Подробности от владельца: ' + brief.details : '',
  ].filter(Boolean).join('\n');
  const context = [
    facts,
    landing.strategySummary ? 'Стратегия бренда: ' + landing.strategySummary : '',
    'Текущие данные проекта: ' + JSON.stringify(landing).slice(0, 12000),
    editorialDirection ? 'Редакторское направление: ' + editorialDirection.slice(0, 2000) : '',
  ].filter(Boolean).join('\n\n');
  const prompt = [
    'Ты AI Content Director коммерческого сайта. Перегенерируй только один указанный раздел, сохранив согласованность с остальным проектом.',
    'Пиши по-русски, конкретно и естественно. Не меняй другие разделы.',
    'Не выдумывай цены, адреса, отзывы, сертификаты, гарантии, статистику и конкурентов.',
    'Если фактов недостаточно, не заполняй пробелы выдумками.',
    'Верни только валидный JSON-объект. Разрешённые ключи: ' + stage.fields.join(', ') + '. Не добавляй другие ключи.',
    'Формат полей: ' + stage.schema + '.',
    'Этап: ' + stage.label + '.',
    context,
  ].join('\n\n');
  let usage = null, provider = 'cloudflare', usedModel = model, lastError = '';
  const started = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const execution = await runTextModel(env, model, {
        messages: [{ role: 'user', content: attempt ? prompt + '\n\nСократи текст и верни полный валидный JSON с обязательными полями.' : prompt }],
        max_tokens: stage.maxTokens,
        temperature: 0.45,
      }, { preferNvidia });
      provider = execution.provider;
      usedModel = execution.model;
      preferNvidia = provider === 'nvidia';
      usage = addUsage(usage, usageOf(execution.result));
      const parsed = parseJson(modelOutput(execution.result));
      const validation = validateContentStage(stage, parsed);
      if (!validation.ok) {
        lastError = 'Нет обязательных полей: ' + validation.missing.join(', ');
        continue;
      }
      if (stage.id === 'strategy' && !aboutNiche(parsed, brief.niche)) {
        lastError = 'Текст не соответствует нише «' + brief.niche + '»';
        continue;
      }
      const result = {};
      mergeContentStage(result, stage, parsed);
      if (stage.id === 'strategy') { result.brand = brief.brand || ''; result.niche = brief.niche; }
      return {
        stage: { id: stage.id, label: stage.label, status: 'completed', attempts: attempt + 1 },
        content: result, provider, model: usedModel, usage, durationMs: Date.now() - started,
      };
    } catch (error) {
      lastError = error?.message || 'Ошибка этапа генерации';
    }
  }
  return {
    stage: { id: stage.id, label: stage.label, status: 'failed', attempts: 2, error: lastError },
    provider, model: usedModel, usage, durationMs: Date.now() - started,
  };
}
