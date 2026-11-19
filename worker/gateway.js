// Universal AI Gateway: текстовые запросы студии идут через шлюз по Service Binding (Worker → Worker
// внутри Cloudflare, без выхода в интернет). Шлюз сам вызывает ту же модель Workers AI, а когда квота
// Cloudflare исчерпана — переключается на бесплатный Groq (цепочка для студии задана на стороне шлюза).
// Если шлюз не настроен или не ответил, runTextModel вызывает Workers AI напрямую, как раньше.

const GATEWAY_URL = 'https://universal-ai-gateway/v1/chat/completions';

export function isGatewayConfigured(env = {}) {
  return Boolean(env.GATEWAY && typeof env.GATEWAY.fetch === 'function' && env.GATEWAY_TOKEN);
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
  };
}
