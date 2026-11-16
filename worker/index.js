const MODEL = '@cf/google/gemma-4-26b-a4b-it';
const ALLOWED_ORIGINS = new Set([
  'https://marcostavar24633-cyber.github.io',
]);
const MAX_BODY_BYTES = 24_000;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

function extractJson(value) {
  if (value && typeof value === 'object') return value;
  const text = String(value || '').trim()
    .replace(/^\u0060\u0060\u0060(?:json)?\s*/i, '')
    .replace(/\s*\u0060\u0060\u0060$/, '');
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error('Модель вернула ответ не в формате JSON');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'unique-design-studio-ai' }, 200, origin);
    }
    if (url.pathname !== '/api/generate-landing') {
      return json({ error: 'Маршрут не найден' }, 404, origin);
    }
    if (request.method !== 'POST') return json({ error: 'Метод не поддерживается' }, 405, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Источник запроса не разрешён' }, 403, origin);
    if (!env.AI) return json({ error: 'Workers AI binding AI не настроен' }, 503, origin);

    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > MAX_BODY_BYTES) return json({ error: 'Слишком большой запрос' }, 413, origin);

    let input;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) return json({ error: 'Слишком большой запрос' }, 413, origin);
      input = JSON.parse(raw);
    } catch {
      return json({ error: 'Некорректный JSON' }, 400, origin);
    }

    if (input.task === 'design-review') {
      const project = input.project && typeof input.project === 'object' ? input.project : {};
      const context = {
        niche: String(project.niche || '').slice(0, 180),
        brand: String(project.brand || '').slice(0, 160),
        title: String(project.title || '').slice(0, 300),
        description: String(project.description || '').slice(0, 1200),
        cta: String(project.cta || '').slice(0, 120),
        targetAudience: String(project.targetAudience || '').slice(0, 600),
        mainOffer: String(project.mainOffer || '').slice(0, 800),
        aboutTitle: String(project.aboutTitle || '').slice(0, 200),
        aboutText: String(project.aboutText || '').slice(0, 1000),
        servicesTitle: String(project.servicesTitle || '').slice(0, 200),
        servicesIntro: String(project.servicesIntro || '').slice(0, 600),
        advantagesTitle: String(project.advantagesTitle || '').slice(0, 200),
        processTitle: String(project.processTitle || '').slice(0, 200),
        faqTitle: String(project.faqTitle || '').slice(0, 200),
        contactTitle: String(project.contactTitle || '').slice(0, 200),
        contactText: String(project.contactText || '').slice(0, 600),
      };
      const allowed = new Set(['title','description','cta','targetAudience','mainOffer','aboutTitle','aboutText','servicesTitle','servicesIntro','advantagesTitle','processTitle','faqTitle','contactTitle','contactText']);
      const system = [
        'Ты AI Design Director коммерческих сайтов. Проведи конкретное ревью проекта и предложи улучшения.',
        'Верни только JSON: {"recommendations":[{"id":"...","title":"...","category":"...","priority":"high|medium|low","reason":"...","action":"...","patch":{"field":"новое значение"}}]}.',
        'Предлагай до 6 рекомендаций. Для каждого patch используй только одно или несколько полей из allowlist.',
        'Не выдумывай цены, гарантии, сроки, отзывы, сертификаты, цифры, адреса, ассортимент или факты о компании.',
        'Если факт не подтверждён, не включай его в patch. Не генерируй HTML, CSS, JavaScript, URL, изображения или произвольные поля.',
        'Тексты на русском, короткие, конкретные. Не меняй поле, если улучшение неочевидно.',
      ].join('\n');
      const user = JSON.stringify({ project: context, analysis: input.analysis || {}, concept: input.concept || {}, audit: input.audit || {} });
      try {
        const result = await env.AI.run(MODEL, {
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens: 1800,
          temperature: 0.35,
        });
        const parsed = extractJson(result?.response ?? result?.result?.response ?? result);
        const recommendations = (Array.isArray(parsed?.recommendations) ? parsed.recommendations : []).slice(0, 6).map((item, index) => {
          const patch = {};
          if (item?.patch && typeof item.patch === 'object' && !Array.isArray(item.patch)) {
            for (const [key, value] of Object.entries(item.patch)) {
              if (allowed.has(key) && typeof value === 'string' && value.trim() && value.length <= 1800) patch[key] = value.trim();
            }
          }
          return {
            id: String(item?.id || 'ai-review-' + index).replace(/[^a-z0-9-]/gi, '').slice(0, 64) || 'ai-review-' + index,
            title: String(item?.title || 'Улучшение проекта').slice(0, 180),
            category: String(item?.category || 'content').slice(0, 40),
            priority: ['high','medium','low'].includes(item?.priority) ? item.priority : 'medium',
            reason: String(item?.reason || '').slice(0, 600),
            action: String(item?.action || '').slice(0, 600),
            patch: Object.keys(patch).length ? patch : null,
          };
        });
        return json({ review: { version: 1, mode: 'workers-ai', status: recommendations.length ? 'review-needed' : 'looks-good', recommendations, safety: { autoApplied: false, requiresApproval: true } } }, 200, origin);
      } catch (error) {
        return json({ error: error?.message || 'Ошибка AI Design Director' }, 502, origin);
      }
    }

    const niche = String(input.niche || '').trim().slice(0, 180);
    if (!niche) return json({ error: 'Укажите нишу проекта' }, 400, origin);
    const studioPrompt = String(input.studioPrompt || '').slice(0, 16000);
    const brief = {
      niche,
      brand: String(input.brand || '').slice(0, 160),
      city: String(input.city || '').slice(0, 120),
      tier: String(input.tier || 'standard').slice(0, 30),
      details: String(input.details || '').slice(0, 3000),
      customPrompt: String(input.customPrompt || '').slice(0, 8000),
      customPromptMode: input.customPromptMode === 'replace' ? 'replace' : 'append',
    };

    const system = [
      'Ты AI-копирайтер и стратег для студии веб-дизайна.',
      'Верни только один валидный JSON-объект без Markdown и пояснений.',
      'Не выдумывай цены, адреса, отзывы, сертификаты, гарантии, статистику и названия конкурентов.',
      'Если данных нет, укажи это в assumptions. Не утверждай, что проводил веб-поиск: у тебя нет инструмента поиска.',
      'Пиши на русском. Все тексты должны быть конкретными, естественными и пригодными для коммерческой страницы.',
      'services, advantages, process, faqs — массивы массивов строк; остальные списки — массивы строк.',
      'Структура JSON: brand,niche,title,description,cta,targetAudience,mainOffer,visualDirection,strategySummary,aboutTitle,aboutText,servicesTitle,servicesIntro,services,advantagesTitle,advantages,processTitle,process,faqs,contactTitle,contactText,assumptions,marketResearch,researchSources,segments,objections,triggers,keywords,competitors,seoTitle,seoDescription,imagePrompts.',
      'researchSources должен быть пустым массивом, если нет проверенных источников. competitors не заполняй вымышленными названиями.',
      'services: до 6 элементов [название, описание, цена]; цену оставляй пустой, если она не предоставлена.',
      'Верни достаточно содержательный результат для одностраничного сайта, но не создавай фиктивные факты.',
    ].join('\n');

    const user = [
      'Данные проекта:',
      JSON.stringify(brief),
      studioPrompt ? '\nЗадание и требования движка студии:\n' + studioPrompt : '',
      '\nСформируй контент и анализ по указанной JSON-структуре.',
    ].join('\n');

    try {
      const result = await env.AI.run(MODEL, {
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: 3000,
        temperature: 0.55,
      });
      const rawOutput = result?.response ?? result?.result?.response ?? result;
      const landing = extractJson(rawOutput);
      if (!landing || typeof landing !== 'object' || Array.isArray(landing) || !landing.title) {
        throw new Error('AI вернул неполный результат');
      }
      return json({ landing }, 200, origin);
    } catch (error) {
      return json({ error: error?.message || 'Ошибка генерации Workers AI' }, 502, origin);
    }
  },
};
