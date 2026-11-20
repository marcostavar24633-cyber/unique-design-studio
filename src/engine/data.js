// Справочники движка: библиотека архитектур (§3 спецификации), профили ниш (§4, §10),
// цветовые направления, типографические характеры и формы.

/** 10 архитектур главной страницы. Каждая задаёт собственную композицию hero,
 *  допустимые навигации, варианты блоков и порядок секций по умолчанию. */
export const ARCHETYPES = {
  'product-first': {
    name: 'Product First', ru: 'Товар в центре', legacy: 'catalog',
    summary: 'товар, цена/характеристики и покупка находятся в центре первого экрана',
    placements: {
      'spotlight-right': 'Слева предложение и CTA, справа карточка главного товара с описанием и кнопкой заказа',
      'spotlight-left': 'Карточка главного товара слева, предложение и CTA справа',
      'spotlight-stage': 'Главный товар на широкой «сцене» по центру, предложение и CTA под ним',
    },
    navs: ['bar', 'category'], types: ['grotesque-tight', 'geometric-clean', 'slab-sturdy', 'serif-editorial', 'rounded-friendly'],
    shapes: ['soft', 'round'], items: 'product', advantages: 'inline', process: 'steps',
    order: ['items', 'advantages', 'process', 'gallery', 'about', 'faq', 'contact'],
    h1: [2, 3.6], rhythm: 'regular', motion: 'reveal',
  },
  editorial: {
    name: 'Editorial / Magazine', ru: 'Редакционная / журнальная', legacy: 'editorial',
    summary: 'журнальная типографика, колонки и авторская подача ведут рассказ о бренде',
    placements: {
      'headline-over-figure': 'Крупный центрированный заголовок на всю ширину, под ним двухколоночный лид и широкая иллюстрация',
      'column-and-plate': 'Узкая текстовая колонка с заголовком слева, высокая «журнальная полоса» с визуалом справа',
    },
    navs: ['masthead', 'bar'], types: ['serif-editorial', 'didone-contrast', 'slab-sturdy', 'geometric-clean'],
    shapes: ['sharp', 'soft'], items: 'rules', advantages: 'statement', process: 'timeline',
    order: ['about', 'items', 'gallery', 'advantages', 'process', 'faq', 'contact'],
    h1: [2.3, 6.2], rhythm: 'airy', motion: 'reveal',
  },
  immersive: {
    name: 'Immersive Fullscreen', ru: 'Полноэкранная / иммерсивная', legacy: 'immersive',
    summary: 'полноэкранный визуальный сюжет погружает в атмосферу раньше, чем начинается текст',
    placements: {
      'bleed-bottom-left': 'Визуал на весь экран, заголовок и CTA прижаты к нижнему левому углу поверх затемнения',
      'bleed-center': 'Визуал на весь экран, заголовок и CTA по центру поверх затемнения',
    },
    navs: ['overlay'], types: ['didone-contrast', 'geometric-clean', 'grotesque-tight', 'condensed-caps', 'serif-editorial'],
    shapes: ['sharp', 'soft', 'round'], items: 'rules', advantages: 'statement', process: 'timeline',
    order: ['gallery', 'about', 'items', 'advantages', 'process', 'faq', 'contact'],
    h1: [2.4, 6], rhythm: 'airy', motion: 'parallax',
  },
  asymmetric: {
    name: 'Asymmetric Canvas', ru: 'Асимметричный холст', legacy: 'modular',
    summary: 'асимметричная композиция с несколькими зонами внимания создаёт характер и движение взгляда',
    placements: {
      'offset-right': 'Заголовок занимает левые две трети, визуал смещён вправо и вниз с наложением, лид и CTA в узкой нижней колонке',
      'offset-left': 'Визуал смещён влево и вверх, заголовок начинается правее и перекрывает его край, лид и CTA справа внизу',
    },
    navs: ['rail', 'bar', 'minimal'], types: ['grotesque-tight', 'didone-contrast', 'geometric-clean', 'mono-technical', 'condensed-caps'],
    shapes: ['sharp', 'round'], items: 'numbered', advantages: 'cards', process: 'timeline',
    order: ['about', 'items', 'advantages', 'gallery', 'process', 'faq', 'contact'],
    h1: [2.2, 5.2], rhythm: 'airy', motion: 'reveal',
  },
  catalog: {
    name: 'Catalog / Marketplace', ru: 'Каталог / витрина', legacy: 'catalog',
    summary: 'категории, поиск и товары видны сразу — ассортимент важнее декоративного hero',
    placements: {
      'tiles-under-search': 'Компактный заголовок, строка поиска и плитки разделов сразу на первом экране',
      'tiles-beside-copy': 'Слева компактное предложение и поиск, справа плотная сетка разделов',
    },
    navs: ['category', 'bar'], types: ['grotesque-tight', 'geometric-clean', 'mono-technical', 'rounded-friendly'],
    shapes: ['soft', 'sharp', 'round'], items: 'product', advantages: 'inline', process: 'steps',
    order: ['items', 'advantages', 'process', 'about', 'gallery', 'faq', 'contact'],
    h1: [1.9, 3], rhythm: 'compact', motion: 'static',
  },
  'split-utility': {
    name: 'Split Utility', ru: 'Услуги / сервис', legacy: 'service',
    summary: 'экран разделён на ясное предложение и инструмент действия — запись, подбор или заявку',
    placements: {
      'tool-right': 'Слева предложение и доказательства, справа панель действия: выбор услуги и заявка',
      'tool-left': 'Панель действия слева, предложение и доказательства справа',
    },
    navs: ['bar', 'minimal', 'rail'], types: ['grotesque-tight', 'geometric-clean', 'slab-sturdy', 'rounded-friendly', 'serif-editorial', 'didone-contrast'],
    shapes: ['soft', 'round', 'sharp'], items: 'cards', advantages: 'inline', process: 'steps',
    order: ['items', 'process', 'advantages', 'gallery', 'about', 'faq', 'contact'],
    h1: [2.1, 3.8], rhythm: 'regular', motion: 'reveal',
  },
  storytelling: {
    name: 'Storytelling Scroll', ru: 'История в прокрутке', legacy: 'service',
    summary: 'последовательный рассказ с пронумерованными главами управляет ритмом знакомства с продуктом',
    placements: {
      'chapter-index': 'Крупное заявление и оглавление глав, ведущее по странице; визуал — фоновая полоса под текстом',
      'chapter-side': 'Заявление слева, вертикальное оглавление глав справа как путеводитель',
    },
    navs: ['minimal', 'bar', 'rail'], types: ['serif-editorial', 'grotesque-tight', 'didone-contrast', 'slab-sturdy', 'mono-technical', 'geometric-clean'],
    shapes: ['sharp', 'soft'], items: 'numbered', advantages: 'statement', process: 'timeline',
    order: ['about', 'process', 'items', 'advantages', 'gallery', 'faq', 'contact'],
    h1: [2.3, 5.4], rhythm: 'airy', motion: 'reveal',
  },
  'modular-grid': {
    name: 'Modular Grid', ru: 'Модульная сетка', legacy: 'modular',
    summary: 'модульная сетка даёт несколько равноправных сценариев входа без одного доминирующего hero',
    placements: {
      'bento-headline-first': 'Сетка модулей: крупный модуль с заголовком, акцентный модуль с CTA, модули-входы в разделы и модуль с визуалом',
      'bento-visual-first': 'Сетка модулей: первым идёт крупный визуальный модуль, заголовок и входы в разделы собраны вокруг',
    },
    navs: ['bar', 'rail', 'category'], types: ['geometric-clean', 'grotesque-tight', 'rounded-friendly', 'slab-sturdy', 'serif-editorial', 'mono-technical'],
    shapes: ['round', 'soft', 'sharp'], items: 'bento', advantages: 'cards', process: 'steps',
    order: ['items', 'about', 'advantages', 'process', 'gallery', 'faq', 'contact'],
    h1: [2, 3.6], rhythm: 'compact', motion: 'reveal',
  },
  brutalist: {
    name: 'Brutalist / Experimental', ru: 'Брутализм / эксперимент', legacy: 'modular',
    summary: 'выразительная типографика и намеренная графическая смелость работают как заявление',
    placements: {
      'type-wall': 'Заголовок гигантским кеглем на всю ширину в жёсткой рамке, под ним индекс разделов и блок CTA',
      'type-and-block': 'Гигантский заголовок слева, справа сплошной акцентный блок с CTA и индексом разделов',
    },
    navs: ['bar', 'minimal'], types: ['condensed-caps', 'mono-technical', 'grotesque-tight'],
    shapes: ['sharp'], items: 'numbered', advantages: 'statement', process: 'steps',
    order: ['items', 'about', 'gallery', 'advantages', 'process', 'faq', 'contact'],
    h1: [2.4, 8], rhythm: 'compact', motion: 'static',
  },
  minimal: {
    name: 'Minimal Conversion', ru: 'Минимальная конверсия', legacy: 'service',
    summary: 'минимум отвлечений: сильное предложение и одно основное действие',
    placements: {
      'center-stack': 'Одна центрированная колонка: предложение, одно предложение-пояснение, один CTA и строка доказательств',
      'left-stack': 'Одна узкая колонка у левого края: предложение, пояснение, CTA; остальное пространство пустое',
    },
    navs: ['minimal'], types: ['grotesque-tight', 'serif-editorial', 'geometric-clean', 'didone-contrast', 'rounded-friendly'],
    shapes: ['soft', 'round', 'sharp'], items: 'rules', advantages: 'inline', process: 'steps',
    order: ['advantages', 'items', 'process', 'about', 'faq', 'contact'],
    h1: [2.2, 4.4], rhythm: 'airy', motion: 'static',
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES);

/** Значения поля «Архитектура главной страницы» редактора Landing Studio → семейства архитектур. */
export const LEGACY_FAMILIES = {
  catalog: ['catalog', 'product-first'],
  editorial: ['editorial'],
  immersive: ['immersive'],
  service: ['split-utility', 'storytelling', 'minimal'],
  modular: ['modular-grid', 'asymmetric', 'brutalist'],
};

export const LEGACY_LABELS = {
  auto: 'Автоматически по нише',
  catalog: 'Каталог / магазин',
  editorial: 'Редакционная / журнальная',
  immersive: 'Полноэкранная / иммерсивная',
  service: 'Услуги / сервис',
  modular: 'Модульная / асимметричная',
};

export const NAV_LABELS = {
  bar: 'Горизонтальная панель: бренд слева, разделы и CTA справа',
  masthead: 'Журнальная «шапка-мастхед»: бренд по центру, разделы строкой под ним',
  overlay: 'Прозрачная навигация поверх полноэкранного визуала',
  rail: 'Вертикальная боковая панель на широких экранах, компактная строка на мобильных',
  category: 'Панель с дополнительной строкой разделов ассортимента',
  minimal: 'Только бренд и одно действие, без списка разделов',
};

export const ROLES = {
  hero: 'привлечь внимание', about: 'объяснить ценность', items: 'помочь выбрать', advantages: 'доказать',
  process: 'объяснить путь клиента', gallery: 'доказать результатом', faq: 'снять возражение', contact: 'привести к действию',
};

export const MOTION_LABELS = {
  static: 'Статичная подача: только состояния hover/focus, без анимации появления',
  reveal: 'Деликатное появление блоков при прокрутке (IntersectionObserver); контент виден и без JS; отключается при prefers-reduced-motion',
  parallax: 'Лёгкий параллакс визуала первого экрана с малой амплитудой и появление блоков; полностью отключается при prefers-reduced-motion',
};

// --- Цветовые направления: диапазоны HSL для фона (bg) и акцента (ac) ---
export const DIRECTIONS = {
  'clean-tech': { mode: 'light', label: 'светлая нейтральная технологичная: холодный почти белый фон и синий акцент', bg: [[205, 220], [14, 24], [96, 98]], ac: [[205, 228], [65, 85], [38, 46]] },
  blueprint: { mode: 'light', label: 'бумажный фон и чернильно-синий акцент', bg: [[40, 55], [18, 30], [95, 97]], ac: [[222, 240], [55, 75], [30, 40]] },
  'sunny-ink': { mode: 'light', label: 'солнечный жёлтый фон, тёмные чернила и красно-оранжевый акцент', bg: [[44, 52], [70, 90], [90, 94]], ac: [[8, 20], [70, 85], [40, 48]] },
  // На тёмных фонах тёплые акценты держатся вне «золотого» диапазона 36–54° (§5: тёмный фон с золотом — не по умолчанию).
  'night-sky': { mode: 'dark', label: 'глубокий сине-фиолетовый фон и тёплый коралловый акцент', bg: [[225, 245], [30, 45], [8, 12]], ac: [[10, 24], [80, 95], [62, 70]] },
  'warm-paper': { mode: 'light', label: 'тёплая кремовая бумага и терракотовый акцент', bg: [[32, 42], [30, 45], [93, 96]], ac: [[10, 22], [45, 60], [38, 46]] },
  roast: { mode: 'dark', label: 'тёмно-кофейный фон и карамельный акцент', bg: [[20, 30], [18, 28], [10, 14]], ac: [[22, 33], [60, 80], [62, 72]] },
  'fresh-market': { mode: 'light', label: 'свежий светло-зелёный фон и ягодно-красный акцент', bg: [[80, 110], [15, 25], [95, 97]], ac: [[0, 12], [65, 80], [42, 50]] },
  'graphite-coral': { mode: 'dark', label: 'графитово-зелёный фон и кораллово-розовый акцент', bg: [[140, 165], [8, 16], [10, 14]], ac: [[2, 14], [75, 90], [66, 72]] },
  'gallery-black': { mode: 'dark', label: 'нейтральный почти чёрный фон галереи и светлый акцент — цвет дают сами работы', bg: [[0, 360], [0, 4], [5, 8]], ac: [[0, 360], [0, 6], [92, 96]] },
  'gallery-white': { mode: 'light', label: 'белое пространство галереи и чёрный акцент — цвет дают сами работы', bg: [[0, 360], [0, 3], [98, 100]], ac: [[0, 360], [0, 6], [8, 12]] },
  aubergine: { mode: 'light', label: 'пудровый фон и баклажановый акцент', bg: [[300, 330], [14, 24], [94, 96]], ac: [[285, 310], [35, 50], [28, 36]] },
  chestnut: { mode: 'light', label: 'тёплый бежевый фон и каштаново-коричневый акцент', bg: [[25, 35], [25, 38], [90, 94]], ac: [[15, 25], [45, 60], [28, 36]] },
  'pastel-soft': { mode: 'light', label: 'мягкий мятно-голубой пастельный фон и малиновый акцент', bg: [[150, 200], [25, 40], [93, 96]], ac: [[330, 350], [55, 70], [42, 50]] },
  forest: { mode: 'dark', label: 'глубокий хвойно-зелёный фон и лаймовый акцент', bg: [[150, 170], [25, 40], [9, 13]], ac: [[70, 95], [60, 80], [62, 72]] },
  clinic: { mode: 'light', label: 'чистый светлый фон с бирюзовым оттенком и глубокий бирюзовый акцент', bg: [[165, 185], [20, 35], [95, 97]], ac: [[170, 190], [70, 90], [26, 32]] },
  signal: { mode: 'light', label: 'чистый белый фон, чёрный текст и один сигнальный насыщенный цвет', bg: [[0, 360], [0, 2], [97, 100]], ac: [[0, 360], [90, 100], [48, 54]] },
};

// --- Типографические характеры (только системные стеки: без сетевых запросов за шрифтами) ---
const OLD = '"Iowan Old Style", "Palatino Linotype", Palatino, "URW Palladio L", P052, "Book Antiqua", Georgia, serif';
const TRANS = 'Charter, "Bitstream Charter", "Sitka Text", Cambria, "PT Serif", Georgia, serif';
const DIDONE = 'Didot, "Bodoni MT", "Bodoni 72", "Noto Serif Display", "Playfair Display", "Sitka Heading", Georgia, serif';
const SLAB = 'Rockwell, "Rockwell Nova", "Roboto Slab", "DejaVu Serif", "Sitka Small", Georgia, serif';
const HUM = 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", "Segoe UI", source-sans-pro, sans-serif';
const GEO = 'Avenir, "Avenir Next", Montserrat, Corbel, "URW Gothic", "Century Gothic", "Segoe UI", sans-serif';
const NEO = 'Inter, Roboto, "Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif';
const COND = 'Bahnschrift, "DIN Alternate", "Franklin Gothic Medium", "Nimbus Sans Narrow", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, sans-serif';
const MONO = 'ui-monospace, "Cascadia Code", "JetBrains Mono", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';
const ROUND = 'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT Bold", Calibri, sans-serif';

/** Необязательные веб-шрифты Google Fonts для каждого характера (все с кириллицей): [семейство, начертания].
 *  Подключаются, только если в проекте fonts: "web"; системный стек остаётся запасным. */
export const WEB_FONTS = {
  'serif-editorial': [['Literata', '400;500;600;700'], ['Golos Text', '400;500;600;700']],
  'didone-contrast': [['Playfair Display', '400;500;600;700'], ['PT Serif', '400;700']],
  'grotesque-tight': [['Onest', '400;500;600;700;800'], ['Onest', '400;500;600;700;800']],
  'condensed-caps': [['Oswald', '400;500;600;700'], ['Onest', '400;500;600;700']],
  'mono-technical': [['JetBrains Mono', '400;500;600;700'], ['Onest', '400;500;600;700']],
  'rounded-friendly': [['Nunito', '400;600;700;800'], ['Nunito', '400;600;700;800']],
  'geometric-clean': [['Jost', '400;500;600;700'], ['Jost', '400;500;600;700']],
  'slab-sturdy': [['Roboto Slab', '400;500;600;700'], ['Golos Text', '400;500;600;700']],
};

// Несколько пар Google Fonts на каждый характер (все с кириллицей). Первая пара — прежняя WEB_FONTS.
// dw — вес заголовков для шрифтов с одним начертанием (иначе браузер рисует искусственный жирный);
// accent — каллиграфический шрифт только для коротких акцентных фраз (эффект «сменяющиеся фразы»).
const f = (family, weights = '400;500;600;700') => [family, weights];
export const WEB_FONT_PAIRS = {
  'serif-editorial': [
    { display: WEB_FONTS['serif-editorial'][0], body: WEB_FONTS['serif-editorial'][1] },
    { display: f('Lora'), body: f('Manrope', '400;500;600;700;800') },
    { display: f('Spectral'), body: f('Inter', '400;500;600;700') },
    { display: f('Merriweather', '400;700;900'), body: f('Fira Sans') },
  ],
  'didone-contrast': [
    { display: WEB_FONTS['didone-contrast'][0], body: WEB_FONTS['didone-contrast'][1] },
    { display: f('Cormorant Garamond'), body: f('Montserrat'), accent: f('Marck Script', '400') },
    { display: f('Prata', '400'), body: f('Raleway'), dw: 400 },
    { display: f('Yeseva One', '400'), body: f('Manrope', '400;500;600;700;800'), dw: 400 },
  ],
  'grotesque-tight': [
    { display: WEB_FONTS['grotesque-tight'][0], body: WEB_FONTS['grotesque-tight'][1] },
    { display: f('Inter', '400;500;600;700;800'), body: f('Inter', '400;500;600;700;800') },
    { display: f('Manrope', '400;500;600;700;800'), body: f('Manrope', '400;500;600;700;800') },
    { display: f('IBM Plex Sans'), body: f('IBM Plex Sans') },
  ],
  'condensed-caps': [
    { display: WEB_FONTS['condensed-caps'][0], body: WEB_FONTS['condensed-caps'][1] },
    { display: f('Fira Sans Extra Condensed'), body: f('Fira Sans') },
    { display: f('Russo One', '400'), body: f('Rubik'), dw: 400 },
  ],
  'mono-technical': [
    { display: WEB_FONTS['mono-technical'][0], body: WEB_FONTS['mono-technical'][1] },
    { display: f('IBM Plex Mono'), body: f('IBM Plex Sans') },
    { display: f('Fira Code'), body: f('Fira Sans') },
  ],
  'rounded-friendly': [
    { display: WEB_FONTS['rounded-friendly'][0], body: WEB_FONTS['rounded-friendly'][1] },
    { display: f('Comfortaa'), body: f('Nunito', '400;600;700;800'), accent: f('Caveat') },
    { display: f('Rubik'), body: f('Rubik') },
  ],
  'geometric-clean': [
    { display: WEB_FONTS['geometric-clean'][0], body: WEB_FONTS['geometric-clean'][1] },
    { display: f('Montserrat'), body: f('Montserrat') },
    { display: f('Unbounded'), body: f('Manrope', '400;500;600;700;800') },
    { display: f('Raleway'), body: f('Raleway'), accent: f('Bad Script', '400') },
  ],
  'slab-sturdy': [
    { display: WEB_FONTS['slab-sturdy'][0], body: WEB_FONTS['slab-sturdy'][1] },
    { display: f('Bitter'), body: f('PT Sans', '400;700') },
    { display: f('Podkova'), body: f('Fira Sans') },
  ],
};

export const TYPES = {
  'serif-editorial': { label: 'старостильная антиква в заголовках и гуманистический гротеск в тексте', display: OLD, body: HUM, weight: 500, tracking: '-0.01em', transform: 'none', k: 1 },
  'didone-contrast': { label: 'контрастная дидона крупного кегля и спокойная антиква в тексте', display: DIDONE, body: TRANS, weight: 400, tracking: '-0.02em', transform: 'none', k: 1.06 },
  'grotesque-tight': { label: 'плотный жирный гротеск с отрицательным трекингом — единая гарнитура для заголовков и текста', display: NEO, body: NEO, weight: 750, tracking: '-0.035em', transform: 'none', k: 1 },
  'condensed-caps': { label: 'узкий индустриальный гротеск прописными в заголовках и нейтральный гротеск в тексте', display: COND, body: NEO, weight: 700, tracking: '0.01em', transform: 'uppercase', k: 1.1 },
  'mono-technical': { label: 'моноширинные «технические» заголовки и нейтральный гротеск в тексте', display: MONO, body: NEO, weight: 600, tracking: '-0.04em', transform: 'none', k: 0.82 },
  'rounded-friendly': { label: 'дружелюбный округлый гротеск для заголовков и текста', display: ROUND, body: ROUND, weight: 800, tracking: '-0.01em', transform: 'none', k: 0.94 },
  'geometric-clean': { label: 'лёгкий геометрический гротеск с воздухом — единая гарнитура', display: GEO, body: GEO, weight: 500, tracking: '-0.02em', transform: 'none', k: 0.98 },
  'slab-sturdy': { label: 'крепкий брусковый шрифт в заголовках и гуманистический гротеск в тексте', display: SLAB, body: HUM, weight: 700, tracking: '-0.01em', transform: 'none', k: 0.94 },
};

export const SHAPES = {
  sharp: { label: 'прямые углы, линейки вместо теней', sm: '0px', md: '0px', lg: '0px', button: '0px' },
  soft: { label: 'малые скругления, плоские поверхности с тонкой рамкой', sm: '4px', md: '8px', lg: '12px', button: '8px' },
  round: { label: 'крупные скругления и кнопки-капсулы', sm: '10px', md: '18px', lg: '28px', button: '999px' },
};

export const BUTTONS = {
  solid: 'сплошная заливка акцентом',
  outline: 'контурная кнопка с заливкой при наведении',
  block: 'плакатная кнопка с жёсткой смещённой тенью',
  underline: 'текстовая кнопка-ссылка с толстым подчёркиванием',
  pill: 'капсула с мягкой тенью',
  ghost: 'тонированная кнопка без рамки',
  gradient: 'градиент акцента с плавной сменой оттенка',
  glow: 'сплошная заливка со свечением акцента',
  press: 'объёмная кнопка с нажатием',
  slide: 'контурная кнопка с заливкой, выезжающей слева',
  arrow: 'сплошная кнопка со стрелкой, сдвигающейся при наведении',
  double: 'двойная тонкая рамка',
  glass: 'стеклянная полупрозрачная кнопка',
  neon: 'светящийся контур акцента',
  inset: 'мягкая утопленная кнопка',
};

const re = s => new RegExp(s, 'i');

/** Профили ниш. Порядок важен: более конкретные идут раньше общих. */
export const NICHES = [
  {
    id: 'optics', label: 'Магазин оптики и приборов для наблюдений',
    kw: ['телескоп', 'оптик', 'бинокл', 'микроскоп', 'астроном'],
    candidates: ['catalog', 'product-first', 'storytelling'],
    priority: ['категории приборов', 'сценарии наблюдений', 'подбор по уровню', 'сравнение характеристик', 'доставка и гарантия'],
    goal: 'Выбрать прибор и оформить заказ', audience: 'начинающие и опытные любители наблюдений, выбирающие прибор под свой уровень и задачи',
    tone: 'увлечённый, точный, технически грамотный', itemsLabel: 'Каталог',
    directions: ['night-sky', 'clean-tech', 'blueprint'], types: ['mono-technical', 'grotesque-tight', 'geometric-clean'], motifs: ['orbits', 'dots'],
    image: 'предметная съёмка приборов на нейтральном фоне, астрофотография как контекст',
    why: 'при широком ассортименте покупателю нужно сразу увидеть категории и перейти к подбору',
  },
  {
    id: 'appliances', label: 'Интернет-магазин техники',
    kw: ['бытов', 'техник', 'электроник', 'гаджет', 'смартфон', 'ноутбук', 'appliance', 'electronics'],
    candidates: ['product-first', 'catalog', 'modular-grid'],
    priority: ['каталог и категории', 'подбор и сравнение', 'характеристики и цены', 'доверие: гарантия и сервис', 'оформление заказа'],
    goal: 'Найти подходящую технику и оформить заказ', audience: 'покупатели, сравнивающие модели по характеристикам и цене перед покупкой',
    tone: 'понятный, технологичный, надёжный', itemsLabel: 'Каталог',
    directions: ['clean-tech', 'blueprint', 'sunny-ink'], types: ['grotesque-tight', 'geometric-clean', 'mono-technical'], motifs: ['blocks', 'dots'],
    image: 'чистая предметная съёмка техники, одинаковый ракурс и фон для сравнения',
    why: 'для сложной техники первичны подбор, характеристики, сравнение и доверие',
  },
  {
    id: 'seafood', label: 'Магазин продуктов и готовых блюд с доставкой',
    kw: [re('(^|[^а-яё])рак(и|ов|ам|ами|ах|оварн)'), 'морепродукт', 'креветк', 'рыбн', 'мясн', 'суши', 'пицц', 'бургер', 'доставка еды', 'деликатес'],
    candidates: ['product-first', 'storytelling', 'immersive'],
    priority: ['продукт крупным планом', 'категории и фасовка', 'свежесть и приготовление', 'доставка', 'заказ'],
    goal: 'Оформить заказ', audience: 'люди, которые заказывают продукт к столу или событию и хотят уверенности в свежести и сроках',
    tone: 'аппетитный, тёплый, уверенный', itemsLabel: 'Ассортимент',
    directions: ['graphite-coral', 'fresh-market', 'roast'], types: ['serif-editorial', 'slab-sturdy', 'condensed-caps'], motifs: ['blobs', 'waves'],
    image: 'крупная аппетитная фотография продукта, тёплый свет, естественные фактуры',
    why: 'для магазина ассортимент и путь к покупке важнее декоративного hero',
  },
  {
    id: 'gifts', label: 'Магазин подарков, букетов и сладостей',
    kw: ['букет', 'цвет', 'флор', 'подар', 'торт', 'кондитер', 'сладк', 'шоколад'],
    candidates: ['product-first', 'editorial', 'catalog'],
    priority: ['предметная фотография', 'категории и поводы', 'состав и размер', 'доставка к дате', 'заказ'],
    goal: 'Выбрать подарок и оформить заказ', audience: 'люди, выбирающие подарок к конкретному поводу и дате',
    tone: 'праздничный, заботливый, с вниманием к деталям', itemsLabel: 'Каталог',
    directions: ['warm-paper', 'aubergine', 'pastel-soft', 'roast'], types: ['serif-editorial', 'didone-contrast', 'rounded-friendly'], motifs: ['blobs', 'arcs'],
    image: 'крупная предметная фотография на спокойном фоне, детали состава',
    why: 'подарок выбирают глазами: товар и его детали должны быть в центре',
  },
  {
    id: 'photo', label: 'Портфолио фотографа / визуального автора',
    kw: ['фотограф', 'photo', 'портфолио', 'видеограф', 'художни', 'галере', 'иллюстра'],
    candidates: ['immersive', 'editorial', 'asymmetric'],
    priority: ['работы и серии', 'истории съёмок', 'направления съёмки', 'условия и бронирование'],
    goal: 'Обсудить съёмку', audience: 'люди и компании, выбирающие автора по работам и визуальному почерку',
    tone: 'авторский, сдержанный, работы говорят сами', itemsLabel: 'Направления',
    directions: ['gallery-black', 'gallery-white', 'warm-paper'], types: ['didone-contrast', 'geometric-clean', 'grotesque-tight'], motifs: ['horizon', 'arcs'],
    image: 'авторские работы без рамок и декоративных наложений; интерфейс не спорит с изображением',
    why: 'для портфолио первичны работы и визуальное доказательство качества',
  },
  {
    id: 'cafe', label: 'Кофейня / кафе / ресторан',
    kw: ['кофе', 'кафе', 'ресторан', 'пекарн', 'бистро', 'чайн', 'coffee', 'выпечк', re('(^|[^а-яё])бар($|[^а-яё])')],
    candidates: ['editorial', 'modular-grid', 'immersive'],
    priority: ['меню и продукт', 'атмосфера', 'сценарий визита', 'адрес и часы работы'],
    goal: 'Прийти в гости или сделать заказ', audience: 'жители района и гости, выбирающие место по продукту и атмосфере',
    tone: 'тёплый, ремесленный, гостеприимный', itemsLabel: 'Меню', lead: ['items'],
    directions: ['roast', 'warm-paper', 'forest', 'sunny-ink'], types: ['serif-editorial', 'slab-sturdy', 'rounded-friendly'], motifs: ['arcs', 'waves'],
    image: 'продукт и руки бариста, естественный свет, детали интерьера',
    why: 'для кофейни первичны меню, продукт, атмосфера и способ посещения',
  },
  {
    id: 'beauty', label: 'Салон красоты / парикмахерская',
    // «салон» сам по себе слишком общий (ювелирный, свадебный, мебельный салон) — только «салон красоты».
    kw: ['салон красот', 'студия красот', 'красот', 'парикмахер', 'ногт', 'визаж', 'hair', 'барбер', 'маникюр', 'космет', 'стилист', 'бьюти', 'волос', 'бров', 'ресниц', re('(^|[^а-яё])спа($|[^а-яё])')],
    candidates: ['editorial', 'split-utility', 'asymmetric'],
    priority: ['результаты работ', 'услуги', 'мастера', 'запись'],
    goal: 'Записаться на услугу', audience: 'клиенты, выбирающие мастера по результатам работ и удобству записи',
    tone: 'мягкий, уверенный, внимательный к человеку', itemsLabel: 'Услуги',
    directions: ['aubergine', 'chestnut', 'pastel-soft'], types: ['didone-contrast', 'serif-editorial', 'geometric-clean'], motifs: ['waves', 'blobs'],
    image: 'портреты с результатом работы, мягкий свет, спокойный фон',
    why: 'для салона первичны результат, услуги, мастера, примеры работ и запись',
  },
  {
    id: 'underground', label: 'Субкультурный / экспериментальный проект',
    kw: ['тату', 'стрит', 'скейт', 'рейв', 'панк', 'винил', 'граффити', 'андеграунд'],
    candidates: ['brutalist', 'asymmetric', 'immersive'],
    priority: ['заявление и характер', 'работы / релизы', 'как связаться'],
    goal: 'Связаться или прийти', audience: 'аудитория, которая считывает визуальную смелость как знак «своих»',
    tone: 'резкий, прямой, без украшений', itemsLabel: 'Что делаем',
    directions: ['signal', 'gallery-black'], types: ['condensed-caps', 'mono-technical', 'grotesque-tight'], motifs: ['bands', 'blocks'],
    image: 'контрастная документальная съёмка без ретуши',
    why: 'графическая смелость соответствует аудитории и самой задаче проекта',
  },
  {
    id: 'fitness', label: 'Спорт и фитнес',
    kw: ['фитнес', 'спорт', 'йога', 'тренаж', 'танц', 'кроссфит', 'бассейн'],
    candidates: ['immersive', 'split-utility', 'modular-grid'],
    priority: ['атмосфера зала', 'направления и расписание', 'тренеры', 'запись на занятие'],
    goal: 'Записаться на занятие', audience: 'люди, выбирающие формат занятий и удобное расписание',
    tone: 'энергичный, собранный', itemsLabel: 'Направления',
    directions: ['signal', 'forest', 'gallery-black'], types: ['condensed-caps', 'grotesque-tight', 'geometric-clean'], motifs: ['bands', 'arcs'],
    image: 'люди в движении, контрастный свет',
    why: 'решение принимается по атмосфере и расписанию — их нужно показать сразу',
  },
  {
    id: 'medical', label: 'Клиника / медицинские услуги',
    kw: ['клиник', 'стомат', 'врач', 'медицин', 'лаборатор', 'психолог', 'ветеринар'],
    candidates: ['split-utility', 'minimal', 'modular-grid'],
    priority: ['услуги', 'специалисты', 'запись на приём', 'как проходит приём'],
    goal: 'Записаться на приём', audience: 'пациенты, которым важны ясность, спокойствие и простая запись',
    tone: 'спокойный, ясный, бережный', itemsLabel: 'Услуги',
    directions: ['clinic', 'clean-tech', 'pastel-soft'], types: ['geometric-clean', 'rounded-friendly', 'grotesque-tight'], motifs: ['dots', 'arcs'],
    image: 'светлые интерьеры и люди, без стоковых «улыбок в камеру»',
    why: 'посетитель приходит с задачей записаться — инструмент записи должен быть на первом экране',
  },
  {
    id: 'repair', label: 'Ремонт и сервис техники, транспорта и вещей',
    // Раньше «строительства»: «ремонт велосипедов» или «ремонт телефонов» — это мастерская, а не ремонт квартир.
    kw: ['велосипед', 'самокат', 'электросамокат', 'автосервис', 'шиномонтаж', 'ремонт телефон', 'ремонт смартфон', 'ремонт ноутбук', 'ремонт компьютер', 'ремонт техники', 'ремонт бытовой', 'ремонт обуви', 'ремонт часов', 'ремонт одежды', 'сервисный центр', 'мастерская по ремонту', 'мотосервис', 'ремонт авто'],
    candidates: ['split-utility', 'modular-grid', 'product-first'],
    priority: ['что ремонтируем', 'диагностика и стоимость', 'сроки', 'гарантия на работу', 'как сдать вещь в ремонт'],
    goal: 'Записаться на диагностику или ремонт', audience: 'владельцы техники и транспорта, которым нужно быстро и предсказуемо вернуть вещь в строй',
    tone: 'деловой, честный, мастеровой', itemsLabel: 'Что ремонтируем',
    directions: ['graphite-coral', 'sunny-ink', 'blueprint', 'forest'], types: ['condensed-caps', 'slab-sturdy', 'mono-technical'], motifs: ['bands', 'blocks'],
    image: 'мастерская, руки мастера, инструмент и деталь крупным планом',
    why: 'в ремонт приходят с поломкой: важно сразу увидеть, что чинят, как узнать цену и когда будет готово',
  },
  {
    id: 'construction', label: 'Строительство, ремонт и бытовые услуги',
    kw: ['ремонт', 'строит', 'отделк', 'клининг', 'сантех', 'электрик', 'монтаж', 'кровл', 'окна', 'уборк'],
    candidates: ['split-utility', 'modular-grid', 'storytelling'],
    priority: ['услуги и объём работ', 'этапы и сроки', 'примеры объектов', 'заявка на расчёт'],
    goal: 'Оставить заявку на расчёт', audience: 'владельцы жилья и бизнеса, которым важны предсказуемые сроки и понятная смета',
    tone: 'деловой, конкретный, надёжный', itemsLabel: 'Услуги',
    directions: ['blueprint', 'sunny-ink', 'forest', 'clean-tech'], types: ['grotesque-tight', 'slab-sturdy', 'condensed-caps'], motifs: ['blocks', 'bands'],
    image: 'реальные объекты «до/после», процесс работ',
    why: 'услугу заказывают через заявку: предложение и инструмент действия стоят рядом',
  },
  {
    id: 'education', label: 'Обучение и курсы',
    kw: ['курс', 'школ', 'обучен', 'репетитор', 'тренинг', 'академ', 'урок'],
    candidates: ['storytelling', 'minimal', 'modular-grid'],
    priority: ['результат обучения', 'программа', 'как проходит обучение', 'запись'],
    goal: 'Записаться на обучение', audience: 'люди, которые хотят понять результат и формат до того, как записаться',
    tone: 'поддерживающий, структурный', itemsLabel: 'Программа',
    directions: ['sunny-ink', 'pastel-soft', 'blueprint'], types: ['slab-sturdy', 'rounded-friendly', 'grotesque-tight'], motifs: ['blocks', 'arcs'],
    image: 'процесс занятий и результаты учеников',
    why: 'сложный продукт объясняется по шагам — от результата к программе и записи',
  },
  {
    id: 'saas', label: 'Цифровой продукт / IT-сервис',
    kw: ['saas', 'приложен', 'платформ', 'софт', 'стартап', 'crm', re('(^|[^a-z])api($|[^a-z])'), 'разработк', re('(^|[^a-zа-яё])it($|[^a-zа-яё])')],
    candidates: ['storytelling', 'asymmetric', 'minimal'],
    priority: ['задача пользователя', 'как работает продукт', 'возможности', 'начало работы'],
    goal: 'Начать пользоваться продуктом', audience: 'специалисты и команды, оценивающие, решает ли продукт их задачу',
    tone: 'точный, современный, без лишних слов', itemsLabel: 'Возможности',
    directions: ['night-sky', 'clean-tech', 'signal'], types: ['grotesque-tight', 'mono-technical', 'geometric-clean'], motifs: ['dots', 'blocks'],
    image: 'интерфейс продукта и схемы работы вместо абстрактных иллюстраций',
    why: 'сложный продукт требует последовательного рассказа с управляемым ритмом',
  },
  {
    id: 'events', label: 'События и праздники',
    kw: ['событи', 'свадьб', 'фестивал', 'концерт', 'ивент', 'праздник', 'event'],
    candidates: ['immersive', 'storytelling', 'asymmetric'],
    priority: ['атмосфера события', 'программа / форматы', 'организация', 'заявка'],
    goal: 'Обсудить событие', audience: 'люди, которые выбирают эмоцию и уверенность в организации',
    tone: 'эмоциональный, праздничный', itemsLabel: 'Форматы',
    directions: ['night-sky', 'aubergine', 'warm-paper'], types: ['didone-contrast', 'condensed-caps', 'serif-editorial'], motifs: ['horizon', 'arcs'],
    image: 'репортажные кадры события, свет и люди',
    why: 'эмоциональный бренд убеждает погружением в атмосферу',
  },
  {
    id: 'proservices', label: 'Профессиональные услуги и консультации',
    kw: ['юрист', 'юридич', 'адвокат', 'бухгалт', 'консалт', 'консультац', 'страхов', 'финанс', 'аудит', 'нотариус', 'риелтор', 'недвижим'],
    candidates: ['minimal', 'split-utility', 'editorial'],
    priority: ['предложение', 'направления работы', 'порядок работы', 'заявка на консультацию'],
    goal: 'Оставить заявку на консультацию', audience: 'клиенты с конкретным вопросом, которым важны компетентность и ясные условия',
    tone: 'сдержанный, компетентный', itemsLabel: 'Направления',
    directions: ['blueprint', 'forest', 'chestnut'], types: ['serif-editorial', 'grotesque-tight', 'didone-contrast'], motifs: ['blocks', 'bands'],
    image: 'портреты специалистов и рабочая среда, без стоковых рукопожатий',
    why: 'узкое предложение и лидогенерация выигрывают от минимума отвлечений',
  },
  {
    id: 'studio', label: 'Студия / агентство / креативный сервис',
    kw: ['студия', 'агентств', 'дизайн', 'бренд', 'архитект', 'интерьер', 'маркетинг', 'конструктор', 'лендинг'],
    candidates: ['asymmetric', 'editorial', 'modular-grid'],
    priority: ['подход и почерк', 'услуги', 'работы', 'начало проекта'],
    goal: 'Обсудить проект', audience: 'заказчики, выбирающие исполнителя по почерку и подходу',
    tone: 'авторский, уверенный', itemsLabel: 'Услуги',
    directions: ['signal', 'gallery-white', 'warm-paper', 'forest'], types: ['grotesque-tight', 'didone-contrast', 'mono-technical'], motifs: ['blocks', 'arcs', 'bands'],
    image: 'кейсы и фрагменты работ крупно',
    why: 'креативному бренду нужна композиция с характером, а не типовой симметричный экран',
  },
  {
    id: 'multi', label: 'Многопрофильная компания',
    kw: ['холдинг', 'группа компаний', 'центр услуг', 'многопрофил'],
    candidates: ['modular-grid', 'split-utility', 'catalog'],
    priority: ['направления деятельности', 'быстрый вход в нужный раздел', 'контакты'],
    goal: 'Перейти к нужному направлению', audience: 'разные группы посетителей, каждая со своей задачей',
    tone: 'структурный, нейтральный', itemsLabel: 'Направления',
    directions: ['clean-tech', 'blueprint', 'forest'], types: ['geometric-clean', 'grotesque-tight'], motifs: ['blocks', 'dots'],
    image: 'по одному характерному изображению на направление',
    why: 'нескольким равноправным сценариям входа нужна модульная сетка',
  },
  {
    id: 'boutique', label: 'Бутик / ювелирные изделия и аксессуары',
    kw: ['ювелир', 'украшен', 'бриллиант', 'золот', 'часы', 'часов', 'бутик', 'парфюм', 'кожгалантер', 'сумк', 'аксессуар'],
    candidates: ['editorial', 'immersive', 'product-first', 'minimal'],
    priority: ['изделия крупным планом', 'коллекции', 'материалы и происхождение', 'изготовление на заказ', 'личная консультация'],
    goal: 'Выбрать изделие или записаться на консультацию', audience: 'покупатели, выбирающие изделие для себя или в подарок и ценящие материал, мастерство и сервис',
    tone: 'сдержанный, точный, уважительный', itemsLabel: 'Коллекции',
    directions: ['gallery-white', 'gallery-black', 'aubergine', 'warm-paper'], types: ['didone-contrast', 'serif-editorial', 'geometric-clean'], motifs: ['arcs', 'horizon'],
    image: 'макросъёмка изделий на нейтральном фоне, мягкий направленный свет, фактура металла и камня',
    why: 'покупку изделия решают детали и доверие — им нужен крупный визуал и спокойная подача',
  },
  {
    id: 'furniture', label: 'Мебель и предметы интерьера',
    kw: ['мебел', 'диван', 'кресл', 'шкаф', 'кухни на заказ', 'матрас', 'кроват', 'стол и стул', 'предметы интерьера', 'светильник'],
    candidates: ['catalog', 'immersive', 'product-first', 'editorial'],
    priority: ['комнаты и категории', 'материалы и размеры', 'изготовление и сроки', 'доставка и сборка', 'шоурум или консультация'],
    goal: 'Подобрать мебель и оформить заказ', audience: 'люди, обставляющие дом или офис, которым важны размеры, материалы и сроки доставки',
    tone: 'спокойный, домашний, точный в деталях', itemsLabel: 'Каталог',
    directions: ['warm-paper', 'chestnut', 'forest', 'gallery-white'], types: ['serif-editorial', 'geometric-clean', 'grotesque-tight'], motifs: ['arcs', 'horizon'],
    image: 'мебель в интерьере при дневном свете и детали материалов крупно',
    why: 'мебель выбирают глазами и по размерам: нужен крупный визуал и быстрый вход в категории комнат',
  },
  {
    id: 'apparel', label: 'Одежда и обувь',
    kw: ['одежд', 'обув', 'платье', 'трикотаж', 'футболк', 'кроссовк', 'худи', 'бельё', 'белье', 'верхняя одежда', 'детская одежда', 'бренд одежды'],
    candidates: ['modular-grid', 'catalog', 'immersive', 'editorial'],
    priority: ['новая коллекция', 'категории', 'размеры и посадка', 'обмен и возврат', 'доставка'],
    goal: 'Выбрать вещь и оформить заказ', audience: 'покупатели, которые выбирают вещь по образу, посадке и размеру',
    tone: 'живой, стильный, без пафоса', itemsLabel: 'Каталог',
    directions: ['gallery-white', 'signal', 'graphite-coral', 'pastel-soft'], types: ['condensed-caps', 'grotesque-tight', 'didone-contrast'], motifs: ['bands', 'blocks'],
    image: 'вещи на людях в реальных ситуациях и плоские раскладки для каталога',
    why: 'одежду покупают образами: важны лукбук, категории и понятные размеры',
  },
  {
    id: 'music', label: 'Музыкальные инструменты и оборудование',
    kw: ['музык', 'гитар', 'синтезатор', 'пианино', 'фортепиано', 'барабан', 'укулеле', 'винил', 'звуков', 'микрофон', 'dj'],
    candidates: ['catalog', 'storytelling', 'product-first'],
    priority: ['категории инструментов', 'подбор под уровень и стиль', 'проверка и настройка', 'доставка', 'консультация'],
    goal: 'Подобрать инструмент и оформить заказ', audience: 'начинающие и опытные музыканты, а также родители, выбирающие первый инструмент ребёнку',
    tone: 'увлечённый, дружелюбный, со знанием дела', itemsLabel: 'Каталог',
    directions: ['night-sky', 'roast', 'graphite-coral', 'sunny-ink'], types: ['condensed-caps', 'serif-editorial', 'grotesque-tight'], motifs: ['waves', 'bands'],
    image: 'инструменты крупно в тёплом свете, руки музыканта, сцена и репетиция как контекст',
    why: 'инструмент выбирают по звучанию и уровню: нужны категории и подбор, а не только витрина',
  },
  {
    id: 'shop', label: 'Интернет-магазин',
    // Одежда, обувь, мебель и инструменты — в своих профилях выше: общий магазин не должен их перебивать.
    kw: ['магазин', 'маркет', 'shop', 'store', 'товар', 'ассортимент'],
    candidates: ['catalog', 'product-first', 'modular-grid'],
    priority: ['ассортимент и категории', 'товары', 'условия покупки', 'оформление заказа'],
    goal: 'Выбрать товар и оформить заказ', audience: 'покупатели, которые хотят быстро найти нужный товар',
    tone: 'понятный, деловой', itemsLabel: 'Каталог',
    directions: ['clean-tech', 'warm-paper', 'sunny-ink', 'fresh-market'], types: ['grotesque-tight', 'geometric-clean', 'rounded-friendly'], motifs: ['blocks', 'dots'],
    image: 'единообразная предметная съёмка',
    why: 'для магазина ассортимент и путь к покупке важнее декоративного hero',
  },
];

export const GENERIC_NICHE = {
  id: 'generic', label: 'Услуги / бизнес общего профиля', kw: [],
  candidates: ['split-utility', 'modular-grid', 'minimal'],
  priority: ['предложение', 'услуги', 'порядок работы', 'способ связи'],
  goal: 'Оставить заявку', audience: 'потенциальные клиенты, которым нужно быстро понять предложение и связаться',
  tone: 'ясный, нейтральный', itemsLabel: 'Услуги',
  directions: ['clean-tech', 'warm-paper', 'forest', 'blueprint'], types: ['grotesque-tight', 'geometric-clean', 'slab-sturdy'], motifs: ['blocks', 'arcs'],
  image: 'реальные фотографии продукта, людей и процесса вместо стоковых',
  why: 'ниша не определена однозначно — выбрана универсальная сервисная композиция с ясным действием',
};
