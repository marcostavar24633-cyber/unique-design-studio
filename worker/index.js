import { modelOutput, MAX_OUTPUT_TOKENS, RETRY_NOTE, missingFields, aboutNiche, allowRequest, usageOf, addUsage, FORMAT_NOTE } from './ai-utils.js';
import { runTextModel, DEFAULT_NVIDIA_MODEL, isFreeAiMode, isNvidiaFallbackEnabled } from './nvidia.js';
import { isGatewayConfigured } from './gateway.js';

const MODEL = '@cf/google/gemma-4-26b-a4b-it';
const ALLOWED_ORIGINS = new Set([
  'https://marcostavar24633-cyber.github.io',
]);
const MAX_BODY_BYTES = 48_000;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
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

/**
 * Текст ответа модели из любого формата Workers AI: классического ({ response }), вложенного
 * ({ result: { response } }) и совместимого с OpenAI ({ choices: [{ message: { content } }] }) — его
 * возвращают новые модели, например Gemma 4. Раньше такой ответ проверялся как пустая обёртка.
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const url = new URL(request.url);
    if (url.pathname === '/' && request.method === 'GET') {
      return json({
        ok: true,
        service: 'unique-design-studio-ai',
        status: 'online',
        endpoints: {
          health: '/health',
          usage: '/api/usage',
          generate: 'POST /api/generate-landing',
        },
      }, 200, origin);
    }
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'unique-design-studio-ai' }, 200, origin);
    }
    if (url.pathname === '/api/diagnostics') {
      if (request.method !== 'GET') return json({ error: 'Метод не поддерживается' }, 405, origin);
      if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Источник запроса не разрешён' }, 403, origin);
      return json({
        ok: true,
        service: 'unique-design-studio-ai',
        runtime: {
          analyticsTokenConfigured: Boolean(env.CF_ANALYTICS_TOKEN),
          accountIdConfigured: Boolean(env.CF_ACCOUNT_ID),
          workersAiBindingConfigured: Boolean(env.AI),
          aiGatewayConfigured: isGatewayConfigured(env),
          aiBillingMode: isFreeAiMode(env) ? 'free' : String(env.AI_BILLING_MODE || 'non-free'),
          nvidiaFallbackConfigured: isNvidiaFallbackEnabled(env),
          nvidiaModel: env.NVIDIA_MODEL || DEFAULT_NVIDIA_MODEL,
        },
      }, 200, origin);
    }
    if (url.pathname === '/api/usage') {
      if (request.method !== 'GET') return json({ error: 'Метод не поддерживается' }, 405, origin);
      if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Источник запроса не разрешён' }, 403, origin);
      if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) {
        return json({ error: 'Не настроены секрет CF_ANALYTICS_TOKEN и переменная CF_ACCOUNT_ID' }, 503, origin);
      }

      const range = url.searchParams.get('range') || '24h';
      const hoursByRange = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };
      if (range !== 'today' && !Object.prototype.hasOwnProperty.call(hoursByRange, range)) {
        return json({ error: 'Допустимые периоды: today, 24h, 7d, 30d' }, 400, origin);
      }

      const end = new Date();
      // today — с 00:00 UTC: в это время Cloudflare сбрасывает суточный бесплатный объём Workers AI.
      const start = range === 'today'
        ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
        : new Date(end.getTime() - hoursByRange[range] * 60 * 60 * 1000);
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
        const inputTokens = groups.reduce((total, item) => total + Number(item.sum?.totalInputTokens || 0), 0);
        const outputTokens = groups.reduce((total, item) => total + Number(item.sum?.totalOutputTokens || 0), 0);
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
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          requests,
          models,
          source: 'Cloudflare GraphQL Analytics',
          note: 'Аналитические данные могут поступать с задержкой и не являются расчётом биллинга.',
        }, 200, origin);
      } catch (error) {
        return json({ error: 'Не удалось связаться с Cloudflare Analytics', details: error?.message || 'Network error' }, 502, origin);
      }
    }
    if (url.pathname === '/api/generate-image') {
      if (request.method !== 'POST') return json({ error: 'Метод не поддерживается' }, 405, origin);
      if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Источник запроса не разрешён' }, 403, origin);
      if (!env.AI) return json({ error: 'Workers AI binding AI не настроен' }, 503, origin);
      if (!(await allowRequest(request, env))) return json({ error: 'Слишком много запросов. Повторите через минуту.' }, 429, origin);
      let input;
      try {
        const raw = await request.text();
        if (raw.length > 6000) return json({ error: 'Слишком большой запрос' }, 413, origin);
        input = JSON.parse(raw);
      } catch {
        return json({ error: 'Некорректный JSON' }, 400, origin);
      }
      const prompt = String(input.prompt || '').trim().slice(0, 2048);
      if (!prompt) return json({ error: 'Укажите описание изображения' }, 400, origin);
      try {
        const generated = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 4 });
        if (!generated?.image || typeof generated.image !== 'string') {
          return json({ error: 'Модель не вернула изображение' }, 502, origin);
        }
        return json({ image: generated.image, mimeType: 'image/jpeg', model: '@cf/black-forest-labs/flux-1-schnell' }, 200, origin);
      } catch (error) {
        return json({ error: 'Не удалось сгенерировать изображение', details: error?.message || 'Workers AI error' }, 502, origin);
      }
    }
    if (url.pathname !== '/api/generate-landing') {
      return json({ error: 'Маршрут не найден' }, 404, origin);
    }
    if (request.method !== 'POST') return json({ error: 'Метод не поддерживается' }, 405, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Источник запроса не разрешён' }, 403, origin);
    if (!env.AI || typeof env.AI.run !== 'function') return json({ error: 'Workers AI binding AI не настроен' }, 503, origin);
    if (!(await allowRequest(request, env))) return json({ error: 'Слишком много запросов. Повторите через минуту.' }, 429, origin);

    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > MAX_BODY_BYTES) return json({ error: 'Слишком большой запрос' }, 413, origin);

    let input;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'Слишком большой запрос' }, 413, origin);
      input = JSON.parse(raw);
    } catch {
      return json({ error: 'Некорректный JSON' }, 400, origin);
    }

    if (input.task === 'design-review') {
      const source = input.project && typeof input.project === 'object' && !Array.isArray(input.project) ? input.project : {};
      const fields = {
        niche: String(source.niche || '').slice(0, 180),
        brand: String(source.brand || '').slice(0, 160),
        title: String(source.title || '').slice(0, 300),
        description: String(source.description || '').slice(0, 1200),
        cta: String(source.cta || '').slice(0, 120),
        targetAudience: String(source.targetAudience || '').slice(0, 600),
        mainOffer: String(source.mainOffer || '').slice(0, 800),
        services: Array.isArray(source.services) ? source.services.slice(0, 12) : [],
        advantages: Array.isArray(source.advantages) ? source.advantages.slice(0, 12) : [],
        faqs: Array.isArray(source.faqs) ? source.faqs.slice(0, 10) : [],
      };
      const allowed = new Set(['title','description','cta','targetAudience','mainOffer','aboutTitle','aboutText','servicesTitle','servicesIntro','advantagesTitle','processTitle','faqTitle','contactTitle','contactText']);
      const designPrompt = String(input.designPrompt || '').trim().slice(0, 1800);
      const system = [
        'Ты AI Design Director коммерческих сайтов. Проведи конкретное ревью проекта и предложи улучшения.',
        'Верни только JSON: {"recommendations":[{"id":"...","title":"...","category":"conversion|structure|visual|content|accessibility|quality","priority":"high|medium|low","reason":"...","action":"...","patch":{"title":"новый текст"}}]}.',
        'Не более 6 рекомендаций. Patch необязателен; если есть, используй только разрешённые текстовые поля.',
        'Не выдумывай цены, сроки, гарантии, отзывы, сертификаты, адреса, цифры и факты о компании.',
        'Не создавай HTML, CSS, JavaScript, ссылки, изображения или произвольные поля. Не применяй изменения автоматически.',
        'Пиши по-русски, кратко и предметно. Если данных недостаточно, укажи это в рекомендации.',
        designPrompt ? 'Дополнительные инструкции владельца для Design Director (не отменяют JSON-контракт и ограничения безопасности):\n' + designPrompt : '',
      ].join('\n');
      const user = JSON.stringify({ project: fields, analysis: input.analysis || {}, concept: input.concept || {}, audit: input.audit || {} });
      try {
        const { result, provider, model } = await runTextModel(env, MODEL, {
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens: 1800,
          temperature: 0.35,
        });
        const parsed = extractJson(modelOutput(result));
        const recommendations = (Array.isArray(parsed?.recommendations) ? parsed.recommendations : []).slice(0, 6).map((item, index) => {
          const patch = {};
          if (item?.patch && typeof item.patch === 'object' && !Array.isArray(item.patch)) {
            for (const [key, value] of Object.entries(item.patch)) {
              if (allowed.has(key) && typeof value === 'string' && value.trim() && value.length <= 1800) patch[key] = value.trim();
            }
          }
          return {
            id: String(item?.id || 'ai-review-' + index).replace(/[^a-z0-9-]/gi, '').slice(0, 64) || 'ai-review-' + index,
            title: String(item?.title || 'Рекомендация').slice(0, 180),
            category: ['conversion','structure','visual','content','accessibility','quality'].includes(item?.category) ? item.category : 'content',
            priority: ['high','medium','low'].includes(item?.priority) ? item.priority : 'medium',
            reason: String(item?.reason || '').slice(0, 600),
            action: String(item?.action || '').slice(0, 600),
            patch: Object.keys(patch).length ? patch : null,
          };
        });
        return json({ review: { version: 1, mode: provider === 'nvidia' ? 'nvidia-nim' : provider === 'cloudflare' ? 'workers-ai' : 'ai-gateway', provider, model, status: recommendations.length ? 'review-needed' : 'looks-good', recommendations, safety: { autoApplied: false, requiresApproval: true } } }, 200, origin);
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

    // Факты о бизнесе — первыми и обычным текстом: Gemma на Workers AI теряла бриф из JSON после длинной
    // инструкции и писала сайт про саму «студию веб-дизайна» (brand «Не указано», niche «Веб-дизайн»).
    const facts = [
      `Ниша бизнеса клиента: ${brief.niche}.`,
      brief.brand ? `Название бренда: ${brief.brand}.` : 'Название бренда не указано — не придумывай его.',
      brief.city ? `Город: ${brief.city}.` : '',
      `Уровень: ${brief.tier}.`,
      brief.details ? `Подробности от владельца: ${brief.details}` : '',
      brief.customPrompt ? `Пожелания владельца (${brief.customPromptMode === 'replace' ? 'главнее задания студии' : 'дополнительно'}): ${brief.customPrompt}` : '',
    ].filter(Boolean).join('\n');

    const system = [
      `Ты AI-копирайтер и стратег. Пишешь тексты для сайта бизнеса клиента в нише «${brief.niche}» — не для веб-студии и не про создание сайтов.`,
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
      'ДАННЫЕ БИЗНЕСА:',
      facts,
      studioPrompt ? '\nЗадание и требования движка студии:\n' + studioPrompt : '',
      `\nСформируй контент и анализ по указанной JSON-структуре. Все тексты — про бизнес в нише «${brief.niche}».`,
      FORMAT_NOTE,
    ].join('\n');
    // Одно сообщение: шаблон чата Gemma не поддерживает отдельную системную роль.
    const prompt = system + '\n\n' + user;

    // Две попытки: если ответ оборвался или в нём нет обязательных частей, просим короче. Больше — не тратим квоту.
    let lastError = 'AI вернул неполный результат';
    let usage = null; // фактические токены всех попыток — для журнала AI-операций студии
    let provider = 'cloudflare';
    let usedModel = MODEL;
    let preferNvidia = false;
    const started = Date.now();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const execution = await runTextModel(env, MODEL, {
          messages: [{ role: 'user', content: attempt === 0 ? prompt : prompt + RETRY_NOTE }],
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.55,
        }, { preferNvidia });
        const { result } = execution;
        provider = execution.provider;
        usedModel = execution.model;
        preferNvidia = provider === 'nvidia';
        usage = addUsage(usage, usageOf(result));
        const landing = extractJson(modelOutput(result));
        const missing = missingFields(landing);
        if (!missing.length && !aboutNiche(landing, brief.niche)) {
          lastError = `AI написал текст не про нишу «${brief.niche}»`;
          continue;
        }
        if (!missing.length) {
          // Бренд и ниша — факты владельца, а не догадка модели.
          landing.niche = brief.niche;
          if (brief.brand) landing.brand = brief.brand;
          else if (/не указ/i.test(String(landing.brand || ''))) landing.brand = '';
          return json({ landing, attempts: attempt + 1, provider, model: usedModel, usage, durationMs: Date.now() - started }, 200, origin);
        }
        // Только имена ключей, без содержимого: помогает понять, в каком формате пришёл ответ.
        const keys = result && typeof result === 'object' ? Object.keys(result).slice(0, 8).join(', ') : typeof result;
        lastError = `AI вернул неполный результат: нет ${missing.join(', ')} (ключи ответа модели: ${keys || 'нет'})`;
      } catch (error) {
        lastError = error?.message || 'Ошибка генерации Workers AI';
      }
    }
    return json({ error: lastError, attempts: 2, provider, model: usedModel, usage, durationMs: Date.now() - started }, 502, origin);
  },
};
