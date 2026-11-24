import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareContentIntelligence, reviewGeneratedContent, CONTENT_INTELLIGENCE_MODULES } from '../src/engine/content-intelligence.js';

test('content intelligence prepares one prompt and exposes specialist modules', () => {
  const result = prepareContentIntelligence({ niche: 'Кофейня', brand: 'Тёплый день', tier: 'premium' });
  assert.ok(result.prompt.includes('AUTONOMOUS CONTENT'));
  assert.equal(result.researchStatus, 'not_performed');
  assert.equal(result.rules.neverInventBusinessFacts, true);
  assert.ok(result.modules.length >= 6);
  assert.equal(CONTENT_INTELLIGENCE_MODULES.length, result.modules.length);
});

test('content review catches missing required copy and cliché language', () => {
  const result = reviewGeneratedContent({
    title: 'Гарантируем лучший результат для вас',
    description: 'Индивидуальный подход и высокое качество.',
    cta: 'Заказать',
    seoTitle: 'Услуги',
    seoDescription: 'Описание услуг',
    services: [{ title: 'Услуга', text: 'Подробное описание' }],
    advantages: [{ title: 'Опыт', text: 'Работаем внимательно' }],
    process: [{ title: 'Заявка', text: 'Свяжитесь с нами' }],
    faqs: [{ title: 'Сколько стоит?', text: 'Обсудим задачу' }],
  });
  assert.equal(result.status, 'needs-work');
  assert.ok(result.findings.some(item => item.id === 'generic-copy'));
  assert.ok(result.findings.some(item => item.id === 'absolute-claim'));
});

test('content review marks numeric promises for verification, not as false', () => {
  const result = reviewGeneratedContent({
    title: 'Ремонт за 5 дней',
    description: 'Понятный процесс и связь с мастером.',
    cta: 'Обсудить проект',
    seoTitle: 'Ремонт квартир',
    seoDescription: 'Услуги ремонта квартир.',
    services: [{ title: 'Ремонт', text: 'Работа по договору' }],
    advantages: [{ title: 'Контроль', text: 'Проверка этапов' }],
    process: [{ title: 'Замер', text: 'Обсуждение' }],
    faqs: [{ title: 'Сроки?', text: 'Зависят от объёма' }],
  });
  const claim = result.findings.find(item => item.id === 'numeric-claim');
  assert.ok(claim);
  assert.equal(claim.severity, 'review');
});

test('content review does not mutate generated content', () => {
  const content = { title: 'Тест', description: 'Описание', cta: 'Связаться', seoTitle: 'Тест', seoDescription: 'Описание', services: [], advantages: [], process: [], faqs: [] };
  const before = JSON.stringify(content);
  reviewGeneratedContent(content);
  assert.equal(JSON.stringify(content), before);
});
