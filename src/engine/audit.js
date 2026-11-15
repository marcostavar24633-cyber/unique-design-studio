// Проверка перед выдачей (§9 спецификации): статический аудит сгенерированного HTML и концепции.
import { normalizeProject } from './project.js';

function parseTags(html) {
  const tags = [];
  const body = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, m => m.replace(/[^\n]/g, ' ').replace(/^ {2,}/, ''));
  const re = /<([a-z][a-z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  let m;
  while ((m = re.exec(body))) {
    const attrs = {};
    m[2].replace(/([a-z][\w:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi, (_, k, a, b, c) => { attrs[k.toLowerCase()] = a ?? b ?? c ?? ''; return ''; });
    tags.push({ name: m[1].toLowerCase(), attrs, index: m.index });
  }
  return tags;
}

/** Возвращает { ok, errors, warnings, checks } — checks содержит все пункты с уровнем ok/warn/error. */
export function auditSite(html, concept, input) {
  const project = normalizeProject(input);
  const checks = [];
  const add = (level, id, message) => checks.push({ level, id, message });
  const test = (cond, id, okMsg, failMsg, level = 'error') => add(cond ? 'ok' : level, id, cond ? okMsg : failMsg);
  const tags = parseTags(html);
  const of = name => tags.filter(t => t.name === name);
  const css = (/<style>([\s\S]*?)<\/style>/.exec(html) || [])[1] || '';

  // Понятность и структура
  test(of('html')[0]?.attrs.lang, 'lang', 'Указан язык документа', 'У <html> нет атрибута lang');
  test(/<title>[^<]+<\/title>/.test(html), 'title', 'Есть заголовок страницы <title>', 'Пустой или отсутствующий <title>');
  test(of('meta').some(t => t.attrs.name === 'viewport'), 'viewport', 'Есть meta viewport для мобильных', 'Нет meta viewport');
  test(of('meta').some(t => t.attrs.name === 'description' && t.attrs.content), 'description', 'Есть meta description', 'Нет описания: нишу и предложение сложно понять за первые секунды, страдает SEO', 'warn');
  const pageTitle = (html.match(/<title>[^<]*<\/title>/i)?.[0] || '').replace(/<\/?title>/gi, '').trim();
  const metaDescription = of('meta').find(t => t.attrs.name === 'description')?.attrs.content || '';
  if (pageTitle && (pageTitle.length < 30 || pageTitle.length > 60)) add('warn', 'seo-title-length', `Длина title — ${pageTitle.length} символов; ориентир для проверки — 30–60`);
  if (metaDescription && (metaDescription.length < 120 || metaDescription.length > 160)) add('warn', 'seo-description-length', `Длина meta description — ${metaDescription.length} символов; ориентир — 120–160`);
  test(of('meta').some(t => t.attrs.property === 'og:title' && t.attrs.content), 'og-title', 'Есть Open Graph title', 'Нет og:title для превью ссылок', 'warn');
  test(of('meta').some(t => t.attrs.property === 'og:description' && t.attrs.content), 'og-description', 'Есть Open Graph description', 'Нет og:description для превью ссылок', 'warn');
  test(of('h1').length === 1, 'h1', 'Ровно один заголовок h1', `Заголовков h1: ${of('h1').length}, должен быть один`);
  test(of('main').length === 1 && of('nav').length >= 1, 'landmarks', 'Есть ориентиры main и nav', 'Нет семантических ориентиров main/nav');
  test(of('a').some(t => t.attrs.class === 'skip'), 'skip-link', 'Есть ссылка «Перейти к содержимому»', 'Нет skip-link');

  // Ссылки, якоря, идентификаторы
  const ids = tags.map(t => t.attrs.id).filter(Boolean);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  test(!dup.length, 'unique-ids', 'Идентификаторы уникальны', `Повторяются id: ${[...new Set(dup)].join(', ')}`);
  const links = of('a');
  const broken = links.filter(a => !a.attrs.href || (a.attrs.href.startsWith('#') && !ids.includes(a.attrs.href.slice(1))));
  test(!broken.length, 'links', `Все ссылки ведут к существующим целям (${links.length})`, `Нерабочие ссылки: ${broken.map(a => a.attrs.href || '(пусто)').join(', ')}`);
  test(!/javascript:/i.test(tags.map(t => `${t.attrs.href || ''} ${t.attrs.src || ''}`).join(' ')), 'safe-urls', 'Нет небезопасных схем ссылок', 'Обнаружена ссылка javascript:');

  // CTA и основной путь
  const ctas = tags.filter(t => t.attrs['data-cta'] === 'primary');
  test(ctas.length >= 1, 'cta', 'Основной CTA виден на первом экране', 'На первом экране нет основного CTA');
  const k = project.contacts;
  const hasPath = Boolean(project.formAction || k.email || k.phone || k.address || (project.ctaUrl && !project.ctaUrl.startsWith('#')));
  test(hasPath, 'cta-path', 'Путь пользователя завершается действием: есть форма, контакты или внешняя ссылка', 'CTA ведёт в раздел без способа связи: укажите контакты, formAction или ctaUrl');
  if (/@example\.(com|org|net)|\/\/example\.(com|org|net)/.test(`${k.email} ${project.formAction} ${project.ctaUrl}`)) add('warn', 'placeholder-contacts', 'Контакты указывают на example.com — это заглушка, замените перед публикацией');

  // Изображения и формы
  const imgs = of('img');
  test(imgs.every(i => 'alt' in i.attrs), 'img-alt', `У всех изображений есть атрибут alt (${imgs.length})`, 'Есть изображения без атрибута alt');
  const emptyAlt = imgs.filter(i => 'alt' in i.attrs && !i.attrs.alt).length;
  if (emptyAlt) add('warn', 'img-alt-empty', `Изображений с пустым alt: ${emptyAlt}. Добавьте описание, если изображение несёт смысл`);
  const descriptiveAlts = imgs.map(i => i.attrs.alt || '').filter(Boolean);
  const repeatedAlts = descriptiveAlts.filter((alt, index) => descriptiveAlts.indexOf(alt) !== index);
  if (repeatedAlts.length) add('warn', 'img-alt-duplicates', `Повторяются ALT-описания: ${[...new Set(repeatedAlts)].slice(0, 3).join('; ')}. Уточните описания для разных изображений`);
  const weakAlts = descriptiveAlts.filter(alt => alt.length < 8 || alt.length > 160 || /\.(jpe?g|png|webp|gif|avif)$/i.test(alt) || /^img[_ -]?\d+/i.test(alt));
  if (weakAlts.length) add('warn', 'img-alt-quality', `Есть ${weakAlts.length} ALT-описаний, похожих на имя файла, слишком коротких или длинных. Опишите смысл изображения кратко и конкретно`);
  const labelled = new Set(of('label').map(l => l.attrs.for).filter(Boolean));
  const controls = tags.filter(t => ['input', 'select', 'textarea'].includes(t.name) && t.attrs.type !== 'hidden');
  test(controls.every(c => (c.attrs.id && labelled.has(c.attrs.id)) || c.attrs['aria-label']), 'form-labels', `Поля форм подписаны (${controls.length})`, 'Есть поля формы без подписи <label>');
  if (!imgs.length) add('warn', 'no-images', 'Изображения не предоставлены: вместо фотографий используется абстрактный графический мотив');
  // Заготовки автопилота вида «[Опишите категорию]» — их должен заменить владелец до публикации.
  const visible = html.replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  const holes = [...new Set(visible.match(/\[[А-ЯЁа-яё][^\]\n]{2,120}\]/g) || [])];
  test(!holes.length, 'placeholders', 'Незаполненных заготовок нет', `На странице остались заготовки — замените их фактами: ${holes.slice(0, 4).join(', ')}${holes.length > 4 ? ` и ещё ${holes.length - 4}` : ''}`, 'warn');

  // Доступность и движение
  test(/prefers-reduced-motion/.test(css), 'reduced-motion', 'Учитывается prefers-reduced-motion', 'В стилях нет правила prefers-reduced-motion');
  test(/:focus-visible/.test(css), 'focus', 'Есть видимый фокус для клавиатуры', 'В стилях нет :focus-visible');
  const weak = concept.visualSystem.palette.pairs.filter(p => p.ratio < 4.5);
  test(!weak.length, 'contrast', 'Контраст всех текстовых пар не ниже 4.5:1 (WCAG AA)', `Недостаточный контраст: ${weak.map(p => `${p.name} ${p.ratio}:1`).join('; ')}`);
  test(!/<link\b[^>]*stylesheet|<script\b[^>]*\bsrc=/i.test(html), 'self-contained', 'Страница самодостаточна: нет внешних стилей, шрифтов и скриптов', 'Есть внешние ресурсы — проверьте скорость загрузки', 'warn');
  const kb = Math.round(html.length / 102.4) / 10;
  test(kb < 150, 'weight', `Вес HTML: ${kb} КБ`, `HTML весит ${kb} КБ — сократите встроенные изображения`, 'warn');

  // Производительность: статические признаки, не реальные замеры Core Web Vitals.
  const utf8Bytes = new TextEncoder().encode(html).length;
  const inlineImages = imgs.map(i => i.attrs.src || '').filter(src => /^data:image\\//i.test(src));
  const inlineBytes = inlineImages.reduce((sum, src) => {
    const payload = (src.split(',')[1] || '').replace(/\\s/g, '');
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return sum + Math.max(0, Math.floor(payload.length * 3 / 4) - padding);
  }, 0);
  const externalImages = imgs.filter(i => /^https?:\\/\\//i.test(i.attrs.src || '')).length;
  const imageKb = Math.round(inlineBytes / 102.4) / 10;
  const documentKb = Math.round(utf8Bytes / 102.4) / 10;
  test(documentKb <= 250, 'performance-document-size', `Размер HTML: ${documentKb} КБ`, `HTML весит ${documentKb} КБ. Сократите встроенные данные и CSS; ориентир для автономного лендинга — до 250 КБ`, 'warn');
  test(inlineBytes <= 250 * 1024, 'performance-inline-images', `Встроенные изображения: ${imageKb} КБ (${inlineImages.length})`, `Встроенные изображения занимают ${imageKb} КБ. Оптимизируйте фотографии или используйте внешнее CDN-хранилище`, 'warn');
  const missingDimensions = imgs.filter(i => !i.attrs.width || !i.attrs.height);
  test(!missingDimensions.length, 'performance-image-dimensions', 'У изображений заданы width и height', `У ${missingDimensions.length} изображений нет width/height. Задайте размеры или резервируйте место через aspect-ratio, чтобы снизить риск CLS`, 'warn');
  const belowFoldWithoutLazy = imgs.slice(1).filter(i => i.attrs.loading !== 'lazy');
  test(!belowFoldWithoutLazy.length, 'performance-lazy-images', 'Изображения после первого экрана загружаются лениво', `У ${belowFoldWithoutLazy.length} изображений после первого нет loading="lazy". Проверьте и включите отложенную загрузку`, 'warn');
  const withoutAsyncDecode = imgs.filter(i => i.attrs.decoding !== 'async');
  test(!withoutAsyncDecode.length, 'performance-image-decoding', 'Для изображений включён decoding="async"', `У ${withoutAsyncDecode.length} изображений нет decoding="async"`, 'warn');
  const firstImage = imgs[0];
  test(!firstImage || firstImage.attrs.fetchpriority === 'high', 'performance-hero-priority', 'Приоритет первого изображения повышен или изображений нет', 'Первое изображение не помечено fetchpriority="high"; проверьте, является ли оно LCP-элементом', 'warn');
  if (externalImages) add('warn', 'performance-external-images', `Внешние изображения: ${externalImages}. Скорость и доступность зависят от стороннего хостинга`);

  // Ничего не выдумано
  const allowed = new Set(project.services.map(i => i.price).filter(Boolean));
  const shown = [...html.matchAll(/<p class="price">([^<]*)<\/p>/g)].map(m => m[1]);
  const unesc = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  test(shown.every(v => allowed.has(unesc(v))), 'no-invented-prices', 'Все цены на странице взяты из проекта', 'На странице есть цена, которой нет в данных проекта');

  // Уникальность
  const u = concept.uniquenessCheck;
  test(!u.templateReuseDetected, 'uniqueness', u.differentiationActions.length ? `Шаблонность устранена: ${u.differentiationActions.join('; ')}` : 'Повтор типового hero соседних проектов не обнаружен',
    `Страница повторяет архитектуру, расположение визуала и типографику соседнего проекта: ${u.repeatedPatterns.join('; ')}`);
  test(Boolean(concept.designDNA.selectionRationale), 'rationale', 'Выбор архитектуры обоснован в Design DNA', 'Нет обоснования выбора архитектуры');

  const errors = checks.filter(c => c.level === 'error');
  const warnings = checks.filter(c => c.level === 'warn');
  return { ok: errors.length === 0, errors, warnings, checks };
}
