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
  const labelled = new Set(of('label').map(l => l.attrs.for).filter(Boolean));
  const controls = tags.filter(t => ['input', 'select', 'textarea'].includes(t.name) && t.attrs.type !== 'hidden');
  test(controls.every(c => (c.attrs.id && labelled.has(c.attrs.id)) || c.attrs['aria-label']), 'form-labels', `Поля форм подписаны (${controls.length})`, 'Есть поля формы без подписи <label>');
  if (!imgs.length) add('warn', 'no-images', 'Изображения не предоставлены: вместо фотографий используется абстрактный графический мотив');

  // Доступность и движение
  test(/prefers-reduced-motion/.test(css), 'reduced-motion', 'Учитывается prefers-reduced-motion', 'В стилях нет правила prefers-reduced-motion');
  test(/:focus-visible/.test(css), 'focus', 'Есть видимый фокус для клавиатуры', 'В стилях нет :focus-visible');
  const weak = concept.visualSystem.palette.pairs.filter(p => p.ratio < 4.5);
  test(!weak.length, 'contrast', 'Контраст всех текстовых пар не ниже 4.5:1 (WCAG AA)', `Недостаточный контраст: ${weak.map(p => `${p.name} ${p.ratio}:1`).join('; ')}`);
  test(!/<link\b[^>]*stylesheet|<script\b[^>]*\bsrc=/i.test(html), 'self-contained', 'Страница самодостаточна: нет внешних стилей, шрифтов и скриптов', 'Есть внешние ресурсы — проверьте скорость загрузки', 'warn');
  const kb = Math.round(html.length / 102.4) / 10;
  test(kb < 150, 'weight', `Вес HTML: ${kb} КБ`, `HTML весит ${kb} КБ — сократите встроенные изображения`, 'warn');

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
