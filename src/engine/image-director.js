// AI Image Director PRO: задание на каждое место для изображения на странице и проверка набора фотографий.
// Работает до загрузки фото: владелец сразу получает план съёмки или промпты для внешней генерации.
// Этот модуль готовит задания и проверяет набор; сама генерация и вставка фото выполняются UI студии через Worker.
// Проверка здесь — по данным проекта, без анализа
// пикселей (яркость, резкость и похожие кадры оцениваются в браузере студии отдельно).
import { hexToHsl } from './color.js';

// Архитектуры, в которых первый экран построен на тексте, каталоге или форме: фото здесь — фон под текстом
// с вуалью цвета палитры (render.js), а не отдельная картинка. Раньше в них фото первого экрана не было вовсе.
/** Сколько кадров галереи планирует студия (и генерирует автопилот). */
export const GALLERY_FRAMES = 8;

export const HERO_AS_BACKGROUND = new Set(['catalog', 'split-utility', 'brutalist', 'minimal']);
/** @deprecated Прежнее имя того же набора архитектур: сохранено для совместимости внешнего кода. */
export const HERO_WITHOUT_PHOTO = HERO_AS_BACKGROUND;
const HERO_ASPECT = { immersive: '16:9', storytelling: '16:9', 'modular-grid': '4:3', catalog: '16:9', 'product-first': '4:5', editorial: '3:2', asymmetric: '4:5', 'split-utility': '16:9', brutalist: '16:9', minimal: '16:9' };
const TEXT_ZONE = {
  'bleed-bottom-left': 'оставьте спокойный нижний левый угол под заголовок', 'bleed-center': 'оставьте спокойный центр кадра под заголовок',
  'spotlight-right': 'объект справа, левая половина свободна', 'spotlight-left': 'объект слева, правая половина свободна',
  'offset-right': 'объект смещён вправо', 'offset-left': 'объект смещён влево',
};
const NEGATIVE = 'Без надписей, логотипов, водяных знаков и рамок. Без выдуманных деталей товара, наград и сертификатов. Узнаваемые люди — только с их согласия.';

// hexToHsl возвращает [h, s, l] с l в процентах.
const isDark = hex => { try { return hexToHsl(hex)[2] < 40; } catch { return false; } };
const clean = t => String(t || '').trim().replace(/[.;,s]+$/, '');
const lowerFirst = t => (t ? t[0].toLowerCase() + t.slice(1) : t);

function lightFor(project, palette) {
  if (project.tier === 'luxury') return 'контролируемый направленный свет, глубокие мягкие тени, много воздуха';
  if (palette && isDark(palette.bg)) return 'низкий ключ: тёмный фон, локальный тёплый свет, объект выхвачен из темноты';
  return 'мягкий рассеянный дневной свет, светлый чистый фон, натуральные цвета';
}

/**
 * Места для изображений, которые реально есть на странице, с заданием для каждого.
 * @returns {{ slots: object[], filled: number, total: number }}
 */
export function imageSlots(project, concept) {
  const vs = concept.visualSystem;
  const order = concept.homepage?.sectionOrder || [];
  const direction = lowerFirst(clean(concept.designDNA?.imageDirection)) || 'реальные фотографии продукта, людей и процесса';
  const light = lightFor(project, vs.palette);
  const niche = project.niche || 'бизнес';
  const base = { light, direction, negative: NEGATIVE };
  const slots = [];
  const art = project.passthrough?.imageArtDirection || {};

  const asBackground = HERO_AS_BACKGROUND.has(vs.archetype);
  slots.push({
    ...base, id: 'hero', role: 'hero', label: asBackground ? 'Фон первого экрана' : 'Первый экран', asBackground,
    filled: Boolean(project.images.hero), mobileFilled: Boolean(project.images.heroMobile),
    aspect: HERO_ASPECT[vs.archetype] || '3:2', mobileAspect: '4:5', minWidth: 1920,
    subject: asBackground ? `атмосфера ниши «${niche}»: обстановка и фактура, без одного главного предмета в центре` : `главный сюжет ниши «${niche}»: ${direction}`,
    angle: asBackground || vs.archetype === 'immersive' ? 'широкий общий план на уровне глаз' : 'средний план, лёгкий ракурс 3/4',
    background: 'чистый, без случайных предметов',
    composition: asBackground ? 'спокойный кадр без мелких контрастных деталей: поверх ляжет текст и вуаль цвета сайта' : TEXT_ZONE[vs.placement] || 'один главный объект, второстепенные детали не спорят с ним',
    alt: project.images.heroAlt || '',
  });

  if (order.includes('items')) {
    project.services.map((item, sourceIndex) => ({ item, sourceIndex })).filter(entry => entry.item.title).forEach(({ item, sourceIndex }, n) => slots.push({
      ...base, id: `item-${n}`, sourceIndex, role: 'service', label: item.title,
      filled: Boolean(item.image), mobileFilled: Boolean(art.mobileSources?.services?.[n]),
      aspect: '4:3', mobileAspect: '4:3', minWidth: 1200,
      subject: `«${item.title}»${item.text ? ` — ${lowerFirst(clean(item.text))}` : ''}; показать именно эту позицию, а не похожую`,
      angle: 'фронтально или 3/4, объект целиком', background: 'одинаковый для всех карточек каталога, чтобы сетка выглядела единой',
      composition: 'объект по центру с запасом по краям 10–15%: кадр обрезается в карточке', alt: item.alt || '',
    }));
  }

  if (order.includes('gallery') || !project.gallery.length) {
    // 8 кадров: галерея из 4 фото выглядела пустой для портфолио, мастерских и заведений.
    const frames = Math.max(GALLERY_FRAMES, project.gallery.length);
    const ideas = ['общий план места или процесса', 'деталь и фактура крупно', 'люди в работе или клиент с результатом', 'результат до и после или готовое изделие', 'атмосфера: свет, интерьер, упаковка', 'команда или мастер', 'инструменты, материалы или ингредиенты', 'место с другого ракурса: вход, стойка, рабочее место'];
    for (let n = 0; n < frames; n++) {
      const g = project.gallery[n];
      slots.push({
        ...base, id: `gallery-${n}`, role: 'gallery', label: `Галерея, кадр ${n + 1}`,
        filled: Boolean(g?.src), mobileFilled: Boolean(art.mobileSources?.gallery?.[n]),
        aspect: '4:5', mobileAspect: '4:5', minWidth: 1600,
        subject: `${ideas[n % ideas.length]} — ниша «${niche}»`,
        angle: n % 2 ? 'крупный план' : 'средний план', background: 'реальное место работы, без постановочного стока',
        composition: 'вертикальный кадр 4:5, каждый кадр показывает новое, а не повтор предыдущего', alt: g?.alt || '',
      });
    }
  }
  return { slots, filled: slots.filter(s => s.filled).length, total: slots.length };
}

/** Текст задания одного места: для фотографа и как промпт внешнего генератора изображений. */
export function slotBrief(slot, project) {
  return [
    `${slot.label.toUpperCase()} — ${slot.filled ? 'фото есть, при замене соблюдайте задание' : 'нужно фото'}`,
    `Сюжет: ${slot.subject}.`,
    `Ракурс: ${slot.angle}. Композиция: ${slot.composition}.`,
    `Свет: ${slot.light}. Фон: ${slot.background}.`,
    `Формат: ${slot.aspect}, не меньше ${slot.minWidth} px по ширине; для телефона — ${slot.mobileAspect}${slot.mobileFilled ? ' (мобильная версия загружена)' : ', главный объект в центральной трети'}.`,
    project.tier === 'luxury' ? 'Уровень: журнальная съёмка, натуральные материалы, точная цветопередача.' : project.tier === 'premium' ? 'Уровень: профессиональная коммерческая съёмка, выразительная глубина.' : '',
    slot.negative,
  ].filter(Boolean).join('\n');
}

export function imageTaskPackage(project, concept) {
  const { slots, filled, total } = imageSlots(project, concept);
  return [`ЗАДАНИЯ НА ИЗОБРАЖЕНИЯ — ${project.brand || project.niche || 'проект'}`, `Заполнено мест: ${filled} из ${total}. Студия не генерирует изображения: это задания для фотографа или внешнего генератора.`, ...slots.map((s, i) => `${i + 1}. ${slotBrief(s, project)}`)].join('\n\n');
}

const FILE_LIKE = /\.(jpe?g|png|webp|gif|avif)$|^(img|image|photo|dsc|снимок)[_ -]?\d*/i;

/** Проверка набора изображений по данным проекта. Возвращает замечания для контроля качества. */
export function reviewImageSet(project, concept) {
  const { slots, filled, total } = imageSlots(project, concept);
  const findings = [];
  const add = (id, severity, message, category = 'images') => findings.push({ id: `images:${id}`, source: 'image-director', category, severity, message });
  const used = slots.filter(s => s.filled);
  const hero = slots.find(s => s.id === 'hero');
  if (hero?.asBackground && !project.images.hero) add('hero-missing', 'medium', 'Нет фона первого экрана: первый экран держится только на тексте. Добавьте спокойное фото обстановки — оно ляжет фоном под вуаль цвета сайта.');
  else if (hero && !project.images.hero) add('hero-missing', 'high', 'Нет фото первого экрана — посетитель не видит предмет предложения. Задание для съёмки — во вкладке «Проверка».');
  else if (hero && !hero.asBackground && !project.images.heroMobile && ['16:9', '3:2'].includes(hero.aspect)) add('hero-mobile', 'medium', `Фото первого экрана горизонтальное (${hero.aspect}), а мобильной версии нет: на телефоне главный объект может обрезаться.`);
  const items = slots.filter(s => s.role === 'service');
  const withImg = items.filter(s => s.filled).length;
  if (withImg && withImg < items.length) add('items-partial', 'medium', `Фото есть у ${withImg} из ${items.length} позиций — карточки без фото выглядят незавершёнными. Добавьте недостающие или уберите фото у всех.`);
  const alts = used.map(s => s.alt.trim()).filter(Boolean);
  const noAlt = used.filter(s => !s.alt.trim() && s.role !== 'service').length;
  if (noAlt) add('alt-missing', 'medium', `У ${noAlt} фото нет ALT-описания. Опишите, что изображено, — это нужно незрячим посетителям и поиску.`, 'accessibility');
  const fileLike = alts.filter(a => FILE_LIKE.test(a));
  if (fileLike.length) add('alt-filename', 'medium', `ALT похож на имя файла: «${fileLike[0]}». Опишите смысл изображения.`, 'accessibility');
  const dupAlt = alts.filter((a, i) => alts.indexOf(a) !== i);
  if (dupAlt.length) add('alt-duplicate', 'low', `Одинаковые ALT у разных фото: «${dupAlt[0]}». У каждого кадра должно быть своё описание.`, 'accessibility');
  const srcs = [project.images.hero, ...project.gallery.map(g => g.src), ...project.services.map(s => s.image)].filter(Boolean);
  const dupSrc = srcs.filter((s, i) => srcs.indexOf(s) !== i).length;
  if (dupSrc) add('src-duplicate', 'medium', `Один и тот же файл использован ${dupSrc + 1} раза — это выглядит как недостаток фото. Нужны разные кадры.`);
  const http = srcs.filter(s => /^http:\/\//i.test(s)).length;
  if (http) add('insecure', 'high', `${http} изображений загружаются по http — браузер может их заблокировать на https-сайте.`, 'security');
  if ((concept.homepage?.sectionOrder || []).includes('gallery') && project.gallery.length && project.gallery.length < 3) add('gallery-small', 'low', `В галерее ${project.gallery.length} фото — для галереи нужно хотя бы 3 разных кадра.`);
  return { findings, filled, total };
}
