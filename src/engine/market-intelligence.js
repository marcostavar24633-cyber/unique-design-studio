// Market Intelligence Engine — оркестрация реального исследования ниши.
// Поиск и загрузка страниц передаются адаптерами: модуль не притворяется, что у него есть интернет.
// Полученные HTML анализируются существующим site-analysis.js; факты сопровождаются источниками.
import { analyzePage, buildProfile } from './site-analysis.js';

const MAX_RESULTS = 10;
const MAX_HTML_CHARS = 5_000_000;
const MAX_CSS_CHARS = 2_000_000;
const safeUrl = value => {
  try {
    const url = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host.includes('.') || /(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|invalid|example)$/.test(host)) return null;
    const octets = host.split('.').map(Number);
    if (octets.length === 4 && octets.every(part => Number.isInteger(part) && part >= 0 && part <= 255)) {
      const [a, b] = octets;
      if (a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 192 && b === 168
        || a === 172 && b >= 16 && b <= 31 || a === 100 && b >= 64 && b <= 127
        || a === 192 && (b === 0 || b === 2 || b === 88)
        || a === 198 && (b === 18 || b === 19 || b === 51)
        || a === 203 && b === 0) return null;
    }
    if (host === '::' || host === '::1' || /^(fc|fd|fe[89ab]|ff)/i.test(host)
      || /^::ffff:(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/i.test(host)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
};
const clean = (value, max = 500) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * @param {{project:object, search?:Function, fetchPage?:Function, limit?:number}} options
 * search({query, niche, location, limit}) -> [{title,url,snippet}]
 * fetchPage(url) -> {html, css?, fetchedAt?, finalUrl?}
 */
export async function runMarketIntelligence(options = {}) {
  const { project: inputProject = {}, search, fetchPage, limit = MAX_RESULTS } = options && typeof options === 'object' ? options : {};
  const project = inputProject && typeof inputProject === 'object' ? inputProject : {};
  let requestedLimit = NaN;
  try { requestedLimit = Number(limit); } catch { /* use the default result count */ }
  const resultLimit = Number.isFinite(requestedLimit) ? Math.min(MAX_RESULTS, Math.max(1, Math.floor(requestedLimit))) : MAX_RESULTS;
  const niche = clean(project.niche, 160);
  const query = [niche, clean(project.mainOffer, 180), clean(project.city || project.location, 100), 'конкуренты отзывы услуги'].filter(Boolean).join(' ');
  const startedAt = new Date().toISOString();
  if (typeof search !== 'function') {
    return { status: 'not_performed', startedAt, completedAt: new Date().toISOString(), query, competitors: [], sources: [], profile: null, note: 'Поисковый адаптер не подключён. Рыночные факты не сформированы.' };
  }

  let results = [];
  try {
    results = await search({ query, niche, location: clean(project.city || project.location, 100), limit: resultLimit });
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
    if (unique.length >= resultLimit) break;
  }

  const competitors = [];
  const sources = [];
  if (typeof fetchPage === 'function') {
    for (const item of unique) {
      try {
        const page = await fetchPage(item.url);
        if (!page || typeof page.html !== 'string' || !page.html.trim()) throw new Error('страница не вернула HTML');
        if (page.html.length > MAX_HTML_CHARS) throw new Error('страница превышает безопасный лимит 5 МБ');
        const finalUrl = safeUrl(page.finalUrl || item.url) || item.url;
        const analyzed = analyzePage({ url: finalUrl, html: page.html, css: String(page.css || '').slice(0, MAX_CSS_CHARS) });
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
