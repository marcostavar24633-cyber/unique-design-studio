import { createStudioProject } from "../src/studio-pipeline.js";

const form = document.querySelector("#project-form");
const frame = document.querySelector("#preview-frame");
const downloadButton = document.querySelector("#download-html");
const notice = document.querySelector("#notice");
const deviceButtons = [...document.querySelectorAll("[data-device]")];
let latestHtml = "";

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

function generate(event) {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.querySelector("span").textContent = "Создаём концепцию…";
  try {
    const input = readForm();
    const firstProject = createStudioProject(input);
    const heroId = firstProject.concept.homepage.sectionOrder[0];
    input.contentBySection[heroId] = {
      title:input.businessName || input.businessType,
      description:input.description || "Описание вашего предложения появится здесь.",
      eyebrow:firstProject.concept.designDNA.primaryArchetypeLabel,
      cta:{href:"#",label:firstProject.concept.homepage.primaryCTA}
    };
    for (const id of firstProject.concept.homepage.sectionOrder.slice(1)) {
      input.contentBySection[id] = {title:SECTION_LABELS[id] || id.replaceAll("-"," ")};
    }
    const project = createStudioProject(input);
    latestHtml = project.html;
    frame.srcdoc = latestHtml;
    downloadButton.disabled = false;
    document.querySelector("#preview-title").textContent = input.businessName || input.businessType;
    document.querySelector("#dna-name").textContent = project.concept.designDNA.primaryArchetypeLabel;
    document.querySelector("#dna-detail").textContent = [
      project.visualIdentity.palette.name,
      project.visualIdentity.typography.display,
      project.visualIdentity.geometry.id
    ].join(" · ");
    document.querySelector("#section-count").textContent = String(project.layoutPlan.sections.length);
    document.querySelector("#output-status").textContent = "HTML готов";
    document.querySelector("#output-detail").textContent = "Можно скачать и открыть локально.";
    notice.textContent = "Концепция собрана локально. Тексты секций, реальные изображения, контакты и обработчик форм требуют заполнения перед публикацией.";
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
