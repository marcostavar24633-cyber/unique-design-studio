(() => {
  const start = () => {
    const button = document.getElementById('ai-connection-check');
    const status = document.getElementById('ai-connection-status');
    const details = document.getElementById('ai-connection-details');
    if (!button || !status || !details || button.dataset.diagnosticsBound === 'true') return;
    button.dataset.diagnosticsBound = 'true';
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const input = document.getElementById('auto-endpoint');
      let endpoint = (input?.value || '').trim();
      try { if (!endpoint) endpoint = localStorage.getItem('uds:ai-endpoint') || ''; } catch {}
      if (!endpoint) endpoint = 'https://unique-design-studio-ai.marcostavar24633.workers.dev/api/generate-landing';
      button.disabled = true;
      status.textContent = 'Проверяем подключение…';
      details.replaceChildren();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const url = new URL(endpoint, location.href);
        if (!/^https?:$/.test(url.protocol)) throw new Error('Нужен адрес HTTPS Worker');
        if (!/\/api\/generate-landing\/?$/i.test(url.pathname)) throw new Error('В адресе должен быть путь /api/generate-landing');
        url.pathname = url.pathname.replace(/\/api\/generate-landing\/?$/i, '/api/diagnostics');
        url.search = '';
        const response = await fetch(url.toString(), {
          method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Worker ответил HTTP ' + response.status);
        const checks = [
          ['Worker доступен', true],
          ['Workers AI binding (AI)', Boolean(payload.runtime?.workersAiBindingConfigured)],
          ['CF_ACCOUNT_ID', Boolean(payload.runtime?.accountIdConfigured)],
          ['CF_ANALYTICS_TOKEN', Boolean(payload.runtime?.analyticsTokenConfigured)]
        ];
        for (const [label, ok] of checks) {
          const item = document.createElement('li');
          item.textContent = (ok ? '✓ ' : '✕ ') + label + (ok ? ' — OK' : ' — не настроено в этом Worker');
          details.append(item);
        }
        status.textContent = checks.every(([, ok]) => ok)
          ? 'Подключение полностью настроено'
          : 'Проверка завершена: найдены отсутствующие настройки';
      } catch (error) {
        const message = error.name === 'AbortError' ? 'Worker не ответил за 12 секунд'
          : error instanceof TypeError ? 'Не удалось обратиться к Worker. Проверьте адрес и CORS'
          : error.message || 'Неизвестная ошибка проверки';
        status.textContent = 'Проверка не пройдена: ' + message;
        const item = document.createElement('li');
        item.textContent = 'Адрес проверки: ' + endpoint;
        details.append(item);
      } finally {
        clearTimeout(timeout);
        button.disabled = false;
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
