function decodeHtml(value) {
  return String(value ?? "").replace(/&(?:amp|lt|gt|quot|#39);/g, token => ({
    "&amp;":"&","&lt;":"<","&gt;":">","&quot;":"\"","&#39;":"'"
  })[token]);
}

function extractMeta(html, attribute, name) {
  const match = html.match(new RegExp('<meta\\b(?=[^>]*\\b' + attribute + '=["\\x27]' + name + '["\\x27])[^>]*\\bcontent=["\\x27]([^"\\x27]*)["\\x27][^>]*>', "i"));
  return match ? decodeHtml(match[1]) : "";
}

function issue(code, severity, title, detail) {
  return {code,severity,title,detail};
}

/** Static checks for generated source HTML; not a live crawler or Lighthouse report. */
export function auditSiteHtml(html = "") {
  const source = String(html);
  const issues = [];
  const title = decodeHtml(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const description = extractMeta(source,"name","description").trim();
  const ogTitle = extractMeta(source,"property","og:title").trim();
  const ogDescription = extractMeta(source,"property","og:description").trim();
  const ogImage = extractMeta(source,"property","og:image").trim();
  const canonical = source.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["']/i)?.[1] || "";
  const lang = source.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1] || "";
  const h1 = [...source.matchAll(/<h1\b[^>]*>/gi)].length;
  const headings = [...source.matchAll(/<h([1-6])\b[^>]*>/gi)].map(match => Number(match[1]));
  const images = [...source.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);
  const missingAlt = images.filter(tag => !/\balt=["'][^"']*["']/i.test(tag)).length;
  const emptyAlt = images.filter(tag => /\balt=["']\s*["']/i.test(tag)).length;
  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
  const duplicateIds = [...new Set(ids.filter((id,index) => ids.indexOf(id) !== index))];
  const fragments = [...source.matchAll(/\bhref=["']#([^"'\s]+)["']/gi)].map(match => match[1]).filter(Boolean);
  const missingFragments = [...new Set(fragments.filter(id => !ids.includes(id)))];
  const demoForms = [...source.matchAll(/<form\b[^>]*data-uds-demo-form=["']true["'][^>]*>/gi)].length;

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
  if (missingAlt) issues.push(issue("image-alt-missing","error","У изображений отсутствует ALT","Изображений без заполненного ALT: " + missingAlt + "."));
  if (emptyAlt) issues.push(issue("image-alt-empty","warning","Есть пустые ALT","Изображений с пустым ALT: " + emptyAlt + ". Для декоративных изображений пустой ALT допустим."));
  if (!ogTitle || !ogDescription) issues.push(issue("og-metadata-missing","warning","Не полностью заполнены Open Graph метаданные","Добавьте OG Title и OG Description для предпросмотра ссылок."));
  if (!ogImage) issues.push(issue("og-image-missing","warning","Нет Open Graph изображения","Укажите абсолютный URL изображения для предпросмотра в соцсетях."));
  if (!canonical) issues.push(issue("canonical-missing","warning","Не указан canonical URL","После выбора домена укажите основной адрес страницы; не задавайте его наугад."));
  if (canonical && !/^https:\/\//i.test(canonical)) issues.push(issue("canonical-not-absolute","warning","Canonical должен быть абсолютным HTTPS URL","Укажите полный адрес страницы с https://."));
  if (!lang) issues.push(issue("lang-missing","warning","Не указан язык документа","Добавьте корректный атрибут lang для HTML."));
  if (duplicateIds.length) issues.push(issue("duplicate-ids","error","Повторяются ID элементов","Дублирующиеся ID: " + duplicateIds.slice(0,5).join(", ") + "."));
  if (missingFragments.length) issues.push(issue("broken-fragments","warning","Есть ссылки на отсутствующие секции","Не найдены ID: " + missingFragments.slice(0,5).join(", ") + "."));
  if (demoForms) issues.push(issue("demo-form","warning","Формы пока демонстрационные","Форм без подключённой отправки: " + demoForms + ". Подключите обработчик заявок до публикации."));

  const errors = issues.filter(item => item.severity === "error").length;
  const warnings = issues.filter(item => item.severity === "warning").length;
  const score = Math.max(0,100-errors*18-warnings*6);
  return {
    score,errors,warnings,passed:issues.length===0,
    metrics:{titleLength:title.length,descriptionLength:description.length,h1Count:h1,imageCount:images.length,imagesMissingAlt:missingAlt,imagesEmptyAlt:emptyAlt,internalLinksChecked:fragments.length,formsDemo:demoForms},
    issues
  };
}
