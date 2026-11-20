import { NO_THINKING, modelOutput, usageOf, addUsage, aboutNiche } from './ai-utils.js';

export const CONTENT_STAGES = [
  { id: 'strategy', label: 'Стратегия и первый экран', schema: 'brand,niche,title,description,cta,targetAudience,mainOffer,visualDirection,strategySummary — строки', fields: ['brand','niche','title','description','cta','targetAudience','mainOffer','visualDirection','strategySummary'], required: ['title','description','cta'], maxTokens: 1800 },
  { id: 'about', label: 'О компании', schema: 'aboutTitle,aboutText — строки', fields: ['aboutTitle','aboutText'], required: ['aboutTitle','aboutText'], maxTokens: 900 },
  { id: 'services', label: 'Услуги', schema: 'servicesTitle,servicesIntro — строки; services — массив [название, описание, цена]', fields: ['servicesTitle','servicesIntro','services'], required: ['services'], arrayFields: ['services'], rowFields: ['services'], maxItems: { services: 6 }, maxTokens: 1500 },
  { id: 'trust', label: 'Преимущества, процесс и FAQ', schema: 'advantagesTitle,processTitle — строки; advantages,process — массивы [название, описание]; faqs — массив [вопрос, ответ]', fields: ['advantagesTitle','advantages','processTitle','process','faqs'], required: ['advantages','process','faqs'], arrayFields: ['advantages','process','faqs'], rowFields: ['advantages','process','faqs'], maxItems: { advantages: 4, process: 4, faqs: 5 }, maxTokens: 1700 },
  { id: 'seo', label: 'Контакты и SEO', schema: 'contactTitle,contactText,marketResearch,seoTitle,seoDescription — строки; assumptions,objections,triggers,keywords,competitors,imagePrompts — массивы строк; segments — массив объектов {name,need}; researchSources — массив объектов {title,url}, оставь пустым без проверенных источников', fields: ['contactTitle','contactText','assumptions','marketResearch','researchSources','segments','objections','triggers','keywords','competitors','seoTitle','seoDescription','imagePrompts'], required: ['contactTitle','contactText','seoTitle','seoDescription'], arrayFields: ['assumptions','researchSources','segments','objections','triggers','keywords','competitors','imagePrompts'], objectFields: { researchSources: ['title','url'], segments: ['name','need'] }, maxItems: { assumptions: 5, researchSources: 5, segments: 5, objections: 5, triggers: 5, keywords: 5, competitors: 5, imagePrompts: 5 }, stringFields: ['marketResearch'], maxTokens: 1400 },
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
  const invalid = [];
  for (const key of stage.stringFields || []) {
    if (value[key] !== undefined && typeof value[key] !== 'string') invalid.push(key + ' (ожидается строка)');
  }
  for (const key of stage.arrayFields || []) {
    if (value[key] !== undefined && !Array.isArray(value[key])) invalid.push(key + ' (ожидается массив)');
    else if (Array.isArray(value[key]) && value[key].length > (stage.maxItems?.[key] || 10)) invalid.push(key + ' (слишком много элементов)');
  }
  for (const key of stage.rowFields || []) {
    if (Array.isArray(value[key]) && value[key].some(row => !Array.isArray(row) || row.length < 2 || row.some(cell => typeof cell !== 'string'))) {
      invalid.push(key + ' (ожидаются массивы строк)');
    }
  }
  for (const [key, requiredKeys] of Object.entries(stage.objectFields || {})) {
    if (Array.isArray(value[key]) && value[key].some(item => !item || typeof item !== 'object' || Array.isArray(item) || requiredKeys.some(field => typeof item[field] !== 'string'))) {
      invalid.push(key + ' (неверная структура объектов)');
    }
  }
  return { ok: missing.length === 0 && invalid.length === 0, missing: [...missing, ...invalid] };
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
  let route;
  const started = Date.now();
  let strategySummary = '';
  // Свой промт владельца входит в studioPrompt, который получает только первый этап. Остальным этапам
  // (услуги, FAQ, SEO) он передаётся отдельной строкой, иначе указания вроде «без слова „лучший“» терялись.
  const ownerPrompt = brief.customPrompt ? 'Пожелания владельца (' + (brief.customPromptMode === 'replace' ? 'главнее задания студии' : 'дополнительно') + '): ' + brief.customPrompt : '';

  for (const stage of CONTENT_STAGES) {
    const allowed = stage.fields.join(', ');
    const context = stage.id === 'strategy'
      ? [facts, studioPrompt].filter(Boolean).join('\n\n')
      : [
          facts,
          strategySummary ? 'Стратегия бренда: ' + strategySummary : '',
          ownerPrompt,
          'Уже созданные данные (не повторяй их дословно): ' + JSON.stringify(landing),
        ].filter(Boolean).join('\n');
    const prompt = [
      'Ты AI Content Engine коммерческого сайта. Пиши на русском, конкретно и естественно.',
      'Ниша и факты владельца имеют приоритет. Не выдумывай цены, адреса, отзывы, сертификаты, гарантии, статистику и конкурентов.',
      'Если данных недостаточно, обозначь это в assumptions; не утверждай, что проводил веб-поиск.',
      'Верни только валидный JSON-объект. Разрешённые ключи этого этапа: ' + allowed + '. Не добавляй другие ключи.',
      'Для services верни массив элементов [название, описание, цена]; неизвестную цену оставляй пустой строкой.',
      'Для advantages, process, faqs, assumptions, marketResearch, researchSources, segments, objections, triggers, keywords, competitors, imagePrompts используй массивы строк или массивы массивов строк только там, где это очевидно по смыслу.',
      context,
      // Указания этапа идут последними: в задании студии описана вся структура лендинга, и без этого
      // модель писала все разделы сразу, упиралась в лимит этапа и обрывала JSON.
      'ЭТАП: ' + stage.label + '. Верни ТОЛЬКО ключи: ' + allowed + '. Остальные разделы сайта будут созданы отдельно — не пиши их.',
      'Формат полей: ' + stage.schema + '.',
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
          ...NO_THINKING,
        }, { preferNvidia });
        stageProvider = execution.provider;
        stageModel = execution.model;
        if (execution.route) route = execution.route;
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
        landing, provider, model: usedModel, route, usage, durationMs: Date.now() - started,
        generation: { mode: 'staged', status: 'partial', stages, completedStages: stages.filter(item => item.status === 'completed').length, failedStage: stage.id },
      };
    }
  }

  return {
    landing, provider, model: usedModel, route, usage, durationMs: Date.now() - started,
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
        ...NO_THINKING,
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


export const EDITABLE_CONTENT_FIELDS = new Set([
  'title','description','cta','targetAudience','mainOffer','visualDirection','strategySummary',
  'aboutTitle','aboutText','servicesTitle','servicesIntro','advantagesTitle','processTitle',
  'contactTitle','contactText','seoTitle','seoDescription',
]);

/** Rewrite one selected string without changing any other project field. */
export async function editContentField({
  env, model, brief, field, action, currentValue, existingLanding = {}, editorialDirection = '', runTextModel,
}) {
  if (!EDITABLE_CONTENT_FIELDS.has(field)) throw new Error('Это поле нельзя редактировать через AI');
  if (!['rewrite','expand','shorten'].includes(action)) throw new Error('Неизвестная команда редактора');
  const value = String(currentValue || '').trim().slice(0, 3000);
  if (!value) throw new Error('Сначала введите текст для редактирования');
  const actionInstruction = {
    rewrite: 'Перепиши текст яснее и выразительнее, сохранив смысл и примерно ту же длину.',
    expand: 'Расширь текст полезными подробностями и ясностью. Не добавляй неподтверждённые факты.',
    shorten: 'Сократи текст, сохранив главную мысль и конкретную пользу.',
  }[action];
  const prompt = [
    'Ты редактор коммерческого сайта. Работаешь только с одним текстовым полем.',
    'Пиши по-русски. Сохраняй исходный язык, смысл, факты, тон бренда и связь с нишей.',
    'Не выдумывай цены, адреса, отзывы, сертификаты, гарантии, сроки, статистику и обещания.',
    'Верни только JSON вида {"value":"готовый текст"}. Не добавляй Markdown и пояснения.',
    'Поле: ' + field + '.',
    'Ниша: ' + brief.niche + '. Бренд: ' + (brief.brand || 'не указан') + '.',
    actionInstruction,
    editorialDirection ? 'Редакторское направление: ' + editorialDirection.slice(0, 2000) : '',
    'Контекст проекта: ' + JSON.stringify(existingLanding).slice(0, 9000),
    'Исходный текст: ' + value,
  ].filter(Boolean).join('\n\n');
  let usage = null, provider = 'cloudflare', usedModel = model, lastError = '';
  const started = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const execution = await runTextModel(env, model, {
        messages: [{ role: 'user', content: attempt ? prompt + '\n\nВерни корректный JSON с непустым value. Не добавляй другие поля.' : prompt }],
        max_tokens: 700,
        temperature: 0.4,
        ...NO_THINKING,
      });
      provider = execution.provider;
      usedModel = execution.model;
      usage = addUsage(usage, usageOf(execution.result));
      const parsed = parseJson(modelOutput(execution.result));
      if (typeof parsed?.value !== 'string' || !parsed.value.trim() || parsed.value.length > 3000) {
        lastError = 'AI вернул пустой текст или неверный формат';
        continue;
      }
      return { field, action, value: parsed.value.trim(), provider, model: usedModel, usage, attempts: attempt + 1, durationMs: Date.now() - started };
    } catch (error) {
      lastError = error?.message || 'Ошибка AI-редактора';
    }
  }
  throw new Error(lastError || 'AI не смог отредактировать текст');
}
