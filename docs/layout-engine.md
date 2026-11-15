# Layout Engine — v1.0

## Назначение

Layout Engine превращает концепцию Design Director и спецификацию Visual Identity в структурный план главной страницы. Для каждой из 10 архитектур задаётся собственная композиция, паттерн секций, сетка и правила перестройки на мобильных экранах.

## API

```js
import { createDesignConcept } from "./src/design-director.js";
import { createVisualIdentity } from "./src/visual-identity.js";
import { createLayoutPlan, renderLayoutCss } from "./src/layout-engine.js";

const concept = createDesignConcept({ businessType:"магазин телескопов", primaryGoal:"purchase" });
const visualIdentity = createVisualIdentity({ concept });
const layout = createLayoutPlan({ concept, visualIdentity });
const css = renderLayoutCss(layout);
```

## Возможности

- Сопоставление секций с семантическими компонентами.
- Десять разных семейств компоновки.
- Адаптивные правила для mobile/tablet/desktop/wide.
- Проверка пустых и повторяющихся секций.
- Контракты доступности и CSS с reduced-motion.
- Передача CSS-токенов из Visual Identity без потери источника.

## Граница текущей реализации

Модуль выдаёт blueprint и базовый CSS, но не является полноценным DOM-компонентным renderer. Следующий этап — библиотека реальных компонентов и HTML renderer с live preview.
