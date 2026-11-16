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

Проверьте:

```text
https://unique-design-studio-ai.<ваш-subdomain>.workers.dev/health
```

Ожидаемый ответ: `{"ok":true,"service":"unique-design-studio-ai"}`.

## 2. Подключение к студии

Откройте UNIQUE DESIGN STUDIO → Автопилот → «Исследовать нишу в интернете (AI)».
В поле «Адрес AI-сервера» вставьте адрес Worker с окончанием:

`/api/generate-landing`

Например:

`https://unique-design-studio-ai.<ваш-subdomain>.workers.dev/api/generate-landing`

Нажмите «Сгенерировать всё». Адрес сохраняется локально в браузере.

## 3. Модель и ограничения

По умолчанию используется `@cf/google/gemma-4-26b-a4b-it` — актуальная модель из каталога Cloudflare Workers AI. Вызов идёт через binding `env.AI`, без хранения ключей в браузере или GitHub Secrets.

Worker принимает POST JSON, ограничивает размер тела запроса и разрешает CORS только для GitHub Pages origin этого проекта. Если домен студии изменится, обновите `ALLOWED_ORIGINS` в `worker/index.js`.

Это первый этап интеграции: генерация контента через Workers AI. Веб-поиск, анализ внешних сайтов, авторизация пользователей и продвинутое ограничение частоты запросов здесь не реализованы. Не используйте этот публичный endpoint для конфиденциальных данных.
