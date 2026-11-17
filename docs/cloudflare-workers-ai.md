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
