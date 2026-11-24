// Content Intelligence Engine — единая точка подготовки AI-контента и проверки результата.
// Не подменяет реальное исследование: использует существующий prompt/concept pipeline и маркирует
// неподтверждённые коммерческие утверждения как требующие проверки.
import { buildConcept } from './concept.js';
import { normalizeProject } from './project.js';
import { buildPrompt } from './prompt.js';
import { COPYWRITING_MODULES } from './copywriting.js';
import { slugify } from './util.js';

const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const values = value => Array.isArray(value) ? value : [];
const count = value => [...text(value)].length;
const entryTitle = item => text(Array.isArray(item) ? item[0] : item?.title ?? item?.name ?? item?.question ?? item?.label);
const entryText = item => text(Array.isArray(item) ? item[1] : item?.text ?? item?.description ?? item?.answer ?? item?.body);
const entryPrice = item => text(Array.isArray(item) ? item[2] : item?.price);
const validHttpsUrl = value => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  }
  catch { return false; }
};
const validMailto = value => /^mailto:[^\s@?]+@[^\s@?]+(?:\.[^\s@?]+)+(?:\?[^\s]*)?$/i.test(String(value || ''));
const validTel = value => /^tel:\+?[\d().\s-]{5,}$/i.test(String(value || '')) && String(value).replace(/\D/g, '').length >= 5;

const GENERIC_PHRASES = [
  'индивидуальный подход', 'высокое качество', 'команда профессионалов',
  'широкий ассортимент', 'лучшие цены', 'профессиональная команда',
  'уникальное предложение', 'европейское качество', 'короткие сроки',
  'в кратчайшие сроки', 'по всем вопросам обращайтесь', 'уточняется при заказе',
];

const CLAIM_PATTERNS = [
  { id: 'numeric-claim', re: /\b\d+(?:[.,]\d+)?\s*(?:%|лет|года|год|дней|дня|часов|часа|минут|₽|руб(?:лей|ля)?)/i, label: 'Числовое обещание или характеристика' },
  { id: 'absolute-claim', re: /(?:№\s*1|номер один|лучший|самый быстрый|гарантируем|гарантия|100\s*%|всегда|никогда)/i, label: 'Абсолютное или гарантийное утверждение' },
];

/** Готовит единый промт, объединяя концепцию, аудиторию, SEO, конверсию и визуальное направление. */
export function prepareContentIntelligence(input, options = {}) {
  const { registry = [], concept = null, analysis = {}, opts = {} } = options || {};
  const project = normalizeProject(input);
  const selectedConcept = concept?.designDNA && concept?.designBrief && Array.isArray(concept?.homepage?.sectionOrder)
    ? concept : buildConcept(project, { registry: Array.isArray(registry) ? registry : [] });
  const prompt = buildPrompt(project, selectedConcept, analysis, opts);
  return {
    version: 1,
    projectId: project.id,
    project,
    concept: selectedConcept,
    prompt,
    modules: COPYWRITING_MODULES.map(({ id, title }) => ({ id, title })),
    researchStatus: analysis?.researchStatus || (analysis?.marketResearch ? 'partial' : 'not_performed'),
    rules: {
      neverInventBusinessFacts: true,
      separateFactsAndHypotheses: true,
      preserveExistingDesignConcept: true,
      requireSourceUrlsForMarketClaims: true,
      humanApprovalForUnverifiedClaims: true,
    },
  };
}

/**
 * Проверяет готовый AI-контент без переписывания и без изменения исходного объекта.
 * Результат — список конкретных замечаний; claims требуют проверки, но не объявляются ложными.
 */
export function reviewGeneratedContent(content = {}, options = {}) {
  content = content && typeof content === 'object' && !Array.isArray(content) ? content : {};
  const sectionIds = Array.isArray(options?.sectionIds) ? options.sectionIds : undefined;
  const forWorker = options?.forWorker === true;
  const findings = [];
  const add = (id, severity, field, message) => findings.push({ id, severity, field, message });
  const fields = ['title', 'description', 'cta', 'mainOffer', 'targetAudience'];
  for (const field of fields) {
    if (!text(content[field])) add('missing-' + field, 'high', field, 'Поле не заполнено.');
  }
  if (count(content.title) > 60) add('title-length', 'medium', 'title', 'Заголовок первого экрана длиннее 60 символов.');
  if (count(content.description) > 180) add('description-length', 'medium', 'description', 'Описание первого экрана длиннее 180 символов.');
  if (count(content.aboutText) > 1000) add('about-text-length', 'low', 'aboutText', 'Текст раздела «О проекте» длиннее 1000 символов; сократите его или разделите на абзацы.');
  if (count(content.cta) > 32) add('cta-length', 'low', 'cta', 'CTA слишком длинный; лучше оставить короткое действие.');
  if (count(content.seoTitle) > 60) add('seo-title-length', 'medium', 'seoTitle', 'SEO title длиннее рекомендуемых 60 символов.');
  if (count(content.seoDescription) > 160) add('seo-description-length', 'medium', 'seoDescription', 'SEO description длиннее рекомендуемых 160 символов.');
  const longSectionHeadings = ['aboutTitle', 'servicesTitle', 'advantagesTitle', 'processTitle', 'faqTitle', 'contactTitle'].filter(field => count(content[field]) > 80);
  if (longSectionHeadings.length) add('section-heading-length', 'low', longSectionHeadings.join(', '), 'Один или несколько заголовков секций длиннее 80 символов; сократите их для ясной визуальной иерархии.');

  const corpus = fields.map(field => text(content[field])).concat(
    text(content.aboutTitle), text(content.servicesTitle), text(content.advantagesTitle),
    text(content.processTitle), text(content.faqTitle), text(content.contactTitle),
    text(content.aboutText), text(content.servicesIntro), text(content.contactText),
    text(content.strategySummary), text(content.marketResearch),
    values(content.services).flatMap(item => [entryTitle(item), entryText(item), entryPrice(item)]),
    values(content.advantages).flatMap(item => [entryTitle(item), entryText(item)]),
    values(content.process).flatMap(item => [entryTitle(item), entryText(item)]),
    values(content.faqs).flatMap(item => [entryTitle(item), entryText(item)]),
    values(content.imagePrompts).map(text),
  ).filter(Boolean);
  const lower = corpus.join(' ').toLowerCase();
  for (const field of ['services', 'advantages', 'process', 'faqs']) {
    const entries = values(content[field]);
    const titleKeys = entries.map(entryTitle).map(value => value.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()).filter(Boolean);
    const uniqueTitles = new Set(titleKeys);
    const missingTitles = entries.filter(item => entryText(item) && !entryTitle(item)).length;
    const longTitles = entries.filter(item => count(entryTitle(item)) > 100).length;
    const longBodies = entries.filter(item => count(entryText(item)) > 600).length;
    if (missingTitles) add('missing-item-titles', 'medium', field, `${missingTitles} элементов содержат описание без заголовка или вопроса.`);
    if (uniqueTitles.size < titleKeys.length) add('duplicate-item-titles', 'medium', field, 'Внутри раздела повторяются заголовки элементов; различите карточки или удалите дубли.');
    if (longTitles) add('long-content-title', 'low', field, `${longTitles} заголовков элементов длиннее 100 символов; сократите их для удобства сканирования.`);
    if (longBodies) add('long-content-body', 'low', field, `${longBodies} описаний длиннее 600 символов; перенесите подробности в отдельный раздел.`);
  }
  const malformedFaqs = values(content.faqs).filter(item => entryTitle(item) && !/[?？]$/.test(entryTitle(item))).length;
  if (malformedFaqs) add('faq-question-punctuation', 'low', 'faqs', `${malformedFaqs} формулировок FAQ не оформлены как вопросы.`);
  const placeholders = corpus.filter(value => /\[[^\]\n]{3,120}\]|\{\{?[\w.-]{1,48}\}?\}|\b(?:todo|tbd|placeholder|lorem ipsum|заполнить позже|название компании|ваш телефон)\b/i.test(value));
  if (placeholders.length) add('content-placeholder', 'medium', 'content', `В тексте остались редакторские заглушки (${placeholders.length}). Замените их данными бизнеса или удалите.`);
  const ownerInstructions = corpus.filter(value => /\b(?:укажите|добавьте|опишите|подтвердите|уточните|перечислите|сверьте)\b[^.!?]{0,100}\b(?:владелец|владельцу|бриф|проект|редактор|настройк|профиль|перед публикац)\b|\b(?:add|insert|replace|specify|describe|confirm|update|remove|fill in)\b[^.!?]{0,100}\b(?:owner|brief|project|editor|settings|profile|publish)\b/i.test(value));
  if (ownerInstructions.length) add('content-editor-instruction', 'medium', 'content', `В тексте найдены команды владельцу (${ownerInstructions.length}). Перепишите их как готовый контент или уберите из публикации.`);
  for (const phrase of GENERIC_PHRASES) {
    if (lower.includes(phrase)) add('generic-copy', 'medium', 'content', 'Штамп «' + phrase + '»: замените конкретным преимуществом или доказательством.');
  }
  const seen = new Map();
  for (const value of corpus) {
    const key = value.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (key.length < 18) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  if ([...seen.values()].some(n => n > 1)) add('duplicate-copy', 'medium', 'content', 'Обнаружены повторяющиеся формулировки между секциями.');

  const pricedItems = values(content.services).filter(item => entryPrice(item));
  if (pricedItems.length) add('price-claims', 'review', 'services', `В каталоге есть ${pricedItems.length} цен. Проверьте каждую по актуальному прайсу владельца.`);

  for (const pattern of CLAIM_PATTERNS) {
    const matches = corpus.filter(value => pattern.re.test(value));
    if (matches.length) add(pattern.id, 'review', 'content', `${pattern.label} обнаружено в ${matches.length} фрагментах — подтвердите данными владельца.`);
  }
  if (CLAIM_PATTERNS.some(pattern => corpus.some(value => pattern.re.test(value))) && !values(content.assumptions).some(text)) {
    add('claims-without-assumptions', 'medium', 'assumptions', 'Есть проверяемые коммерческие утверждения, но не заполнен список допущений и фактов для подтверждения.');
  }
  const sources = values(content.researchSources);
  const invalidSources = sources.filter(source => !source || !validHttpsUrl(source.url));
  if (invalidSources.length) add('invalid-research-source', 'medium', 'researchSources', `${invalidSources.length} источников не содержат корректный HTTPS-адрес; удалите или исправьте их.`);
  const unnamedSources = sources.filter(source => source && validHttpsUrl(source.url) && !text(source.title));
  if (unnamedSources.length) add('unnamed-research-source', 'low', 'researchSources', `${unnamedSources.length} источников без названия; добавьте короткую подпись для отчёта.`);
  if (sources.length > 10) add('many-research-sources', 'low', 'researchSources', `Добавлено ${sources.length} источников; оставьте до десяти наиболее релевантных.`);
  if (text(content.marketResearch) && !sources.some(source => validHttpsUrl(source?.url))) add('research-without-sources', 'medium', 'marketResearch', 'Есть обзор рынка без проверяемых HTTPS-источников; обозначьте его как гипотезу или добавьте ссылки.');
  const sourceUrls = sources.map(source => {
    try {
      const url = new URL(source?.url);
      url.hash = '';
      if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
      return url.toString();
    } catch { return ''; }
  }).filter(Boolean);
  if (new Set(sourceUrls).size < sourceUrls.length) add('duplicate-research-source', 'low', 'researchSources', 'В списке источников повторяется URL; оставьте одну запись.');
  const keywordKeys = values(content.keywords).map(value => text(value).toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()).filter(Boolean);
  if (new Set(keywordKeys).size < keywordKeys.length) add('duplicate-keywords', 'low', 'keywords', 'Список поисковых запросов содержит повторы; замените дубли разными формулировками.');
  const keywordLimit = forWorker ? 5 : 10;
  if (keywordKeys.length > keywordLimit) add('too-many-keywords', 'low', 'keywords', `Подготовлено ${keywordKeys.length} запросов; лимит этого формата — ${keywordLimit}.`);
  const imagePrompts = values(content.imagePrompts).map(text).filter(Boolean);
  if (imagePrompts.length < 3) add('few-image-prompts', 'low', 'imagePrompts', `Подготовлено ${imagePrompts.length} визуальных заданий; для разнообразного набора нужно не менее трёх.`);
  if (imagePrompts.length > 5) add('many-image-prompts', 'low', 'imagePrompts', `Подготовлено ${imagePrompts.length} визуальных заданий; в базовом формате ожидается не более пяти.`);
  const normalizedImagePrompts = imagePrompts.map(value => value.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim());
  if (new Set(normalizedImagePrompts).size < normalizedImagePrompts.length) add('duplicate-image-prompts', 'low', 'imagePrompts', 'Визуальные задания повторяются; задайте разные сюжеты и ракурсы.');

  const sectionFields = { items: 'services', advantages: 'advantages', process: 'process', faq: 'faqs' };
  const sections = Array.isArray(sectionIds)
    ? Object.entries(sectionFields).filter(([sectionId]) => sectionIds.includes(sectionId)).map(([, field]) => field)
    : Object.values(sectionFields);
  for (const field of sections) {
    const items = values(content[field]);
    const usableItems = items.filter(item => entryTitle(item) || entryText(item));
    if (!usableItems.length) add('missing-' + field, 'medium', field, 'Раздел не содержит пригодных для показа элементов.');
    else if (usableItems.length < items.length) add('empty-content-items', 'low', field, `В разделе ${items.length - usableItems.length} пустых элемента; удалите их или заполните.`);
  }
  if (Array.isArray(sectionIds) && sectionIds.includes('about') && !text(content.aboutText)) {
    add('missing-about', 'medium', 'aboutText', 'Выбран раздел «О проекте», но его текст пуст.');
  }
  if (Array.isArray(sectionIds) && sectionIds.includes('contact')) {
    const contacts = content.contacts || {};
    const hasPhone = text(contacts.phone).replace(/\D/g, '').length >= 5;
    const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(contacts.email));
    const hasForm = validHttpsUrl(content.formAction);
    const ctaUrl = text(content.ctaUrl);
    const hasExternalCta = validHttpsUrl(ctaUrl) || validMailto(ctaUrl) || validTel(ctaUrl);
    if (text(contacts.email) && !hasEmail) add('invalid-contact-email', 'medium', 'contacts.email', 'Проверьте формат e-mail: в нём должен быть адрес вида name@example.com.');
    if (text(contacts.phone) && !hasPhone) add('invalid-contact-phone', 'medium', 'contacts.phone', 'В номере телефона должно быть не менее пяти цифр.');
    if (text(content.formAction) && !hasForm) add('invalid-form-endpoint', 'medium', 'formAction', 'Адрес получателя формы должен быть корректным HTTPS URL.');
    if (ctaUrl && !(/^#[-\w]+$/.test(ctaUrl) || validHttpsUrl(ctaUrl) || validMailto(ctaUrl) || validTel(ctaUrl))) add('invalid-contact-link', 'medium', 'ctaUrl', 'Ссылка основного действия должна быть якорем страницы, корректным HTTPS URL, mailto: или tel:.');
    if (sectionIds && /^#[-\w]+$/.test(ctaUrl)) {
      const anchors = new Set(['main', 'top', ...sectionIds]);
      for (const item of normalizeProject(content).services) anchors.add('item-' + slugify(item.id));
      if (!anchors.has(ctaUrl.slice(1))) add('missing-cta-anchor', 'medium', 'ctaUrl', `Якорь ${ctaUrl} не соответствует разделу или карточке на этой странице.`);
    }
    if (!hasPhone && !hasEmail && !hasForm && !hasExternalCta) {
      add('missing-contact-path', 'medium', 'contact', 'Не настроен рабочий путь обращения: укажите корректный телефон, e-mail, HTTPS-форму или ссылку.');
    }
  }
  const blocking = findings.filter(item => item.severity === 'high').length;
  const score = Math.max(0, Math.min(100, 100 - findings.reduce((sum, item) => sum + (item.severity === 'high' ? 18 : item.severity === 'medium' ? 8 : item.severity === 'review' ? 5 : 3), 0)));
  return {
    version: 1,
    score,
    status: blocking ? 'needs-work' : findings.length ? 'review' : 'passed',
    findings,
    summary: blocking ? 'Есть незаполненные обязательные поля.' : findings.length ? 'Нужна редакторская проверка замечаний.' : 'Базовые проверки пройдены.',
    sourceMutated: false,
  };
}

export const CONTENT_INTELLIGENCE_MODULES = COPYWRITING_MODULES;
