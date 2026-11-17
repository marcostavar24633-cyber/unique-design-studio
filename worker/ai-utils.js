export function modelOutput(result) {
  if (result == null || typeof result === 'string') return result;
  const partsText = content => (Array.isArray(content) ? content.map(p => (typeof p === 'string' ? p : p?.text || '')).join('') : content);
  const choice = result.choices?.[0];
  const candidates = [
    result.response, result.result?.response,
    partsText(choice?.message?.content), choice?.text,
    result.output_text,
  ];
  const found = candidates.find(v => v != null && v !== '');
  return found ?? result;
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

/**
 * Текст действительно про нишу владельца: хотя бы одна основа слова ниши (первые 4 буквы слов от 4 букв)
 * встречается в заголовке, описании, оффере или услугах. Ловит ответ «про веб-студию» вместо кофейни.
 */
export function aboutNiche(landing, niche) {
  const stems = String(niche || '').toLowerCase().split(/[^a-zа-яё0-9]+/i).filter(w => w.length >= 4).map(w => w.slice(0, 4));
  if (!stems.length) return true;
  const text = JSON.stringify([landing.title, landing.description, landing.mainOffer, landing.services, landing.aboutText]).toLowerCase();
  return stems.some(s => text.includes(s));
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


/**
 * Токены, которые модель фактически сообщила в ответе (формат OpenAI или Workers AI). Ничего не оценивает:
 * если модель не вернула usage — null. Используется для журнала AI-операций в студии.
 */
export function usageOf(result) {
  const u = result?.usage || result?.result?.usage;
  if (!u || typeof u !== 'object') return null;
  const input = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
  const output = Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
  const total = Number(u.total_tokens ?? input + output) || input + output;
  return total ? { inputTokens: input, outputTokens: output, totalTokens: total } : null;
}

/** Складывает usage нескольких попыток: неудачные попытки тоже тратят квоту. */
export function addUsage(a, b) {
  if (!b) return a;
  if (!a) return { ...b };
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens, totalTokens: a.totalTokens + b.totalTokens };
}
