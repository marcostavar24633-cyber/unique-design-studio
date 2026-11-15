# Component Renderer — v1.0

## Назначение

Component Renderer превращает Layout Plan в реальный HTML-документ. Он использует семантические HTML-элементы, адаптивные CSS-стили и контент, переданный в секциях. Тексты экранируются, ссылки проходят проверку схемы, произвольный HTML не принимается.

## API

```js
import { createDesignConcept } from "./design-director.js";
import { createVisualIdentity } from "./visual-identity.js";
import { createLayoutPlan } from "./layout-engine.js";
import { renderHtmlPage, renderComponentCss } from "./component-renderer.js";

const concept = createDesignConcept({ businessType:"магазин телескопов", primaryGoal:"purchase" });
const visualIdentity = createVisualIdentity({ concept });
const layoutPlan = createLayoutPlan({ concept, visualIdentity });
const html = renderHtmlPage({
  layoutPlan,
  visualIdentity,
  businessName:"Astro Shop",
  css:renderComponentCss()
});
```

## Компоненты

Renderer поддерживает hero-композиции, карточки, списки, изображения, ссылки, цитаты и формы-макеты. Неизвестные компоненты получают безопасную базовую оболочку секции.

## Безопасность и ограничения

- Текст экранируется; raw HTML не исполняется.
- Ссылки с javascript:/data: и protocol-relative URL не пропускаются.
- Формы не отправляют данные: это визуальные макеты до подключения backend/action.
- Не добавляйте секреты и приватные данные в статическую страницу.
- Проверяйте контент, доступность, контраст и юридические требования перед публикацией.
