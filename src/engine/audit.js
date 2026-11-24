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
  const renderedCopy = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;|&#39;|&apos;/gi, ' ').replace(/\s+/g, ' ');

  if (/\b\d+(?:[.,]\d+)?\s*(?:%|лет|года|год|дней|дня|часов|часа|минут|₽|руб(?:лей|ля)?)/i.test(renderedCopy)) {
    add('warn', 'visible-numeric-claim', 'В тексте страницы есть числовое обещание или характеристика. Подтвердите её данными владельца перед публикацией.');
  }
  if (/(?:№\s*1|номер один|лучший|самый быстрый|гарантируем|гарантия|100\s*%|всегда|никогда)/i.test(renderedCopy)) {
    add('warn', 'visible-absolute-claim', 'В тексте страницы есть абсолютное или гарантийное утверждение. Проверьте, что владелец может его подтвердить.');
  }

  if (project.passthrough?.contentDraftSource === 'local-autopilot') {
    add('warn', 'local-autopilot-copy-review', 'Локальный автопилот использовал нишевые заготовки. Перед публикацией проверьте перечень услуг и любые условия доставки, записи, оплаты, сроков и гарантии.');
    const instructions = [...renderedCopy.matchAll(/\b(?:укажите|добавьте|опишите|подтвердите|перечислите|покажите|удалите)\b[^.!?]{0,110}/giu)].map(match => match[0].trim().slice(0, 110));
    if (instructions.length) add('warn', 'local-autopilot-open-facts', `В тексте страницы осталось ${instructions.length} инструкций для владельца. Замените их данными или удалите. Например: ${[...new Set(instructions)].slice(0, 3).map(text => `«${text}»`).join('; ')}.`);
  }

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
  const shareImageHidden = project.fieldStates?.['images.social'] === 'hidden'
    || project.fieldStates?.['images.social'] !== 'manual' && project.site?.fieldStates?.['images.social'] === 'hidden';
  test(shareImageHidden || of('meta').some(t => t.attrs.property === 'og:image' && t.attrs.content), 'og-image', 'Есть изображение для превью ссылки или оно скрыто владельцем', 'Нет изображения для превью ссылки: добавьте фото страницы или общее фото сайта', 'warn');
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
  const externalLinks = links.map(a => a.attrs.href || '').filter(href => /^https?:\/\//i.test(href));
  if (externalLinks.length) add('warn', 'external-links-unverified', `Внешние ссылки сохранены (${externalLinks.length}), но их доступность не проверялась в автономном аудите. Проверьте адреса перед публикацией.`);

  // CTA и основной путь
  const ctas = tags.filter(t => t.attrs['data-cta'] === 'primary');
  test(ctas.length >= 1, 'cta', 'Основной CTA виден на первом экране', project.fieldStates?.cta === 'manual' && !project.cta
    ? 'Основной CTA вручную оставлен без текста: добавьте подпись или верните автоматическое значение.'
    : 'На первом экране нет основного CTA');
  const hiddenSections = new Set([...(Array.isArray(project.passthrough?.hiddenSections) ? project.passthrough.hiddenSections : []), ...Object.keys(project.fieldStates || {}).filter(key => key.startsWith('sections.') && project.fieldStates[key] === 'hidden').map(key => key.slice(9))]);
  const targetSection = project.ctaUrl?.startsWith('#') ? project.ctaUrl.slice(1) : '';
  if (targetSection && hiddenSections.has(targetSection)) add('error', 'cta-target-unavailable', `Основная кнопка скрыта: её цель «${targetSection}» отключена. Верните секцию или укажите другой адрес кнопки.`);
  else if (targetSection && !ids.includes(targetSection)) add('error', 'cta-target-invalid', `Адрес основной кнопки «#${targetSection}» не существует. Укажите существующий раздел или элемент.`);
  if (project.fieldStates?.ctaUrl === 'manual' && !project.ctaUrl) add('error', 'cta-target-invalid', 'Ручной адрес основной кнопки не поддерживается или не прошёл проверку. Укажите корректный адрес либо верните автоматическое назначение.');
  const k = project.contacts;
  const hasPath = Boolean(project.formAction || k.email || k.phone || (project.ctaUrl && !project.ctaUrl.startsWith('#')));
  test(hasPath, 'cta-path', 'Путь пользователя завершается действием: есть форма, телефон, email или внешняя ссылка', 'CTA ведёт в раздел без способа связи: укажите телефон, email, formAction или ctaUrl');
  const bookingIntent = /запис|запись|бронир|брон|appointment|booking|reservation/i.test(`${project.primaryGoal} ${project.niche} ${project.title} ${project.cta}`);
  if (bookingIntent && !hasPath) add('error', 'booking-path', 'Черновик страницы записи собран, но записаться нельзя. Подключите форму с получателем, ссылку на сервис записи или укажите телефон/e-mail.');
  const formDelivery = project.formAction ? 'endpoint-configured' : k.email ? 'mailto-fallback' : 'not-configured';
  if (formDelivery === 'endpoint-configured') add('warn', 'form-delivery', 'HTTPS endpoint формы настроен, но фактическая доставка заявки не подтверждена тестовой отправкой');
  else if (formDelivery === 'mailto-fallback') add('warn', 'form-delivery', 'Указан email для связи, но серверная форма не настроена: отправка через почтовую ссылку зависит от почтового приложения пользователя');
  else add('warn', 'form-delivery', 'Приём заявок не настроен: добавьте HTTPS formAction или укажите рабочие контакты');
  if (/@example\.(com|org|net)|\/\/example\.(com|org|net)/.test(`${k.email} ${project.formAction} ${project.ctaUrl}`)) add('warn', 'placeholder-contacts', 'Контакты указывают на example.com — это заглушка, замените перед публикацией');

  // Изображения и формы
  const imgs = of('img');
  test(imgs.every(i => 'alt' in i.attrs), 'img-alt', `У всех изображений есть атрибут alt (${imgs.length})`, 'Есть изображения без атрибута alt');
  // data-decorative — фоновое фото первого экрана: смысл передают заголовок и текст, alt="" здесь верен.
  const emptyAlt = imgs.filter(i => 'alt' in i.attrs && !i.attrs.alt && i.attrs['data-decorative'] !== 'hero-bg').length;
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

  // Визуальные механики: проверяем не только доступность, но и наличие premium motion layer.
  test(/<section\b[^>]*class="[^"]*\bhero\b[^"]*"[^>]*data-scene="[^"]+"/.test(html), 'cinematic-scene', 'У Hero есть визуальная сцена', 'У Hero не задан тип визуальной сцены', 'warn');
  test(/\.ds-button::after/.test(css) && /translateX\(520%\)/.test(css), 'button-motion', 'У кнопок есть световой hover-эффект', 'У кнопок не найден световой hover-эффект', 'warn');
  test(/\.ds-card:hover/.test(css) && /\.item:hover/.test(css), 'card-motion', 'У карточек есть интерактивное hover-состояние', 'Не найдены интерактивные состояния карточек', 'warn');
  test(/@media\s*\([^)]*max-width\s*:/.test(css) && /prefers-reduced-motion/.test(html), 'motion-responsive', 'Анимации учитывают мобильные устройства и reduced motion', 'Не найдены мобильные и reduced-motion ограничения', 'warn');

  // Производительность: статические признаки, не реальные замеры Core Web Vitals.
  const utf8Bytes = new TextEncoder().encode(html).length;
  const inlineImages = imgs.map(i => i.attrs.src || '').filter(src => src.startsWith('data:image/'));
  const inlineBytes = inlineImages.reduce((sum, src) => {
    const payload = (src.split(',')[1] || '').replace(/\s/g, '');
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return sum + Math.max(0, Math.floor(payload.length * 3 / 4) - padding);
  }, 0);
  const externalImages = imgs.filter(i => { const src = i.attrs.src || ''; return src.startsWith('http://') || src.startsWith('https://'); }).length;
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
  return { ok: errors.length === 0, errors, warnings, checks, formDelivery };
}

