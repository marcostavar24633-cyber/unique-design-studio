# Visual Identity Engine — v1.0

## Назначение

Visual Identity Engine превращает выбранную архитектуру Design Director в конкретную визуальную систему. Он не ограничивается названием палитры: формирует цвета, типографическую пару, геометрию, сетку, плотность, ритм отступов, графический язык и поведение интерфейса.

## API

```js
import { createDesignConcept } from "./src/design-director.js";
import { createVisualIdentity } from "./src/visual-identity.js";

const concept = createDesignConcept({
  businessType: "магазин телескопов",
  businessName: "Astro",
  audience: "начинающие астрономы и любители наблюдений",
  primaryGoal: "purchase"
});

const identity = createVisualIdentity({ concept });
console.log(identity.cssVariables);
```

Можно передать `archetype`, `identitySeed`, `paletteId`, `shapeId` напрямую. Повторный вызов с одинаковыми входными данными даёт одинаковый результат. Для ручного выбора палитры доступны 18 вариантов, геометрии — 5 систем.

## Что возвращается

- `palette`: фон, поверхности, основной текст, приглушённый текст, акцент и мягкий акцент.
- `typography`: display/body шрифты, масштаб и параметры заголовков.
- `geometry`: радиусы, характер кнопок и карточек, толщина линий.
- `layout`: тип сетки, композиция hero, пропорции изображений, плотность и выравнивание.
- `spacing`: адаптивный вертикальный ритм и интервалы.
- `graphics`: стиль графики, иконок, изображений и текстур.
- `interaction`: обратная связь элементов и обязательный reduced-motion fallback.
- `cssVariables`: CSS custom properties для подключения к рендереру.

## Ограничения

Движок детерминированный и работает без внешнего API. Он создаёт спецификацию визуальной системы, но сам по себе не рисует изображения и не рендерит HTML. Реальную визуальную уникальность необходимо проверять на готовой странице.


## Интеграция с актуальным движком

Модуль экспортируется из `src/engine/index.js` как `createVisualIdentity` и `listVisualIdentityOptions`. Он принимает результат `buildConcept()` через `concept.designDNA.primaryArchetype` и формирует отдельный слой визуальной идентичности. Он пока не заменяет `visualSystem` рендерера: существующая генерация HTML сохраняет прежний контракт, а подключение визуального слоя к HTML требует отдельной миграции и визуальных регрессионных тестов.
