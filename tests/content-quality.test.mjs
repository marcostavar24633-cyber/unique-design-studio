import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreContentQuality, reviewContentQuality } from '../worker/content-quality.js';

test('детерминированная оценка отмечает отсутствующие ключевые поля и SEO длину', () => {
  const report = scoreContentQuality({ title:'', description:'', cta:'', seoTitle:'x'.repeat(70), seoDescription:'y'.repeat(170) });
  assert.ok(report.score < 100);
  assert.ok(report.findings.some(item => item.id === 'title-missing'));
  assert.ok(report.findings.some(item => item.id === 'seo-title-long'));
  assert.ok(report.findings.some(item => item.id === 'seo-description-long'));
});

test('детерминированная оценка выявляет повторения и неподтверждённые обещания', () => {
  const repeated = 'Качественный сервис для клиента. '.repeat(6);
  const report = scoreContentQuality({ title: repeated, description: repeated, cta:'Записаться', seoTitle:'Сервис', seoDescription:'Описание' });
  assert.ok(report.findings.some(item => item.id === 'repetition'));
  const claims = scoreContentQuality({ title:'Гарантируем лучший результат', description:'100% результат без риска', cta:'Связаться' });
  assert.ok(claims.findings.some(item => item.id === 'claims-review'));
});

test('AI review возвращает только рекомендации, не изменяет контент и не заявляет веб-поиск', async () => {
  let options;
  const result = await reviewContentQuality({
    env:{}, model:'test-model',
    project:{ niche:'кофейня', title:'Кофе рядом', description:'Кофейня у дома', cta:'Открыть меню' },
    editorialDirection:'Спокойный тон',
    runTextModel:async (_env,model,opts)=>{
      options=opts;
      return { provider:'cloudflare', model, result:{ response:JSON.stringify({ recommendations:[
        { category:'seo', priority:'high', issue:'Нет локального контекста', recommendation:'Уточните район, если он известен владельцу.', field:'seoDescription' },
        { category:'invalid', priority:'urgent', issue:'Проверка', recommendation:'Проверить', field:'unknown' },
      ]}), usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30} } };
    },
  });
  assert.equal(result.review.recommendations.length,2);
  assert.equal(result.review.recommendations[0].category,'seo');
  assert.equal(result.review.recommendations[1].category,'content');
  assert.equal(result.review.recommendations[1].field,'');
  assert.equal(result.review.safety.contentChanged,false);
  assert.equal(result.review.safety.webSearchPerformed,false);
  assert.equal(result.usage.totalTokens,30);
  assert.equal(options.max_tokens,1300);
});
