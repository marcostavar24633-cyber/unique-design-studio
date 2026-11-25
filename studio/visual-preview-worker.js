import { generate } from '../src/engine/index.js';

self.addEventListener('message', event => {
  const { request, raw, registry = [] } = event.data || {};
  if (!Number.isInteger(request) || !raw || typeof raw !== 'object') return;
  try {
    const result = generate(raw, { registry: Array.isArray(registry) ? registry : [] });
    self.postMessage({ request, html: result.html });
  } catch (error) {
    self.postMessage({ request, error: String(error?.message || error) });
  }
});
