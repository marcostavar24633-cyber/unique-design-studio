# Cloudflare Workers AI для UNIQUE DESIGN STUDIO

Этот Worker добавляет AI-генерацию текстов и структуры проекта через Cloudflare Workers AI. Он не выполняет веб-поиск: источники и конкуренты не выдумываются, а отсутствующие сведения отмечаются как гипотезы.

## 1. Создание и публикация Worker

Из корня репозитория выполните:

```bash
npx wrangler login
npx wrangler deploy --config worker/wrangler.jsonc
```

При первом запуске Wrangler может попросить подтвердить авторизацию Cloudflare. Конфигурация создаёт Worker `unique-design-studio-ai` с binding `AI`; отдельный API-ключ для вызова Workers AI не нужен.

После успешной публикации Cloudflare покажет адрес вида:

`https://unique-design-studio-ai.<ваш-subdomain>.workers.dev`

Проверьте корневой адрес Worker — он показывает статус и доступные API-маршруты:

`https://unique-design-studio-ai.<ваш-subdomain>.workers.dev/`

Также проверьте:

```text
https://unique-design-studio-ai.<ваш-subdomain>.workers.dev/health
```

Ожидаемый ответ: `{"ok":true,"service":"unique-design-studio-ai"}`.

## 2. Подключение к студии

Откройте UNIQUE DESIGN STUDIO → Автопилот → «AI-генерация по брифу».
В поле «Адрес AI-сервера» вставьте адрес Worker с окончанием:

`/api/generate-landing`

Например:

`https://unique-design-studio-ai.<ваш-subdomain>.workers.dev/api/generate-landing`

Нажмите «Сгенерировать всё». Адрес сохраняется локально в браузере.

## 3. Модель и ограничения

По умолчанию используется `@cf/google/gemma-4-26b-a4b-it` — актуальная модель из каталога Cloudflare Workers AI. Вызов идёт через binding `env.AI`, без хранения ключей в браузере или GitHub Secrets.

Worker принимает POST JSON, ограничивает размер тела запроса и разрешает CORS только для GitHub Pages origin этого проекта. Если домен студии изменится, обновите `ALLOWED_ORIGINS` в `worker/index.js`.

Ответ модели ограничен 8192 токенами (живые замеры: 5600–5800 на полный ответ). Если JSON оборвался или в нём нет заголовка, описания, кнопки или услуг, Worker один раз повторяет запрос с просьбой ответить короче; после второй неудачи возвращает ошибку 502 с перечнем недостающих частей, и студия собирает сайт локальным автопилотом.

### Строгий бесплатный режим (по умолчанию)

Worker запускается с `AI_BILLING_MODE=free` и `NVIDIA_NIM_ENABLED=false`. В этом режиме:
- Все текстовые и графические AI-запросы идут только через Cloudflare Workers AI.
- Автоматический переход на NVIDIA NIM запрещён, даже если в Worker уже существует `NVIDIA_API_KEY`.
- При исчерпании бесплатной квоты запрос завершается ошибкой; платный провайдер автоматически не вызывается.
- В `/api/diagnostics` возвращается режим биллинга и фактическое состояние разрешённого NVIDIA fallback без раскрытия ключей.

Cloudflare указывает бесплатную квоту Workers AI **10 000 Neurons в сутки на аккаунт**, сброс — в 00:00 UTC. На тарифе Workers Free после исчерпания квоты запросы прекращаются. На Workers Paid использование сверх бесплатной квоты тарифицируется, поэтому для гарантии отсутствия дополнительных расходов аккаунт должен оставаться на Workers Free. Не добавляйте платные модели, prepaid AI Gateway credits или платные API. [Актуальные цены Cloudflare](https://developers.cloudflare.com/workers-ai/platform/pricing/).

### Universal AI Gateway (с 19.11.2026)

Текстовые запросы (генерация лендинга и AI Design Director) идут через [Universal AI Gateway](https://github.com/marcostavar24633-cyber/universal-ai-gateway) по Service Binding `GATEWAY` из `worker/wrangler.jsonc`: Worker → Worker внутри Cloudflare, без выхода в интернет. Шлюз вызывает ту же модель Workers AI (`@cf/google/gemma-4-26b-a4b-it`), а когда суточная квота исчерпана — бесплатный Groq. Поле `provider` в ответе показывает, кто ответил.

Настройка — один раз:

```sh
# в репозитории шлюза: токен проекта, без вывода на экран (копируется в буфер обмена)
npm run add-project -- unique-design-studio
# в этом репозитории: тот же токен как секрет AI Worker
npx wrangler secret put GATEWAY_TOKEN --config worker/wrangler.jsonc
```

Без секрета `GATEWAY_TOKEN` или если шлюз не ответил, студия вызывает Workers AI напрямую, как раньше. Изображения всегда генерируются напрямую. `/api/diagnostics` показывает `aiGatewayConfigured`.

### NVIDIA NIM — только отдельное тестирование

NVIDIA API Catalog предоставляет бесплатные hosted endpoints для прототипирования, разработки и тестирования. По официальным условиям NVIDIA, обслуживание реальных пользователей и иное production-использование требует соответствующей лицензии/подписки. Поэтому бесплатный режим публичного Worker намеренно не использует NVIDIA как резервный production API. [NVIDIA NIM FAQ](https://docs.api.nvidia.com/nim/docs/product) · [NVIDIA API Trial Terms](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf).

Для локального эксперимента с NVIDIA используйте отдельный тестовый скрипт/среду и ключ из [NVIDIA Build](https://build.nvidia.com/). Не добавляйте ключ в исходники, браузер, GitHub или чат. Не подключайте NVIDIA trial endpoint к публичному production Worker.

Проверить настройки можно запросом `GET /api/diagnostics` с разрешённого origin. Ожидаемый бесплатный режим: `aiBillingMode: "free"`, `nvidiaFallbackConfigured: false`.

## 4. Ограничение частоты запросов

Проверка Origin не защищает от прямых запросов к Worker, а каждый запрос тратит квоту Workers AI. Без дополнительной настройки работает запасной счётчик: не больше 6 запросов в минуту с одного IP в пределах одного экземпляра Worker. Он не общий для всех серверов Cloudflare, поэтому только сдерживает нагрузку.

Надёжное ограничение — привязка Rate Limiting. Добавьте в `worker/wrangler.jsonc`:

```jsonc
"ratelimits": [
  { "name": "AI_RATE_LIMITER", "namespace_id": "1001", "simple": { "limit": 6, "period": 60 } }
]
```

После публикации Worker сам начнёт использовать `AI_RATE_LIMITER`. Это изменение настроек развёртывания, поэтому вносит его владелец.

Веб-поиск и авторизация пользователей здесь не реализованы. Не используйте этот публичный endpoint для конфиденциальных данных.
## 5. Публикация через GitHub Actions

В репозитории доступен workflow **Deploy AI Worker to Cloudflare** (`.github/workflows/deploy-worker.yml`). Он запускается вручную и публикует только AI Worker из `worker/wrangler.jsonc`; GitHub Pages и Worker анализатора сайтов не затрагиваются.

Перед первым запуском добавьте два секрета в GitHub:
1. Откройте **Settings → Secrets and variables → Actions → New repository secret**.
2. Создайте `CLOUDFLARE_API_TOKEN` — API Token Cloudflare с разрешением **Workers Scripts: Edit** для нужного аккаунта.
3. Создайте `CLOUDFLARE_ACCOUNT_ID` — Account ID этого же аккаунта Cloudflare.

Не вставляйте токен в исходники, настройки сайта или сообщения. Не используйте Global API Key. После добавления секретов откройте **Actions → Deploy AI Worker to Cloudflare → Run workflow**. Успешный запуск должен завершиться публикацией Worker; URL будет указан в логе Wrangler. Если секреты не настроены, workflow остановится на проверке с понятной ошибкой.

## 6. Проверка после публикации

Откройте URL Worker из лога Wrangler и проверьте `/health`, затем выполните тестовую генерацию из студии через endpoint `/api/generate-landing`. Сам факт успешной сборки CI или GitHub Pages не подтверждает публикацию Worker.

Статистика `/api/usage` настраивается отдельно. Чтобы включить счётчик AI Neurons в студии:

1. В Cloudflare откройте **Workers & Pages → unique-design-studio-ai → Settings → Variables and Secrets**.
2. Добавьте secret `CF_ANALYTICS_TOKEN`. Создайте отдельный API Token в Cloudflare → My Profile → API Tokens → Create Custom Token. Дайте ему только разрешение **Account → Account Analytics → Read** и ограничьте доступ нужным аккаунтом. Сохраните токен сразу в Worker Secret; не вставляйте его в GitHub, код или чат. Для GraphQL Analytics требуется именно Account Analytics: Read. [Документация Cloudflare](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/).
3. Добавьте обычную переменную `CF_ACCOUNT_ID` со значением Account ID вашего Cloudflare-аккаунта (не Zone ID и не Worker ID).
4. Сохраните настройки Worker. Откройте сайт студии заново: счётчик запрашивает `/api/usage` при запуске, после генерации, при смене периода и затем автоматически раз в минуту.

Это не те же самые настройки, что GitHub Actions secrets для публикации Worker. Пока оба значения не заданы, `/api/usage` вернёт HTTP 503, а счётчик покажет «Статистика не подключена».
