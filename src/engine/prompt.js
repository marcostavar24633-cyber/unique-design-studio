// Промт для локального AI-помощника: концепция выводится в промте (§11.3),
// чтобы тексты писались внутри выбранной композиции, а не под типовой шаблон.
import { ARCHETYPES } from './data.js';
import { normalizeProject } from './project.js';

export function buildPrompt(input, concept) {
  const p = normalizeProject(input);
  const b = concept.designBrief, d = concept.designDNA, h = concept.homepage;
  const list = arr => arr.map(x => `- ${x}`).join('\n') || '- (нет)';
  return `Ты — UX-копирайтер и дизайнер главной страницы. Напиши тексты для проекта строго внутри концепции ниже.

# Проект
Бренд: ${p.brand || '(не указан)'}
Ниша: ${p.niche || '(не указана)'}

# Design Brief
Бизнес: ${b.businessType}
Продукт: ${b.product || '(не указан)'}
Аудитория: ${b.audience}
Главное целевое действие: ${b.primaryGoal}
Характер бренда: ${b.brandCharacter}
Приоритет контента:
${list(b.contentPriority)}
Ограничения:
${list(b.constraints)}
Гипотезы (не выдавать за факты):
${list(b.assumptions)}

# Design DNA
Основная архитектура: ${ARCHETYPES[d.primaryArchetype].name}${d.secondaryArchetype ? `; вспомогательная: ${ARCHETYPES[d.secondaryArchetype].name}` : ''}
Обоснование: ${d.selectionRationale}
Цвет: ${d.colorDirection}
Типографика: ${d.typographyDirection}
Изображения: ${d.imageDirection}
Движение: ${d.motionDirection}

# Главная страница
Первый экран: ${h.heroComposition}
Навигация: ${h.navigationPattern}
Секции по порядку:
${h.sections.map(s => `- ${s.id} — ${s.role}`).join('\n')}
Основной CTA: ${h.primaryCTA}

# Правила
- Не выдумывай цены, отзывы, сертификаты, адреса, телефоны, гарантии и характеристики. Неизвестное оформляй как гипотезу в assumptions.
- Заголовок первого экрана должен за секунды объяснять нишу и предложение.
- Пиши только для перечисленных секций; не добавляй блоки «на всякий случай».
- Один основной CTA: «${h.primaryCTA}».

# Формат ответа
Верни JSON с полями: title, description, cta, aboutTitle, aboutText, servicesTitle, servicesIntro, services [[заголовок, текст]], advantagesTitle, advantages [[заголовок, текст]], processTitle, process [[заголовок, текст]], faqs [[вопрос, ответ]], contactTitle, contactText, assumptions [строки].
Этот JSON можно импортировать в Unique Design Studio и в Landing Studio без изменений.`;
}
