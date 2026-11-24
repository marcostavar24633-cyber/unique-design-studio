// Контроль качества готового сайта: замечания по 14 направлениям, уровни Critical / High / Medium / Low,
// безопасные автоисправления с повторной проверкой и защитой от бесконечного цикла.
// Источники: технический аудит (audit.js), Design Director (design-director.js), проверка уникальности
// и определения ниши. Ничего не выдумывается: автоисправления только сокращают или собирают SEO-тексты
// из того, что уже есть в проекте.
import { reviewDesign } from './design-director.js';
import { detectNiche } from './concept.js';
import { normalizeProject } from './project.js';
import { reviewImageSet } from './image-director.js';

export const SEVERITIES = Object.freeze(['critical', 'high', 'medium', 'low']);
export const SEVERITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

/** Не показываем контроль качества как завершённый без замечаний, требующих просмотра. */
export function qualityStageStatus(report) {
  if (!report || !report.counts || !Array.isArray(report.findings)) return 'attention';
  if (report?.counts?.critical || report?.counts?.high) return 'attention';
  return report?.findings?.length ? 'review' : 'done';
}

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
  lang: 'seo', title: 'seo', description: 'seo', 'seo-title-length': 'seo', 'seo-description-length': 'seo', 'og-title': 'seo', 'og-description': 'seo', 'og-image': 'seo',
  h1: 'hierarchy', landmarks: 'accessibility', 'skip-link': 'accessibility', focus: 'accessibility', 'reduced-motion': 'accessibility', 'form-labels': 'accessibility',
  'img-alt': 'accessibility', 'img-alt-empty': 'accessibility', 'img-alt-duplicates': 'accessibility', 'img-alt-quality': 'accessibility',
  'unique-ids': 'functionality', links: 'functionality', 'external-links-unverified': 'functionality', cta: 'commercial', 'cta-path': 'commercial', 'cta-target-unavailable': 'commercial', 'cta-target-invalid': 'commercial', 'booking-path': 'commercial', 'form-delivery': 'functionality',
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
  if (!generated || typeof generated !== 'object' || !generated.project || typeof generated.project !== 'object') {
    const finding = { id: 'generation:missing-project', source: 'generation', category: 'functionality', severity: 'critical', autoFix: false, message: 'Результат генерации не содержит проекта для проверки.' };
    const counts = Object.fromEntries(SEVERITIES.map(severity => [severity, severity === 'critical' ? 1 : 0]));
    const byCategory = Object.fromEntries(Object.keys(CATEGORIES).map(category => [category, category === 'functionality' ? [finding] : []]));
    return { findings: [finding], counts, byCategory, score: 0 };
  }
  const project = normalizeProject(generated.project);
  const findings = [];
  const add = f => findings.push({ autoFix: false, ...f });

  const auditErrors = Array.isArray(generated.audit?.errors) ? generated.audit.errors : [];
  const auditWarnings = Array.isArray(generated.audit?.warnings) ? generated.audit.warnings : [];
  for (const c of [...auditErrors, ...auditWarnings].filter(check => check && typeof check === 'object')) {
    const checkId = typeof c.id === 'string' ? c.id : 'unknown';
    const hasFix = Object.hasOwn(AUTO_FIXES, checkId) && Boolean(AUTO_FIXES[checkId](project));
    add({ id: `audit:${checkId}`, source: 'audit', category: categoryOfAudit(checkId), severity: severityOfAudit(c), message: String(c.message || 'Проверка вернула неполные данные.'), autoFix: hasFix });
  }

  const images = reviewImageSet(project, generated.concept);
  for (const f of images.findings) add(f);
  const review = reviewDesign(project, generated);
  for (const r of review.recommendations) {
    if (r.id === 'audit-issues') continue; // уже разложено по отдельным замечаниям выше
    if (r.id === 'hero-visual' && images.findings.some(f => f.id === 'images:hero-missing')) continue; // то же, что замечание Image Director
    add({ id: `director:${r.id}`, source: 'design-director', category: DIRECTOR_CATEGORY[r.category] || 'ux', severity: r.priority, message: `${r.title}. ${r.reason}`, action: r.action });
  }

  const u = generated.concept?.uniquenessCheck;
  const closest = (Array.isArray(u?.comparedWith) ? u.comparedWith : []).reduce((max, entry) => {
    const similarity = Number(entry?.similarity);
    return Number.isFinite(similarity) ? Math.max(max, Math.min(1, Math.max(0, similarity))) : max;
  }, 0);
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
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  // Исправления меняют только верхнеуровневые поля; поверхностная копия сохраняет
  // импортируемые значения без падения на циклических ссылках и BigInt.
  const next = { ...source };
  const applied = [];
  for (const f of Array.isArray(findings) ? findings : []) {
    if (!f || typeof f !== 'object') continue;
    if (!f.autoFix) continue;
    const id = typeof f.id === 'string' ? f.id.replace(/^audit:/, '') : '';
    const fix = Object.hasOwn(AUTO_FIXES, id) ? AUTO_FIXES[id] : null;
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
export function fixAndRecheck(raw, regenerate, options = {}) {
  if (typeof regenerate !== 'function') throw new TypeError('Нужна функция повторной генерации');
  const { maxPasses = 2 } = options && typeof options === 'object' ? options : {};
  let requestedPasses = NaN;
  try { requestedPasses = Number(maxPasses); } catch { /* non-coercible values use the default */ }
  const passLimit = Number.isFinite(requestedPasses) ? Math.max(0, Math.min(5, Math.floor(requestedPasses))) : 2;
  let project = raw;
  let generated = regenerate(project);
  let report = qualityReport(generated);
  const before = report;
  const passes = [];
  for (let i = 0; i < passLimit; i++) {
    const { project: next, applied } = applyAutoFixes(project, report.findings);
    if (!applied.length) break;
    project = next;
    generated = regenerate(project);
    const after = qualityReport(generated);
    passes.push({ applied, before: report.counts, after: after.counts });
    report = after;
  }
  const actionable = report.findings.some(f => {
    const id = typeof f?.id === 'string' ? f.id.replace(/^audit:/, '') : '';
    return Boolean(f?.autoFix) && Object.hasOwn(AUTO_FIXES, id);
  });
  const stoppedBy = actionable && passes.length >= passLimit ? 'limit' : 'nothing-to-fix';
  return { project, generated, before, after: report, passes, stoppedBy };
}
