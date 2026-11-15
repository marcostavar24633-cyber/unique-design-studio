import { createStudioProject } from "../src/studio-pipeline.js";
import { createHistoryManager } from "../src/history-manager.js";
import { createZip, verifyZipArchive } from "../src/zip-export.js";
import { assessExportReadiness } from "../src/export-readiness.js";

const form = document.querySelector("#project-form");
const frame = document.querySelector("#preview-frame");
const downloadButton = document.querySelector("#download-html");
const notice = document.querySelector("#notice");
const deviceButtons = [...document.querySelectorAll("[data-device]")];
let latestHtml = "";
let currentInput = null;
let currentProject = null;
let currentExportReady = false;
const projectHistory = createHistoryManager(20);
let historyEditSnapshot = null;

const SECTION_LABELS = {
  "hero-product":"Главное предложение","featured-products":"Избранные товары","category-navigation":"Категории",
  "category-grid":"Каталог","popular-items":"Популярные товары","selection-guide":"Помощь с выбором",
  "benefits":"Преимущества","product-proof":"Характеристики и доверие","delivery-and-payment":"Доставка и оплата",
  "purchase-cta":"Покупка","editorial-hero":"Обложка бренда","selected-work":"Избранные работы",
  "point-of-view":"Позиция бренда","process":"Процесс работы","testimonials":"Отзывы","about":"О компании",
  "contact":"Контакты","immersive-hero":"Визуальная обложка","full-screen-gallery":"Галерея",
  "project-stories":"Истории проектов","services":"Услуги","about-artist":"Об авторе",
  "asymmetric-hero":"Главная композиция","capabilities":"Компетенции","selected-cases":"Избранные кейсы",
  "approach":"Подход","team-or-founder":"Команда","split-hero":"Предложение и действие",
  "service-selector":"Выбор услуги","how-it-works":"Как это работает","results-or-cases":"Результаты",
  "pricing":"Стоимость","booking-form":"Форма записи","faq":"Вопросы и ответы","story-hero":"История бренда",
  "origin-story":"Начало истории","craft-or-process":"Процесс создания","product-highlights":"Особенности продукта",
  "social-proof":"Доверие клиентов","visit-or-order":"Заказ или визит","modular-hero":"Главная композиция",
  "service-grid":"Направления услуг","solutions-by-need":"Решения по задачам","proof-points":"Факты и преимущества",
  "company-overview":"О компании","statement-hero":"Главный манифест","visual-manifesto":"Визуальная концепция",
  "featured-work":"Избранные проекты","offerings":"Предложения","press-or-proof":"Публикации и доверие",
  "direct-contact":"Связаться","focused-hero":"Главное предложение","key-benefit":"Ключевая выгода",
  "proof":"Подтверждение","offer-details":"Состав предложения","objection-handling":"Ответы на сомнения",
  "single-cta":"Следующий шаг"
};

function updateHistoryButtons() {
  const undo = document.querySelector("#undo-project");
  const redo = document.querySelector("#redo-project");
  if (undo) undo.disabled = !projectHistory.canUndo;
  if (redo) redo.disabled = !projectHistory.canRedo;
}

function recordHistory() {
  if (!currentInput) return;
  projectHistory.push(currentInput);
  updateHistoryButtons();
}

function undoProject() {
  if (!currentInput) return;
  const previous = projectHistory.undo(currentInput);
  if (!previous) return;
  loadProjectInput(previous,currentInput.projectId || "",true);
  notice.textContent = "Последнее изменение отменено.";
  updateHistoryButtons();
}

function redoProject() {
  if (!currentInput) return;
  const next = projectHistory.redo(currentInput);
  if (!next) return;
  loadProjectInput(next,currentInput.projectId || "",true);
  notice.textContent = "Изменение восстановлено.";
  updateHistoryButtons();
}

document.addEventListener("focusin",event => {
  if (currentInput && event.target.closest("#site-chrome-editor, #section-editor")) {
    historyEditSnapshot = JSON.stringify(currentInput);
  }
});
document.addEventListener("focusout",event => {
  if (!historyEditSnapshot || !event.target.closest("#site-chrome-editor, #section-editor")) return;
  const before = historyEditSnapshot;
  historyEditSnapshot = null;
  if (currentInput && before !== JSON.stringify(currentInput)) {
    projectHistory.push(JSON.parse(before));
    updateHistoryButtons();
  }
});

function readForm() {
  const values = Object.fromEntries(new FormData(form).entries());
  return {
    businessType:values.businessType,
    businessName:values.businessName,
    audience:values.audience,
    primaryGoal:values.primaryGoal,
    description:values.description,
    seoTitle:values.businessName || values.businessType,
    seoDescription:values.description,
    ogTitle:values.businessName || values.businessType,
    ogDescription:values.description,
    canonicalUrl:"",
    ogImage:"",
    heroTitle:values.heroTitle,
    ctaLabel:values.ctaLabel,
    heroAlt:values.heroAlt,
    paletteId:values.paletteId || undefined,
    shapeId:values.shapeId || undefined,
    brandName:values.businessName || values.businessType,
    footerText:values.businessName || values.businessType,
    navigation:[],
    contacts:{phone:"",email:"",address:"",hours:""},
    socialLinks:[],
    contentBySection:{}
  };
}

function readImage(file) {
  if (file.size > 2 * 1024 * 1024) throw new Error("Изображение должно быть не больше 2 МБ.");
  if (!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type)) throw new Error("Поддерживаются PNG, JPG, WebP и GIF.");
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
    reader.readAsDataURL(file);
  });
}

function renderCurrentProject() {
  currentProject = createStudioProject(currentInput);
  latestHtml = currentProject.html;
  frame.srcdoc = latestHtml;
  document.querySelector("#preview-title").textContent = currentInput.businessName || currentInput.businessType;
  document.querySelector("#dna-name").textContent = currentProject.concept.designDNA.primaryArchetypeLabel;
  document.querySelector("#dna-detail").textContent = [
    currentProject.visualIdentity.palette.name,
    currentProject.visualIdentity.typography.display,
    currentProject.visualIdentity.geometry.id
  ].join(" · ");
  document.querySelector("#section-count").textContent = String(currentProject.layoutPlan.sections.length);
  const readiness = assessExportReadiness(latestHtml,currentProject.css);
  currentExportReady = readiness.ready;
  downloadButton.disabled = !currentExportReady;
  document.querySelector("#download-zip").disabled = !currentExportReady;
  document.querySelector("#output-status").textContent = currentExportReady ? "Готов к экспорту" : "Экспорт заблокирован";
  document.querySelector("#output-detail").textContent = currentExportReady
    ? (readiness.warnings ? "Можно скачать; есть " + readiness.warnings + " предупреждений." : "Критических ошибок нет. HTML и ZIP доступны.")
    : "Критических ошибок: " + readiness.errors + ". Исправьте их перед скачиванием.";
  renderAuditReport(readiness.report);
}

function renderAuditReport(report) {
  const root = document.querySelector("#site-audit");
  if (!root) return;
  root.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "audit-summary";
  const score = document.createElement("strong");
  score.className = "audit-score";
  score.textContent = report.score + "/100";
  const copy = document.createElement("div");
  const title = document.createElement("b");
  title.textContent = report.errors ? "Нужны исправления" : report.warnings ? "Есть рекомендации" : "Критичных замечаний нет";
  const detail = document.createElement("small");
  detail.textContent = report.errors + " ошибок · " + report.warnings + " предупреждений";
  copy.append(title,detail);
  heading.append(score,copy);
  root.append(heading);
  const metrics = document.createElement("div");
  metrics.className = "audit-metrics";
  [
    ["Title",report.metrics.titleLength + " симв."],
    ["Description",report.metrics.descriptionLength + " симв."],
    ["H1",String(report.metrics.h1Count)],
    ["Изображения",String(report.metrics.imageCount)],
    ["Без ALT",String(report.metrics.imagesMissingAlt)],
    ["CSS",Math.round(report.metrics.cssBytes/1024) + " КБ"],
    ["Mobile CSS",report.metrics.mobileBreakpoint ? "Есть" : "Нет"],
    ["Focus",report.metrics.focusStyle ? "Есть" : "Нет"],
    ["Reduced motion",report.metrics.reducedMotion ? "Есть" : "Нет"]
  ].forEach(([label,value]) => {
    const item = document.createElement("div");
    const name = document.createElement("small");
    name.textContent = label;
    const number = document.createElement("strong");
    number.textContent = value;
    item.append(name,number);
    metrics.append(item);
  });
  root.append(metrics);
  if (!report.issues.length) {
    const good = document.createElement("p");
    good.className = "audit-empty";
    good.textContent = "Статические проверки HTML и CSS пройдены. Реальное отображение ещё нужно проверить в браузере.";
    root.append(good);
    return;
  }
  const list = document.createElement("ul");
  list.className = "audit-issues";
  report.issues.forEach(item => {
    const row = document.createElement("li");
    row.className = "audit-issue audit-issue--" + item.severity;
    const label = document.createElement("strong");
    label.textContent = (item.severity === "error" ? "Ошибка · " : "Совет · ") + item.title;
    const description = document.createElement("small");
    description.textContent = item.detail;
    row.append(label,description);
    list.append(row);
  });
  root.append(list);
}

function createEditorField(section, property, labelText, multiline = false) {
  const wrapper = document.createElement("label");
  wrapper.className = "section-field";
  wrapper.append(document.createTextNode(labelText));
  const control = document.createElement(multiline ? "textarea" : "input");
  if (multiline) control.rows = property === "points" ? 3 : 2;
  else control.type = "text";
  const value = property === "ctaLabel" ? section.content?.cta?.label : property === "ctaHref" ? section.content?.cta?.href : section.content?.[property];
  control.value = property === "points" && Array.isArray(value)
    ? value.map(item => typeof item === "string" ? item : item.label || "").join("\n")
    : (typeof value === "string" ? value : "");
  control.dataset.sectionId = section.id;
  control.dataset.property = property;
  control.addEventListener("input", () => {
    const target = currentInput.contentBySection[section.id] ||= {};
    if (property === "ctaLabel" || property === "ctaHref") {
      target.cta = { ...(target.cta || {}), [property === "ctaLabel" ? "label" : "href"]:control.value };
    } else {
      target[property] = property === "points"
        ? control.value.split("\n").map(item => item.trim()).filter(Boolean)
        : control.value;
    }
    renderCurrentProject();
  });
  wrapper.append(control);
  return wrapper;
}

function createSectionImageField(section) {
  const wrapper = document.createElement("label");
  wrapper.className = "section-field";
  wrapper.append(document.createTextNode("Изображение секции"));
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/png,image/jpeg,image/webp,image/gif";
  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    try {
      const src = await readImage(selected);
      recordHistory();
      const target = currentInput.contentBySection[section.id] ||= {};
      target.image = { ...(target.image || {}), src, alt:target.image?.alt || "" };
      renderCurrentProject();
      notice.textContent = "Изображение секции добавлено и встроено в HTML.";
    } catch (error) {
      notice.textContent = error.message;
      file.value = "";
    }
  });
  wrapper.append(file);
  const alt = document.createElement("input");
  alt.type = "text";
  alt.placeholder = "Alt — краткое описание изображения";
  alt.value = section.content?.image?.alt || "";
  alt.addEventListener("input", () => {
    const target = currentInput.contentBySection[section.id] ||= {};
    target.image = { ...(target.image || {}), alt:alt.value };
    renderCurrentProject();
  });
  wrapper.append(alt);
  return wrapper;
}


function buildCardEditor(section) {
  const wrap = document.createElement("div");
  wrap.className = "card-editor";
  const heading = document.createElement("strong");
  heading.textContent = "Карточки товаров / услуг";
  wrap.append(heading);
  const list = document.createElement("div");
  list.className = "card-editor-list";
  const renderCards = () => {
    list.replaceChildren();
    const cards = currentInput.contentBySection[section.id]?.items || [];
    cards.forEach((item,index) => {
      const card = document.createElement("div");
      card.className = "item-editor-card";
      const top = document.createElement("div");
      top.className = "item-editor-top";
      const title = document.createElement("strong");
      title.textContent = "Карточка " + (index + 1);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Удалить";
      remove.className = "danger-action";
      remove.addEventListener("click",() => {
        const target = currentInput.contentBySection[section.id];
        recordHistory();
        target.items.splice(index,1);
        renderCurrentProject();
        renderCards();
      });
      top.append(title,remove);
      card.append(top);
      const fields = [
        ["title","Название"],
        ["description","Описание"],
        ["price","Цена / стоимость"]
      ];
      fields.forEach(([key,label]) => {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = label;
        input.value = typeof item[key] === "string" ? item[key] : "";
        input.setAttribute("aria-label",label);
        input.addEventListener("input",() => {
          item[key] = input.value;
          renderCurrentProject();
        });
        card.append(input);
      });
      const linkLabel = document.createElement("input");
      linkLabel.type = "text";
      linkLabel.placeholder = "Текст ссылки";
      linkLabel.value = item.link?.label || "";
      linkLabel.addEventListener("input",() => {
        item.link = {...(item.link || {}),label:linkLabel.value};
        renderCurrentProject();
      });
      const linkHref = document.createElement("input");
      linkHref.type = "text";
      linkHref.placeholder = "Ссылка (например, #contacts или https://...)";
      linkHref.value = item.link?.href || "";
      linkHref.addEventListener("input",() => {
        item.link = {...(item.link || {}),href:linkHref.value};
        renderCurrentProject();
      });
      card.append(linkLabel,linkHref);
      const imageLabel = document.createElement("label");
      imageLabel.className = "section-field";
      imageLabel.append(document.createTextNode("Фото карточки"));
      const imageInput = document.createElement("input");
      imageInput.type = "file";
      imageInput.accept = "image/png,image/jpeg,image/webp,image/gif";
      imageInput.addEventListener("change",async () => {
        const file = imageInput.files?.[0];
        if (!file) return;
        try {
          const imageSrc = await readImage(file);
          recordHistory();
          item.image = {...(item.image || {}),src:imageSrc,alt:item.image?.alt || item.title || ""};
          renderCurrentProject();
          notice.textContent = "Изображение карточки добавлено.";
        } catch (error) {
          notice.textContent = error.message;
          imageInput.value = "";
        }
      });
      imageLabel.append(imageInput);
      const alt = document.createElement("input");
      alt.type = "text";
      alt.placeholder = "Alt — описание изображения";
      alt.value = item.image?.alt || "";
      alt.addEventListener("input",() => {
        item.image = {...(item.image || {}),alt:alt.value};
        renderCurrentProject();
      });
      card.append(imageLabel,alt);
      list.append(card);
    });
  };
  const add = document.createElement("button");
  add.type = "button";
  add.className = "download-button";
  add.textContent = "+ Добавить карточку";
  add.addEventListener("click",() => {
    const target = currentInput.contentBySection[section.id] ||= {};
    target.items ||= [];
    if (target.items.length >= 24) {
      notice.textContent = "В одной секции можно разместить не более 24 карточек.";
      return;
    }
    recordHistory();
    target.items.push({title:"Новый товар или услуга",description:"",price:"",link:{label:"Подробнее",href:"#"}});
    renderCurrentProject();
    renderCards();
  });
  wrap.append(list,add);
  renderCards();
  return wrap;
}

function buildSiteChromeEditor() {
  const panel = document.querySelector("#site-chrome-editor");
  const root = document.querySelector("#site-chrome-fields");
  if (!currentInput) return;
  currentInput.navigation ||= [];
  currentInput.contacts ||= {phone:"",email:"",address:"",hours:""};
  currentInput.socialLinks ||= [];
  currentInput.seoTitle ??= currentInput.businessName || currentInput.businessType;
  currentInput.seoDescription ??= currentInput.description || "";
  currentInput.canonicalUrl ??= "";
  currentInput.ogImage ??= "";
  root.replaceChildren();
  const field = (labelText,value,onInput,type="text",placeholder="") => {
    const label = document.createElement("label");
    label.className = "section-field";
    label.append(document.createTextNode(labelText));
    const input = document.createElement("input");
    input.type = type;
    input.value = value || "";
    input.placeholder = placeholder;
    input.addEventListener("input",() => onInput(input.value));
    label.append(input);
    return label;
  };
  const brand = field("Название в шапке",currentInput.brandName,value => {currentInput.brandName=value;renderCurrentProject();});
  const footer = field("Текст в подвале",currentInput.footerText,value => {currentInput.footerText=value;renderCurrentProject();});
  root.append(brand,footer);
  const seoGroup = document.createElement("div");
  seoGroup.className = "chrome-editor-group";
  const seoTitle = document.createElement("strong");
  seoTitle.textContent = "SEO и предпросмотр в поиске";
  seoGroup.append(seoTitle);
  seoGroup.append(field("SEO Title",currentInput.seoTitle,value => {currentInput.seoTitle=value;renderCurrentProject();},"text","Название страницы — ориентир 30–60 символов"));
  seoGroup.append(field("Meta Description",currentInput.seoDescription,value => {currentInput.seoDescription=value;renderCurrentProject();},"text","Краткое описание — ориентир 70–160 символов"));
  seoGroup.append(field("Canonical URL",currentInput.canonicalUrl,value => {currentInput.canonicalUrl=value;renderCurrentProject();},"url","https://ваш-домен.ru/"));
  seoGroup.append(field("Open Graph image URL",currentInput.ogImage,value => {currentInput.ogImage=value;renderCurrentProject();},"url","https://ваш-домен.ru/social-cover.jpg"));
  const seoHint = document.createElement("small");
  seoHint.className = "audit-hint";
  seoHint.textContent = "Canonical укажите только после выбора основного домена. Для соцсетей нужен абсолютный URL доступного изображения.";
  seoGroup.append(seoHint);
  root.append(seoGroup);
  const navGroup = document.createElement("div");
  navGroup.className = "chrome-editor-group";
  const navTitle = document.createElement("strong");
  navTitle.textContent = "Навигация";
  navGroup.append(navTitle);
  currentInput.navigation.forEach((item,index) => {
    const row = document.createElement("div");
    row.className = "chrome-editor-row";
    const label = document.createElement("input");
    label.value = item.label || "";
    label.placeholder = "Название пункта";
    label.setAttribute("aria-label","Название пункта меню");
    label.addEventListener("input",() => {item.label=label.value;renderCurrentProject();});
    const href = document.createElement("input");
    href.value = item.href || "";
    href.placeholder = "#contacts или https://...";
    href.setAttribute("aria-label","Ссылка пункта меню");
    href.addEventListener("input",() => {item.href=href.value;renderCurrentProject();});
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "danger-action"; remove.textContent = "×";
    remove.setAttribute("aria-label","Удалить пункт меню");
    remove.addEventListener("click",() => {recordHistory();currentInput.navigation.splice(index,1);buildSiteChromeEditor();renderCurrentProject();});
    row.append(label,href,remove);
    navGroup.append(row);
  });
  const addNav = document.createElement("button");
  addNav.type = "button"; addNav.className = "download-button"; addNav.textContent = "+ Пункт меню";
  addNav.addEventListener("click",() => {if(currentInput.navigation.length>=12)return;recordHistory();currentInput.navigation.push({label:"Новый раздел",href:"#top"});buildSiteChromeEditor();renderCurrentProject();});
  navGroup.append(addNav);
  root.append(navGroup);
  const contactGroup = document.createElement("div");
  contactGroup.className = "chrome-editor-group";
  const contactTitle = document.createElement("strong");
  contactTitle.textContent = "Контактная информация";
  contactGroup.append(contactTitle);
  [["phone","Телефон"],["email","Электронная почта"],["address","Адрес"],["hours","Время работы"]].forEach(([key,label]) => {
    contactGroup.append(field(label,currentInput.contacts[key],value => {currentInput.contacts[key]=value;renderCurrentProject();},key==="email"?"email":"text"));
  });
  root.append(contactGroup);
  const socialGroup = document.createElement("div");
  socialGroup.className = "chrome-editor-group";
  const socialTitle = document.createElement("strong");
  socialTitle.textContent = "Социальные сети";
  socialGroup.append(socialTitle);
  currentInput.socialLinks.forEach((item,index) => {
    const row = document.createElement("div");
    row.className = "chrome-editor-row";
    const label = document.createElement("input"); label.value=item.label||""; label.placeholder="Название (Telegram, VK...)";
    label.addEventListener("input",() => {item.label=label.value;renderCurrentProject();});
    const href = document.createElement("input"); href.value=item.href||""; href.placeholder="https://...";
    href.addEventListener("input",() => {item.href=href.value;renderCurrentProject();});
    const remove = document.createElement("button"); remove.type="button"; remove.className="danger-action"; remove.textContent="×";
    remove.addEventListener("click",() => {recordHistory();currentInput.socialLinks.splice(index,1);buildSiteChromeEditor();renderCurrentProject();});
    row.append(label,href,remove); socialGroup.append(row);
  });
  const addSocial = document.createElement("button");
  addSocial.type="button"; addSocial.className="download-button"; addSocial.textContent="+ Социальная ссылка";
  addSocial.addEventListener("click",() => {if(currentInput.socialLinks.length>=12)return;recordHistory();currentInput.socialLinks.push({label:"Telegram",href:""});buildSiteChromeEditor();renderCurrentProject();});
  socialGroup.append(addSocial);
  root.append(socialGroup);
  panel.hidden = false;
}

function buildSectionEditor(project) {
  const panel = document.querySelector("#section-editor");
  const fields = document.querySelector("#section-fields");
  fields.replaceChildren();
  project.layoutPlan.sections.forEach((section, index) => {
    const card = document.createElement("details");
    card.className = "section-editor-card";
    if (index === 0) card.open = true;
    const summary = document.createElement("summary");
    summary.textContent = SECTION_LABELS[section.id] || SECTION_LABELS[section.key] || section.title || `Секция ${index + 1}`;
    card.append(summary);
    const actions = document.createElement("div");
    actions.className = "section-order-actions";
    const moveUp = document.createElement("button");
    moveUp.type = "button";
    moveUp.textContent = "↑ Выше";
    moveUp.disabled = index === 0;
    moveUp.addEventListener("click", () => moveSection(index,-1));
    const moveDown = document.createElement("button");
    moveDown.type = "button";
    moveDown.textContent = "↓ Ниже";
    moveDown.disabled = index === project.layoutPlan.sections.length - 1;
    moveDown.addEventListener("click", () => moveSection(index,1));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Удалить";
    remove.className = "danger-action";
    remove.disabled = project.layoutPlan.sections.length <= 1;
    remove.addEventListener("click", () => removeSection(section.id));
    actions.append(moveUp,moveDown,remove);
    card.append(actions);
    const content = document.createElement("div");
    content.className = "section-editor-fields";
    content.append(createEditorField(section, "title", "Заголовок"));
    content.append(createEditorField(section, "description", "Описание", true));
    content.append(createEditorField(section, "points", "Список пунктов — каждый с новой строки", true));
    content.append(createEditorField(section, "ctaLabel", "Текст кнопки"));
    content.append(createEditorField(section, "ctaHref", "Ссылка кнопки"));
    content.append(createSectionImageField(section));
    content.append(buildCardEditor(section));
    card.append(content);
    fields.append(card);
  });
  panel.hidden = false;
}

async function generate(event) {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.querySelector("span").textContent = "Создаём концепцию…";
  try {
    const input = readForm();
    const imageFile = form.elements.heroImage.files?.[0];
    const heroImage = imageFile ? await readImage(imageFile) : null;
    const firstProject = createStudioProject(input);
    const heroId = firstProject.concept.homepage.sectionOrder[0];
    input.contentBySection[heroId] = {
      title:form.elements.heroTitle.value.trim() || input.businessName || input.businessType,
      description:input.description || "Описание вашего предложения появится здесь.",
      eyebrow:firstProject.concept.designDNA.primaryArchetypeLabel,
      cta:{href:"#",label:form.elements.ctaLabel.value.trim() || firstProject.concept.homepage.primaryCTA},
      ...(heroImage ? {image:{src:heroImage,alt:form.elements.heroAlt.value.trim() || "Изображение проекта"}} : {})
    };
    for (const id of firstProject.concept.homepage.sectionOrder.slice(1)) {
      input.contentBySection[id] = {title:SECTION_LABELS[id] || id.replaceAll("-"," ")};
    }
    input.sectionOrder = [...firstProject.concept.homepage.sectionOrder];
    input.navigation = firstProject.layoutPlan.sections.slice(1,6).map(section => ({label:SECTION_LABELS[section.id] || SECTION_LABELS[section.key] || section.title || "Раздел",href:"#" + section.key}));
    input.heroTitle = form.elements.heroTitle.value;
    input.ctaLabel = form.elements.ctaLabel.value;
    input.heroAlt = form.elements.heroAlt.value;
    currentInput = input;
    projectHistory.clear();
    updateHistoryButtons();
    renderCurrentProject();
    buildSiteChromeEditor();
    buildSectionEditor(currentProject);
    refreshProjectShelf();
    notice.textContent = "Концепция собрана. Сохраните проект, чтобы вернуться к нему позже.";
    setDevice("desktop");
  } catch (error) {
    notice.textContent = "Не удалось собрать проект: " + error.message;
    console.error(error);
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "Сгенерировать концепцию";
  }
}

function setDevice(device) {
  frame.classList.remove("device-tablet","device-mobile");
  if (device === "tablet") frame.classList.add("device-tablet");
  if (device === "mobile") frame.classList.add("device-mobile");
  deviceButtons.forEach(button => {
    const active = button.dataset.device === device;
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
  });
  document.querySelector("#canvas-label").textContent = ({desktop:"DESKTOP · 100%",tablet:"TABLET · 768 PX",mobile:"MOBILE · 390 PX"})[device];
}


const PROJECTS_KEY = "unique-design-studio.projects.v1";
const MAX_PROJECT_FILE_BYTES = 8 * 1024 * 1024;

function readSavedProjects() {
  try {
    const value = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function refreshProjectShelf(selectedId = "") {
  const select = document.querySelector("#saved-projects");
  const projects = readSavedProjects();
  select.replaceChildren();
  if (!projects.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Нет сохранённых проектов";
    select.append(option);
  } else {
    projects.forEach(project => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.name + " · " + new Date(project.updatedAt).toLocaleDateString("ru-RU");
      select.append(option);
    });
  }
  if (selectedId && projects.some(project => project.id === selectedId)) select.value = selectedId;
  document.querySelector("#load-project").disabled = !projects.length;
  document.querySelector("#delete-project").disabled = !projects.length;
  document.querySelector("#export-project").disabled = !currentInput;
  document.querySelector("#download-zip").disabled = !currentInput || !currentExportReady;
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content],{type});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

function ensureExportReady() {
  if (!currentInput) {
    notice.textContent = "Сначала создайте или откройте проект.";
    return false;
  }
  try {
    // Rebuild from the latest editable project state and re-run the gate for every download.
    renderCurrentProject();
    return currentExportReady;
  } catch (error) {
    currentExportReady = false;
    downloadButton.disabled = true;
    document.querySelector("#download-zip").disabled = true;
    notice.textContent = "Не удалось проверить экспорт: " + error.message;
    return false;
  }
}

function exportProjectZip() {
  if (!ensureExportReady()) {
    const report = assessExportReadiness(latestHtml,currentProject?.css || "");
    notice.textContent = "Скачивание ZIP заблокировано: критических ошибок — " + report.errors + ". Исправьте ошибки в отчёте аудита.";
    return;
  }
  const instructions = [
    "UNIQUE DESIGN STUDIO — ЭКСПОРТ САЙТА",
    "",
    "1. Откройте index.html в браузере для локального просмотра.",
    "2. Файл index.html содержит стили и загруженные в студию изображения.",
    "3. Внешние изображения и внешние ссылки требуют подключения к интернету.",
    "4. Перед публикацией проверьте тексты, цены, контакты, ссылки и мобильную версию.",
    "5. Формы в текущем экспорте являются макетами и не отправляют заявки.",
    "",
    "Для публикации загрузите index.html на выбранный статический хостинг."
  ].join("\n");
  try {
    const archive = createZip([
      {name:"index.html",content:latestHtml},
      {name:"README.txt",content:instructions}
    ]);
    const integrity = verifyZipArchive(archive,["index.html","README.txt"]);
    if (!integrity.valid) throw new Error(integrity.errors.join("; "));
    const filename = (currentInput.businessName || currentInput.businessType || "unique-design-site").trim().replace(/[^a-z0-9а-яё_-]+/gi,"-") + ".zip";
    downloadBlob(archive,"application/zip",filename);
    notice.textContent = "ZIP проверен: index.html и README.txt на месте, структура и CRC32 корректны.";
  } catch (error) {
    notice.textContent = "ZIP не скачан: проверка целостности не пройдена. " + error.message;
  }
}

function projectSnapshot() {
  if (!currentInput) throw new Error("Сначала создайте или откройте проект.");
  return {schemaVersion:"1.0.0",savedAt:new Date().toISOString(),input:JSON.parse(JSON.stringify(currentInput))};
}

function saveProject() {
  if (!currentInput) {
    notice.textContent = "Сначала сгенерируйте сайт, затем сохраните проект.";
    return;
  }
  const projects = readSavedProjects();
  currentInput.projectId ||= (crypto.randomUUID ? crypto.randomUUID() : "project-" + Date.now());
  const record = {
    id:currentInput.projectId,
    name:currentInput.businessName || currentInput.businessType || "Без названия",
    updatedAt:new Date().toISOString(),
    snapshot:projectSnapshot()
  };
  const index = projects.findIndex(project => project.id === record.id);
  if (index >= 0) projects[index] = record;
  else projects.unshift(record);
  try {
    localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects));
    refreshProjectShelf(record.id);
    notice.textContent = "Проект сохранён локально в этом браузере.";
  } catch (error) {
    notice.textContent = "Не удалось сохранить проект в браузере. Экспортируйте JSON: возможно, переполнено локальное хранилище.";
    console.error(error);
  }
}

function validateProjectInput(input) {
  if (!input || typeof input !== "object" || typeof input.businessType !== "string" || !input.businessType.trim()) {
    throw new Error("В JSON нет корректного поля businessType.");
  }
  if (!input.contentBySection || typeof input.contentBySection !== "object" || Array.isArray(input.contentBySection)) input.contentBySection = {};
  if (!Array.isArray(input.sectionOrder) || !input.sectionOrder.length || input.sectionOrder.some(id => typeof id !== "string" || !/^[a-z0-9-]{1,80}$/i.test(id))) {
    throw new Error("В проекте отсутствует корректный порядок секций.");
  }
  if (input.sectionOrder.length > 40 || new Set(input.sectionOrder).size !== input.sectionOrder.length) {
    throw new Error("Список секций содержит дубликаты или превышает лимит 40.");
  }
  return input;
}

function syncFormFromProject(input) {
  ["businessType","businessName","audience","primaryGoal","description","heroTitle","ctaLabel","heroAlt","paletteId","shapeId"].forEach(name => {
    if (form.elements[name]) form.elements[name].value = input[name] || "";
  });
}

function loadProjectInput(input, id = "", preserveHistory = false) {
  if (!preserveHistory) projectHistory.clear();
  currentInput = validateProjectInput(input);
  updateHistoryButtons();
  if (id) currentInput.projectId = id;
  syncFormFromProject(currentInput);
  renderCurrentProject();
  buildSiteChromeEditor();
  buildSectionEditor(currentProject);
  refreshProjectShelf(currentInput.projectId || "");
  notice.textContent = "Проект открыт. Можно продолжать редактирование.";
}

function moveSection(index, direction) {
  const order = currentInput.sectionOrder;
  const target = index + direction;
  if (target < 0 || target >= order.length) return;
  recordHistory();
  [order[index],order[target]] = [order[target],order[index]];
  renderCurrentProject();
  buildSectionEditor(currentProject);
  notice.textContent = "Порядок секций изменён.";
}

function removeSection(id) {
  if (currentInput.sectionOrder.length <= 1) return;
  recordHistory();
  currentInput.sectionOrder = currentInput.sectionOrder.filter(sectionId => sectionId !== id);
  renderCurrentProject();
  buildSectionEditor(currentProject);
  notice.textContent = "Секция удалена со страницы.";
}

function addSection() {
  const id = document.querySelector("#add-section-select").value;
  if (!id || currentInput.sectionOrder.includes(id)) {
    notice.textContent = "Эта секция уже добавлена или не выбрана.";
    return;
  }
  recordHistory();
  currentInput.sectionOrder.push(id);
  currentInput.contentBySection[id] ||= {title:SECTION_LABELS[id] || id.replaceAll("-"," ")};
  renderCurrentProject();
  buildSectionEditor(currentProject);
  notice.textContent = "Секция добавлена в конец страницы.";
}

function exportProjectJson() {
  try {
    const snapshot = projectSnapshot();
    const filename = (currentInput.businessName || currentInput.businessType).trim().replace(/[^a-z0-9а-яё_-]+/gi,"-") + ".uds.json";
    downloadBlob(JSON.stringify(snapshot,null,2),"application/json;charset=utf-8",filename);
    notice.textContent = "JSON-файл проекта подготовлен для скачивания.";
  } catch (error) {
    notice.textContent = error.message;
  }
}

async function importProjectJson(file) {
  if (!file) return;
  if (file.size > MAX_PROJECT_FILE_BYTES) {
    notice.textContent = "JSON-файл слишком большой. Максимальный размер — 8 МБ.";
    return;
  }
  try {
    const parsed = JSON.parse(await file.text());
    loadProjectInput(validateProjectInput(parsed.input || parsed));
    notice.textContent = "Проект импортирован. Нажмите «Сохранить проект», чтобы добавить его в локальную библиотеку.";
  } catch (error) {
    notice.textContent = "Не удалось импортировать проект: " + error.message;
  }
}

document.querySelector("#save-project").addEventListener("click",saveProject);
document.querySelector("#undo-project").addEventListener("click",undoProject);
document.querySelector("#redo-project").addEventListener("click",redoProject);
document.querySelector("#load-project").addEventListener("click",() => {
  const id = document.querySelector("#saved-projects").value;
  const record = readSavedProjects().find(project => project.id === id);
  if (record) loadProjectInput(record.snapshot.input,id);
});
document.querySelector("#delete-project").addEventListener("click",() => {
  const id = document.querySelector("#saved-projects").value;
  const remaining = readSavedProjects().filter(project => project.id !== id);
  localStorage.setItem(PROJECTS_KEY,JSON.stringify(remaining));
  refreshProjectShelf();
  notice.textContent = "Сохранённая копия удалена из локальной библиотеки.";
});
document.querySelector("#export-project").addEventListener("click",exportProjectJson);
document.querySelector("#import-project").addEventListener("change",event => {
  importProjectJson(event.target.files?.[0]);
  event.target.value = "";
});
document.querySelector("#add-section").addEventListener("click",addSection);
const addSectionSelect = document.querySelector("#add-section-select");
Object.entries(SECTION_LABELS).forEach(([id,label]) => {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = label;
  addSectionSelect.append(option);
});
document.querySelector("#saved-projects").addEventListener("change",event => {
  const exists = readSavedProjects().some(project => project.id === event.target.value);
  document.querySelector("#load-project").disabled = !exists;
  document.querySelector("#delete-project").disabled = !exists;
});
refreshProjectShelf();

form.addEventListener("submit",generate);
deviceButtons.forEach(button => button.addEventListener("click",() => setDevice(button.dataset.device)));
document.querySelector("#download-zip").addEventListener("click",exportProjectZip);
downloadButton.addEventListener("click",() => {
  if (!ensureExportReady()) {
    const report = assessExportReadiness(latestHtml,currentProject?.css || "");
    notice.textContent = "Скачивание HTML заблокировано: критических ошибок — " + report.errors + ". Исправьте ошибки в отчёте аудита.";
    return;
  }
  const filename = (currentInput.businessName || currentInput.businessType || "unique-design-site").trim().replace(/[^a-z0-9а-яё_-]+/gi,"-") + ".html";
  downloadBlob(latestHtml,"text/html;charset=utf-8",filename);
  notice.textContent = "HTML проверен и подготовлен к скачиванию.";
});
