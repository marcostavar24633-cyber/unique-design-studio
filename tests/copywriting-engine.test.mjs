import test from 'node:test';
import assert from 'node:assert/strict';
import { COPYWRITING_MODULES, buildCopywritingSystemBrief } from '../src/engine/copywriting.js';

test('Copywriting Engine exposes the complete specialist pipeline', () => {
  const ids = COPYWRITING_MODULES.map(x => x.id);
  for (const id of ['market-intelligence','audience-psychology','brand-strategy','conversion-copy','seo-content','visual-direction','motion-direction','quality-control']) {
    assert.ok(ids.includes(id), id);
  }
});

test('brief is niche-aware, autonomous, evidence-safe and backward-compatible', () => {
  const brief = buildCopywritingSystemBrief(
    { niche: 'Фотограф', tier: 'premium', mainOffer: 'Авторские фотосессии', targetAudience: 'Пары и бренды' },
    { designDNA: { audience: 'Пары и бренды', primaryGoal: 'Заявки' }, homepage: { primaryCTA: 'Обсудить съёмку' } },
    { objections: ['Боюсь выглядеть скованно'] },
  );
  assert.match(brief, /Ниша: Фотограф/);
  assert.match(brief, /Боюсь выглядеть скованно/);
  assert.match(brief, /competitorAnalysis/);
  assert.match(brief, /sectionContent/);
  assert.match(brief, /motionBrief/);
  assert.match(brief, /Не выдумывай цены/);
  assert.match(brief, /без остановки на согласование/);
});
