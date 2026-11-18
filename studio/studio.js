// Веб-студия: редактор проекта, живой предпросмотр, концепция, проверка и реестр проектов.
import { ARCHETYPES, BRANDS, LEGACY_LABELS, LIBRARY_KEY, TIERS, MECHANICS, MASKS, DIVIDERS, TEXT_EFFECTS, WEB_FONT_PAIRS, GRAPHIC_DIRECTIONS, autopilot, buildConcept, buildSpec, fromAiLanding, buildPrompt, exportProject, generate, normalizeLibrary, normalizeProject, referencesFor, similarity, qualityReport, fixAndRecheck, QUALITY_CATEGORIES, SEVERITY_LABELS, imageSlots, slotBrief, imageTaskPackage, applyApprovedDesignPatch, photoPrompt, loadPromptRegistry, activePrompt } from '../src/engine/index.js';

const STORE = 'uds:studio:v1';
const PREVIEW_STORE = 'uds:design-preview:v1';
const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_IMAGE_DATA = 3_800_000;
const $ = sel => document.querySelector(sel);
const AI_USAGE_RANGE_KEY = 'uds:ai-usage-range';
const DEFAULT_AI_ENDPOINT = 'https://unique-design-studio-ai.marcostavar24633.workers.dev/api/generate-landing';
const getDefaultAiEndpoint = () => location.hostname === 'marcostavar24633-cyber.github.io' ? DEFAULT_AI_ENDPOINT : '';
let aiUsageLoading = false;
function renderAiUsageStats(data, error = '') {
  const node = $('#ai-usage');
  if (!node) return;
  if (error) {
    node.title = 'Реальная статистика Cloudflare недоступна: ' + error;
    setDashStatus('neurons', 'off', 'Статистика недоступна');
    $('#ai-usage-count').textContent = '—';
    const details = $('#ai-usage-details');
    if (details) details.textContent = 'Ошибка подключения: ' + error;
    return;
  }
  if (!data) return;
  $('#ai-usage-count').textContent = Number(data.neurons || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  const neurons = Number(data.neurons || 0);
  const share = data.range === '24h' ? ' (' + Math.round(neurons / WORKERS_AI_FREE_NEURONS * 100) + '% от ~' + WORKERS_AI_FREE_NEURONS.toLocaleString('ru-RU') + ' бесплатных в сутки — ориентир по документации Cloudflare)' : '';
  setDashStatus('neurons', neurons > WORKERS_AI_FREE_NEURONS * 0.8 && data.range === '24h' ? 'warn' : 'ok', neurons.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' Neurons · ' + Number(data.requests || 0).toLocaleString('ru-RU') + ' запросов' + share);
  const details = $('#ai-usage-details');
  if (details) details.textContent = 'Neurons · ' + Number(data.requests || 0).toLocaleString('ru-RU') + ' запросов · ' +
    Number(data.totalTokens || 0).toLocaleString('ru-RU') + ' токенов';
  node.title = 'Cloudflare AI · ' + data.range + '. Вход: ' + Number(data.inputTokens || 0).toLocaleString('ru-RU') +
    ' токенов; выход: ' + Number(data.outputTokens || 0).toLocaleString('ru-RU') +
    '. Neurons: ' + Number(data.neurons || 0).toLocaleString('ru-RU') +
    '. Данные аналитики могут поступать с задержкой.';
}
async function refreshAiUsage() {
  if (aiUsageLoading) return;
  const endpoint = ($('#auto-endpoint')?.value || localStorage.getItem('uds:ai-endpoint') || getDefaultAiEndpoint()).trim();
  if (!endpoint) return renderAiUsageStats(null, 'не задан адрес AI-сервера');
  let usageUrl;
  try {
    const parsed = new URL(endpoint, location.href);
    if (!/\/api\/generate-landing\/?$/i.test(parsed.pathname)) throw new Error('неверный путь');
    parsed.pathname = parsed.pathname.replace(/\/api\/generate-landing\/?$/i, '/api/usage');
    usageUrl = parsed.toString();
  } catch { return renderAiUsageStats(null, 'неверный адрес AI-сервера'); }
  aiUsageLoading = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const range = $('#ai-usage-range')?.value || localStorage.getItem(AI_USAGE_RANGE_KEY) || '24h';
    const response = await fetch(usageUrl + '?range=' + encodeURIComponent(range), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'HTTP ' + response.status);
    if (!Number.isFinite(Number(payload.neurons)) || !Number.isFinite(Number(payload.requests))) {
      throw new Error('Cloudflare вернул некорректную статистику');
    }
    renderAiUsageStats(payload);
  } catch (error) {
    renderAiUsageStats(null, error.name === 'AbortError' ? 'тайм-аут: Worker не ответил за 12 секунд' : error.message);
  } finally {
    clearTimeout(timeout);
    aiUsageLoading = false;
  }
}
if ($('#ai-usage-range')) {
  try { $('#ai-usage-range').value = localStorage.getItem(AI_USAGE_RANGE_KEY) || '24h'; } catch {}
}
refreshAiUsage();
renderConnections();
$('#ai-usage-range')?.addEventListener('change', event => {
  try { localStorage.setItem(AI_USAGE_RANGE_KEY, event.target.value); } catch {}
  refreshAiUsage();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshAiUsage();
});
setInterval(() => {
  if (!document.hidden) refreshAiUsage();
}, 60_000);
const MAX_IMAGE_EDGE = 1800;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const EMPTY = { formatVersion: 2, brand: '', niche: '', architecture: 'auto', architectureMode: 'auto' };
let state = { raw: { ...EMPTY }, library: [] };
let result = null;
let aiDesignReview = null;
let aiDesignReviewLoading = false;
let lastRenderedRaw = null;
let exampleProjects = [];
let dashboardFilter = 'saved';
let dashboardQuery = '';
// Задание AI Content Director: собирается при отрисовке вкладки «ТЗ и анализ» по текущему проекту,
// а вызывается из обработчика кнопок этой вкладки.
let contentPrompt = () => '';

try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved && saved.raw) state = { raw: saved.raw, library: Array.isArray(saved.library) ? saved.library : [], analysis: saved.analysis || null };
} catch { /* хранилище недоступно — работаем без сохранения */ }
// Последняя запись в хранилище не удалась: сообщения «сохранено» не должны перекрывать предупреждение.
let persistFailed = false;
const PERSIST_ERROR = 'Не удалось сохранить проект в браузере: возможно, закончилось место. Скачайте JSON, чтобы не потерять изменения.';
const persist = () => {
  try { localStorage.setItem(STORE, JSON.stringify(state)); persistFailed = false; return true; }
  catch { persistFailed = true; toast(PERSIST_ERROR); return false; }
};
// Похож ли объект на проект студии: пустой или чужой JSON не должен молча заменять текущую работу.
const looksLikeProject = raw => ['brand', 'niche', 'title', 'description'].some(k => typeof raw[k] === 'string' && raw[k].trim())
  || (Array.isArray(raw.services) && raw.services.length > 0);

// ---------- Журнал AI-операций ----------
// Каждый запрос студии к AI (тексты сайта, каждое фото): время, итог, длительность и токены, которые модель
// фактически вернула. Ничего не оценивается: нет usage в ответе — поле пустое. Хранится в этом браузере.
// Расход Neurons — отдельно, из аналитики Cloudflare: журнал и счётчик не складываются, двойного учёта нет.
const AI_JOURNAL_KEY = 'uds:ai-journal:v1';
// Бесплатный суточный объём Workers AI по документации Cloudflare. API лимит не сообщает — это ориентир.
const WORKERS_AI_FREE_NEURONS = 10000;
function aiJournal() { try { const list = JSON.parse(localStorage.getItem(AI_JOURNAL_KEY) || '[]'); return Array.isArray(list) ? list : []; } catch { return []; } }
function logAi(entry) {
  try {
    const list = aiJournal();
    list.unshift({ at: new Date().toISOString(), ...entry });
    localStorage.setItem(AI_JOURNAL_KEY, JSON.stringify(list.slice(0, 100)));
  } catch { /* хранилище недоступно — журнал не ведётся */ }
  renderAiJournal();
}
// ---------- Расход AI: до сброса лимита и за текущую сессию ----------
// Сессия — с открытия студии в этой вкладке (sessionStorage). Её расход — по журналу: токены, которые вернула модель.
// «До сброса» — Neurons с 00:00 UTC из аналитики Cloudflare: в это время сбрасывается суточный бесплатный объём.
const SESSION_KEY = 'uds:session-start';
const sessionStart = (() => { try { let v = sessionStorage.getItem(SESSION_KEY); if (!v) { v = new Date().toISOString(); sessionStorage.setItem(SESSION_KEY, v); } return v; } catch { return new Date().toISOString(); } })();
let aiToday = null; // ответ /api/usage?range=today или { error }
function untilReset(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const min = Math.max(0, Math.round((next - now.getTime()) / 60000));
  return { hours: Math.floor(min / 60), minutes: min % 60, at: new Date(next) };
}
function renderAiBudget() {
  const box = $('#dash-ai-budget'); if (!box) return;
  const session = aiJournal().filter(e => e.at >= sessionStart);
  const sTokens = session.reduce((sum, e) => sum + (Number(e.tokens) || 0), 0);
  const r = untilReset();
  const local = r.at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  let today;
  if (aiToday && !aiToday.error && Number.isFinite(Number(aiToday.neurons))) {
    const n = Number(aiToday.neurons), pct = Math.min(100, Math.round(n / WORKERS_AI_FREE_NEURONS * 100));
    const alert = pct >= 100
      ? { level: 'err', text: 'Бесплатная квота исчерпана по данным аналитики. Генерация может быть недоступна до 00:00 UTC; платный резервный провайдер отключён.' }
      : pct >= 85
        ? { level: 'err', text: 'Израсходовано не менее 85% ориентировочного бесплатного объёма. Сократите генерации до суточного сброса.' }
        : pct >= 70
          ? { level: 'warn', text: 'Израсходовано не менее 70% ориентировочного бесплатного объёма. Следите за расходом.' }
          : null;
    today = '<div class="dash-meter" data-level="' + (pct >= 85 ? 'err' : pct >= 70 ? 'warn' : 'ok') + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Расход до сброса лимита"><span style="width:' + Math.max(2, pct) + '%"></span></div>' +
      '<p class="dash-meter-note"><b>До сброса:</b> ' + n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' из ~' + WORKERS_AI_FREE_NEURONS.toLocaleString('ru-RU') + ' Neurons (' + pct + '%), ' + Number(aiToday.requests || 0).toLocaleString('ru-RU') + ' запросов. Остаток ~' + Math.max(0, WORKERS_AI_FREE_NEURONS - n).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + '.</p>' +
      (alert ? '<p class="dash-meter-note" data-ai-budget-alert="' + alert.level + '" role="status" aria-live="polite"><b>Предупреждение:</b> ' + alert.text + '</p>' : '');
  } else {
    today = '<p class="dash-meter-note"><b>До сброса:</b> ' + esc(aiToday?.error ? 'нет данных — ' + aiToday.error : 'загружаем данные Cloudflare…') + '</p>';
  }
  box.innerHTML = today +
    '<p class="dash-meter-note">Сброс через ' + r.hours + ' ч ' + r.minutes + ' мин — в ' + esc(local) + ' (00:00 UTC). Объём ~' + WORKERS_AI_FREE_NEURONS.toLocaleString('ru-RU') + ' — ориентир по документации Cloudflare.</p>' +
    '<p class="dash-meter-note"><b>Эта сессия</b> (с ' + esc(new Date(sessionStart).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })) + '): ' + session.length + ' запросов' + (sTokens ? ', ' + sTokens.toLocaleString('ru-RU') + ' токенов' : '') + (session.some(e => e.status !== 'ok') ? ', ошибок: ' + session.filter(e => e.status !== 'ok').length : '') + '.</p>';
}
async function refreshAiToday() {
  const endpoint = (localStorage.getItem('uds:ai-endpoint') || getDefaultAiEndpoint()).trim();
  if (!endpoint) { aiToday = { error: 'AI-сервер не задан' }; return renderAiBudget(); }
  try {
    const u = new URL(endpoint, location.href); u.pathname = u.pathname.replace(/\/api\/generate-landing\/?$/i, '/api/usage'); u.search = '?range=today';
    const res = await fetch(u.href, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    aiToday = res.ok ? body : { error: res.status === 400 ? 'Worker не обновлён (нужна публикация)' : body.error || 'HTTP ' + res.status };
  } catch (error) { aiToday = { error: error.message }; }
  renderAiBudget();
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-ai-quota-recheck]')) refreshAiToday();
});
function renderAiJournal() {
  renderAiBudget();
  const box = $('#dash-ai-journal'); if (!box) return;
  const list = aiJournal();
  const today = new Date().toDateString();
  const todays = list.filter(e => new Date(e.at).toDateString() === today);
  const tokens = todays.reduce((sum, e) => sum + (Number(e.tokens) || 0), 0);
  const errors = todays.filter(e => e.status !== 'ok').length;
  const time = iso => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const row = e => '<li data-status="' + (e.status === 'ok' ? 'ok' : 'err') + '"><span>' + time(e.at) + '</span><b>' + esc(e.label) + '</b><small>' +
    esc([e.status === 'ok' ? 'готово' : 'ошибка: ' + (e.error || ''), e.ms ? (e.ms / 1000).toFixed(1) + ' с' : '', e.tokens ? Number(e.tokens).toLocaleString('ru-RU') + ' ток.' : ''].filter(Boolean).join(' · ')) + '</small></li>';
  box.innerHTML = list.length
    ? '<p class="dash-meter-note">Сегодня: ' + todays.length + ' запросов' + (tokens ? ', ' + tokens.toLocaleString('ru-RU') + ' токенов' : '') + (errors ? ', ошибок: ' + errors : '') + '</p><ol class="dash-journal">' + list.slice(0, 6).map(row).join('') + '</ol>' +
      (list.length > 6 ? '<details class="dash-journal-more"><summary>Все записи (' + list.length + ')</summary><ol class="dash-journal">' + list.slice(6).map(row).join('') + '</ol></details>' : '') +
      '<button type="button" class="dash-journal-clear" data-journal-clear>Очистить журнал</button>'
    : '<p class="dash-meter-note">Запросов к AI ещё не было. Здесь появятся генерации текстов и фото с итогом, временем и токенами.</p>';
}

renderAiJournal();
refreshAiToday();
setInterval(() => { if (!document.hidden) refreshAiToday(); else renderAiBudget(); }, 60_000);
// ---------- Главная панель ----------
// Состояние подключений в правой колонке: ok — работает, warn — требует внимания, off — не подключено.
function setDashStatus(key, level, text) {
  const item = document.querySelector('#dash-status [data-status="' + key + '"]');
  if (!item) return;
  item.dataset.level = level;
  item.querySelector('small').textContent = text;
}
// Палитра и архитектура проекта для карточки: концепция без реестра и без рендера HTML.
const conceptCache = new Map();
function projectLook(raw) {
  const key = JSON.stringify(raw);
  if (!conceptCache.has(key)) {
    try {
      const vs = buildConcept(raw, { registry: [] }).visualSystem;
      conceptCache.set(key, { palette: vs.palette, archetype: ARCHETYPES[vs.archetype]?.name || vs.archetype });
    } catch { conceptCache.set(key, null); }
    if (conceptCache.size > 60) conceptCache.delete(conceptCache.keys().next().value);
  }
  return conceptCache.get(key);
}
const swatches = look => look ? '<span class="dash-swatches" aria-hidden="true">' + ['bg', 'surface', 'accent', 'text'].map(k => '<i style="background:' + esc(look.palette[k] || '#333') + '"></i>').join('') + '</span>' : '';
function projectCard(item) {
  const p = normalizeProject(item.raw), name = p.brand || p.niche || 'Без названия', look = projectLook(item.raw);
  const image = p.images?.hero || p.gallery?.[0]?.src || '';
  const accent = look?.palette.accent || '#c9a45e', bg = look?.palette.bg || '#15171b', text = look?.palette.text || '#f2f4fa';
  const cover = image
    ? '<img src="' + esc(image) + '" alt="">'
    : '<span class="dash-cover-type" style="color:' + esc(text) + '">' + esc(name.slice(0, 1).toUpperCase()) + '</span>';
  const action = item.kind === 'saved'
    ? '<button type="button" data-open-project="' + item.index + '">Открыть</button>'
    : '<button type="button" data-open-example="' + item.index + '">Открыть пример</button>';
  return '<article class="dash-project-card"><div class="dash-project-image" style="background:linear-gradient(135deg,' + esc(bg) + ',' + esc(bg) + ' 55%,' + esc(accent) + ')">' + cover + swatches(look) + '</div>' +
    '<div class="dash-project-info"><b>' + esc(name) + '</b><small>' + esc(p.niche || 'Коммерческий сайт') + '</small>' +
    (look ? '<small class="dash-arch">' + esc(look.archetype) + (item.kind === 'example' ? ' · пример' : '') + '</small>' : '') + action + '</div></article>';
}
// Карточка «Продолжить работу»: текущий проект рабочей области, если он не пустой.
function renderContinue() {
  const box = $('#dash-continue'); if (!box) return;
  const p = result?.project;
  if (!p || (!p.brand && !p.niche)) { box.hidden = true; box.innerHTML = ''; return; }
  const audit = result.audit, vs = result.concept.visualSystem;
  const arch = ARCHETYPES[vs.archetype]?.name || vs.archetype;
  const status = audit.ok
    ? (audit.warnings.length ? '<span class="dash-badge dash-badge--warn">Предупреждений: ' + audit.warnings.length + '</span>' : '<span class="dash-badge dash-badge--ok">Проверка пройдена</span>')
    : '<span class="dash-badge dash-badge--err">Ошибок: ' + audit.errors.length + '</span>';
  const inLibrary = state.library.some(item => item?.entry?.id === result.entry.id);
  box.hidden = false;
  box.innerHTML = '<div class="dash-continue-look" style="background:linear-gradient(135deg,' + esc(vs.palette.bg) + ' 0 55%,' + esc(vs.palette.accent) + ')">' + swatches({ palette: vs.palette }) + '</div>' +
    '<div class="dash-continue-copy"><small>Продолжить работу</small><h2>' + esc(p.brand || p.niche) + '</h2><p>' + esc(p.niche || '') + ' · ' + esc(arch) + '</p><div class="dash-badges">' + status +
    (inLibrary ? '' : '<span class="dash-badge">Не сохранён в реестр</span>') + '</div></div>' +
    '<div class="dash-continue-actions"><button type="button" class="dash-primary" data-dash="editor">Открыть редактор</button><button type="button" data-dash="qa">Проверка и выпуск</button><button type="button" data-continue="download">Скачать HTML</button></div>';
}
// Сколько студия занимает в хранилище браузера (около 5 МБ на сайт): большие фото быстро его заполняют.
function renderStorage() {
  const meter = $('#dash-storage'); if (!meter) return;
  let bytes = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch { /* хранилище недоступно */ }
  const LIMIT = 5 * 1024 * 1024, pct = Math.min(100, Math.round(bytes / LIMIT * 100));
  meter.setAttribute('aria-valuenow', String(pct));
  meter.dataset.level = pct >= 85 ? 'err' : pct >= 65 ? 'warn' : 'ok';
  meter.querySelector('span').style.width = Math.max(2, pct) + '%';
  const mb = (bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  $('#dash-storage-note').textContent = 'Занято ' + mb + ' из ~5 МБ (' + pct + '%). ' + (pct >= 65
    ? 'Скачайте JSON важных проектов и удалите лишние фото или записи реестра.'
    : 'Проекты и фото хранятся только в этом браузере — сохраняйте важное через «Экспорт JSON».');
}
// Подключения: проверяем /health серверов, адреса которых заданы в этом браузере.
async function pingHealth(endpoint) {
  let url; try { url = new URL(endpoint); } catch { return false; }
  url.pathname = '/health'; url.search = '';
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 6000);
  try { const res = await fetch(url.href, { signal: controller.signal, cache: 'no-store' }); return res.ok; } catch { return false; } finally { clearTimeout(timer); }
}
function renderConnections() {
  let ai = '', analyzer = '';
  try { ai = (localStorage.getItem('uds:ai-endpoint') || getDefaultAiEndpoint()).trim(); analyzer = localStorage.getItem('uds:analyzer-endpoint') || ''; } catch { /* нет хранилища */ }
  const mode = $('#qs-mode');
  if (!ai) {
    setDashStatus('ai', 'off', 'Сервер не задан — работает локальный автопилот');
    if (mode) mode.textContent = 'AI-сервер не подключён: сайт соберёт локальный автопилот — анализ, стартовые тексты, концепция и проверка.';
  } else pingHealth(ai).then(ok => {
    setDashStatus('ai', ok ? 'ok' : 'warn', ok ? 'Cloudflare Workers AI подключён' : 'Сервер не ответил — будет локальный автопилот');
    if (mode) mode.textContent = ok ? 'Тексты и структуру пишет AI по вашему брифу, затем студия собирает и проверяет сайт.' : 'AI-сервер сейчас не отвечает: сайт соберёт локальный автопилот.';
  });
  if (!analyzer) setDashStatus('analyzer', 'off', 'Не подключён — настройка в «Анализ сайтов и шаблоны»');
  else pingHealth(analyzer).then(ok => setDashStatus('analyzer', ok ? 'ok' : 'warn', ok ? 'Анализатор-сервер отвечает' : 'Анализатор-сервер не ответил'));
}
function renderDashboard(filter = dashboardFilter) {
  const root = $('#dash-projects'); if (!root) return;
  dashboardFilter = filter;
  const saved = state.library.map((item, index) => ({ raw: item.raw, analysis: item.analysis || null, index, kind: 'saved' }));
  const examples = exampleProjects.map((item, index) => ({ raw: item.raw, index, kind: 'example' }));
  const entries = filter === 'saved' ? saved : filter === 'examples' ? examples : [...saved, ...examples];
  const q = dashboardQuery.trim().toLowerCase();
  const shown = entries.filter(item => {
    const p = normalizeProject(item.raw);
    return !q || [p.brand, p.niche, p.title].some(value => String(value || '').toLowerCase().includes(q));
  });
  $('#dash-project-count').textContent = String(saved.length);
  const chips = $('#dash-example-chips');
  if (chips) chips.innerHTML = exampleProjects.map((item, index) => '<button type="button" data-open-example="' + index + '" title="' + esc(item.niche || '') + '">' + esc(item.brand || item.niche) + '</button>').join('');
  document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('selected', button.dataset.filter === filter));
  const empty = q ? '<b>Ничего не найдено</b><p>Измените поисковый запрос.</p>'
    : filter === 'examples' ? '<b>Примеры пока не загружены</b>'
    : '<b>Здесь появятся ваши сайты</b><p>Соберите сайт выше и нажмите «В реестр» в рабочей области. Проект сохранится в этом браузере, а новые сайты будут сверяться с ним на непохожесть.</p>';
  root.innerHTML = shown.length ? shown.map(projectCard).join('') : '<div class="dash-empty">' + empty + '</div>';
  renderContinue();
  renderStorage();
}
function openWorkspace(section = 'create') {
  document.body.classList.remove('dashboard-mode');
  document.querySelectorAll('.dash-nav [data-dash]').forEach(button => button.classList.toggle('is-active', button.dataset.dash === section));
  if (section === 'create' || section === 'editor' || section === 'director') { selectTab($('#tab-preview')); if (section === 'create') $('#auto-niche')?.focus(); }
  if (section === 'settings') {
    selectTab($('#tab-preview'));
    // «Настройки» ведут к существующим полям проекта, а не в пустой раздел.
    if (document.body.classList.contains('workspace-settings-collapsed')) {
      document.body.classList.remove('workspace-settings-collapsed');
      const toggle = $('#toggle-settings');
      if (toggle) { toggle.setAttribute('aria-expanded', 'true'); toggle.textContent = 'Скрыть настройки'; }
    }
    const firstGroup = $('#form .group');
    if (firstGroup) firstGroup.open = true;
    $('.panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (section === 'visual' || section === 'motion') selectTab($('#tab-concept'));
  if (section === 'seo') selectTab($('#tab-spec'));
  if (section === 'qa') selectTab($('#tab-production'));
  if (section === 'projects') selectTab($('#tab-registry'));

}
$('#dashboard-back')?.addEventListener('click', () => {
  document.body.classList.add('dashboard-mode');
  renderDashboard();
  renderConnections();
  $('#dash-search')?.focus({ preventScroll: true });
});
$('#dashboard')?.addEventListener('click', async e => {
  const menuToggle = e.target.closest('#dash-menu-toggle');
  if (menuToggle) {
    const sidebar = menuToggle.closest('.dash-sidebar');
    const expanded = sidebar.classList.toggle('is-menu-open');
    menuToggle.setAttribute('aria-expanded', String(expanded));
    return;
  }
  const project = e.target.closest('[data-open-project]');
  if (project) { const item = state.library[Number(project.dataset.openProject)]; if (item) { state.analysis = item.analysis ? { projectId: item.raw.id, data: item.analysis } : null; load(item.raw, 'Проект открыт из главной панели'); openWorkspace('editor'); } return; }
  const example = e.target.closest('[data-open-example]');
  if (example) {
    const item = exampleProjects[Number(example.dataset.openExample)];
    if (item) { load(item.raw, 'Пример открыт: ' + (item.brand || item.niche)); openWorkspace('create'); }
    return;
  }
  if (e.target.closest('[data-journal-clear]')) { try { localStorage.removeItem(AI_JOURNAL_KEY); } catch { /* нет хранилища */ } renderAiJournal(); return; }
  if (e.target.closest('[data-continue="download"]')) { $('#download').click(); return; }
  const action = e.target.closest('[data-dash]')?.dataset.dash;
  if (action === 'projects') {
    renderDashboard('saved');
    $('#dash-projects-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.dash-nav [data-dash]').forEach(button => button.classList.toggle('is-active', button.dataset.dash === 'projects'));
    return;
  }
  if (action && action !== 'home') openWorkspace(action);
  const filter = e.target.closest('[data-filter]')?.dataset.filter;
  if (filter) renderDashboard(filter);
});
// Быстрый старт с главной: те же поля автопилота и тот же запуск, без лишнего перехода.
$('#quick-start')?.addEventListener('submit', e => {
  e.preventDefault();
  const niche = $('#qs-niche').value.trim();
  if (!niche) { $('#qs-niche').focus(); return; }
  $('#auto-niche').value = niche;
  $('#auto-brand').value = $('#qs-brand').value.trim();
  $('#auto-tier').value = $('#qs-tier').value;
  openWorkspace('create');
  $('#auto').requestSubmit();
});
$('#dash-search')?.addEventListener('input', e => {
  dashboardQuery = e.target.value;
  renderDashboard();
});
// ---------- Описание формы ----------
const LIST_HINT = 'Одна позиция на строку: Название | Описание';
// Название группы с фотографиями: на него ссылаются кнопки «Настроить кадрирование» и «Управлять фотографиями».
const PHOTO_GROUP = 'Фотографии';
// Открывает группу фотографий в форме, раскрывая свёрнутую панель настроек.
function openPhotoGroup() {
  if (document.body.classList.contains('workspace-settings-collapsed')) {
    document.body.classList.remove('workspace-settings-collapsed');
    const toggle = $('#toggle-settings');
    if (toggle) { toggle.setAttribute('aria-expanded', 'true'); toggle.textContent = 'Скрыть настройки'; }
  }
  const group = [...$('#form').querySelectorAll('.group')].find(item => item.querySelector('summary')?.textContent.trim() === PHOTO_GROUP);
  if (group) group.open = true;
  return group;
}
const GROUPS = [
  ['Основа сайта', true, [
    ['brand', 'Бренд'], ['niche', 'Ниша', 'text', 'Например: кофейня, магазин телескопов, салон красоты'],
    ['title', 'Заголовок первого экрана'], ['description', 'Описание предложения', 'area'],
    ['cta', 'Текст главной кнопки'], ['ctaUrl', 'Ссылка главной кнопки', 'text', 'Необязательно. По умолчанию ведёт к разделу контактов'],
    ['seoTitle', 'SEO-заголовок (title)', 'text', 'Необязательно. 30–60 символов. Если пусто — «Заголовок — Бренд»'],
    ['seoDescription', 'SEO-описание (meta description)', 'area', 'Необязательно. 120–160 символов. Если пусто — описание предложения'],
  ]],
  ['Дизайн и фирменный стиль', false, [
    ['@arch', 'Архитектура главной страницы', 'arch'], ['@palette', 'Палитра', 'palette'], ['@accent', 'Акцентный цвет', 'accent'],
    ['@tier', 'Класс', 'tier', 'Премиум и люкс меняют композицию, шрифты, палитру, кнопки и тон текстов'],
    ['@brand', 'Фирменный стиль', 'brand', 'Цвета, шрифты и скругления живого проекта. Композицию по-прежнему выбирает движок. Перекрывает «Палитру»'],
    ['@mechanic', 'Поведение карточек', 'mechanic', 'Авто — движок выбирает по архитектуре и данным: раскрытие, переворот, колода, лента или мозаика. Всё работает с клавиатуры и без анимации'],
    ['@imageMask', 'Форма фотографий', 'imageMask', 'Авто — по форме углов и характеру бренда. Маска применяется только к фото, рамки фокуса не обрезаются'],
    ['@sectionDivider', 'Разделители секций', 'sectionDivider', 'Авто — по мотиву бренда: волна, зигзаг, ступени, точки или линия'],
    ['@graphicDirection', 'Направление графики', 'graphicDirection', 'Стиль фото и заданий на графику: кинематографичная съёмка, макрофактура, студийная съёмка товара и др. Авто — по нише'],
    ['@textEffect', 'Эффект текста', 'textEffect', 'Сменяющиеся фразы под заголовком (из заголовков преимуществ) или текст, проявляющийся при прокрутке. Отключается при «уменьшить движение»'],
    ['@fontPair', 'Пара шрифтов', 'fontPair', 'Работает при «Шрифты: Google Fonts». Авто — пара подбирается под характер типографики'],
    ['@fonts', 'Шрифты', 'fonts', 'Системные — страница без внешних запросов. Google Fonts — характерные шрифты с кириллицей, одинаковые на всех устройствах'],
    ['targetAudience', 'Аудитория', 'area', 'Если пусто — будет использована явно помеченная гипотеза'],
    ['brandCharacter', 'Характер бренда'],
    ['customPrompt', 'Свой промт', 'area', 'Ваши указания для нейросети: попадают в «Промт для AI» и во вкладку «ТЗ и анализ»'],
    ['@promptMode', 'Как использовать свой промт', 'promptMode'],
  ]],
  [PHOTO_GROUP, false, [
    ['images.hero', 'Изображение первого экрана (URL)'], ['images.heroAlt', 'Описание изображения (alt)'],
    ['@heroUpload', 'Загрузить фото первого экрана', 'upload-hero', 'JPG/PNG/WebP: до 8 МБ до оптимизации, WebP до 1 МБ после. GIF/AVIF: до 1 МБ.'],
    ['gallery', 'Галерея', 'list', 'Одна картинка на строку: URL | Подпись | ALT-текст (необязательно)'],
    ['@galleryUpload', 'Добавить фотографии в галерею', 'upload-gallery', 'Можно выбрать несколько снимков. Автооптимизация WebP; до 8 МБ исходник, до 1 МБ результат.'],
    ['@serviceUpload', 'Фото товара или услуги', 'upload-service', 'Выберите позицию и загрузите фото (автооптимизация WebP, до 8 МБ исходник).'],
  ]],
  ['Каталог и предложения', false, [
    ['servicesTitle', 'Заголовок раздела'], ['servicesIntro', 'Вступление', 'area'],
    ['services', 'Позиции', 'list', 'Название | Описание | Цена | URL картинки | ALT-текст | Категория. Последние поля необязательны. У магазина цены и категории включают фильтры, сортировку и корзину-заявку'],
    ['categories', 'Категории', 'list', 'Одна категория на строку'],
  ]],
  ['Содержание сайта', false, [
    ['aboutTitle', 'Заголовок «О нас»'], ['aboutText', 'Текст «О нас»', 'area'],
    ['advantagesTitle', 'Заголовок преимуществ'], ['advantages', 'Преимущества', 'list', LIST_HINT],
    ['processTitle', 'Заголовок этапов работы'], ['process', 'Этапы работы', 'list', LIST_HINT],
    ['faqs', 'Вопросы и ответы', 'list', 'Один вопрос на строку: Вопрос | Ответ'],
  ]],
  ['Контакты и заявки', false, [
    ['contactTitle', 'Заголовок'], ['contactText', 'Текст', 'area'],
    ['contacts.phone', 'Телефон'], ['contacts.email', 'E-mail'], ['contacts.address', 'Адрес'], ['contacts.hours', 'Часы работы'],
    ['formAction', 'Адрес обработчика формы (https://…)', 'text', 'Если пусто и указан e-mail — форма откроет почтовую программу'],
  ]],
];

const get = path => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.raw);
function set(path, value) {
  const keys = path.split('.');
  let o = state.raw;
  for (const k of keys.slice(0, -1)) o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {};
  o[keys.at(-1)] = value;
}
const rowsToText = (rows, path) => (Array.isArray(rows) ? rows : []).map(r => {
  if (path === 'categories') return String(r);
  if (path === 'gallery') return String(r.src || '').startsWith('data:image/') ? '' : [r.src, r.caption, r.alt].filter((v,i)=>i===0 || v).join(' | ');
  const a = Array.isArray(r) ? r : [r.title, r.text, r.price, r.image, r.alt, r.category];
  const cells = a.map(x => x ?? '');
  if (path === 'services' && String(cells[3] || '').startsWith('data:image/')) cells[3] = '';
  while (cells.length > 1 && !cells.at(-1)) cells.pop();
  return cells.join(' | ');
}).join('\n');
function textToRows(text, path) {
  const rows = text.split('\n').map(l => l.split('|').map(s => s.trim())).filter(r => r.some(Boolean));
  if (path === 'categories') return rows.map(r => r[0]);
  if (path === 'gallery') {
    const embedded = (state.raw.gallery || []).filter(g => String(g.src || '').startsWith('data:image/'));
    return [...rows.map(r => ({ src: r[0], caption: r[1] || '', alt: r[2] || '' })), ...embedded];
  }
  if (path === 'services') return rows.map((row, i) => {
    const old = (state.raw.services || []).find(s => (Array.isArray(s) ? s[0] : s.title) === row[0]);
    const image = Array.isArray(old) ? old[3] : old?.image;
    const oldAlt = Array.isArray(old) ? old[4] : old?.alt;
    if (String(image || '').startsWith('data:image/')) row[3] = image;
    if (!row[4] && oldAlt) row[4] = oldAlt;
    return row;
  });
  return rows;
}

function cropCoordinate(value) {
  const n = Number(value);
  return value !== undefined && value !== null && value !== '' && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
}

function cropEditor(role, index = 0, src = '') {
  const root = state.raw.imageArtDirection || {};
  const entry = role === 'hero' ? root.hero : (root[role] || {})[index];
  const viewports = [['desktop','Компьютер','16 / 9'],['tablet','Планшет','4 / 3'],['mobile','Телефон','3 / 4']];
  const previews = src ? '<div class="crop-live-previews" aria-label="Предпросмотр кадрирования">' + viewports.map(([key,label,ratio]) => {
    const v = entry && entry[key] || {};
    const x = cropCoordinate(v.x), y = cropCoordinate(v.y);
    return '<figure class="crop-live"><figcaption>' + label + '</figcaption><div class="crop-live__frame" style="aspect-ratio:' + ratio + '"><img src="' + esc(src) + '" alt="" data-crop-preview-role="' + role + '" data-crop-preview-index="' + index + '" data-crop-preview-viewport="' + key + '" style="object-position:' + x + '% ' + y + '%"></div></figure>';
  }).join('') + '</div>' : '';
  return '<details class="crop-editor"><summary>Кадрирование для экранов</summary>' + previews + '<div class="crop-editor__grid">' + viewports.map(([key,label]) => { const v = entry && entry[key] || {}; return '<fieldset><legend>' + label + '</legend>' + ['x','y'].map(axis => { const n = cropCoordinate(v[axis]); return '<label>' + (axis === 'x' ? 'По горизонтали' : 'По вертикали') + ' <output>' + n + '%</output><input type="range" min="0" max="100" value="' + n + '" data-crop="' + role + '" data-crop-index="' + index + '" data-crop-viewport="' + key + '" data-crop-axis="' + axis + '"></label>'; }).join('') + '</fieldset>'; }).join('') + '</div><p class="note">Предпросмотр показывает обрезку для пропорций экранов. 0% — левый/верхний край, 50% — центр, 100% — правый/нижний край. Проверьте, чтобы важные детали и лица не попадали под текст или за границу кадра.</p></details>';
}
function writeCrop(role, index, viewport, axis, value) {
  const root = state.raw.imageArtDirection || (state.raw.imageArtDirection = {});
  const bucket = role === 'hero' ? (root.hero || (root.hero = {})) : ((root[role] || (root[role] = {}))[index] || (root[role][index] = {}));
  bucket[viewport] = bucket[viewport] || { x: 50, y: 50 };
  bucket[viewport][axis] = Math.max(0, Math.min(100, Number(value) || 0));
}

function buildForm() {
  const arch = normalizeProject(state.raw).architecture;
  const archValue = arch.mode === 'exact' ? `exact:${arch.exact}` : arch.mode === 'family' ? `family:${arch.family}` : 'auto';
  const p = normalizeProject(state.raw);
  const html = GROUPS.map(([title, open, fields]) => `<details class="group"${open ? ' open' : ''}><summary>${title}</summary><div class="fields">${fields.map(([path, label, type = 'text', hint = '']) => {
    const id = 'f-' + path.replace(/[^a-z]/gi, '-');
    const small = hint ? `<small id="${id}-h">${hint}</small>` : '';
    const d = hint ? ` aria-describedby="${id}-h"` : '';
    let control;
    if (type === 'area') control = `<textarea id="${id}" data-path="${path}"${d}>${esc(get(path))}</textarea>`;
    else if (type === 'list') control = `<textarea id="${id}" class="list" data-list="${path}"${d} spellcheck="false">${esc(rowsToText(get(path), path))}</textarea>`;
    else if (type === 'arch') control = `<select id="${id}" data-special="arch">
<option value="auto">${LEGACY_LABELS.auto}</option>
<optgroup label="Семейства (как в редакторе Landing Studio)">${Object.entries(LEGACY_LABELS).filter(([k]) => k !== 'auto').map(([k, v]) => `<option value="family:${k}">${v}</option>`).join('')}</optgroup>
<optgroup label="Точная архитектура">${Object.entries(ARCHETYPES).map(([k, a]) => `<option value="exact:${k}">${a.name} — ${a.ru}</option>`).join('')}</optgroup></select>`.replace(`value="${archValue}"`, `value="${archValue}" selected`);
    else if (type === 'palette') control = `<select id="${id}" data-special="palette">${[['auto', 'Автоматически по нише'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([k, v]) => `<option value="${k}"${p.palette === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'tier') control = `<select id="${id}" data-special="tier"${d}>${Object.entries(TIERS).map(([k, v]) => `<option value="${k}"${p.tier === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'promptMode') control = `<select id="${id}" data-special="promptMode">${[['append', 'Дополнить стандартный — мои указания важнее'], ['replace', 'Заменить стандартный моим']].map(([k, v]) => `<option value="${k}"${p.customPromptMode === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'brand') control = `<select id="${id}" data-special="brand"${d}>${[['', 'Нет — подобрать по нише'], ...Object.entries(BRANDS).map(([k, b]) => [k, b.name])].map(([k, v]) => `<option value="${k}"${p.brandProfile === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    else if (type === 'mechanic') control = `<select id="${id}" data-special="mechanic"${d}><option value="">Авто</option>${Object.entries(MECHANICS).map(([k, v]) => `<option value="${k}"${state.raw.itemsMechanic === k ? ' selected' : ''}>${esc(v.split(':')[0])}</option>`).join('')}</select>`;
    else if (type === 'imageMask' || type === 'sectionDivider') { const dict = type === 'imageMask' ? MASKS : DIVIDERS; control = `<select id="${id}" data-special="${type}"${d}><option value="">Авто</option>${Object.entries(dict).map(([k, v]) => `<option value="${k}"${state.raw[type] === k ? ' selected' : ''}>${esc(v.split(':')[0])}</option>`).join('')}</select>`; }
    else if (type === 'graphicDirection') control = `<select id="${id}" data-special="graphicDirection"${d}><option value="">Авто</option>${Object.entries(GRAPHIC_DIRECTIONS).map(([k, v]) => `<option value="${k}"${state.raw.graphicDirection === k ? ' selected' : ''}>${esc(v.ru)}</option>`).join('')}</select>`;
    else if (type === 'textEffect') control = `<select id="${id}" data-special="textEffect"${d}><option value="">Авто</option>${Object.entries(TEXT_EFFECTS).map(([k, v]) => `<option value="${k}"${state.raw.textEffect === k ? ' selected' : ''}>${esc(v.split(':')[0])}</option>`).join('')}</select>`;
    else if (type === 'fontPair') control = `<select id="${id}" data-special="fontPair"${d}><option value="">Авто</option>${Object.values(WEB_FONT_PAIRS).flat().map(pr => `<option value="${esc(pr.display[0])}"${state.raw.fontPair === pr.display[0] ? ' selected' : ''}>${esc(pr.display[0] + ' + ' + pr.body[0])}${pr.accent ? ' · акцент ' + esc(pr.accent[0]) : ''}</option>`).join('')}</select>`;
    else if (type === 'fonts') control = `<select id="${id}" data-special="fonts"${d}>${[['system', 'Системные'], ['web', 'Google Fonts (с кириллицей)']].map(([k, v]) => `<option value="${k}"${p.fonts === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'accent') control = `<div class="row"><input type="color" id="${id}" data-special="accent" value="${p.accent || '#888888'}"${p.accent ? '' : ' disabled'}><input type="checkbox" id="${id}-auto" data-special="accent-auto"${p.accent ? '' : ' checked'}><label for="${id}-auto">подобрать автоматически</label></div>`;
    else if (type === 'upload-hero') control = `<input id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="hero"><div class="media-preview">${p.images.hero ? `<figure><img src="${esc(p.images.hero)}" alt=""><label>ALT-текст <input type="text" data-hero-alt value="${esc(state.raw.images?.heroAlt || '')}" placeholder="Что изображено на фото"></label><button type="button" data-remove-image="hero">Удалить фото</button>${state.raw.images?.heroMobile ? `<div class="mobile-hero-asset"><img src="${esc(state.raw.images.heroMobile)}" alt=""><span>Отдельное фото для телефона</span><button type="button" data-remove-image="hero-mobile">Удалить мобильное фото</button></div>` : `<label class="mobile-hero-upload">Отдельная композиция для телефона <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="hero-mobile"></label>`}</figure>${cropEditor("hero", 0, p.images.hero)}` : '<span class="note">Фото пока не загружено — будет использован графический мотив.</span>'}</div>`;
    else if (type === 'upload-gallery') control = `<input id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple data-upload="gallery"><div class="media-preview media-preview--grid">${(p.gallery || []).map((g,i) => `<figure draggable="true" data-gallery-item="${i}"><img src="${esc(g.src)}" alt="${esc(g.alt)}"><figcaption>${esc(g.caption || `Фото ${i+1}`)}</figcaption><label>ALT-текст <input type="text" data-gallery-alt="${i}" value="${esc(g.alt || '')}" placeholder="Что изображено на фото"></label><button type="button" data-remove-image="gallery:${i}">Удалить</button>${state.raw.imageArtDirection?.mobileSources?.gallery?.[i] ? `<div class="mobile-hero-asset"><img src="${esc(state.raw.imageArtDirection.mobileSources.gallery[i])}" alt=""><span>Мобильная версия фото</span><button type="button" data-remove-image="gallery-mobile:${i}">Удалить мобильное фото</button></div>` : `<label class="mobile-hero-upload">Отдельное фото для телефона <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="gallery-mobile" data-image-index="${i}"></label>`}${cropEditor("gallery", i, g.src)}<div class="gallery-primary-controls">${i === 0 ? '<span class="gallery-primary-badge">★ Главное фото</span>' : `<button type="button" data-gallery-primary="${i}">Сделать главным</button>`}<button type="button" data-preview-gallery="${i}">Просмотр</button></div><div class="gallery-order-controls" aria-label="Порядок фотографии"><button type="button" data-move-gallery="${i}" data-direction="-1" ${i === 0 ? "disabled" : ""} aria-label="Переместить фото выше" title="Выше">↑</button><button type="button" data-move-gallery="${i}" data-direction="1" ${i === (p.gallery.length - 1) ? "disabled" : ""} aria-label="Переместить фото ниже" title="Ниже">↓</button></div></figure>`).join('') || '<span class="note">Галерея пока пуста.</span>'}</div>`;
    else if (type === 'upload-service') { const services = Array.isArray(state.raw.services) ? state.raw.services : []; control = `<label for="${id}-target">Для какой позиции</label><select id="${id}-target" data-service-target>${services.map((s,i) => `<option value="${i}">${esc(Array.isArray(s) ? s[0] : s.title || `Позиция ${i+1}`)}</option>`).join('') || '<option value="">Сначала добавьте позиции выше</option>'}</select><input id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="service"><div class="media-preview media-preview--grid">${services.map((s,i) => { const src = Array.isArray(s) ? s[3] : s.image; return src ? `<figure><img src="${esc(src)}" alt=""><figcaption>${esc(Array.isArray(s) ? s[0] : s.title || `Позиция ${i+1}`)}</figcaption><label>ALT-текст <input type="text" data-service-alt="${i}" value="${esc(Array.isArray(s) ? s[4] || '' : s.alt || '')}" placeholder="Что изображено на фото"></label><button type="button" data-remove-image="service:${i}">Удалить</button>${state.raw.imageArtDirection?.mobileSources?.services?.[i] ? `<div class="mobile-hero-asset"><img src="${esc(state.raw.imageArtDirection.mobileSources.services[i])}" alt=""><span>Мобильная фотография</span><button type="button" data-remove-image="service-mobile:${i}">Удалить мобильное фото</button></div>` : `<label class="mobile-hero-upload">Отдельное фото для телефона <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="service-mobile" data-image-index="${i}"></label>`}${cropEditor("services", i, src)}</figure>` : ''; }).join('') || '<span class="note">Пока нет фотографий товаров и услуг.</span>'}</div>`; }
    else control = `<input id="${id}" data-path="${path}" value="${esc(get(path))}"${d}>`;
    return `<div class="field"><label for="${id}">${label}</label>${control}${small}</div>`;
  }).join('')}</div></details>`).join('');
  $('#form').innerHTML = html;
}

// ---------- Генерация и отображение ----------
const registry = () => state.library.map(l => l.entry);

function updateChangePreviewButton() {
  const button = $('#change-preview');
  if (!button) return;
  try {
    const preview = JSON.parse(localStorage.getItem(PREVIEW_STORE) || 'null');
    const available = Boolean(preview?.beforeHtml && preview?.afterHtml && preview.projectId === state.raw.id);
    button.disabled = !available;
    button.title = available ? 'Открыть сравнение в отдельной вкладке' : 'Сначала внесите изменение в текущий проект';
  } catch { button.disabled = true; }
}
function run() {
  const previousResult = result;
  const previousRaw = lastRenderedRaw;
  const nextResult = generate(state.raw, { registry: registry() });
  if (previousResult && previousRaw && previousResult.project.id === nextResult.project.id && previousResult.html !== nextResult.html) {
    try {
      localStorage.setItem(PREVIEW_STORE, JSON.stringify({
        version: 1, projectId: nextResult.project.id,
        projectName: nextResult.project.brand || nextResult.project.niche || 'Проект',
        changedAt: new Date().toISOString(),
        beforeHtml: previousResult.html, afterHtml: nextResult.html,
        beforeRaw: previousRaw, afterRaw: exportProject(normalizeProject(state.raw), nextResult.concept)
      }));
    } catch { toast('Не удалось сохранить сравнение: возможно, в браузере закончилось место. Основной проект не затронут.'); }
  }
  result = nextResult;
  lastRenderedRaw = JSON.parse(JSON.stringify(state.raw));
  $('#frame').srcdoc = result.html;
  renderSpec(); renderConcept(); renderAudit(); renderProduction(); renderRegistry();
  updateChangePreviewButton();
  persist();
}

// ---------- ТЗ и анализ ----------
// Анализ хранится вместе с проектом, для которого его сделал автопилот; у проектов из редактора — пусто.
const currentAnalysis = () => {
  if (state.analysis && state.analysis.data) return state.analysis.data;
  // Восстанавливаем анализ из записи реестра, если рабочая сессия была открыта повторно.
  const projectId = result?.project?.id;
  if (!projectId) return null;
  const saved = state.library.find(item => item?.raw && normalizeProject(item.raw).id === projectId && item.analysis);
  return saved?.analysis || null;
};
function renderSpec() {
  const a = currentAnalysis();
  const spec = buildSpec(result.project, result.concept, a || {});
  const src = a && a.sources && a.sources.length
    ? `<h2>Источники исследования</h2><ul class="chips-src">${a.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>` : '';
  const contentFields = ['brand','niche','title','description','cta','seoTitle','seoDescription','audience','offer','advantages','services','products','steps','faq','reviews','contacts'];
  const contentSnapshot = Object.fromEntries(contentFields.filter(key => result.project[key] !== undefined && result.project[key] !== '').map(key => [key, result.project[key]]));
  const textValues = contentFields.map(key => result.project[key]).flatMap(value => Array.isArray(value) ? value.flat(Infinity) : [value]).filter(value => typeof value === 'string' && value.trim());
  const genericTerms = ['лучший','номер один','уникальный','гарантируем результат','индивидуальный подход'];
  const flags = [];
  if (!String(result.project.title || '').trim()) flags.push('Не заполнен главный заголовок');
  if (String(result.project.title || '').length > 75) flags.push('Главный заголовок длиннее 75 символов');
  if (!String(result.project.description || '').trim()) flags.push('Нет пояснения к предложению');
  if (!String(result.project.cta || '').trim()) flags.push('Не задан текст основного действия');
  if (String(result.project.seoTitle || '').length > 60) flags.push('SEO Title длиннее 60 символов');
  if (String(result.project.seoDescription || '').length > 160) flags.push('SEO Description длиннее 160 символов');
  const foundGeneric = [...new Set(textValues.flatMap(value => genericTerms.filter(term => value.toLowerCase().includes(term))))];
  if (foundGeneric.length) flags.push('Проверьте неподтверждённые или шаблонные формулировки: ' + foundGeneric.join(', '));
  contentPrompt = () => {
    const direction = ($('#content-direction')?.value || '').trim();
    return [
      'РОЛЬ: AI Content Director — старший UX-копирайтер и редактор коммерческих сайтов.',
      'ЗАДАЧА: улучшить тексты текущего проекта, не меняя структуру и смысл подтверждённых фактов.',
      'ПРАВИЛА: не выдумывай цены, сроки, отзывы, гарантии, сертификаты, адреса, статистику и преимущества. Не используй пустые превосходные степени. Если данных недостаточно — оставь поле без выдумки и укажи, что нужно уточнить.',
      'Сделай заголовок конкретным, объясни ценность предложения, пиши для указанной аудитории, убери повторы и канцелярит. Сохрани русский язык и адаптируй длину текста под веб-интерфейс.',
      'Верни результат строго JSON с теми же ключами, которые есть во входных данных; не удаляй неизвестные поля. Для каждого изменённого текста добавь краткое обоснование отдельно в поле editorialNotes. Не переписывай массивы изображений и технические настройки.',
      direction ? 'ДОПОЛНИТЕЛЬНОЕ НАПРАВЛЕНИЕ: ' + direction : '',
      'ТЕКУЩИЕ ДАННЫЕ ПРОЕКТА: ' + JSON.stringify(contentSnapshot),
      a ? 'КОНТЕКСТ АНАЛИЗА: ' + JSON.stringify({ audience:a.audience, pains:a.pains, objections:a.objections, positioning:a.positioning, sources:a.sources }) : 'Контекст аудитории и рынка не подтверждён — не выдавай предположения за факты.'
    ].filter(Boolean).join('\n\n');
  };
  $('#view-spec').innerHTML = `
<div class="spec-actions"><button type="button" data-spec="copy">Скопировать ТЗ</button><button type="button" data-spec="md">Скачать ТЗ (.md)</button><button type="button" data-spec="prompt">Скопировать промт для нейросети</button></div>
<p class="note">${a ? (a.source === 'ai' ? 'Тексты и структура подготовлены AI по вашему брифу. Веб-поиск не выполнялся: рыночные данные, конкуренты и частотность ключевых запросов требуют отдельной проверки.' : 'Анализ и тексты собраны локальным автопилотом по знаниям о нише — это стартовая гипотеза. Для исследования в интернете укажите адрес AI-сервера в автопилоте или отдайте промт нейросети.') : 'ТЗ собрано по текущему проекту. Автопилот добавит сюда анализ аудитории, возражения, поводы и ключевые запросы.'}</p>
<section class="content-director" aria-labelledby="content-director-title">
  <div class="content-director__head"><div><span class="eyebrow">AI CONTENT DIRECTOR</span><h2 id="content-director-title">Редактор коммерческих текстов</h2><p class="note">Анализирует заполненность и готовит точное задание для AI. Тексты автоматически не меняются: результат можно проверить перед импортом.</p></div><span class="content-director__mark" aria-hidden="true">✦</span></div>
  <div class="content-director__stats"><div><b>${textValues.length}</b><small>текстовых значений</small></div><div><b>${flags.length}</b><small>замечаний</small></div><div><b>${a?.sources?.length || 0}</b><small>источников анализа</small></div></div>
  <ul class="content-director__checks">${flags.length ? flags.map(item => '<li>! ' + esc(item) + '</li>').join('') : '<li class="is-ok">✓ Базовые проверки заполненности пройдены. Это не подтверждает фактическую достоверность текста.</li>'}</ul>
  <label class="content-director__label" for="content-direction">Редакторское направление</label>
  <textarea id="content-direction" rows="3" maxlength="2000" placeholder="Например: спокойный премиальный тон, меньше прилагательных, больше конкретики и пользы для клиента…"></textarea>
  <div class="spec-actions"><button type="button" data-content="copy">Скопировать задание AI</button><button type="button" data-content="download">Скачать задание (.txt)</button></div>
</section>
<pre class="spec">${esc(spec)}</pre>${src}`;
  try { $('#content-direction').value = localStorage.getItem('uds:content-direction') || ''; } catch {}
}
$('#view-spec').addEventListener('input', e => {
  if (e.target.id === 'content-direction') { try { localStorage.setItem('uds:content-direction', e.target.value); } catch {} }
});
$('#view-spec').addEventListener('click', async e => {
  const b = e.target.closest('[data-spec], [data-content]'); if (!b) return;
  const a = currentAnalysis() || {};
  const copy = async (text, ok, file) => { try { await navigator.clipboard.writeText(text); toast(ok); } catch { download(file, text, 'text/plain'); } };
  if (b.dataset.spec === 'copy') copy(buildSpec(result.project, result.concept, a), 'ТЗ скопировано', `${result.project.id}-tz.md`);
  if (b.dataset.spec === 'md') download(`${result.project.id}-tz.md`, buildSpec(result.project, result.concept, a), 'text/markdown');
  if (b.dataset.spec === 'prompt') copy(buildPrompt(result.project, result.concept, a), 'Промт скопирован', `${result.project.id}-prompt.txt`);
  if (b.dataset.content === 'copy') copy(contentPrompt(), 'Задание AI Content Director скопировано', `${result.project.id}-content-director.txt`);
  if (b.dataset.content === 'download') download(`${result.project.id}-content-director.txt`, contentPrompt(), 'text/plain');
});

// ---------- Производство: конвейер, контроль качества и безопасные исправления ----------
const QUALITY_HISTORY = 'uds:quality-history:v1';
function qualityHistory() {
  try { return JSON.parse(localStorage.getItem(QUALITY_HISTORY) || '[]').filter(e => e && e.projectId === state.raw.id).slice(-10); } catch { return []; }
}
function recordQualityHistory(entry) {
  try {
    const all = JSON.parse(localStorage.getItem(QUALITY_HISTORY) || '[]');
    all.push({ ...entry, projectId: state.raw.id, at: new Date().toISOString() });
    localStorage.setItem(QUALITY_HISTORY, JSON.stringify(all.slice(-50)));
  } catch { /* история — удобство, без неё работа продолжается */ }
}
const STAGE_LABEL = { done: 'Готово', attention: 'Нужно внимание', input: 'Нужны данные', manual: 'Вручную' };
function renderProduction() {
  const host = $('#view-production');
  if (!host || !result) return;
  const q = qualityReport(result);
  const p = result.project;
  const a = currentAnalysis();
  const photos = [p.images?.hero, ...(p.gallery || []).map(g => g.src), ...(p.services || []).map(s => s.image)].filter(Boolean).length;
  const director = q.findings.filter(f => f.source === 'design-director');
  const fixable = q.findings.filter(f => f.autoFix);
  const kb = Math.round(new TextEncoder().encode(result.html).length / 1024);
  const arch = ARCHETYPES[result.concept.designDNA.primaryArchetype];
  const stages = [
    ['Бриф', p.niche ? 'done' : 'input', p.niche ? `${esc(p.brand || 'Без названия')} · ${esc(p.niche)}` : 'Укажите нишу проекта'],
    ['Анализ', a ? 'done' : 'manual', a ? (a.source === 'ai' ? 'AI-генерация по брифу' : 'Локальный автопилот') : 'Проект из редактора: анализ не запускался. Используйте автопилот.'],
    ['Design DNA', 'done', `${esc(arch.name)} — ${esc(result.concept.homepage.heroComposition)}`],
    ['Визуальный бриф', photos ? 'done' : 'input', photos ? `Фотографий: ${photos}` : 'Фото не загружены: на странице абстрактный мотив. Задание для съёмки — во вкладке «Проверка».'],
    ['HTML', 'done', `Самодостаточная страница, ${kb} КБ`],
    ['Аудит', result.audit.ok ? 'done' : 'attention', `Ошибок: ${result.audit.errors.length}, предупреждений: ${result.audit.warnings.length}`],
    ['Контроль качества', q.counts.critical || q.counts.high ? 'attention' : 'done', `Critical ${q.counts.critical} · High ${q.counts.high} · Medium ${q.counts.medium} · Low ${q.counts.low}`],
    ['Design Director', director.length ? 'attention' : 'done', director.length ? `Рекомендаций: ${director.length}. Применяются только вручную.` : 'Рекомендаций нет'],
    ['Исправления', fixable.length ? 'attention' : 'done', fixable.length ? `Можно исправить автоматически: ${fixable.length}` : 'Автоматически исправлять нечего'],
    ['Экспорт', 'done', 'HTML и JSON проекта доступны'],
    ['Публикация', 'manual', 'Хостинг не подключён: скачайте HTML и загрузите его на свой хостинг. Студия не считает сайт опубликованным.'],
  ];
  const badge = $('#production-badge');
  if (badge) { const n = q.counts.critical + q.counts.high; badge.textContent = n || '✓'; badge.className = 'badge ' + (n ? 'err' : 'ok'); }
  const groups = Object.entries(QUALITY_CATEGORIES).map(([id, label]) => [label, q.byCategory[id]]).filter(([, list]) => list.length);
  const history = qualityHistory();
  host.innerHTML = `<div class="production">
  <div class="production__head"><div><span class="eyebrow">PRODUCTION PIPELINE</span><h2>Производственный конвейер</h2>
    <p class="note">Статусы считаются по текущему проекту. Ориентир качества: ${q.score} из 100 — он нужен для сравнения версий, а не как оценка дизайна.</p></div>
    <div class="production__actions"><button type="button" class="primary" data-production="fix"${fixable.length ? '' : ' disabled'}>Исправить автоматически${fixable.length ? ` (${fixable.length})` : ''}</button><button type="button" data-production="html">Скачать HTML</button><button type="button" data-production="json">Экспорт JSON</button></div></div>
  <ol class="production__stages">${stages.map(([name, st, detail]) => `<li class="is-${st}"><b>${name}</b><span class="production__state">${STAGE_LABEL[st]}</span><small>${detail}</small></li>`).join('')}</ol>
  <h3>Замечания по направлениям</h3>
  ${groups.length ? groups.map(([label, list]) => `<section class="production__group"><h4>${esc(label)} <span class="note">${list.length}</span></h4><ul>${list.map(f => `<li><span class="sev sev--${f.severity}">${SEVERITY_LABELS[f.severity]}</span><span>${esc(f.message)}${f.action ? `<br><small class="note">${esc(f.action)}</small>` : ''}</span>${f.autoFix ? '<em class="production__auto">исправится автоматически</em>' : ''}</li>`).join('')}</ul></section>`).join('') : '<p class="summary ok">Замечаний нет.</p>'}
  <h3>История проверок</h3>
  ${history.length ? `<ul class="production__history">${history.slice().reverse().map(h => `<li>${new Date(h.at).toLocaleString('ru-RU')}: ${esc(h.text)}</li>`).join('')}</ul>` : '<p class="note">Автоисправления ещё не запускались.</p>'}
</div>`;
}
$('#view-production').addEventListener('click', e => {
  const b = e.target.closest('[data-production]'); if (!b || b.disabled) return;
  if (b.dataset.production === 'html') { $('#download').click(); return; }
  if (b.dataset.production === 'json') { $('#export').click(); return; }
  // Безопасные исправления с повторной проверкой: не больше двух проходов, остановка, если менять нечего.
  const r = fixAndRecheck(state.raw, raw => generate(raw, { registry: registry() }), { maxPasses: 2 });
  if (!r.passes.length) { toast('Автоматически исправлять нечего'); return; }
  const fields = [...new Set(r.passes.flatMap(x => x.applied.flatMap(a => a.fields)))];
  const text = `исправлено полей: ${fields.join(', ')}; замечаний было ${r.before.findings.length}, стало ${r.after.findings.length}`;
  recordQualityHistory({ text, before: r.before.counts, after: r.after.counts });
  load(r.project, `Исправлено автоматически: ${fields.join(', ')}. Повторная проверка: было ${r.before.findings.length}, стало ${r.after.findings.length}.`);
  selectTab($('#tab-production'));
});

// ---------- Библиотека шаблонов в автопилоте ----------
function readTemplateLibrary() {
  try { return normalizeLibrary(JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]')); } catch { return []; }
}
function renderLibraryHint() {
  const hint = $('#auto-library-h'); if (!hint) return;
  const filled = readTemplateLibrary().filter(t => t.status !== 'source-saved').length;
  const link = '<a href="templates.html">Открыть библиотеку</a>';
  hint.innerHTML = $('#auto-library').value === 'off' ? 'Концепция строится только по нише и контенту. ' + link
    : filled ? 'Заполненных профилей: ' + filled + '. Подходящие принципы переосмысляются, дизайн не копируется. ' + link
    : 'В библиотеке пока нет заполненных профилей. ' + link;
}
try { $('#auto-library').value = localStorage.getItem('uds:use-library') === 'off' ? 'off' : 'auto'; } catch {}
$('#auto-library').addEventListener('change', () => { try { localStorage.setItem('uds:use-library', $('#auto-library').value); } catch {} renderLibraryHint(); });
window.addEventListener('storage', e => { if (e.key === LIBRARY_KEY) renderLibraryHint(); });
window.addEventListener('pageshow', renderLibraryHint);
renderLibraryHint();

// ---------- Автопилот ----------
try {
  $('#auto-endpoint').value = localStorage.getItem('uds:ai-endpoint') || getDefaultAiEndpoint();
  $('#auto-prompt').value = localStorage.getItem('uds:custom-prompt') || '';
  $('#auto-prompt-mode').value = localStorage.getItem('uds:custom-prompt-mode') === 'replace' ? 'replace' : 'append';
  if ($('#auto-prompt').value) $('#auto-prompt-box').open = true;
} catch { /* нет хранилища */ }
$('#auto').addEventListener('submit', async e => {
  e.preventDefault();
  const input = {
    niche: $('#auto-niche').value.trim(), tier: $('#auto-tier').value, brand: $('#auto-brand').value.trim(), city: $('#auto-city').value.trim(),
    details: $('#auto-details').value.trim(), email: $('#auto-email').value.trim(), phone: $('#auto-phone').value.trim(),
    customPrompt: $('#auto-prompt').value.trim().slice(0, 8000), customPromptMode: $('#auto-prompt-mode').value,
  };
  if (!input.niche) return $('#auto-niche').focus();
  const useLibrary = $('#auto-library').value !== 'off';
  const references = useLibrary ? referencesFor(readTemplateLibrary(), input) : [];
  if (references.length) input.designReferences = references;
  const endpoint = $('#auto-endpoint').value.trim();
  try {
    localStorage.setItem('uds:ai-endpoint', endpoint);
    localStorage.setItem('uds:custom-prompt', input.customPrompt);
    localStorage.setItem('uds:custom-prompt-mode', input.customPromptMode);
  } catch { /* нет хранилища */ }
  const setAutoStatus = value => { const node = $('#auto-status'); if (node) node.textContent = value; };
  const setAutoProgress = (percent, stage, detail = '') => {
    const root = $('#auto-progress'), bar = $('#auto-progress-bar');
    const value = $('#auto-progress-value'), label = $('#auto-progress-stage');
    const extra = $('#auto-progress-detail');
    if (!root || !bar || !value || !label) return;
    root.hidden = false;
    const safe = Math.max(0, Math.min(100, Math.round(percent)));
    bar.style.width = safe + '%';
    const track = root.querySelector('[role="progressbar"]');
    if (track) track.setAttribute('aria-valuenow', String(safe));
    value.textContent = safe + '%';
    label.textContent = stage;
    if (extra) extra.textContent = detail;
    root.dataset.state = safe >= 100 ? 'complete' : 'running';
  };
  const go = $('#auto-go');
  go.disabled = true;
  setAutoProgress(3, 'Подготовка проекта', 'Проверяем бриф и параметры генерации');
  let draft = null, note = '';
  if (endpoint) {
    setAutoStatus('AI формирует тексты и структуру проекта по вашему брифу — ход генерации отображается ниже…');
    setAutoProgress(12, 'AI формирует тексты и структуру', 'Отправляем бриф в Cloudflare Workers AI');
    try {
      // Серверу уходит полный подробный промт студии (концепция, тон класса, требования к блокам, свой промт),
      // а не только ниша: так AI пишет тексты внутри выбранной композиции.
      const studioPrompt = autopilot(input, { registry: registry(), forWorker: true }).prompt;
      const aiStarted = Date.now();
      let res, body;
      try {
        res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, studioPrompt }) });
        body = await res.json().catch(() => ({}));
      } catch (error) { logAi({ kind: 'text', label: 'Тексты сайта: ' + input.niche, status: 'error', error: 'сеть: ' + error.message, ms: Date.now() - aiStarted }); throw error; }
      logAi({ kind: 'text', label: 'Тексты сайта: ' + input.niche, status: res.ok && body.landing ? 'ok' : 'error', error: body.error || (res.ok ? '' : 'HTTP ' + res.status), ms: body.durationMs || Date.now() - aiStarted, model: body.model || '', tokens: body.usage?.totalTokens || null, attempts: body.attempts || null });
      if (!res.ok || !body.landing) throw new Error(body.error || `сервер ответил ${res.status}`);
      setAutoProgress(48, 'AI подготовил ответ', 'Проверяем и собираем данные проекта');
      draft = fromAiLanding(body.landing, input);
      refreshAiUsage();
      note = `Готово: AI сформировал тексты и структуру проекта по вашему брифу.`;
    } catch (err) {
      note = `AI-сервер недоступен (${err.message}). Собрал сайт локальным автопилотом без интернета.`;
      setAutoProgress(35, 'Переключение на локальный режим', 'AI недоступен — продолжаем без сервера');
    }
  }
  if (!draft) {
    setAutoProgress(52, 'Локальная сборка проекта', 'Формируем структуру и контент');
    const local = autopilot(input, { registry: registry() });
    draft = { project: local.project, analysis: local.analysis };
    if (!note) note = 'Готово: сайт собран локальным автопилотом. Тексты — стартовая гипотеза, проверьте вкладку «ТЗ и анализ».';
  }
  note += references.length ? ' Учтены профили библиотеки: ' + references.map(r => '«' + r.name + '»').join(', ') + '.' : '';
  setAutoProgress(58, 'Сборка сайта', 'Подготавливаем предпросмотр, SEO и проверку качества');
  state.analysis = { projectId: draft.project.id, data: draft.analysis };
  load(draft.project);
  if (endpoint) {
    setAutoStatus(note + ' Подготавливаю фотографии для сайта…');
    setAutoProgress(65, 'Генерация изображений', 'Подготавливаем визуальные материалы');
    try {
      const images = await generateProjectImages(endpoint, draft.project.id, (done, total, subject) => setAutoProgress(65 + (done / Math.max(1, total)) * 30, 'Генерация изображений', 'Готово ' + done + ' из ' + total + ': ' + subject));
      if (images.generated) note += ' Автоматически созданы и вставлены изображения: ' + images.generated + '.';
      else note += ' Для выбранной композиции отдельные фотографии не требуются.';
    } catch (error) {
      note += ' Генерация фотографий не завершена: ' + error.message + ' Можно повторить позже или загрузить свои снимки.';
    }
    setAutoStatus(note);
    refreshAiUsage();
  }
  // Статус обязателен и для локального режима без AI endpoint.
  // Иначе генерация проходит, но пользователь и E2E-тест не видят завершения.
  setAutoStatus(note);
  setAutoProgress(100, 'Генерация завершена', note);
  go.disabled = false;
  selectTab($('#tab-preview'));
  toast(note);
});
let timer;
const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 220); };

const ul = arr => (arr.length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<span class="note">—</span>');
const kv = rows => `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

function renderVisualAssetLibrary() {
  const mobile = state.raw.imageArtDirection?.mobileSources || {};
  const assets = [];
  const hero = state.raw.images?.hero;
  if (hero) assets.push({ role: 'Первый экран', name: 'Hero', desktop: hero, phone: state.raw.images?.heroMobile || '', detail: 'Главная фотография сайта', index: 0 });
  (state.raw.gallery || []).forEach((item, index) => {
    if (item?.src) assets.push({ role: 'Галерея', name: item.caption || `Фото ${index + 1}`, desktop: item.src, phone: mobile.gallery?.[index] || '', detail: `Изображение ${index + 1}`, index });
  });
  (state.raw.services || []).forEach((item, index) => {
    const src = Array.isArray(item) ? item[3] : item?.image;
    if (src) assets.push({ role: 'Карточка', name: Array.isArray(item) ? item[0] : item.title || `Позиция ${index + 1}`, desktop: src, phone: mobile.services?.[index] || '', detail: 'Товар или услуга', index });
  });
  const mobileCount = assets.filter(item => item.phone).length;
  const cropPreview = (item, role, index) => {
    const entry = role === 'hero' ? state.raw.imageArtDirection?.hero : state.raw.imageArtDirection?.[role]?.[index];
    const viewports = [['desktop','Компьютер','16 / 9'],['tablet','Планшет','4 / 3'],['mobile','Телефон','3 / 4']];
    return '<div class="asset-library__crops">' + viewports.map(([viewport,label,ratio]) => {
      const focal = entry?.[viewport] || {};
      const src = viewport === 'mobile' && item.phone ? item.phone : item.desktop;
      const position = cropCoordinate(focal.x) + '% ' + cropCoordinate(focal.y) + '%';
      return `<figure><div class="asset-library__crop-frame" style="aspect-ratio:${ratio}"><img src="${esc(src)}" alt="" loading="lazy" style="object-position:${position}"></div><figcaption>${label}</figcaption></figure>`;
    }).join('') + `</div><button type="button" class="asset-library__crop-action" data-open-crop-role="${role}" data-open-crop-index="${index}">Настроить кадрирование</button>`;
  };
  return `<section class="asset-library" aria-labelledby="asset-library-title">
    <div class="asset-library__head"><div><h2 id="asset-library-title">Библиотека изображений</h2><p class="note">Фотографии проекта: назначение, десктопная версия и отдельный кадр для телефона.</p></div>
    <div class="asset-library__stats"><b>${assets.length}</b><span>фото</span><b>${mobileCount}</b><span>мобильных версий</span></div></div>
    ${assets.length ? `<div class="asset-library__grid">${assets.map(item => `<article class="asset-library__item">
      <div class="asset-library__meta"><span class="asset-library__role">${esc(item.role)}</span><b>${esc(item.name)}</b><small>${esc(item.detail)}</small></div>
      ${cropPreview(item, item.role === 'Первый экран' ? 'hero' : item.role === 'Галерея' ? 'gallery' : 'services', item.index)}
      <div class="asset-library__mobile">${item.phone ? `<img src="${esc(item.phone)}" alt="" loading="lazy"><span class="is-ready">Отдельное фото для телефона</span>` : `<span class="is-empty">Мобильная версия использует основной кадр</span>`}</div>
    </article>`).join('')}</div>` : '<p class="note asset-library__empty">Фотографий пока нет. Добавьте Hero, изображения галереи или фото карточек.</p>'}
    <div class="asset-library__actions"><button type="button" data-open-image-settings>Управлять фотографиями</button><button type="button" data-open-image-audit>Проверить качество фото</button></div>
  </section>`;
}

document.addEventListener('click', e => {
  if (!e.target.closest('#drop-references') || !result?.concept?.libraryUse) return;
  delete result.concept.libraryUse;
  result.concept.designBrief.contextFactors = (result.concept.designBrief.contextFactors || []).filter(x => !x.includes('Конкурентная среда:'));
  renderConcept();
  toast('Референсы исключены из текущей концепции');
});

function renderConcept() {
  const c = result.concept, b = c.designBrief, d = c.designDNA, h = c.homepage, u = c.uniquenessCheck, vs = c.visualSystem;
  const name = id => (id ? `${ARCHETYPES[id].name} <span class="note">(${ARCHETYPES[id].ru})</span>` : '<span class="note">—</span>');
  const pal = vs.palette;
  const sw = [['Фон', pal.bg, pal.text], ['Поверхность', pal.surface, pal.text], ['Текст', pal.text, pal.bg], ['Вторичный текст', pal.muted, pal.bg], ['Акцент', pal.accent, pal.accentText], ['Тон', pal.tint, pal.text]];
  $('#view-concept').innerHTML = `
<h2>Design Brief</h2><div class="card">${kv([
    ['Бизнес', esc(b.businessType)], ['Продукт', esc(b.product) || '—'], ['Аудитория', esc(b.audience)], ['Целевое действие', esc(b.primaryGoal)],
    ['Характер бренда', esc(b.brandCharacter)], ['Приоритет контента', `<div class="chips">${b.contentPriority.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>`],
    ['Доказательства доверия', ul(b.trustProofs)], ['Ограничения', ul(b.constraints)], ['Гипотезы', ul(b.assumptions)],
  ])}</div>
${renderVisualAssetLibrary()}
${c.libraryUse ? `<section class="card" id="library-reference-panel"><h2>Библиотека шаблонов</h2><p><b>Использованы профили:</b> ${ul(c.libraryUse.references.map(r => `«${r.name}» — ${r.category}`))}</p><h3>Применённые принципы</h3>${ul(c.libraryUse.applied)}<h3>Чем проект отличается</h3>${ul(c.libraryUse.divergence)}<button type="button" id="drop-references">Убрать референсы из проекта</button></section>` : ''}
<h2>Design DNA</h2><div class="card">${kv([
    ['Концепция', '<b>' + esc(d.conceptName || '') + '</b> <span class="note">— ' + esc(d.conceptFormula || '') + '</span>'], ['Что учтено', ul(b.contextFactors || [])],
    ['Основная архитектура', name(d.primaryArchetype)], ['Вспомогательная', name(d.secondaryArchetype)], ['Обоснование', esc(d.selectionRationale)],
    ['Цвет', esc(d.colorDirection)], ['Типографика', esc(d.typographyDirection)], ['Изображения', esc(d.imageDirection)], ['Движение', esc(d.motionDirection)],
    ['Форма', esc(vs.shape.label)], ['Кнопки', esc(vs.button.label)], ['Карточки', esc(MECHANICS[vs.variants.itemsMechanic || 'none'] || '')], ['Фото', esc(MASKS[vs.forms?.mask || 'none'] || '')], ['Разделители', esc(DIVIDERS[vs.forms?.divider || 'none'] || '')], ['Эффект текста', esc(TEXT_EFFECTS[vs.textEffect || 'none'] || '')], ['Графика', vs.graphicDirection ? esc(vs.graphicDirection.ru) + ' <span class="note">— ' + esc(vs.graphicDirection.assetBrief || '') + '</span>' : ''], ['Пара шрифтов', esc(vs.typography.pair || 'системные шрифты')],
  ])}</div>
<h2>Палитра и контраст</h2>
<div class="swatches">${sw.map(([n, bg, fg]) => `<div class="swatch" style="background:${bg};color:${fg}"><b>${n}</b>${bg}</div>`).join('')}</div>
<table style="margin-top:12px"><thead><tr><th>Пара</th><th>Контраст</th></tr></thead><tbody>${pal.pairs.map(p => `<tr><td>${esc(p.name)}</td><td>${p.ratio}:1 ${p.ratio >= 4.5 ? '✓' : '✗'}</td></tr>`).join('')}</tbody></table>
<h2>Главная страница</h2><div class="card">${kv([
    ['Первый экран', esc(h.heroComposition)], ['Навигация', esc(h.navigationPattern)], ['Основной CTA', esc(h.primaryCTA)],
    ['Секции', `<ol style="margin:0;padding-left:20px">${h.sections.map(s => `<li><b>${esc(s.id)}</b> — ${esc(s.role)}</li>`).join('')}</ol>`],
  ])}</div>
<h2>Антишаблонная проверка</h2><div class="card">${kv([
    ['Шаблонность', u.templateReuseDetected ? '<b style="color:var(--err)">обнаружена и не устранена</b>' : 'не обнаружена или устранена'],
    ['Найденные повторы', ul(u.repeatedPatterns)], ['Что изменено', ul(u.differentiationActions)],
    ['Сравнение с соседями', u.comparedWith.length ? ul(u.comparedWith.map(x => `${x.brand}: сходство ${Math.round(x.similarity * 100)}%`)) : '<span class="note">Реестр пуст — сохраните проекты кнопкой «В реестр», чтобы следующие генерации сравнивались с ними.</span>'],
  ])}</div>`;
}

let imageAuditRun = 0;
function collectImageAssets() {
  const out = [];
  const hero = state.raw.images?.hero;
  if (hero) out.push({ role: 'hero', label: 'Первый экран', src: hero });
  (state.raw.gallery || []).forEach((g, i) => { if (g?.src) out.push({ role: 'gallery', label: g.caption || `Галерея ${i + 1}`, src: g.src }); });
  (state.raw.services || []).forEach((s, i) => {
    const src = Array.isArray(s) ? s[3] : s?.image;
    if (src) out.push({ role: 'service', label: Array.isArray(s) ? s[0] : s.title || `Позиция ${i + 1}`, src });
  });
  return out;
}
function inspectImage(asset) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth, height = img.naturalHeight, ratio = width / Math.max(1, height);
      const warnings = [], tips = [], minSide = Math.min(width, height);
      if (asset.role === 'hero' && (width < 1200 || height < 650)) warnings.push('Для первого экрана разрешение может быть маловато; ориентир — от 1600 × 900 px.');
      if (asset.role === 'gallery' && minSide < 700) warnings.push('Для галереи желательно не менее 700 px по короткой стороне.');
      if (asset.role === 'service' && minSide < 600) warnings.push('Для карточки товара или услуги желательно не менее 600 px по короткой стороне.');
      if (asset.role === 'hero') {
        if (ratio < 1.25) tips.push('Широкий экран: кадр может выглядеть тесно. Подготовьте горизонтальную версию около 16:9.');
        if (ratio > 2.1) tips.push('Мобильный экран: при заполнении блока по ширине верх и низ могут обрезаться. Проверьте важный объект в центральной безопасной зоне или подготовьте вертикальный кадр 4:5.');
        else tips.push('Мобильный экран: проверьте, что главный объект остаётся в центральной части кадра; для портретного блока лучше отдельный кадр 4:5.');
      } else if (asset.role === 'service') {
        if (ratio < 0.78 || ratio > 1.35) tips.push('Карточка обычно лучше смотрится с квадратным кадром 1:1; при обрезке проверьте, что товар целиком виден.');
      } else if (ratio < 0.72 || ratio > 1.8) tips.push('Галерея: необычные пропорции могут обрезаться в сетке. Проверьте кадрирование и главный объект.');
      let brightness = null, detail = null, visualHash = '';
      if (asset.src.startsWith('data:image/')) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 64; canvas.height = 64;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0, 64, 64);
            const pixels = ctx.getImageData(0, 0, 64, 64).data;
            let sum = 0, count = 0, edges = 0, edgeCount = 0, prev = null;
            const zoneSums = [0,0,0], zoneCounts = [0,0,0];
            let minLuminance = 255, maxLuminance = 0;
            for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
              const i = (y * 64 + x) * 4;
              const l = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
              sum += l; count++;
              const zone = Math.min(2, Math.floor(x / (64 / 3)));
              zoneSums[zone] += l; zoneCounts[zone]++;
              minLuminance = Math.min(minLuminance, l); maxLuminance = Math.max(maxLuminance, l);
              if (x && prev !== null) { edges += Math.abs(l - prev); edgeCount++; }
              if (y) { const up = ((y - 1) * 64 + x) * 4; const ul = .2126 * pixels[up] + .7152 * pixels[up + 1] + .0722 * pixels[up + 2]; edges += Math.abs(l - ul); edgeCount++; }
              prev = l;
            }
            brightness = count ? sum / count : null;
            detail = edgeCount ? edges / edgeCount : null;
            asset._brightnessZones = zoneSums.map((value,index) => zoneCounts[index] ? value / zoneCounts[index] : null);
            asset._luminanceRange = maxLuminance - minLuminance;
            const hashCanvas = document.createElement('canvas');
            hashCanvas.width = 8; hashCanvas.height = 8;
            const hashContext = hashCanvas.getContext('2d', { willReadFrequently: true });
            if (hashContext) {
              hashContext.drawImage(img, 0, 0, 8, 8);
              const sample = hashContext.getImageData(0, 0, 8, 8).data;
              const luminance = [];
              for (let i = 0; i < sample.length; i += 4) luminance.push(.2126 * sample[i] + .7152 * sample[i + 1] + .0722 * sample[i + 2]);
              const average = luminance.reduce((a, b) => a + b, 0) / luminance.length;
              if (Math.max(...luminance) - Math.min(...luminance) > 8) visualHash = luminance.map(v => v >= average ? '1' : '0').join('');
            }
          }
        } catch { /* Проверка пикселей может быть недоступна для отдельных форматов. */ }
      }
      if (brightness !== null && brightness < 48) warnings.push('Кадр выглядит очень тёмным по средней яркости; проверьте детали в тенях.');
      if (detail !== null && detail < 5) warnings.push('Мало мелких деталей на уменьшенной копии: возможна мягкость или расфокус. Проверьте фото визуально.');
      resolve({ ...asset, width, height, ratio, warnings, tips, brightness, detail, visualHash, brightnessZones: asset._brightnessZones || null, luminanceRange: asset._luminanceRange ?? null });
    };
    img.onerror = () => resolve({ ...asset, error: 'Не удалось прочитать изображение. Проверьте ссылку или формат.', warnings: [], tips: [] });
    img.src = asset.src;
  });
}
function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) distance++;
  return distance;
}
// AI Image Director PRO: задание на каждое место для изображения на странице — и до загрузки фото тоже.
function renderImageTasks() {
  if (!result) return '';
  const { slots, filled, total } = imageSlots(result.project, result.concept);
  return `<section class="image-tasks" aria-labelledby="image-tasks-title">
    <h3 id="image-tasks-title">Задания на изображения</h3>
    <p class="note">Заполнено мест: <b>${filled} из ${total}</b>. Для каждого места — сюжет, ракурс, свет, фон, композиция и формат под выбранную раскладку. Студия не генерирует изображения: задание можно отдать фотографу или во внешний генератор.</p>
    <div class="spec-actions"><button type="button" data-image-tasks="copy">Скопировать все задания</button><button type="button" data-image-tasks="download">Скачать задания (.txt)</button></div>
    <div class="image-tasks__list">${slots.map(slot => `<details class="image-task ${slot.filled ? 'is-filled' : 'is-missing'}"><summary><b>${esc(slot.label)}</b><span>${slot.filled ? 'фото есть' : 'нужно фото'} · ${esc(slot.aspect)}</span></summary><pre>${esc(slotBrief(slot, result.project))}</pre></details>`).join('')}</div>
  </section>`;
}
async function renderImageIntelligence() {
  const host = $('#image-intelligence');
  if (!host) return;
  const token = ++imageAuditRun;
  const assets = collectImageAssets();
  if (!assets.length) { host.innerHTML = '<p class="note">Фотографии пока не добавлены. Загрузите снимки в разделе «Изображения», чтобы проверить их качество и кадрирование.</p>' + renderImageTasks(); return; }
  host.innerHTML = '<p class="note">Проверяем разрешение, пропорции, яркость и детализацию загруженных фотографий…</p>';
  const reports = await Promise.all(assets.map(inspectImage));
  if (token !== imageAuditRun || !host.isConnected) return;
  const warningCount = reports.reduce((n, r) => n + r.warnings.length, 0);
  const sourceCounts = new Map();
  reports.forEach(r => sourceCounts.set(r.src, (sourceCounts.get(r.src) || 0) + 1));
  const duplicateCount = [...sourceCounts.values()].filter(n => n > 1).reduce((n, count) => n + count - 1, 0);
  const comparable = reports.filter(r => r.visualHash && !r.error);
  const nearDuplicatePairs = [];
  for (let i = 0; i < comparable.length; i++) for (let j = i + 1; j < comparable.length; j++) {
    if (comparable[i].src === comparable[j].src) continue;
    const distance = hammingDistance(comparable[i].visualHash, comparable[j].visualHash);
    if (distance <= 5) nearDuplicatePairs.push([comparable[i], comparable[j], distance]);
  }
  const nearDuplicateCount = nearDuplicatePairs.length;
  const missingRoles = ['hero','gallery','service'].filter(role => !reports.some(r => r.role === role));
  const visual = renderVisualAssetDirector(reports, duplicateCount, nearDuplicateCount, missingRoles, nearDuplicatePairs);
  host.innerHTML = `<p class="summary ${warningCount || duplicateCount ? 'err' : 'ok'}">Проверено изображений: ${reports.length}. Замечаний по качеству: ${warningCount}. Точных повторов: ${duplicateCount}. Похожих кадров: ${nearDuplicateCount}.</p>
  <div class="image-audit-grid">${reports.map(r => `<article class="image-audit-card">
    <div class="image-audit-head"><b>${esc(r.label)}</b><span class="note">${r.role === 'hero' ? 'Первый экран' : r.role === 'service' ? 'Карточка' : 'Галерея'}</span></div>
    <div class="image-audit-body"><img src="${esc(r.src)}" alt="" loading="lazy"><div><b>${r.error ? 'Не удалось проверить' : `${r.width} × ${r.height} px`}</b><span class="note">${r.error ? esc(r.error) : `Пропорции: ${r.ratio.toFixed(2)}:1`}</span>
    ${r.warnings.map(w => `<p class="image-audit-warning">${esc(w)}</p>`).join('')}${r.tips.map(t => `<p class="image-audit-tip">${esc(t)}</p>`).join('')}${!r.warnings.length && !r.tips.length && !r.error ? '<p class="image-audit-ok">Явных проблем по базовым параметрам не обнаружено.</p>' : ''}</div></div>
  </article>`).join('')}</div>
  ${visual}
  ${renderImageTasks()}
  <p class="note">Автоматическая оценка — ориентир, а не экспертное распознавание сюжета. Реальное размытие, важный объект и точку обрезки обязательно проверьте в предпросмотре на ширине 320, 768 и 1280 px.</p>`;
}

function buildVisualQualityReport(reports) {
  const valid = reports.filter(r => !r.error);
  const hero = valid.find(r => r.role === 'hero');
  const gallery = valid.filter(r => r.role === 'gallery');
  const items = [];
  if (hero?.brightnessZones) {
    const names = ['Левая зона','Центр','Правая зона'];
    const zones = hero.brightnessZones.map((value,index) => ({ name:names[index], value })).filter(z => z.value !== null);
    const dark = zones.filter(z => z.value < 55);
    const bright = zones.filter(z => z.value > 205);
    if (dark.length) items.push({level:'check',title:'Тёмные зоны на Hero',text:dark.map(z => z.name.toLowerCase()).join(', ') + ' заметно темнее. Светлый текст может читаться лучше, но проверьте реальный контраст.'});
    if (bright.length) items.push({level:'check',title:'Светлые зоны на Hero',text:bright.map(z => z.name.toLowerCase()).join(', ') + ' очень светлые. Для белого текста может понадобиться затемняющий overlay.'});
    if (!dark.length && !bright.length) items.push({level:'manual',title:'Проверить контраст текста на Hero',text:'Средняя яркость зон без крайних значений. Проверьте фактический цвет текста, градиент и читаемость на реальном макете.'});
    if (hero.luminanceRange !== null && hero.luminanceRange < 55) items.push({level:'check',title:'Низкий тональный диапазон Hero',text:'Кадр выглядит довольно равномерным. Убедитесь, что текст не теряется на похожем по яркости фоне.'});
  } else if (hero) items.push({level:'manual',title:'Контраст Hero не измерен',text:'Для этого источника пиксельный анализ недоступен. Проверьте контраст заголовка вручную.'});
  const tonal = gallery.filter(r => Number.isFinite(r.brightness));
  if (tonal.length >= 2) {
    const values = tonal.map(r => r.brightness);
    const spread = Math.max(...values) - Math.min(...values);
    if (spread > 75) items.push({level:'check',title:'Разный тональный характер галереи',text:'Разброс средней яркости кадров около ' + Math.round(spread) + ' пунктов. Проверьте единообразие экспозиции и цветокоррекции.'});
    else items.push({level:'good',title:'Тональная серия выглядит согласованно',text:'Разброс средней яркости невелик. Дополнительно проверьте баланс белого и насыщенность глазами.'});
  } else if (gallery.length) items.push({level:'manual',title:'Согласованность галереи',text:'Недостаточно доступных измерений для сравнения тональности. Сверьте баланс белого и цветокоррекцию вручную.'});
  if (!items.length) items.push({level:'manual',title:'Визуальная проверка',text:'Добавьте изображения с доступным локальным анализом или проверьте освещение и читаемость вручную.'});
  return items;
}

function scoreAssetForRole(report, role) {
  if (!report || report.error) return { score: 0, reasons: ['Изображение не удалось проверить'] };
  const reasons = [];
  const ratio = Number(report.ratio) || 0;
  const minSide = Math.min(Number(report.width) || 0, Number(report.height) || 0);
  let score = 35;
  if (role === 'hero') {
    const ratioScore = ratio >= 1.45 && ratio <= 2.05 ? 25 : ratio >= 1.25 && ratio <= 2.3 ? 15 : 0;
    score += ratioScore; reasons.push(ratioScore ? 'Подходит широкий формат' : 'Для Hero лучше отдельный широкий кадр');
    const sizeScore = report.width >= 1600 && report.height >= 900 ? 25 : report.width >= 1200 && report.height >= 650 ? 15 : 0;
    score += sizeScore; reasons.push(sizeScore ? 'Достаточное разрешение для большого экрана' : 'Нужно изображение большего разрешения');
  } else if (role === 'gallery') {
    const ratioScore = ratio >= 0.65 && ratio <= 2.0 ? 25 : 8;
    score += ratioScore; reasons.push(ratioScore > 10 ? 'Формат пригоден для галерейной сетки' : 'Проверьте необычную пропорцию');
    const sizeScore = minSide >= 1000 ? 25 : minSide >= 700 ? 15 : 0;
    score += sizeScore; reasons.push(sizeScore ? 'Хороший запас разрешения' : 'Для крупного просмотра желательно больше пикселей');
  } else {
    const ratioScore = ratio >= 0.82 && ratio <= 1.25 ? 25 : ratio >= 0.65 && ratio <= 1.5 ? 15 : 0;
    score += ratioScore; reasons.push(ratioScore ? 'Близко к квадратному формату карточки' : 'Подготовьте квадратный вариант 1:1');
    const sizeScore = minSide >= 900 ? 25 : minSide >= 600 ? 15 : 0;
    score += sizeScore; reasons.push(sizeScore ? 'Достаточное разрешение для карточки' : 'Нужно большее разрешение');
  }
  if (report.brightness !== null && report.brightness !== undefined) {
    const lightScore = report.brightness >= 55 && report.brightness <= 220 ? 10 : 0;
    score += lightScore; reasons.push(lightScore ? 'Средняя яркость в рабочем диапазоне' : 'Проверьте экспозицию и читаемость деталей');
  }
  if (report.detail !== null && report.detail !== undefined) {
    const detailScore = report.detail >= 7 ? 5 : 0;
    score += detailScore; reasons.push(detailScore ? 'Есть локальная детализация' : 'Проверьте резкость вручную');
  }
  return { score: Math.min(100, score), reasons };
}
function buildSmartImageMatches(reports) {
  return ['hero','gallery','service'].map(role => {
    const candidates = reports.map(report => ({ report, ...scoreAssetForRole(report, role) }))
      .filter(item => !item.report.error).sort((a,b) => b.score - a.score);
    return { role, best: candidates[0] || null, current: reports.filter(r => r.role === role).length };
  });
}
function buildAssetRecommendations(reports, nearDuplicateCount = 0) {
  const recommendations = [];
  const hero = reports.find(r => r.role === 'hero');
  const gallery = reports.filter(r => r.role === 'gallery' && !r.error);
  const serviceImages = reports.filter(r => r.role === 'service' && !r.error);
  const serviceCount = Array.isArray(state.raw.services) ? state.raw.services.length : 0;
  if (!hero) recommendations.push({ level: 'important', title: 'Главный кадр не добавлен', text: 'Добавьте горизонтальную фотографию 16:9 от 1600 × 900 px. Оставьте свободную область под заголовок и кнопку.' });
  else {
    if (hero.width < 1600 || hero.height < 900) recommendations.push({ level: 'check', title: 'Усилить главный кадр', text: 'Для большого экрана подготовьте исходник от 1600 × 900 px, чтобы сохранить детализацию.' });
    if (hero.ratio < 1.35 || hero.ratio > 2.2) recommendations.push({ level: 'check', title: 'Проверить пропорции Hero', text: 'Подготовьте отдельный горизонтальный вариант 16:9 и проверьте мобильную обрезку.' });
    recommendations.push({ level: 'manual', title: 'Проверить свободную зону под текст', text: 'Убедитесь, что заголовок и CTA не закрывают лицо, товар или важную деталь. Алгоритм не распознаёт сюжет и свободное пространство на фотографии.' });
  }
  if (gallery.length < 4) recommendations.push({ level: 'important', title: 'Расширить фотогалерею', text: 'Добавьте 4–6 разных кадров: общий план, средний план, деталь, процесс и атмосферный контекст.' });
  else {
    const formats = new Set(gallery.map(r => r.ratio < 0.82 ? 'portrait' : r.ratio > 1.25 ? 'landscape' : 'square'));
    if (formats.size === 1) recommendations.push({ level: 'check', title: 'Разнообразить композицию галереи', text: 'Добавьте вертикальный или квадратный ракурс, чередуйте общие планы и крупные детали.' });
    else recommendations.push({ level: 'good', title: 'Форматы галереи разнообразны', text: 'В наборе есть разные пропорции. Проверьте, что каждый кадр показывает новую сторону работы или продукта.' });
  }
  if (nearDuplicateCount) recommendations.push({ level: 'important', title: 'Заменить похожие кадры', text: 'Оставьте наиболее сильный кадр, а похожий замените другим ракурсом или сценой.' });
  if (serviceCount && serviceImages.length < serviceCount) recommendations.push({ level: 'check', title: 'Добавить фото к позициям', text: 'Не у каждой позиции есть фотография. Добавьте отдельное изображение для каждого товара или услуги, если это уместно.' });
  if (!serviceCount && !serviceImages.length) recommendations.push({ level: 'manual', title: 'Фото карточек не обязательны', text: 'Если сайт не показывает отдельные товары или услуги карточками, этот тип изображений можно не добавлять.' });
  return recommendations;
}
function buildPhotoShotList(niche, tier) {
  const subject = String(niche || 'предложение бизнеса').trim();
  const luxury = tier === 'luxury';
  const premium = luxury || tier === 'premium';
  const light = luxury ? 'Большой мягкий источник сбоку, контролируемые глубокие тени и чистые блики.' : premium ? 'Естественный направленный свет из окна или большой рассеиватель; мягкое заполнение теней.' : 'Мягкий естественный свет без жёсткой вспышки и цветных рефлексов.';
  const background = luxury ? 'Минимальная сценография, натуральные материалы, чистый фон и осознанное пустое пространство.' : premium ? 'Спокойный фактурный фон, ограниченный реквизит, палитра согласована с сайтом.' : 'Реальная аккуратная среда без визуального шума.';
  return [
    {title:'Hero — ключевой образ',scene:'Один главный сюжет, раскрывающий ' + subject + '; объект или результат читается с первого взгляда.',plan:'Общий / средне-общий',angle:'На уровне объекта, лёгкий диагональный ракурс',light,background,composition:'Оставить 35–45% спокойной зоны с одной стороны под заголовок и CTA; важные детали не помещать под текст.',format:'Горизонталь 16:9',resolution:'От 2400 × 1350 px, желательно RAW'},
    {title:'Контекст и пространство',scene:'Показать реальное место, окружение или контекст использования.',plan:'Общий план',angle:'Прямой или из угла помещения, вертикали без завала',light,background,composition:'Сохранить глубину переднего, среднего и заднего плана.',format:'Горизонталь 3:2',resolution:'От 2400 px по длинной стороне'},
    {title:'Процесс / работа',scene:'Зафиксировать реальный этап работы; не инсценировать несуществующие действия.',plan:'Средний план',angle:'¾ сбоку, на уровне действия',light,background,composition:'Главное действие в фокусе, руки и инструмент не обрезать случайно.',format:'Вертикаль 4:5 и горизонталь 3:2',resolution:'От 2000 px по длинной стороне'},
    {title:'Макродеталь / фактура',scene:'Показать материал, текстуру, отделку или важную деталь реального объекта.',plan:'Крупный / макро',angle:'Боковой скользящий угол для проявления фактуры',light:'Мягкий боковой свет, подчёркивающий рельеф без искусственного блеска.',background:'Нейтральная поверхность, минимум отвлекающих элементов.',composition:'Одна деталь занимает кадр; оставить запас по краям.',format:'Квадрат 1:1',resolution:'От 2000 × 2000 px'},
    {title:'Результат / готовый объект',scene:'Показать реальный итог работы или объект целиком без неподтверждённых характеристик.',plan:'Средний и общий — два кадра',angle:'Фронтальный плюс ¾',light,background,composition:'Объект целиком, ровная перспектива, понятный масштаб.',format:'Квадрат 1:1 и вертикаль 4:5',resolution:'От 2000 px по длинной стороне'},
    {title:'Человек / автор / команда (если уместно)',scene:'Естественный портрет специалиста или команды только при наличии согласия.',plan:'Поясной и крупный портрет',angle:'На уровне глаз, лёгкий поворот корпуса',light:'Мягкий боковой свет, естественный оттенок кожи.',background:'Реальная рабочая среда с мягким размытием.',composition:'Оставить пространство вокруг головы; не обрезать суставы по краю.',format:'Вертикаль 4:5',resolution:'От 2000 × 2500 px'},
    {title:'Атмосферный кадр',scene:'Передать настроение бренда через реальную среду, свет и связанные с предложением детали.',plan:'Общий или деталь',angle:'Свободный авторский ракурс',light,background,composition:'Слоистая композиция, один визуальный акцент.',format:'Горизонталь 16:9 и вертикаль 4:5',resolution:'От 2400 px по длинной стороне'},
    {title:'Мобильный вертикальный кадр',scene:'Отдельная композиция для мобильного экрана: ' + subject + ' крупно и ясно.',plan:'Средний план',angle:'Вертикальная съёмка с запасом сверху и снизу',light,background,composition:'Центральная безопасная зона; не полагаться только на обрезку горизонтального Hero.',format:'Вертикаль 4:5 или 3:4',resolution:'От 1600 × 2000 px'}
  ];
}
function formatPhotoShotList(shots) {
  return ['PHOTO ART DIRECTION — ПЛАН ФОТОСЪЁМКИ'].concat(shots.map((s,i) => (i+1)+'. '+s.title+'\nСюжет: '+s.scene+'\nПлан: '+s.plan+'\nРакурс: '+s.angle+'\nСвет: '+s.light+'\nФон: '+s.background+'\nКомпозиция: '+s.composition+'\nФормат: '+s.format+'\nРазрешение: '+s.resolution)).join('\n\n');
}
function renderVisualAssetDirector(reports, duplicateCount, nearDuplicateCount, missingRoles, nearDuplicatePairs = []) {
  const p = normalizeProject(state.raw);
  const dna = result.concept?.designDNA || {};
  const direction = dna.imageDirection || result.analysis?.imageDirection || 'естественный свет, выразительная композиция и честные детали';
  const style = [p.tier === 'luxury' ? 'авторская журнальная съёмка, сдержанная палитра, выразительный свет и много воздуха' : p.tier === 'premium' ? 'коммерческая editorial-съёмка, естественный направленный свет, точная работа с фактурами' : 'чистый естественный свет, достоверные цвета и аккуратная композиция', dna.colorDirection].filter(Boolean).join('; ');
  const sourcePrompts = result.analysis?.imagePrompts || [];
  const roleLabels = { hero: 'Первый экран', gallery: 'Галерея и детали', service: 'Товары и услуги' };
  const tierDirection = p.tier === 'luxury'
    ? 'Люкс-арт-дирекшн: кадр как для печатного интерьерного или fashion-журнала; контролируемые тени, натуральные материалы, точная цветопередача, минимум предметов, визуальная тишина. Не использовать дешёвый стоковый вид, чрезмерную ретушь, искусственный блеск и постановочные улыбки.'
    : p.tier === 'premium'
      ? 'Премиум-арт-дирекшн: правдоподобная профессиональная съёмка, выразительная глубина, натуральные фактуры, аккуратный фон и согласованная цветовая температура. Избегать клипарта, шаблонных стоковых сцен и чрезмерной обработки.'
      : 'Съёмка должна выглядеть достоверно и соответствовать реальному предложению бизнеса.';
  const subject = `Ниша: «${p.niche || 'уточнить нишу'}». Бренд: «${p.brand || 'не указан'}». Визуальное направление: ${direction}. Палитра и характер: ${style}.`;
  const fallback = {
    hero: `Создать главный коммерческий фотокадр для сайта. ${subject} Покажите узнаваемый ключевой объект бизнеса или результат услуги в реальной среде, один ясный визуальный сюжет и сильную точку внимания. Композиция: горизонтальный широкий кадр 16:9; оставьте спокойную свободную область под заголовок и CTA, не перекрывайте главный объект текстом интерфейса. Камера на естественной перспективе, выразительный направленный свет, реалистичные материалы. ${tierDirection} Без текста, логотипов, водяных знаков и вымышленных наград.`,
    gallery: `Серия из 4–6 РАЗНЫХ фотографий для портфолио и галереи сайта. ${subject} Снимите разные сюжеты, а не дубли одного кадра: общий план пространства или результата; средний план ключевой работы; макродеталь материала или фактуры; рабочий процесс и руки специалиста; атмосферный контекст; при наличии реальных согласованных материалов — команда или автор. Чередуйте широкий, вертикальный и квадратный кадр, меняйте дистанцию и точку съёмки. ${tierDirection} Все кадры должны выглядеть частью одной фотосессии, но каждый раскрывать новую сторону предложения. Без текста и водяных знаков.`,
    service: `Достоверная фотография конкретного товара или результата услуги для отдельной карточки. ${subject} Покажите один объект полностью, затем его конструктивную или тактильную деталь; не заменяйте реальный товар абстрактной иллюстрацией и не добавляйте несуществующие функции, аксессуары или маркировку. Квадратный кадр 1:1, объект читается в маленьком размере, фон поддерживает палитру и не отвлекает. ${tierDirection} Без текста, водяных знаков и декоративных надписей.`
  };
  const roleDirections = {
    hero: 'Фокус: один сильный сюжет и свободное пространство для текста первого экрана.',
    gallery: 'Фокус: визуальное разнообразие ракурсов, планов и фактур; каждый кадр должен добавлять новую информацию.',
    service: 'Фокус: точное соответствие реальному товару или услуге, понятный силуэт и читаемая деталь.'
  };
  const buildRolePrompt = (role, source, fallbackPrompt) => [source || fallbackPrompt, roleDirections[role], tierDirection].filter(Boolean).join('\n\n');
  const prompts = {
    hero: buildRolePrompt('hero', sourcePrompts[0], fallback.hero),
    gallery: buildRolePrompt('gallery', sourcePrompts[4], fallback.gallery),
    service: buildRolePrompt('service', sourcePrompts[1], fallback.service)
  };
  const recommendations = buildAssetRecommendations(reports, nearDuplicateCount);
  const visualQuality = buildVisualQualityReport(reports);
  const visualQualityCards = visualQuality.map(item => `<article class="visual-quality-card is-${esc(item.level)}"><b>${esc(item.title)}</b><p>${esc(item.text)}</p></article>`).join('');
  const smartMatches = buildSmartImageMatches(reports);
  const smartMatchCards = smartMatches.map(match => {
    const label = roleLabels[match.role];
    if (!match.best) return `<article class="smart-match"><b>${esc(label)}</b><p>Нет изображений, которые удалось проверить.</p></article>`;
    const item = match.best;
    const scoreLabel = item.score >= 80 ? 'Хорошее техническое соответствие' : item.score >= 60 ? 'Можно использовать после проверки' : 'Лучше подготовить другой кадр';
    return `<article class="smart-match"><div class="smart-match__head"><b>${esc(label)}</b><strong>${item.score}/100</strong></div><p><b>Кандидат:</b> ${esc(item.report.label)} <span class="note">(${item.report.width} × ${item.report.height} px)</span></p><p>${scoreLabel}</p><ul>${item.reasons.map(reason => `<li>${esc(reason)}</li>`).join('')}</ul></article>`;
  }).join('');
  const shotList = buildPhotoShotList(p.niche, p.tier);
  const shotCards = shotList.map((shot,index) => '<article class="photo-shot"><div class="photo-shot__head"><b>'+(index+1)+'. '+esc(shot.title)+'</b><span>'+esc(shot.format)+'</span></div><p><b>Сюжет:</b> '+esc(shot.scene)+'</p><p><b>План и ракурс:</b> '+esc(shot.plan)+'; '+esc(shot.angle)+'.</p><p><b>Свет:</b> '+esc(shot.light)+'</p><p><b>Фон:</b> '+esc(shot.background)+'</p><p><b>Композиция:</b> '+esc(shot.composition)+'</p><p><b>Файл:</b> '+esc(shot.resolution)+'</p></article>').join('');
  const shotListText = formatPhotoShotList(shotList);
  const coverage = ['hero','gallery','service'].map(role => {
    const count = reports.filter(r => r.role === role).length;
    return `<span class="asset-coverage ${count ? 'is-present' : 'is-missing'}">${esc(roleLabels[role])}: ${count ? count + ' шт.' : 'нет'}</span>`;
  }).join('');
  const notes = [];
  if (duplicateCount) notes.push(`Обнаружено ${duplicateCount} точных повторов одного и того же источника. Проверьте, не используется ли один кадр вместо разных ракурсов.`);
  if (nearDuplicateCount) notes.push(`Локальное сравнение обнаружило ${nearDuplicateCount} пар визуально похожих кадров. Это могут быть повторные ракурсы или близкие по композиции изображения — проверьте их вручную.`);
  if (missingRoles.length) notes.push(`Не заполнены роли: ${missingRoles.map(r => roleLabels[r]).join(', ')}. Это не ошибка для каждого типа сайта, но проверьте, нужны ли эти материалы.`);
  const similarityDetails = nearDuplicatePairs.slice(0, 8).map(([a, b, distance]) => `<li>${esc(a.label)} ↔ ${esc(b.label)} (различие hash: ${distance}/64)</li>`).join('');
  const promptCards = Object.entries(prompts).map(([role,prompt]) => `<article class="asset-prompt"><div><b>${esc(roleLabels[role])}</b><p>${esc(prompt)}</p></div><button type="button" data-copy-asset-prompt="${esc(prompt)}">Копировать промпт</button></article>`).join('');
  return `<section class="visual-asset-director" aria-labelledby="visual-asset-title">
    <h3 id="visual-asset-title">Visual Asset Director</h3>
    <p class="note">Сверка состава и визуального задания проекта. Ниша: <b>${esc(p.niche || 'не указана')}</b>; бренд: <b>${esc(p.brand || 'не указан')}</b>. Направление: ${esc(direction)}. Стиль: ${esc(style || 'автоматический')}.</p>
    <div class="asset-coverage-list">${coverage}</div>
    <h4>Smart Image Matching — подбор по техническим параметрам</h4>\n    <p class="note">Система ранжирует уже добавленные фотографии по пропорциям, разрешению, средней яркости и локальной детализации. Балл не означает, что сюжет фотографии подходит нише: содержание и композицию проверяйте глазами.</p>\n    <div class="smart-match-list">${smartMatchCards}</div>\n    <h4>Visual Quality Control — визуальный контроль</h4>
    <p class="note">Локально оцениваются средняя яркость трёх вертикальных зон Hero и разброс яркости фотографий галереи. Это предварительная подсказка, а не измерение WCAG-контраста: итоговую читаемость проверяйте на реальном макете.</p>
    <div class="visual-quality-list">${visualQualityCards}</div>
    <h4>Рекомендации по фотоконтенту</h4>
    <div class="asset-recommendations">${recommendations.map(item => `<article class="asset-recommendation is-${esc(item.level)}"><b>${esc(item.title)}</b><p>${esc(item.text)}</p></article>`).join('')}</div>
    ${similarityDetails ? `<h4>Похожие кадры — проверьте разнообразие</h4><ul class="asset-director-notes">${similarityDetails}</ul>` : ''}
    ${notes.length ? `<ul class="asset-director-notes">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="image-audit-ok">Повторов источника не обнаружено; все основные роли представлены.</p>'}
    <h4>Photo Art Direction — план фотосессии</h4>\n    <p class="note">Shot list для фотографа: сюжеты, планы, ракурсы, свет, фон, композиция, ориентация и разрешение. Список учитывает нишу и уровень проекта, не выдумывая свойства товара или услуги.</p>\n    <div class="photo-shot-actions"><button type="button" data-copy-photo-shotlist="${esc(shotListText)}">Скопировать весь план фотосъёмки</button></div>\n    <div class="photo-shot-list">${shotCards}</div>\n    <h4>AI Image Director — уточнение арт-дирекшна</h4><p class="note">Дополните промты конкретным сюжетом, настроением и обязательными деталями. Уточнения сохраняются в проекте и учитываются при копировании полного пакета заданий.</p><div class="image-director-brief"><label>Сюжет и объект съёмки<textarea rows="2" maxlength="1200" data-image-brief="subject" placeholder="Какой объект или результат нужно показать?">${esc(state.raw.imageArtDirection?.brief?.subject || '')}</textarea></label><label>Настроение и художественный приём<input type="text" maxlength="500" data-image-brief="mood" value="${esc(state.raw.imageArtDirection?.brief?.mood || '')}" placeholder="Например: тёплый минимализм, мягкий утренний свет"></label><label>Что обязательно показать<textarea rows="2" maxlength="800" data-image-brief="mustShow" placeholder="Реальные детали, материал, ракурс, окружение">${esc(state.raw.imageArtDirection?.brief?.mustShow || '')}</textarea></label><label>Чего избегать<textarea rows="2" maxlength="800" data-image-brief="avoid" placeholder="Лишний декор, вымышленные детали, надписи…">${esc(state.raw.imageArtDirection?.brief?.avoid || '')}</textarea></label><div class="image-director-actions"><button type="button" data-image-director="copy">Скопировать полный пакет промтов</button><button type="button" data-image-director="download">Скачать пакет (.txt)</button></div></div>
     <h4>Задания на замену или новую съёмку</h4>
    <p class="note">Промпты учитывают нишу и дизайн-направление проекта. Перед публикацией проверьте, что изображение действительно показывает ваш товар, услугу, помещение или команду.</p>
    <div class="asset-prompt-list">${promptCards}</div>
    <p class="note">Проверка не видит семантическое содержание фотографии и не может подтвердить соответствие сюжета нише. Локальное сравнение похожести работает для встроенных в проект изображений; внешние URL не анализируются по пикселям из-за ограничений безопасности браузера. Технические признаки и повторы — ориентир, визуальную релевантность подтверждает человек.</p>
  </section>`;
}

function parseRgb(color) {
  const match = String(color || '').match(/rgba?\\(([^)]+)\\)/i);
  if (!match) return null;
  const values = match[1].split(',').map(v => Number.parseFloat(v.trim()));
  if (values.length < 3 || values.slice(0,3).some(v => !Number.isFinite(v)) || (values.length > 3 && values[3] < .999)) return null;
  return values.slice(0,3).map(v => Math.max(0,Math.min(255,v)));
}
function relativeLuminance(rgb) {
  const channels = rgb.map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}
function contrastRatio(a,b) {
  if (!a || !b) return null;
  const values = [relativeLuminance(a),relativeLuminance(b)].sort((x,y) => y-x);
  return (values[0] + .05) / (values[1] + .05);
}
function auditHeroReadability() {
  const frame = $('#frame');
  const doc = frame?.contentDocument;
  if (!doc?.body) return [{level:'manual',title:'Предпросмотр недоступен',text:'Сначала дождитесь загрузки страницы в окне предпросмотра.'}];
  const originalWidth = frame.style.width;
  const originalHeight = frame.style.height;
  const originalMaxWidth = frame.style.maxWidth;
  const checks = [];
  const viewports = [{width:320,label:'Телефон 320 px'},{width:768,label:'Планшет 768 px'},{width:1280,label:'Компьютер 1280 px'}];
  const rectsOverlap = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  // Проверяем именно фотографию Hero, а не все изображения страницы.
  // SVG-мотив без фотографии допустим для части архитектур и не считается ошибкой.
  const heroImages = [...doc.querySelectorAll('.hero img')];
  if (!heroImages.length) {
    checks.push({level:'manual',title:'Hero без фотографии',text:'В первом экране не найдено img. Это допустимо для графической концепции; если нужна фотография, добавьте её в поле «Изображение первого экрана».'});
  }
  heroImages.forEach((img,index) => {
    const label = 'Hero-фото' + (heroImages.length > 1 ? ' ' + (index + 1) : '');
    if (!img.complete) checks.push({level:'manual',title:label + ': загрузка не завершена',text:'Браузер ещё загружает изображение. Повторите QA после завершения загрузки.'});
    else if (img.naturalWidth === 0) checks.push({level:'check',title:label + ': изображение не загрузилось',text:'Браузер не получил изображение. Проверьте URL, доступность файла и формат.'});
    else {
      checks.push({level:'good',title:label + ': изображение загружено',text:'Исходный размер: ' + img.naturalWidth + ' × ' + img.naturalHeight + ' px.'});
      // Проверка фактического размера выполняется отдельно для каждого viewport ниже.
    }
    if (!img.hasAttribute('alt')) checks.push({level:'check',title:label + ': отсутствует ALT',text:'Добавьте текстовое описание фотографии. Для смыслового изображения пустой alt нежелателен.'});
    else if (!img.getAttribute('alt').trim()) checks.push({level:'check',title:label + ': пустой ALT',text:'Hero-фотография помечена как декоративная. Если она передаёт содержание, добавьте краткое описание.'});
    if (img.getAttribute('loading') === 'lazy') checks.push({level:'check',title:label + ': отложенная загрузка',text:'Главное изображение находится на первом экране. Уберите loading="lazy", чтобы не задерживать его появление.'});
    if (img.getAttribute('fetchpriority') !== 'high') checks.push({level:'manual',title:label + ': приоритет загрузки не повышен',text:'Проверьте, стоит ли задать fetchpriority="high" для главной фотографии. Это рекомендация, а не измерение скорости.'});
  });
  try {
    for (const viewport of viewports) {
      frame.style.width = viewport.width + 'px';
      frame.style.maxWidth = '100%';
      heroImages.forEach((img,index) => {
        if (!img.complete || img.naturalWidth === 0) return;
        const rect = img.getBoundingClientRect();
        const dpr = Math.max(1, Number(doc.defaultView.devicePixelRatio) || 1);
        if (rect.width > 0 && rect.height > 0 && (img.naturalWidth + 1 < rect.width * dpr || img.naturalHeight + 1 < rect.height * dpr)) {
          const label = 'Hero-фото' + (heroImages.length > 1 ? ' ' + (index + 1) : '');
          checks.push({level:'check',title:viewport.label + ': ' + label + ' — возможно недостаточно разрешения',text:'Исходник ' + img.naturalWidth + ' × ' + img.naturalHeight + ' px отображается примерно в ' + Math.round(rect.width) + ' × ' + Math.round(rect.height) + ' CSS px при DPR ' + dpr + '. Проверьте резкость на этом размере экрана.'});
        }
      });
      const heading = doc.querySelector('.hero h1');
      const lede = doc.querySelector('.hero .lede');
      const button = doc.querySelector('.hero .actions .ds-button, .hero .ds-button');
      if (!heading) {
        checks.push({level:'manual',title:viewport.label,text:'Заголовок первого экрана не найден — проверьте структуру Hero.'});
        continue;
      }
      const headingStyle = doc.defaultView.getComputedStyle(heading);
      const buttonStyle = button ? doc.defaultView.getComputedStyle(button) : null;
      const headingRect = heading.getBoundingClientRect();
      const ledeRect = lede?.getBoundingClientRect();
      const buttonRect = button?.getBoundingClientRect();
      if (heading.scrollWidth > heading.clientWidth + 1) checks.push({level:'check',title:viewport.label + ': заголовок может обрезаться',text:'Ширина текста превышает доступную ширину блока. Уменьшите размер, измените перенос или расширьте контейнер.'});
      if (lede && buttonRect && ledeRect && rectsOverlap(ledeRect,buttonRect)) checks.push({level:'check',title:viewport.label + ': текст пересекается с CTA',text:'Описание и кнопка занимают пересекающиеся области. Проверьте отступы и вертикальное расположение.'});
      if (button && (buttonRect.width < 44 || buttonRect.height < 44)) checks.push({level:'check',title:viewport.label + ': малая область нажатия',text:'Основная кнопка меньше ориентира 44 × 44 px. Увеличьте высоту или внутренние отступы.'});
      const buttonBg = parseRgb(buttonStyle?.backgroundColor);
      const buttonFg = parseRgb(buttonStyle?.color);
      const buttonContrast = contrastRatio(buttonFg,buttonBg);
      if (button && buttonContrast !== null) checks.push({level:buttonContrast >= 4.5 ? 'good' : 'check',title:viewport.label + ': контраст кнопки ' + buttonContrast.toFixed(2) + ':1',text:buttonContrast >= 4.5 ? 'Цвет текста и сплошной фон кнопки проходят ориентир WCAG AA для обычного текста.' : 'Контраст текста кнопки ниже 4.5:1. Усильте различие цветов.'});
      else if (button) checks.push({level:'manual',title:viewport.label + ': фон кнопки сложный или прозрачный',text:'Автоматически измерить пару цветов нельзя. Проверьте контраст кнопки на реальном фоне.'});
      const headingBg = parseRgb(headingStyle.backgroundColor);
      const headingFg = parseRgb(headingStyle.color);
      const headingContrast = contrastRatio(headingFg,headingBg);
      if (headingContrast !== null && headingStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') checks.push({level:headingContrast >= 4.5 ? 'good' : 'check',title:viewport.label + ': контраст заголовка ' + headingContrast.toFixed(2) + ':1',text:headingContrast >= 4.5 ? 'Контраст текста относительно собственного сплошного фона проходит ориентир WCAG AA.' : 'Контраст заголовка ниже 4.5:1 относительно его фона.'});
      else checks.push({level:'manual',title:viewport.label + ': проверить заголовок на фотографии',text:'У заголовка прозрачный фон или под ним изображение/градиент. Проверка по одному цвету невозможна — оцените читаемость на самом кадре.'});
      if (headingRect.width <= 0 || headingRect.height <= 0) checks.push({level:'check',title:viewport.label + ': заголовок не виден',text:'Проверьте скрытие, позиционирование и размеры первого экрана.'});
    }
  } catch (error) {
    checks.push({level:'manual',title:'Не удалось завершить проверку',text:'Предпросмотр изменил состояние во время анализа. Запустите проверку ещё раз.'});
  } finally {
    frame.style.width = originalWidth;
    frame.style.height = originalHeight;
    frame.style.maxWidth = originalMaxWidth;
  }
  return checks;
}
function renderHeroReadabilityChecks() {
  const host = $('#hero-readability-results');
  if (!host) return;
  const checks = auditHeroReadability();
  host.innerHTML = checks.map(item => '<article class="visual-quality-card is-' + esc(item.level) + '"><b>' + esc(item.title) + '</b><p>' + esc(item.text) + '</p></article>').join('');
}


function auditResponsiveLayoutAndAccessibility() {
  const frame = $('#frame');
  const doc = frame?.contentDocument;
  if (!doc?.body) return [{level:'manual',title:'Предпросмотр недоступен',text:'Сначала дождитесь загрузки страницы в окне предпросмотра.'}];
  const originalWidth = frame.style.width;
  const originalHeight = frame.style.height;
  const originalMaxWidth = frame.style.maxWidth;
  const results = [];
  const sizes = [{width:320,label:'Телефон 320 px'},{width:375,label:'Телефон 375 px'},{width:768,label:'Планшет 768 px'}];
  const visible = el => {
    const style = doc.defaultView.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  };
  const hasName = el => Boolean((el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || '').trim() || (el.labels && [...el.labels].some(label => label.innerText.trim())));
  const intersects = (a,b) => a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
  try {
    for (const size of sizes) {
      frame.style.width = size.width + 'px';
      frame.style.maxWidth = '100%';
      const root = doc.documentElement;
      const body = doc.body;
      const viewportWidth = doc.defaultView.innerWidth || size.width;
      const pageWidth = Math.max(root.scrollWidth,body.scrollWidth);
      if (pageWidth > viewportWidth + 2) results.push({level:'check',title:size.label + ': горизонтальная прокрутка',text:'Контент шире окна на ' + (pageWidth - viewportWidth) + ' px. Проверьте фиксированные ширины, длинные строки и сетки.'});
      else results.push({level:'good',title:size.label + ': ширина страницы',text:'Горизонтальное переполнение на уровне документа не обнаружено.'});
      const controls = [...doc.querySelectorAll('a[href],button,input,select,textarea,[role="button"],[tabindex]')].filter(visible);
      const unnamed = controls.filter(el => !hasName(el));
      if (unnamed.length) results.push({level:'check',title:size.label + ': элементы без доступного имени',text:'Найдено ' + unnamed.length + ' ссылок или элементов управления без видимого текста, подписи, aria-label или title.'});
      const smallTargets = controls.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width < 44 || r.height < 44;
      });
      if (smallTargets.length) results.push({level:'check',title:size.label + ': маленькие интерактивные области',text:smallTargets.length + ' элементов меньше ориентира 44 × 44 px. Увеличьте область нажатия или расстояние между соседними элементами.'});
      const offscreen = controls.filter(el => {
        const r = el.getBoundingClientRect();
        return r.right < 0 || r.left > viewportWidth || r.bottom < 0;
      });
      if (offscreen.length) results.push({level:'check',title:size.label + ': элементы за пределами экрана',text:offscreen.length + ' интерактивных элементов находятся за видимой областью. Проверьте меню, CTA и горизонтальные списки.'});
      const focusMissing = controls.filter(el => {
        const style = doc.defaultView.getComputedStyle(el);
        return style.outlineStyle === 'none' && style.boxShadow === 'none';
      });
      if (focusMissing.length) results.push({level:'manual',title:size.label + ': проверить клавиатурный фокус',text:focusMissing.length + ' элементов не имеют очевидного outline или box-shadow в обычном состоянии. Проверьте :focus-visible клавиатурой.'});
      const overlapping = [];
      const candidates = controls.filter(el => el.tagName !== 'INPUT' || !['hidden','checkbox','radio'].includes(el.type));
      for (let i=0;i<candidates.length;i++) for (let j=i+1;j<candidates.length;j++) {
        const a=candidates[i],b=candidates[j];
        if (a.contains(b) || b.contains(a)) continue;
        if (intersects(a.getBoundingClientRect(),b.getBoundingClientRect())) overlapping.push([a,b]);
      }
      if (overlapping.length) results.push({level:'check',title:size.label + ': пересечение интерактивных элементов',text:'Обнаружено ' + overlapping.length + ' пар пересекающихся ссылок и элементов управления. Проверьте, не мешают ли они друг другу нажиматься.'});
      const unlabeledFields = [...doc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]),select,textarea')].filter(visible).filter(el => !hasName(el));
      if (unlabeledFields.length) results.push({level:'check',title:size.label + ': поля без подписи',text:'Найдено ' + unlabeledFields.length + ' видимых полей без label, aria-label или title.'});
    }
  } catch {
    results.push({level:'manual',title:'Проверка прервана',text:'Предпросмотр обновился во время диагностики. Запустите проверку ещё раз.'});
  } finally {
    frame.style.width = originalWidth;
    frame.style.height = originalHeight;
    frame.style.maxWidth = originalMaxWidth;
  }
  if (!results.length) results.push({level:'manual',title:'Нет результатов',text:'Не удалось собрать диагностические данные.'});
  return results;
}
function renderResponsiveAccessibilityChecks() {
  const host = $('#responsive-a11y-results');
  if (!host) return;
  const checks = auditResponsiveLayoutAndAccessibility();
  host.innerHTML = checks.map(item => '<article class="visual-quality-card is-' + esc(item.level) + '"><b>' + esc(item.title) + '</b><p>' + esc(item.text) + '</p></article>').join('');
}


function auditSiteContentAndInteractions() {
  const doc = $('#frame')?.contentDocument;
  if (!doc?.body) return [{level:'manual',title:'Предпросмотр недоступен',text:'Сначала дождитесь загрузки готовой страницы в окне предпросмотра.'}];
  const results = [];
  const add = (level,title,text) => results.push({level,title,text});
  const visible = el => { const s=doc.defaultView.getComputedStyle(el),r=el.getBoundingClientRect(); return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0; };
  const nameOf = el => (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || '').trim();
  const ids = new Set([...doc.querySelectorAll('[id]')].map(el=>el.id));
  const images = [...doc.querySelectorAll('img')];
  const broken = images.filter(img=>img.complete&&img.naturalWidth===0);
  const pending = images.filter(img=>!img.complete);
  if(broken.length) add('check','Изображения не загрузились','Не удалось загрузить '+broken.length+' из '+images.length+' изображений. Проверьте URL, формат и доступ к файлам.');
  else if(images.length) add('good','Изображения загружены','Браузер подтвердил загрузку '+(images.length-pending.length)+' из '+images.length+' изображений.');
  else add('manual','Изображения отсутствуют','На странице нет элементов img. Проверьте, требуется ли фотографии место в этой концепции.');
  if(pending.length) add('manual','Изображения ещё загружаются',pending.length+' изображений не завершили загрузку. Повторите проверку позже.');
  const missingAlt=images.filter(img=>!img.hasAttribute('alt')), emptyAlt=images.filter(img=>img.hasAttribute('alt')&&!img.getAttribute('alt').trim());
  if(missingAlt.length) add('check','Нет атрибута ALT',missingAlt.length+' изображений не имеют alt. Добавьте описание смысловым изображениям; декоративным задайте alt="".');
  else add('good','ALT-атрибуты присутствуют','У всех '+images.length+' изображений есть alt. Пустой alt допустим для декоративной графики.');
  if(emptyAlt.length) add('manual','Проверить пустые ALT',emptyAlt.length+' изображений имеют alt="". Это правильно для декора, но проверьте, не скрывает ли описание важные фотографии.');
  const links=[...doc.querySelectorAll('a')], invalid=[], missingAnchors=[], external=[];
  for(const link of links){
    const href=(link.getAttribute('href')||'').trim();
    if(!href||href==='#'||href.toLowerCase().startsWith('javascript:')){invalid.push(href||'(пусто)');continue;}
    if(href.startsWith('#')) { try { if(!ids.has(decodeURIComponent(href.slice(1)))) missingAnchors.push(href); } catch { missingAnchors.push(href); } }
    if(href.startsWith('http://')||href.startsWith('https://')) { try { const u=new URL(href,doc.baseURI); if(['http:','https:'].includes(u.protocol)) external.push(href); else invalid.push(href); } catch { invalid.push(href); } }
  }
  if(invalid.length) add('check','Пустые или небезопасные ссылки',invalid.length+' ссылок имеют пустой href, href="#" или javascript:. Исправьте назначение.');
  else add('good','Формат ссылок проверен','Пустые ссылки и схема javascript: не обнаружены.');
  if(missingAnchors.length) add('check','Не найдены якорные разделы',missingAnchors.length+' ссылок ведут к отсутствующим id: '+[...new Set(missingAnchors)].slice(0,5).join(', '));
  else add('good','Внутренние якоря существуют','Все проверенные ссылки на #раздел ведут к существующим id.');
  if(external.length) add('manual','Внешние адреса требуют проверки','Формат '+external.length+' внешних URL корректен. Доступность серверов и конечных страниц не проверялась.');
  const ctas=[...doc.querySelectorAll('[data-cta],.ds-button,button')].filter(visible);
  const unnamed=ctas.filter(el=>!nameOf(el)), disabled=ctas.filter(el=>el.disabled||el.getAttribute('aria-disabled')==='true'), dead=ctas.filter(el=>el.tagName==='A'&&(!el.getAttribute('href')||el.getAttribute('href')==='#'));
  if(ctas.length) add('good','CTA найдены','В предпросмотре обнаружено '+ctas.length+' видимых элементов действия.');
  else add('manual','CTA не найдены','Не обнаружены видимые кнопки и элементы с data-cta. Проверьте целевой сценарий страницы.');
  if(unnamed.length) add('check','CTA без названия',unnamed.length+' кнопок не имеют доступного текстового имени.');
  if(disabled.length) add('check','Неактивные CTA',disabled.length+' кнопок отключены или имеют aria-disabled="true".');
  if(dead.length) add('check','CTA без рабочего назначения',dead.length+' ссылок-кнопок не имеют назначения или ведут на #.');
  const forms=[...doc.querySelectorAll('form')];
  if(!forms.length) add('manual','Формы не обнаружены','На странице нет form. Если заявки должны собираться через контакты или мессенджер, проверьте этот сценарий отдельно.');
  forms.forEach((form,index)=>{
    const controls=[...form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]),select,textarea,button[type="submit"]')];
    const unlabeled=controls.filter(el=>!el.disabled&&!el.getAttribute('aria-label')&&!el.getAttribute('title')&&!(el.labels&&[...el.labels].length));
    const action=(form.getAttribute('action')||'').trim(), method=(form.getAttribute('method')||'get').toLowerCase();
    if(!controls.length) add('check','Форма '+(index+1)+': нет полей','Форма не содержит пользовательских полей или кнопки отправки.');
    else add('good','Форма '+(index+1)+': поля обнаружены','Элементов формы: '+controls.length+'; обязательных: '+controls.filter(el=>el.required).length+'.');
    if(unlabeled.length) add('check','Форма '+(index+1)+': поля без подписи',unlabeled.length+' полей не связаны с label и не имеют aria-label/title.');
    if(!action) add('manual','Форма '+(index+1)+': адрес отправки не задан','Атрибут action пуст. Проверьте обработчик формы и фактическую доставку заявки.');
    else if(action.toLowerCase().startsWith('javascript:')) add('check','Форма '+(index+1)+': небезопасный action','У формы указан javascript: в action.');
    else add('manual','Форма '+(index+1)+': доставка не подтверждена','Указан action и метод '+method.toUpperCase()+', но реальная отправка и получение заявки не тестировались.');
    if(!['get','post','dialog'].includes(method)) add('check','Форма '+(index+1)+': неизвестный метод','Проверьте атрибут method формы.');
  });
  return results.length?results:[{level:'manual',title:'Нет результатов',text:'Не удалось собрать диагностические данные.'}];
}
function renderSiteContentInteractionChecks() {
  const host=$('#site-content-qa-results'); if(!host) return;
  host.innerHTML=auditSiteContentAndInteractions().map(item=>'<article class="visual-quality-card is-'+esc(item.level)+'"><b>'+esc(item.title)+'</b><p>'+esc(item.text)+'</p></article>').join('');
}

function renderAiDesignReview() {
  const root = $('#ai-design-review-results');
  if (!root) return;
  if (aiDesignReviewLoading) {
    root.innerHTML = '<p class="note">AI Design Director анализирует проект…</p>';
    return;
  }
  if (!aiDesignReview) {
    root.innerHTML = '<p class="note">AI-рекомендации появятся здесь. Они не применяются автоматически.</p>';
    return;
  }
  const items = aiDesignReview.recommendations || [];
  root.innerHTML = items.length ? items.map((item, index) => {
    const patch = item.patch && Object.keys(item.patch).length;
    return '<article class="visual-quality-card is-' + esc(item.priority) + '"><b>' + esc(item.title) + '</b><p>' + esc(item.reason) + '</p><p>' + esc(item.action) + '</p>' +
      (patch ? '<button type="button" data-apply-ai-review="' + index + '">Применить предложенный текст</button>' : '<span class="note">Рекомендация без готового изменения</span>') +
      '</article>';
  }).join('') : '<p class="note">AI не нашёл дополнительных рекомендаций.</p>';
}
function renderAudit() {
  const a = result.audit;
  const badge = $('#audit-badge');
  badge.textContent = a.ok ? '✓' : a.errors.length; badge.className = 'badge ' + (a.ok ? 'ok' : 'err');
  $('#view-audit').innerHTML = `<section class="ai-design-review"><h3>AI Design Director</h3><p class="note">Нейросеть оценивает предложение, структуру и тексты сайта. Каждое изменение можно отдельно проверить и применить вручную.</p><button type="button" data-run-ai-design-review>Запустить AI-аудит дизайна и контента</button><div id="ai-design-review-results" class="visual-quality-list" aria-live="polite"></div></section><section class="site-content-qa"><h3>Site Content & Interaction QA</h3><p class="note">Проверяет загрузку изображений, ALT-тексты, ссылки и якоря, видимые CTA, поля и настройки форм. Внешние сайты и фактическая доставка заявок сетевым запросом не проверяются.</p><button type="button" data-run-site-content-qa>Проверить контент, ссылки и действия</button><div id="site-content-qa-results" class="visual-quality-list" aria-live="polite"><p class="note">Нажмите кнопку для проверки текущей страницы.</p></div></section><section class="responsive-a11y"><h3>Responsive Layout & Accessibility QA</h3><p class="note">Проверяет горизонтальное переполнение, пересечения элементов управления, доступные имена, подписи полей, область нажатия и элементы за экраном на трёх мобильных и планшетных ширинах.</p><button type="button" data-run-responsive-a11y>Проверить адаптивность и доступность</button><div id="responsive-a11y-results" class="visual-quality-list" aria-live="polite"><p class="note">Нажмите кнопку для диагностики текущего предпросмотра.</p></div></section><section class="hero-readability"><h3>Hero Readability QA</h3><p class="note">Проверяет заголовок, описание, основную кнопку и контраст кнопки на трёх ширинах окна. Если под текстом фотография или градиент, контраст заголовка требует визуальной проверки.</p><button type="button" data-run-hero-readability>Проверить Hero на 3 размерах</button><div id="hero-readability-results" class="visual-quality-list" aria-live="polite"><p class="note">Нажмите кнопку, чтобы выполнить проверку готового предпросмотра.</p></div></section><p class="summary ${a.ok ? 'ok' : 'err'}">${a.ok ? `Проверка пройдена. Предупреждений: ${a.warnings.length}.` : `Проверка не пройдена. Ошибок: ${a.errors.length}, предупреждений: ${a.warnings.length}.`}</p>
<ul class="checks">${[...a.errors, ...a.warnings, ...a.checks.filter(c => c.level === 'ok')].map(c => `<li class="${c.level}"><span>${esc(c.message)}</span></li>`).join('')}</ul>
<h2 class="audit-section-title">Performance & Core Web Vitals</h2><p class="note">Статическая проверка веса HTML, встроенных изображений и атрибутов загрузки. Это технические индикаторы, а не измерение LCP, INP или CLS.</p>
<h2 class="audit-section-title">Image SEO & Accessibility</h2><p class="note">Проверка ALT-текстов, SEO-метаданных и доступности изображений.</p><h3 class="audit-section-title">Image Intelligence — проверка фотографий</h3><div id="image-intelligence" aria-live="polite"></div>
<p class="note" style="margin-top:16px">Статическая проверка не заменяет просмотр на реальных устройствах: используйте переключатель ширины 320 / 768 в предпросмотре.</p>`;
  renderImageIntelligence();
  renderAiDesignReview();
}

function renderRegistry() {
  const badge = $('#registry-badge');
  badge.textContent = state.library.length || ''; badge.className = 'badge n';
  const fp = result.concept.uniquenessCheck.fingerprint;
  $('#view-registry').innerHTML = state.library.length ? `
<p class="note">Проекты в порядке сохранения. Новая генерация сравнивается с двумя последними: нельзя одновременно повторять архитектуру, расположение визуала и характер типографики.</p>
<table><thead><tr><th>Проект</th><th>Архитектура</th><th>Сходство с текущим</th><th></th></tr></thead><tbody>${state.library.map((l, i) => {
    const s = l.entry.id === result.project.id ? null : similarity(fp, l.entry.fingerprint);
    return `<tr><td><b>${esc(l.entry.brand)}</b></td><td>${esc(ARCHETYPES[l.entry.fingerprint.archetype]?.name || '')}</td><td>${s === null ? '<span class="note">это текущий проект</span>' : `<span class="meter"><i style="width:${s * 100}%"></i></span>${Math.round(s * 100)}%`}</td><td><button type="button" data-load="${i}">Открыть</button> <button type="button" data-del="${i}" aria-label="Удалить ${esc(l.entry.brand)} из реестра">Удалить</button></td></tr>`;
  }).join('')}</tbody></table>` : '<p class="note">Реестр пуст. Кнопка «В реестр» сохраняет проект и его визуальный «отпечаток» в этом браузере — следующие проекты будут проверяться на шаблонность относительно него.</p>';
}

// ---------- События ----------
function toast(msg) {
  // Пока последнее сохранение не удалось, любое сообщение об успехе дополняется предупреждением.
  if (persistFailed && msg !== PERSIST_ERROR) msg = `${msg}. ${PERSIST_ERROR}`;
  const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
function load(raw, message) {
  const hasAttachedAnalysis = raw && Object.prototype.hasOwnProperty.call(raw, '__udsAnalysis');
  const attachedAnalysis = hasAttachedAnalysis ? raw.__udsAnalysis : undefined;
  const cleanRaw = raw && typeof raw === 'object' ? { ...raw } : raw;
  if (cleanRaw && typeof cleanRaw === 'object') delete cleanRaw.__udsAnalysis;
  state.raw = exportProject(normalizeProject(cleanRaw));
  if (hasAttachedAnalysis) state.analysis = attachedAnalysis && attachedAnalysis.data ? { projectId: state.raw.id, data: attachedAnalysis.data } : null;
  else if (state.analysis?.data) {
    // При открытии записи реестра raw.id может отличаться от нормализованного ID проекта.
    // Анализ уже выбранной записи привязываем к каноническому ID после нормализации.
    const sourceId = String(cleanRaw?.id || '');
    const selected = state.library.find(item => item?.raw && String(item.raw.id || '') === sourceId && item.analysis);
    if (selected) state.analysis = { projectId: state.raw.id, data: selected.analysis };
    else if (state.analysis.projectId === sourceId) {
      // Сохраняем анализ при нормализации экспортированного проекта:
      // исходный ID может отличаться от канонического ID после normalizeProject().
      state.analysis = { projectId: state.raw.id, data: state.analysis.data };
    } else if (state.analysis.projectId !== state.raw.id) state.analysis = null;
  }
  buildForm(); run();
  if (message) toast(message);
}
function download(name, text, type) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#form').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.crop) {
    const role = t.dataset.crop, index = Number(t.dataset.cropIndex), viewport = t.dataset.cropViewport, axis = t.dataset.cropAxis;
    writeCrop(role, index, viewport, axis, t.value);
    const output = t.parentElement.querySelector('output');
    if (output) output.value = t.value + '%';
    const editor = t.closest('.crop-editor');
    const preview = editor?.querySelector('[data-crop-preview-role="' + role + '"][data-crop-preview-index="' + index + '"][data-crop-preview-viewport="' + viewport + '"]');
    if (preview) {
      const current = preview.style.objectPosition.split(/\\s+/);
      const x = axis === 'x' ? t.value : (current[0] || '50%').replace('%','');
      const y = axis === 'y' ? t.value : (current[1] || '50%').replace('%','');
      preview.style.objectPosition = x + '% ' + y + '%';
    }
  }
  else if (t.dataset.path) set(t.dataset.path, t.value);
  else if (t.dataset.list) set(t.dataset.list, textToRows(t.value, t.dataset.list));
  else if (t.dataset.special === 'arch') {
    const [mode, id] = t.value.split(':');
    delete state.raw.designArchitecture;
    state.raw.architectureMode = mode; state.raw.architecture = mode === 'exact' ? id : 'auto';
    if (mode === 'family') state.raw.designArchitecture = id;
  } else if (t.dataset.special === 'palette') { state.raw.palette = { light: 'Светлая', dark: 'Тёмная', auto: '' }[t.value]; state.raw.paletteLocked = t.value !== 'auto'; }
  else if (t.dataset.special === 'fonts') state.raw.fonts = t.value;
  else if (t.dataset.special === 'graphicDirection') { if (t.value) state.raw.graphicDirection = t.value; else delete state.raw.graphicDirection; }
  else if (t.dataset.special === 'textEffect' || t.dataset.special === 'fontPair') { const key = t.dataset.special; if (t.value) state.raw[key] = t.value; else delete state.raw[key]; if (key === 'fontPair' && t.value) state.raw.fonts = 'web'; }
  else if (t.dataset.special === 'imageMask' || t.dataset.special === 'sectionDivider') { const key = t.dataset.special; if (t.value) state.raw[key] = t.value; else delete state.raw[key]; }
  else if (t.dataset.special === 'mechanic') { if (t.value) state.raw.itemsMechanic = t.value; else delete state.raw.itemsMechanic; }
  else if (t.dataset.special === 'tier') state.raw.tier = t.value;
  else if (t.dataset.special === 'promptMode') state.raw.customPromptMode = t.value;
  else if (t.dataset.special === 'brand') {
    if (t.value) state.raw.brandProfile = t.value; else delete state.raw.brandProfile;
    // С брендом шрифты по умолчанию веб: обновляем переключатель, чтобы он показывал фактическое значение.
    const fontsSel = document.querySelector('[data-special="fonts"]');
    if (fontsSel && !state.raw.fonts) fontsSel.value = normalizeProject(state.raw).fonts;
  }
  else if (t.dataset.special === 'accent') { state.raw.accent = t.value; state.raw.accentLocked = true; }
  else if (t.dataset.special === 'accent-auto') {
    const color = t.closest('.row').querySelector('[type=color]');
    color.disabled = t.checked; state.raw.accentLocked = !t.checked; state.raw.accent = t.checked ? '' : color.value;
  }
  schedule();
});
function imageDataSize() {
  const values = [state.raw.images?.hero, state.raw.images?.heroMobile, ...Object.values(state.raw.imageArtDirection?.mobileSources?.gallery || {}), ...Object.values(state.raw.imageArtDirection?.mobileSources?.services || {}), ...(state.raw.gallery || []).map(g => g.src), ...(state.raw.services || []).map(s => Array.isArray(s) ? s[3] : s.image)];
  return values.filter(v => typeof v === 'string' && v.startsWith('data:image/')).reduce((n, v) => n + v.length, 0);
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать обработанное изображение.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}
function canvasBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}
async function optimizeImage(file) {
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Формат не поддерживается. Выберите JPG, PNG, WebP, GIF или AVIF.');
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('Исходный файл больше 8 МБ. Выберите изображение меньшего размера.');
  const preserveOriginal = file.type === 'image/gif' || file.type === 'image/avif';
  if (preserveOriginal) {
    if (file.size > MAX_IMAGE_BYTES) throw new Error('GIF и AVIF сохраняются без преобразования, чтобы не потерять анимацию или особенности формата. Для этого файла нужен размер до 1 МБ.');
    return { data: await blobToDataUrl(file), originalBytes: file.size, finalBytes: file.size, optimized: false };
  }
  if (typeof createImageBitmap !== 'function') {
    if (file.size <= MAX_IMAGE_BYTES) return { data: await blobToDataUrl(file), originalBytes: file.size, finalBytes: file.size, optimized: false };
    throw new Error('Этот браузер не поддерживает оптимизацию изображений. Попробуйте современный Chrome, Edge или Firefox.');
  }
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { 
    if (file.size <= MAX_IMAGE_BYTES) return { data: await blobToDataUrl(file), originalBytes: file.size, finalBytes: file.size, optimized: false };
    throw new Error('Не удалось открыть изображение для оптимизации. Проверьте файл или сохраните его как JPG/PNG.');
  }
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const initialWidth = Math.max(1, Math.round(bitmap.width * scale));
    const initialHeight = Math.max(1, Math.round(bitmap.height * scale));
    const edges = [...new Set([Math.max(initialWidth, initialHeight), 1400, 1100, 900, 720, 540, 360, 240].filter(n => n <= Math.max(initialWidth, initialHeight) && n > 0))];
    for (const edge of edges) {
      const factor = Math.min(1, edge / Math.max(initialWidth, initialHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(initialWidth * factor));
      canvas.height = Math.max(1, Math.round(initialHeight * factor));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Не удалось создать холст для оптимизации фотографии.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        const blob = await canvasBlob(canvas, 'image/webp', quality);
        if (!blob || blob.type !== 'image/webp') break;
        if (blob.size <= MAX_IMAGE_BYTES) {
          const data = await blobToDataUrl(blob);
          return { data, originalBytes: file.size, finalBytes: blob.size, optimized: true, width: canvas.width, height: canvas.height };
        }
      }
    }
    throw new Error('После оптимизации фото всё ещё больше 1 МБ. Выберите другой снимок или уменьшите исходное разрешение.');
  } finally { bitmap.close?.(); }
}
async function optimizeGeneratedImage(dataUri) {
  const response = await fetch(dataUri);
  if (!response.ok) throw new Error('Не удалось прочитать изображение от AI.');
  const blob = await response.blob();
  const file = new File([blob], 'ai-generated.jpg', { type: blob.type || 'image/jpeg' });
  return optimizeImage(file);
}
// ALT для созданного фото: что видит посетитель, а не служебный текст задания для фотографа.
function generatedAlt(slot, project) {
  const place = [project.brand, project.niche].filter(Boolean).join(' — ') || 'Наш проект';
  if (slot.role === 'service') return slot.label + ' — ' + (project.niche || project.brand || 'позиция каталога');
  if (slot.role === 'gallery') return place + ': ' + slot.label.toLowerCase();
  return place;
}
async function generateProjectImages(endpoint, expectedProjectId, onProgress = () => {}) {
  const parsedEndpoint = new URL(endpoint, location.href);
  if (!/\/api\/generate-landing\/?$/i.test(parsedEndpoint.pathname)) throw new Error('В адресе AI-сервера должен быть путь /api/generate-landing.');
  parsedEndpoint.pathname = parsedEndpoint.pathname.replace(/\/api\/generate-landing\/?$/i, '/api/generate-image');
  const imageEndpoint = parsedEndpoint.toString();
  const slots = imageSlots(result.project, result.concept).slots;
  const hero = slots.find(slot => slot.id === 'hero');
  const products = slots.filter(slot => slot.role === 'service').slice(0, 2);
  const gallery = slots.filter(slot => slot.role === 'gallery').slice(0, products.length ? 1 : 3);
  const targets = [...(hero ? [hero] : []), ...products, ...gallery].slice(0, 4);
  if (!targets.length) return { generated: 0, skipped: true };
  let generated = 0;
  for (let index = 0; index < targets.length; index++) {
    const slot = targets[index];
    onProgress(index, targets.length, slot.label);
    const alt = generatedAlt(slot, result.project);
    // Генератор (FLUX) понимает только английский: сюжет, обстановка и блюда переводятся по профилю ниши.
    const prompt = photoPrompt(slot, result.project, result.concept.visualSystem.graphicDirection); // photoPrompt preserves managed instructions within the Worker 2,000-character limit.
    const imageStarted = Date.now();
    let response, payload;
    try {
      response = await fetch(imageEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      payload = await response.json().catch(() => ({}));
    } catch (error) { logAi({ kind: 'image', label: 'Фото: ' + slot.label, status: 'error', error: 'сеть: ' + error.message, ms: Date.now() - imageStarted }); throw error; }
    logAi({ kind: 'image', label: 'Фото: ' + slot.label, status: response.ok && payload.image ? 'ok' : 'error', error: payload.error || (response.ok ? '' : 'HTTP ' + response.status), ms: Date.now() - imageStarted, model: payload.model || '' });
    if (!response.ok || !payload.image) throw new Error(payload.error || 'AI не вернул изображение (HTTP ' + response.status + ').');
    const optimized = await optimizeGeneratedImage('data:' + (payload.mimeType || 'image/jpeg') + ';base64,' + payload.image);
    if (state.raw.id !== expectedProjectId) throw new Error('Проект изменён во время генерации. Фото не добавлены в другой проект.');
    const data = optimized.data;
    if (imageDataSize() + data.length > MAX_IMAGE_DATA) throw new Error('Достигнут лимит хранилища изображений проекта (3,8 МБ). Остальные фото не добавлены.');
    if (slot.id === 'hero') {
      state.raw.images = { ...(state.raw.images || {}), hero: data, heroAlt: alt };
    } else if (slot.role === 'service') {
      const services = Array.isArray(state.raw.services) ? [...state.raw.services] : [];
      const sourceIndex = Number.isInteger(slot.sourceIndex) ? slot.sourceIndex : Number(slot.id.split('-')[1]);
      const current = services[sourceIndex];
      if (Array.isArray(current)) {
        const row = [...current]; row[3] = data; row[4] = alt; services[sourceIndex] = row;
      } else if (current && typeof current === 'object') {
        services[sourceIndex] = { ...current, image: data, alt };
      }
      state.raw.services = services;
    } else if (slot.role === 'gallery') {
      const items = Array.isArray(state.raw.gallery) ? [...state.raw.gallery] : [];
      const galleryIndex = Number(slot.id.split('-')[1]);
      items[galleryIndex] = { ...(items[galleryIndex] || {}), src: data, alt, caption: slot.label };
      state.raw.gallery = items;
    }
    generated++;
    $('#auto-status').textContent = 'AI создал изображений: ' + generated + ' из ' + targets.length + '…';
  }
  buildForm();
  run();
  return { generated, skipped: false };
}
async function handleImageUpload(input) {
  const kind = input.dataset.upload, files = [...(input.files || [])];
  input.value = '';
  if (!files.length) return;
  const imageIndex = Number(input.dataset.imageIndex);
  const services = Array.isArray(state.raw.services) ? state.raw.services : [];
  if (kind === 'service' && !services.length) return toast('Сначала добавьте позиции в разделе «Каталог / услуги / меню».');
  if (['gallery-mobile', 'service-mobile'].includes(kind) && (!Number.isInteger(imageIndex) || imageIndex < 0)) return toast('Не удалось определить фотографию для мобильной версии.');
  const target = kind === 'service' ? Number($('#f--serviceUpload-target')?.value) : -1;
  if (kind === 'service' && (!Number.isInteger(target) || target < 0 || target >= services.length)) return toast('Выберите позицию товара или услуги.');
  if (kind === 'service-mobile' && imageIndex >= services.length) return toast('Позиция товара или услуги больше не существует.');
  if (kind === 'gallery-mobile' && imageIndex >= (state.raw.gallery || []).length) return toast('Фотография галереи больше не существует.');
  let added = 0;
  for (const file of files) {
    try {
      const optimized = await optimizeImage(file);
      const data = optimized.data;
      const mobileSources = state.raw.imageArtDirection?.mobileSources || {};
      const current = kind === 'hero' ? state.raw.images?.hero
        : kind === 'hero-mobile' ? state.raw.images?.heroMobile
        : kind === 'gallery-mobile' ? mobileSources.gallery?.[imageIndex]
        : kind === 'service-mobile' ? mobileSources.services?.[imageIndex]
        : kind === 'service' ? (Array.isArray(services[target]) ? services[target][3] : services[target].image)
        : '';
      const replacingSize = typeof current === 'string' && current.startsWith('data:image/') ? current.length : 0;
      if (imageDataSize() - replacingSize + data.length > MAX_IMAGE_DATA) throw new Error('Общий объём загруженных фото превышает лимит 3,8 МБ. Удалите лишние снимки или уменьшите их размер.');
      const imageName = file.name.replace(/\.[^.]+$/, '');
      if (kind === 'hero') {
        state.raw.images = { ...(state.raw.images || {}), hero: data, heroAlt: state.raw.images?.heroAlt || '' };
      } else if (kind === 'hero-mobile') {
        state.raw.images = { ...(state.raw.images || {}), heroMobile: data };
      } else if (kind === 'gallery') {
        state.raw.gallery = [...(state.raw.gallery || []), { src: data, caption: imageName, alt: '' }];
      } else if (kind === 'gallery-mobile' || kind === 'service-mobile') {
        const root = state.raw.imageArtDirection || (state.raw.imageArtDirection = {});
        root.mobileSources = root.mobileSources || {};
        const key = kind === 'gallery-mobile' ? 'gallery' : 'services';
        root.mobileSources[key] = root.mobileSources[key] || {};
        root.mobileSources[key][imageIndex] = data;
      } else if (kind === 'service') {
        const row = services[target];
        const cells = Array.isArray(row) ? [...row] : [row.title || '', row.text || row.description || '', row.price || '', row.image || '', row.alt || ''];
        cells[3] = data;
        cells[4] = cells[4] || cells[0];
        state.raw.services[target] = cells;
      }
      added++;
      if (optimized.optimized) toast('Фото оптимизировано: ' + (optimized.width + '×' + optimized.height) + ', ' + Math.round(optimized.finalBytes / 1024) + ' КБ вместо ' + Math.round(optimized.originalBytes / 1024) + ' КБ');
    } catch (err) { toast(err.message); }
  }
  if (added) { buildForm(); run(); toast(added === 1 ? 'Фотография добавлена в проект' : 'Добавлено фотографий: ' + added); }
}
$('#form').addEventListener('change', e => {
  const input = e.target;
  let altChanged = false;
  if (input.matches('[data-hero-alt]')) { state.raw.images = { ...(state.raw.images || {}), heroAlt: input.value }; altChanged = true; }
  if (input.matches('[data-gallery-alt]')) { const g = state.raw.gallery[Number(input.dataset.galleryAlt)]; if (g) { g.alt = input.value; altChanged = true; } }
  if (input.matches('[data-service-alt]')) { const row = state.raw.services[Number(input.dataset.serviceAlt)]; if (row) { if (Array.isArray(row)) row[4] = input.value; else row.alt = input.value; altChanged = true; } }
  if (altChanged) run();
  const upload = input.closest('[data-upload]'); if (upload) handleImageUpload(upload);
});
function swapIndexedEntries(bucket, from, to) {
  if (!bucket || typeof bucket !== 'object') return;
  if (Array.isArray(bucket)) {
    [bucket[from], bucket[to]] = [bucket[to], bucket[from]];
    return;
  }
  const a = Object.prototype.hasOwnProperty.call(bucket, from) ? bucket[from] : undefined;
  const b = Object.prototype.hasOwnProperty.call(bucket, to) ? bucket[to] : undefined;
  if (b === undefined) delete bucket[from]; else bucket[from] = b;
  if (a === undefined) delete bucket[to]; else bucket[to] = a;
}
function reorderIndexedEntries(bucket, from, to) {
  if (!bucket || typeof bucket !== 'object' || from === to) return;
  if (Array.isArray(bucket)) {
    const value = bucket.splice(from, 1)[0];
    bucket.splice(to, 0, value);
    return;
  }
  const numeric = Object.entries(bucket).filter(([key]) => Number.isInteger(Number(key)) && String(Number(key)) === key);
  const values = new Map(numeric.map(([key, value]) => [Number(key), value]));
  const next = new Map();
  for (const [key, value] of Object.entries(bucket)) if (!(Number.isInteger(Number(key)) && String(Number(key)) === key)) next.set(key, value);
  for (const [index, value] of values) {
    let target = index;
    if (index === from) target = to;
    else if (from < to && index > from && index <= to) target = index - 1;
    else if (from > to && index >= to && index < from) target = index + 1;
    next.set(String(target), value);
  }
  for (const key of Object.keys(bucket)) delete bucket[key];
  for (const [key, value] of next) bucket[key] = value;
}
function reorderGalleryImage(from, to) {
  const gallery = state.raw.gallery;
  if (!Array.isArray(gallery) || from === to || from < 0 || to < 0 || from >= gallery.length || to >= gallery.length) return;
  gallery.splice(to, 0, gallery.splice(from, 1)[0]);
  const art = state.raw.imageArtDirection || {};
  reorderIndexedEntries(art.gallery, from, to);
  reorderIndexedEntries(art.mobileSources?.gallery, from, to);
  buildForm(); run(); toast('Порядок фотографий обновлён');
}
function moveGalleryImage(from, direction) {
  const gallery = state.raw.gallery;
  const to = from + direction;
  if (!Array.isArray(gallery) || from < 0 || to < 0 || from >= gallery.length || to >= gallery.length) return;
  [gallery[from], gallery[to]] = [gallery[to], gallery[from]];
  const art = state.raw.imageArtDirection || {};
  swapIndexedEntries(art.gallery, from, to);
  const mobile = art.mobileSources?.gallery;
  swapIndexedEntries(mobile, from, to);
  buildForm(); run(); toast('Порядок фотографий обновлён');
}
let draggedGalleryIndex = null;
$('#form').addEventListener('dragstart', e => {
  const item = e.target.closest('[data-gallery-item]');
  if (!item) return;
  draggedGalleryIndex = Number(item.dataset.galleryItem);
  item.classList.add('is-dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(draggedGalleryIndex));
  }
});
$('#form').addEventListener('dragover', e => {
  const item = e.target.closest('[data-gallery-item]');
  if (!item || draggedGalleryIndex === null) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  $('#form').querySelectorAll('[data-gallery-item].is-drop-target').forEach(node => node.classList.remove('is-drop-target'));
  if (Number(item.dataset.galleryItem) !== draggedGalleryIndex) item.classList.add('is-drop-target');
});
$('#form').addEventListener('drop', e => {
  const item = e.target.closest('[data-gallery-item]');
  if (!item || draggedGalleryIndex === null) return;
  e.preventDefault();
  const target = Number(item.dataset.galleryItem);
  const from = draggedGalleryIndex;
  draggedGalleryIndex = null;
  reorderGalleryImage(from, target);
});
$('#form').addEventListener('dragend', () => {
  draggedGalleryIndex = null;
  $('#form').querySelectorAll('[data-gallery-item].is-dragging,[data-gallery-item].is-drop-target').forEach(node => node.classList.remove('is-dragging','is-drop-target'));
});
let galleryLightboxIndex = 0;
let galleryLightbox = null;
function closeGalleryLightbox() {
  if (!galleryLightbox) return;
  galleryLightbox.remove();
  galleryLightbox = null;
  document.removeEventListener('keydown', handleGalleryLightboxKey);
}
function renderGalleryLightbox() {
  const gallery = state.raw.gallery || [];
  if (!gallery.length || !galleryLightbox) return closeGalleryLightbox();
  galleryLightboxIndex = (galleryLightboxIndex + gallery.length) % gallery.length;
  const item = gallery[galleryLightboxIndex];
  galleryLightbox.innerHTML = `<div class="gallery-lightbox__panel" role="document">
    <button type="button" class="gallery-lightbox__close" aria-label="Закрыть просмотр">×</button>
    <button type="button" class="gallery-lightbox__prev" aria-label="Предыдущее фото">‹</button>
    <figure><img src="${esc(item.src)}" alt="${esc(item.alt || item.caption || 'Фотография галереи')}"><figcaption>${esc(item.caption || item.alt || '')} <span>${galleryLightboxIndex + 1} / ${gallery.length}</span></figcaption></figure>
    <button type="button" class="gallery-lightbox__next" aria-label="Следующее фото">›</button>
  </div>`;
  galleryLightbox.querySelector('.gallery-lightbox__close').focus();
}
function openGalleryLightbox(index) {
  galleryLightboxIndex = index;
  if (!galleryLightbox) {
    galleryLightbox = document.createElement('div');
    galleryLightbox.className = 'gallery-lightbox';
    galleryLightbox.setAttribute('role', 'dialog');
    galleryLightbox.setAttribute('aria-modal', 'true');
    galleryLightbox.setAttribute('aria-label', 'Просмотр фотографий');
    document.body.append(galleryLightbox);
    galleryLightbox.addEventListener('click', event => {
      if (event.target === galleryLightbox || event.target.closest('.gallery-lightbox__close')) return closeGalleryLightbox();
      if (event.target.closest('.gallery-lightbox__prev')) { galleryLightboxIndex--; renderGalleryLightbox(); }
      if (event.target.closest('.gallery-lightbox__next')) { galleryLightboxIndex++; renderGalleryLightbox(); }
    });
    document.addEventListener('keydown', handleGalleryLightboxKey);
  }
  renderGalleryLightbox();
}
function handleGalleryLightboxKey(event) {
  if (!galleryLightbox) return;
  if (event.key === 'Escape') { event.preventDefault(); closeGalleryLightbox(); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); galleryLightboxIndex--; renderGalleryLightbox(); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); galleryLightboxIndex++; renderGalleryLightbox(); }
}
$('#form').addEventListener('click', e => {
  const preview = e.target.closest('[data-preview-gallery]');
  if (preview) { openGalleryLightbox(Number(preview.dataset.previewGallery)); return; }
  const primary = e.target.closest('[data-gallery-primary]');
  if (primary) { reorderGalleryImage(Number(primary.dataset.galleryPrimary), 0); toast('Главное фото назначено'); return; }
  const move = e.target.closest('[data-move-gallery]');
  if (move) {
    moveGalleryImage(Number(move.dataset.moveGallery), Number(move.dataset.direction));
    return;
  }
  const b = e.target.closest('[data-remove-image]'); if (!b) return;
  const [kind, index] = b.dataset.removeImage.split(':');
  if (kind === 'hero') state.raw.images = { ...(state.raw.images || {}), hero: '', heroMobile: '', heroAlt: '' };
  else if (kind === 'hero-mobile') state.raw.images = { ...(state.raw.images || {}), heroMobile: '' };
  else if (kind === 'gallery-mobile' || kind === 'service-mobile') { const idx = Number(index); const key = kind === 'gallery-mobile' ? 'gallery' : 'services'; if (state.raw.imageArtDirection?.mobileSources?.[key]) delete state.raw.imageArtDirection.mobileSources[key][idx]; }
  if (kind === 'gallery') {
    const idx = Number(index);
    state.raw.gallery.splice(idx, 1);
    const mobileGallery = state.raw.imageArtDirection?.mobileSources?.gallery;
    if (Array.isArray(mobileGallery)) mobileGallery.splice(idx, 1);
    else if (mobileGallery && typeof mobileGallery === 'object') {
      const entries = Object.entries(mobileGallery).filter(([key]) => /^\\d+$/.test(key));
      for (const [key] of entries) delete mobileGallery[key];
      for (const [key, value] of entries) if (Number(key) > idx) mobileGallery[Number(key) - 1] = value;
    }
  }
  if (kind === 'service') {
    const idx = Number(index);
    const row = state.raw.services[idx];
    if (Array.isArray(row)) { row[3] = ''; row[4] = ''; } else if (row) { row.image = ''; row.alt = ''; }
    const mobileServices = state.raw.imageArtDirection?.mobileSources?.services;
    if (Array.isArray(mobileServices)) delete mobileServices[idx];
    else if (mobileServices && typeof mobileServices === 'object') delete mobileServices[idx];
  }
  buildForm(); run(); toast('Фотография удалена из проекта');
});
$('#view-concept').addEventListener('click', e => {
  if (e.target.closest('[data-open-crop-role]')) {
    const button = e.target.closest('[data-open-crop-role]');
    const role = button.dataset.openCropRole, index = Number(button.dataset.openCropIndex);
    const group = openPhotoGroup();
    if (group) {
      const editor = [...group.querySelectorAll('.crop-editor')].find(item => item.querySelector(`[data-crop="${role}"][data-crop-index="${index}"]`));
      if (editor) { editor.open = true; editor.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      else group.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }
  if (e.target.closest('[data-open-image-settings]')) {
    const group = openPhotoGroup();
    if (group) group.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (e.target.closest('[data-open-image-audit]')) selectTab($('#tab-audit'));
});
function imageDirectorPackage() {
  const brief = state.raw.imageArtDirection?.brief || {};
  const cards = [...document.querySelectorAll('.visual-asset-director .asset-prompt')];
  const additions = [
    brief.subject && 'СЮЖЕТ: '+brief.subject,
    brief.mood && 'НАСТРОЕНИЕ: '+brief.mood,
    brief.mustShow && 'ОБЯЗАТЕЛЬНО ПОКАЗАТЬ: '+brief.mustShow,
    brief.avoid && 'ИЗБЕГАТЬ: '+brief.avoid,
    'Не добавлять неподтверждённые свойства, текст, логотипы и водяные знаки.'
  ].filter(Boolean).join('\n');
  return cards.map(card => card.innerText + '\n' + additions).join('\n\n' + '='.repeat(48) + '\n\n');
}
$('#view-audit').addEventListener('input', e => {
  const field = e.target.closest('[data-image-brief]');
  if (!field) return;
  const root = state.raw.imageArtDirection || (state.raw.imageArtDirection = {});
  root.brief = root.brief || {};
  root.brief[field.dataset.imageBrief] = field.value;
  if (result) result.exported = exportProject(state.raw, result.concept);
  persist();
});
$('#view-audit').addEventListener('click', async e => {
  const shotList = e.target.closest('[data-copy-photo-shotlist]');
  if (shotList) {
    const text = shotList.dataset.copyPhotoShotlist || '';
    try { await navigator.clipboard.writeText(text); toast('План фотосъёмки скопирован'); }
    catch { download('photo-shot-list.txt', text, 'text/plain'); toast('Буфер обмена недоступен — план фотосъёмки скачан в TXT'); }
    return;
  }
  const tasks = e.target.closest('[data-image-tasks]');
  if (tasks && result) {
    const text = imageTaskPackage(result.project, result.concept);
    const file = 'image-tasks-' + (result.project.id || 'project') + '.txt';
    if (tasks.dataset.imageTasks === 'download') download(file, text, 'text/plain');
    else { try { await navigator.clipboard.writeText(text); toast('Задания на изображения скопированы'); } catch { download(file, text, 'text/plain'); } }
    return;
  }
  const directorButton = e.target.closest('[data-image-director]');
  if (directorButton) {
    const text = imageDirectorPackage();
    if (directorButton.dataset.imageDirector === 'download') download('ai-image-director-'+(result.project.id || 'project')+'.txt', text, 'text/plain');
    else { try { await navigator.clipboard.writeText(text); toast('Пакет промтов AI Image Director скопирован'); } catch { download('ai-image-director-'+(result.project.id || 'project')+'.txt', text, 'text/plain'); } }
    return;
  }
});
$('#form').addEventListener('submit', e => e.preventDefault());
$('#view-audit').addEventListener('click', async e => {
  if (e.target.closest('[data-run-ai-design-review]')) {
    const endpoint = ($('#auto-endpoint')?.value || localStorage.getItem('uds:ai-endpoint') || '').trim();
    let target;
    try {
      target = new URL(endpoint, location.href);
      if (!/\/api\/generate-landing\/?$/i.test(target.pathname)) throw new Error('Укажите адрес Worker с путём /api/generate-landing');
    } catch (error) {
      toast(error.message || 'Сначала настройте адрес AI-сервера в автопилоте');
      return;
    }
    aiDesignReviewLoading = true;
    renderAiDesignReview();
    try {
      const response = await fetch(target.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          task: 'design-review',
          designPrompt: activePrompt(loadPromptRegistry(), 'design-director'),
          project: {
            niche: result.project.niche, brand: result.project.brand, title: result.project.title,
            description: result.project.description, cta: result.project.cta,
            targetAudience: result.project.targetAudience, mainOffer: result.project.mainOffer,
            services: (result.project.services || []).slice(0, 12),
            advantages: (result.project.advantages || []).slice(0, 12),
            faqs: (result.project.faqs || []).slice(0, 10),
          },
          analysis: currentAnalysis() || {},
          concept: { designBrief: result.concept.designBrief, designDNA: result.concept.designDNA },
          audit: { errors: result.audit.errors, warnings: result.audit.warnings },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'HTTP ' + response.status);
      if (!payload.review || !Array.isArray(payload.review.recommendations)) throw new Error('Сервер вернул некорректный отчёт');
      aiDesignReview = payload.review;
      toast('AI Design Director завершил проверку');
    } catch (error) {
      aiDesignReview = null;
      toast('AI-аудит не выполнен: ' + error.message);
    } finally {
      aiDesignReviewLoading = false;
      renderAiDesignReview();
    }
    return;
  }
  const applyReview = e.target.closest('[data-apply-ai-review]');
  if (applyReview && aiDesignReview?.recommendations) {
    const item = aiDesignReview.recommendations[Number(applyReview.dataset.applyAiReview)];
    if (!item?.patch) return;
    try {
      const preview = applyApprovedDesignPatch(state.raw, item.patch, Object.keys(item.patch));
      if (!preview.changed) throw new Error('В рекомендации нет поддерживаемых полей');
      load(preview.project, 'Одобренное изменение AI Design Director применено. Проверьте предпросмотр.');
      aiDesignReview = null;
      return;
    } catch (error) { toast('Не удалось применить изменение: ' + error.message); return; }
  }
  if (e.target.closest('[data-run-site-content-qa]')) { renderSiteContentInteractionChecks(); return; }
  if (e.target.closest('[data-run-responsive-a11y]')) { renderResponsiveAccessibilityChecks(); return; }
  if (e.target.closest('[data-run-hero-readability]')) { renderHeroReadabilityChecks(); return; }

  const button = e.target.closest('[data-copy-asset-prompt]');
  if (!button) return;
  try { await navigator.clipboard.writeText(button.dataset.copyAssetPrompt); toast('Промпт скопирован'); }
  catch { download('image-prompt.txt', button.dataset.copyAssetPrompt, 'text/plain'); toast('Буфер обмена недоступен — промпт скачан в TXT'); }
});

const tabs = [...document.querySelectorAll('[role=tab]')];
function selectTab(tab) {
  for (const t of tabs) { const on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; $('#' + t.getAttribute('aria-controls')).hidden = !on; }
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; selectTab(n); n.focus(); }
  });
});
$('#toggle-settings')?.addEventListener('click', () => {
  const collapsed = document.body.classList.toggle('workspace-settings-collapsed');
  $('#toggle-settings').setAttribute('aria-expanded', String(!collapsed));
  $('#toggle-settings').textContent = collapsed ? 'Показать настройки' : 'Скрыть настройки';
});
document.querySelectorAll('.sizes button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.sizes button').forEach(x => x.setAttribute('aria-pressed', x === b));
  const w = b.dataset.w; $('#frame').style.width = w ? w + 'px' : '100%'; $('#view-preview').classList.toggle('sized', Boolean(w));
  selectTab($('#tab-preview'));
}));

$('#change-preview')?.addEventListener('click', () => {
  updateChangePreviewButton();
  if ($('#change-preview').disabled) return toast('Сначала внесите изменение в проект — тогда появится сравнение.');
  const opened = window.open('preview.html', '_blank');
  if (!opened) toast('Браузер заблокировал новую вкладку. Разрешите всплывающие окна для студии.');
});
window.addEventListener('message', event => {
  if (event.origin !== window.location.origin || event.data?.type !== 'uds:apply-preview' || !event.data.raw) return;
  load(event.data.raw, 'Предложенная версия применена в редакторе. Проверьте её перед сохранением или публикацией.');
  window.focus();
});
$('#new').addEventListener('click', () => load({ ...EMPTY }, 'Новый проект'));
$('#import').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    let raw;
    try { raw = JSON.parse(await file.text()); } catch { throw new Error('файл повреждён или не является JSON'); }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('ожидался объект проекта');
    if (!looksLikeProject(raw)) throw new Error('в файле нет проекта студии: нет бренда, ниши, заголовка и позиций. Текущий проект не изменён');
    load(raw, `Импортирован проект: ${file.name}`);
  } catch (err) { toast(`Не удалось импортировать: ${err.message}`); }
});
$('#export').addEventListener('click', () => {
  const exported = { ...result.exported, __udsAnalysis: currentAnalysis() ? { data: currentAnalysis() } : null };
  download(`${result.project.id}.json`, JSON.stringify(exported, null, 2) + '\n', 'application/json');
});
$('#download').addEventListener('click', () => {
  download(`${result.project.id}.html`, result.html, 'text/html');
  if (!result.audit.ok) toast(`HTML скачан, но проверка не пройдена: ошибок — ${result.audit.errors.length}. См. вкладку «Проверка».`);
});
$('#prompt').addEventListener('click', async () => {
  const text = buildPrompt(result.project, result.concept);
  try { await navigator.clipboard.writeText(text); toast('Промт с концепцией скопирован в буфер обмена'); }
  catch { download(`${result.project.id}-prompt.txt`, text, 'text/plain'); }
});
$('#save').addEventListener('click', () => {
  if (!result.project.brand && !result.project.niche) return toast('Укажите бренд или нишу, чтобы сохранить проект');
  state.library = [...state.library.filter(l => l.entry.id !== result.entry.id), { raw: result.exported, entry: result.entry, analysis: currentAnalysis() }];
  run();
  if (persistFailed) return toast(PERSIST_ERROR);
  toast(`«${result.entry.brand}» сохранён в реестр`);
});
$('#view-registry').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.load) { const item = state.library[b.dataset.load]; state.analysis = item.analysis ? { projectId: item.raw.id, data: item.analysis } : null; load(item.raw, 'Проект открыт из реестра'); }
  if (b.dataset.del) { state.library.splice(Number(b.dataset.del), 1); run(); }
});

fetch('../examples/index.json').then(r => (r.ok ? r.json() : [])).then(async list => {
  const sel = $('#examples');
  for (const ex of list) sel.append(Object.assign(document.createElement('option'), { value: ex.file, textContent: `${ex.brand} — ${ex.niche}` }));
  exampleProjects = await Promise.all(list.map(async ex => {
    try {
      const response = await fetch('../examples/' + ex.file);
      if (!response.ok) throw new Error('Не удалось загрузить пример');
      return { ...ex, raw: await response.json() };
    } catch { return null; }
  }));
  exampleProjects = exampleProjects.filter(Boolean);
  renderDashboard();
  sel.addEventListener('change', async () => {
    if (!sel.value) return;
    const selected = list.find(ex => ex.file === sel.value);
    sel.value = '';
    if (!selected) return;
    try {
      const response = await fetch('../examples/' + selected.file);
      if (!response.ok) throw new Error('Не удалось загрузить пример');
      const raw = await response.json();
      load(raw, `Открыт пример: ${raw.brand || raw.niche}`);
      openWorkspace('create');
    } catch (error) { toast(error.message || 'Не удалось открыть пример'); }
  });
  if (!state.raw.brand && !state.raw.niche && list[0]) {
    const first = exampleProjects[0];
    if (first) load(first.raw);
  }
}).catch(() => { exampleProjects = []; renderDashboard(); });

buildForm();
run();
