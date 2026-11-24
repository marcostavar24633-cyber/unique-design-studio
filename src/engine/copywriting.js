// Специализированная система задания для контентной и маркетинговой генерации.
// Это единый контракт модулей: каждый отвечает за отдельную часть результата,
// но выход остаётся одним JSON, совместимым с существующим генератором.
export const COPYWRITING_MODULES = Object.freeze([
  { id: 'market-intelligence', title: 'Market Intelligence', task: 'Исследуй реальные предложения конкурентов, клиентские отзывы и рыночные паттерны. Отделяй проверенные факты от гипотез; указывай URL источников.' },
  { id: 'audience-psychology', title: 'Audience Psychology', task: 'Сегментируй аудиторию по ситуации покупки, мотивации, желаемому результату, страхам, возражениям, критериям выбора и триггерам обращения.' },
  { id: 'brand-strategy', title: 'Brand Strategy', task: 'Сформулируй позиционирование, обещание бренда, дифференциацию, доказательства и характер коммуникации.' },
  { id: 'conversion-copy', title: 'Conversion Copywriting', task: 'Создай тексты, которые отвечают на вопросы клиента на каждом этапе решения, снимают конкретные сомнения и ведут к уместному действию без давления.' },
  { id: 'seo-content', title: 'SEO Content', task: 'Подготовь поисковую структуру и метаданные без переспама; не заявляй частотность без инструмента проверки.' },
  { id: 'visual-direction', title: 'Visual Content Direction', task: 'Свяжи смысл каждой секции с композицией, изображением, кадрированием, светом и визуальной иерархией.' },
  { id: 'motion-direction', title: 'Motion Direction', task: 'Предложи только уместные механики движения исходя из характера бренда, архитектуры и устройства; не включай эффекты ради эффекта.' },
  { id: 'quality-control', title: 'Quality Control', task: 'Проверь достоверность, связность, конкретику, отсутствие повторов, соответствие аудитории, конверсионную логику и готовность данных к сборке.' },
]);

const dataLine = value => {
  const readable = value && typeof value === 'object' ? value.text ?? value.label ?? value.name ?? value.title ?? '' : value;
  return String(readable ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500);
};
const lines = values => (Array.isArray(values) && values.length
  ? values.slice(0, 50).map(value => '- ' + dataLine(value)).join('\n')
  : '- Нет подтверждённых данных — не выдумывать.');

// Расширенный контракт — только для внешних AI (кнопка «Промт для AI»). Для Worker студии он лишний: студия
// эти разделы не читает, а вместе с ограничением формата Worker давал противоречие — модель тратила весь
// лимит токенов на рассуждения и не успевала ответить (живой замер: 2 × 6000 токенов, пустой ответ).
const EXTENDED_CONTRACT = `## Совместимость результата
Сохрани все существующие поля JSON-контракта Unique Design Studio. Дополнительно верни:
- brandStrategy: { positioning, promise, differentiators, proofNeeded, brandVoice }
- audienceProfiles: [{ segment, situation, motivation, desiredOutcome, fears, objections, decisionCriteria, triggers }]
- competitorAnalysis: [{ name, offer, strengths, gaps, sourceUrl }]
- conversionMap: [{ sectionId, decisionStage, visitorQuestion, objection, response, desiredAction }]
- sectionContent: [{ id, goal, headline, subheadline, body, cta, visualBrief }]
- visualBrief: [{ sectionId, subject, framing, lighting, palette, mood, composition, aspectRatio }]
- motionBrief: { intensity, selectedMechanics, rationale, accessibility }
- qualityReport: { score, checks, issues, revisions }
- researchStatus: "performed" | "not_performed" | "partial"

Все дополнительные поля должны быть валидным JSON. Не добавляй Markdown вокруг JSON.`;

export function buildCopywritingSystemBrief(project, concept, analysis = {}, opts = {}) {
  const p = project || {};
  analysis = analysis && typeof analysis === 'object' ? analysis : {};
  opts = opts && typeof opts === 'object' ? opts : {};
  const d = concept?.designDNA || concept?.designBrief || {};
  const homepage = concept?.homepage || {};
  const sectionIds = Array.isArray(homepage.sections)
    ? homepage.sections.map(section => section.id).filter(Boolean)
    : [];
  const sectionNames = Array.isArray(homepage.sections)
    ? homepage.sections.map(section => `${section.id} (${section.role || section.id})`)
    : [];
  const moduleIds = new Set(['market-intelligence', 'audience-psychology', 'brand-strategy', 'conversion-copy', 'seo-content', 'quality-control']);
  if (sectionIds.includes('gallery') || sectionIds.includes('hero') || sectionIds.includes('items')) moduleIds.add('visual-direction');
  if (homepage.motionDirection || concept?.visualSystem?.effects) moduleIds.add('motion-direction');
  const modules = COPYWRITING_MODULES
    .filter(module => moduleIds.has(module.id))
    .map((module, i) => `${i + 1}. ${module.title}: ${module.task}`)
    .join('\n');
  return `# AUTONOMOUS CONTENT & BRAND SYSTEM — SPECIALIST MODULES

Работай как слаженная команда специализированных направлений. Выполняй этапы последовательно, но без остановки на согласование промежуточных результатов. Не имитируй реальное исследование: если веб-поиск недоступен, явно укажи это и сформируй проверяемые гипотезы.

${modules}

## Входной контекст
- Ниша: ${p.niche || 'не указана'}
- Бренд: ${p.brand || 'не указан'}
- Описание предложения: ${p.mainOffer || 'не указано'}
- Целевая аудитория: ${p.targetAudience || d.audience || 'определи гипотезы'}
- Цель: ${p.primaryGoal || d.primaryGoal || homepage.primaryCTA || 'получение целевых обращений'}
- Класс проекта: ${p.tier || 'standard'}
- Характер бренда: ${p.brandCharacter || d.brandCharacter || 'определи по нише и предложению'}
- Визуальное направление: ${p.visualDirection || 'выбери самостоятельно'}
    - Исходные сегменты: ${lines((Array.isArray(analysis.segments) ? analysis.segments : []).map(s => typeof s === 'string' ? s : `${dataLine(s?.name)}: ${dataLine(s?.need)}`))}
- Известные возражения: ${lines(analysis.objections)}
- Ограничения проекта: ${lines(p.assumptions)}

## Обязательная глубина проработки
1. Исследуй 5–10 релевантных конкурентов, если доступен поиск. Для каждого фиксируй реальное отличие, предложение, структуру и подтверждающий URL. Не копируй формулировки и дизайн.
2. Определи 2–5 сегментов аудитории. Для каждого укажи контекст покупки, мотивацию, желаемый результат, тревоги, барьеры, критерии выбора, возражения и аргументы, которые могут их снять.
3. Сформулируй одно ясное позиционирование, основное обещание, 3 потенциальных доказательства и список того, что владелец должен подтвердить.
4. Создай Brand Voice: тон, словарь, ритм, характер заголовков, CTA, запрещённые клише и примеры корректной формулировки.
5. Работай только с секциями из утверждённого плана ниже. Для каждой укажи её маркетинговую задачу, вопрос посетителя и уместный текст. Не создавай контент для отсутствующих секций и не расширяй план страницы.
6. Построй путь пользователя от первого экрана до обращения. Убери повторы и конкурирующие CTA.
7. Создай SEO-метаданные, структуру H1–H3, группы запросов и ALT. Частотность не указывать без фактической проверки.
8. Подготовь визуальные задания только для секций из плана, где изображение помогает смыслу; не создавай задания для отсутствующих секций.
9. Если концепция предусматривает движение, предложи только уместные эффекты. Иначе укажи низкую интенсивность и не добавляй анимацию ради заполнения Motion Brief. Всегда учитывай мобильные устройства и prefers-reduced-motion.
10. Проведи финальную проверку и автоматически перепиши слабые фрагменты.

## План секций страницы
${sectionNames.length ? sectionNames.map(name => `- ${name}`).join('\n') : '- Секции не переданы; не придумывай их.'}
В sectionContent и visualBrief включай только записи, относящиеся к этому плану; не предлагай новые секции.

## Правила достоверности
- Не выдумывай цены, скидки, отзывы, имена клиентов, кейсы, награды, сертификаты, гарантии, адреса, телефоны, сроки, объёмы и характеристики.
- Не выдавай рыночную гипотезу за факт о конкретном бизнесе.
- Любое утверждение о владельце, которое требует подтверждения, помести в assumptions.
- Если веб-исследование не проводилось, прямо укажи researchStatus: "not_performed".
- Тексты должны быть конкретными, естественными и написанными для человека, а не для поискового робота.

${opts.forWorker ? '' : EXTENDED_CONTRACT}
`;
}
