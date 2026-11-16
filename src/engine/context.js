// Контекст проекта → сигналы для выбора архитектуры и имя итоговой концепции.
// Сигналы — небольшие поправки к оценке архитектур: нишу и контент они не перевешивают,
// но при близких оценках характер бренда, аудитория и задача страницы решают исход.
import { ARCHETYPES, TYPES } from './data.js';

const BRAND = [
  [/смел|дерзк|бунтар|провокац|андеграунд|уличн|радикальн/, [['brutalist', 3], ['asymmetric', 2]], 'смелый характер бренда — уместна графическая выразительность'],
  [/спокойн|тих|сдержан|минимал|лаконич|нейтральн/, [['minimal', 2], ['editorial', 1]], 'сдержанный характер бренда — меньше элементов, больше воздуха'],
  [/технолог|точн|инженер|цифров|систем/, [['modular-grid', 2], ['split-utility', 1]], 'технологичный характер бренда — ясная модульная структура'],
  [/тёпл|тепл|уютн|душевн|домашн|ремесл|ручн/, [['storytelling', 2], ['editorial', 1]], 'тёплый ремесленный характер — рассказ о людях и процессе'],
  [/роскош|элегант|изыскан|статус|утонч/, [['editorial', 2], ['immersive', 1]], 'элегантный характер бренда — редакционная подача'],
  [/энергичн|динамичн|ярк|драйв|азарт/, [['asymmetric', 2], ['immersive', 1]], 'энергичный характер бренда — динамичная композиция'],
  [/над[её]жн|солидн|эксперт|делов|корпоратив|основательн/, [['split-utility', 2], ['modular-grid', 1]], 'деловой характер бренда — ясное предложение и понятный следующий шаг'],
];
const GOAL = [
  [/запис|заявк|консультац|расч[её]т|бронир|вызвать|замер/, [['split-utility', 2]], 'задача страницы — заявка или запись: инструмент действия ближе к началу'],
  [/купить|заказ|корзин|оформить|выбрать/, [['product-first', 2], ['catalog', 1]], 'задача страницы — покупка: товар и выбор в центре'],
  [/посмотреть|портфолио|работы|познаком|увидеть/, [['immersive', 1], ['editorial', 1]], 'задача страницы — показать работы: ведущая роль у визуала'],
  [/подпис|скачать|попробовать|регистрац|демо|начать/, [['minimal', 2]], 'задача страницы — одно быстрое действие: минимум отвлечений'],
];
const AUDIENCE = [
  [/b2b|компани|бизнес|предприят|юрлиц|руководител|закупк/, [['modular-grid', 1], ['split-utility', 1]], 'деловая аудитория — структурная подача и быстрый путь к контакту'],
  [/молод|студент|подрост|зумер|творческ/, [['asymmetric', 1], ['brutalist', 1]], 'молодая аудитория — допустима более смелая композиция'],
  [/ценител|коллекционер|взыскательн|состоятельн/, [['editorial', 1], ['minimal', 1]], 'взыскательная аудитория — тихая подача без давления'],
];

// Вес сигналов намеренно мал: они работают как решающий голос при близких оценках и не меняют
// концепции проектов, где ниша и контент уже дали уверенный выбор.
const WEIGHT = 0.5;

/** @returns {Array<{id:string,n:number,why:string}>} поправки к оценке архитектур */
export function contextSignals(project) {
  const out = [];
  const scan = (text, rules) => {
    const t = String(text || '').toLowerCase();
    if (!t) return;
    for (const [re, adds, why] of rules) if (re.test(t)) adds.forEach(([id, n], i) => out.push({ id, n: n * WEIGHT, why: i === 0 ? why : '' }));
  };
  scan(`${project.brandCharacter} ${project.visualDirection}`, BRAND);
  scan(`${project.primaryGoal} ${project.cta}`, GOAL);
  scan(project.targetAudience, AUDIENCE);
  return out;
}

const SERIF = new Set(['serif-editorial', 'didone-contrast', 'slab-sturdy']);
const LAYOUT = { editorial: 'журнальный ритм секций', offset: 'смещённая двухколоночная сетка', framed: 'секции-«рамы» на тонированном фоне', quiet: 'тихий минималистичный ритм' };

/**
 * Имя и формула концепции. Имя описывает получившееся сочетание (а не выбирается из фиксированного списка шаблонов):
 * одна и та же архитектура с другим классом, вспомогательной архитектурой или типографикой даёт другую концепцию.
 */
export function conceptIdentity(design, project) {
  const a = design.primary, b = design.secondary, upscale = project.tier !== 'standard', serif = SERIF.has(design.typeCharacter);
  let name;
  if (a === 'minimal') name = upscale ? 'Minimal Luxury' : 'Focused Minimal';
  else if ((a === 'immersive' && b === 'storytelling') || (a === 'storytelling' && b === 'immersive')) name = 'Immersive Storytelling';
  else if (a === 'immersive') name = serif || design.typeCharacter === 'condensed-caps' ? 'Cinematic' : 'Immersive Showcase';
  else if (a === 'editorial') name = b === 'catalog' || b === 'product-first' ? 'Editorial Commerce' : 'Editorial';
  else if (a === 'brutalist') name = 'Brutalist';
  else if (a === 'catalog') name = 'Modern E-commerce';
  else if (a === 'product-first') name = b === 'catalog' ? 'Modern E-commerce' : 'Product Showcase';
  else if (a === 'modular-grid') name = 'Architectural Grid';
  else if (a === 'asymmetric') name = 'Asymmetric Layout';
  else if (a === 'split-utility') name = upscale || serif ? 'Premium Corporate' : 'Service Utility';
  else name = serif ? 'Narrative Scroll' : 'Guided Storytelling';
  const hybrid = b && ARCHETYPES[b] && ARCHETYPES[b].legacy !== ARCHETYPES[a].legacy && !name.includes(' Commerce') && name !== 'Immersive Storytelling';
  if (hybrid) name += ` × ${ARCHETYPES[b].name.split(' / ')[0]}`;
  const formula = [
    `архитектура ${ARCHETYPES[a].name}`,
    b ? `подача блоков от ${ARCHETYPES[b].name}` : '',
    LAYOUT[design.sectionLayout] || '',
    TYPES[design.typeCharacter] ? TYPES[design.typeCharacter].label.split(' — ')[0] : '',
    { standard: '', premium: 'класс «премиум»', luxury: 'класс «люкс»' }[project.tier] || '',
  ].filter(Boolean).join(' + ');
  return { name, formula };
}
