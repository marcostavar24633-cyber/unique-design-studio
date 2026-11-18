import { modelOutput, usageOf, addUsage } from './ai-utils.js';

const TEXT_FIELDS = ['title','description','cta','targetAudience','mainOffer','aboutTitle','aboutText','servicesTitle','servicesIntro','advantagesTitle','processTitle','contactTitle','contactText','seoTitle','seoDescription'];
const LIMITS = { title: 75, seoTitle: 60, seoDescription: 160 };

function safeText(value, max = 1200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseReview(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error('AI вернул невалидный JSON проверки качества');
}

export function scoreContentQuality(project = {}) {
  const findings = [];
  const add = (id, severity, category, message, action) => findings.push({ id, severity, category, message, action });
  const title = safeText(project.title, 300);
  const description = safeText(project.description, 1200);
  const cta = safeText(project.cta, 120);
  const seoTitle = safeText(project.seoTitle, 300);
  const seoDescription = safeText(project.seoDescription, 600);
  if (!title) add('title-missing','high','content','Не заполнен главный заголовок','Сформулируйте конкретный результат или предложение для клиента.');
  else if (title.length > LIMITS.title) add('title-long','medium','seo','Главный заголовок длиннее 75 символов','Сократите заголовок, сохранив нишу и главное отличие.');
  if (!description) add('description-missing','high','content','Нет описания основного предложения','Объясните, что получает клиент и для кого предназначена услуга.');
  if (!cta) add('cta-missing','high','conversion','Не задан призыв к действию','Добавьте понятный следующий шаг: записаться, получить расчёт или связаться.');
  if (!seoTitle) add('seo-title-missing','medium','seo','Не заполнен SEO Title','Добавьте уникальный заголовок страницы с основной услугой и брендом, если он известен.');
  else if (seoTitle.length > LIMITS.seoTitle) add('seo-title-long','medium','seo','SEO Title длиннее 60 символов','Сократите до ясного заголовка без повторов.');
  if (!seoDescription) add('seo-description-missing','medium','seo','Не заполнен SEO Description','Кратко опишите услугу, аудиторию и подтверждённую пользу.');
  else if (seoDescription.length > LIMITS.seoDescription) add('seo-description-long','low','seo','SEO Description длиннее 160 символов','Сократите описание, оставив главное предложение и следующий шаг.');
  const corpus = TEXT_FIELDS.map(key => safeText(project[key], 1200)).filter(Boolean).join(' ').toLocaleLowerCase('ru');
  const words = corpus.match(/[а-яёa-z]{4,}/giu) || [];
  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  const repeated = [...counts.entries()].filter(([word,count]) => count >= 5 && !['который','которая','которые','этого','также','вашего','вашей','чтобы','можете'].includes(word)).sort((a,b)=>b[1]-a[1]).slice(0,3);
  if (repeated.length) add('repetition','medium','content','В текстах часто повторяются слова: ' + repeated.map(([word,count])=>word+' ('+count+')').join(', '),'Проверьте повторы и замените их только там, где это улучшает естественность.');
  const risky = /\b(гарантируем|100% результат|номер один|лучший в городе|без риска)\b/iu;
  if (TEXT_FIELDS.some(key => risky.test(safeText(project[key],1200)))) add('claims-review','medium','trust','Есть сильные обещания или превосходные заявления','Подтвердите каждое обещание фактами либо смягчите формулировку.');
  const score = Math.max(0, Math.min(100, 100 - findings.reduce((sum,item)=>sum+({high:18,medium:9,low:4}[item.severity]||0),0)));
  return { score, findings, metrics: { textFields: TEXT_FIELDS.filter(key=>safeText(project[key])).length, totalFields: TEXT_FIELDS.length, words: words.length }, limits: LIMITS };
}

export async function reviewContentQuality({ env, model, project, editorialDirection = '', runTextModel }) {
  const deterministic = scoreContentQuality(project);
  const context = {};
  for (const key of [...TEXT_FIELDS,'niche','brand','services','advantages','faqs','keywords']) {
    const value = project?.[key];
    if (typeof value === 'string') context[key] = value.slice(0, 1200);
    else if (Array.isArray(value)) context[key] = value.slice(0, 8);
  }
  const prompt = [
    'Ты старший редактор и SEO-специалист коммерческих сайтов. Проведи редакторский аудит перед публикацией.',
    'Оцени ясность предложения, соответствие нише, конкретику, повторы, CTA, SEO Title и Description, естественность ключевых слов и неподтверждённые обещания.',
    'Не утверждай, что проверял поисковую выдачу, частотность ключей, конкурентов или внешние факты: веб-поиска нет.',
    'Не выдумывай факты. Отличай редакторские гипотезы от проверяемых утверждений.',
    'Верни только JSON: {"recommendations":[{"category":"content|seo|conversion|trust","priority":"high|medium|low","issue":"...","recommendation":"...","field":"название поля или пустая строка"}]}. До 5 рекомендаций.',
    'Не переписывай тексты и не возвращай готовые патчи. Только диагностика и следующий шаг.',
    editorialDirection ? 'Редакторское направление: '+editorialDirection.slice(0,1000) : '',
    'Контент проекта: '+JSON.stringify(context),
    'Автоматические замечания: '+JSON.stringify(deterministic.findings),
  ].filter(Boolean).join('\n\n');
  let usage = null, provider = 'cloudflare', usedModel = model;
  const execution = await runTextModel(env, model, {
    messages: [{ role:'user', content:prompt }],
    max_tokens: 1300,
    temperature: 0.25,
  });
  provider = execution.provider;
  usedModel = execution.model;
  usage = addUsage(usage, usageOf(execution.result));
  const parsed = parseReview(modelOutput(execution.result));
  const allowedCategories = new Set(['content','seo','conversion','trust']);
  const allowedPriorities = new Set(['high','medium','low']);
  const recommendations = (Array.isArray(parsed.recommendations) ? parsed.recommendations : []).slice(0,5).map((item,index)=>({
    id: 'quality-ai-'+index,
    category: allowedCategories.has(item?.category) ? item.category : 'content',
    priority: allowedPriorities.has(item?.priority) ? item.priority : 'medium',
    issue: safeText(item?.issue,300) || 'Требуется редакторская проверка',
    recommendation: safeText(item?.recommendation,500) || 'Проверьте формулировку вручную.',
    field: TEXT_FIELDS.includes(item?.field) || ['services','advantages','faqs'].includes(item?.field) ? item.field : '',
  }));
  return {
    review: {
      version: 1, score: deterministic.score, findings: deterministic.findings,
      metrics: deterministic.metrics, recommendations,
      status: deterministic.findings.length || recommendations.length ? 'review-needed' : 'looks-good',
      safety: { contentChanged:false, webSearchPerformed:false, requiresHumanReview:true },
    },
    provider, model: usedModel, usage,
  };
}
