// Market Intelligence Engine — оркестрация реального исследования ниши.
// Поиск и загрузка страниц передаются адаптерами: модуль не притворяется, что у него есть интернет.
// Полученные HTML анализируются существующим site-analysis.js; факты сопровождаются источниками.
import { analyzePage, buildProfile } from './site-analysis.js';

const MAX_RESULTS = 10;
const safeUrl = value => {
  try {
    const url = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (!url.hostname.includes('.') || /(^|\\.)(localhost|local|internal|intranet|lan|home|corp|test|invalid|example)$/.test(url.hostname)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
};
const clean = (value, max = 500) => String(value || '').replace(/\\s+/g, ' ').trim().slice(0, max);

/**
 * @param {{project:object, search?:Function, fetchPage?:Function, limit?:number}} options
 * search({query, niche, location, limit}) -> [{title,url,snippet}]
 * fetchPage(url) -> {html, css?, fetchedAt?, finalUrl?}
 */
export async function runMarketIntelligence({ project = {}, search, fetchPage, limit = MAX_RESULTS } = {}) {
  const niche = clean(project.niche, 160);
  const query = [niche, clean(project.mainOffer, 180), clean(project.city || project.location, 100), 'конкуренты отзывы услуги'].filter(Boolean).join(' ');
  const startedAt = new Date().toISOString();
  if (typeof search !== 'function') {
    return { status: 'not_performed', startedAt, completedAt: new Date().toISOString(), query, competitors: [], sources: [], profile: null, note: 'Поисковый адаптер не подключён. Рыночные факты не сформированы.' };
  }

  let results = [];
  try {
    results = await search({ query, niche, location: clean(project.city || project.location, 100), limit: Math.min(MAX_RESULTS, Math.max(1, Number(limit) || MAX_RESULTS)) });
  } catch (error) {
    return { status: 'not_performed', startedAt, completedAt: new Date().toISOString(), query, competitors: [], sources: [], profile: null, note: 'Поиск завершился ошибкой: ' + clean(error?.message || 'неизвестная ошибка', 240) };
  }

  const unique = [];
  const seen = new Set();
  for (const item of Array.isArray(results) ? results : []) {
    const url = safeUrl(item?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    unique.push({ title: clean(item.title || new URL(url).hostname, 180), url, snippet: clean(item.snippet, 500) });
    if (unique.length >= Math.min(MAX_RESULTS, Math.max(1, Number(limit) || MAX_RESULTS))) break;
  }

  const competitors = [];
  const sources = [];
  if (typeof fetchPage === 'function') {
    for (const item of unique) {
      try {
        const page = await fetchPage(item.url);
        if (!page || typeof page.html !== 'string' || !page.html.trim()) throw new Error('страница не вернула HTML');
        const finalUrl = safeUrl(page.finalUrl || item.url) || item.url;
        const analyzed = analyzePage({ url: finalUrl, html: page.html, css: page.css || '' });
        competitors.push({ name: item.title, url: finalUrl, snippet: item.snippet, analysis: analyzed, fetchedAt: page.fetchedAt || new Date().toISOString(), evidence: 'page_analyzed' });
        sources.push({ title: item.title, url: finalUrl, fetchedAt: page.fetchedAt || new Date().toISOString(), type: 'competitor_page' });
      } catch (error) {
        competitors.push({ name: item.title, url: item.url, snippet: item.snippet, evidence: 'search_result_only', warning: clean(error?.message || 'страница не получена', 240) });
        sources.push({ title: item.title, url: item.url, type: 'search_result', fetchedAt: null });
      }
    }
  } else {
    for (const item of unique) {
      competitors.push({ ...item, evidence: 'search_result_only' });
      sources.push({ title: item.title, url: item.url, type: 'search_result', fetchedAt: null });
    }
  }

  const analyzed = competitors.filter(item => item.analysis).map(item => item.analysis);
  const profile = analyzed.length ? buildProfile(analyzed).profile : null;
  const status = analyzed.length ? (analyzed.length === unique.length ? 'performed' : 'partial') : unique.length ? 'partial' : 'not_performed';
  return {
    status, startedAt, completedAt: new Date().toISOString(), query,
    competitors, sources, profile,
    note: status === 'performed' ? 'Проанализированы публичные страницы конкурентов.' : status === 'partial' ? 'Получены только частичные данные; поисковые сниппеты не считаются полноценным анализом сайтов.' : 'Подтверждённые рыночные данные не получены.',
  };
}

export const MARKET_INTELLIGENCE_LIMIT = MAX_RESULTS;
