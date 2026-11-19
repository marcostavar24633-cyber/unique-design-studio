import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_STAGES, validateContentStage, mergeContentStage, generateContentInStages, regenerateContentStage, editContentField, EDITABLE_CONTENT_FIELDS } from '../worker/content-engine.js';

const answers = {
  strategy: { brand: 'Зерно', niche: 'кофейня', title: 'Кофе рядом', description: 'Свежий кофе каждый день', cta: 'Выбрать напиток', targetAudience: 'Жители района', mainOffer: 'Кофе и выпечка', visualDirection: 'Тёплый минимализм', strategySummary: 'Локальная кофейня с акцентом на свежесть' },
  about: { aboutTitle: 'О кофейне', aboutText: 'Готовим кофе каждый день.' },
  services: { servicesTitle: 'Меню', servicesIntro: 'Напитки и выпечка.', services: [['Капучино', 'Эспрессо с молоком', '']] },
  trust: { advantagesTitle: 'Почему мы', advantages: [['Свежая обжарка', 'Зёрна обжариваются небольшими партиями']], processTitle: 'Как заказать', process: [['Выберите напиток', 'Оформите заказ у бариста']], faqs: [['Где мы находимся?', 'В центре района']] },
  seo: { contactTitle: 'Ждём вас', contactText: 'Загляните за кофе.', assumptions: [], marketResearch: '', researchSources: [], segments: [], objections: [], triggers: [], keywords: ['кофейня'], competitors: [], seoTitle: 'Кофейня Зерно', seoDescription: 'Кофе и выпечка рядом', imagePrompts: [] },
};

const mock = (sequence = Object.values(answers)) => {
  const calls = [];
  return {
    calls,
    runTextModel: async (_env, model, options) => {
      calls.push({ model, options });
      const next = sequence[Math.min(calls.length - 1, sequence.length - 1)];
      return { result: { response: typeof next === 'string' ? next : JSON.stringify(next), usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }, provider: 'cloudflare', model };
    },
  };
};

const base = { env: {}, model: 'test-model', brief: { niche: 'кофейня', brand: 'Зерно' }, facts: 'Ниша: кофейня', studioPrompt: 'Пиши тепло', formatNote: '', preferNvidia: false };

test('каждый этап проверяет обязательные поля и не принимает пустые значения', () => {
  assert.equal(validateContentStage(CONTENT_STAGES[0], answers.strategy).ok, true);
  assert.deepEqual(validateContentStage(CONTENT_STAGES[0], { title: ' ', description: 'x', cta: 'y' }).missing, ['title']);
});

test('проверка этапов отклоняет неверную структуру массивов и объектов', () => {
  const trust = CONTENT_STAGES.find(stage => stage.id === 'trust');
  assert.equal(validateContentStage(trust, { ...answers.trust, advantages: ['просто строка'] }).ok, false);
  const seo = CONTENT_STAGES.find(stage => stage.id === 'seo');
  assert.equal(validateContentStage(seo, { ...answers.seo, segments: [{ name: 'Аудитория' }] }).ok, false);
});

test('результаты этапа объединяются только по разрешённым полям', () => {
  const target = { title: 'Старый' };
  mergeContentStage(target, CONTENT_STAGES[0], { title: 'Новый', injected: 'не добавлять' });
  assert.equal(target.title, 'Новый');
  assert.equal('injected' in target, false);
});

test('генератор выполняет пять независимых этапов и объединяет их в единый landing', async () => {
  const ai = mock();
  const result = await generateContentInStages({ ...base, runTextModel: ai.runTextModel });
  assert.equal(result.generation.status, 'completed');
  assert.equal(result.generation.completedStages, 5);
  assert.equal(ai.calls.length, 5);
  assert.equal(result.landing.title, answers.strategy.title);
  assert.deepEqual(result.landing.services, answers.services.services);
  assert.equal(result.landing.seoTitle, answers.seo.seoTitle);
  assert.equal(result.usage.totalTokens, 150);
  assert.equal(result.generation.stages.every(stage => stage.status === 'completed'), true);
});

test('повторяется только неуспешный этап, ранее созданные этапы не запускаются повторно', async () => {
  const sequence = [answers.strategy, { aboutTitle: '' }, answers.about, answers.services, answers.trust, answers.seo];
  const ai = mock(sequence);
  const result = await generateContentInStages({ ...base, runTextModel: ai.runTextModel });
  assert.equal(result.generation.status, 'completed');
  assert.equal(ai.calls.length, 6);
  assert.deepEqual(result.generation.stages.map(stage => stage.attempts), [1, 2, 1, 1, 1]);
  assert.equal(result.landing.aboutTitle, answers.about.aboutTitle);
});

test('при двух ошибках возвращаются готовые разделы и явный статус partial', async () => {
  const sequence = [answers.strategy, { aboutTitle: '' }, { aboutTitle: '' }];
  const ai = mock(sequence);
  const result = await generateContentInStages({ ...base, runTextModel: ai.runTextModel });
  assert.equal(result.generation.status, 'partial');
  assert.equal(result.generation.failedStage, 'about');
  assert.equal(result.generation.completedStages, 1);
  assert.equal(result.landing.title, answers.strategy.title);
  assert.equal(result.landing.aboutTitle, undefined);
  assert.equal(ai.calls.length, 3);
});


test('точечная перегенерация возвращает только разрешённые поля выбранного этапа', async () => {
  const ai = mock([answers.about]);
  const result = await regenerateContentStage({
    ...base, stageId: 'about', existingLanding: { title: 'Не менять', aboutTitle: 'Старое', injected: 'нет' },
    editorialDirection: 'Тепло и лаконично', runTextModel: ai.runTextModel,
  });
  assert.equal(result.stage.status, 'completed');
  assert.equal(result.stage.id, 'about');
  assert.deepEqual(result.content, answers.about);
  assert.equal(ai.calls.length, 1);
  assert.equal(ai.calls[0].options.max_tokens, CONTENT_STAGES.find(stage => stage.id === 'about').maxTokens);
  assert.match(ai.calls[0].options.messages[0].content, /Тепло и лаконично/);
  assert.match(ai.calls[0].options.messages[0].content, /Не менять/);
  assert.equal('injected' in result.content, false);
});

test('точечная перегенерация повторяет только выбранный этап при невалидном JSON-контракте', async () => {
  const ai = mock([{ aboutTitle: '' }, answers.about]);
  const result = await regenerateContentStage({ ...base, stageId: 'about', runTextModel: ai.runTextModel });
  assert.equal(result.stage.status, 'completed');
  assert.equal(result.stage.attempts, 2);
  assert.equal(ai.calls.length, 2);
});

test('неизвестный этап точечной перегенерации отклоняется', async () => {
  const ai = mock();
  await assert.rejects(() => regenerateContentStage({ ...base, stageId: 'not-a-stage', runTextModel: ai.runTextModel }), /Неизвестный этап/);
  assert.equal(ai.calls.length, 0);
});


test('AI-редактор переписывает, расширяет и сокращает только одно разрешённое поле', async () => {
  for (const action of ['rewrite','expand','shorten']) {
    const ai = mock([{ value: 'Новый вариант текста.' }]);
    const result = await editContentField({
      ...base, field: 'description', action, currentValue: 'Исходный текст.',
      existingLanding: { title: 'Кофе рядом', description: 'Исходный текст.' },
      editorialDirection: 'Спокойный тон', runTextModel: ai.runTextModel,
    });
    assert.equal(result.field, 'description');
    assert.equal(result.action, action);
    assert.equal(result.value, 'Новый вариант текста.');
    assert.equal(result.attempts, 1);
    assert.equal(ai.calls[0].options.max_tokens, 700);
    assert.match(ai.calls[0].options.messages[0].content, /Исходный текст/);
    assert.match(ai.calls[0].options.messages[0].content, /Спокойный тон/);
  }
});

test('AI-редактор ограничивает поля и команды, не вызывает модель при некорректном вводе', async () => {
  const ai = mock();
  await assert.rejects(() => editContentField({ ...base, field: 'services', action: 'rewrite', currentValue: 'x', runTextModel: ai.runTextModel }), /нельзя редактировать/);
  await assert.rejects(() => editContentField({ ...base, field: 'title', action: 'invent', currentValue: 'x', runTextModel: ai.runTextModel }), /Неизвестная команда/);
  await assert.rejects(() => editContentField({ ...base, field: 'title', action: 'rewrite', currentValue: ' ', runTextModel: ai.runTextModel }), /Сначала введите текст/);
  assert.equal(EDITABLE_CONTENT_FIELDS.has('seoTitle'), true);
  assert.equal(ai.calls.length, 0);
});

test('AI-редактор повторяет невалидный ответ и принимает только непустую строку', async () => {
  const ai = mock([{ value: '' }, { value: 'Исправленный текст.' }]);
  const result = await editContentField({ ...base, field: 'title', action: 'rewrite', currentValue: 'Старый текст', runTextModel: ai.runTextModel });
  assert.equal(result.value, 'Исправленный текст.');
  assert.equal(result.attempts, 2);
  assert.equal(ai.calls.length, 2);
});

test('все этапы идут без рассуждений Gemma, а свой промт владельца получают и этапы после первого', async () => {
  const ai = mock();
  const brief = { ...base.brief, customPrompt: 'Без слова лучший', customPromptMode: 'append' };
  await generateContentInStages({ ...base, brief, runTextModel: ai.runTextModel });
  assert.equal(ai.calls.length, 5);
  assert.ok(ai.calls.every(call => call.options.chat_template_kwargs?.enable_thinking === false), 'рассуждения не выключены на каком-то этапе');
  // Первый этап получает промт внутри studioPrompt, остальные — отдельной строкой.
  for (const call of ai.calls.slice(1)) assert.match(call.options.messages[0].content, /Пожелания владельца \(дополнительно\): Без слова лучший/);
});

test('поэтапная генерация возвращает маршрут ответа (шлюз или напрямую)', async () => {
  const ai = mock();
  const viaGateway = async (...args) => ({ ...(await ai.runTextModel(...args)), route: 'gateway' });
  const result = await generateContentInStages({ ...base, runTextModel: viaGateway });
  assert.equal(result.route, 'gateway');
});
