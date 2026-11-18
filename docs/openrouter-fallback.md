# Бесплатный AI fallback через OpenRouter

## Что делает

Когда Cloudflare Workers AI возвращает явную ошибку квоты (429, daily allocation, neuron limit), Worker может автоматически повторить тот же запрос через OpenRouter Free Models Router. Используется только модель `openrouter/free`; клиент не может передать идентификатор платной модели. NVIDIA NIM остаётся выключенным в бесплатном режиме.

Резервирование покрывает запросы `POST /api/generate-landing` и `POST /api/design-review`. Worker поддерживает Cloudflare Workers AI, OpenAI GPT API и Anthropic Claude API как выбираемый первичный провайдер. При явной ошибке квоты GPT или Claude запрос может перейти на бесплатный OpenRouter router.

## Подключение

1. Создать API key в OpenRouter: https://openrouter.ai/settings/keys
2. В Cloudflare Worker `unique-design-studio-ai` добавить Secret `OPENROUTER_API_KEY` (не Variable и не значение в GitHub).
3. Добавить Worker Variable `OPENROUTER_ENABLED=true`.
4. Оставить `AI_BILLING_MODE=free`. Не включать платные модели или NVIDIA NIM.
5. После публикации проверить `GET /api/diagnostics`: `openRouterFallbackConfigured` должен быть `true`. Значение показывает наличие конфигурации, но не проверяет баланс или доступность API.

Без секрета или при `OPENROUTER_ENABLED=false` поведение остаётся прежним: Worker возвращает исходную ошибку квоты Cloudflare. Ключ никогда не передаётся браузеру.

### Необязательные прямые API GPT / Claude\n\nПрямые API используют отдельную оплату и лимиты API, не подписку ChatGPT/Claude. По умолчанию они выключены. Чтобы явно разрешить API-вызовы, установите `AI_BILLING_MODE=api`, `AI_DIRECT_PROVIDERS_ENABLED=true`, выберите `AI_PRIMARY_PROVIDER=openai` или `anthropic` и добавьте соответствующий Cloudflare Secret `OPENAI_API_KEY` либо `ANTHROPIC_API_KEY`. Можно задать `OPENAI_MODEL` или `ANTHROPIC_MODEL`; иначе используются безопасные значения по умолчанию в коде. Не включайте эти параметры, если не согласны с возможной оплатой API. Для GPT/Claude quota fallback на OpenRouter всё равно требует отдельного `OPENROUTER_API_KEY` и `OPENROUTER_ENABLED=true`; модель фиксирована на `openrouter/free`. Диагностика показывает только наличие конфигурации, не баланс и не успешность API-запроса.\n\n## Лимиты и приватность

Бесплатные варианты OpenRouter имеют общий платформенный лимит 20 запросов в минуту и 50 запросов в сутки; дополнительно возможны ограничения конкретной модели/провайдера. Неуспешные попытки могут учитываться в суточном лимите. Бесплатный fallback не гарантирует доступность при исчерпании OpenRouter quota.

Промпты и передаваемые данные покидают Cloudflare и обрабатываются OpenRouter и выбранным им модельным провайдером. Не отправляйте конфиденциальные данные, если не согласны с условиями их обработки.

Официальные сведения: https://openrouter.ai/pricing и https://openrouter.ai/collections/free-models
