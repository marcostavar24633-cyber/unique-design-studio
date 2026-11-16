const MODEL = '@cf/google/gemma-4-26b-a4b-it';
const ALLOWED_ORIGINS = new Set([
  'https://marcostavar24633-cyber.github.io',
]);
const MAX_BODY_BYTES = 24_000;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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


const MONITOR_PREFIX = 'monitor:site:';
const MONITOR_MAX_SITES = 50;
const MONITOR_TIMEOUT_MS = 8000;
const MONITOR_MAX_REDIRECTS = 3;

function monitorAllowedHosts(env) {
  return new Set(String(env.MONITOR_ALLOWED_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
}

function monitorSafeUrl(value, env) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('URL должен быть строкой не длиннее 2048 символов');
  let url;
  try { url = new URL(value); } catch { throw new Error('Некорректный URL'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Разрешены только HTTPS URL без учётных данных и нестандартных портов');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test') || host.endsWith('.invalid') || host.endsWith('.example') || host.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) throw new Error('Локальные и IP-адреса запрещены');
  if (!monitorAllowedHosts(env).has(host)) throw new Error('Домен отсутствует в MONITOR_ALLOWED_HOSTS');
  url.hash = '';
  return url;
}

function monitorAuthorized(request, env) {
  const expected = String(env.MONITOR_API_TOKEN || '');
  const actual = String(request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!expected || actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0;
}

function monitorResponse(data, status, origin) {
  return json(data, status, origin);
}

async function monitorFetch(url, env) {
  let current = monitorSafeUrl(url, env);
  for (let redirects = 0; redirects <= MONITOR_MAX_REDIRECTS; redirects++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MONITOR_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(current.toString(), {
        method: 'HEAD', redirect: 'manual', signal: controller.signal,
        headers: { 'User-Agent': 'UniqueDesignStudio-Monitor/1.0' },
      });
      if (response.status === 405 || response.status === 501) {
        try { await response.body?.cancel(); } catch {}
        response = await fetch(current.toString(), {
          method: 'GET', redirect: 'manual', signal: controller.signal,
          headers: { 'User-Agent': 'UniqueDesignStudio-Monitor/1.0', 'Range': 'bytes=0-0' },
        });
      }
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('Location');
        try { await response.body?.cancel(); } catch {}
        if (!location || redirects === MONITOR_MAX_REDIRECTS) return { state: 'http-error', httpStatus: response.status, checkedAt: new Date().toISOString(), detail: 'redirect-limit-or-missing-location' };
        current = monitorSafeUrl(new URL(location, current).toString(), env);
        continue;
      }
      const result = {
        state: response.ok ? 'reachable' : 'http-error',
        httpStatus: response.status,
        checkedAt: new Date().toISOString(),
        finalUrl: current.toString(),
      };
      try { await response.body?.cancel(); } catch {}
      return result;
    } catch (error) {
      return {
        state: error?.name === 'AbortError' ? 'timeout' : 'check-error',
        httpStatus: null,
        checkedAt: new Date().toISOString(),
        detail: String(error?.message || 'network-error').slice(0, 180),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  return { state: 'check-error', httpStatus: null, checkedAt: new Date().toISOString() };
}

async function monitorList(env) {
  const listed = await env.MONITOR_KV.list({ prefix: MONITOR_PREFIX, limit: MONITOR_MAX_SITES });
  const sites = [];
  for (const key of listed.keys) {
    const value = await env.MONITOR_KV.get(key.name, 'json');
    if (value) sites.push(value);
  }
  return sites.sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

async function monitorCheckSite(site, env) {
  let result;
  try { result = await monitorFetch(site.url, env); }
  catch (error) {
    result = { state: 'blocked', httpStatus: null, checkedAt: new Date().toISOString(), detail: String(error?.message || 'invalid-url').slice(0,180) };
  }
  const updated = { ...site, lastCheck: result };
  await env.MONITOR_KV.put(MONITOR_PREFIX + site.id, JSON.stringify(updated));
  return updated;
}

async function monitorCheckAll(env) {
  const sites = await monitorList(env);
  const results = [];
  for (const site of sites) results.push(await monitorCheckSite(site, env));
  return results;
}

async function handleMonitor(request, env, origin) {
  if (!env.MONITOR_KV) return monitorResponse({ error: 'KV binding MONITOR_KV не настроен' }, 503, origin);
  if (!monitorAuthorized(request, env)) return monitorResponse({ error: 'Требуется действительный Bearer token' }, 401, origin);
  const url = new URL(request.url);
  if (url.pathname === '/api/monitor/sites' && request.method === 'GET') {
    return monitorResponse({ sites: await monitorList(env) }, 200, origin);
  }
  if (url.pathname === '/api/monitor/sites' && request.method === 'POST') {
    let input;
    try {
      const raw = await request.text();
      if (raw.length > 4096) return monitorResponse({ error: 'Слишком большой запрос' }, 413, origin);
      input = JSON.parse(raw);
    } catch { return monitorResponse({ error: 'Некорректный JSON' }, 400, origin); }
    const label = String(input.label || '').trim().slice(0, 80);
    const environment = ['production','preview','custom'].includes(input.environment) ? input.environment : 'custom';
    let safeUrl;
    try { safeUrl = monitorSafeUrl(input.url, env); }
    catch (error) { return monitorResponse({ error: error.message }, 400, origin); }
    const existing = await monitorList(env);
    if (existing.length >= MONITOR_MAX_SITES) return monitorResponse({ error: 'Достигнут лимит 50 адресов' }, 409, origin);
    if (existing.some(site => site.url === safeUrl.toString())) return monitorResponse({ error: 'Этот URL уже добавлен' }, 409, origin);
    const site = {
      id: crypto.randomUUID(),
      label: label || safeUrl.hostname,
      environment,
      url: safeUrl.toString(),
      createdAt: new Date().toISOString(),
      lastCheck: null,
    };
    await env.MONITOR_KV.put(MONITOR_PREFIX + site.id, JSON.stringify(site));
    return monitorResponse({ site }, 201, origin);
  }
  if (url.pathname === '/api/monitor/check' && request.method === 'POST') {
    const listed = await env.MONITOR_KV.list({ prefix: MONITOR_PREFIX, limit: MONITOR_MAX_SITES });
    const rateKey = 'monitor:manual-check-minute';
    const recent = await env.MONITOR_KV.get(rateKey);
    if (recent) return monitorResponse({ error: 'Повторная массовая проверка доступна не чаще раза в минуту' }, 429, origin);
    await env.MONITOR_KV.put(rateKey, new Date().toISOString(), { expirationTtl: 60 });
    let input = {};
    try { const raw = await request.text(); if (raw.length > 1024) return monitorResponse({ error: 'Слишком большой запрос' }, 413, origin); input = raw ? JSON.parse(raw) : {}; }
    catch { return monitorResponse({ error: 'Некорректный JSON' }, 400, origin); }
    const sites = await monitorList(env);
    const selected = input.id ? sites.filter(site => site.id === input.id) : sites;
    if (input.id && !selected.length) return monitorResponse({ error: 'Адрес не найден' }, 404, origin);
    const results = [];
    for (const site of selected) results.push(await monitorCheckSite(site, env));
    return monitorResponse({ checked: results.length, sites: results }, 200, origin);
  }
  const match = url.pathname.match(/^\/api\/monitor\/sites\/([a-f0-9-]{36})$/i);
  if (match && request.method === 'DELETE') {
    await env.MONITOR_KV.delete(MONITOR_PREFIX + match[1]);
    return monitorResponse({ deleted: true }, 200, origin);
  }
  return monitorResponse({ error: 'Маршрут мониторинга не найден' }, 404, origin);
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
    if (url.pathname.startsWith('/api/monitor/')) {
      if (!['GET','POST','DELETE'].includes(request.method)) return monitorResponse({ error: 'Метод не поддерживается' }, 405, origin);
      return handleMonitor(request, env, origin);
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
  async scheduled(_controller, env, ctx) {
    if (!env.MONITOR_KV || !env.MONITOR_ALLOWED_HOSTS) return;
    ctx.waitUntil(monitorCheckAll(env));
  },
};
