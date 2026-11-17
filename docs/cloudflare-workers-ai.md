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

Ответ модели ограничен 6000 токенами. Если JSON оборвался или в нём нет заголовка, описания, кнопки или услуг, Worker один раз повторяет запрос с просьбой ответить короче; после второй неудачи возвращает ошибку 502 с перечнем недостающих частей, и студия собирает сайт локальным автопилотом.

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

Статистика `/api/usage` настраивается отдельно: ей нужны Worker secrets/vars `CF_ANALYTICS_TOKEN` и `CF_ACCOUNT_ID`. Это не те же самые настройки, что GitHub Actions secrets для публикации. Не создавайте их, если статистика пока не нужна.
