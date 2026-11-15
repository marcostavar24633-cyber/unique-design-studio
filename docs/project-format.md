# Формат проекта (JSON)

Версия формата — `2`. Все поля необязательны: пустые секции просто не выводятся. Для осмысленного результата нужны как минимум `brand` и `niche`.

## Основные поля

| Поле | Тип | Назначение |
| --- | --- | --- |
| `id` | строка | Идентификатор в реестре. По умолчанию строится из `brand` |
| `brand`, `niche` | строка | Бренд и ниша. По нише определяется профиль бизнеса |
| `title`, `description` | строка | Заголовок и описание первого экрана |
| `cta`, `ctaUrl` | строка | Текст и ссылка главной кнопки. Без `ctaUrl` кнопка ведёт к контактам |
| `targetAudience`, `primaryGoal`, `brandCharacter`, `mainOffer` | строка | Данные для Design Brief. Пустые заменяются помеченными гипотезами |
| `assumptions` | строки | Гипотезы, которые нужно показать в brief |
| `lang` | строка | Язык документа, по умолчанию `ru` |

## Архитектура и стиль

| Поле | Значения |
| --- | --- |
| `architecture` | `auto` или точный id: `product-first`, `editorial`, `immersive`, `asymmetric`, `catalog`, `split-utility`, `storytelling`, `modular-grid`, `brutalist`, `minimal` |
| `designArchitecture` | Семейство из редактора Landing Studio: `catalog`, `editorial`, `immersive`, `service`, `modular` |
| `secondaryArchitecture` | Точный id вспомогательной архитектуры |
| `palette` | `Светлая`, `Тёмная` или пусто (подбор по нише) |
| `accent` | HEX-цвет акцента или пусто |
| `fonts` | `system` (по умолчанию: системные шрифты, страница без внешних запросов) или `web` (Google Fonts с кириллицей под выбранный характер типографики, системный стек остаётся запасным) |

Соответствие семейств: `catalog` → catalog, product-first; `editorial` → editorial; `immersive` → immersive; `service` → split-utility, storytelling, minimal; `modular` → modular-grid, asymmetric, brutalist.

В экспорте дополнительно пишутся `architectureMode` (`auto`, `family`, `exact`), `paletteLocked` и `accentLocked`: по ним при повторном импорте автоматически подобранные значения не превращаются в жёсткий выбор.

## Контент

Списки принимают строки-массивы или объекты:

```json
"services": [
  ["Капучино", "Эспрессо и взбитое молоко", "250 ₽", "https://…/cappuccino.jpg"],
  { "title": "Круассан", "text": "На сливочном масле", "price": "180 ₽" }
]
```

| Поле | Элемент | Секция |
| --- | --- | --- |
| `servicesTitle`, `servicesIntro`, `services` | `[название, описание, цена?, картинка?]` | Каталог / услуги / меню |
| `categories` | строка | Плитки и строка разделов в каталожных архитектурах |
| `aboutTitle`, `aboutText` | — | О нас |
| `advantagesTitle`, `advantagesIntro`, `advantages` | `[заголовок, текст]` | Преимущества |
| `processTitle`, `process` | `[этап, текст]` | Этапы |
| `faqTitle`, `faqs` | `[вопрос, ответ]` | Вопросы |
| `galleryTitle`, `gallery` | `{ "src", "alt", "caption" }` | Галерея |
| `images` | `{ "hero", "heroAlt" }` | Изображение первого экрана |
| `contactTitle`, `contactText`, `contacts` | `{ "phone", "email", "address", "hours" }` | Контакты |
| `formAction` | `https://…` | Обработчик формы. Без него при наличии e-mail форма открывает почтовую программу |

Ссылки и адреса картинок принимаются только со схемами `https:`, `http:`, относительные, `#якорь`, `mailto:`, `tel:` и `data:image/…`; остальное отбрасывается.

## Концепция (`concept.json` и поле `concept` в экспорте)

```json
{
  "designBrief": { "businessType": "", "product": "", "audience": "", "primaryGoal": "", "brandCharacter": "", "trustProofs": [], "contentPriority": [], "constraints": [], "assumptions": [] },
  "designDNA": { "primaryArchetype": "", "secondaryArchetype": "", "selectionRationale": "", "colorDirection": "", "typographyDirection": "", "imageDirection": "", "motionDirection": "" },
  "homepage": { "heroComposition": "", "navigationPattern": "", "sectionOrder": [], "sections": [{ "id": "", "role": "" }], "primaryCTA": "" },
  "uniquenessCheck": { "templateReuseDetected": false, "repeatedPatterns": [], "differentiationActions": [], "comparedWith": [], "fingerprint": {} }
}
```

`templateReuseDetected: true` означает, что повтор соседнего проекта устранить не удалось; такая страница не проходит проверку. Найденные и устранённые повторы перечислены в `repeatedPatterns` и `differentiationActions`.

## Реестр

Массив записей `{ "id", "brand", "fingerprint" }` в порядке генерации. Отпечаток: `archetype`, `placement`, `typeCharacter`, `nav`, `colorDirection`, `shape`.
