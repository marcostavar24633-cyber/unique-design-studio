const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export function isDirectProviderEnabled(env = {}, provider) {
  if (env.AI_BILLING_MODE !== 'api' || env.AI_DIRECT_PROVIDERS_ENABLED !== 'true') return false;
  if (provider === 'openai') return Boolean(env.OPENAI_API_KEY);
  if (provider === 'anthropic') return Boolean(env.ANTHROPIC_API_KEY);
  return false;
}

export async function runDirectProvider(env, provider, options) {
  if (!isDirectProviderEnabled(env, provider)) throw new Error(`Прямой API ${provider} не настроен или выключен`);
  const isOpenAI = provider === 'openai';
  const url = isOpenAI ? OPENAI_URL : ANTHROPIC_URL;
  const model = String(isOpenAI
    ? env.OPENAI_MODEL || 'gpt-4.1-mini'
    : env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest').trim().slice(0, 160);
  const headers = isOpenAI
    ? { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' }
    : { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', Accept: 'application/json' };
  const body = isOpenAI
    ? { model, messages: options.messages, max_tokens: options.max_tokens, temperature: options.temperature, stream: false }
    : {
        model,
        system: options.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n') || undefined,
        messages: options.messages.filter(m => m.role !== 'system'),
        max_tokens: options.max_tokens,
        temperature: options.temperature,
      };
  let response;
  try {
    response = await fetch(url, {
      method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new Error(`${provider} API network error: ${error?.message || 'network error'}`);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = String(payload?.error?.message || payload?.error?.type || payload?.message || '').slice(0, 400);
    const failure = new Error(`${provider} API вернул HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    failure.status = response.status;
    throw failure;
  }
  const text = isOpenAI
    ? payload?.choices?.[0]?.message?.content
    : (payload?.content || []).filter(item => item.type === 'text').map(item => item.text).join('\n');
  if (!text) throw new Error(`${provider} API не вернул текстовый ответ`);
  const usage = isOpenAI
    ? payload.usage
    : payload.usage ? {
        prompt_tokens: payload.usage.input_tokens,
        completion_tokens: payload.usage.output_tokens,
        total_tokens: Number(payload.usage.input_tokens || 0) + Number(payload.usage.output_tokens || 0),
      } : undefined;
  return {
    result: { choices: [{ message: { role: 'assistant', content: text } }], usage },
    provider,
    model: payload.model || model,
  };
}
