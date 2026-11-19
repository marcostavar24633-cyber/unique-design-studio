// Universal AI Gateway: текстовые запросы студии идут через шлюз по Service Binding (Worker → Worker
// внутри Cloudflare, без выхода в интернет). Шлюз сам вызывает ту же модель Workers AI, а когда квота
// Cloudflare исчерпана — переключается на бесплатный Groq (цепочка для студии задана на стороне шлюза).
// Если шлюз не настроен или не ответил, runTextModel вызывает Workers AI напрямую, как раньше.

const GATEWAY_URL = 'https://universal-ai-gateway/v1/chat/completions';

export function isGatewayConfigured(env = {}) {
  return Boolean(env.GATEWAY && typeof env.GATEWAY.fetch === 'function' && env.GATEWAY_TOKEN);
}

/**
 * Состояние шлюза для /api/diagnostics: доступен ли он, кто в резерве и сколько запросов
 * осталось на сегодня. Квоту не тратит (GET /v1/status). Токен в ответ не попадает.
 */
export async function gatewayStatus(env) {
  if (!isGatewayConfigured(env)) return { configured: false };
  try {
    const response = await env.GATEWAY.fetch('https://universal-ai-gateway/v1/status', {
      headers: { Authorization: `Bearer ${env.GATEWAY_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { configured: true, ok: false, error: `HTTP ${response.status}` };
    return {
      configured: true,
      ok: true,
      fallback: Array.isArray(payload.fallback) ? payload.fallback.map(String).slice(0, 8) : [],
      quota: payload.quota && typeof payload.quota === 'object' ? {
        limit: Number(payload.quota.limit) || 0,
        used: Number(payload.quota.used) || 0,
        remaining: Number(payload.quota.remaining) || 0,
        resetAt: String(payload.quota.resetAt || ''),
      } : null,
    };
  } catch (error) {
    return { configured: true, ok: false, error: String(error?.message || 'gateway error').slice(0, 120) };
  }
}

/**
 * Возвращает результат в формате Workers AI ({ response, usage }), чтобы остальной код студии
 * (modelOutput, usageOf) работал без изменений.
 */
export async function runViaGateway(env, model, options) {
  const response = await env.GATEWAY.fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GATEWAY_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'cloudflare',
      routeMode: 'auto',
      model,
      messages: options.messages,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
      ...(options.chat_template_kwargs ? { chat_template_kwargs: options.chat_template_kwargs } : {}),
    }),
  });
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(`Universal AI Gateway вернул HTTP ${response.status}${payload?.error?.code ? ` (${payload.error.code})` : ''}`);
    error.status = response.status;
    throw error;
  }
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) throw new Error('Universal AI Gateway не вернул текстовый ответ');
  return {
    result: { response: text, ...(payload.usage ? { usage: payload.usage } : {}) },
    provider: payload.provider || 'cloudflare',
    model: payload.model || model,
    fallback: Boolean(payload.fallback),
    route: 'gateway',
  };
}
