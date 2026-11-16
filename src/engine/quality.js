// Контроль качества готового сайта: замечания по 14 направлениям, уровни Critical / High / Medium / Low,
// безопасные автоисправления с повторной проверкой и защитой от бесконечного цикла.
// Источники: технический аудит (audit.js), Design Director (design-director.js), проверка уникальности
// и определения ниши. Ничего не выдумывается: автоисправления только сокращают или собирают SEO-тексты
// из того, что уже есть в проекте.
import { reviewDesign } from './design-director.js';
import { detectNiche } from './concept.js';
import { normalizeProject } from './project.js';

export const SEVERITIES = Object.freeze(['critical', 'high', 'medium', 'low']);
export const SEVERITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

export const CATEGORIES = Object.freeze({
  uniqueness: 'Визуальная уникальность',
  niche: 'Соответствие нише',
  commercial: 'Коммерческая эффективность',
  hierarchy: 'Иерархия информации',
  typography: 'Типографика',
  contrast: 'Контраст',
  images: 'Изображения',
  responsive: 'Адаптивность',
  ux: 'UX',
  functionality: 'Работоспособность интерфейса',
  seo: 'SEO',
  performance: 'Производительность',
  accessibility: 'Доступность',
  security: 'Безопасность',
});

// Проверки technical audit → направление. Неизвестные id попадают в «UX».
const AUDIT_CATEGORY = {
  lang: 'seo', title: 'seo', description: 'seo', 'seo-title-length': 'seo', 'seo-description-length': 'seo', 'og-title': 'seo', 'og-description': 'seo',
  h1: 'hierarchy', landmarks: 'accessibility', 'skip-link': 'accessibility', focus: 'accessibility', 'reduced-motion': 'accessibility', 'form-labels': 'accessibility',
  'img-alt': 'accessibility', 'img-alt-empty': 'accessibility', 'img-alt-duplicates': 'accessibility', 'img-alt-quality': 'accessibility',
  'unique-ids': 'functionality', links: 'functionality', cta: 'commercial', 'cta-path': 'commercial', 'form-delivery': 'functionality',
  'safe-urls': 'security', 'self-contained': 'security',
  contrast: 'contrast', 'no-images': 'images', placeholders: 'commercial', 'placeholder-contacts': 'commercial', 'no-invented-prices': 'commercial',
  uniqueness: 'uniqueness', rationale: 'niche', viewport: 'responsive', weight: 'performance',
};
const CRITICAL_AUDIT = new Set(['safe-urls', 'no-invented-prices', 'unique-ids', 'viewport', 'links']);
const DIRECTOR_CATEGORY = { conversion: 'commercial', structure: 'hierarchy', visual: 'images', content: 'commercial', accessibility: 'accessibility', quality: 'ux' };

const SEO_TITLE = { min: 30, max: 60 };
const SEO_DESC = { min: 120, max: 160 };

const categoryOfAudit = id => (id.startsWith('performance-') ? 'performance' : AUDIT_CATEGORY[id] || 'ux');

function severityOfAudit(check) {
  if (check.level === 'error') return CRITICAL_AUDIT.has(check.id) ? 'critical' : 'high';
  return categoryOfAudit(check.id) === 'performance' ? 'low' : 'medium';
}

/** Сокращает текст по границе слова, без многоточия посреди слова. */
export function clipWords(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : t.slice(0, max)).replace(/[\s,;:—–-]+$/, '');
}

const pageTitleOf = p => p.seoTitle || (p.title && p.brand && p.title !== p.brand ? `${p.title} — ${p.brand}` : p.title || p.brand);
const pageDescOf = p => p.seoDescription || p.description || p.mainOffer || '';

/** SEO-тексты в рекомендованных пределах — только из имеющихся в проекте фраз. */
function seoFix(raw, kind) {
  const p = normalizeProject(raw);
  if (kind === 'title') {
    const variants = [pageTitleOf(p), p.title, `${p.title} — ${p.brand}`, `${p.brand}: ${p.niche}`].filter(Boolean);
    const fitting = variants.find(v => v.length >= SEO_TITLE.min && v.length <= SEO_TITLE.max);
    const value = fitting || clipWords(variants[0], SEO_TITLE.max);
    const fits = value && value.length >= SEO_TITLE.min && value.length <= SEO_TITLE.max;
    return fits && value !== pageTitleOf(p) ? { seoTitle: value } : null;
  }
  const sentences = [p.description, p.mainOffer, p.servicesIntro, p.aboutText]
    .filter(Boolean).flatMap(t => String(t).split(/(?<=[.!?])\s+/)).map(s => s.trim()).filter(s => s && !/\[[^\]]*\]/.test(s));
  let text = '';
  for (const s of [...new Set(sentences)]) {
    const next = text ? `${text} ${s}` : s;
    if (next.length > SEO_DESC.max) break;
    text = next;
    if (text.length >= SEO_DESC.min) break;
  }
  if (!text) text = clipWords(pageDescOf(p), SEO_DESC.max);
  // Предлагаем исправление, только если оно действительно укладывается в норму; иначе — ручная правка.
  const fits = text.length >= SEO_DESC.min && text.length <= SEO_DESC.max;
  return fits && text !== pageDescOf(p) ? { seoDescription: text } : null;
}

const AUTO_FIXES = {
  'seo-title-length': raw => seoFix(raw, 'title'),
  'seo-description-length': raw => seoFix(raw, 'description'),
};

/**
 * Отчёт о качестве готового результата generate().
 * @returns {{ findings: object[], counts: Record<string, number>, byCategory: Record<string, object[]>, score: number }}
 */
export function qualityReport(generated) {
  const project = generated.project;
  const findings = [];
  const add = f => findings.push({ autoFix: false, ...f });

  for (const c of [...(generated.audit?.errors || []), ...(generated.audit?.warnings || [])]) {
    add({ id: `audit:${c.id}`, source: 'audit', category: categoryOfAudit(c.id), severity: severityOfAudit(c), message: c.message, autoFix: Boolean(AUTO_FIXES[c.id]) && Boolean(AUTO_FIXES[c.id](project)) });
  }

  const review = reviewDesign(project, generated);
  for (const r of review.recommendations) {
    if (r.id === 'audit-issues') continue; // уже разложено по отдельным замечаниям выше
    add({ id: `director:${r.id}`, source: 'design-director', category: DIRECTOR_CATEGORY[r.category] || 'ux', severity: r.priority, message: `${r.title}. ${r.reason}`, action: r.action });
  }

  const u = generated.concept?.uniquenessCheck;
  const closest = (u?.comparedWith || []).reduce((m, x) => Math.max(m, x.similarity || 0), 0);
  if (closest >= 0.75) add({ id: 'uniqueness:similar', source: 'uniqueness', category: 'uniqueness', severity: 'medium', message: `Сайт похож на один из прошлых проектов на ${Math.round(closest * 100)}% — проверьте первый экран и порядок секций.` });
  if (detectNiche(project).id === 'generic') add({ id: 'niche:generic', source: 'niche', category: 'niche', severity: 'medium', message: 'Ниша не распознана: структура и тексты собраны по универсальному профилю. Уточните нишу или добавьте описание бизнеса.' });

  const order = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  const counts = Object.fromEntries(SEVERITIES.map(s => [s, findings.filter(f => f.severity === s).length]));
  const byCategory = Object.fromEntries(Object.keys(CATEGORIES).map(k => [k, findings.filter(f => f.category === k)]));
  // Оценка — ориентир для сравнения версий, а не «процент качества».
  const score = Math.max(0, 100 - counts.critical * 25 - counts.high * 10 - counts.medium * 3 - counts.low);
  return { findings, counts, byCategory, score };
}

/** Применяет безопасные автоисправления к сырому проекту. Возвращает новый объект и список применённых. */
export function applyAutoFixes(raw, findings) {
  const next = JSON.parse(JSON.stringify(raw || {}));
  const applied = [];
  for (const f of findings) {
    if (!f.autoFix) continue;
    const fix = AUTO_FIXES[f.id.replace(/^audit:/, '')];
    const patch = fix && fix(next);
    if (!patch) continue;
    Object.assign(next, patch);
    applied.push({ id: f.id, fields: Object.keys(patch) });
  }
  return { project: next, applied };
}

/**
 * Исправление с повторной проверкой: не больше maxPasses проходов, останавливается, если исправлять больше нечего
 * или очередной проход ничего не изменил (защита от бесконечного цикла).
 * @param {object} raw исходный проект
 * @param {(raw: object) => object} regenerate функция, возвращающая результат generate()
 */
export function fixAndRecheck(raw, regenerate, { maxPasses = 2 } = {}) {
  let project = raw;
  let generated = regenerate(project);
  let report = qualityReport(generated);
  const before = report;
  const passes = [];
  for (let i = 0; i < maxPasses; i++) {
    const { project: next, applied } = applyAutoFixes(project, report.findings);
    if (!applied.length) break;
    project = next;
    generated = regenerate(project);
    const after = qualityReport(generated);
    passes.push({ applied, before: report.counts, after: after.counts });
    report = after;
  }
  const stoppedBy = passes.length >= maxPasses ? 'limit' : 'nothing-to-fix';
  return { project, generated, before, after: report, passes, stoppedBy };
}
