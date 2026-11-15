function decodeHtml(value) {
  return String(value ?? "").replace(/&(?:amp|lt|gt|quot|#39);/g, token => ({
    "&amp;":"&","&lt;":"<","&gt;":">","&quot;":"\"","&#39;":"'"
  })[token]);
}

function extractMeta(html, attribute, name) {
  const match = html.match(new RegExp('<meta\\b(?=[^>]*\\b' + attribute + '=["\\x27]' + name + '["\\x27])[^>]*\\bcontent=["\\x27]([^"\\x27]*)["\\x27][^>]*>', "i"));
  return match ? decodeHtml(match[1]) : "";
}

function attrs(tag) {
  const values = {};
  for (const match of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    values[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return values;
}

function issue(code, severity, title, detail) {
  return {code,severity,title,detail};
}

/**
 * Static checks of generated source HTML and CSS.
 * This does not render a browser, fetch URLs or measure real-world performance.
 */
export function auditSiteHtml(html = "", css = "") {
  const source = String(html);
  const inlineCss = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join("\n");
  const styles = String(css || inlineCss);
  const issues = [];
  const title = decodeHtml(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const description = extractMeta(source,"name","description").trim();
  const ogTitle = extractMeta(source,"property","og:title").trim();
  const ogDescription = extractMeta(source,"property","og:description").trim();
  const ogImage = extractMeta(source,"property","og:image").trim();
  const canonical = source.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["']/i)?.[1] || "";
  const lang = source.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1] || "";
  const viewport = /<meta\b(?=[^>]*\bname=["']viewport["'])/i.test(source);
  const h1 = [...source.matchAll(/<h1\b[^>]*>/gi)].length;
  const headings = [...source.matchAll(/<h([1-6])\b[^>]*>/gi)].map(match => Number(match[1]));
  const imageTags = [...source.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);
  const images = imageTags.map(attrs);
  const missingAlt = images.filter(image => !Object.hasOwn(image,"alt")).length;
  const emptyAlt = images.filter(image => Object.hasOwn(image,"alt") && !image.alt.trim()).length;
  const missingDimensions = images.filter(image => !(Number(image.width)>0 && Number(image.height)>0)).length;
  const largeEmbeddedImages = images.filter(image => /^data:image\//i.test(image.src || "") && (image.src.length*0.75) > 300*1024).length;
  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
  const duplicateIds = [...new Set(ids.filter((id,index) => ids.indexOf(id) !== index))];
  const fragments = [...source.matchAll(/\bhref=["']#([^"'\s]+)["']/gi)].map(match => match[1]).filter(Boolean);
  const missingFragments = [...new Set(fragments.filter(id => !ids.includes(id)))];
  const links = [...source.matchAll(/<a\\b([^>]*)>([\\s\\S]*?)<\\/a>/gi)].map(match => ({...attrs("<a " + match[1] + ">"),text:match[2].replace(/<[^>]+>/g,"").trim()}));
  const unsafeLinks = links.filter(link => link.href && /^(?:javascript|data|vbscript):/i.test(link.href.trim())).length;
  const emptyLinks = links.filter(link => !link.href || !link.href.trim()).length;
  const externalBlankUnsafe = links.filter(link => link.target === "_blank" && !/\\bnoopener\\b/i.test(link.rel || "")).length;
  const unlabeledLinks = links.filter(link => !link["aria-label"] && !link.title && !link.text).length;
  const forms = [...source.matchAll(/<form\b[^>]*>/gi)].map(match => attrs(match[0]));
  const demoForms = forms.filter(form => form["data-uds-demo-form"] === "true").length;
  const inputTags = [...source.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)].map(match => attrs(match[0]));
  const labels = [...source.matchAll(/<label\b[^>]*>/gi)].map(match => attrs(match[0]));
  const labelTargets = new Set(labels.map(label => label.for).filter(Boolean));
  const inputsMissingLabels = inputTags.filter(input => input.type !== "hidden" && (!input.id || !labelTargets.has(input.id))).length;
  const hasMain = /<main\b/i.test(source);
  const hasHeader = /<header\b/i.test(source);
  const hasFooter = /<footer\b/i.test(source);
  const hasMobileBreakpoint = /@media\s*\([^)]*(?:max-width|min-width)\s*:/i.test(styles);
  const hasReducedMotion = /prefers-reduced-motion\s*:\s*reduce/i.test(styles);
  const hasFocusStyle = /:focus-visible\b/i.test(styles);
  const hasTapTargets = /(?:min-height|min-block-size)\s*:\s*(?:44|48|5\d|6\d)px/i.test(styles);
  const hasOverflowRisk = /(?:width|min-width)\s*:\s*100vw/i.test(styles) || /overflow-x\s*:\s*hidden/i.test(styles);
  const cssBytes = new TextEncoder().encode(styles).length;

  if (!title) issues.push(issue("title-missing","error","Не задан Title","Добавьте уникальный заголовок страницы."));
  else if (title.length < 30 || title.length > 60) issues.push(issue("title-length","warning","Длина Title требует проверки","Сейчас " + title.length + " символов; ориентир — около 30–60."));
  if (!description) issues.push(issue("description-missing","error","Нет meta description","Добавьте краткое описание страницы для поисковой выдачи."));
  else if (description.length < 70 || description.length > 160) issues.push(issue("description-length","warning","Длина Description требует проверки","Сейчас " + description.length + " символов; ориентир — около 70–160."));
  if (h1 === 0) issues.push(issue("h1-missing","error","Не найден H1","На странице должен быть основной заголовок."));
  if (h1 > 1) issues.push(issue("h1-multiple","warning","Несколько H1","Найдено заголовков H1: " + h1 + ". Проверьте смысловую иерархию."));
  for (let i=1;i<headings.length;i++) if (headings[i] > headings[i-1] + 1) {
    issues.push(issue("heading-order","warning","Нарушена иерархия заголовков","После H" + headings[i-1] + " следует H" + headings[i] + "."));
    break;
  }
  if (missingAlt) issues.push(issue("image-alt-missing","error","У изображений отсутствует ALT","Изображений без атрибута ALT: " + missingAlt + "."));
  if (emptyAlt) issues.push(issue("image-alt-empty","warning","Есть пустые ALT","Изображений с пустым ALT: " + emptyAlt + ". Пустой ALT допустим для декоративных изображений."));
  if (missingDimensions) issues.push(issue("image-dimensions","warning","Не заданы размеры изображений","У " + missingDimensions + " изображений не заданы width и height; это может вызывать сдвиги макета при загрузке."));
  if (largeEmbeddedImages) issues.push(issue("large-embedded-images","warning","Тяжёлые встроенные изображения","Найдено встроенных изображений больше 300 КБ: " + largeEmbeddedImages + ". Сожмите их перед публикацией."));
  if (!ogTitle || !ogDescription) issues.push(issue("og-metadata-missing","warning","Не полностью заполнены Open Graph метаданные","Добавьте OG Title и OG Description для предпросмотра ссылок."));
  if (!ogImage) issues.push(issue("og-image-missing","warning","Нет Open Graph изображения","Укажите абсолютный URL изображения для предпросмотра в соцсетях."));
  if (!canonical) issues.push(issue("canonical-missing","warning","Не указан canonical URL","После выбора домена укажите основной адрес страницы; не задавайте его наугад."));
  if (canonical && !/^https:\/\//i.test(canonical)) issues.push(issue("canonical-not-absolute","warning","Canonical должен быть абсолютным HTTPS URL","Укажите полный адрес страницы с https://."));
  if (!lang) issues.push(issue("lang-missing","warning","Не указан язык документа","Добавьте корректный атрибут lang для HTML."));
  if (!viewport) issues.push(issue("viewport-missing","error","Нет viewport meta","Добавьте meta viewport для корректного отображения на телефонах."));
  if (!hasMain || !hasHeader || !hasFooter) issues.push(issue("landmarks-missing","warning","Не хватает семантических областей","Проверьте наличие header, main и footer."));
  if (!hasMobileBreakpoint) issues.push(issue("mobile-css-missing","error","Не найден мобильный CSS breakpoint","Добавьте адаптивные правила для узких экранов."));
  if (!hasFocusStyle) issues.push(issue("focus-style-missing","warning","Не найден стиль клавиатурного фокуса","Добавьте заметный :focus-visible для интерактивных элементов."));
  if (!hasReducedMotion) issues.push(issue("reduced-motion-missing","warning","Не учтено снижение анимации","Добавьте prefers-reduced-motion: reduce."));
  if (!hasTapTargets) issues.push(issue("tap-target-size","warning","Не подтверждён размер интерактивных областей","Проверьте, что основные кнопки и поля удобны для касания (ориентир — 44×44 CSS px)."));
  if (hasOverflowRisk) issues.push(issue("horizontal-overflow-risk","warning","В CSS найден потенциальный риск горизонтальной прокрутки","Проверьте элементы с шириной 100vw и правила overflow на реальном телефоне."));
  if (duplicateIds.length) issues.push(issue("duplicate-ids","error","Повторяются ID элементов","Дублирующиеся ID: " + duplicateIds.slice(0,5).join(", ") + "."));
  if (missingFragments.length) issues.push(issue("broken-fragments","warning","Есть ссылки на отсутствующие секции","Не найдены ID: " + missingFragments.slice(0,5).join(", ") + "."));
  if (unsafeLinks) issues.push(issue("unsafe-links","error","Найдены небезопасные ссылки","Ссылок с javascript/data/vbscript схемой: " + unsafeLinks + "."));
  if (emptyLinks) issues.push(issue("empty-links","warning","Есть ссылки без адреса","Пустых или отсутствующих href: " + emptyLinks + "."));
  if (externalBlankUnsafe) issues.push(issue("external-link-rel","warning","Внешние вкладки без rel=noopener","Ссылок target=_blank без noopener: " + externalBlankUnsafe + "."));
  if (inputsMissingLabels) issues.push(issue("form-labels","error","У полей формы нет связанной подписи","Полей без связанного label: " + inputsMissingLabels + "."));
  if (demoForms) issues.push(issue("demo-form","warning","Формы пока демонстрационные","Форм без подключённой отправки: " + demoForms + ". Подключите обработчик заявок до публикации."));

  const errors = issues.filter(item => item.severity === "error").length;
  const warnings = issues.filter(item => item.severity === "warning").length;
  const score = Math.max(0,100-errors*12-warnings*4);
  return {
    score,errors,warnings,passed:issues.length===0,
    metrics:{
      titleLength:title.length,descriptionLength:description.length,h1Count:h1,imageCount:images.length,
      imagesMissingAlt:missingAlt,imagesEmptyAlt:emptyAlt,imagesMissingDimensions:missingDimensions,
      largeEmbeddedImages,internalLinksChecked:fragments.length,linksChecked:links.length,
      formsDemo:demoForms,inputsMissingLabels,cssBytes,
      mobileBreakpoint:hasMobileBreakpoint,focusStyle:hasFocusStyle,reducedMotion:hasReducedMotion
    },
    issues
  };
}
