// Фирменные профили живых проектов: цвета, шрифты и скругления сняты из кода их репозиториев
// (итоговые значения — с учётом поздних слоёв стилей). Источник указан в `source`.
// Профиль задаёт внешний вид бренда; композицию первого экрана по-прежнему выбирает движок,
// поэтому сайты одного бренда остаются узнаваемыми, а разных — не превращаются в один шаблон.
//
// Поля: mode — светлая/тёмная база; bg, surface, text, muted, accent — основные цвета;
// display/body — гарнитуры (все есть в Google Fonts с кириллицей); radius — sm/md/lg/кнопка.

const W = {
  'Playfair Display': '400;500;600;700',
  'Cormorant Garamond': '400;500;600;700',
  Manrope: '400;500;600;700;800',
  Onest: '400;500;600;700',
  Inter: '400;500;600;700',
};
export const BRAND_FONT_WEIGHTS = W;

export const BRANDS = {
  'slopay-buket': {
    name: 'Слопай букет',
    // Живая главная — статичный редизайн из папки redesign/ (React-версия в корне репозитория — старый сайт).
    source: 'slopay-buket@37dbeaa: redesign/css/style.css',
    mode: 'dark', bg: '#0a0908', surface: '#1a1613', text: '#f3e9dc', muted: '#b3a594', accent: '#b3143f',
    display: 'Cormorant Garamond', body: 'Manrope',
    radius: { sm: '10px', md: '14px', lg: '22px', button: '999px' },
    note: 'Почти чёрная тёплая база, кремовый текст, винно-ягодные кнопки (#b3143f, текстовый акцент #e8517a) и золото в заголовках (#d9b779).',
  },
  penka: {
    name: 'ПЕНКА',
    source: 'Penka@3a44f06: index.html (встроенные стили)',
    mode: 'light', bg: '#f3f1e9', surface: '#fffdf8', text: '#202923', muted: '#59645c', accent: '#183a32',
    display: 'Cormorant Garamond', body: 'Manrope',
    radius: { sm: '3px', md: '16px', lg: '24px', button: '999px' },
    note: 'Молочная база, глубокий зелёный графит как основной цвет, приглушённое золото-терра (#b69a62) для деталей.',
  },
  raki: {
    name: 'РАКОВАРНЯ 73',
    source: 'raki@631dd17: src/styles.css',
    mode: 'dark', bg: '#101211', surface: '#1c211e', text: '#f2ede4', muted: '#a7aaa3', accent: '#ad8050',
    display: 'Cormorant Garamond', body: 'Manrope',
    radius: { sm: '12px', md: '24px', lg: '28px', button: '999px' },
    note: 'Тёмный графитово-зелёный, кремовый текст, бронзовый акцент; изумрудный неон (#65f0bd) и кораллово-розовый (#ff7185) — для интерактива; круглые фото.',
  },
  photograf: {
    name: 'Photograf',
    source: 'Photograf@ff57556: concept-rebirth.css (последний слой поверх luxury.css)',
    mode: 'dark', bg: '#171019', surface: '#281827', text: '#f2e9e8', muted: '#b8a8b0', accent: '#d7bd9a',
    display: 'Cormorant Garamond', body: 'Manrope',
    radius: { sm: '2px', md: '3px', lg: '3px', button: '999px' },
    note: 'Ночной сливовый фон с винным (#54263e), жемчужный текст, шампань-акцент; почти прямые углы.',
  },
  'doma-tech': {
    name: 'ДомА Тех',
    source: 'doma-tech@68617a6: public/rebirth.css (последний слой поверх styles.css)',
    mode: 'dark', bg: '#101317', surface: '#20272f', text: '#f4f2ed', muted: '#a5adb5', accent: '#c6a477',
    display: 'Manrope', body: 'Inter',
    radius: { sm: '10px', md: '18px', lg: '22px', button: '999px' },
    note: 'Тёмный графитовый «технологичный» фон, шампань-акцент и холодный серо-голубой второй акцент (#aab8c2).',
  },
  hair: {
    name: 'Hair',
    source: 'hair@d945c39: styles.css',
    mode: 'light', bg: '#f4efe7', surface: '#ebe3d6', text: '#16120f', muted: '#5b5047', accent: '#94451f',
    display: 'Cormorant Garamond', body: 'Onest',
    radius: { sm: '2px', md: '16px', lg: '28px', button: '999px' },
    note: 'Слоновая кость, медный акцент (#94451f, светлый #e0a57d), ночные тёмные секции (#0d0b09); сдержанные скруглённые формы.',
  },
  remont: {
    name: 'РЕМОНТ',
    source: 'remont@ca2df63: styles.css, styles-components.css, styles-luxury.css',
    mode: 'light', bg: '#faf8f3', surface: '#f4f0e8', text: '#1d2924', muted: '#686d66', accent: '#8a5a32',
    display: 'Cormorant Garamond', body: 'Manrope',
    radius: { sm: '4px', md: '12px', lg: '20px', button: '999px' },
    note: 'Бумажная светлая база, зелёно-чёрный текст, бронза (#a77a50) и золото (#c6a477) в деталях.',
  },
  'rovno-otdelka': {
    name: 'Ровно — отделка',
    source: 'rovno-otdelka@13ce657: assets/css/site.css',
    mode: 'dark', bg: '#0a0908', surface: '#12100c', text: '#f4ecdc', muted: '#948872', accent: '#aebac6',
    display: 'Playfair Display', body: 'Manrope',
    radius: { sm: '6px', md: '16px', lg: '28px', button: '999px' },
    note: 'Почти чёрная база, тёплый светлый текст, холодный стальной акцент; ягодный (#e2566c) для предупреждений.',
  },
};
