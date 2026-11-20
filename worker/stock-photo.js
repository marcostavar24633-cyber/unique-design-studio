// Резерв для фото: когда Workers AI не отдал картинку (чаще всего исчерпаны бесплатные 10 000 нейронов в сутки),
// Worker подбирает настоящее фото по теме из открытого банка Openverse. Бесплатно, без ключа (~200 запросов в сутки);
// только лицензии CC0 и Public Domain — атрибуция не требуется, фото можно ставить на коммерческий сайт.
const API = 'https://api.openverse.org/v1/images/';
const MAX_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const STOP = new Set('a an the of for and with in on at to by from its it is are as or this that real natural shown clearly main subject product service website photo photograph local business fills most frame plated served authentic dish called close up view three quarter front wide shot medium place process details detail atmosphere people work result finished different angle small light interior space'.split(' '));

// Фотостоки с качественными современными кадрами (CC0).
const STOCK_SOURCES = 'stocksnap,rawpixel,wordpress,nappy';
const ASPECT = { '16:9': 'wide', '3:2': 'wide', '4:3': 'wide', '4:5': 'tall', '1:1': 'square' };

// Тема берётся из промта студии (photo-brief.js): «website of a <ниша>, taken…» и «Subject: <сюжет>.»
export function stockQueries(prompt) {
  const text = String(prompt || '');
  const niche = /website of an? (.+?)(?:, taken|\.)/i.exec(text)?.[1] || '';
  const subject = /Subject: (.+?)\.(?: |$)/i.exec(text)?.[1] || '';
  const words = value => value.toLowerCase().replace(/"[^"]*"/g, ' ').replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !STOP.has(word));
  const nicheWords = words(niche).slice(0, 3);
  const subjectWords = words(subject).filter(word => !nicheWords.includes(word)).slice(0, 3);
  const queries = [];
  if (subjectWords.length) queries.push([...subjectWords.slice(0, 2), ...nicheWords.slice(-1)].join(' '));
  if (nicheWords.length) queries.push(nicheWords.join(' '));
  if (subjectWords.length) queries.push(subjectWords.join(' '));
  // Сначала стоковые источники в нужной пропорции, затем без пропорции, и только в конце — архивы (Wikimedia, Flickr):
  // там много исторических и случайных кадров. Не больше 4 запросов к API на одно фото.
  const plans = [...new Set(queries.filter(Boolean))].slice(0, 2).map(q => ({ q, aspect: true, stock: true }));
  const broad = nicheWords.slice(-2).join(" ") || subjectWords.slice(0, 2).join(" ");
  if (broad) plans.push({ q: broad, aspect: false, stock: true }, { q: broad, aspect: false, stock: false });
  return plans;
}

// Детерминированный выбор кадра по тексту промта: разные слоты одной ниши получают разные фото.
function pickIndex(prompt, length) {
  let hash = 0;
  for (const char of String(prompt)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return length ? hash % length : 0;
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function stockPhoto(prompt, aspect, fetchImpl = fetch) {
  const headers = { 'User-Agent': 'unique-design-studio/1.0 (image fallback)' };
  let lastError = 'Openverse: подходящих фото не найдено';
  for (const { q: query, aspect: useAspect, stock } of stockQueries(prompt)) {
    const params = new URLSearchParams({ q: query, license: 'cc0,pdm', mature: 'false', category: 'photograph', page_size: '20', size: 'large' });
    if (useAspect && ASPECT[aspect]) params.set('aspect_ratio', ASPECT[aspect]);
    if (stock) params.set('source', STOCK_SOURCES);
    let results;
    try {
      const response = await fetchImpl(API + '?' + params, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) { lastError = `Openverse HTTP ${response.status}`; if (response.status === 429) break; continue; }
      results = ((await response.json())?.results || []).filter(item => item?.url && !/\.(?:svg|gif|tiff?)(?:$|\?)/i.test(item.url));
    } catch (error) { lastError = 'Openverse: ' + (error?.message || 'сеть'); continue; }
    if (!results.length) continue;
    const start = pickIndex(prompt, results.length);
    for (let step = 0; step < Math.min(4, results.length); step++) {
      const item = results[(start + step) % results.length];
      try {
        const image = await fetchImpl(item.url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
        const type = (image.headers.get('content-type') || '').split(';')[0];
        if (!image.ok || !/^image\/(?:jpeg|png|webp)$/.test(type) || Number(image.headers.get('content-length') || 0) > MAX_BYTES) continue;
        const buffer = await image.arrayBuffer();
        if (!buffer.byteLength || buffer.byteLength > MAX_BYTES) continue;
        return {
          image: toBase64(buffer), mimeType: type, model: 'openverse', query,
          width: Number(item.width) || 0, height: Number(item.height) || 0,
          source: { title: String(item.title || '').slice(0, 120), creator: String(item.creator || '').slice(0, 80), license: item.license, url: item.foreign_landing_url || item.url },
        };
      } catch { /* следующий кадр */ }
    }
  }
  throw new Error(lastError);
}
