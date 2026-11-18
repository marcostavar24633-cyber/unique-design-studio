// Content Intelligence Engine — единая точка подготовки AI-контента и проверки результата.
// Не подменяет реальное исследование: использует существующий prompt/concept pipeline и маркирует
// неподтверждённые коммерческие утверждения как требующие проверки.
import { buildConcept } from './concept.js';
import { normalizeProject } from './project.js';
import { buildPrompt } from './prompt.js';
import { COPYWRITING_MODULES } from './copywriting.js';

const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const values = value => Array.isArray(value) ? value : [];
const count = value => [...text(value)].length;

const GENERIC_PHRASES = [
  'индивидуальный подход', 'высокое качество', 'команда профессионалов',
  'широкий ассортимент', 'лучшие цены', 'профессиональная команда',
  'уникальное предложение', 'европейское качество', 'короткие сроки',
];

const CLAIM_PATTERNS = [
  { id: 'numeric-claim', re: /\b\d+(?:[.,]\d+)?\s*(?:%|лет|года|год|дней|дня|часов|часа|минут|₽|руб(?:лей|ля)?)/i, label: 'Числовое обещание или характеристика' },
  { id: 'absolute-claim', re: /(?:№\s*1|номер один|лучший|самый быстрый|гарантируем|гарантия|100\s*%|всегда|никогда)/i, label: 'Абсолютное или гарантийное утверждение' },
];

/** Готовит единый промт, объединяя концепцию, аудиторию, SEO, конверсию и визуальное направление. */
export function prepareContentIntelligence(input, { registry = [], concept = null, analysis = {}, opts = {} } = {}) {
  const project = normalizeProject(input);
  const selectedConcept = concept || buildConcept(project, { registry });
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
export function reviewGeneratedContent(content = {}) {
  const findings = [];
  const add = (id, severity, field, message) => findings.push({ id, severity, field, message });
  const fields = ['title', 'description', 'cta', 'seoTitle', 'seoDescription'];
  for (const field of fields) {
    if (!text(content[field])) add('missing-' + field, 'high', field, 'Поле не заполнено.');
  }
  if (count(content.title) > 60) add('title-length', 'medium', 'title', 'Заголовок первого экрана длиннее 60 символов.');
  if (count(content.description) > 180) add('description-length', 'medium', 'description', 'Описание первого экрана длиннее 180 символов.');
  if (count(content.cta) > 32) add('cta-length', 'low', 'cta', 'CTA слишком длинный; лучше оставить короткое действие.');
  if (count(content.seoTitle) > 60) add('seo-title-length', 'medium', 'seoTitle', 'SEO title длиннее рекомендуемых 60 символов.');
  if (count(content.seoDescription) > 160) add('seo-description-length', 'medium', 'seoDescription', 'SEO description длиннее рекомендуемых 160 символов.');

  const corpus = fields.map(field => text(content[field])).concat(
    values(content.services).flatMap(item => [text(item?.title ?? item?.[0]), text(item?.text ?? item?.[1])]),
    values(content.advantages).flatMap(item => [text(item?.title ?? item?.[0]), text(item?.text ?? item?.[1])]),
    values(content.process).flatMap(item => [text(item?.title ?? item?.[0]), text(item?.text ?? item?.[1])]),
    values(content.faqs).flatMap(item => [text(item?.title ?? item?.[0]), text(item?.text ?? item?.[1])]),
  ).filter(Boolean);
  const lower = corpus.join(' ').toLowerCase();
  for (const phrase of GENERIC_PHRASES) {
    if (lower.includes(phrase)) add('generic-copy', 'medium', 'content', 'Штамп «' + phrase + '»: замените конкретным преимуществом или доказательством.');
  }
  const seen = new Map();
  for (const value of corpus) {
    const key = value.toLowerCase();
    if (key.length < 18) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  if ([...seen.values()].some(n => n > 1)) add('duplicate-copy', 'medium', 'content', 'Обнаружены повторяющиеся формулировки между секциями.');

  for (const field of ['title', 'description', 'mainOffer', 'aboutText', 'contactText']) {
    const value = text(content[field]);
    for (const pattern of CLAIM_PATTERNS) {
      if (pattern.re.test(value)) add(pattern.id, 'review', field, pattern.label + ' — подтвердите документом или данными владельца.');
    }
  }

  const sections = ['services', 'advantages', 'process', 'faqs'];
  for (const field of sections) {
    if (!values(content[field]).length) add('missing-' + field, 'medium', field, 'Раздел не содержит элементов.');
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
