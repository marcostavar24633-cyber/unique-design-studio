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

// 3000 токенов не хватало на полный JSON лендинга — ответ обрывался посередине (см. PR #45).
export const MAX_OUTPUT_TOKENS = 6000;
export const RETRY_NOTE = '\n\nПредыдущий ответ оборвался или был неполным. Ответь короче: тексты — до двух предложений, списки — до 4 элементов. Верни только один полный валидный JSON-объект.';

/** Обязательные части ответа, без которых студия не соберёт страницу. */
export function missingFields(landing) {
  if (!landing || typeof landing !== 'object' || Array.isArray(landing)) return ['JSON-объекта'];
  const missing = [];
  for (const key of ['title', 'description', 'cta']) if (typeof landing[key] !== 'string' || !landing[key].trim()) missing.push(key);
  if (!Array.isArray(landing.services) || !landing.services.length) missing.push('services');
  return missing;
}

// Ограничение частоты: проверка Origin не защищает от прямых запросов, а каждый запрос тратит квоту Workers AI.
// Если к Worker привязан Rate Limiting (AI_RATE_LIMITER) — используется он; иначе — запасной счётчик в памяти
// экземпляра (не общий для всех серверов Cloudflare, поэтому лишь сдерживает, а не гарантирует лимит).
export const FALLBACK_LIMIT = { requests: 6, windowMs: 60_000 };
const recent = new Map();
export async function allowRequest(request, env, now = Date.now()) {
  const key = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.AI_RATE_LIMITER && typeof env.AI_RATE_LIMITER.limit === 'function') {
    const { success } = await env.AI_RATE_LIMITER.limit({ key });
    return success;
  }
  const hits = (recent.get(key) || []).filter(t => now - t < FALLBACK_LIMIT.windowMs);
  if (hits.length >= FALLBACK_LIMIT.requests) { recent.set(key, hits); return false; }
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) recent.clear(); // не даём карте расти бесконечно
  return true;
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
    if (url.pathname === '/api/usage') {
      if (request.method !== 'GET') return json({ error: 'Метод не поддерживается' }, 405, origin);
      if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Источник запроса не разрешён' }, 403, origin);
      if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) {
        return json({ error: 'Не настроены секрет CF_ANALYTICS_TOKEN и переменная CF_ACCOUNT_ID' }, 503, origin);
      }

      const range = url.searchParams.get('range') || '24h';
      const hoursByRange = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };
      if (!Object.prototype.hasOwnProperty.call(hoursByRange, range)) {
        return json({ error: 'Допустимые периоды: 24h, 7d, 30d' }, 400, origin);
      }

      const end = new Date();
      const start = new Date(end.getTime() - hoursByRange[range] * 60 * 60 * 1000);
      const query = `query WorkersAIUsage($accountTag: String!, $start: Time!, $end: Time!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            aiInferenceAdaptiveGroups(
              limit: 1000
              filter: { datetime_geq: $start, datetime_leq: $end }
              orderBy: [datetimeHour_ASC]
            ) {
              count
              dimensions { datetimeHour modelId }
              sum { totalNeurons totalInputTokens totalOutputTokens }
            }
          }
        }
      }`;

      try {
        const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.CF_ANALYTICS_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: {
              accountTag: env.CF_ACCOUNT_ID,
              start: start.toISOString(),
              end: end.toISOString(),
            },
          }),
        });
        const payload = await response.json();
        if (!response.ok || payload.errors?.length) {
          return json({
            error: 'Cloudflare Analytics не вернул статистику',
            details: (payload.errors || []).map(item => item.message).join('; ') || `HTTP ${response.status}`,
          }, 502, origin);
        }

        const groups = payload.data?.viewer?.accounts?.[0]?.aiInferenceAdaptiveGroups || [];
        const neurons = groups.reduce((total, item) => total + Number(item.sum?.totalNeurons || 0), 0);
        const requests = groups.reduce((total, item) => total + Number(item.count || 0), 0);
        const models = {};
        for (const item of groups) {
          const name = item.dimensions?.modelId || 'unknown';
          if (!models[name]) models[name] = { neurons: 0, requests: 0 };
          models[name].neurons += Number(item.sum?.totalNeurons || 0);
          models[name].requests += Number(item.count || 0);
        }
        return json({
          range,
          start: start.toISOString(),
          end: end.toISOString(),
          neurons: Number(neurons.toFixed(4)),
          requests,
          models,
          source: 'Cloudflare GraphQL Analytics',
          note: 'Аналитические данные могут поступать с задержкой и не являются расчётом биллинга.',
        }, 200, origin);
      } catch (error) {
        return json({ error: 'Не удалось связаться с Cloudflare Analytics', details: error?.message || 'Network error' }, 502, origin);
      }
    }
    if (url.pathname !== '/api/generate-landing') {
      return json({ error: 'Маршрут не найден' }, 404, origin);
    }
    if (request.method !== 'POST') return json({ error: 'Метод не поддерживается' }, 405, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Источник запроса не разрешён' }, 403, origin);
    if (!env.AI) return json({ error: 'Workers AI binding AI не настроен' }, 503, origin);
    if (!(await allowRequest(request, env))) return json({ error: 'Слишком много запросов. Повторите через минуту.' }, 429, origin);

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

    // Две попытки: если ответ оборвался или в нём нет обязательных частей, просим короче. Больше — не тратим квоту.
    let lastError = 'AI вернул неполный результат';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await env.AI.run(MODEL, {
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: attempt === 0 ? user : user + RETRY_NOTE },
          ],
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.55,
        });
        const rawOutput = result?.response ?? result?.result?.response ?? result;
        const landing = extractJson(rawOutput);
        const missing = missingFields(landing);
        if (!missing.length) return json({ landing, attempts: attempt + 1 }, 200, origin);
        lastError = `AI вернул неполный результат: нет ${missing.join(', ')}`;
      } catch (error) {
        lastError = error?.message || 'Ошибка генерации Workers AI';
      }
    }
    return json({ error: lastError }, 502, origin);
  },
};
