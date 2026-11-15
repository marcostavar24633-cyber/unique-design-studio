import { createStudioProject } from "../src/studio-pipeline.js";

const form = document.querySelector("#project-form");
const frame = document.querySelector("#preview-frame");
const downloadButton = document.querySelector("#download-html");
const notice = document.querySelector("#notice");
const deviceButtons = [...document.querySelectorAll("[data-device]")];
let latestHtml = "";
let currentInput = null;
let currentProject = null;

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

function readForm() {
  const values = Object.fromEntries(new FormData(form).entries());
  return {
    businessType:values.businessType,
    businessName:values.businessName,
    audience:values.audience,
    primaryGoal:values.primaryGoal,
    description:values.description,
    paletteId:values.paletteId || undefined,
    shapeId:values.shapeId || undefined,
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
  downloadButton.disabled = false;
  document.querySelector("#preview-title").textContent = currentInput.businessName || currentInput.businessType;
  document.querySelector("#dna-name").textContent = currentProject.concept.designDNA.primaryArchetypeLabel;
  document.querySelector("#dna-detail").textContent = [
    currentProject.visualIdentity.palette.name,
    currentProject.visualIdentity.typography.display,
    currentProject.visualIdentity.geometry.id
  ].join(" · ");
  document.querySelector("#section-count").textContent = String(currentProject.layoutPlan.sections.length);
  document.querySelector("#output-status").textContent = "HTML готов";
  document.querySelector("#output-detail").textContent = "Можно скачать и открыть локально.";
}

function createEditorField(section, property, labelText, multiline = false) {
  const wrapper = document.createElement("label");
  wrapper.className = "section-field";
  wrapper.append(document.createTextNode(labelText));
  const control = document.createElement(multiline ? "textarea" : "input");
  if (multiline) control.rows = property === "points" ? 3 : 2;
  else control.type = "text";
  const value = section.content?.[property];
  control.value = property === "points" && Array.isArray(value)
    ? value.map(item => typeof item === "string" ? item : item.label || "").join("\n")
    : (typeof value === "string" ? value : "");
  control.dataset.sectionId = section.id;
  control.dataset.property = property;
  control.addEventListener("input", () => {
    const target = currentInput.contentBySection[section.id] ||= {};
    target[property] = property === "points"
      ? control.value.split("\n").map(item => item.trim()).filter(Boolean)
      : control.value;
    renderCurrentProject();
  });
  wrapper.append(control);
  return wrapper;
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
    const content = document.createElement("div");
    content.className = "section-editor-fields";
    content.append(createEditorField(section, "title", "Заголовок"));
    content.append(createEditorField(section, "description", "Описание", true));
    content.append(createEditorField(section, "points", "Список пунктов — каждый с новой строки", true));
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
    currentInput = input;
    renderCurrentProject();
    buildSectionEditor(currentProject);
    notice.textContent = "Концепция собрана. Редактируйте секции слева — предпросмотр и HTML обновляются автоматически.";
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

form.addEventListener("submit",generate);
deviceButtons.forEach(button => button.addEventListener("click",() => setDevice(button.dataset.device)));
downloadButton.addEventListener("click",() => {
  if (!latestHtml) return;
  const blob = new Blob([latestHtml],{type:"text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = (form.elements.businessName.value || "unique-design-site").trim().replace(/[^a-z0-9а-яё_-]+/gi,"-") + ".html";
  anchor.click();
  URL.revokeObjectURL(url);
});
