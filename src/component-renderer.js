const VOID = new Set(["img","input","meta","link","br","hr"]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[char]);
}

function safeUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = value.trim();
  if (/^(https?:\/\/|\/|\.\/|\.\.\/|#)/i.test(url) && !/^\/\//.test(url)) return url;
  return null;
}

function attrs(values = {}) {
  return Object.entries(values)
    .filter(([,value]) => value !== undefined && value !== null && value !== false)
    .map(([key,value]) => value === true ? key : `${key}="${escapeHtml(value)}"`)
    .join(" ");
}

function element(tag, attributes, children = "") {
  if (!/^[a-z][a-z0-9-]*$/i.test(tag)) throw new TypeError("Invalid HTML tag");
  const attr = attrs(attributes);
  const open = attr ? `<${tag} ${attr}>` : `<${tag}>`;
  return VOID.has(tag) ? open : `${open}${children}</${tag}>`;
}

function safeImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const src = value.trim();
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(src)) return src;
  return safeUrl(src);
}

function renderImage(image, className = "uds-media") {
  if (!image || typeof image !== "object") return "";
  const src = safeImageUrl(image.src);
  if (!src) return "";
  return element("img", {
    class:className, src, alt:String(image.alt ?? ""), loading:"lazy",
    decoding:"async", width:image.width, height:image.height
  });
}

function renderLink(link, className = "uds-button") {
  if (!link || typeof link !== "object") return "";
  const href = safeUrl(link.href);
  if (!href) return "";
  return element("a", { class:className, href, rel:/^https?:\/\//i.test(href) ? "noopener noreferrer" : null }, escapeHtml(link.label ?? "Подробнее"));
}

function renderItems(items, className = "uds-card-grid") {
  if (!Array.isArray(items) || items.length === 0) return "";
  const cards = items.map(item => {
    const media = renderImage(item.image, "uds-card__image");
    const title = item.title ? element("h3", { class:"uds-card__title" }, escapeHtml(item.title)) : "";
    const description = item.description ? element("p", { class:"uds-card__description" }, escapeHtml(item.description)) : "";
    const price = item.price ? element("p", { class:"uds-card__price" }, escapeHtml(item.price)) : "";
    const link = renderLink(item.link, "uds-text-link");
    return element("article", { class:"uds-card" }, media + title + description + price + link);
  }).join("");
  return element("div", { class:className }, cards);
}

function renderList(items, className = "uds-list") {
  if (!Array.isArray(items) || !items.length) return "";
  return element("ul", { class:className }, items.map(item => element("li", {}, escapeHtml(typeof item === "string" ? item : item.label ?? ""))).join(""));
}

function renderForm(form) {
  if (!form || typeof form !== "object") return "";
  const fields = Array.isArray(form.fields) ? form.fields : [{ name:"name", label:"Ваше имя", type:"text" }, { name:"phone", label:"Телефон", type:"tel" }];
  const controls = fields.map((field,index) => {
    const type = ["text","email","tel"].includes(field.type) ? field.type : "text";
    const name = String(field.name || `field-${index+1}`).replace(/[^a-zA-Z0-9_-]/g,"");
    const id = `uds-${name}-${index}`;
    const label = element("label", { for:id }, escapeHtml(field.label || "Поле"));
    const input = element("input", { id, name, type, autocomplete:field.autocomplete || null, required:field.required === true, placeholder:field.placeholder || null });
    return element("div", { class:"uds-form__field" }, label + input);
  }).join("");
  const button = element("button", { class:"uds-button", type:"submit" }, escapeHtml(form.submitLabel || "Отправить заявку"));
  const note = element("p", { class:"uds-form__note" }, "Форма — визуальный макет. Подключите обработчик заявок перед публикацией.");
  return element("form", { class:"uds-form", action:"#", method:"post", "data-uds-demo-form":"true" }, controls + button + note);
}

function renderHero(section) {
  const data = section.content || {};
  const eyebrow = data.eyebrow ? element("p", { class:"uds-eyebrow" }, escapeHtml(data.eyebrow)) : "";
  const title = element("h1", { class:"uds-hero__title" }, escapeHtml(data.title || section.title || "Заголовок проекта"));
  const description = data.description ? element("p", { class:"uds-hero__description" }, escapeHtml(data.description)) : "";
  const media = renderImage(data.image, "uds-hero__image");
  const cta = renderLink(data.cta);
  const secondary = renderLink(data.secondaryCta, "uds-text-link");
  return element("div", { class:"uds-hero" }, element("div", { class:"uds-hero__copy" }, eyebrow + title + description + element("div", { class:"uds-hero__actions" }, cta + secondary)) + media);
}

function renderSectionContent(section) {
  const data = section.content || {};
  const heroComponents = new Set(["product-hero","editorial-cover","immersive-cover","offset-hero","split-action-hero","narrative-cover","bento-hero","type-statement","focused-conversion-hero"]);
  if (heroComponents.has(section.component)) return renderHero(section);
  const heading = data.title || section.title;
  const title = heading ? element("h2", { class:"uds-section__title" }, escapeHtml(heading)) : "";
  const intro = data.description ? element("p", { class:"uds-section__intro" }, escapeHtml(data.description)) : "";
  const image = renderImage(data.image, "uds-section__image");
  const items = renderItems(data.items);
  const list = renderList(data.points || data.steps || data.features);
  const form = section.component === "booking-form" || section.component === "contact-panel" ? renderForm(data.form || {}) : "";
  const quote = data.quote ? element("blockquote", { class:"uds-quote" }, escapeHtml(data.quote) + (data.author ? element("cite", {}, escapeHtml(data.author)) : "")) : "";
  const link = renderLink(data.cta);
  return title + intro + image + items + list + quote + form + link;
}

/**
 * Render a safe, self-contained HTML page from a layout plan.
 * User-provided strings are escaped; raw HTML is never accepted.
 */
export function renderHtmlPage(input = {}) {
  const plan = input.layoutPlan ?? input.plan;
  if (!plan || !Array.isArray(plan.sections) || plan.sections.length === 0) {
    throw new TypeError("A valid layoutPlan with sections is required");
  }
  const identity = input.visualIdentity ?? {};
  const pageTitle = escapeHtml(input.title || input.businessName || "Unique Design Studio");
  const description = escapeHtml(input.description || "Индивидуальная дизайн-концепция сайта");
  const brand = escapeHtml(input.brandName || input.businessName || "Brand");
  const navItems = Array.isArray(input.navigation) ? input.navigation : [];
  const nav = navItems.length ? element("nav", { class:"uds-nav", "aria-label":"Основная навигация" },
    element("ul", {}, navItems.map((item,index) => {
      const href = safeUrl(item.href || `#${plan.sections[index]?.key || "top"}`);
      return element("li", {}, href ? element("a", { href }, escapeHtml(item.label || "Раздел")) : escapeHtml(item.label || "Раздел"));
    }).join(""))
  ) : "";
  const header = element("header", { class:"uds-header" },
    element("a", { class:"uds-brand", href:"#top" }, brand) + nav
  );
  const sections = plan.sections.map((section,index) => {
    const body = renderSectionContent(section);
    const content = body || (section.title ? element("h2", {}, escapeHtml(section.title)) : "");
    return element("section", {
      id:section.key,
      class:`uds-section uds-section--${section.key} uds-component--${section.component}`
    }, content);
  }).join("\n");
  const contacts = input.contacts && typeof input.contacts === "object" ? input.contacts : {};
  const contactParts = [];
  if (contacts.phone && /^[+()\d\s.-]{6,30}$/.test(String(contacts.phone))) {
    const phone = String(contacts.phone).trim();
    contactParts.push(element("a", { href:"tel:" + phone.replace(/[^+\d]/g,"") }, escapeHtml(phone)));
  }
  if (contacts.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contacts.email))) {
    const email = String(contacts.email).trim();
    contactParts.push(element("a", { href:"mailto:" + email }, escapeHtml(email)));
  }
  for (const key of ["address","hours"]) if (contacts[key]) contactParts.push(element("span", {}, escapeHtml(contacts[key])));
  const contactBlock = contactParts.length ? element("div", { class:"uds-footer__contacts" }, contactParts.join("")) : "";
  const socialItems = Array.isArray(input.socialLinks) ? input.socialLinks.slice(0,12).map(item => {
    const href = typeof item?.href === "string" && /^https:\/\//i.test(item.href.trim()) ? safeUrl(item.href) : null;
    return href ? element("a", { href, rel:"noopener noreferrer", target:"_blank" }, escapeHtml(item.label || "Соцсеть")) : "";
  }).filter(Boolean).join("") : "";
  const socialBlock = socialItems ? element("nav", { class:"uds-social", "aria-label":"Социальные сети" }, socialItems) : "";
  const footer = element("footer", { class:"uds-footer" }, element("p", {}, escapeHtml(input.footerText || brand)) + contactBlock + socialBlock);
  const css = input.css || "";
  const style = element("style", {}, css.replace(/<\/style/gi,"<\\/style"));
  const html = "<!doctype html>\n" + element("html", { lang:input.lang || "ru" },
    element("head", {},
      element("meta", { charset:"utf-8" }) +
      element("meta", { name:"viewport", content:"width=device-width, initial-scale=1" }) +
      element("meta", { name:"description", content:description }) +
      element("title", {}, pageTitle) + style
    ) +
    element("body", {},
      element("div", { class:`uds-page uds-shell--${String(plan.shell || "focused").replace(/[^a-z0-9-]/gi,"")}`, id:"top" },
        header + element("main", { class:"uds-main" }, sections) + footer
      )
    )
  );
  return html;
}

export function renderComponentCss(identity = {}) {
  const tokens = identity.cssVariables && typeof identity.cssVariables === "object" ? identity.cssVariables : identity;
  const tokenCss = Object.entries(tokens).filter(([key,value]) => /^--[a-z0-9-]+$/i.test(key) && typeof value === "string" && !/[;{}]/.test(value)).map(([key,value]) => `  ${key}: ${value};`).join("\\n");
  return `:root {\\n${tokenCss}\\n  color-scheme: light dark; font-family: var(--uds-font-body, Arial, sans-serif); color: var(--uds-color-text, #202020); background: var(--uds-color-bg, #fff); }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; background: var(--uds-color-bg, #fff); color: var(--uds-color-text, #202020); }
.uds-page { width: min(100%, var(--uds-layout-max, 1440px)); margin-inline: auto; padding-inline: var(--uds-layout-gutter, clamp(20px, 5vw, 80px)); }
.uds-header { min-height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 1px solid color-mix(in srgb, currentColor 16%, transparent); }
.uds-brand { color: inherit; text-decoration: none; font-weight: 800; }
.uds-nav ul { display: flex; flex-wrap: wrap; gap: 20px; list-style: none; margin: 0; padding: 0; }
.uds-nav a, .uds-text-link { color: inherit; text-underline-offset: .2em; }
.uds-main { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: clamp(28px, 5vw, 76px); padding-block: var(--uds-space-section, 72px); }
.uds-section { grid-column: 1 / -1; min-width: 0; }
.uds-hero { min-height: min(72vh, 760px); display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .9fr); align-items: center; gap: clamp(28px, 6vw, 88px); }
.uds-hero__title { max-width: 12ch; font-family: var(--uds-font-display, inherit); font-size: clamp(2.7rem, 7vw, 6.8rem); line-height: .98; letter-spacing: -.045em; margin: .2em 0; }
.uds-hero__description, .uds-section__intro { max-width: 60ch; color: var(--uds-color-muted, #666); font-size: clamp(1rem, 1.3vw, 1.2rem); line-height: 1.65; }
.uds-eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; }
.uds-hero__image, .uds-section__image { display: block; width: 100%; max-height: 680px; object-fit: cover; border-radius: var(--uds-radius-lg, 18px); }
.uds-hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-top: 28px; }
.uds-button { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; padding: 12px 22px; border: 0; border-radius: var(--uds-radius-pill, 999px); background: var(--uds-color-accent, #315c52); color: white; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }
.uds-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.uds-card { min-width: 0; padding: 18px; background: var(--uds-color-surface, #f6f6f6); border-radius: var(--uds-radius-md, 14px); }
.uds-card__image { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--uds-radius-sm, 8px); }
.uds-card__title { font-size: 1.2rem; }
.uds-list { display: grid; gap: 12px; padding-left: 1.2em; }
.uds-form { max-width: 560px; display: grid; gap: 16px; }
.uds-form__field { display: grid; gap: 8px; }
.uds-form input { width: 100%; min-height: 48px; padding: 12px 14px; border: 1px solid color-mix(in srgb, currentColor 30%, transparent); border-radius: var(--uds-radius-sm, 8px); background: var(--uds-color-surface, white); color: inherit; font: inherit; }
.uds-form__note { color: var(--uds-color-muted, #666); font-size: .85rem; }
.uds-quote { margin: 0; padding: 24px; border-left: 3px solid var(--uds-color-accent, currentColor); font-size: 1.25rem; }
.uds-quote cite { display: block; margin-top: 12px; font-size: .9rem; }
.uds-footer { padding-block: 28px; border-top: 1px solid color-mix(in srgb, currentColor 16%, transparent); }
.uds-footer__contacts, .uds-social { display: flex; flex-wrap: wrap; gap: 12px 20px; margin-top: 12px; }
.uds-footer__contacts a, .uds-social a { color: inherit; text-underline-offset: .2em; }
:focus-visible { outline: 3px solid var(--uds-color-accent, #315c52); outline-offset: 3px; }
@media (max-width: 767px) {
  .uds-page { padding-inline: 18px; }
  .uds-header { align-items: flex-start; flex-direction: column; padding-block: 18px; }
  .uds-nav ul { gap: 12px; }
  .uds-main { display: block; padding-block: 40px; }
  .uds-section { margin-block: 48px; }
  .uds-hero { min-height: auto; grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .uds-hero__image { grid-row: 1; max-height: 52vh; }
  .uds-hero__title { font-size: clamp(2.5rem, 13vw, 4.5rem); }
  .uds-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .uds-card { padding: 12px; }
}
@media (max-width: 380px) { .uds-card-grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; } }`;
}
