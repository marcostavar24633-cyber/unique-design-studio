# Claude handoff — UNIQUE DESIGN STUDIO

Дата передачи: 2026-11-15

## 1. Цель проекта

Продолжить разработку UNIQUE DESIGN STUDIO — локальной браузерной студии, которая собирает самостоятельные коммерческие сайты под разные ниши. Главная ценность проекта — не просто менять цвета одного шаблона, а выбирать разные визуальные архитектуры, композиции, палитры, типографику и структуру страницы в зависимости от бизнеса.

Проект работает без внешнего AI API и без обязательного серверного хранилища. Приложение запускается локально через Node.js и создаёт HTML/ZIP в браузере.

## 2. Репозиторий и ограничения

- Repository: https://github.com/marcostavar24633-cyber/unique-design-studio
- Рабочая ветка: `feature/visual-identity-engine`
- Pull Request: https://github.com/marcostavar24633-cyber/unique-design-studio/pull/3
- Целевая ветка PR: `main`
- На момент передачи HEAD рабочей ветки: `6139b62f1b5bc5b07e533b001cea18c77f608963`
- PR №3 открыт, Draft, не merged.
- Не переключаться на другие репозитории или проекты без прямого указания владельца.
- Не вносить изменения в `main`, не сливать PR и не снимать Draft без явного разрешения.
- Все новые изменения делать небольшими коммитами в `feature/visual-identity-engine`.
- Перед каждым GitHub update заново получать текущий blob SHA файла.
- Не утверждать, что функция, тест, CI или публикация прошли, пока это не подтверждено фактической проверкой.
- Не использовать и не восстанавливать прежнюю удалённую систему AUTONOMOUS AI PRO.

## 3. Текущее состояние на момент передачи

Последний подтверждённый HEAD feature branch и PR head перед финализацией handoff-документа:
`7fb7d6dd1da410c7a85f0afa1aa6fddc442497c0`

Последний GitHub Actions run на этот SHA:
- Run ID: `43753023859`
- URL: https://github.com/marcostavar24633-cyber/unique-design-studio/actions/runs/43753023859
- Итог: `failure`.
- Результат тестов: 59 passed, 1 failed из 60.
- Ошибка: `test/export-readiness.test.js`, тест `generated site keeps its SEO metadata and project content through the export gate`; неверное ожидание `project.html.includes("Откройте Вселенную ближе")` — фактический генератор не выводит переданный `heroTitle` из этого поля в данном тестовом сценарии.

Предыдущий run `43752872848` на SHA `6139b62f1b5bc5b07e533b001cea18c77f608963` завершился той же единственной ошибкой. Остальные 59 тестов проходят. Первым делом Claude должен исправить причину несоответствия: либо корректно передать hero title через фактическую схему `createStudioProject`, либо изменить тест так, чтобы он проверял поддерживаемый контракт, не ослабляя проверку сохранения SEO и основного контента. После этого запустить `npm run check` и добиться зелёного CI на новом актуальном SHA.

После создания handoff-документа и обновления README появились дополнительные commits. Поэтому перед работой обязательно заново проверь branch HEAD, PR head и последний workflow run; не используй SHA выше как гарантированно текущий.

## 4. Текущий этап: pre-export readiness gate

Задача — не позволять скачивать HTML или ZIP при критических ошибках и гарантировать, что ZIP содержит последнюю версию HTML.

Уже добавлено:

### `src/export-readiness.js`
- Экспортирует `assessExportReadiness(html, css)`.
- Запускает `auditSiteHtml`.
- Критические ошибки статического аудита блокируют скачивание.
- Structural checks: doctype, открывающие и закрывающие `html`, `head`, `body`, встроенный `style`.
- Предупреждения остаются видимыми, но не блокируют экспорт.
- Возвращает `ready`, `errors`, `warnings`, `blockingIssues`, `warningsList`, `report`.

### `src/zip-export.js`
- ZIP32 writer без внешних зависимостей, STORE/no compression.
- Добавлена `verifyZipArchive(input, expectedNames, expectedContent)`.
- Проверяет local headers, central directory, EOCD, число файлов, offsets/sizes, CRC32, ожидаемые имена и побайтовое совпадение с ожидаемым содержимым.
- ZIP не должен скачиваться, если проверка не пройдена.

### `app/app.js`
- После каждой генерации запускает readiness gate.
- HTML/ZIP кнопки выключаются при критических ошибках.
- Перед каждым скачиванием вызывается `ensureExportReady()`, которая пересобирает текущий проект и повторяет аудит.
- ZIP строится из текущего `latestHtml`, затем проверяется через `verifyZipArchive`, включая точное совпадение `index.html` и README.
- UI показывает статус готовности и причину блокировки.

### Тесты и документация
- `test/export-readiness.test.js`: валидная страница, warnings-only, блокировка критических ошибок, пустая/неполная HTML-структура, небезопасные ссылки, сохранение SEO/content в сгенерированном HTML.
- `test/zip-export.test.js`: структура ZIP, UTF-8, CRC32, проверка целостности, повреждённый payload, отсутствие файла, несовпадение с ожидаемым HTML.
- `package.json`: `npm run check` проверяет синтаксис нового модуля и запускает node tests.
- `README.md` и `docs/site-audit.md` описывают ограничения и pre-export проверки.

## 5. Первые действия после открытия проекта

1. Проверить последний GitHub Actions run для актуального HEAD (на момент подготовки handoff: run `43753023859`, SHA `7fb7d6dd1da410c7a85f0afa1aa6fddc442497c0`, failure 59/60).
2. Исправить неработающий тест `generated site keeps its SEO metadata and project content through the export gate`: ожидание `heroTitle` не совпадает с фактическим API `createStudioProject`. Изучить `src/studio-pipeline.js`, `src/component-renderer.js` и существующие pipeline tests, затем корректно передать нужный текст либо проверять реальное поддерживаемое поле. Не удалять тест и не ослаблять другие assertions.
3. Получить job logs, повторить `npm run check` и добиться зелёного CI на актуальном feature HEAD.
3. Проверить, что PR head совпадает с актуальным branch HEAD.
4. Проверить логику:
   - критические ошибки блокируют обе кнопки;
   - warnings не блокируют;
   - перед каждым download gate запускается заново;
   - HTML в ZIP совпадает с последним `latestHtml`;
   - README присутствует;
   - CRC32 и ZIP directory offsets проверяются;
   - при ошибке ZIP скачивание не запускается.
5. Проверить сохранность SEO title, meta description, canonical, OG metadata, секций, контактов и локально загруженных изображений.
6. Запустить `npm run check` на актуальном HEAD и зафиксировать фактическое число тестов.
7. Обновить PR, оставив его Draft. Не merge.

## 6. Структура проекта и назначение основных модулей

- `src/design-director.js` — анализ ниши, аудитории и цели; выбор одной из 10 архитектур: product-first, editorial, immersive, asymmetric, catalog, split-utility, storytelling, modular, brutalist, minimal. Это детерминированная эвристика, не генеративная модель.
- `src/visual-identity.js` — визуальная система: палитра, типографика, геометрия, сетка, интервалы, плотность, графический язык и motion.
- `src/layout-engine.js` — план адаптивной страницы, порядок секций, компоновка и CSS.
- `src/component-renderer.js` — семантический HTML/CSS renderer, экранирование текста, безопасная обработка URL, изображения, CTA, mock forms.
- `src/studio-pipeline.js` — сквозной процесс от брифа до проекта: Design Director → Visual Identity → Layout Engine → Component Renderer.
- `src/history-manager.js` — undo/redo.
- `src/zip-export.js` — ZIP writer и проверка ZIP integrity.
- `src/site-audit.js` — статический SEO/HTML/CSS/accessibility audit.
- `src/export-readiness.js` — критический pre-export gate.
- `app/index.html`, `app/app.js`, `app/styles.css` — браузерная студия, редакторы, предпросмотр и экспорт.
- `scripts/serve.js` — локальный Node server.
- `test/` — Node.js test suite.
- `docs/` — техническая документация.

## 7. Запуск локально

Требуется Node.js 18+; сторонние зависимости не нужны.

```bash
npm run preview
```

Открыть http://127.0.0.1:4173

Проверка:

```bash
npm run check
```

## 8. Известные ограничения — не скрывать

- Design Director и Visual Identity используют детерминированные правила, а не AI API.
- SEO-аудит анализирует исходный HTML/CSS, не запускает браузер и не проверяет опубликованный сайт по сети.
- Lighthouse, PageSpeed, Core Web Vitals и реальные mobile-browser проверки пока не подтверждены.
- Формы в сгенерированных сайтах демонстрационные и не отправляют заявки.
- Внешние изображения и ссылки требуют доступности интернета; локально загруженные изображения встраиваются в HTML.
- HTML/ZIP readiness gate не является гарантией юридической, SEO или production готовности сайта.

## 9. Рекомендуемый следующий план после стабилизации экспорта

1. Довести текущий gate до зелёного CI и проверить его на разных типах ниш и пользовательских данных.
2. Добавить регрессионные сценарии для SEO/контента/локальных изображений и для ZIP, который должен содержать ровно текущую версию HTML.
3. Провести браузерную проверку Desktop/Tablet/Mobile (реальный browser runner, если доступен), исправить overflow, навигацию, доступность и ошибки консоли.
4. Подготовить отдельный реальный Lighthouse/PageSpeed audit опубликованного URL — не смешивать его с локальной эвристической оценкой.
5. Только затем переходить к расширению функций студии: шаблонные блоки, большее управление контентом и реальная отправка заявок.

## 10. Готовый стартовый запрос для Claude

Открой репозиторий UNIQUE DESIGN STUDIO и продолжи работу строго по документу `docs/CLAUDE-HANDOFF.md`. Сначала проверь текущую ветку, HEAD, PR №3 и последний CI. На момент подготовки handoff последний run `43753023859` упал: 59/60 тестов; смотри точную причину и шаги исправления в разделе 3 и 5. Не меняй `main`, не сливай PR, не переключайся на другие проекты. Исправь проблему теста по фактическому контракту генератора, доведи pre-export gate до полностью зелёного CI, проверь логику HTML/ZIP и сохранность SEO/content. Затем сообщи точный статус, SHA, CI и следующий безопасный шаг. Не заявляй о browser/Lighthouse проверках, если они реально не выполнялись.
