// Английский бриф для генератора изображений (FLUX на Cloudflare Workers AI понимает только английский).
// Раньше сюжет уходил по-русски: генератор улавливал лишь «кафе» и рисовал типовое европейское кафе вместо
// вьетнамской кухни, а в карточку «Фо Бо» — интерьер вместо тарелки фо. Здесь ниша превращается в визуальный
// профиль (кухня, обстановка, реквизит, чего избегать), а позиции — в точные описания блюд и товаров.
// Кириллица в промпт не попадает: незнакомые названия транслитерируются и объясняются контекстом ниши.

const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
export const translit = text => String(text || '').replace(/[а-яё]/gi, ch => {
  const low = ch.toLowerCase(), out = TRANSLIT[low] ?? '';
  return ch === low ? out : out.charAt(0).toUpperCase() + out.slice(1);
}).replace(/[«»"]/g, '').trim();
const hasCyrillic = text => /[а-яё]/i.test(text);
const clean = text => String(text || '').replace(/\s+/g, ' ').trim();

// ---------- Кухни: обстановка и блюда ----------
// Порядок важен: более узкие совпадения раньше общих.
const CUISINES = [
  { id: 'vietnamese', match: /вьетнам|фо[\s-]?бо|бан[\s-]?ми|vietnam/i, en: 'Vietnamese',
    setting: 'a cozy Vietnamese street-food restaurant: bamboo and dark wood, woven lanterns, green plants, enamel bowls, fresh herbs on the table',
    avoid: 'not a European bistro, no bread baskets, no french fries, no pasta, no wine',
    dishes: [
      [/фо[\s-]?бо|^фо(?![а-яё])|\bpho\b/i, 'pho bo: a large deep bowl of Vietnamese beef noodle soup with clear broth, flat rice noodles, thin slices of rare beef, spring onion, a side plate of fresh basil, bean sprouts, lime wedges and red chili'],
      [/фо[\s-]?га/i, 'pho ga: a bowl of Vietnamese chicken noodle soup with rice noodles, shredded chicken, herbs and lime'],
      [/бун[\s-]?бо/i, 'bun bo hue: a bowl of spicy Hue-style beef noodle soup with round rice noodles, red chili oil and herbs'],
      [/бун[\s-]?ча/i, 'bun cha: grilled pork patties in sweet fish sauce broth with rice vermicelli and a basket of fresh herbs'],
      [/(?<![а-яё])нем(?![а-яё])|нем[\s-]?ран|ча[\s-]?зо|жарен.*ролл/i, 'nem ran: crispy golden Vietnamese fried spring rolls cut in halves, with lettuce leaves, herbs and a small bowl of nuoc cham dipping sauce'],
      [/гой[\s-]?куон|свеж.*ролл|рисов.*бумаг/i, 'goi cuon: translucent fresh rice paper rolls with shrimp, herbs and vermicelli, with peanut hoisin dip'],
      [/бан[\s-]?ми/i, 'banh mi: a crispy Vietnamese baguette sandwich filled with grilled pork, pickled carrot and daikon, cucumber, cilantro and chili'],
      [/бан[\s-]?сео/i, 'banh xeo: a crispy golden Vietnamese turmeric crepe folded over shrimp, pork and bean sprouts, with lettuce and herbs'],
      [/ком[\s-]?там|рис.*свин/i, 'com tam: broken rice with a grilled pork chop, fried egg, pickles and fish sauce'],
      [/кофе|кафе[\s-]?суа|сгущ/i, 'Vietnamese coffee: a metal phin drip filter on a glass with a layer of sweetened condensed milk, iced coffee beside it'],
      [/чай/i, 'Vietnamese tea: a clay teapot and small cups of jasmine green tea on a wooden table'],
      [/спринг|ролл/i, 'Vietnamese spring rolls with dipping sauce and fresh herbs'],
      [/суп|бульон/i, 'a steaming bowl of Vietnamese noodle soup with fresh herbs and lime'],
    ] },
  { id: 'japanese', match: /япон|суши|ролл|рамен|сашими|izakaya|japan/i, en: 'Japanese',
    setting: 'a minimalist Japanese restaurant: light wood counter, ceramic tableware, noren curtain, calm warm light',
    avoid: 'not a European restaurant, no cutlery-heavy western plating',
    dishes: [
      [/рамен/i, 'a bowl of Japanese ramen with rich broth, wavy noodles, chashu pork slices, soft-boiled marinated egg, nori and spring onion'],
      [/сашими/i, 'sashimi: thin slices of fresh salmon and tuna on crushed ice with shiso leaf and wasabi'],
      [/сет|набор/i, 'an assorted sushi set on a wooden board: nigiri and maki rolls with pickled ginger and wasabi'],
      [/удон/i, 'a bowl of thick udon noodles in dashi broth with tempura shrimp'],
      [/темпур/i, 'crispy light tempura shrimp and vegetables on paper with dipping sauce'],
      [/гёдза|гедза|гьоза/i, 'pan-fried gyoza dumplings with crispy bottoms and dipping sauce'],
      [/суши|нигири/i, 'nigiri sushi with fresh fish on a dark ceramic plate'],
      [/ролл|маки/i, 'neatly cut maki rolls with salmon, avocado and sesame on a slate plate'],
    ] },
  { id: 'chinese', match: /китай|дим[\s-]?сам|вок(?![а-яё])|china/i, en: 'Chinese',
    setting: 'a modern Chinese restaurant: red and dark wood accents, round table with lazy susan, porcelain tableware',
    avoid: 'not a European restaurant',
    dishes: [[/дим[\s-]?сам|баоцз|бао(?![а-яё])/i, 'dim sum: bamboo steamers with har gow shrimp dumplings and fluffy bao buns'], [/утк/i, 'Peking duck with glossy crispy skin, thin pancakes, cucumber and hoisin sauce'], [/лапш|вок/i, 'stir-fried wok noodles with vegetables and meat, steam rising']] },
  { id: 'thai', match: /тай(ская|ск)|том[\s-]?ям|пад[\s-]?тай|thai/i, en: 'Thai',
    setting: 'a vibrant Thai restaurant: tropical plants, carved teak, brass bowls',
    avoid: 'not a European restaurant',
    dishes: [[/том[\s-]?ям/i, 'tom yum: spicy-sour Thai soup with shrimp, lemongrass, galangal, mushrooms and chili'], [/пад[\s-]?тай/i, 'pad thai: stir-fried rice noodles with shrimp, tofu, egg, peanuts, bean sprouts and lime'], [/карри/i, 'Thai green curry with chicken and Thai basil, jasmine rice on the side']] },
  { id: 'korean', match: /коре(й|я)|кимчи|бибимбап|korea/i, en: 'Korean',
    setting: 'a Korean barbecue restaurant: table grill, many small banchan side dishes, stainless steel chopsticks',
    avoid: 'not a European restaurant',
    dishes: [[/бибимбап/i, 'bibimbap in a hot stone bowl with rice, colorful vegetables, beef and a fried egg'], [/кимчи/i, 'kimchi in a small ceramic bowl among banchan side dishes'], [/барбекю|гриль|самгёпсаль/i, 'Korean barbecue: marinated meat grilling on a table grill with lettuce wraps']] },
  { id: 'georgian', match: /грузин|хачапур|хинкал|georgia/i, en: 'Georgian',
    setting: 'a warm Georgian restaurant: stone walls, clay pots, carpets, grapevine decor',
    avoid: '',
    dishes: [[/хачапур/i, 'Adjarian khachapuri: boat-shaped cheese bread with melted cheese, egg yolk and butter'], [/хинкал/i, 'khinkali: twisted Georgian soup dumplings on a plate with black pepper'], [/шашлык|мцвади/i, 'mtsvadi: Georgian grilled meat skewers with onion rings and pomegranate']] },
  { id: 'uzbek', match: /узбек|плов|самс|лагман|uzbek/i, en: 'Uzbek',
    setting: 'a Central Asian restaurant: blue ceramic patterns, carved wood, tandoor oven',
    avoid: '',
    dishes: [[/плов/i, 'Uzbek plov: rice pilaf with lamb, yellow carrots and garlic bulb in a large kazan'], [/самс/i, 'golden tandoor samsa pastries with flaky crust'], [/лагман/i, 'lagman: hand-pulled noodles with meat and vegetables in rich broth']] },
  { id: 'italian', match: /итальян|пицц|паст(а|ы)(?![а-яё])|тратори|italia/i, en: 'Italian',
    setting: 'a rustic Italian trattoria: wood-fired oven, checked napkins, olive oil and basil',
    avoid: '',
    dishes: [[/пицц/i, 'Neapolitan pizza with blistered crust, tomato, mozzarella and fresh basil'], [/паст|спагет|карбонар/i, 'a plate of fresh pasta with sauce and grated parmesan'], [/тирамису/i, 'tiramisu dusted with cocoa in a glass dish'], [/ризотто/i, 'creamy risotto with parmesan']] },
  { id: 'indian', match: /индий|карри|india/i, en: 'Indian', setting: 'an Indian restaurant: copper bowls, spices, warm patterned textiles', avoid: '',
    dishes: [[/масал|карри/i, 'chicken tikka masala in a copper bowl with naan bread and basmati rice'], [/наан|лепёш/i, 'freshly baked naan bread from a tandoor']] },
  { id: 'mexican', match: /мексик|тако|буррито|mexic/i, en: 'Mexican', setting: 'a colorful Mexican taqueria: painted tiles, limes, salsas', avoid: '',
    dishes: [[/тако/i, 'street tacos with grilled meat, onion, cilantro and lime on corn tortillas'], [/буррито/i, 'a burrito cut in half showing rice, beans and meat']] },
];

// ---------- Ниши вне кухни: сцена первого экрана, обстановка, реквизит ----------
const NICHES = [
  { match: /раков|рак(и|ов)(?![а-яё])|морепродукт|устриц|краб/i, en: 'seafood and crayfish bar', setting: 'a casual seafood bar: wooden tables covered with paper, steel buckets, lemons and dill', hero: 'a heap of bright red boiled crayfish with dill, lemon and corn on a wooden table' },
  { match: /кофейн|кофе|бариста|coffee/i, en: 'specialty coffee shop', setting: 'a specialty coffee shop: espresso machine, ceramic cups, pastries on the counter', hero: 'a barista pouring latte art into a ceramic cup at an espresso bar' },
  { match: /пекарн|хлеб|выпечк|bakery/i, en: 'artisan bakery', setting: 'an artisan bakery: flour-dusted wooden counters, wicker baskets, warm oven light', hero: 'fresh crusty sourdough loaves and croissants on a wooden counter' },
  { match: /кондитер|торт|десерт|пирожн/i, en: 'pastry shop', setting: 'an elegant pastry shop: marble counter, glass display', hero: 'an elegant layered cake and pastries on a marble counter' },
  { match: /бургер|фастфуд|шаурм/i, en: 'burger restaurant', setting: 'a modern burger joint: brick wall, metal trays', hero: 'a juicy double cheeseburger on a metal tray' },
  { match: /букет|цвет(ы|оч)|флорист/i, en: 'florist studio', setting: 'a florist studio: fresh flowers, kraft paper, workbench', hero: 'a lush fresh flower bouquet wrapped in kraft paper' },
  { match: /съедобн/i, en: 'edible bouquet shop', setting: 'a gift workshop: kraft paper, ribbons, fruit and sweets arranged as bouquets', hero: 'an edible bouquet made of strawberries, chocolate and macarons wrapped in kraft paper' },
  { match: /мебел|диван|кухни на заказ/i, en: 'furniture store', setting: 'a bright modern living room interior, natural materials', hero: 'a modern sofa and wooden furniture in a bright living room' },
  { match: /стомат|зуб/i, en: 'dental clinic', setting: 'a modern clean dental clinic: white and soft colors, modern equipment', hero: 'a calm modern dental treatment room with daylight' },
  { match: /клиник|медицин|врач/i, en: 'medical clinic', setting: 'a modern medical clinic: clean bright interior', hero: 'a bright modern clinic reception with a doctor in a white coat' },
  { match: /салон красот|парикмах|барбер|маникюр|косметолог|beauty/i, en: 'beauty salon', setting: 'a stylish beauty salon: mirrors, warm lights, styling chairs', hero: 'a stylist working on a client hairstyle in a stylish salon' },
  { match: /фитнес|спортзал|тренаж|йог/i, en: 'fitness studio', setting: 'a modern fitness studio: natural light, equipment', hero: 'a person training in a bright modern fitness studio' },
  { match: /фотограф|фотостуд/i, en: 'photography studio', setting: 'a photo studio: softboxes, backdrop, camera', hero: 'a photographer with a camera during a portrait session in a studio' },
  { match: /автосервис|шиномонтаж|(?<![а-яё])сто(?![а-яё])|ремонт авто/i, en: 'car service workshop', setting: 'a clean car service workshop: lift, tools, cars', hero: 'a mechanic working on a car on a lift in a clean workshop' },
  { match: /юрист|адвокат|нотари/i, en: 'law office', setting: 'a calm law office: wooden desk, documents, bookshelves', hero: 'a lawyer consulting a client at a wooden desk with documents' },
  { match: /ювелир|украшен/i, en: 'jewelry atelier', setting: 'a jewelry atelier: dark velvet, precise lighting', hero: 'a gold ring with a gemstone on dark velvet with precise light' },
  { match: /телескоп|астроном/i, en: 'telescope store', setting: 'an astronomy shop and a night sky', hero: 'a telescope on a tripod under a starry night sky' },
  { match: /бытов.*техник|электроник|техник/i, en: 'home appliance store', setting: 'a bright modern kitchen with appliances', hero: 'modern home appliances in a bright kitchen' },
  { match: /одежд|бутик|ателье/i, en: 'clothing boutique', setting: 'a clothing boutique: rails, natural fabrics', hero: 'clothes on a rail in a bright boutique' },
  { match: /отел|гостиниц|хостел/i, en: 'boutique hotel', setting: 'a boutique hotel room', hero: 'a cozy boutique hotel room with a made bed and soft light' },
  { match: /ремонт|строит|отделк/i, en: 'renovation company', setting: 'a renovated modern apartment', hero: 'a freshly renovated bright apartment interior' },
  { match: /школ|курс|обучен|репетит/i, en: 'education center', setting: 'a bright classroom', hero: 'students learning with a teacher in a bright classroom' },
  { match: /сёрф|серф/i, en: 'surf school', setting: 'an ocean beach with surfboards', hero: 'a surfer riding a wave on a sunny day' },
  { match: /ветеринар|зоо|груминг/i, en: 'veterinary and pet care', setting: 'a friendly pet clinic', hero: 'a veterinarian gently examining a dog' },
];

/**
 * Визуальный профиль ниши на английском. Кухня определяется и по нише, и по названиям позиций.
 * @returns {{ en: string, setting: string, hero: string, avoid: string, cuisine: object|null }}
 */
export function nicheVisual(project) {
  const niche = clean(project.niche);
  const items = (project.services || []).map(s => (Array.isArray(s) ? s[0] : s?.title) || '').join(' ');
  const cuisine = CUISINES.find(c => c.match.test(niche)) || CUISINES.find(c => c.match.test(items)) || null;
  if (cuisine) {
    const place = /кофейн|кафе|бар(?![а-яё])|ресторан|закусочн|доставк/i.exec(niche)?.[0];
    const kind = /доставк/i.test(niche) ? 'food delivery' : /кофейн|кафе/i.test(place || '') ? 'cafe' : 'restaurant';
    const signature = cuisine.dishes[0][1].split(':')[0];
    return { en: `${cuisine.en} ${kind}`, setting: cuisine.setting, hero: `a table with authentic ${cuisine.en} dishes, ${signature} in the center`, avoid: cuisine.avoid, cuisine };
  }
  const known = NICHES.find(n => n.match.test(niche));
  if (known) return { en: known.en, setting: known.setting, hero: known.hero, avoid: '', cuisine: null };
  const name = translit(niche) || 'local business';
  return { en: `local business "${name}"`, setting: 'the real workplace of this business', hero: `the main product or service of a local business called "${name}", shown clearly`, avoid: '', cuisine: null };
}

// Что изображено в карточке позиции: точное блюдо из словаря или транслит с контекстом ниши.
export function itemSubject(title, visual) {
  const name = clean(title);
  if (visual.cuisine) {
    const hit = visual.cuisine.dishes.find(([re]) => re.test(name));
    if (hit) return hit[1];
    return `an authentic ${visual.cuisine.en} dish called "${translit(name)}", plated as served in ${visual.cuisine.en} cuisine, the dish fills the frame`;
  }
  return `the product or service "${translit(name)}" of a ${visual.en}, shown clearly as the main subject`;
}

const GALLERY_IDEAS = ['a wide shot of the place or the process', 'a close-up of texture and details', 'people at work or a happy customer with the result', 'the finished product or result', 'atmosphere: light, interior and small details', 'the team or the master at work'];
const ASPECT = { '16:9': 'wide 16:9 frame', '4:3': '4:3 frame', '4:5': 'vertical 4:5 frame', '3:2': '3:2 frame', '1:1': 'square frame' };

// Стиль съёмки по направлению графики (graphic-art-direction.js). Только то, что генератор фото может
// воспроизвести одним кадром; направления интерфейсной графики (HUD, данные, чертёж) дают нейтральный стиль.
export const ART_STYLE = {
  cinematic: 'cinematic color grade, dramatic directional light, shallow depth of field',
  '3d-object': 'clean studio product shot, seamless backdrop, precise reflections and soft contact shadow',
  'abstract-3d': 'soft volumetric light, smooth gradients, minimal sculptural forms in the background',
  collage: 'editorial documentary style, natural candid moments, layered depth',
  typography: 'calm minimal composition with generous empty space',
  gradient: 'soft ambient color glow, diffused light, airy mood',
  glass: 'translucent glass and soft reflections, cool clean light',
  blueprint: 'precise technical look, clean lines, neutral light',
  editorial: 'magazine editorial art direction, bold crop, refined color',
  hud: 'cool modern tech lighting, subtle screen glow',
  lineart: 'clean minimal composition, light neutral background',
  macro: 'macro photography, tactile texture, extreme detail, raking light',
  surreal: 'dreamlike atmosphere, soft haze, unexpected scale, still believable',
  data: 'clean modern workplace light, neutral tones',
  floating: 'objects floating in space, soft layered shadows, studio composition',
};

/** Английский промпт для одного места изображения (слот из imageSlots). Без кириллицы. */
export function photoPrompt(slot, project, graphicDirection) {
  const visual = nicheVisual(project);
  const luxury = project.tier === 'luxury', premium = project.tier === 'premium';
  let subject, angle, background;
  if (slot.role === 'hero' && slot.asBackground) {
    // Фон под текстом: атмосфера места, без одного главного предмета и мелких контрастных деталей.
    subject = `the atmosphere of ${visual.setting}, calm and softly lit, no single dominant object in the center, low contrast, gentle depth of field, suitable as a background behind text`;
    angle = 'wide shot at eye level'; background = visual.setting;
  } else if (slot.role === 'hero') {
    subject = visual.hero; angle = 'wide establishing shot at eye level'; background = visual.setting;
  } else if (slot.role === 'service') {
    subject = itemSubject(slot.label, visual); angle = visual.cuisine ? 'close-up from 45 degrees, the plate fills most of the frame' : 'front or three-quarter view, the subject fills most of the frame';
    background = visual.cuisine ? `a table in ${visual.setting}, softly blurred` : 'a simple consistent background, the same for every product card';
  } else {
    const n = Number(String(slot.id).split('-')[1]) || 0;
    subject = `${GALLERY_IDEAS[n % GALLERY_IDEAS.length]} at a ${visual.en}`; angle = n % 2 ? 'close-up' : 'medium shot'; background = visual.setting;
  }
  const light = luxury ? 'controlled directional light, deep soft shadows, refined editorial mood' : 'soft natural daylight, natural colors';
  const parts = [
    `Photorealistic commercial photograph for the website of a ${visual.en}.`,
    `Subject: ${subject}.`,
    `Setting: ${background}.`,
    `Camera: ${angle}, ${ASPECT[slot.aspect] || 'balanced frame'}. Light: ${light}.`,
    ART_STYLE[graphicDirection?.id || graphicDirection] ? `Art direction: ${ART_STYLE[graphicDirection.id || graphicDirection]}.` : '',
    luxury ? 'Luxury editorial quality.' : premium ? 'Premium professional food and product photography.' : 'Authentic, appetizing and believable.',
    visual.avoid ? `Avoid: ${visual.avoid}.` : '',
    'No text, no letters, no logos, no watermarks, no invented brand names or labels.',
  ];
  const prompt = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ');
  return hasCyrillic(prompt) ? translit(prompt) : prompt;
}
