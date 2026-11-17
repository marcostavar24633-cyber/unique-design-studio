(() => {
  const button = document.getElementById('ai-connection-check');
  const status = document.getElementById('ai-connection-status');
  const details = document.getElementById('ai-connection-details');
  if (!button || !status || !details) return;
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Проверяем Worker…';
    details.replaceChildren();
    const add = (message) => {
      const item = document.createElement('li');
      item.textContent = message;
      details.append(item);
    };
    try {
      const field = document.getElementById('auto-endpoint');
      const endpoint = (field?.value || '').trim() || 'https://unique-design-studio-ai.marcostavar24633.workers.dev/api/generate-landing';
      const parsed = new URL(endpoint, window.location.href);
      if (!/^https?:$/.test(parsed.protocol) || !/\/api\/generate-landing\/?$/i.test(parsed.pathname)) {
        throw new Error('Адрес должен заканчиваться на /api/generate-landing');
      }
      parsed.pathname = parsed.pathname.replace(/\/api\/generate-landing\/?$/i, '/api/diagnostics');
      parsed.search = '';
      const response = await fetch(parsed.href, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || ('HTTP ' + response.status));
      const checks = [
        ['Worker доступен', true],
        ['Workers AI binding (AI)', Boolean(payload.runtime?.workersAiBindingConfigured)],
        ['CF_ACCOUNT_ID', Boolean(payload.runtime?.accountIdConfigured)],
        ['CF_ANALYTICS_TOKEN', Boolean(payload.runtime?.analyticsTokenConfigured)]
      ];
      checks.forEach(([label, ok]) => add((ok ? '✓ ' : '✕ ') + label + (ok ? ' — OK' : ' — отсутствует в этом Worker')));
      status.textContent = checks.every(([, ok]) => ok) ? 'Подключение полностью настроено' : 'Worker отвечает: найдены отсутствующие настройки';
    } catch (error) {
      status.textContent = 'Ошибка проверки: ' + (error?.message || 'неизвестная ошибка');
      add('Проверка не завершена. Проверьте доступность Worker и разрешённый источник GitHub Pages.');
    } finally {
      button.disabled = false;
    }
  });
})();