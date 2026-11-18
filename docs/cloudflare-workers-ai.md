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

### Резервный провайдер NVIDIA NIM

Для текстовых задач можно включить автоматический резервный маршрут. Worker сначала вызывает Cloudflare Workers AI; при документированной ошибке исчерпания дневного бесплатного объёма (3036), ошибке нехватки мощности (3040) или HTTP 429 он повторяет запрос через NVIDIA NIM. Следующая попытка в рамках того же запроса остаётся на NVIDIA, чтобы не обращаться снова к уже ограниченному основному провайдеру.

- API: `https://integrate.api.nvidia.com/v1/chat/completions` (OpenAI-compatible).
- Секрет Worker: `NVIDIA_API_KEY`.
- Модель по умолчанию: `nvidia/nemotron-3.5-lightning-30b-a3b`.
- Необязательная переменная Worker: `NVIDIA_MODEL`, если нужно выбрать другую доступную в NVIDIA Build модель.
- В ответах генерации возвращаются `provider` и фактическое `model`; диагностика сообщает только факт наличия ключа, но никогда не его значение.

Включение из корня репозитория:

```bash
npx wrangler secret put NVIDIA_API_KEY --config worker/wrangler.jsonc
```

Вставьте ключ, созданный в [NVIDIA Build](https://build.nvidia.com/), в интерактивный запрос Wrangler. Не добавляйте его в `wrangler.jsonc`, GitHub Actions, клиентский JavaScript или переписку. Альтернативно секрет можно создать в Cloudflare Dashboard → Workers & Pages → unique-design-studio-ai → Settings → Variables and Secrets.

Резервный провайдер не является безлимитным: на стороне NVIDIA действуют собственные лимиты, доступность моделей и условия бесплатного/платного endpoint. Если NVIDIA не отвечает или его квота исчерпана, Worker возвращает понятную ошибку, а студия может продолжить локальную генерацию. NVIDIA используется только для текстовых запросов; генерация изображений остаётся на Cloudflare FLUX.

Без `NVIDIA_API_KEY` прежнее поведение полностью сохраняется. Ошибки формата ответа, ошибки приложения и прочие HTTP-коды не вызывают автоматическое переключение.

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
