// AI Design Director PRO — безопасный аудит и план улучшений поверх основного движка.
// Не выбирает нишу и не дублирует buildConcept: анализирует уже собранный результат.
import { normalizeProject } from './project.js';

const clone = value => JSON.parse(JSON.stringify(value));
const has = value => String(value ?? '').trim().length > 0;
const itemCount = value => Array.isArray(value) ? value.length : 0;

function recommendation(id, title, category, priority, reason, action, patch = null) {
  return { id, title, category, priority, reason, action, patch };
}

/**
 * Создаёт проверяемый отчёт Director для проекта и результата generate().
 * Все рекомендации — предложения; исходный проект не мутируется.
 */
export function reviewDesign(input, generated = null) {
  const project = normalizeProject(input);
  const concept = generated?.concept || null;
  const audit = generated?.audit || null;
  const sections = concept?.homepage?.sectionOrder || [];
  const recommendations = [];

  if (!has(project.title) || !has(project.cta)) {
    recommendations.push(recommendation(
      'hero-clarity', 'Усилить первый экран', 'conversion', 'high',
      'Главный заголовок и основное действие должны за несколько секунд объяснять предложение и следующий шаг.',
      'Подготовить более конкретный заголовок и понятный CTA. Не придумывать цены, сроки и гарантии.',
      { title: project.title, cta: project.cta }
    ));
  }

  if (!has(project.ctaUrl) && !has(project.formAction) && !has(project.contacts?.phone) && !has(project.contacts?.email)) {
    recommendations.push(recommendation(
      'conversion-destination', 'Настроить реальное целевое действие', 'conversion', 'critical',
      'Кнопка без настроенного адреса или контакта не гарантирует получение заявки.',
      'Добавить подтверждённую ссылку, телефон, e-mail или HTTPS endpoint. До настройки не считать отправку заявки работающей.'
    ));
  }

  if (itemCount(project.services) >= 3 && !sections.includes('services')) {
    recommendations.push(recommendation(
      'catalog-visibility', 'Показать каталог заметнее', 'structure', 'high',
      'В проекте есть несколько позиций, но каталог не попал в текущую структуру.',
      'Проверить архитектуру Product First или Catalog и вынести ассортимент ближе к началу страницы.'
    ));
  }

  if (!project.images?.hero && !itemCount(project.gallery) && !itemCount(project.services?.filter?.(x => x.image))) {
    recommendations.push(recommendation(
      'hero-visual', 'Добавить главный визуальный материал', 'visual', 'high',
      'В проекте пока нет загруженных фотографий для первого экрана или галереи.',
      'Подготовить подходящий кадр для hero и проверить композицию на десктопе и телефоне.'
    ));
  }

  if (itemCount(project.advantages) < 2) {
    recommendations.push(recommendation(
      'proof-points', 'Усилить доказательства ценности', 'content', 'medium',
      'В проекте мало конкретных преимуществ, на которых посетитель может основывать выбор.',
      'Добавить только подтверждённые особенности, факты, условия или реальные доказательства; не генерировать фиктивные отзывы и сертификаты.'
    ));
  }

  if (itemCount(project.faqs) === 0) {
    recommendations.push(recommendation(
      'faq-objections', 'Закрыть частые вопросы', 'content', 'medium',
      'В структуре нет FAQ, который может снять типовые сомнения перед обращением.',
      'Составить вопросы по нише и пометить ответы, требующие подтверждения владельцем.'
    ));
  }

  if (has(project.images?.hero) && !has(project.images?.heroAlt)) {
    recommendations.push(recommendation(
      'hero-alt', 'Добавить альтернативный текст изображения', 'accessibility', 'medium',
      'У главного изображения отсутствует текстовое описание.',
      'Описать содержимое изображения кратко и по делу.'
    ));
  }

  if (audit?.issues?.length) {
    recommendations.push(recommendation(
      'audit-issues', 'Исправить замечания технической проверки', 'quality', 'high',
      `Основной аудит обнаружил ${audit.issues.length} замечаний.`,
      'Разобрать замечания основного QA и исправлять их по одному с повторной проверкой.'
    ));
  }

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    version: 1,
    projectId: project.id,
    generatedAt: new Date().toISOString(),
    status: recommendations.length ? 'review-needed' : 'looks-good',
    designBrief: concept?.designBrief || null,
    designDNA: concept?.designDNA || null,
    currentStructure: ['hero', ...sections],
    recommendations,
    safety: {
      sourceMutated: false,
      autoApplied: false,
      requiresApproval: true,
      localStorageOnly: true,
    },
    snapshot: clone(input && typeof input === 'object' ? input : {}),
  };
}

const APPROVED_FIELDS = new Set([
  'title', 'description', 'cta', 'ctaUrl', 'targetAudience', 'mainOffer',
  'aboutTitle', 'aboutText', 'servicesTitle', 'servicesIntro',
  'advantagesTitle', 'processTitle', 'faqTitle', 'contactTitle', 'contactText',
  'architecture', 'palette', 'accent', 'tier', 'fonts', 'brandProfile',
]);

/**
 * Применяет только явно одобренные поля из patch. Всегда возвращает новый объект.
 * Никакие неизвестные поля, изображения или локальные данные не удаляются.
 */
export function applyApprovedDesignPatch(input, patch, approvedFields = []) {
  const allowed = new Set(approvedFields.filter(key => APPROVED_FIELDS.has(key)));
  const next = clone(input && typeof input === 'object' ? input : {});
  const applied = [];
  for (const key of allowed) {
    if (!Object.hasOwn(patch || {}, key)) continue;
    next[key] = patch[key];
    applied.push(key);
  }
  return { project: next, applied, changed: applied.length > 0 };
}

export const DESIGN_DIRECTOR_APPROVABLE_FIELDS = Object.freeze([...APPROVED_FIELDS]);
