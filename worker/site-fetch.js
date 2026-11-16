// Cloudflare Worker «анализатор-сервер» для Unique Design Studio.
// Единственная задача — отдать фронтенду HTML или CSS ОДНОЙ публичной страницы, которую браузер не может
// запросить сам из-за CORS. Разбор и анализ выполняются в браузере (src/engine/site-analysis.js).
//
// Чего Worker не делает намеренно:
//  • не передаёт cookie, авторизацию и не подбирает заголовки под «настоящий браузер»;
//  • не обходит CAPTCHA, проверку «я не робот», paywall и ответы 401/403/429 — возвращает честный отказ;
//  • не ходит на закрытые robots.txt пути, во внутренние сети и на IP-адреса;
//  • не хранит данные и не требует секретов: в коде и настройках нет ключей.

export const VERSION = '1.0.0';
export const USER_AGENT = 'UniqueDesignStudio-Analyzer/1.0 (+https://github.com/marcostavar24633-cyber/unique-design-studio)';
const MAX_BYTES = { html: 1_500_000, css: 1_000_000 };
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const DEFAULT_ORIGINS = ['https://marcostavar24633-cyber.github.io', 'http://localhost:4173', 'http://127.0.0.1:4173'];
const PROTECTED = new Set([401, 402, 403, 407, 429, 451]);

/** Проверка адреса: только публичные http(s)-страницы по имени хоста. */
export function validateTarget(value) {
  let u;
  try { u = new URL(String(value)); } catch { return { ok: false, reason: 'bad-url', message: 'Некорректный адрес' }; }
  if (!['http:', 'https:'].includes(u.protocol)) return { ok: false, reason: 'bad-url', message: 'Разрешены только http и https' };
  if (u.username || u.password) return { ok: false, reason: 'bad-url', message: 'Адрес с логином и паролем не принимается' };
  if (u.port && !['80', '443'].includes(u.port)) return { ok: false, reason: 'bad-url', message: 'Нестандартные порты не поддерживаются' };
  const host = u.hostname.toLowerCase();
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[');
  if (isIp || !host.includes('.') || /(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|invalid|example)$/.test(host)) {
    return { ok: false, reason: 'private-host', message: 'Внутренние адреса и IP не анализируются' };
  }
  u.hash = '';
  return { ok: true, url: u };
}

/** Минимальный разбор robots.txt: правила для нашего агента и для «*». Самое длинное совпадение выигрывает. */
export function robotsAllows(robots, path, agent = 'uniquedesignstudio-analyzer') {
  const groups = [];
  let cur = null, lastWasAgent = false;
  for (const raw of String(robots || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase()); lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && cur) { cur.rules.push([key, val]); lastWasAgent = false; }
    else lastWasAgent = false;
  }
  const group = groups.find(g => g.agents.some(a => a !== '*' && agent.includes(a))) || groups.find(g => g.agents.includes('*'));
  if (!group) return true;
  let best = { len: -1, allow: true };
  for (const [key, pattern] of group.rules) {
    if (!pattern) continue;
    const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(path) && pattern.length > best.len) best = { len: pattern.length, allow: key === 'allow' };
  }
  return best.allow;
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const list = String((env && env.ALLOWED_ORIGINS) || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowed = list.length ? list : DEFAULT_ORIGINS;
  return allowed.includes(origin) ? origin : '';
}

const json = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  },
});

async function fetchPublic(target, accept, allowed) {
  let url = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (allowed && !(await allowed(url))) return { error: { reason: 'robots', message: 'Владелец сайта запретил автоматическое чтение этой страницы в robots.txt' } };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url.href, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'ru,en;q=0.8' } });
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('Location')) {
      clearTimeout(timer);
      const next = validateTarget(new URL(res.headers.get('Location'), url).href);
      if (!next.ok) return { error: next };
      url = next.url;
      continue;
    }
    // Таймер остаётся активным до полного чтения тела ответа.
    return { res, url, cleanup: () => clearTimeout(timer) };
  }
  return { error: { reason: 'redirects', message: 'Слишком много перенаправлений' } };
}

async function readLimited(res, limit) {
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) { const buf = new Uint8Array(await res.arrayBuffer()); return { bytes: buf.slice(0, limit), truncated: buf.length > limit }; }
  const chunks = [];
  let size = 0, truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.length > limit) { chunks.push(value.slice(0, limit - size)); size = limit; truncated = true; try { await reader.cancel(); } catch { /* поток уже закрыт */ } break; }
    chunks.push(value); size += value.length;
  }
  const bytes = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) { bytes.set(c, o); o += c.length; }
  return { bytes, truncated };
}

function decode(bytes, contentType) {
  let charset = (/charset=["']?([\w-]+)/i.exec(contentType || '') || [])[1];
  if (!charset) charset = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(new TextDecoder('latin1').decode(bytes.slice(0, 2048))) || [])[1];
  try { return new TextDecoder(charset || 'utf-8').decode(bytes); } catch { return new TextDecoder('utf-8').decode(bytes); }
}

export async function handle(request, env = {}) {
  const origin = allowedOrigin(request, env);
  const here = new URL(request.url);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: origin ? 204 : 403, headers: origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : {} });
  }
  if (request.method !== 'GET') return json({ ok: false, reason: 'method', message: 'Только GET' }, 405, origin);
  if (here.pathname === '/health') return json({ ok: true, service: 'uds-site-fetch', version: VERSION }, 200, origin);
  if (!origin) return json({ ok: false, reason: 'origin', message: 'Запросы принимаются только со страниц студии' }, 403, '');
  if (here.pathname !== '/fetch') return json({ ok: false, reason: 'not-found', message: 'Неизвестный адрес' }, 404, origin);

  // Origin/CORS не защищает Worker от прямых HTTP-клиентов: Origin можно подделать.
  // Поэтому без реальной привязки RATE_LIMITER запросы к целевым сайтам запрещены (fail closed).
  if (!env.RATE_LIMITER || typeof env.RATE_LIMITER.limit !== 'function') {
    return json({ ok: false, reason: 'rate-limit-unconfigured', message: 'Сервис временно недоступен: ограничитель запросов не настроен.' }, 503, origin);
  }
  const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
  if (!success) return json({ ok: false, reason: 'rate-limit', message: 'Слишком много запросов. Повторите через минуту.' }, 429, origin);
  const kind = here.searchParams.get('kind') === 'css' ? 'css' : 'html';
  const target = validateTarget(here.searchParams.get('url'));
  if (!target.ok) return json(target, 400, origin);

  try {
    // robots.txt проверяется для страниц; файлы стилей — часть уже разрешённой страницы.
    const robotsByOrigin = new Map();
    const allowed = kind !== 'html' ? null : async url => {
      if (!robotsByOrigin.has(url.origin)) {
        const robots = await fetchPublic(new URL('/robots.txt', url), 'text/plain');
        if (robots.error) return false;
        try {
          // 4xx означает, что файл отсутствует; 5xx/сетевая ошибка — временно недоступен,
          // поэтому в сомнительном случае запрещаем автоматическое чтение страницы.
          if (robots.res.status >= 500) return false;
          const rules = robots.res.status >= 400 ? '' : decode((await readLimited(robots.res, 200_000)).bytes, robots.res.headers.get('Content-Type'));
          robotsByOrigin.set(url.origin, rules);
        } finally { robots.cleanup(); }
      }
      return robotsAllows(robotsByOrigin.get(url.origin), url.pathname + url.search);
    };
    const got = await fetchPublic(target.url, kind === 'css' ? 'text/css,*/*;q=0.1' : 'text/html,application/xhtml+xml', allowed);
    if (got.error) return json({ ok: false, ...got.error }, 200, origin);
    const { res, url } = got;
    try {
      if (PROTECTED.has(res.status) || res.headers.get('cf-mitigated')) {
        return json({ ok: false, reason: 'protected', status: res.status, message: 'Сайт требует авторизацию или проверку «я не робот». Такие страницы не анализируются.' }, 200, origin);
      }
      if (!res.ok) return json({ ok: false, reason: 'http', status: res.status, message: `Сайт ответил кодом ${res.status}` }, 200, origin);
      const type = (res.headers.get('Content-Type') || '').toLowerCase();
      if (kind === 'html' ? !/text\/html|application\/xhtml/.test(type) : !/text\/css/.test(type)) {
        return json({ ok: false, reason: 'content-type', message: `Неподходящий тип содержимого: ${type || 'не указан'}` }, 200, origin);
      }
      const { bytes, truncated } = await readLimited(res, MAX_BYTES[kind]);
      return json({ ok: true, kind, url: target.url.href, finalUrl: url.href, status: res.status, contentType: type, truncated, text: decode(bytes, type), fetchedAt: new Date().toISOString() }, 200, origin);
    } finally { got.cleanup(); }
  } catch (err) {
    const timeout = err && err.name === 'AbortError';
    return json({ ok: false, reason: timeout ? 'timeout' : 'network', message: timeout ? 'Сайт не ответил за 10 секунд' : 'Не удалось соединиться с сайтом' }, 200, origin);
  }
}

export default { fetch: handle };
