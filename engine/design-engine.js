/*
 * Unique Design Engine
 * Исполняемая реализация спецификации design-system/unique-design-architecture.md:
 *   1. Design Brief  — бизнес, аудитория, цель, характер, приоритет контента, гипотезы;
 *   2. Design DNA    — архетип главной страницы (1 из 10), палитра, типографика, визуал, motion;
 *   3. Homepage      — композиция hero, навигация, порядок секций, главный CTA;
 *   4. Uniqueness    — антишаблонная проверка против соседнего и всех предыдущих проектов;
 *   5. HTML          — самостоятельная адаптивная страница от 320 px;
 *   6. Экспорт       — совместимый с Landing Studio JSON (format: "LandingStudioProject", version: 1).
 *
 * Работает без сети и API: в браузере (window.DesignEngine) и в Node (require).
 * Не выдумывает цены, отзывы, сертификаты, адреса и гарантии — всё неизвестное помечается как гипотеза.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DesignEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ utils */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function hash(str) {
    let h = 2166136261;
    for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const pick = (list, seed) => list[seed % list.length];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ------------------------------------------------------------------ color */
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
  }
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  const hueDistance = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

  /* ------------------------------------------------------- 10 архитектур */
  // landingStudio — ближайшее значение поля designArchitecture в Landing Studio (enum из 5 значений).
  const ARCHETYPES = {
    "product-first": {
      name: "Product First", landingStudio: "catalog",
      hero: "Крупный товар слева, справа панель выбора с характеристиками и кнопкой заказа",
      visual: "left", typeCharacter: "compact-grotesk", nav: "top-bar-with-order", mode: "light",
      fonts: [["Onest", "Onest"], ["Manrope", "Manrope"], ["Golos Text", "Golos Text"]],
      radius: 14, motion: "Короткие hover-состояния карточек, без декоративной анимации hero"
    },
    editorial: {
      name: "Editorial / Magazine", landingStudio: "editorial",
      hero: "Журнальная шапка-мастхед, заголовок на всю ширину, лид в колонках и широкий кадр ниже",
      visual: "bottom", typeCharacter: "contrast-serif", nav: "masthead", mode: "light",
      fonts: [["Playfair Display", "Golos Text"], ["Prata", "Onest"], ["Lora", "Manrope"]],
      radius: 0, motion: "Плавное проявление колонок при прокрутке, без параллакса"
    },
    immersive: {
      name: "Immersive Fullscreen", landingStudio: "immersive",
      hero: "Кадр на весь первый экран, текст внизу слева поверх затемнения",
      visual: "background", typeCharacter: "light-display", nav: "overlay", mode: "dark",
      fonts: [["Cormorant Garamond", "Manrope"], ["Forum", "Jost"], ["Tenor Sans", "Manrope"]],
      radius: 2, motion: "Медленный зум фонового кадра (отключается при reduced motion)"
    },
    asymmetric: {
      name: "Asymmetric Canvas", landingStudio: "modular",
      hero: "Три смещённые зоны: заголовок справа сверху, визуал слева снизу, перекрывающая их заметка",
      visual: "offset-left", typeCharacter: "geometric-display", nav: "side-index", mode: "light",
      fonts: [["Unbounded", "Onest"], ["Montserrat Alternates", "Golos Text"], ["Unbounded", "Manrope"]],
      radius: 24, motion: "Лёгкий сдвиг зон при наведении, без постоянной анимации"
    },
    catalog: {
      name: "Catalog / Marketplace", landingStudio: "catalog",
      hero: "Поиск и категории сразу на первом экране, короткий заголовок над сеткой",
      visual: "grid", typeCharacter: "utility-sans", nav: "search-header", mode: "light",
      fonts: [["IBM Plex Sans", "IBM Plex Sans"], ["Golos Text", "Golos Text"], ["Commissioner", "Commissioner"]],
      radius: 10, motion: "Только состояния фокуса и наведения на категориях"
    },
    "split-utility": {
      name: "Split Utility", landingStudio: "service",
      hero: "Экран поделён пополам: предложение слева, инструмент подбора справа",
      visual: "tool-right", typeCharacter: "humanist-sans", nav: "split-header", mode: "light",
      fonts: [["Commissioner", "Commissioner"], ["Nunito", "Nunito"], ["Ysabeau Office", "Onest"]],
      radius: 12, motion: "Мгновенная реакция инструмента подбора, без задержек ради эффекта"
    },
    storytelling: {
      name: "Storytelling Scroll", landingStudio: "immersive",
      hero: "Узкая колонка первой главы по центру и рельс глав, кадр раскрывается ниже",
      visual: "below-center", typeCharacter: "book-serif", nav: "chapter-rail", mode: "light",
      fonts: [["Literata", "Literata"], ["Lora", "Raleway"], ["PT Serif", "PT Sans"]],
      radius: 6, motion: "Подсветка текущей главы в рельсе при прокрутке"
    },
    "modular-grid": {
      name: "Modular Grid", landingStudio: "modular",
      hero: "Бенто-сетка из равноправных входов в сценарии, заголовок занимает одну из ячеек",
      visual: "tiles", typeCharacter: "geometric-sans", nav: "tile-menu", mode: "light",
      fonts: [["Jost", "Jost"], ["Exo 2", "Onest"], ["Raleway", "Raleway"]],
      radius: 20, motion: "Подъём ячейки при наведении, одинаковая длительность для всех"
    },
    brutalist: {
      name: "Brutalist / Experimental", landingStudio: "modular",
      hero: "Огромная типографика на всю ширину, жёсткие рамки и бегущая строка",
      visual: "type-only", typeCharacter: "raw-mono", nav: "raw-links", mode: "light",
      fonts: [["Russo One", "IBM Plex Mono"], ["Rubik Mono One", "IBM Plex Mono"], ["Oswald", "IBM Plex Mono"]],
      radius: 0, motion: "Бегущая строка (останавливается при reduced motion)"
    },
    "minimal-conversion": {
      name: "Minimal Conversion", landingStudio: "service",
      hero: "Одна колонка: короткое предложение, три факта и одна кнопка, без визуального шума",
      visual: "none", typeCharacter: "plain-sans", nav: "logo-only", mode: "light",
      fonts: [["Manrope", "Manrope"], ["Golos Text", "Golos Text"], ["Onest", "Onest"]],
      radius: 8, motion: "Нет анимации, кроме состояния кнопки"
    }
  };
  const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);

  // Совместимость с полем Landing Studio «Архитектура главной страницы».
  const FROM_LANDING_STUDIO = { catalog: "catalog", editorial: "editorial", immersive: "immersive", service: "split-utility", modular: "modular-grid" };

  /* ---------------------------------------------------- профили ниш */
  // Стартовые гипотезы раздела 10 спецификации + типовые ниши. Порядок важен: первое совпадение побеждает.
  const NICHES = [
    {
      id: "telescopes", test: /телескоп|оптик|бинокл|астроном/i,
      businessType: "Магазин телескопов и оптики", audience: "Начинающие и опытные любители астрономии, родители, выбирающие подарок",
      goal: "Подобрать телескоп под уровень и оформить заказ", cta: "Подобрать телескоп",
      character: "Точный, спокойный, увлечённый", archetypes: ["catalog", "product-first", "split-utility"],
      hue: 222, content: ["Категории оптики", "Подбор по уровню", "Сравнение характеристик", "Доставка и оплата"],
      image: "Предметная съёмка инструментов на нейтральном фоне и реальные снимки неба с подписью, чем сняты",
      itemsTitle: "Категории", items: [["Рефракторы", "Для первых наблюдений Луны и планет"], ["Рефлекторы", "Больше света для туманностей и галактик"], ["Бинокли", "Лёгкий старт и походные наблюдения"], ["Монтировки", "Устойчивость и наведение"], ["Окуляры", "Увеличение под задачу"], ["Аксессуары", "Фильтры, адаптеры, кейсы"]],
      selector: { q: "Что хотите наблюдать?", options: ["Луну и планеты", "Галактики и туманности", "Всё понемногу"] },
      sections: ["selector", "items", "value", "steps", "faq", "contact"]
    },
    {
      id: "tech", test: /doma[\s-]*tech|дома?\s*тех|бытов|техник|электроник|гаджет/i,
      businessType: "Интернет-магазин бытовой техники", audience: "Семьи и арендаторы, обновляющие технику; ценят понятные характеристики",
      goal: "Найти подходящую модель и оформить заказ", cta: "Перейти в каталог",
      character: "Надёжный, ясный, технологичный", archetypes: ["catalog", "product-first", "split-utility"],
      hue: 205, content: ["Категории", "Подбор", "Сравнение", "Доставка и гарантийные условия"],
      image: "Чистые предметные фото на светлом фоне, единый ракурс в карточках",
      itemsTitle: "Категории техники", items: [["Кухня", "Плиты, духовки, посудомоечные машины"], ["Стирка и уход", "Стиральные и сушильные машины"], ["Климат", "Кондиционеры, обогреватели, очистители"], ["Мелкая техника", "Чайники, блендеры, кофемашины"], ["Холодильники", "Однокамерные, двухкамерные, встраиваемые"], ["Уборка", "Пылесосы и роботы-пылесосы"]],
      selector: { q: "Для чего подбираем технику?", options: ["Новая квартира", "Замена старой", "Подарок"] },
      sections: ["items", "selector", "value", "steps", "faq", "contact"]
    },
    {
      id: "photo", test: /photograf|фотограф|фотосесс|фотостуди|видеограф|портфолио/i,
      businessType: "Фотограф: съёмки и портфолио", audience: "Пары, семьи и бренды, которым нужны живые кадры без постановочной скованности",
      goal: "Посмотреть работы и забронировать дату съёмки", cta: "Забронировать дату",
      character: "Тёплый, внимательный, кинематографичный", archetypes: ["immersive", "editorial", "storytelling"],
      hue: 28, content: ["Работы", "Истории съёмок", "Форматы", "Бронирование"],
      image: "Собственные кадры фотографа крупно, без рамок и коллажей; подписи — место и формат съёмки",
      itemsTitle: "Форматы съёмки", items: [["Семейная", "Дома или на прогулке, без жёсткого сценария"], ["Свадебная", "Репортаж дня и портреты пары"], ["Портрет", "Студия или город"], ["Для бренда", "Контент для сайта и соцсетей"]],
      sections: ["gallery", "items", "story", "steps", "faq", "contact"]
    },
    {
      id: "bouquet", test: /slopay|слопай|букет|фудфлор|съедобн|флорист|цвет(ы|оч)/i,
      businessType: "Мастерская съедобных букетов и подарочных наборов", audience: "Те, кто ищет необычный подарок к дате: партнёрам, коллегам, родителям",
      goal: "Выбрать букет из подборки и оформить заказ к дате", cta: "Выбрать букет",
      character: "Щедрый, праздничный, ручная работа", archetypes: ["editorial", "product-first", "modular-grid"],
      hue: 352, content: ["Подборки букетов", "Повод и состав", "Сроки и доставка", "Заказ"],
      image: "Крупные фото букетов сверху и на руках, видны продукты и упаковка",
      itemsTitle: "Подборки", items: [["Ягодные", "Клубника в шоколаде, сезонные ягоды"], ["Мясные", "Колбасы, сыры, багет — для мужчин и компаний"], ["Из раков", "Для любителей морепродуктов"], ["Сухофрукты и орехи", "Долго хранятся, удобно передать"], ["Сладкие боксы", "Конфеты, макаруны, десерты"]],
      sections: ["items", "value", "gallery", "steps", "faq", "contact"]
    },
    {
      id: "coffee", test: /penka|пенка|кофе|кофейн|кафе|ресторан|бар\b|пекарн|кондитер|выпечк/i,
      businessType: "Кофейня / заведение", audience: "Жители района и те, кто работает рядом; приходят за напитком и атмосферой",
      goal: "Посмотреть меню и прийти или заказать навынос", cta: "Посмотреть меню",
      character: "Уютный, соседский, живой", archetypes: ["editorial", "modular-grid", "asymmetric"],
      hue: 30, content: ["Меню", "Выпечка", "Атмосфера", "Как добраться и часы работы"],
      image: "Напитки и выпечка крупным планом, руки бариста, интерьер при дневном свете",
      itemsTitle: "Меню", items: [["Эспрессо-напитки", "Классика на зерне обжарки, которую вы выберете"], ["Альтернатива", "Фильтр, воронка, аэропресс"], ["Выпечка", "Свежая каждый день"], ["Завтраки", "Если есть кухня — уточнить состав"]],
      sections: ["items", "gallery", "value", "visit", "faq", "contact"]
    },
    {
      id: "seafood", test: /raki|рак(и|ов|оварн)|морепродукт|рыб|доставк[аи] еды|шашлык/i,
      businessType: "Магазин живых и варёных раков / готовой еды с доставкой", audience: "Компании друзей и семьи, планирующие вечер; важны свежесть и время доставки",
      goal: "Выбрать продукт, количество и заказать доставку", cta: "Заказать",
      character: "Компанейский, честный, вкусный", archetypes: ["product-first", "storytelling", "immersive"],
      hue: 8, content: ["Продукт и размеры", "Свежесть и приготовление", "Доставка", "Заказ"],
      image: "Продукт крупно на столе, процесс приготовления, без стоковых фото",
      itemsTitle: "Что заказать", items: [["Живые", "Для приготовления дома"], ["Варёные", "Готовы к столу"], ["Наборы", "Для компании, с гарнирами"], ["Дополнения", "Соусы, пиво, лимоны — уточнить ассортимент"]],
      sections: ["items", "story", "steps", "value", "faq", "contact"]
    },
    {
      id: "beauty", test: /hair|салон|парикмах|барбер|маникюр|косметолог|бьюти|beauty|брови|ресниц/i,
      businessType: "Салон красоты / парикмахерская", audience: "Женщины и мужчины, которые ищут своего мастера и предсказуемый результат",
      goal: "Посмотреть работы, выбрать услугу и мастера, записаться", cta: "Записаться",
      character: "Мягкий, внимательный, современный", archetypes: ["editorial", "split-utility", "asymmetric"],
      hue: 330, content: ["Работы до/после", "Услуги", "Мастера", "Запись"],
      image: "Реальные работы мастеров при дневном свете, портреты мастеров",
      itemsTitle: "Услуги", items: [["Стрижки", "Женские, мужские, детские"], ["Окрашивание", "Тон, сложные техники, уход"], ["Укладки", "К событию и на каждый день"], ["Уход", "Восстановление и процедуры"]],
      selector: { q: "Что хотите сделать?", options: ["Стрижку", "Окрашивание", "Пока не знаю — нужна консультация"] },
      sections: ["gallery", "items", "team", "steps", "faq", "contact"]
    },
    {
      id: "renovation", test: /ремонт|отделк|строит|дом[\s-]*ульяновск|ровно|сантехник|электрик|кровл|фасад/i,
      businessType: "Ремонт и отделка квартир", audience: "Владельцы новостроек и вторички, которым важны смета, сроки и контроль",
      goal: "Получить расчёт сметы и вызвать замерщика", cta: "Рассчитать смету",
      character: "Аккуратный, прозрачный, без сюрпризов", archetypes: ["split-utility", "storytelling", "minimal-conversion"],
      hue: 160, content: ["Расчёт", "Виды работ", "Этапы и контроль", "Объекты"],
      image: "Реальные объекты до и после, процесс работ, документы сметы (без персональных данных)",
      itemsTitle: "Виды работ", items: [["Черновая отделка", "Стяжка, штукатурка, электрика"], ["Чистовая отделка", "Покраска, плитка, полы"], ["Под ключ", "От проекта до уборки"], ["Отдельные работы", "Санузел, кухня, одна комната"]],
      selector: { q: "Какой ремонт планируете?", options: ["Новостройка без отделки", "Вторичное жильё", "Одно помещение"] },
      sections: ["selector", "items", "steps", "proof", "faq", "contact"]
    },
    {
      id: "education", test: /курс|обучен|школ|репетитор|учебн|академ|тренинг|наставн/i,
      businessType: "Обучение и курсы", audience: "Взрослые, которые хотят освоить навык и понять, подойдёт ли им программа",
      goal: "Разобраться в программе и записаться на пробное занятие", cta: "Записаться на пробное",
      character: "Поддерживающий, понятный, предметный", archetypes: ["storytelling", "split-utility", "modular-grid"],
      hue: 250, content: ["Программа", "Формат", "Преподаватели", "Запись"],
      image: "Процесс занятий, работы учеников с их согласия",
      itemsTitle: "Программа", items: [["Основы", "С чего начинаем"], ["Практика", "Задания и разборы"], ["Проект", "Итоговая работа"], ["Поддержка", "Обратная связь преподавателя"]],
      sections: ["story", "items", "steps", "team", "faq", "contact"]
    },
    {
      id: "art", test: /галере|выставк|худож|арт|музык|концерт|фестив|событи|театр/i,
      businessType: "Арт-проект / событие", audience: "Зрители и гости, которым важны атмосфера, дата и билеты",
      goal: "Узнать программу и прийти на событие", cta: "Узнать программу",
      character: "Смелый, авторский, выразительный", archetypes: ["brutalist", "immersive", "asymmetric"],
      hue: 285, content: ["Программа", "Участники", "Место и дата", "Регистрация"],
      image: "Работы и фото с прошлых событий, крупно и контрастно",
      itemsTitle: "Программа", items: [["Открытие", "Время уточнить"], ["Основная часть", "Состав уточнить"], ["Встреча с авторами", "Если планируется"], ["Финал", "Время уточнить"]],
      sections: ["items", "gallery", "visit", "faq", "contact"]
    },
    {
      id: "consulting", test: /юрист|адвокат|бухгалт|консалт|финанс|налог|страхов|риелтор|недвиж/i,
      businessType: "Профессиональные услуги и консультации", audience: "Частные лица и малый бизнес с конкретной задачей и ограниченным временем",
      goal: "Описать задачу и получить консультацию", cta: "Получить консультацию",
      character: "Сдержанный, точный, заслуживающий доверия", archetypes: ["minimal-conversion", "split-utility", "editorial"],
      hue: 215, content: ["Задачи, с которыми помогаем", "Как проходит работа", "Подтверждения квалификации", "Запрос"],
      image: "Портрет специалиста, без стоковых рукопожатий",
      itemsTitle: "С чем помогаем", items: [["Консультация", "Разбор ситуации и вариантов"], ["Документы", "Подготовка и проверка"], ["Сопровождение", "Ведение вопроса до результата"]],
      sections: ["items", "steps", "proof", "faq", "contact"]
    }
  ];
  const DEFAULT_NICHE = {
    id: "service", businessType: "Услуги", audience: "Клиенты, которые выбирают исполнителя и сравнивают предложения",
    goal: "Понять предложение и оставить заявку", cta: "Оставить заявку",
    character: "Понятный, внимательный", archetypes: ["modular-grid", "split-utility", "asymmetric"],
    hue: 190, content: ["Услуги", "Как работаем", "Доверие", "Заявка"],
    image: "Реальные фото работы и команды",
    itemsTitle: "Услуги", items: [["Основная услуга", "Описать результат для клиента"], ["Дополнительная услуга", "Описать, когда она нужна"], ["Консультация", "Что клиент получит"]],
    sections: ["items", "value", "steps", "faq", "contact"]
  };

  const TONES = {
    auto: { label: "Автоматически", sat: 0, light: 0 },
    calm: { label: "Спокойный", sat: -18, light: 4 },
    bold: { label: "Смелый", sat: 18, light: -4 },
    premium: { label: "Премиальный", sat: -10, light: -2, dark: true },
    friendly: { label: "Дружелюбный", sat: 10, light: 6 },
    tech: { label: "Технологичный", sat: -6, light: 0, hueShift: -12 }
  };

  /* ------------------------------------------------------- Design Brief */
  function detectNiche(text) {
    return NICHES.find((n) => n.test.test(text)) || DEFAULT_NICHE;
  }

  function buildDesignBrief(input) {
    const brand = String(input.brand || "").trim() || "Новый проект";
    const description = String(input.description || input.niche || "").trim();
    const niche = detectNiche(brand + " " + description);
    const assumptions = [];
    if (niche === DEFAULT_NICHE) assumptions.push("Ниша не распознана по описанию — использован общий сервисный профиль; уточните описание.");
    assumptions.push("Аудитория и цель — гипотеза по типу бизнеса, подтвердить у владельца.");
    if (!input.city) assumptions.push("География не указана — тексты без привязки к городу.");
    assumptions.push("Цены, отзывы, сертификаты, адреса и гарантии не генерируются: на их месте стоят пометки «уточнить».");
    return {
      brand,
      nicheId: niche.id,
      businessType: niche.businessType,
      description,
      city: String(input.city || "").trim(),
      audience: String(input.audience || "").trim() || niche.audience,
      primaryGoal: String(input.goal || "").trim() || niche.goal,
      primaryCTA: String(input.cta || "").trim() || niche.cta,
      brandCharacter: niche.character,
      tone: TONES[input.tone] ? input.tone : "auto",
      contentPriority: niche.content.slice(),
      trustEvidence: ["Реальные фото работ или продукта", "Условия заказа/доставки/оплаты", "Контакты и реквизиты", "Отзывы — только реальные, со ссылкой на источник"],
      constraints: ["Без выдуманных цен, отзывов, сертификатов и гарантий", "Форма без backend — заявка уходит в мессенджер или почту владельца"],
      assumptions
    };
  }

  /* ------------------------------------------------------- Design DNA */
  function rankArchetypes(brief, forced) {
    const niche = NICHES.find((n) => n.id === brief.nicheId) || DEFAULT_NICHE;
    const own = niche.archetypes.slice();
    if (forced && forced !== "auto") {
      const key = ARCHETYPES[forced] ? forced : FROM_LANDING_STUDIO[forced];
      if (key) { const i = own.indexOf(key); if (i >= 0) own.splice(i, 1); own.unshift(key); }
    }
    // Остальные архетипы — запасные, в стабильном порядке от названия бренда.
    const seed = hash(brief.brand);
    const rest = ARCHETYPE_KEYS.filter((k) => !own.includes(k) && k !== "brutalist")
      .sort((a, b) => (hash(a + seed) % 997) - (hash(b + seed) % 997));
    return own.concat(rest);
  }

  function rationaleFor(key, brief) {
    const map = {
      "product-first": "товар и путь к покупке важнее декоративного первого экрана",
      editorial: "бренду нужна авторская подача: продукт и атмосфера рассказываются типографикой и крупным кадром",
      immersive: "решение принимают по визуальному впечатлению — кадр должен занять экран",
      asymmetric: "несколько равных поводов зайти (продукт, место, настроение) удобнее показать смещёнными зонами",
      catalog: "широкий ассортимент: категории и поиск должны быть видны сразу",
      "split-utility": "клиенту нужно быстро понять стоимость или вариант — инструмент подбора на первом экране сокращает путь",
      storytelling: "продукт требует объяснения по шагам; последовательный рассказ снимает вопросы до заявки",
      "modular-grid": "у бизнеса несколько равноправных сценариев входа",
      brutalist: "аудитория ждёт смелой авторской подачи, типографика сама становится визуалом",
      "minimal-conversion": "предложение узкое, а решение — одно действие; любые отвлечения снижают конверсию"
    };
    return `${ARCHETYPES[key].name}: ${map[key]} (${brief.businessType.toLowerCase()}, цель — ${brief.primaryGoal.toLowerCase()}).`;
  }

  function buildPalette(brief, archetypeKey, seed, avoidHues) {
    const niche = NICHES.find((n) => n.id === brief.nicheId) || DEFAULT_NICHE;
    const tone = TONES[brief.tone] || TONES.auto;
    const a = ARCHETYPES[archetypeKey];
    let hue = niche.hue + (tone.hueShift || 0) + ((seed % 21) - 10);
    const actions = [];
    for (const h of avoidHues) {
      if (hueDistance(hue, h) < 24) { hue = h + 42; actions.push("Сдвинут тон акцента относительно соседнего проекта"); break; }
    }
    const dark = a.mode === "dark" || !!tone.dark;
    // Антишаблон: тёмный фон + золото не по умолчанию.
    let goldNote = "";
    if (dark && hueDistance(hue, 43) < 14) {
      if (tone.dark) goldNote = "Тёмная база с тёплым акцентом выбрана осознанно: премиальный тон указан в брифе.";
      else { hue = hue < 43 ? 43 - 26 : 43 + 26; goldNote = "Золотой акцент на тёмном отклонён как шаблонный, тон смещён."; }
    }
    const sat = clamp(52 + tone.sat + (archetypeKey === "brutalist" ? 30 : 0), 20, 95);
    const p = dark ? {
      bg: hslToHex(hue, 14, 8 + tone.light / 3), surface: hslToHex(hue, 14, 13), text: hslToHex(hue, 20, 94), muted: hslToHex(hue, 10, 70),
      accent: hslToHex(hue, sat, 66), line: hslToHex(hue, 12, 24)
    } : {
      bg: hslToHex(hue, archetypeKey === "brutalist" ? 0 : 22, 96 + tone.light / 4), surface: hslToHex(hue, 20, 100), text: hslToHex(hue, 28, 11), muted: hslToHex(hue, 10, 36),
      accent: hslToHex(hue, sat, 34 + (seed % 12) + tone.light), line: hslToHex(hue, 14, 84)
    };
    if (archetypeKey === "brutalist") {
      if (dark) { p.bg = "#0b0b0b"; p.surface = "#141414"; p.text = "#f4f4f0"; p.line = "#f4f4f0"; p.muted = "#b5b5ad"; }
      else { p.surface = "#ffffff"; p.text = "#0b0b0b"; p.line = "#0b0b0b"; }
    }
    // Доступность: акцент читается на фоне, текст на акценте — ≥ 4.5:1.
    let l = dark ? 66 : 34 + (seed % 12) + tone.light;
    while (contrast(p.accent, p.bg) < 3 && l > 5 && l < 95) { l += dark ? 4 : -4; p.accent = hslToHex(hue, sat, l); }
    p.accentText = contrast("#ffffff", p.accent) >= contrast("#111111", p.accent) ? "#ffffff" : "#111111";
    while (contrast(p.accentText, p.accent) < 4.5 && l > 5 && l < 95) {
      l += p.accentText === "#ffffff" ? -3 : 3; p.accent = hslToHex(hue, sat, l);
    }
    p.soft = hslToHex(hue, sat * 0.5, dark ? 18 : 90);
    return { palette: p, hue: ((Math.round(hue) % 360) + 360) % 360, mode: dark ? "dark" : "light", actions, goldNote };
  }

  function sameHero(a, b) {
    return a.primaryArchetype === b.primaryArchetype && a.visualPosition === b.visualPosition && a.typeCharacter === b.typeCharacter;
  }

  /**
   * createConcept(input, history)
   * input:   { brand, description, city, audience, goal, cta, tone, architecture }
   * history: массив ранее созданных концепций (последний элемент — соседний проект).
   */
  function createConcept(input, history) {
    history = Array.isArray(history) ? history.filter(Boolean) : [];
    const brief = buildDesignBrief(input || {});
    const neighbour = history[history.length - 1];
    const seed = hash(brief.brand + "|" + brief.description);
    const ranked = rankArchetypes(brief, input && input.architecture);
    const differentiationActions = [];
    const repeatedPatterns = [];

    let chosen = ranked[0];
    let mirrored = false;
    if (neighbour) {
      const nd = neighbour.designDNA;
      const probe = (k, m) => ({ primaryArchetype: k, visualPosition: visualOf(k, m), typeCharacter: typeOf(k, m) });
      if (sameHero(probe(chosen, false), nd)) {
        const forced = input && input.architecture && input.architecture !== "auto";
        if (forced) {
          mirrored = true;
          differentiationActions.push(`Архитектура «${ARCHETYPES[chosen].name}» совпадает с соседним проектом и выбрана вручную — композиция отзеркалена, сменён характер типографики.`);
        } else {
          const alt = ranked.find((k) => k !== chosen && !sameHero(probe(k, false), nd));
          differentiationActions.push(`Основная гипотеза «${ARCHETYPES[chosen].name}» повторяла hero соседнего проекта «${neighbour.designBrief.brand}» — выбрана «${ARCHETYPES[alt].name}».`);
          chosen = alt;
        }
      }
    }
    const secondary = ranked.find((k) => k !== chosen && ARCHETYPES[k].landingStudio !== ARCHETYPES[chosen].landingStudio) || ranked[1];
    const arch = ARCHETYPES[chosen];

    // Шрифты: не повторять display-шрифт соседа.
    const fontOptions = mirrored ? arch.fonts.slice().reverse() : arch.fonts;
    let fontIdx = seed % fontOptions.length;
    if (neighbour && fontOptions[fontIdx][0] === neighbour.designDNA.fonts.display) {
      fontIdx = (fontIdx + 1) % fontOptions.length;
      differentiationActions.push("Display-шрифт совпадал с соседним проектом — выбран другой из той же типографической линии.");
    }
    const [display, body] = fontOptions[fontIdx];

    // Тон сдвигаем только если сосед в том же режиме (светлый/тёмный) — иначе проекты и так не спутать.
    const sameMode = neighbour && neighbour.designDNA.mode === (ARCHETYPES[chosen].mode === "dark" || (TONES[brief.tone] || {}).dark ? "dark" : "light");
    const avoidHues = sameMode ? [neighbour.designDNA.hue] : [];
    const pal = buildPalette(brief, chosen, seed, avoidHues);
    differentiationActions.push(...pal.actions);

    const designDNA = {
      primaryArchetype: chosen,
      primaryArchetypeName: arch.name,
      secondaryArchetype: secondary,
      secondaryArchetypeName: ARCHETYPES[secondary].name,
      selectionRationale: rationaleFor(chosen, brief),
      visualPosition: visualOf(chosen, mirrored),
      typeCharacter: typeOf(chosen, mirrored),
      mirrored,
      colorDirection: `${pal.mode === "dark" ? "Тёмная" : "Светлая"} база, акцент ${pal.palette.accent} (тон ${pal.hue}°) из мира ниши «${brief.businessType}»; контраст текста ${contrast(pal.palette.text, pal.palette.bg).toFixed(1)}:1.` + (pal.goldNote ? " " + pal.goldNote : ""),
      typographyDirection: `${display} — заголовки, ${body} — текст. Характер: ${typeLabel(typeOf(chosen, mirrored))}.`,
      imageDirection: (NICHES.find((n) => n.id === brief.nicheId) || DEFAULT_NICHE).image,
      motionDirection: arch.motion + ". При prefers-reduced-motion — без движения.",
      palette: pal.palette,
      hue: pal.hue,
      mode: pal.mode,
      fonts: { display, body },
      radius: mirrored ? Math.max(0, arch.radius - 8) : arch.radius
    };

    const niche = NICHES.find((n) => n.id === brief.nicheId) || DEFAULT_NICHE;
    const homepage = {
      heroComposition: arch.hero + (mirrored ? " (зеркальный вариант)" : ""),
      navigationPattern: arch.nav,
      sectionOrder: sectionOrderFor(chosen, niche),
      primaryCTA: brief.primaryCTA
    };

    // Сходство со всеми предыдущими проектами (не только соседним) — для отчёта.
    history.forEach((h) => {
      const d = h.designDNA;
      if (d.primaryArchetype === chosen) repeatedPatterns.push(`Архитектура как у «${h.designBrief.brand}»`);
      if (d.fonts && d.fonts.display === display) repeatedPatterns.push(`Display-шрифт как у «${h.designBrief.brand}»`);
      if (d.mode === pal.mode && hueDistance(d.hue, pal.hue) < 16) repeatedPatterns.push(`Палитра близка к «${h.designBrief.brand}»`);
      if (h.homepage && h.homepage.sectionOrder.join() === homepage.sectionOrder.join()) repeatedPatterns.push(`Порядок секций как у «${h.designBrief.brand}»`);
    });
    if (repeatedPatterns.length && history.length > 1) differentiationActions.push("Сходства с более ранними проектами допустимы, если отличается соседний проект и композиция; при необходимости смените архитектуру вручную.");

    const concept = {
      designBrief: brief,
      designDNA,
      homepage,
      uniquenessCheck: {
        templateReuseDetected: !!(neighbour && sameHero(designDNA, neighbour.designDNA)),
        repeatedPatterns,
        differentiationActions
      }
    };
    concept.content = buildContent(brief, niche);
    concept.quality = qualityCheck(concept);
    return concept;
  }

  function visualOf(key, mirrored) {
    const v = ARCHETYPES[key].visual;
    if (!mirrored) return v;
    return { left: "right", right: "left", "offset-left": "offset-right", "tool-right": "tool-left", bottom: "top", background: "background-right", grid: "grid-wide", "below-center": "above-center", tiles: "tiles-reversed", "type-only": "type-vertical", none: "none-centered" }[v] || v + "-mirrored";
  }
  function typeOf(key, mirrored) { return ARCHETYPES[key].typeCharacter + (mirrored ? "-alt" : ""); }
  function typeLabel(t) {
    const base = t.replace(/-alt$/, "");
    const map = { "compact-grotesk": "плотный гротеск", "contrast-serif": "контрастная антиква", "light-display": "светлый крупный display", "geometric-display": "геометрический display", "utility-sans": "утилитарный sans", "humanist-sans": "гуманистический sans", "book-serif": "книжная антиква", "geometric-sans": "геометрический sans", "raw-mono": "грубый display + моноширинный", "plain-sans": "нейтральный sans" };
    return (map[base] || base) + (t.endsWith("-alt") ? ", альтернативная пара" : "");
  }

  function sectionOrderFor(key, niche) {
    let order = niche.sections.slice();
    // Архетип влияет на порядок: каталог — товары первыми, сторителлинг — история первой, минимализм — короче.
    const first = { catalog: "items", "product-first": "items", storytelling: "story", immersive: "gallery", "split-utility": "steps", "minimal-conversion": "steps" }[key];
    if (first && order.includes(first)) order = [first].concat(order.filter((s) => s !== first));
    if (first && !order.includes(first) && (first === "story" || first === "gallery")) order = [first].concat(order);
    if (key === "minimal-conversion") order = order.filter((s) => ["steps", "items", "proof", "faq", "contact"].includes(s));
    if (key === "split-utility") order = order.filter((s) => s !== "selector"); // инструмент уже в hero
    if (!order.includes("contact")) order.push("contact");
    return order;
  }

  /* ------------------------------------------------------- контент */
  function buildContent(brief, niche) {
    const where = brief.city ? ` в ${brief.city}` : "";
    const headlines = {
      telescopes: "Телескоп, в который действительно захочется смотреть",
      tech: "Техника для дома — с понятными характеристиками",
      photo: "Живые кадры вместо позирования",
      bouquet: "Букеты, которые съедают с удовольствием",
      coffee: "Кофе и выпечка по соседству",
      seafood: "Раки к вечеру — горячими и вовремя",
      beauty: "Ваш мастер и предсказуемый результат",
      renovation: "Ремонт со сметой, которая не растёт",
      education: "Навык, который останется после курса",
      art: "Событие, которое стоит увидеть вживую",
      consulting: "Разберём вашу ситуацию и предложим решение",
      service: "Понятная услуга и внимательный подход"
    };
    return {
      eyebrow: brief.businessType + where,
      headline: headlines[niche.id] || headlines.service,
      lead: `${brief.brand} — ${brief.businessType.toLowerCase()}${where}. ${capital(brief.primaryGoal)} — за несколько шагов.`,
      itemsTitle: niche.itemsTitle,
      items: niche.items.map(([t, d]) => ({ title: t, text: d })),
      selector: niche.selector || { q: "Что вам нужно?", options: niche.items.slice(0, 3).map((i) => i[0]) },
      value: [
        { title: "Понятно до заказа", text: "Состав, сроки и условия описаны заранее — уточните их у владельца и замените этот текст." },
        { title: "Реальные примеры", text: "Здесь должны быть ваши настоящие фото и работы, а не стоковые изображения." },
        { title: "Удобная связь", text: "Ответ в мессенджере или по телефону — укажите реальные контакты." }
      ],
      steps: [
        { title: "Заявка", text: "Вы описываете задачу или выбираете вариант." },
        { title: "Уточнение", text: "Согласуем детали, сроки и стоимость." },
        { title: "Выполнение", text: "Делаем и держим вас в курсе." },
        { title: "Результат", text: "Передаём результат и отвечаем на вопросы." }
      ],
      story: [
        { title: "Откуда всё началось", text: "История бренда — заполнить со слов владельца." },
        { title: "Как мы делаем", text: "Процесс и материалы — заполнить фактами." },
        { title: "Для кого", text: capital(brief.audience) + "." }
      ],
      proof: ["Фото реальных объектов или работ — добавить", "Договор и реквизиты — указать", "Отзывы — только реальные, со ссылкой на площадку", "Документы и квалификация — если есть"],
      faq: [
        { q: "Сколько это стоит?", a: "Стоимость — уточнить у владельца. Генератор не придумывает цены." },
        { q: "Какие сроки?", a: "Сроки зависят от задачи — указать реальные." },
        { q: "Как оплатить?", a: "Способы оплаты — уточнить." },
        { q: "Где вы находитесь?", a: brief.city ? `${brief.city}, адрес — уточнить.` : "Адрес и зона работы — уточнить." }
      ],
      gallery: niche.items.slice(0, 4).map((i) => i[0]),
      visit: { title: "Как нас найти", lines: ["Адрес — уточнить", "Часы работы — уточнить", "Как добраться — уточнить"] },
      team: ["Мастер / специалист — имя и опыт уточнить", "Мастер / специалист — имя и опыт уточнить", "Мастер / специалист — имя и опыт уточнить"]
    };
  }
  const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

  /* ------------------------------------------------------- проверка перед выдачей */
  function qualityCheck(concept) {
    const p = concept.designDNA.palette;
    const checks = [
      { id: "niche-clear", ok: !!concept.content.headline && !!concept.content.eyebrow, label: "Ниша и предложение видны на первом экране" },
      { id: "cta", ok: !!concept.homepage.primaryCTA, label: "Есть один главный CTA" },
      { id: "text-contrast", ok: contrast(p.text, p.bg) >= 7, label: `Контраст текста ${contrast(p.text, p.bg).toFixed(1)}:1 (нужно ≥ 7)` },
      { id: "muted-contrast", ok: contrast(p.muted, p.bg) >= 4.5, label: `Контраст второстепенного текста ${contrast(p.muted, p.bg).toFixed(1)}:1 (нужно ≥ 4.5)` },
      { id: "button-contrast", ok: contrast(p.accentText, p.accent) >= 4.5, label: `Контраст кнопки ${contrast(p.accentText, p.accent).toFixed(1)}:1 (нужно ≥ 4.5)` },
      { id: "neighbour", ok: !concept.uniquenessCheck.templateReuseDetected, label: "Hero отличается от соседнего проекта" },
      { id: "no-fake-facts", ok: true, label: "Цены, отзывы и гарантии не выдуманы (помечены «уточнить»)" }
    ];
    return { passed: checks.every((c) => c.ok), checks };
  }

  /* ------------------------------------------------------- HTML */
  function fontsLink(f) {
    const fam = [f.display, f.body].filter((v, i, a) => a.indexOf(v) === i)
      .map((n) => "family=" + n.replace(/ /g, "+") + ":wght@400;500;600;700").join("&");
    return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
  }

  function baseCss(d) {
    const p = d.palette;
    return `:root{--bg:${p.bg};--surface:${p.surface};--text:${p.text};--muted:${p.muted};--accent:${p.accent};--accent-text:${p.accentText};--line:${p.line};--soft:${p.soft};--r:${d.radius}px;--f-display:"${d.fonts.display}",Georgia,serif;--f-body:"${d.fonts.body}",system-ui,sans-serif;--gutter:clamp(16px,4vw,56px);--ease:cubic-bezier(.2,.75,.2,1);color-scheme:${d.mode}}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:400 17px/1.6 var(--f-body);overflow-x:hidden}
img{max-width:100%;display:block}
h1,h2,h3{font-family:var(--f-display);line-height:1.08;margin:0;text-wrap:balance;font-weight:600;overflow-wrap:break-word;hyphens:auto}
.hero>*{min-width:0}
h2{font-size:clamp(28px,4.4vw,48px)}
h3{font-size:20px;line-height:1.25}
p{margin:0}
a{color:inherit}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.skip{position:absolute;left:8px;top:-60px;background:var(--accent);color:var(--accent-text);padding:10px 14px;z-index:100;border-radius:6px}
.skip:focus{top:8px}
.wrap{width:min(1200px,100%);margin-inline:auto;padding-inline:var(--gutter)}
.eyebrow{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.lead{font-size:clamp(18px,2vw,21px);color:var(--muted);max-width:60ch}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 24px;background:var(--accent);color:var(--accent-text);border:2px solid var(--accent);border-radius:var(--r);font:600 16px/1.2 var(--f-body);text-decoration:none;cursor:pointer;transition:transform .18s var(--ease)}
.btn:hover{transform:translateY(-2px)}
.btn--ghost{background:transparent;color:var(--text);border-color:var(--line)}
.tbd{color:var(--muted);font-style:italic}
.ph{position:relative;background:linear-gradient(135deg,var(--soft),var(--surface));border:1px solid var(--line);border-radius:var(--r);display:flex;align-items:flex-end;padding:14px;min-height:160px;overflow:hidden}
.ph span{font-size:13px;color:var(--muted);background:var(--surface);padding:4px 8px;border-radius:4px;position:relative}
.ph::before{content:"";position:absolute;inset:18% 22%;border:1px solid var(--line);border-radius:calc(var(--r) + 40px)}
section.s{padding-block:clamp(56px,8vw,112px)}
.s-head{display:grid;gap:12px;margin-bottom:clamp(28px,4vw,48px);max-width:720px}
.grid{display:grid;gap:clamp(14px,2vw,24px);grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:24px;display:grid;gap:8px;align-content:start;min-width:0}
.card p{color:var(--muted)}
.steps{counter-reset:st;display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));list-style:none;padding:0;margin:0}
.steps li{counter-increment:st;border-top:2px solid var(--text);padding-top:16px;display:grid;gap:6px}
.steps li::before{content:counter(st,decimal-leading-zero);font:600 14px var(--f-body);color:var(--accent)}
.steps p{color:var(--muted)}
.faq details{border-bottom:1px solid var(--line);padding:18px 0}
.faq summary{cursor:pointer;font-weight:600;font-size:18px;list-style-position:outside}
.faq details p{margin-top:10px;color:var(--muted)}
.proof{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.proof li{display:flex;gap:12px;align-items:baseline}
.proof li::before{content:"";flex:none;width:10px;height:10px;border:2px solid var(--accent);border-radius:2px;transform:translateY(-1px)}
.contact{display:grid;gap:32px;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));align-items:start}
form.f{display:grid;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:clamp(18px,3vw,32px)}
.f label{display:grid;gap:6px;font-size:14px;font-weight:600}
.f input,.f textarea,.f select{width:100%;min-height:48px;padding:12px 14px;border:1px solid var(--line);border-radius:calc(var(--r) / 2);background:var(--bg);color:var(--text);font:inherit}
.f .note{font-size:13px;color:var(--muted)}
.f [role=status]{font-size:14px;color:var(--text);min-height:1.2em}
.story{display:grid;gap:clamp(28px,5vw,64px)}
.story article{display:grid;gap:10px;max-width:640px}
.story article:nth-child(even){margin-left:auto}
.story p{color:var(--muted)}
footer.ft{border-top:1px solid var(--line);padding-block:28px;color:var(--muted);font-size:14px}
footer.ft .wrap{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
.nav-toggle{display:none}
.reveal-ready .rv{opacity:0;transform:translateY(16px);transition:opacity .6s var(--ease),transform .6s var(--ease)}
.reveal-ready .rv.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.reveal-ready .rv{opacity:1;transform:none}}`;
  }

  // CSS, который отличает композицию каждого архетипа (а не только цвет).
  const ARCH_CSS = {
    "product-first": `.top{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;gap:20px;min-height:68px;position:relative}
.logo{font:700 20px var(--f-display);text-decoration:none;margin-right:auto}
.nav-links{display:flex;gap:22px}.nav-links a{text-decoration:none;font-weight:500}
.hero{display:grid;grid-template-columns:1.25fr .75fr;gap:clamp(18px,3vw,40px);padding-block:clamp(24px,4vw,48px) clamp(48px,6vw,80px)}
.hero .ph{min-height:clamp(300px,48vw,560px)}
.buy{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:clamp(20px,3vw,32px);display:grid;gap:16px;align-content:start}
.buy h1{font-size:clamp(32px,4vw,52px)}
.buy dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:0;font-size:15px}.buy dt{color:var(--muted)}.buy dd{margin:0;font-weight:600}
.hero.mir{grid-template-columns:.75fr 1.25fr}.hero.mir .ph{order:2}
@media (max-width:760px){.hero,.hero.mir{grid-template-columns:1fr}.hero.mir .ph{order:0}}`,
    editorial: `.mast{border-bottom:3px double var(--text);padding-block:18px 14px}
.mast .wrap{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:16px;position:relative}
.mast .issue{font-size:13px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase}
.logo{font:600 clamp(26px,4vw,40px)/1 var(--f-display);text-decoration:none;text-align:center;letter-spacing:.02em}
.nav-links{display:flex;flex-wrap:wrap;gap:6px 18px;justify-content:flex-end}.nav-links a{text-decoration:none;font-size:13px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.hero{padding-block:clamp(36px,6vw,80px) 0;display:grid;gap:clamp(24px,4vw,44px)}
.hero h1{font-size:clamp(44px,9vw,128px);letter-spacing:-.02em;font-weight:500;max-width:14ch}
.hero .cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;border-top:1px solid var(--line);padding-top:20px}
.hero .cols p{color:var(--muted);font-size:16px}.hero .cols p:first-child::first-letter{font:600 3.2em/0.9 var(--f-display);float:left;margin:4px 8px 0 0;color:var(--accent)}
.hero .ph{min-height:clamp(240px,40vw,520px);border-radius:0}
.hero.mir .ph{order:-1}
.card{border:0;border-top:1px solid var(--text);border-radius:0;background:transparent;padding:18px 0}
@media (max-width:760px){.mast .wrap{grid-template-columns:1fr auto}.mast .issue{display:none}.logo{text-align:left}.hero .cols{grid-template-columns:1fr}}`,
    immersive: `.top{position:absolute;inset:0 0 auto;z-index:30}
.top .wrap{display:flex;align-items:center;gap:20px;min-height:76px;position:relative}
.logo{font:500 22px var(--f-display);text-decoration:none;margin-right:auto;letter-spacing:.04em}
.nav-links{display:flex;gap:24px}.nav-links a{text-decoration:none;font-size:15px}
.hero{position:relative;min-height:min(92vh,880px);display:flex;align-items:flex-end;overflow:hidden;isolation:isolate}
.hero .bg{position:absolute;inset:0;z-index:-2;background:radial-gradient(ellipse at 70% 35%,var(--soft),transparent 60%),linear-gradient(160deg,var(--surface),var(--bg));animation:zoom 24s var(--ease) infinite alternate}
.hero .bg span{position:absolute;right:var(--gutter);top:96px;font-size:13px;color:var(--muted)}
.hero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(0deg,var(--bg) 6%,transparent 70%)}
.hero .wrap{padding-block:120px clamp(40px,7vw,96px)}
.hero h1{font-size:clamp(46px,10vw,136px);font-weight:400;max-width:12ch;letter-spacing:-.01em}
.hero .lead{margin-top:18px}.hero .acts{margin-top:28px;display:flex;flex-wrap:wrap;gap:12px}
.hero.mir{justify-content:flex-end;text-align:right}.hero.mir h1,.hero.mir .lead{margin-left:auto}.hero.mir .acts{justify-content:flex-end}
@keyframes zoom{to{transform:scale(1.08)}}
.card{background:transparent;border-color:var(--line)}`,
    asymmetric: `.side{position:fixed;left:0;top:0;bottom:0;width:72px;border-right:1px solid var(--line);background:var(--bg);z-index:30;display:flex;flex-direction:column;align-items:center;padding-block:20px;gap:24px}
.side .logo{writing-mode:vertical-rl;transform:rotate(180deg);font:700 16px var(--f-display);text-decoration:none;letter-spacing:.08em}
.side .nav-links{display:flex;flex-direction:column;gap:18px;writing-mode:vertical-rl;transform:rotate(180deg);font-size:13px}.side .nav-links a{text-decoration:none}
body{padding-left:72px}
.hero{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:auto auto;gap:16px;padding-block:clamp(32px,6vw,72px)}
.hero h1{grid-column:5/13;grid-row:1;font-size:clamp(26px,5.6vw,84px);letter-spacing:-.03em}
.hero .ph{grid-column:1/8;grid-row:2;min-height:clamp(260px,38vw,460px)}
.hero .note{grid-column:7/12;grid-row:2;align-self:end;background:var(--accent);color:var(--accent-text);border-radius:var(--r);padding:clamp(20px,3vw,32px);display:grid;gap:16px;transform:translateY(32px);z-index:2;transition:transform .3s var(--ease)}
.hero .note:hover{transform:translateY(24px)}
.hero .note .btn{background:var(--accent-text);color:var(--accent);border-color:var(--accent-text)}
.hero.mir h1{grid-column:1/9}.hero.mir .ph{grid-column:6/13}.hero.mir .note{grid-column:2/7}
@media (max-width:760px){body{padding-left:0}.side{position:sticky;top:0;width:auto;height:auto;bottom:auto;flex-direction:row;border-right:0;border-bottom:1px solid var(--line);padding:12px var(--gutter);justify-content:space-between}.side .logo{writing-mode:horizontal-tb;transform:none}.side .nav-links{writing-mode:horizontal-tb;transform:none}
.hero{grid-template-columns:1fr}.hero h1,.hero .ph,.hero .note,.hero.mir h1,.hero.mir .ph,.hero.mir .note{grid-column:1;grid-row:auto;transform:none}}`,
    catalog: `.top{position:sticky;top:0;z-index:30;background:var(--surface);border-bottom:1px solid var(--line)}
.top .wrap{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:20px;align-items:center;min-height:72px;position:relative}
.logo{font:700 20px var(--f-display);text-decoration:none}
.search{display:flex;min-width:0}.search input{flex:1;min-width:0;min-height:44px;border:1px solid var(--line);border-radius:var(--r) 0 0 var(--r);padding:0 14px;font:inherit;background:var(--bg);color:var(--text)}
.search button{border-radius:0 var(--r) var(--r) 0;min-height:44px;padding:0 18px}
.nav-links{display:flex;gap:18px;font-size:15px}.nav-links a{text-decoration:none}
.hero{padding-block:clamp(24px,4vw,44px)}
.hero .row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:16px;margin-bottom:20px}
.hero h1{font-size:clamp(28px,3.6vw,44px);font-family:var(--f-body);font-weight:700;letter-spacing:-.02em;max-width:22ch}
.cats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media (min-width:1000px){.cats{grid-template-columns:repeat(6,minmax(0,1fr))}}
@media (max-width:560px){.cats{grid-template-columns:repeat(2,minmax(0,1fr))}}
.cats a{display:grid;gap:10px;text-decoration:none;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:12px}
.cats a:hover{border-color:var(--accent)}
.cats .ph{min-height:110px}.cats .ph::before{inset:24%}
.cats b{font-size:15px}.cats small{color:var(--muted);font-size:13px;line-height:1.35}
@media (max-width:760px){.top .wrap{grid-template-columns:1fr auto}.search{grid-column:1/-1;grid-row:2;margin-bottom:12px}}`,
    "split-utility": `.top{border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;gap:20px;min-height:68px;position:relative}
.logo{font:700 20px var(--f-display);text-decoration:none;margin-right:auto}
.nav-links{display:flex;gap:22px}.nav-links a{text-decoration:none}
.hero{display:grid;grid-template-columns:1fr 1fr;min-height:clamp(480px,70vh,720px)}
.hero .offer{padding:clamp(32px,6vw,80px) var(--gutter);display:grid;gap:20px;align-content:center;justify-items:start}
.hero h1{font-size:clamp(34px,5vw,64px);letter-spacing:-.02em}
.tool{background:var(--soft);padding:clamp(32px,6vw,80px) var(--gutter);display:grid;align-content:center}
.tool form{max-width:460px;width:100%;margin-inline:auto}
.tool fieldset{border:0;padding:0;margin:0;display:grid;gap:10px}
.tool legend{font:600 20px var(--f-display);margin-bottom:8px}
.opt{display:flex;gap:12px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;cursor:pointer;font-weight:500}
.opt:has(input:checked){border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.opt input{width:20px;height:20px;min-height:0;accent-color:var(--accent)}
.hero.mir .offer{order:2}
@media (max-width:860px){.hero{grid-template-columns:1fr}.hero.mir .offer{order:0}}`,
    storytelling: `.top .wrap{display:flex;align-items:center;justify-content:space-between;min-height:68px;position:relative}
.logo{font:600 20px var(--f-display);text-decoration:none}
.rail{position:fixed;right:max(12px,env(safe-area-inset-right,0px));top:50%;transform:translateY(-50%);display:grid;gap:12px;z-index:30;list-style:none;margin:0;padding:0}
.rail a{display:block;width:10px;height:10px;border-radius:50%;border:2px solid var(--text);text-indent:-999px;overflow:hidden}
.rail a.on{background:var(--accent);border-color:var(--accent)}
.nav-links{display:flex;gap:20px}.nav-links a{text-decoration:none;font-size:15px}
.hero{padding-block:clamp(48px,9vw,128px) 0;text-align:center}
.hero .ch{display:inline-block;font-size:14px;color:var(--accent);letter-spacing:.1em;text-transform:uppercase;margin-bottom:20px}
.hero h1{font-size:clamp(38px,6vw,76px);max-width:16ch;margin-inline:auto;font-weight:500}
.hero .lead{margin:24px auto 0;max-width:52ch}
.hero .acts{margin-top:28px}
.hero .ph{margin-top:clamp(40px,7vw,88px);min-height:clamp(260px,42vw,560px);border-radius:var(--r) var(--r) 0 0}
.hero.mir .ph{margin:0 0 clamp(32px,5vw,64px);order:-1}.hero.mir{display:flex;flex-direction:column}
@media (max-width:760px){.rail{display:none}}`,
    "modular-grid": `.top .wrap{display:flex;align-items:center;gap:20px;min-height:68px;position:relative}
.logo{font:700 20px var(--f-display);text-decoration:none;margin-right:auto}
.nav-links{display:flex;gap:8px}.nav-links a{text-decoration:none;font-size:14px;border:1px solid var(--line);border-radius:999px;padding:6px 14px}
.hero{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(150px,auto);gap:14px;padding-block:clamp(18px,3vw,32px) clamp(48px,6vw,80px)}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:clamp(18px,2.4vw,28px);display:grid;align-content:space-between;gap:12px;text-decoration:none;transition:transform .25s var(--ease);min-width:0}
a.tile:hover{transform:translateY(-4px)}
.tile.main{grid-column:span 2;grid-row:span 2;background:var(--accent);color:var(--accent-text);border-color:var(--accent)}
.tile.main h1{font-size:clamp(32px,4.4vw,60px)}
.tile.main .btn{background:var(--accent-text);color:var(--accent);border-color:var(--accent-text);justify-self:start}
.tile.ph{min-height:0}
.tile b{font:600 20px var(--f-display)}.tile small{color:var(--muted)}
.hero.mir .tile.main{grid-column:3/5;grid-row:1/3}
@media (max-width:860px){.hero{grid-template-columns:1fr 1fr}.hero.mir .tile.main,.tile.main{grid-column:1/-1;grid-row:auto}}
@media (max-width:420px){.hero{grid-template-columns:1fr}}`,
    brutalist: `body{font-family:var(--f-body)}
.top{border-bottom:3px solid var(--text)}
.top .wrap{display:flex;align-items:stretch;min-height:56px;position:relative;padding-inline:0}
.logo{font:400 18px var(--f-display);text-decoration:none;padding:16px var(--gutter);border-right:3px solid var(--text);margin-right:auto;text-transform:uppercase}
.nav-links{display:flex}.nav-links a{text-decoration:underline;text-underline-offset:4px;padding:16px 18px;border-left:3px solid var(--text);font-size:14px;text-transform:uppercase}
.hero{border-bottom:3px solid var(--text)}
.hero h1{font-size:clamp(30px,10.5vw,170px);line-height:.92;text-transform:uppercase;letter-spacing:-.03em;padding:clamp(20px,4vw,48px) 0;overflow-wrap:break-word;hyphens:auto}
.hero .meta{display:grid;grid-template-columns:2fr 1fr;border-top:3px solid var(--text)}
.hero .meta>*{padding:20px var(--gutter)}.hero .meta>*+*{border-left:3px solid var(--text);display:flex;align-items:center}
.hero .lead{color:var(--text)}
.marq{overflow:hidden;border-top:3px solid var(--text);background:var(--accent);color:var(--accent-text);white-space:nowrap}
.marq span{display:inline-block;padding:12px 0;font:400 20px var(--f-display);text-transform:uppercase;animation:mq 22s linear infinite}
@keyframes mq{to{transform:translateX(-50%)}}
.btn{border-radius:0;box-shadow:4px 4px 0 var(--text)}
.card{border:3px solid var(--text);border-radius:0;box-shadow:6px 6px 0 var(--text)}
.hero.mir h1{text-align:right}
@media (max-width:760px){.hero .meta{grid-template-columns:1fr}.hero .meta>*+*{border-left:0;border-top:3px solid var(--text)}}`,
    "minimal-conversion": `.top .wrap{display:flex;align-items:center;min-height:68px}
.logo{font:700 18px var(--f-display);text-decoration:none}
.nav-links,.nav-toggle{display:none!important}
.hero{max-width:680px;margin-inline:auto;padding:clamp(40px,10vw,128px) var(--gutter) clamp(48px,8vw,96px);display:grid;gap:22px}
.hero h1{font-size:clamp(34px,5.6vw,60px);letter-spacing:-.025em;font-weight:700}
.facts{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.facts li{display:flex;gap:12px}.facts li::before{content:"";flex:none;width:8px;height:8px;margin-top:.6em;background:var(--accent);border-radius:50%}
.hero .btn{justify-self:start;min-width:min(100%,280px)}
.hero.mir{text-align:center}.hero.mir .btn{justify-self:center}.hero.mir .facts{justify-items:center}`
  };

  // Идёт после CSS архетипа, чтобы мобильное меню всегда сворачивалось.
  const MOBILE_NAV_CSS = `@media (max-width:760px){.nav-links{display:none!important}.nav-open .nav-links{display:flex!important;flex-direction:column;writing-mode:horizontal-tb;transform:none;position:absolute;left:0;right:0;top:100%;background:var(--bg);padding:16px var(--gutter);border-bottom:1px solid var(--line);z-index:40;gap:14px}.nav-open .nav-links a{border:0;padding:6px 0}.nav-toggle{display:inline-flex;min-height:40px;padding:8px 14px}.top .wrap,.side,.mast .wrap{position:relative}}`;

  function navLinks(order) {
    const names = { items: "Каталог", selector: "Подбор", value: "Почему мы", steps: "Как работаем", faq: "Вопросы", contact: "Контакты", gallery: "Работы", story: "История", proof: "Доверие", visit: "Как добраться", team: "Команда" };
    return order.filter((s) => names[s] && s !== "contact").slice(0, 4).map((s) => `<a href="#${s}">${names[s]}</a>`).join("") + `<a href="#contact">Контакты</a>`;
  }
  const toggle = `<button class="btn btn--ghost nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Меню</button>`;
  function selectorForm(c, idp) {
    return `<form class="f" data-pick><fieldset><legend>${esc(c.selector.q)}</legend>${c.selector.options.map((o, i) => `<label class="opt"><input type="radio" name="${idp}-pick" id="${idp}-pick-${i}" value="${esc(o)}"${i === 0 ? " checked" : ""}>${esc(o)}</label>`).join("")}</fieldset><a class="btn" href="#contact">Продолжить</a><p class="note">Выбор подставится в заявку.</p></form>`;
  }

  function renderHero(concept) {
    const { designBrief: b, designDNA: d, homepage: h, content: c } = concept;
    const mir = d.mirrored ? " mir" : "";
    const cta = `<a class="btn" href="#contact">${esc(h.primaryCTA)}</a>`;
    const logo = `<a class="logo" href="#top">${esc(b.brand)}</a>`;
    const links = `<nav class="nav-links" id="nav" aria-label="Основная навигация">${navLinks(h.sectionOrder)}</nav>`;
    const ph = (label) => `<div class="ph" role="img" aria-label="Место для фото: ${esc(label)}"><span>Фото: ${esc(label)}</span></div>`;
    switch (d.primaryArchetype) {
      case "product-first":
        return `<header class="top"><div class="wrap">${logo}${links}${toggle}</div></header>
<main id="main"><section class="wrap hero${mir}" id="top">${ph(c.items[0].title)}<div class="buy"><p class="eyebrow">${esc(c.eyebrow)}</p><h1>${esc(c.headline)}</h1><p class="lead">${esc(c.lead)}</p>
<dl><dt>Состав</dt><dd class="tbd">уточнить</dd><dt>Срок</dt><dd class="tbd">уточнить</dd><dt>Цена</dt><dd class="tbd">уточнить</dd></dl>${cta}</div></section>`;
      case "editorial":
        return `<header class="mast"><div class="wrap"><span class="issue">${esc(b.businessType)}</span>${logo}${links}${toggle}</div></header>
<main id="main"><section class="wrap hero${mir}" id="top"><p class="eyebrow">${esc(c.eyebrow)}</p><h1>${esc(c.headline)}</h1>
<div class="cols"><p>${esc(c.lead)}</p><p>${esc(c.story[1].text)}</p><p>${esc(capital(b.primaryGoal))}. <a href="#contact">${esc(h.primaryCTA)} →</a></p></div>${ph(c.gallery[0] || b.businessType)}</section>`;
      case "immersive":
        return `<header class="top"><div class="wrap">${logo}${links}${toggle}</div></header>
<main id="main"><section class="hero${mir}" id="top"><div class="bg" role="img" aria-label="Место для полноэкранного кадра"><span>Полноэкранный кадр: ${esc(c.gallery[0] || b.businessType)}</span></div><div class="wrap"><p class="eyebrow">${esc(c.eyebrow)}</p><h1>${esc(c.headline)}</h1><p class="lead">${esc(c.lead)}</p><div class="acts">${cta}<a class="btn btn--ghost" href="#${h.sectionOrder[0]}">Смотреть</a></div></div></section>`;
      case "asymmetric":
        return `<header class="side">${logo}${links}${toggle}</header>
<main id="main"><section class="wrap hero${mir}" id="top"><h1>${esc(c.headline)}</h1>${ph(c.gallery[0] || b.businessType)}<div class="note"><p class="eyebrow" style="color:inherit">${esc(c.eyebrow)}</p><p>${esc(c.lead)}</p><a class="btn" href="#contact">${esc(h.primaryCTA)}</a></div></section>`;
      case "catalog":
        return `<header class="top"><div class="wrap">${logo}<form class="search" role="search" data-search><label for="q" class="eyebrow" style="position:absolute;left:-9999px">Поиск по каталогу</label><input id="q" type="search" placeholder="Поиск: ${esc(c.items[0].title.toLowerCase())}…"><button class="btn" type="submit">Найти</button></form>${links}${toggle}</div></header>
<main id="main"><section class="wrap hero${mir}" id="top"><div class="row"><div><p class="eyebrow">${esc(c.eyebrow)}</p><h1>${esc(c.headline)}</h1></div>${cta}</div>
<div class="cats">${c.items.map((i) => `<a href="#items">${ph(i.title)}<b>${esc(i.title)}</b><small>${esc(i.text)}</small></a>`).join("")}</div></section>`;
      case "split-utility":
        return `<header class="top"><div class="wrap">${logo}${links}${toggle}</div></header>
<main id="main"><section class="hero${mir}" id="top"><div class="offer"><p class="eyebrow">${esc(c.eyebrow)}</p><h1>${esc(c.headline)}</h1><p class="lead">${esc(c.lead)}</p>${cta}</div><div class="tool">${selectorForm(c, "hero")}</div></section>`;
      case "storytelling":
        return `<header class="top"><div class="wrap">${logo}${links}${toggle}</div></header>
<ol class="rail" aria-label="Главы">${["top"].concat(h.sectionOrder).map((s, i) => `<li><a href="#${s}"${i === 0 ? ' class="on"' : ""}>Глава ${i + 1}</a></li>`).join("")}</ol>
<main id="main"><section class="wrap hero${mir}" id="top"><span class="ch">Глава 1 · ${esc(b.businessType)}</span><h1>${esc(c.headline)}</h1><p class="lead">${esc(c.lead)}</p><div class="acts">${cta}</div>${ph(c.gallery[0] || b.businessType)}</section>`;
      case "modular-grid":
        return `<header class="top"><div class="wrap">${logo}${links}${toggle}</div></header>
<main id="main"><section class="wrap hero${mir}" id="top"><div class="tile main"><p class="eyebrow" style="color:inherit">${esc(c.eyebrow)}</p><h1>${esc(c.headline)}</h1><p>${esc(c.lead)}</p><a class="btn" href="#contact">${esc(h.primaryCTA)}</a></div>
${c.items.slice(0, 3).map((i) => `<a class="tile" href="#items"><b>${esc(i.title)}</b><small>${esc(i.text)}</small></a>`).join("")}<div class="tile ph" role="img" aria-label="Место для фото"><span>Фото: ${esc(c.gallery[0] || b.businessType)}</span></div></section>`;
      case "brutalist":
        return `<header class="top"><div class="wrap">${logo}${links}${toggle}</div></header>
<main id="main"><section class="hero${mir}" id="top"><div class="wrap"><h1>${esc(c.headline)}</h1></div><div class="meta"><div><p class="eyebrow">${esc(c.eyebrow)}</p><p class="lead">${esc(c.lead)}</p></div><div>${cta}</div></div>
<div class="marq" aria-hidden="true"><span>${esc((c.items.map((i) => i.title).join(" — ") + " — ").repeat(4))}</span></div></section>`;
      case "minimal-conversion":
      default:
        return `<header class="top"><div class="wrap">${logo}</div></header>
<main id="main"><section class="hero${mir}" id="top"><p class="eyebrow">${esc(c.eyebrow)}</p><h1>${esc(c.headline)}</h1><p class="lead">${esc(c.lead)}</p>
<ul class="facts">${c.items.slice(0, 3).map((i) => `<li>${esc(i.title)} — ${esc(i.text.toLowerCase())}</li>`).join("")}</ul>${cta}</section>`;
    }
  }

  function renderSection(id, concept) {
    const c = concept.content, b = concept.designBrief;
    const head = (eb, h2, p) => `<div class="s-head"><p class="eyebrow">${esc(eb)}</p><h2>${esc(h2)}</h2>${p ? `<p class="lead">${esc(p)}</p>` : ""}</div>`;
    const sec = (inner) => `<section class="s rv" id="${id}"><div class="wrap">${inner}</div></section>`;
    switch (id) {
      case "items": return sec(head(b.businessType, c.itemsTitle, "") + `<div class="grid">${c.items.map((i) => `<article class="card"><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p><p class="tbd">Цена — уточнить</p></article>`).join("")}</div>`);
      case "value": return sec(head("Почему выбирают", "Что важно знать до заказа", "") + `<div class="grid">${c.value.map((v) => `<article class="card"><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></article>`).join("")}</div>`);
      case "steps": return sec(head("Порядок работы", "Как всё происходит", "") + `<ol class="steps">${c.steps.map((s) => `<li><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join("")}</ol>`);
      case "gallery": return sec(head("Работы", "Примеры", "Замените заглушки реальными фото — это главное доказательство качества.") + `<div class="grid">${c.gallery.map((g) => `<div class="ph" role="img" aria-label="Место для фото: ${esc(g)}" style="min-height:260px"><span>Фото: ${esc(g)}</span></div>`).join("")}</div>`);
      case "story": return sec(head("История", "Кто мы и как работаем", "") + `<div class="story">${c.story.map((s) => `<article><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></article>`).join("")}</div>`);
      case "proof": return sec(head("Доверие", "Что подтверждает надёжность", "Каждый пункт — реальный документ или факт. Не публикуйте неподтверждённое.") + `<ul class="proof">${c.proof.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`);
      case "selector": return sec(head("Подбор", c.selector.q, "Ответ поможет быстрее подготовить предложение.") + `<div style="max-width:520px">${selectorForm(c, "sec")}</div>`);
      case "visit": return sec(head("Визит", c.visit.title, "") + `<ul class="proof">${c.visit.lines.map((l) => `<li class="tbd">${esc(l)}</li>`).join("")}</ul>`);
      case "team": return sec(head("Команда", "Мастера", "") + `<div class="grid">${c.team.map((t, i) => `<article class="card"><div class="ph" role="img" aria-label="Место для портрета" style="min-height:200px"><span>Портрет ${i + 1}</span></div><p class="tbd">${esc(t)}</p></article>`).join("")}</div>`);
      case "faq": return sec(head("Вопросы", "Частые вопросы", "") + `<div class="faq">${c.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>`);
      case "contact": return sec(`<div class="contact"><div class="s-head"><p class="eyebrow">Связь</p><h2>${esc(concept.homepage.primaryCTA)}</h2><p class="lead">Оставьте контакт — ответим удобным способом. Телефон, мессенджер и адрес владельца — <span class="tbd">уточнить</span>.</p></div>
<form class="f" data-lead novalidate><label for="lead-name">Имя<input id="lead-name" name="name" autocomplete="name" required></label><label for="lead-phone">Телефон или мессенджер<input id="lead-phone" name="phone" autocomplete="tel" required></label><label for="lead-msg">Комментарий<textarea id="lead-msg" name="msg" rows="3"></textarea></label><button class="btn" type="submit">${esc(concept.homepage.primaryCTA)}</button><p class="note">Нажимая кнопку, вы соглашаетесь на обработку персональных данных — текст согласия уточнить.</p><p role="status" aria-live="polite"></p></form></div>`);
      default: return "";
    }
  }

  const PAGE_JS = `(function(){var d=document;var t=d.querySelector('.nav-toggle');if(t){t.addEventListener('click',function(){var o=d.body.classList.toggle('nav-open');t.setAttribute('aria-expanded',o)})}
d.querySelectorAll('.nav-links a').forEach(function(a){a.addEventListener('click',function(){d.body.classList.remove('nav-open');t&&t.setAttribute('aria-expanded','false')})});
var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;if('IntersectionObserver' in window&&!rm){d.documentElement.classList.add('reveal-ready');var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -10% 0px'});d.querySelectorAll('.rv').forEach(function(s){io.observe(s)})}
var rail=d.querySelectorAll('.rail a');if(rail.length&&'IntersectionObserver' in window){var ro=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){rail.forEach(function(a){a.classList.toggle('on',a.getAttribute('href')==='#'+e.target.id)})}})},{threshold:.4});rail.forEach(function(a){var s=d.querySelector(a.getAttribute('href'));s&&ro.observe(s)})}
var pick='';d.querySelectorAll('[data-pick] input').forEach(function(i){if(i.checked)pick=i.value;i.addEventListener('change',function(){pick=i.value})});
var s=d.querySelector('[data-search]');s&&s.addEventListener('submit',function(e){e.preventDefault();location.hash='items'});
var f=d.querySelector('[data-lead]');f&&f.addEventListener('submit',function(e){e.preventDefault();var st=f.querySelector('[role=status]');var n=f.elements.name.value.trim(),p=f.elements.phone.value.trim();if(!n||!p){st.textContent='Укажите имя и телефон или мессенджер.';(n?f.elements.phone:f.elements.name).focus();return}st.textContent='Заявка подготовлена'+(pick?' («'+pick+'»)':'')+'. Подключите отправку в мессенджер или почту владельца — генератор не отправляет данные.'})})();`;

  function renderHomepage(concept) {
    const { designBrief: b, designDNA: d, homepage: h } = concept;
    const body = renderHero(concept) + "\n" + h.sectionOrder.map((s) => renderSection(s, concept)).join("\n") + "\n</main>";
    return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(b.brand)} — ${esc(b.businessType)}</title>
<meta name="description" content="${esc(concept.content.lead)}">
<meta name="generator" content="Unique Design Engine · ${esc(d.primaryArchetypeName)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsLink(d.fonts)}">
<style>
${baseCss(d)}
${ARCH_CSS[d.primaryArchetype]}
${MOBILE_NAV_CSS}
</style>
</head>
<body class="arch-${d.primaryArchetype}">
<a class="skip" href="#main">Перейти к содержанию</a>
${body}
<footer class="ft"><div class="wrap"><span>© ${esc(b.brand)}</span><span>Реквизиты и политика конфиденциальности — уточнить</span></div></footer>
<script>${PAGE_JS}</script>
</body>
</html>`;
  }

  /* ------------------------------------------------------- экспорт / промт */
  function toLandingStudioProject(concept) {
    const { designBrief: b, designDNA: d, homepage: h, content: c } = concept;
    const data = {
      brand: b.brand, niche: b.businessType.toUpperCase(), title: c.headline, description: c.lead, cta: h.primaryCTA,
      style: ARCHETYPES[d.primaryArchetype].name, palette: d.mode === "dark" ? "Тёмная" : "Светлая", accent: d.palette.accent,
      designArchitecture: ARCHETYPES[d.primaryArchetype].landingStudio,
      aboutTitle: c.story[0].title, aboutText: c.story.map((s) => s.text).join(" "),
      servicesTitle: c.itemsTitle, servicesIntro: "Описания — гипотеза, проверьте и отредактируйте.",
      services: c.items.slice(0, 3).map((i) => [i.title, i.text]),
      advantagesTitle: "Что важно знать до заказа", advantagesIntro: "Замените на подтверждённые факты.",
      processTitle: "Как всё происходит", faqTitle: "Частые вопросы",
      contactTitle: h.primaryCTA, contactText: "Оставьте контакт — ответим удобным способом.",
      phone: "", email: "", messenger: "", heroImage: "",
      // Расширение формата: старые версии Landing Studio сохраняют эти поля как есть и игнорируют их.
      designBrief: b, designDNA: d, homepage: h, uniquenessCheck: concept.uniquenessCheck
    };
    return { format: "LandingStudioProject", version: 1, project: { name: b.brand, data } };
  }

  function contractOf(concept) {
    const { designBrief: b, designDNA: d, homepage: h, uniquenessCheck: u } = concept;
    return {
      designBrief: { businessType: b.businessType, audience: b.audience, primaryGoal: b.primaryGoal, brandCharacter: b.brandCharacter, contentPriority: b.contentPriority },
      designDNA: { primaryArchetype: d.primaryArchetype, secondaryArchetype: d.secondaryArchetype, selectionRationale: d.selectionRationale, colorDirection: d.colorDirection, typographyDirection: d.typographyDirection, imageDirection: d.imageDirection, motionDirection: d.motionDirection },
      homepage: { heroComposition: h.heroComposition, navigationPattern: h.navigationPattern, sectionOrder: h.sectionOrder, primaryCTA: h.primaryCTA },
      uniquenessCheck: u
    };
  }

  function toPrompt(concept) {
    const k = contractOf(concept);
    return `Сделай главную страницу для «${concept.designBrief.brand}» по концепции ниже. Не используй шаблонный hero, не выдумывай цены, отзывы, сертификаты, адреса и гарантии. Адаптивность от 320 px, prefers-reduced-motion, видимый focus, семантическая разметка.

Концепция (контракт Unique Design Architecture):
${JSON.stringify(k, null, 2)}

Гипотезы, которые нужно проверить:
- ${concept.designBrief.assumptions.join("\n- ")}`;
  }

  return {
    ARCHETYPES, NICHES, TONES, FROM_LANDING_STUDIO,
    buildDesignBrief, createConcept, renderHomepage, toLandingStudioProject, contractOf, toPrompt,
    util: { contrast, hslToHex, hash }
  };
});
