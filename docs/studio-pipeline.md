# Studio Pipeline — v1.0

## Назначение

Единая точка запуска движков UNIQUE DESIGN STUDIO: Design Director → Visual Identity → Layout Engine → Component Renderer.

## Использование

```js
import { createStudioProject } from "./src/studio-pipeline.js";

const project = createStudioProject({
  businessType: "магазин телескопов",
  businessName: "Astro",
  audience: "начинающие астрономы и любители наблюдений",
  primaryGoal: "purchase",
  contentPriority: ["каталог", "подбор", "сравнение характеристик"],
  contentBySection: {
    "category-grid": {
      title: "Каталог телескопов",
      description: "Подберите оптику для наблюдений."
    }
  }
});

console.log(project.html);
```

## Результат

Возвращает бриф, Design DNA, визуальную идентичность, план страницы, CSS, HTML и метаданные. Генерация выполняется локально, без внешнего API. Архитектура и визуальная система выбираются детерминированными эвристиками.

## Ограничения перед публикацией

Тексты, изображения, адреса и цены должны быть проверены владельцем проекта. Формы пока являются макетами и не отправляют заявки. Подключите обработчик форм, проверьте ссылки, доступность и мобильную вёрстку перед публикацией.
