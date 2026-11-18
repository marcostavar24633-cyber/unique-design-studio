export const DEFAULT_NVIDIA_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';
const NVIDIA_CHAT_COMPLETIONS_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export function isQuotaError(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.cause?.status);
  if (status === 429) return true;
  const detail = [error?.message, error?.code, error?.type, error].filter(Boolean).join(' ').toLowerCase();
  return /(?:\b(?:3036|3040|429)\b|daily free allocation|rate[\s_-]?limit|too many requests|resource[_ -]?exhausted|quota|daily.{0,30}limit|limit.{0,30}exceeded|exceeded.{0,30}(?:limit|quota|neurons?))/i.test(detail);
}

export function isFreeAiMode(env = {}) {
  return String(env.AI_BILLING_MODE || 'free').trim().toLowerCase() === 'free';
}

export function isNvidiaFallbackEnabled(env = {}) {
  return !isFreeAiMode(env) && env.NVIDIA_NIM_ENABLED === 'true' && Boolean(env.NVIDIA_API_KEY);
}

async function runNvidia(env, options) {
  if (!isNvidiaFallbackEnabled(env)) {
    throw new Error('NVIDIA NIM отключён: бесплатный режим не допускает внешний резервный API');
  }
  const model = String(env.NVIDIA_MODEL || DEFAULT_NVIDIA_MODEL).trim().slice(0, 160);
  if (!model) throw new Error('Не задана модель NVIDIA_MODEL');

  let response;
  try {
    response = await fetch(NVIDIA_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        max_tokens: options.max_tokens,
        temperature: options.temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new Error(`Сеть NVIDIA NIM недоступна: ${error?.message || 'network error'}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`NVIDIA NIM вернул некорректный ответ (HTTP ${response.status})`);
  }
  if (!response.ok) {
    const detail = String(payload?.detail || payload?.message || payload?.error?.message || payload?.title || '').slice(0, 400);
    throw new Error(`NVIDIA NIM вернул HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  if (!payload?.choices?.[0]?.message?.content) {
    throw new Error('NVIDIA NIM не вернул текстовый ответ');
  }
  return { result: payload, provider: 'nvidia', model: payload.model || model };
}

/**
 * Free mode is the safe default. NVIDIA's hosted API catalog endpoints are for
 * development/testing; never use them as an automatic public-production fallback.
 * A separately licensed non-free deployment must explicitly opt in.
 */
async function runGateway(env, options) {
  const base = String(env.GATEWAY_API_URL || '').trim().replace(/\/+$/, '');
  if (!base || !env.GATEWAY_PROJECT_TOKEN) throw new Error('Universal AI Gateway не настроен: нужны GATEWAY_API_URL и GATEWAY_PROJECT_TOKEN');
  let response;
  try {
    response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GATEWAY_PROJECT_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ provider: 'cloudflare', routeMode: 'primary', messages: options.messages }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) { throw new Error(`Universal AI Gateway недоступен: ${error?.message || 'network error'}`); }
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`Universal AI Gateway вернул некорректный ответ (HTTP ${response.status})`); }
  if (!response.ok) {
    const error = new Error(payload?.error || `Universal AI Gateway HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const content = payload?.choices?.[0]?.message?.content ?? payload?.text;
  if (typeof content !== 'string' || !content) throw new Error('Universal AI Gateway не вернул текстовый ответ');
  return { result: payload, provider: payload.provider || 'cloudflare', model: payload.model || 'gateway/cloudflare' };
}

export async function runTextModel(env, primaryModel, options, { preferNvidia = false } = {}) {
  if (preferNvidia) return runNvidia(env, options);
  if (env.GATEWAY_API_URL || env.GATEWAY_PROJECT_TOKEN) return runGateway(env, options);
  try {
    const result = await env.AI.run(primaryModel, options);
    return { result, provider: 'cloudflare', model: primaryModel };
  } catch (error) {
    if (!isQuotaError(error) || !isNvidiaFallbackEnabled(env)) throw error;
    try {
      return await runNvidia(env, options);
    } catch (fallbackError) {
      throw new Error(`Workers AI исчерпал квоту; резервный NVIDIA NIM не сработал: ${fallbackError?.message || 'unknown error'}`);
    }
  }
}
