export const DEFAULT_NVIDIA_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
const OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';
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

/**
 * OpenRouter is the free-mode fallback. The only accepted model is its free router:
 * it selects an available $0 model and cannot be switched to a paid model by client input.
 * Keep the API key in a Cloudflare Worker secret, never in browser storage or source.
 */
export function isOpenRouterFallbackEnabled(env = {}) {
  return ['free', 'api'].includes(String(env.AI_BILLING_MODE || 'free').trim().toLowerCase()) && env.OPENROUTER_ENABLED === 'true' && Boolean(env.OPENROUTER_API_KEY);
}

async function runOpenRouter(env, options) {
  if (!isOpenRouterFallbackEnabled(env)) {
    throw new Error('OpenRouter fallback не настроен: требуется OPENROUTER_ENABLED=true и секрет OPENROUTER_API_KEY');
  }
  let response;
  try {
    response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'HTTP-Referer': 'https://marcostavar24633-cyber.github.io/unique-design-studio/',
        'X-Title': 'UNIQUE DESIGN STUDIO',
      },
      body: JSON.stringify({
        model: DEFAULT_OPENROUTER_MODEL,
        messages: options.messages,
        max_tokens: options.max_tokens,
        temperature: options.temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new Error(`OpenRouter недоступен: ${error?.message || 'network error'}`);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = String(payload?.error?.message || payload?.message || '').slice(0, 400);
    throw new Error(`OpenRouter вернул HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  if (!payload?.choices?.[0]?.message?.content) {
    throw new Error('OpenRouter не вернул текстовый ответ');
  }
  return { result: payload, provider: 'openrouter', model: payload.model || DEFAULT_OPENROUTER_MODEL };
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
export async function runTextModel(env, primaryModel, options, { preferNvidia = false, providerOverride, routeMode = 'auto' } = {}) {
  if (preferNvidia) return runNvidia(env, options);
  if (routeMode === 'openrouter') return runOpenRouter(env, options);
  const requested = String(providerOverride || env.AI_PRIMARY_PROVIDER || 'cloudflare').trim().toLowerCase();
  const selected = ['cloudflare','openai','anthropic'].includes(requested) ? requested : 'cloudflare';
  let primary;
  if (selected === 'openai' || selected === 'anthropic') {
    const { isDirectProviderEnabled, runDirectProvider } = await import('./direct-providers.js');
    if (!isDirectProviderEnabled(env, selected)) {
      throw new Error(`Прямой провайдер ${selected} отключён: требуется AI_BILLING_MODE=api, AI_DIRECT_PROVIDERS_ENABLED=true и соответствующий API key`);
    }
    primary = () => runDirectProvider(env, selected, options);
  } else {
    primary = async () => {
      const result = await env.AI.run(primaryModel, options);
      return { result, provider: 'cloudflare', model: primaryModel };
    };
  }
  try {
    return await primary();
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    if (routeMode !== 'auto') throw error;
    if (isOpenRouterFallbackEnabled(env)) {
      try {
        return await runOpenRouter(env, options);
      } catch (fallbackError) {
        throw new Error(`${selected} исчерпал квоту; бесплатный OpenRouter fallback не сработал: ${fallbackError?.message || 'unknown error'}`);
      }
    }
    if (!isNvidiaFallbackEnabled(env)) throw error;
    try {
      return await runNvidia(env, options);
    } catch (fallbackError) {
      throw new Error(`${selected} исчерпал квоту; резервный NVIDIA NIM не сработал: ${fallbackError?.message || 'unknown error'}`);
    }
  }
}
