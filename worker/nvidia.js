export const DEFAULT_NVIDIA_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';
const NVIDIA_CHAT_COMPLETIONS_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export function isQuotaError(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.cause?.status);
  if (status === 429) return true;
  const detail = [error?.message, error?.code, error?.type, error].filter(Boolean).join(' ').toLowerCase();
  return /(?:\\b429\\b|rate[\\s_-]?limit|too many requests|resource[_ -]?exhausted|quota|daily.{0,30}limit|limit.{0,30}exceeded|exceeded.{0,30}(?:limit|quota|neurons?))/i.test(detail);
}

async function runNvidia(env, options) {
  if (!env.NVIDIA_API_KEY) throw new Error('Резервный NVIDIA NIM не настроен: отсутствует секрет NVIDIA_API_KEY');
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
 * Сначала вызывает Workers AI. На явную ошибку квоты/429 один раз переключается
 * на OpenAI-compatible NVIDIA NIM. Последующие попытки текущего запроса остаются
 * на NVIDIA, чтобы не расходовать повторно уже исчерпанную квоту основного провайдера.
 */
export async function runTextModel(env, primaryModel, options, { preferNvidia = false } = {}) {
  if (preferNvidia) return runNvidia(env, options);
  try {
    const result = await env.AI.run(primaryModel, options);
    return { result, provider: 'cloudflare', model: primaryModel };
  } catch (error) {
    if (!isQuotaError(error) || !env.NVIDIA_API_KEY) throw error;
    try {
      return await runNvidia(env, options);
    } catch (fallbackError) {
      throw new Error(`Workers AI исчерпал квоту; резервный NVIDIA NIM не сработал: ${fallbackError?.message || 'unknown error'}`);
    }
  }
}
