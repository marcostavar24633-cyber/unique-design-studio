Warning: truncated output (original token count: 104860)
Total output lines: 4383

// Веб-студия: редактор проекта, живой предпросмотр, концепция, проверка и реестр проектов.
import { listProjectVersions, saveProjectVersion, getProjectVersion, deleteProjectVersion, compareProjectSnapshots } from './project-history.js';
import { scheduleEmergencyBackup, loadEmergencyBackup } from './project-storage.js';
import { STYLE_PRESETS } from '../src/style-presets.js';
import { ARCHETYPES, LEGACY_LABELS, LIBRARY_KEY, TIERS, MECHANICS, MASKS, TEXT_EFFECTS, WEB_FONT_PAIRS, GRAPHIC_DIRECTIONS, ART_DIRECTION_PRESETS, NAV_LABELS, autopilot, buildConcept, buildSpec, fromAiLanding, buildPrompt, exportProject, generate, normalizeLibrary, normalizeProject, referencesFor, similarity, qualityReport, qualityStageStatus, fixAndRecheck, QUALITY_CATEGORIES, SEVERITY_LABELS, imageSlots, GALLERY_FRAMES, slotBrief, imageTaskPackage, applyApprovedDesignPatch, photoPrompt, loadPromptRegistry, activePrompt, reviewGeneratedContent, listVisualIdentityOptions, CINEMATIC_PRESETS, describeCinematicLayers, TRANSITION_LIMITS, describeTransition, CARD_SHAPES, REVEALS, BUTTONS, CARD_EFFECTS, HERO_EFFECTS, describeEffects, TYPE_STYLES, SECTION_LAYOUTS, TEXT_ANIMATIONS, BUTTON_ANIMATIONS, canvasFanPlacements } from '../src/engine/index.js';

const STORE = 'uds:studio:v1';
const PREVIEW_STORE = 'uds:design-preview:v1';
let pendingDesignPreview = null;
let storedDesignPreviewChecked = false;
let storedDesignPreviewAvailable = false;
let storedDesignPreviewProjectId = '';
const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_IMAGE_DATA = 3_800_000;
// Сколько карточек услуг автопилот снабжает фото: вместе с главным фото и 8 кадрами галереи — до 15 кадров.
const MAX_SERVICE_PHOTOS = 6;
// Сколько кадров генерировать одновременно: FLUX.2 klein тратит 10–15 с на кадр, поэтому по одному 15 кадров шли бы ~3 минуты.
// 3 параллельных запроса укладываются в лимит Worker на фото (IMAGE_LIMIT), а при 429 очередь ждёт Retry-After.
const IMAGE_CONCURRENCY = 3;
const sourcePhotoCounts = raw => {
  const gallery = [...new Set((Array.isArray(raw?.gallery) ? raw.gallery : []).map(item => typeof item === 'string' ? item : item?.src).filter(Boolean))];
  const all = new Set([raw?.images?.hero || raw?.heroImage, ...gallery].filter(Boolean));
  return { all: all.size, gallery: gallery.length };
};
const $ = sel => document.querySelector(sel);
const AI_USAGE_RANGE_KEY = 'uds:ai-usage-range';
const DEFAULT_AI_ENDPOINT = 'https://unique-design-studio-ai.marcostavar24633.workers.dev/api/generate-landing';
const getDefaultAiEndpoint = () => location.hostname === 'marcostavar24633-cyber.github.io' ? DEFAULT_AI_ENDPOINT : '';
let aiUsageLoading = false;
function renderContentQaReview(report) {
  const panel = $('#content-qa-review');
  const summary = $('#content-qa-summary');
  const list = $('#content-qa-findings');
  if (!panel || !summary || !list) return;
  list.replaceChildren();
  if (!report || !Array.isArray(report.findings)) {
    panel.hidden = true;
    summary.textContent = '';
    return;
  }
  panel.hidden = false;
  const status = report.status === 'passed' ? 'Проверка пройдена' : report.status === 'needs-work' ? 'Нужно заполнить обязательные поля' : 'Нужна редакторская проверка';
  summary.textContent = status + '. ' + report.summary + ' Оценка: ' + report.score + '/100. Замечаний: ' + report.findings.length + '.';
  for (const finding of report.findings) {
    const item = document.createElement('li');
    const severity = { high: 'Обязательно', medium: 'Проверить', low: 'Рекомендация', review: 'Сверить факт' }[finding.severity] || '';
    item.textContent = [severity, finding.field].filter(Boolean).join(' · ') + (severity || finding.field ? ': ' : '') + finding.message;
    list.append(item);
  }
}
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
  const hasNeurons = data.neurons !== null && data.neurons !== undefined && data.neurons !== '' && Number.isFinite(Number(data.neurons));
  if (!hasNeurons) {
    node.title = 'Cloudflare не вернул показатель Neurons для выбранного периода.';
    $('#ai-usage-count').textContent = '—';
    const details = $('#ai-usage-details');
    if (details) details.textContent = 'Neurons: нет данных';
    setDashStatus('neurons', 'off', 'Neurons: нет данных');
    return;
  }
  $('#ai-usage-count').textContent = Number(data.neurons).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  const neurons = Number(data.neurons);
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
  let endpoint;
  try {
    endpoint = ($('#auto-endpoint')?.value || localStorage.getItem('uds:ai-endpoint') || getDefaultAiEndpoint()).trim();
  } catch {
    return renderAiUsageStats(null, 'хранилище настроек недоступно');
  }
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
    let range = $('#ai-usage-range')?.value || '24h';
    try { range = $('#ai-usage-range')?.value || localStorage.getItem(AI_USAGE_RANGE_KEY) || '24h'; } catch {}
    const response = await fetch(usageUrl + '?range=' + encodeURIComponent(range), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'HTTP ' + response.status);
    const hasNeurons = payload.neurons !== null && payload.neurons !== undefined && payload.neurons !== '';
    const hasRequests = payload.requests !== null && payload.requests !== undefined && payload.requests !== '';
    if (!hasNeurons) {
      renderAiUsageStats({ ...payload, range });
      return;
    }
    if (!hasRequests || !Number.isFinite(Number(payload.neurons)) || !Number.isFinite(Number(payload.requests))) {
      throw new Error('Cloudflare не вернул полную статистику Neurons и запросов');
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
let pendingCanvasFrameScroll = null;
let canvasFrameScroll = { x: 0, y: 0 };
function readCanvasFrameScroll() {
  try {
    const view = $('#frame')?.contentWindow;
    if (view) return { x: Math.max(0, Number(view.scrollX) || 0), y: Math.max(0, Number(view.scrollY) || 0) };
  } catch {}
  return { ...canvasFrameScroll };
}
let projectHistoryRenderVersion = 0;
let aiDesignReview = null;
let aiDesignReviewLoading = false;
let lastRenderedRaw = null;
let dashboardQuery = '';
let userStartedProject = false;
// Задание AI Content Director: собирается при отрисовке вкладки «ТЗ и анализ» по текущему проекту,
// а вызывается из обработчика кнопок этой вкладки.
let contentPrompt = () => '';

let localSavedAt = 0;
let localStorageWritable = true;
try {
  const probeKey = 'uds:storage-probe';
  localStorage.setItem(probeKey, '1');
  localStorage.removeItem(probeKey);
} catch { localStorageWritable = false; }
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved && saved.raw) {
    state = { raw: saved.raw, library: Array.isArray(saved.library) ? saved.library : [], analysis: saved.analysis || null };
    localSavedAt = localStorageWritable ? (Number(saved._udsSavedAt) || 0) : 0;
  }
} catch { /* хранилище недоступно — попробуем восстановить IndexedDB */ }
// Если localStorage переполнен, изменения сохраняются в отдельной резервной базе IndexedDB.
let persistFailed = false;
let persistBackupFailed = false;
let persistRevision = 0;
let lastPersistAt = 0;
let backupNoticeShown = false;
let persistIdleRequest = 0;
let persistTimeout = 0;
const PERSIST_PENDING = 'Основное хранилище заполнено. Выполняется резервное сохранение в IndexedDB; не закрывайте вкладку до подтверждения.';
const PERSIST_ERROR = 'Не удалось сохранить проект: основное и резервное хранилища недоступны. Скачайте JSON немедленно.';
function cancelScheduledPersist() {
  if (persistIdleRequest && 'cancelIdleCallback' in window) cancelIdleCallback(persistIdleRequest);
  if (persistTimeout) clearTimeout(persistTimeout);
  persistIdleRequest = persistTimeout = 0;
}
const persist = () => {
  cancelScheduledPersist();
  const savedAt = Math.max(Date.now(), localSavedAt + 1, lastPersistAt + 1);
  lastPersistAt = savedAt;
  const revision = ++persistRevision;
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...state, _udsSavedAt: savedAt }));
    localSavedAt = savedAt;
    persistFailed = false;
    persistBackupFailed = false;
    return true;
  } catch {
    persistFailed = true;
    persistBackupFailed = false;
    backupNoticeShown = false;
    scheduleEmergencyBackup(state, savedAt).then(backup => {
      if (backup.savedAt >= savedAt && backup.savedAt >= localSavedAt) {
        persistFailed = false;
        persistBackupFailed = false;
        if (!backupNoticeShown) {
          backupNoticeShown = true;
          toast('Основное хранилище заполнено. Изменения сохранены в резервной базе IndexedDB.');
        }
      }
    }).catch(() => {
      if (revision !== persistRevision || savedAt < localSavedAt) return;
      persistFailed = true;
      persistBackupFailed = true;
      toast(PERSIST_ERROR);
    });
    return false;
  }
};
function schedulePersist() {
  cancelScheduledPersist();
  if ('requestIdleCallback' in window) persistIdleRequest = requestIdleCallback(() => { persistIdleRequest = 0; persist(); }, { timeout: 1200 });
  else persistTimeout = setTimeout(() => { persistTimeout = 0; persist(); }, 350);
}
function flushScheduledPersist() { if (persistIdleRequest || persistTimeout) persist(); }
window.addEventListener('pagehide', flushScheduledPersist);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushScheduledPersist(); });
let emergencyRestorePromise;
function restoreEmergencyBackupIfNewer() {
  if (!emergencyRestorePromise) emergencyRestorePromise = (async () => {
    try {
      const backup = await loadEmergencyBackup();
      if (!backup || backup.savedAt <= localSavedAt || !backup.state?.raw) return false;
      state = {
        raw: backup.state.raw,
        library: Array.isArray(backup.state.library) ? backup.state.library : [],
        analysis: backup.state.analysis || null
      };
      localSavedAt = backup.savedAt;
      toast('Последняя резервная копия проекта восстановлена из IndexedDB.');
      return true;
    } catch {
      return false;
    }
  })();
  return emergencyRestorePromise;
}
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
  // Cloudflare Workers AI daily allowance resets at 00:00 UTC; in Asia/Baku this is 04:00.
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const min = Math.max(0, Math.ceil((next - now.getTime()) / 60000));
  return { hours: Math.floor(min / 60), minutes: min % 60, at: new Date(next) };
}
const bakuTime = date => new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Baku', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(date);
const bakuDate = date => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
function renderAiBudget() {
  const box = $('#dash-ai-budget'); if (!box) return;
  const journal = aiJournal();
  const session = journal.filter(e => e.at >= sessionStart);
  const sTokens = session.reduce((sum, e) => sum + (Number(e.tokens) || 0), 0);
  const bakuToday = bakuDate(new Date());
  const daily = journal.filter(e => bakuDate(new Date(e.at)) === bakuToday);
  const dTokens = daily.reduce((sum, e) => sum + (Number(e.tokens) || 0), 0);
  const r = untilReset();
  const resetAt = bakuTime(r.at);
  const sessionAt = bakuTime(new Date(sessionStart));
  let today;
  if (aiToday && !aiToday.error && aiToday.neurons !== null && aiToday.neurons !== undefined && aiToday.neurons !== '' && Number.isFinite(Number(aiToday.neurons))) {
    const n = Number(aiToday.neurons), pct = Math.min(100, Math.round(n / WORKERS_AI_FREE_NEURONS * 100));
    const alert = pct >= 100
      ? { level: 'err', text: 'Бесплатная квота исчерпана по данным аналитики. Если AI-шлюз подключён, тексты пишет бесплатный резерв (Groq), фото недоступны до 00:00 UTC; платный резервный провайдер отключён.' }
      : pct >= 85
        ? { level: 'err', text: 'Израсходовано не менее 85% ориентировочного бесплатного объёма. Сократите генерации до суточного сброса.' }
        : pct >= 70
          ? { level: 'warn', text: 'Израсходовано не менее 70% ориентировочного бесплатного объёма. Следите за расходом.' }
          : null;
    today = '<div class="dash-meter" data-level="' + (pct >= 85 ? 'err' : pct >= 70 ? 'warn' : 'ok') + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Расход Neurons Cloudflare с 00:00 UTC"><span style="width:' + Math.max(2, pct) + '%"></span></div>' +
      '<p class="dash-meter-note"><b>Cloudflare с 00:00 UTC:</b> ' + n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' из ~' + WORKERS_AI_FREE_NEURONS.toLocaleString('ru-RU') + ' Neurons (' + pct + '%), ' + Number(aiToday.requests || 0).toLocaleString('ru-RU') + ' запросов. Остаток ~' + Math.max(0, WORKERS_AI_FREE_NEURONS - n).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + '.</p>' +
      (alert ? '<p class="dash-meter-note" data-ai-budget-alert="' + alert.level + '" role="status" aria-live="polite"><b>Предупреждение:</b> ' + alert.text + '</p>' : '');
  } else {
    today = '<p class="dash-meter-note"><b>До сброса:</b> ' + esc(aiToday?.error ? 'нет данных — ' + aiToday.error : aiToday ? 'нет данных — Cloudflare не вернул показатель Neurons' : 'загружаем данные Cloudflare…') + '</p>';
  }
  box.innerHTML = today +
    '<div class="dash-ai-periods">' +
      '<p class="dash-meter-note"><b>За сессию</b> (эта вкладка, с ' + esc(sessionAt) + '): ' + session.length + ' операций · ' + sTokens.toLocaleString('ru-RU') + ' токенов.</p>' +
      '<p class="dash-meter-note"><b>За сегодня</b> (журнал, Asia/Baku): ' + daily.length + ' операций · ' + dTokens.toLocaleString('ru-RU') + ' токенов.</p>' +
      '<p class="dash-meter-note"><b>До сброса Cloudflare:</b> ' + r.hours + ' ч ' + r.minutes + ' мин — в ' + esc(resetAt) + ' по Asia/Baku (00:00 UTC).</p>' +
    '</div>' +
    '<p class="dash-meter-note">Токены считаются по фактическим данным, которые вернула модель, и хранятся в журнале этого браузера. Neurons берутся отдельно из Cloudflare Analytics; ориентир ~' + WORKERS_AI_FREE_NEURONS.toLocaleString('ru-RU') + ' не является гарантированным лимитом аккаунта.</p>';
}
async function refreshAiToday() {
  let endpoint;
  try {
    endpoint = (localStorage.getItem('uds:ai-endpoint') || getDefaultAiEndpoint()).trim();
  } catch {
    aiToday = { error: 'хранилище настроек недоступно' };
    return renderAiBudget();
  }
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
// Каким путём прошёл AI-запрос: через Universal AI Gateway (и кто ответил) или напрямую в Workers AI.
const PROVIDER_NAMES = { cloudflare: 'Cloudflare', groq: 'Groq', gemini: 'Gemini', openrouter: 'OpenRouter', cerebras: 'Cerebras', mistral: 'Mistral', nvidia: 'NVIDIA' };
function routeLabel(entry) {
  if (entry.route === 'gateway') return entry.provider && entry.provider !== 'cloudflare' ? 'шлюз → резерв ' + (PROVIDER_NAMES[entry.provider] || entry.provider) : 'через шлюз';
  if (entry.route === 'direct') return entry.provider ? 'напрямую · ' + (PROVIDER_NAMES[entry.provider] || entry.provider) : 'напрямую';
  return '';
}
function renderAiJournal() {
  renderAiBudget();
  const box = $('#dash-ai-journal'); if (!box) return;
  const list = aiJournal();
  const today = bakuDate(new Date());
  const todays = list.filter(e => bakuDate(new Date(e.at)) === today);
  const tokens = todays.reduce((sum, e) => sum + (Number(e.tokens) || 0), 0);
  const errors = todays.filter(e => e.status !== 'ok').length;
  const time = iso => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const row = e => '<li data-status="' + (e.status === 'ok' ? 'ok' : 'err') + '"><span>' + time(e.at) + '</span><b>' + esc(e.label) + '</b><small>' +
    esc([e.status === 'ok' ? 'готово' : 'ошибка: ' + (e.error || ''), routeLabel(e), e.ms ? (e.ms / 1000).toFixed(1) + ' с' : '', e.tokens != null ? Number(e.tokens).toLocaleString('ru-RU') + ' ток.' : e.kind === 'image' ? 'токены: нет в ответе' : ''].filter(Boolean).join(' · ')) + '</small></li>';
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
  const action = '<button type="button" data-open-project="' + item.index + '">Открыть</button>';
  return '<article class="dash-project-card"><div class="dash-project-image" style="background:linear-gradient(135deg,' + esc(bg) + ',' + esc(bg) + ' 55%,' + esc(accent) + ')">' + cover + swatches(look) + '</div>' +
    '<div class="dash-project-info"><b>' + esc(name) + '</b><small>' + esc(p.niche || 'Коммерческий сайт') + '</small>' +
    (look ? '<small class="dash-arch">' + esc(look.archetype) + '</small>' : '') + action + '</div></article>';
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
// Локальное хранилище ограничено отдельно; общий лимит origin может быть больше за счёт IndexedDB.
let storageEstimateRevision = 0;
function renderStorage() {
  const meter = $('#dash-storage'); if (!meter) return;
  let bytes = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch { /* хранилище недоступно */ }
  const LOCAL_LIMIT = 5 * 1024 * 1024, localPct = Math.min(100, Math.round(bytes / LOCAL_LIMIT * 100));
  const note = $('#dash-storage-note');
  const update = (used, quota) => {
    const pct = quota > 0 ? Math.min(100, Math.round(used / quota * 100)) : localPct;
    const level = Math.max(localPct, pct);
    meter.setAttribute('aria-valuenow', String(pct));
    meter.dataset.level = level >= 85 ? 'err' : level >= 65 ? 'warn' : 'ok';
    meter.querySelector('span').style.width = Math.max(2, pct) + '%';
    const mb = value => (value / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
    const local = 'localStorage: ' + mb(bytes) + ' из ~5 МБ (' + localPct + '%)';
    const origin = quota > 0 ? 'Весь сайт в браузере: ' + mb(used) + ' из ' + mb(quota) + ' МБ (' + pct + '%).' : '';
    note.textContent = local + (origin ? '. ' + origin : '.') + (level >= 65
      ? ' Экспортируйте важные проекты. Лимит localStorage отдельно не увеличивается; изображения лучше хранить в IndexedDB.'
      : ' Данные браузера локальны; используйте «Экспорт JSON» для резервной копии.');
  };
  update(bytes, LOCAL_LIMIT);
  const revision = ++storageEstimateRevision;
  try {
    if (navigator.storage?.estimate) navigator.storage.estimate().then(result => {
      if (revision !== storageEstimateRevision) return;
      update(Number(result.usage) || bytes, Number(result.quota) || LOCAL_LIMIT);
    }).catch(() => {});
  } catch { /* оценка квоты не поддерживается */ }
}
// Подключения: проверяем /health серверов, адреса которых заданы в этом браузере.
async function pingHealth(endpoint) {
  let url; try { url = new URL(endpoint); } catch { return false; }
  url.pathname = '/health'; url.search = '';
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 6000);
  try { const res = await fetch(url.href, { signal: controller.signal, cache: 'no-store' }); return res.ok; } catch { return false; } finally { clearTimeout(timer); }
}
// Состояние AI-шлюза — через /api/diagnostics AI Worker (шлюз отдаёт квоту, не тратя её).
async function refreshGatewayStatus(endpoint) {
  if (!endpoint) return setDashStatus('gateway', 'off', 'AI-сервер не задан');
  let url; try { url = new URL(endpoint, location.href); } catch { return setDashStatus('gateway', 'off', 'Некорректный адрес AI-сервера'); }
  url.pathname = url.pathname.replace(/\/api\/generate-landing\/?$/i, '/api/diagnostics'); url.search = '';
  try {
    const res = await fetch(url.href, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    const gateway = body.gateway;
    if (!res.ok || !gateway) return setDashStatus('gateway', 'off', 'Статус недоступен' + (res.ok ? ' — Worker не обновлён' : ''));
    if (!gateway.configured) return setDashStatus('gateway', 'off', 'Не подключён — запросы идут напрямую в Workers AI');
    if (!gateway.ok) return setDashStatus('gateway', 'warn', 'Шлюз не ответил — запросы идут напрямую в Workers AI');
    const parts = ['Подключён'];
    const quota = gateway.quota;
    if (quota && quota.limit) parts.push('осталось ' + quota.remaining.toLocaleString('ru-RU') + ' из ' + quota.limit.toLocaleString('ru-RU') + (quota.resetAt ? ' до ' + bakuTime(new Date(quota.resetAt)) : ''));
    parts.push(gateway.fallback?.length ? 'резерв: ' + gateway.fallback.map(name => PROVIDER_NAMES[name] || name).join(', ') : 'без резерва');
    const low = quota && quota.limit && quota.remaining < quota.limit * 0.1;
    setDashStatus('gateway', low ? 'warn' : 'ok', parts.join(' · '));
  } catch {
    setDashStatus('gateway', 'off', 'Статус недоступен');
  }
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
  refreshGatewayStatus(ai);
  if (!analyzer) setDashStatus('analyzer', 'off', 'Не подключён — настройка в «Анализ сайтов и шаблоны»');
  else pingHealth(analyzer).then(ok => setDashStatus('analyzer', ok ? 'ok' : 'warn', ok ? 'Анализатор-сервер отвечает' : 'Анализатор-сервер не ответил'));
}
function renderDashboard() {
  const root = $('#dash-projects'); if (!root) return;
  const saved = state.library.map((item, index) => ({ raw: item.raw, analysis: item.analysis || null, index, kind: 'saved' }));
  const entries = saved;
  const q = dashboardQuery.trim().toLowerCase();
  const shown = entries.filter(item => {
    const p = normalizeProject(item.raw);
    return !q || [p.brand, p.niche, p.title].some(value => String(value || '').toLowerCase().includes(q));
  });
  $('#dash-project-count').textContent = String(saved.length);
  const empty = q ? '<b>Ничего не найдено</b><p>Измените поисковый запрос.</p>'
    : '<b>Здесь появятся ваши сайты</b><p>Соберите сайт выше и нажмите «В реестр» в рабочей области. Проект сохранится в этом браузере, а новые сайты будут сверяться с ним на непохожесть.</p>';
  root.innerHTML = shown.length ? shown.map(projectCard).join('') : '<div class="dash-empty">' + empty + '</div>';
  renderContinue();
  renderStorage();
}
// ---------- Вкладки панели: AI-генерация, свои настройки, редактор ----------
// Одна вкладка на экране вместо длинной прокрутки. Выбор запоминается в этом браузере.
const PANEL_BLOCKS = ['ai', 'own', 'editor'];
const PANEL_BLOCK_KEY = 'uds:panel-block';
function showPanelBlock(name, { focus = false } = {}) {
  if (!PANEL_BLOCKS.includes(name)) name = 'ai';
  for (const block of PANEL_BLOCKS) {
    const tab = $('#ptab-' + block), panel = $('#pblock-' + block), active = block === name;
    if (tab) { tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; }
    if (panel) panel.hidden = !active;
  }
  // Секция автопилота содержит формы первых двух вкладок; в редакторе она не нужна.
  const auto = $('.panel .auto'); if (auto) auto.hidden = name === 'editor';
  try { localStorage.setItem(PANEL_BLOCK_KEY, name); } catch { /* хранилище недоступно */ }
  if (focus) $('#ptab-' + name)?.focus();
  $('.panel')?.scrollTo?.({ top: 0 });
}
$('.panel-tabs')?.addEventListener('click', e => {
  const tab = e.target.closest('[role="tab"]'); if (tab) showPanelBlock(tab.id.replace('ptab-', ''));
});
$('.panel-tabs')?.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const current = PANEL_BLOCKS.findIndex(block => $('#ptab-' + block)?.getAttribute('aria-selected') === 'true');
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? PANEL_BLOCKS.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + PANEL_BLOCKS.length) % PANEL_BLOCKS.length;
  e.preventDefault();
  showPanelBlock(PANEL_BLOCKS[next], { focus: true });
});
showPanelBlock((() => { try { return localStorage.getItem(PANEL_BLOCK_KEY) || 'ai'; } catch { return 'ai'; } })());

function openWorkspace(section = 'create') {
  document.body.classList.remove('dashboard-mode');
  document.querySelectorAll('.dash-nav [data-dash]').forEach(button => button.classList.toggle('is-active', button.dataset.dash === section));
  if (section === 'create') showPanelBlock('ai');
  if (section === 'editor' || section === 'settings') showPanelBlock('editor');
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
  if (e.target.closest('[data-journal-clear]')) { try { localStorage.removeItem(AI_JOURNAL_KEY); } catch { /* нет хранилища */ } renderAiJournal(); return; }
  if (e.target.closest('[data-continue="download"]')) { $('#download').click(); return; }
  const action = e.target.closest('[data-dash]')?.dataset.dash;
  if (action === 'projects') {
    renderDashboard();
    $('#dash-projects-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.dash-nav [data-dash]').forEach(button => button.classList.toggle('is-active', button.dataset.dash === 'projects'));
    return;
  }
  if (action && action !== 'home') openWorkspace(action);
});
// Быстрый старт с главной: те же поля автопилота и тот же запуск, без лишнего перехода.
$('#quick-start')?.addEventListener('submit', e => {
  e.preventDefault();
  const niche = $('#qs-niche').value.trim();
  if (!niche) { $('#qs-niche').focus(); return; }
  userStartedProject = true;
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
  showPanelBlock('editor');
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
    ['@hideCTA', 'Скрыть главную кнопку вручную', 'hideCTA', 'Состояние сохраняется между пересборками.'],
    ['seoTitle', 'SEO-заголовок (title)', 'text', 'Необязательно. 30–60 символов. Если пусто — «Заголовок — Бренд»'],
    ['seoDescription', 'SEO-описание (meta description)', 'area', 'Необязательно. 120–160 символов. Если пусто — описание предложения'],
  ]],
  ['Общие настройки сайта', false, [
    ['site.logo', 'Логотип сайта (URL изображения)', 'text', 'Общий логотип шапки для страниц сайта.'],
    ['site.socialImage', 'Обложка для превью ссылок (URL)', 'text', 'Используется, если у страницы нет собственного изображения для Open Graph.'],
    ['site.contacts.phone', 'Общий телефон'], ['site.contacts.email', 'Общий e-mail'],
    ['site.contacts.address', 'Общий адрес'], ['site.contacts.hours', 'Общие часы работы'],
    ['site.header.tagline', 'Подпись рядом с брендом'], ['site.header.ctaLabel', 'Текст кнопки в шапке'],
    ['site.footer.note', 'Примечание в подвале'], ['site.footer.copyright', 'Строка авторских прав'],
  ]],
  ['Дизайн и фирменный стиль', false, [
    ['@stylePreset', 'Готовый стиль оформления', 'stylePreset', '20 согласованных сочетаний композиции, палитры и геометрии. После выбора каждый параметр можно менять вручную.'],
    ['@navStyle', 'Стиль шапки и навигации', 'navStyle', '20 вариантов расположения шапки, независимо от архитектуры страницы.'],
    ['@arch', 'Архитектура главной страницы', 'arch'], ['@palette', 'Палитра', 'palette'], ['@accent', 'Акцентный цвет', 'accent'],
    ['@visualIdentity', 'Новая визуальная система', 'visualIdentity', 'Новая система: палитры по нише, геометрия, типографика и интервалы. Можно включить отдельно, не меняя старые проекты.'],
    ['@tier', 'Класс', 'tier', 'Премиум и люкс меняют композицию, шрифты, палитру, кнопки и тон текстов'],
    ['@mechanic', 'Поведение карточек', 'mechanic', 'Авто — движок выбирает по архитектуре и данным: раскрытие, переворот, колода, лента или мозаика. Всё работает с клавиатуры и без анимации'],
    ['@imageMask', 'Форма фотографий', 'imageMask', 'Авто — по форме углов и характеру бренда. Маска применяется только к фото, рамки фокуса не обрезаются'],
    ['@graphicDirection', 'Направление графики', 'graphicDirection', 'Стиль фото и заданий на графику: кинематографичная съёмка, макрофактура, студийная съёмка товара и др. Авто — по нише'],
    ['@artDirectionPreset', 'Сценарий арт-дирекции', 'artDirectionPreset', 'Согласованный комплект: архитектура и положение заголовка, шапка и навигация, стиль CTA, типографика, движение, свет, фактура и переходы. Явные настройки отдельных эффектов имеют приоритет'],
    ['@cinematicLayers', 'Фактура и свет', 'cinematicLayers', 'Зерно, бумага, полутон, сетка или сканлинии и световые слои первого экрана. Авто — по направлению графики. Только декор позади текста: контраст не меняется'],
    ['@transition', 'Переходы между секциями', 'transition', 'Мягкий градиентный ореол на стыке блоков без отдельной полосы и отступа. Цвета «Авто» согласованы с палитрой'],
    ['@revealEffect', 'Появление блоков', 'revealEffect', '25 вариантов: выезд с краёв, масштаб, размытие, шторка, поворот и объёмный вход. Ручной выбор включает появление. При «уменьшить движение» контент виден сразу'],
    ['@buttonStyle', 'Стиль кнопок', 'buttonStyle', '15 стилей: капсула, градиент, свечение, объём, выезжающая заливка, стрелка, стекло, неон и другие. Цвета — из палитры, контраст сохраняется'],
    ['@typeStyle', 'Стиль типографики', 'typeStyle', '15 стилей оформления заголовков поверх выбранных шрифтов: плотный, воздушный, прописные с разрядкой, курсив, крупный, капитель, маркер, нумерация и другие. Цвета не меняются'],
    ['@sectionLayout', 'Раскладка секций', 'sectionLayout', '15 раскладок: журнальная, смещённая, рамки, центр, липкий заголовок, чередование сторон, полосы, колонки, панели, рельс, узкая, широкая, номер секции, карточки-секции'],
    ['@textAnimation', 'Анимация текста', 'textAnimation', 'Сжатие трекинга, проявление из размытия, маркер и подчёркивание при прокрутке, подъём и наклон заголовков, печать надписи. Только без «уменьшить движение»'],
    ['@buttonAnimation', 'Анимация кнопок', 'buttonAnimation', 'Пульс, блик, волна от нажатия, толчок стрелки, обводка, подъём, упругое нажатие, дыхание свечения, желе, подчёркивание. Несовместимые со стилем кнопки сочетания пропускаются'],
    ['@effectMode', 'Режим выбора эффектов', 'effectMode', 'Авто — движок подбирает и обновляет эффекты; вручную — фиксированный выбор; смешанный — можно закрепить карточки или первый экран, остальное подбирается автоматически. Выбор запоминается при повторной генерации'],
    ['@cardEffect', 'Эффект карточек', 'cardEffect', '24 эффекта: прожектор, объёмный наклон, сатиновая кромка, блик, градиентная рамка, стопка, шторка, ч/б → цвет, расфокус соседей, ленты-бейджи (из поля «Бейдж»), счётчики чисел и другие. Наведение дублируется фокусом с клавиатуры'],
    ['@heroEffect', 'Эффект первого экрана', 'heroEffect', '22 эффекта: аврора, мягкий свет мастерской, проявление из мягкого фокуса, сетка, туман, боке, звёзды, волны, морфинг, Кен Бёрнс, дуотон, слайд-шоу, градиент в буквах, бегущая строка, печатная машинка, раскрытие строк, параллакс, магнитная кнопка, прожектор. Фотоэффекты — только при наличии фото'],
    ['@motionStyle', 'Интенсивность движения', 'motionStyle', 'Авто подбирает эффекты по нише и бренду. Люкс — медленные малозаметные появления и сдержанные эффекты. Кинематографичный — выразительное движение. Статичный — автоматические эффекты без постоянной анимации; ручной выбор сохраняется'],
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
    ['services', 'Позиции', 'list', 'Название | Описание | Цена | URL картинки | ALT-текст | Категория | Бейдж (например, «Хит» — только если это правда). Последние поля необязательны. У магазина цены и категории включают фильтры, сортировку и корзину-заявку'],
    ['categories', 'Категории', 'list', 'Одна категория на строку'],
  ]],
  ['Содержание сайта', false, [
    ['@layout', 'Расположение блоков', 'layout', 'Перетащите мышью или переставьте кнопками ↑ ↓ (клавиатура: Tab до кнопки, Enter). Порядок сохраняется в проекте и экспорте. Секции можно двигать и прямо в предпросмотре — кнопка «Перетаскивать в предпросмотре».'],
    ['aboutTitle', 'Заголовок «О нас»'], ['aboutText', 'Текст «О нас»', 'area'],
    ['advantagesTitle', 'Заголовок преимуществ'], ['advantages', 'Преимущества', 'list', LIST_HINT],
    ['processTitle', 'Заголовок этапов работы'], ['process', 'Этапы работы', 'list', LIST_HINT],
    ['pricingTitle', 'Заголовок тарифов и пакетов'], ['pricing', 'Тарифы и пакеты', 'list', 'Название | Описание | Цена | URL картинки (необязательно). Показываются только введённые цены — движок ничего не придумывает.'],
    ['casesTitle', 'Заголовок кейсов'], ['cases', 'Кейсы и результаты', 'list', 'Проект или задача | Что сделали и какой подтверждённый результат получили | (пусто) | URL изображения (необязательно) | ALT-текст. Добавляйте только реальные результаты.'],
    ['@quiz', 'Подбор по квизу', 'quiz', 'Необязательный короткий подбор: услуги из каталога + приоритет клиента. Результат можно перенести в заявку; внешние сервисы не нужны. Требуется не менее двух позиций.'],
    ['quizTitle', 'Заголовок квиза'],
    ['faqs', 'Вопросы и ответы', 'list', 'Один вопрос на строку: Вопрос | Ответ'],
    ['testimonials', 'Отзывы клиентов', 'list', 'Только реальные отзывы с разрешением на публикацию: Имя или подпись | Текст'],
    ['team', 'Команда', 'list', 'Имя | Роль | Цена (оставьте пустой) | URL фотографии | ALT-текст'],
    ['stats', 'Факты и цифры', 'list', 'Только подтверждённые данные: Показатель | Что именно подтверждает цифра'],
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
  const a = Array.isArray(r) ? r.slice(0, 7) : [r.title, r.text, r.price, r.image, r.alt, r.category, r.badge];
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
    const current = (state.raw.gallery || []).filter(g => !String(g.src || '').startsWith('data:image/'));
    return [...rows.map((r, i) => {
      const old = current.find(g => g.src === r[0]) || (rows.length === current.length ? current[i] : null);
      return { ...(old?.id ? { id: old.id } : {}), src: r[0], caption: r[1] || '', alt: r[2] || '' };
    }), ...embedded];
  }
  if (path === 'services') return rows.map((row, i) => {
    const current = state.raw.services || [];
    const old = current.find(s => (Array.isArray(s) ? s[0] : s.title) === row[0]) || (rows.length === current.length ? current[i] : null);
    const image = Array.isArray(old) ? old[3] : old?.image;
    const oldAlt = Array.isArray(old) ? old[4] : old?.alt;
    const oldId = Array.isArray(old) ? old[7] : old?.id;
    if (String(image || '').startsWith('data:image/')) row[3] = image;
    if (!row[4] && oldAlt) row[4] = oldAlt;
    if (oldId) row[7] = oldId;
    return row;
  });
  if (['advantages', 'process', 'faqs', 'testimonials', 'team', 'stats', 'pricing', 'cases'].includes(path)) {
    const current = state.raw[path] || [];
    return rows.map((row, i) => {
      const old = current.find(item => (Array.isArray(item) ? item[0] : item.title) === row[0]) || (rows.length === current.length ? current[i] : null);
      const id = Array.isArray(old) ? old[7] : old?.id;
      if (!id) return row;
      const cells = row.slice(0, 7);
      cells[7] = id;
      return cells;
    });
  }
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

const VISUAL_PREVIEW_CONTROLS = new Set([
  'stylePreset', 'arch', 'navStyle', 'palette', 'imageMask', 'visualIdentityPalette', 'visualIdentityShape',
  'cinematicLayers', 'sectionLayout', 'buttonStyle', 'cardEffect', 'heroEffect', 'motionStyle', 'effectMode',
  'artDirectionPreset', 'graphicDirection', 'textEffect', 'fontPair', 'typeStyle', 'revealEffect', 'mechanic',
]);
let visualPreviewFrame = null;
let visualPreviewSequence = 0;
let visualPreviewTimer = 0;
let visualPreviewRequest = 0;
let visualPreviewKey = '';
let visualPreviewWorker = null;
let visualPreviewWorkerFailed = false;

function getVisualPreviewWorker() {
  if (visualPreviewWorker || visualPreviewWorkerFailed || typeof Worker === 'undefined') return visualPreviewWorker;
  try {
    visualPreviewWorker = new Worker(new URL('./visual-preview-worker.js', import.meta.url), { type: 'module' });
    visualPreviewWorker.addEventListener('message', event => {
      const { request, html, error } = event.data || {};
      if (request !== visualPreviewRequest || !result) return;
      if (error) { console.warn('Не удалось показать вариант оформления', error); dismissVisualPreview(); return; }
      if (!html) return;
      showPreviewHtml(html);
    });
    visualPreviewWorker.addEventListener('error', event => {
      console.warn('Фоновый предпросмотр остановлен', event.message || 'ошибка Worker');
      visualPreviewWorker?.terminate();
      visualPreviewWorker = null;
      visualPreviewWorkerFailed = true;
    });
  } catch (error) {
    console.warn('Фоновый предпросмотр недоступен', error);
    visualPreviewWorkerFailed = true;
  }
  return visualPreviewWorker;
}

function enhanceVisualOptionControls() {
  for (const select of $('#form').querySelectorAll('select[data-special]')) {
    const special = select.dataset.special;
    if (!VISUAL_PREVIEW_CONTROLS.has(special) || select.disabled || select.dataset.previewEnhanced) continue;
    select.dataset.previewEnhanced = 'true';
    const selectedOption = () => [...select.options].find(option => option.value === select.value)?.textContent.trim() || 'Авто';
    const group = document.createElement('details');
    group.className = 'visual-option-preview';
    group.dataset.special = special;
    group.open = false;
    const summary = document.createElement('summary');
    summary.className = 'visual-option-preview__summary';
    summary.textContent = `Варианты оформления · ${selectedOption()}`;
    const listWrap = document.createElement('div');
    listWrap.className = 'visual-option-preview__content';
    const list = document.createElement('div');
    list.className = 'visual-option-preview__list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Варианты оформления: наведите для предпросмотра, нажмите для выбора');
    for (const option of select.options) {
      if (option.disabled) continue;
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'visual-option-preview__choice';
      choice.dataset.previewValue = option.value;
      choice.setAttribute('role', 'option');
      choice.setAttribute('aria-selected', String(option.value === select.value));
      choice.textContent = option.textContent.trim();
      list.append(choice);
    }
    const hint = document.createElement('small');
    hint.textContent = 'Наведите или перейдите клавишей Tab для просмотра на холсте; нажмите, чтобы применить.';
    listWrap.append(list, hint);
    group.append(summary, listWrap);
    select.hidden = true;
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    (select.closest('.field') || select.parentElement).after(group);
    select.addEventListener('change', () => {
      list.querySelectorAll('[role="option"]').forEach(item => item.setAttribute('aria-selected', String(item.dataset.previewValue === select.value)));
      summary.textContent = `Варианты оформления · ${selectedOption()}`;
      dismissVisualPreview();
    });
    const previewChoice = event => {
      const choice = event.target.closest('[data-preview-value]');
      if (choice && list.contains(choice)) renderOptionPreview(special, choice.dataset.previewValue);
    };
    list.addEventListener('pointerover', previewChoice);
    list.addEventListener('focusin', previewChoice);
    list.addEventListener('click', event => {
      const choice = event.target.closest('[data-preview-value]');
      if (!choice || !list.contains(choice)) return;
      const changed = select.value !== choice.dataset.previewValue;
      select.value = choice.dataset.previewValue;
      list.querySelectorAll('[role="option"]').forEach(item => item.setAttribute('aria-selected', String(item === choice)));
      if (changed) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      } else dismissVisualPreview();
      group.open = false;
    });
    group.addEventListener('pointerleave', event => { if (!group.contains(event.relatedTarget)) dismissVisualPreview(); });
    group.addEventListener('focusout', event => { if (!group.contains(event.relatedTarget)) dismissVisualPreview(); });
  }
}

function previewRawWithOption(special, value) {
  const next = JSON.parse(JSON.stringify(state.raw));
  const put = (key, item) => { if (item) next[key] = item; else delete next[key]; };
  if (special === 'stylePreset') {
    const preset = STYLE_PRESETS.find(item => item.id === value);
    if (!preset) return null;
    next.stylePresetId = preset.id;
    next.architecture = preset.architecture; next.architectureMode = 'exact'; delete next.designArchitecture;
    next.visualIdentityEnabled = true; next.visualIdentityPaletteId = preset.palette;
    next.visualIdentityShapeId = preset.shape; next.cinematicLayers = preset.background;
  } else if (special === 'arch') {
    const [mode, id] = value.split(':');
    next.architectureMode = mode === 'exact' || mode === 'family' ? mode : 'auto';
    next.architecture = mode === 'exact' ? id : 'auto';
    if (mode === 'family') next.designArchitecture = id; else delete next.designArchitecture;
  } else if (special === 'palette') {
    next.palette = { light: 'Светлая', dark: 'Тёмная', auto: '' }[value] || '';
    next.paletteLocked = value !== 'auto';
  } else if (special === 'navStyle') put('navStyle', value);
  else if (special === 'visualIdentityPalette') put('visualIdentityPaletteId', value);
  else if (special === 'visualIdentityShape') put('visualIdentityShapeId', value);
  else if (special === 'mechanic') put('itemsMechanic', value);
  else if (special === 'cardEffect' || special === 'heroEffect') { put(special, value); next.effectMode = 'mixed'; }
  else if (special === 'effectMode') {
    next.effectMode = value;
    if (value === 'auto') { delete next.cardEffect; delete next.heroEffect; delete next.effectsAvoid; }
    if (value === 'manual') { next.cardEffect ||= 'layered-shadow'; next.heroEffect ||= 'none'; }
  } else if (special === 'fontPair') { put('fontPair', value); if (value) next.fonts = 'web'; }
  else put(special, value);
  return next;
}

function renderOptionPreview(special, value) {
  const key = `${special}\\u0000${value}`;
  if (key === visualPreviewKey) return;
  visualPreviewKey = key;
  clearTimeout(visualPreviewTimer);
  const request = ++visualPreviewRequest;
  visualPreviewTimer = setTimeout(() => {
    if (request !== visualPreviewRequest || !result) return;
    const worker = getVisualPreviewWorker();
    if (worker) {
      try { worker.postMessage({ request, raw: previewRawWithOption(special, value), registry: registry() }); }
      catch (error) { console.warn('Не удалось отправить предпросмотр в фоновый процесс', error); dismissVisualPreview(); }
      return;
    }
    // Older browsers retain a usable preview; defer its synchronous generation
    // until the browser is idle so pointer and scroll input stays responsive.
    const generateFallback = () => {
      if (request !== visualPreviewRequest || !result) return;
      try { showPreviewHtml(generate(previewRawWithOption(special, value), { registry: registry() }).html); }
      catch (error) { console.warn('Не удалось показать вариант оформления', error); dismissVisualPreview(); }
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(generateFallback, { timeout: 700 });
    else setTimeout(generateFallback, 120);
  }, 70);
}

function showPreviewHtml(html) {
  const sequence = ++visualPreviewSequence;
  const host = $('#view-preview');
  const previous = visualPreviewFrame;
  const frame = document.createElement('iframe');
  frame.title = 'Временный предпросмотр варианта';
  frame.className = 'visual-option-preview-frame';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('aria-hidden', 'true');
  host.append(frame);
  visualPreviewFrame = frame;
  frame.addEventListener('load', () => {
    if (sequence !== visualPreviewSequence || !frame.isConnected) {
      frame.remove();
      return;
    }
    const scroll = readCanvasFrameScroll();
    frame.contentWindow?.postMessage({ type: 'uds-canvas-restore-scroll', x: scroll.x, y: scroll.y }, '*');
    requestAnimationFrame(() => { if (sequence === visualPreviewSequence && frame.isConnected) frame.classList.add('is-visible'); });
    if (previous && previous !== frame) setTimeout(() => previous.remove(), 240);
  }, { once: true });
  frame.srcdoc = previewHtml(html);
}

function dismissVisualPreview() {
  clearTimeout(visualPreviewTimer);
  ++visualPreviewRequest;
  ++visualPreviewSequence;
  visualPreviewKey = '';
  const frame = visualPreviewFrame;
  visualPreviewFrame = null;
  if (!frame) return;
  frame.classList.remove('is-visible');
  // The temporary page is only a visual overlay. Remove it now when a choice is
  // committed so it cannot remain above the live canvas while its transition fades.
  frame.remove();
}

function buildForm() {
  const arch = normalizeProject(state.raw).architecture;
  const archValue = arch.mode === 'exact' ? `exact:${arch.exact}` : arch.mode === 'family' ? `family:${arch.family}` : 'auto';
  const p = normalizeProject(state.raw);
  const effectMode = state.raw.effectMode || (state.raw.cardEffect || state.raw.heroEffect ? 'mixed' : 'auto');
  const autoEffectsAvailable = effectMode === 'auto' || (effectMode === 'mixed' && (!state.raw.cardEffect || !state.raw.heroEffect));
  const quickActions = `<section class="editor-quick-actions" aria-label="Быстрые действия"><strong>Быстрые действия</strong><small>Новая композиция и эффекты сохраняют введённое содержание.</small><button type="button" data-demo-fill title="Заполнит проект вымышленными демонстрационными данными">Заполнить вымышленным примером</button><button type="button" data-refresh-design>Новый вариант дизайна</button><button type="button" data-refresh-effects${autoEffectsAvailable ? '' : ' disabled'} title="${autoEffectsAvailable ? 'Обновить автоматически подобранные эффекты' : 'Переключите режим эффектов на «Авто» или «Смешанный»'}">Новый вариант эффектов</button></section>`;
  const html = quickActions + GROUPS.map(([title, open, fields]) => `<details class="group"${open ? ' open' : ''}><summary>${title}</summary><div class="fields">${fields.map(([path, label, type = 'text', hint = '']) => {
    const id = 'f-' + path.replace(/[^a-z]/gi, '-');
    const small = hint ? `<small id="${id}-h">${hint}</small>` : '';
    const d = hint ? ` aria-describedby="${id}-h"` : '';
    let control;
    if (type === 'area') control = `<textarea id="${id}" data-path="${path}"${d}>${esc(get(path))}</textarea>`;
    else if (type === 'hideCTA') control = `<label class="row"><input type="checkbox" data-hide-cta${state.raw.fieldStates?.cta === 'hidden' ? ' checked' : ''}> Не показывать CTA</label>`;
    else if (type === 'quiz') control = `<label class="row"><input type="checkbox" data-special="quizEnabled"${state.raw.quiz?.enabled === true ? ' checked' : ''}> Добавить квиз на страницу</label>`;
    else if (type === 'list') control = `<textarea id="${id}" class="list" data-list="${path}"${d} spellcheck="false">${esc(rowsToText(get(path), path))}</textarea>`;
    else if (type === 'arch') control = `<select id="${id}" data-special="arch">
<option value="auto">${LEGACY_LABELS.auto}</option>
<optgroup label="Семейства (как в редакторе Landing Studio)">${Object.entries(LEGACY_LABELS).filter(([k]) => k !== 'auto').map(([k, v]) => `<option value="family:${k}">${v}</option>`).join('')}</optgroup>
<optgroup label="Точная архитектура">${Object.entries(ARCHETYPES).map(([k, a]) => `<option value="exact:${k}">${a.name} — ${a.ru}</option>`).join('')}</optgroup></select>`.replace(`value="${archValue}"`, `value="${archValue}" selected`);
    else if (type === 'stylePreset') control = `<select id="${id}" data-special="stylePreset"><option value="">Выберите готовое сочетание</option>${STYLE_PRESETS.map(item => `<option value="${item.id}"${state.raw.stylePresetId === item.id ? ' selected' : ''}>${esc(item.name)}</option>`).join('')}</select>`;
    else if (type === 'navStyle') control = `<select id="${id}" data-special="navStyle"><option value="">Авто — по архитектуре</option>${Object.entries(NAV_LABELS).map(([key, label]) => `<option value="${esc(key)}"${state.raw.navStyle === key ? ' selected' : ''}>${esc(key)} — ${esc(label)}</option>`).join('')}</select>`;
    else if (type === 'palette') control = `<select id="${id}" data-special="palette">${[['auto', 'Автоматически по нише'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([k, v]) => `<option value="${k}"${p.palette === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'visualIdentity') {
      const options = listVisualIdentityOptions();
      const enabled = state.raw.visualIdentityEnabled === true;
      const palette = state.raw.visualIdentityPaletteId || '';
      const shape = state.raw.visualIdentityShapeId || '';
      control = `<label class="row"><input type="checkbox" data-special="visualIdentityEnabled"${enabled ? ' checked' : ''}> Включить новую систему</label>
        <label for="${id}-palette">Палитра</label><select id="${id}-palette" data-special="visualIdentityPalette"><option value="">Автоматически по нише</option>${options.palettes.map(item => `<option value="${item.id}"${palette === item.id ? ' selected' : ''}>${esc(item.name)} — ${item.mode === 'dark' ? 'тёмная' : 'светлая'}</option>`).join('')}</select>
        <label for="${id}-shape">Геометрия</label><select id="${id}-shape" data-special="visualIdentityShape"><option value="">Автоматически</option>${options.shapes.map(item => `<option value="${item.id}"${shape === item.id ? ' selected' : ''}>${esc(item.id)} — ${esc(item.card)}</option>`).join('')}</select>
        <small>Предпросмотр обновится автоматически. Выбор сохраняется вместе с проектом.</small>`;
    }
    else if (type === 'tier') control = `<select id="${id}" data-special="tier"${d}>${Object.entries(TIERS).map(([k, v]) => `<option value="${k}"${p.tier === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'promptMode') control = `<select id="${id}" data-special="promptMode">${[['append', 'Дополнить стандартный — мои указания важнее'], ['replace', 'Заменить стандартный моим']].map(([k, v]) => `<option value="${k}"${p.customPromptMode === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'mechanic') control = `<select id="${id}" data-special="mechanic"${d}><option value="">Авто</option>${Object.entries(MECHANICS).map(([k, v]) => `<option value="${k}"${state.raw.itemsMechanic === k ? ' selected' : ''}>${esc(v.split(':')[0])}</option>`).join('')}</select>`;
    else if (type === 'imageMask') { const dict = MASKS; control = `<select id="${id}" data-special="${type}"${d}><option value="">Авто</option>${Object.entries(dict).map(([k, v]) => `<option value="${k}"${state.raw[type] === k ? ' selected' : ''}>${esc(v.split(':')[0])}</option>`).join('')}</select>`; }
    else if (type === 'transition') {
      const t = state.raw, tr = result?.concept?.visualSystem?.transition, pal = result?.concept?.visualSystem?.palette || {};
      const color = (key, label, auto) => `<div class="transition-color"><label for="${id}-${key}">${label}</label><input type="color" id="${id}-${key}" data-special="${key}" value="${esc(t[key] || auto || '#888888')}"><span class="note" data-transition-state="${key}">${t[key] ? esc(t[key]) : 'авто'}</span><button type="button" data-transition-reset="${key}"${t[key] ? '' : ' disabled'}>Авто</button></div>`;
      const range = (key, label, [min, max], step, value, unit) => `<label for="${id}-${key}">${label}: <output data-transition-out="${key}">${value}${unit}</output></label><input type="range" id="${id}-${key}" data-special="${key}" min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}">`;
      control = `<p class="note transition-fixed">Постоянный мягкий градиент между первым экраном и каждым блоком. Можно настроить цвета, угол и высоту.</p>
        <div class="transition-gradient" role="group" aria-label="Настройка градиента перехода">
        ${color('transitionFrom', 'Цвет начала', pal.accent)}${color('transitionTo', 'Цвет конца', pal.accentInk || pal.accent)}
        ${range('transitionAngle', 'Угол', TRANSITION_LIMITS.angle, 15, tr?.angle ?? 180, '°')}
        ${range('transitionHeight', 'Высота', TRANSITION_LIMITS.height, 4, tr?.height ?? 72, ' px')}
        ${range('transitionIntensity', 'Интенсивность', TRANSITION_LIMITS.intensity, 5, tr?.intensity ?? 40, '%')}
        </div>`;
    }
    else if (type === 'typeStyle') control = `<select id="${id}" data-special="typeStyle"${d}><option value="">Авто — по шрифтам и архитектуре</option><option value="none"${state.raw.typeStyle === 'none' ? ' selected' : ''}>Без</option>${Object.entries(TYPE_STYLES).map(([k, v]) => `<option value="${k}"${state.raw.typeStyle === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    else if (type === 'sectionLayout') control = `<select id="${id}" data-special="sectionLayout"${d}><option value="">Авто — с проверкой на повторы</option>${Object.entries(SECTION_LAYOUTS).map(([k, v]) => `<option value="${k}"${state.raw.sectionLayout === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    else if (type === 'textAnimation') control = `<select id="${id}" data-special="textAnimation"${d}><option value="">Авто — по плану движения</option><option value="none"${state.raw.textAnimation === 'none' ? ' selected' : ''}>Без</option>${Object.entries(TEXT_ANIMATIONS).map(([k, v]) => `<option value="${k}"${state.raw.textAnimation === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    else if (type === 'buttonAnimation') control = `<select id="${id}" data-special="buttonAnimation"${d}><option value="">Авто — по плану движения</option><option value="none"${state.raw.buttonAnimation === 'none' ? ' selected' : ''}>Без</option>${Object.entries(BUTTON_ANIMATIONS).map(([k, v]) => `<option value="${k}"${state.raw.buttonAnimation === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    else if (type === 'effectMode') {
      const mode = state.raw.effectMode || (state.raw.cardEffect || state.raw.heroEffect ? 'mixed' : 'auto');
      control = `<select id="${id}" data-special="effectMode"${d}>${[['auto','Авто'],['manual','Выбрать вручную'],['mixed','Смешанный']].map(([k,v]) => `<option value="${k}"${mode === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    }
    else if (type === 'cardEffect') { const mode = state.raw.effectMode || (state.raw.cardEffect || state.raw.heroEffect ? 'mixed' : 'auto'); control = `<select id="${id}" data-special="cardEffect"${d}${mode === 'auto' ? ' disabled' : ''}><option value="">${mode === 'manual' ? 'По умолчанию проекта' : 'Авто — по архитектуре и классу'}</option><option value="none"${state.raw.cardEffect === 'none' ? ' selected' : ''}>Без эффекта</option>${Object.entries(CARD_EFFECTS).map(([k, v]) => `<option value="${k}"${state.raw.cardEffect === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`; }
    else if (type === 'heroEffect') { const mode = state.raw.effectMode || (state.raw.cardEffect || state.raw.heroEffect ? 'mixed' : 'auto'); const { all: photoCount, gallery: galleryPhotoCount } = sourcePhotoCounts(state.raw); const needsPhoto = new Set(['ken-burns', 'double-exposure', 'photo-wipe', 'duotone']); control = `<select id="${id}" data-special="heroEffect"${d}${mode === 'auto' ? ' disabled' : ''}><option value="">${mode === 'manual' ? 'По умолчанию проекта' : 'Авто — по архитектуре, классу и фото'}</option><option value="none"${state.raw.heroEffect === 'none' ? ' selected' : ''}>Без эффекта</option>${Object.entries(HERO_EFFECTS).map(([k, v]) => { const unavailable = needsPhoto.has(k) ? photoCount < 1 : k === 'slideshow' ? galleryPhotoCount < 2 : false; return `<option value="${k}"${state.raw.heroEffect === k ? ' selected' : ''}${unavailable ? ' disabled' : ''}>${esc(v)}${unavailable ? (k === 'slideshow' ? ' — нужны 2 фото в галерее' : ' — нужно фото') : ''}</option>`; }).join('')}</select>`; }
    else if (type === 'motionStyle') control = `<select id="${id}" data-special="motionStyle"${d}><option value=""${!state.raw.motionStyle ? ' selected' : ''}>Авто — по нише и бренду</option><option value="luxury"${state.raw.motionStyle === 'luxury' ? ' selected' : ''}>Люкс — медленно и сдержанно</option><option value="cinematic"${state.raw.motionStyle === 'cinematic' ? ' selected' : ''}>Кинематографичный — выразительный</option><option value="static"${state.raw.motionStyle === 'static' ? ' selected' : ''}>Статичный — минимум движения</option></select>`;
    else if (type === 'artDirectionPreset') control = `<select id="${id}" data-special="artDirectionPreset"${d}><option value=""${!state.raw.artDirectionPreset ? ' selected' : ''}>Авто — под нишу и содержимое</option>${Object.entries(ART_DIRECTION_PRESETS).map(([k, v]) => `<option value="${k}"${state.raw.artDirectionPreset === k ? ' selected' : ''}>${esc(v.label)}</option>`).join('')}</select>`;
    else if (type === 'layout') control = layoutControl(id);
    else if (type === 'revealEffect') control = `<select id="${id}" data-special="revealEffect"${d}><option value="">Авто — по плану движения</option>${Object.entries(REVEALS).map(([k, v]) => `<option value="${k}"${state.raw.revealEffect === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    else if (type === 'buttonStyle') control = `<select id="${id}" data-special="buttonStyle"${d}><option value="">Авто — по архитектуре и классу</option>${Object.entries(BUTTONS).map(([k, v]) => `<option value="${k}"${state.raw.buttonStyle === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    else if (type === 'cinematicLayers') control = `<select id="${id}" data-special="cinematicLayers"${d}><option value="">Авто — по направлению графики</option>${Object.entries(CINEMATIC_PRESETS).map(([k, v]) => `<option value="${k}"${state.raw.cinematicLayers === k ? ' selected' : ''}>${esc(v.label)}</option>`).join('')}</select>`;
    else if (type === 'graphicDirection') control = `<select id="${id}" data-special="graphicDirection"${d}><option value="">Авто</option>${Object.entries(GRAPHIC_DIRECTIONS).map(([k, v]) => `<option value="${k}"${state.raw.graphicDirection === k ? ' selected' : ''}>${esc(v.ru)}</option>`).join('')}</select>`;
    else if (type === 'textEffect') control = `<select id="${id}" data-special="textEffect"${d}><option value="">Авто</option>${Object.entries(TEXT_EFFECTS).map(([k, v]) => `<option value="${k}"${state.raw.textEffect === k ? ' selected' : ''}>${esc(v.split(':')[0])}</option>`).join('')}</select>`;
    else if (type === 'fontPair') control = `<select id="${id}" data-special="fontPair"${d}><option value="">Авто</option>${Object.values(WEB_FONT_PAIRS).flat().map(pr => `<option value="${esc(pr.display[0])}"${state.raw.fontPair === pr.display[0] ? ' selected' : ''}>${esc(pr.display[0] + ' + ' + pr.body[0])}${pr.accent ? ' · акцент ' + esc(pr.accent[0]) : ''}</option>`).join('')}</select>`;
    else if (type === 'fonts') control = `<select id="${id}" data-special="fonts"${d}>${[['system', 'Системные'], ['web', 'Google Fonts (с кириллицей)']].map(([k, v]) => `<option value="${k}"${p.fonts === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    else if (type === 'accent') control = `<div class="row"><input type="color" id="${id}" data-special="accent" value="${p.accent || '#888888'}"${p.accent ? '' : ' disabled'}><input type="checkbox" id="${id}-auto" data-special="accent-auto"${p.accent ? '' : ' checked'}><label for="${id}-auto">подобрать автоматически</label></div>`;
    else if (type === 'upload-hero') control = `<input id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="hero"><div class="media-preview">${p.images.hero ? `<figure><img src="${esc(p.images.hero)}" alt=""><label>ALT-текст <input type="text" data-hero-alt value="${esc(state.raw.images?.heroAlt || '')}" placeholder="Что изображено на фото"></label><button type="button" data-remove-image="hero">Удалить фото</button>${state.raw.images?.heroMobile ? `<div class="mobile-hero-asset"><img src="${esc(state.raw.images.heroMobile)}" alt=""><span>Отдельное фото для телефона</span><button type="button" data-remove-image="hero-mobile">Удалить мобильное фото</button></div>` : `<label class="mobile-hero-upload">Отдельная композиция для телефона <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="hero-mobile"></label>`}</figure>${cropEditor("hero", 0, p.images.hero)}` : '<span class="note">Фото пока не загружено — будет использован графический мотив.</span>'}</div>`;
    else if (type === 'upload-gallery') control = `<input id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple data-upload="gallery"><div class="media-preview media-preview--grid">${(p.gallery || []).map((g,i) => `<figure draggable="true" data-gallery-item="${i}"><img src="${esc(g.src)}" alt="${esc(g.alt)}"><figcaption>${esc(g.caption || `Фото ${i+1}`)}</figcaption><label>Название / подпись <input type="text" data-gallery-caption="${i}" value="${esc(g.caption || '')}" maxlength="180" placeholder="Подпись, которая появится под фото"></label><label>ALT-текст <input type="text" data-gallery-alt="${i}" value="${esc(g.alt || '')}" placeholder="Что изображено на фото"></label><button type="button" data-remove-image="gallery:${i}">Удалить</button>${state.raw.imageArtDirection?.mobileSources?.gallery?.[i] ? `<div class="mobile-hero-asset"><img src="${esc(state.raw.imageArtDirection.mobileSources.gallery[i])}" alt=""><span>Мобильная версия фото</span><button type="button" data-remove-image="gallery-mobile:${i}">Удалить мобильное фото</button></div>` : `<label class="mobile-hero-upload">Отдельное фото для телефона <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="gallery-mobile" data-image-index="${i}"></label>`}${cropEditor("gallery", i, g.src)}<div class="gallery-primary-controls">${i === 0 ? '<span class="gallery-primary-badge">★ Главное фото</span>' : `<button type="button" data-gallery-primary="${i}">Сделать главным</button>`}<button type="button" data-preview-gallery="${i}">Просмотр</button></div><div class="gallery-order-controls" aria-label="Порядок фотографии"><button type="button" data-move-gallery="${i}" data-direction="-1" ${i === 0 ? "disabled" : ""} aria-label="Переместить фото выше" title="Выше">↑</button><button type="button" data-move-gallery="${i}" data-direction="1" ${i === (p.gallery.length - 1) ? "disabled" : ""} aria-label="Переместить фото ниже" title="Ниже">↓</button></div></figure>`).join('') || '<span class="note">Галерея пока пуста.</span>'}</div>`;
    else if (type === 'upload-service') { const services = Array.isArray(state.raw.services) ? state.raw.services : []; control = `<label for="${id}-target">Для какой позиции</label><select id="${id}-target" data-service-target>${services.map((s,i) => `<option value="${i}">${esc(Array.isArray(s) ? s[0] : s.title || `Позиция ${i+1}`)}</option>`).join('') || '<option value="">Сначала добавьте позиции выше</option>'}</select><input id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="service"><div class="media-preview media-preview--grid">${services.map((s,i) => { const src = Array.isArray(s) ? s[3] : s.image; return src ? `<figure><img src="${esc(src)}" alt=""><figcaption>${esc(Array.isArray(s) ? s[0] : s.title || `Позиция ${i+1}`)}</figcaption><label>ALT-текст <input type="text" data-service-alt="${i}" value="${esc(Array.isArray(s) ? s[4] || '' : s.alt || '')}" placeholder="Что изображено на фото"></label><button type="button" data-remove-image="service:${i}">Удалить</button>${state.raw.imageArtDirection?.mobileSources?.services?.[i] ? `<div class="mobile-hero-asset"><img src="${esc(state.raw.imageArtDirection.mobileSources.services[i])}" alt=""><span>Мобильная фотография</span><button type="button" data-remove-image="service-mobile:${i}">Удалить мобильное фото</button></div>` : `<label class="mobile-hero-upload">Отдельное фото для телефона <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" data-upload="service-mobile" data-image-index="${i}"></label>`}${cropEditor("services", i, src)}</figure>` : ''; }).join('') || '<span class="note">Пока нет фотографий товаров и услуг.</span>'}</div>`; }
    else {
      const value = path.startsWith('contacts.') ? (get(path) || p.contacts[path.slice('contacts.'.length)]) : get(path);
      control = `<input id="${id}" data-path="${path}" value="${esc(value)}"${d}>`;
    }
    return `<div class="field"><label for="${id}">${label}</label>${control}${small}</div>`;
  }).join('')}</div></details>`).join('');
  // Раскрытые группы и прокрутка сохраняются: пересборка после перестановки не должна сворачивать панель.
  const openGroups = new Set([...$('#form').querySelectorAll('details.group[open]>summary')].map(n => n.textContent));
  const scrollTop = $('#form').scrollTop;
  $('#form').innerHTML = html;
  enhanceVisualOptionControls();
  if (openGroups.size) $('#form').querySelectorAll('details.group').forEach(d => { if (openGroups.has(d.querySelector('summary').textContent)) d.open = true; });
  $('#form').scrollTop = scrollTop;
}

// ---------- Генерация и отображение ----------
const registry = () => state.library.map(l => l.entry);

function updateChangePreviewButton() {
  const button = $('#change-preview');
  if (!button) return;
  if (!storedDesignPreviewChecked) {
    storedDesignPreviewChecked = true;
    try {
      const preview = JSON.parse(localStorage.getItem(PREVIEW_STORE) || 'null');
      storedDesignPreviewAvailable = Boolean(preview?.beforeHtml && preview?.afterHtml && preview.projectId === state.raw.id);
      storedDesignPreviewProjectId = storedDesignPreviewAvailable ? preview.projectId : '';
    } catch { storedDesignPreviewAvailable = false; }
  }
  const available = Boolean(pendingDesignPreview?.projectId === state.raw.id
    || (storedDesignPreviewAvailable && storedDesignPreviewProjectId === state.raw.id));
  button.disabled = !available;
  button.title = available ? 'Открыть сравнение в отдельной вкладке' : 'Сначала внесите изменение в текущий проект';
}
function run() {
  const previousResult = result;
  const previousRaw = lastRenderedRaw;
  let changedPreview = null;
  pendingCanvasFrameScroll = previousResult?.project.id === state.raw.id
    ? readCanvasFrameScroll()
    : null;
  const nextResult = generate(state.raw, { registry: registry() });
  if (previousResult && previousRaw && previousResult.project.id === nextResult.project.id && previousResult.html !== nextResult.html) {
    // Keep comparison snapshots in memory while editing. Serializing two complete
    // HTML documents (often containing embedded photos) into localStorage her…54860 tokens truncated…')||n.querySelector('img'));const images=[...section.querySelectorAll('img')].filter(n=>!n.closest('figure'));const photos=[...new Set([...figures,...images])].slice(0,5);if(photos.length<5){parent.postMessage({type:'uds-canvas-fan-error',message:'Для веера в выбранной секции нужно минимум пять фотографий'},'*');return}send({type:'uds-canvas-fan',sectionId:m.sectionId,photos:photos.map(key)})}if(m.type==='uds-canvas-select-element'){const n=[...document.querySelectorAll('[data-uds-element]')].find(x=>x.dataset.udsElement===m.elementId);if(n)pick(n)}if(m.type==='uds-canvas-select-key'){const n=candidates().find(x=>key(x)===m.key);if(n)pick(n)}if(m.type==='uds-canvas-select-block'){const block=[...document.querySelectorAll('[data-uds-block]')].find(x=>x.dataset.udsBlock===m.blockId);const n=block?.querySelector('h2,h3,p');if(n)pick(n)}if(m.type==='uds-canvas-select-duplicate'){const original=candidates().find(n=>key(n)===m.key);const duplicate=original?.nextElementSibling;if(duplicate&&candidates().includes(duplicate))pick(duplicate)}if(m.type==='uds-canvas-preview'){const n=candidates().find(x=>key(x)===m.key);if(!n)return;const p=m.patch||{};if(typeof p.text==='string')n.textContent=p.text;if(typeof p.alt==='string'&&n.tagName==='IMG')n.alt=p.alt.slice(0,240);if(typeof p.href==='string'&&n.matches('a')&&!p.href.startsWith('//')&&/^(?:https?:\\/\\/|mailto:|tel:|\\/(?!\\/)|#)/i.test(p.href))n.setAttribute('href',p.href.slice(0,2048));if(/^#[\\da-f]{6}$/i.test(p.color||''))n.style.color=p.color;if(/^#[\da-f]{6}$/i.test(p.background||''))n.style.backgroundColor=p.background;if(Number.isFinite(+p.translateX)||Number.isFinite(+p.translateY)){const x=Math.max(-1600,Math.min(1600,Number(p.translateX)||0)),y=Math.max(-1200,Math.min(1200,Number(p.translateY)||0));n.style.translate=n.closest('[data-uds-free-canvas]')?'calc(-50% + '+x+'px) calc(-50% + '+y+'px)':x+'px '+y+'px';}if(Number.isFinite(+p.rotation))n.style.rotate=Math.max(-45,Math.min(45,+p.rotation))+'deg';if(Number.isFinite(+p.fontSize))n.style.fontSize=Math.max(12,Math.min(96,+p.fontSize))+'px';if(Number.isFinite(+p.opacity))n.style.opacity=Math.max(0,Math.min(1,+p.opacity));if(p.width===null)n.style.width='';else if(Number.isFinite(+p.width))n.style.width=Math.max(0,Math.min(1600,+p.width))+'px';if(p.height===null)n.style.height='';else if(Number.isFinite(+p.height))n.style.height=Math.max(0,Math.min(1200,+p.height))+'px';if(['left','center','right'].includes(p.align))n.style.textAlign=p.align;if(p.tag&&['h2','h3','p','a','button'].includes(p.tag)){const r=document.createElement(p.tag);for(const a of [...n.attributes])r.setAttribute(a.name,a.value);r.textContent=n.textContent;n.replaceWith(r);pick(r)}}});refresh()})();<\/script>`;
const CANVAS_DRAG_SCRIPT = `<script>(()=>{const selector='h1,h2,h3,h4,p,blockquote,a,button,li,img,figure,svg,span,strong,em,dialog,[role=dialog],section.ds-section,.hero,.ds-card,.item,.spotlight,.tool,.bento__cell,nav,.site-head,footer,.foot,address,form,.form,.uds-added-element';const nodes=()=>[...document.querySelectorAll(selector)].filter(n=>(n.textContent.trim()||n.matches('img,figure,svg,dialog,[role=dialog],section.ds-section,.hero,.ds-card,.item,.spotlight,.tool,.bento__cell,nav,.site-head,footer,.foot,address,form,.form,.uds-added-element'))&&(!n.children.length||/^H[1-4]$/.test(n.tagName)||n.matches('img,figure,svg,dialog,[role=dialog],section.ds-section,.hero,.ds-card,.item,.spotlight,.tool,.bento__cell,nav,.site-head,footer,.foot,address,form,.form,.uds-added-element'))&&!n.closest('.uds-arrange-tag'));const path=n=>{const parts=[];while(n&&n!==document.body){const p=n.parentElement;if(!p)return'';parts.unshift([...p.children].filter(c=>!c.classList.contains('uds-arrange-tag')).indexOf(n));n=p}return parts.join('.')};const send=(payload,keys)=>parent.postMessage(typeof payload==='string'?{type:'uds-arrange',kind:'canvas-order',group:payload,keys}:payload,'*');let drag=null;const candidate=e=>e.target.closest?.('.uds-added-element,.item,.ds-card,.spotlight,.tool,.bento__cell,[data-uds-element]')||e.target.closest?.(selector);const atPoint=(x,y,ignore=drag?.node)=>document.elementsFromPoint(x,y).map(el=>el.closest?.(selector)).find(n=>n&&n!==ignore&&nodes().includes(n));const translation=n=>{const value=getComputedStyle(n).translate;if(!value||value==='none')return[0,0];const parts=value.split(/\\s+/).map(parseFloat);return[Number.isFinite(parts[0])?parts[0]:0,Number.isFinite(parts[1])?parts[1]:0]};const dragDelta=(state,e)=>{let x=e.clientX-state.x,y=e.clientY-state.y;if(state.bounds){const minX=state.bounds.left-state.rect.left,maxX=state.bounds.right-state.rect.right,minY=state.bounds.top-state.rect.top,maxY=state.bounds.bottom-state.rect.bottom;x=maxX>=minX?Math.max(minX,Math.min(maxX,x)):0;y=maxY>=minY?Math.max(minY,Math.min(maxY,y)):0}return[x,y]};document.addEventListener('dragstart',e=>{if(drag){e.preventDefault();e.stopImmediatePropagation()}},true);nodes().forEach(n=>n.classList.add('uds-canvas-draggable'));document.addEventListener('pointerdown',e=>{const n=candidate(e);if(!n||!nodes().includes(n)||e.target.closest('.uds-arrange-tag,[contenteditable=true]')||n.matches('dialog,[role=dialog]'))return;const [baseX,baseY]=translation(n),rect=n.getBoundingClientRect(),container=n.parentElement?.closest('section,.hero,.site-head,nav,footer,.foot,main'),bounds=container?.getBoundingClientRect(),freeCanvas=n.closest('[data-uds-free-canvas]');drag={node:n,id:e.pointerId,x:e.clientX,y:e.clientY,baseX,baseY,rect,bounds:null,freeCanvas,freeSection:freeCanvas?.closest('section'),active:false};},{capture:true,passive:true});document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7)return;const n=drag.node;if(!drag.active){drag.active=true;n.classList.add('uds-canvas-dragging')}e.preventDefault();const [dx,dy]=dragDelta(drag,e);if(drag.freeCanvas&&drag.freeSection){const r=drag.freeSection.getBoundingClientRect();n.style.left=Math.max(0,Math.min(100,(e.clientX-r.left)/Math.max(1,r.width)*100))+'%';n.style.top=Math.max(0,Math.min(100,(e.clientY-r.top)/Math.max(1,r.height)*100))+'%'}else n.style.translate=Math.max(-1600,Math.min(1600,drag.baseX+dx))+'px '+Math.max(-1200,Math.min(1200,drag.baseY+dy))+'px';const target=atPoint(e.clientX,e.clientY);document.querySelectorAll('.uds-canvas-drop').forEach(x=>x.classList.remove('uds-canvas-drop'));if(target&&target!==n&&nodes().includes(target)&&target.parentElement===n.parentElement)target.classList.add('uds-canvas-drop');},{capture:true,passive:false});document.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;const state=drag;drag=null;if(!state.active)return;document.documentElement.dataset.udsCanvasDragged='1';setTimeout(()=>delete document.documentElement.dataset.udsCanvasDragged,500);const n=state.node;let target=atPoint(e.clientX,e.clientY,state.node);if(n.matches('li.item')){const sibling=nodes().find(x=>x!==n&&x.matches('li.item')&&x.parentElement===n.parentElement&&(()=>{const r=x.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom})());if(sibling)target=sibling}n.classList.remove('uds-canvas-dragging');document.querySelectorAll('.uds-canvas-drop').forEach(x=>x.classList.remove('uds-canvas-drop'));const fromSection=n.closest('section'),sourceHeader=n.closest('.site-head,nav'),toSection=target?.closest('section');if(target&&(!fromSection?Boolean(sourceHeader):true)&&toSection&&fromSection!==toSection&&!n.matches('section,.hero')){const rect=toSection.getBoundingClientRect();send({type:'uds-canvas-move',key:n.dataset.udsEditKey,elementId:n.closest('[data-uds-element]')?.dataset.udsElement||'',fromSectionId:fromSection?(fromSection.classList.contains('hero')?'hero':fromSection.id):'header',sectionId:toSection.classList.contains('hero')?'hero':toSection.id,x:Math.max(0,Math.min(100,(e.clientX-rect.left)/Math.max(1,rect.width)*100)),y:Math.max(0,Math.min(100,(e.clientY-rect.top)/Math.max(1,rect.height)*100))});return}if(target&&toSection&&fromSection===toSection&&!n.matches('section,.hero')&&target.parentElement!==n.parentElement){const rect=toSection.getBoundingClientRect();send({type:'uds-canvas-move',key:n.dataset.udsEditKey,elementId:n.closest('[data-uds-element]')?.dataset.udsElement||'',fromSectionId:fromSection.classList.contains('hero')?'hero':fromSection.id,sectionId:fromSection.classList.contains('hero')?'hero':fromSection.id,x:Math.max(0,Math.min(100,(e.clientX-rect.left)/Math.max(1,rect.width)*100)),y:Math.max(0,Math.min(100,(e.clientY-rect.top)/Math.max(1,rect.height)*100))});return}if(state.freeCanvas&&state.freeSection&&toSection===fromSection){const rect=state.freeSection.getBoundingClientRect();send({type:'uds-canvas-move',key:n.dataset.udsEditKey,elementId:n.closest('[data-uds-element]')?.dataset.udsElement||'',fromSectionId:fromSection.classList.contains('hero')?'hero':fromSection.id,sectionId:fromSection.classList.contains('hero')?'hero':fromSection.id,x:Math.max(0,Math.min(100,(e.clientX-rect.left)/Math.max(1,rect.width)*100)),y:Math.max(0,Math.min(100,(e.clientY-rect.top)/Math.max(1,rect.height)*100))});return}if(!target||target===n||!nodes().includes(target)||target.parentElement!==n.parentElement){send({type:'uds-canvas-position',key:n.dataset.udsEditKey,translateX:Math.max(-1600,Math.min(1600,state.baseX+dragDelta(state,e)[0])),translateY:Math.max(-1200,Math.min(1200,state.baseY+dragDelta(state,e)[1]))});return}if(n.matches('li.item')&&target?.matches('li.item')&&target.parentElement===n.parentElement){const from=Number(n.dataset.udsItemIndex),to=Number(target.dataset.udsItemIndex);if(Number.isInteger(from)&&Number.isInteger(to))send({type:'uds-arrange',kind:'item',from,to});return}const siblings=nodes().filter(x=>x.parentElement===n.parentElement),rect=target.getBoundingClientRect(),layout=getComputedStyle(n.parentElement),horizontal=(layout.display==='flex'&&layout.flexDirection.startsWith('row'))||(layout.display==='grid'&&layout.gridTemplateColumns.split(' ').length>1),after=horizontal?e.clientX>rect.left+rect.width/2:e.clientY>rect.top+rect.height/2;const ordered=siblings.filter(x=>x!==n);ordered.splice(ordered.indexOf(target)+(after?1:0),0,n);const keys=ordered.map(x=>x.dataset.udsEditKey);if(keys.length<2||keys.some(k=>!/^u:[\\w-]+:\\d+$/.test(k||'')))return;send('path:'+path(n.parentElement),keys);},{capture:true,passive:true});document.addEventListener('pointercancel',()=>{if(drag?.active){drag.node.classList.remove('uds-canvas-dragging');drag.node.style.translate=drag.baseX||drag.baseY?drag.baseX+'px '+drag.baseY+'px':''}drag=null;document.querySelectorAll('.uds-canvas-drop').forEach(x=>x.classList.remove('uds-canvas-drop'));});const style=document.createElement('style');style.textContent='.uds-canvas-draggable{cursor:grab!important;touch-action:none}.uds-canvas-dragging{opacity:.45!important;cursor:grabbing!important}.uds-canvas-drop{outline:3px solid #3b6cff!important;outline-offset:3px!important}';document.head.append(style)})();<\/script>`;
const CANVAS_RESIZE_SCRIPT = `<script>(()=>{const handle=document.createElement('button');handle.type='button';handle.className='uds-arrange-tag uds-resize-handle';handle.setAttribute('aria-label','Изменить размер элемента');handle.title='Тяните, чтобы изменить размер · Shift — свободные пропорции';handle.style.cssText='position:fixed;z-index:2147483647;width:18px;height:18px;padding:0;border:2px solid #fff;border-radius:5px;background:#3478f6;box-shadow:0 1px 8px #0008;touch-action:none;cursor:nwse-resize;display:none';document.body.append(handle);let selected=null,drag=null,placeFrame=0;const schedulePlace=()=>{if(placeFrame)return;placeFrame=requestAnimationFrame(()=>{placeFrame=0;place()})};const fitPhoto=n=>{if(!n)return;const img=n.matches('img')?n:n.querySelector('img');if(!img)return;if(img===n){img.style.objectFit='cover';img.style.maxWidth='none';const frame=n.closest('figure,.uds-added-element--image,[class*="media"],[class*="image"],[class*="visual"],[class*="photo"]');if(frame&&frame!==n){frame.style.width=n.style.width;frame.style.height=n.style.height;frame.style.boxSizing='border-box';frame.style.overflow='hidden';frame.style.background='transparent';if(frame.querySelector(':scope > figcaption'))n.style.height='calc(100% - 2.5em)'}return}if(!n.matches('figure,.uds-added-element--image')&&n.children.length>1)return;n.style.overflow='hidden';n.style.background='transparent';img.style.width='100%';img.style.height=n.querySelector(':scope > figcaption')?'calc(100% - 2.5em)':'100%';img.style.maxWidth='none';img.style.maxHeight='none';img.style.objectFit='cover';img.style.display='block'};const place=()=>{if(!selected){handle.style.display='none';return}if(drag)return;const r=selected.getBoundingClientRect();handle.style.left=Math.max(0,Math.min(innerWidth-18,r.right-9))+'px';handle.style.top=Math.max(0,Math.min(innerHeight-18,r.bottom-9))+'px';handle.style.display='block'};const observer=new MutationObserver(()=>{const next=document.querySelector('.uds-edit-selected');if(next!==selected){selected=next;place()}});observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});addEventListener('scroll',schedulePlace,true);addEventListener('resize',schedulePlace);handle.addEventListener('pointerdown',e=>{if(!selected||e.button!==0)return;e.preventDefault();e.stopPropagation();const r=selected.getBoundingClientRect(),photo=selected.matches('img,figure')||Boolean(selected.querySelector('img'));drag={id:e.pointerId,node:selected,x:e.clientX,y:e.clientY,width:r.width,height:r.height,ratio:r.width/Math.max(1,r.height),photo,display:getComputedStyle(selected).display,scrollX,scrollY};handle.setPointerCapture(e.pointerId);parent.postMessage({type:'uds-canvas-resize-start'},'*')});handle.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();let width=Math.max(40,Math.min(1600,drag.width+e.clientX-drag.x)),height=Math.max(24,Math.min(1200,drag.height+e.clientY-drag.y));if(drag.photo&&!e.shiftKey)height=Math.max(24,Math.min(1200,width/drag.ratio));const n=drag.node;if(drag.display==='inline')n.style.display='inline-block';n.style.boxSizing='border-box';n.style.width=width+'px';n.style.height=height+'px';fitPhoto(n);const r=n.getBoundingClientRect();handle.style.left=Math.max(0,Math.min(innerWidth-18,r.right-9))+'px';handle.style.top=Math.max(0,Math.min(innerHeight-18,r.bottom-9))+'px'});const finish=e=>{if(!drag||(e.pointerId!=null&&e.pointerId!==drag.id))return;const state=drag;drag=null;parent.postMessage({type:'uds-canvas-resize-end'},'*');const r=state.node.getBoundingClientRect();parent.postMessage({type:'uds-canvas-resize',key:state.node.dataset.udsEditKey,width:Math.round(r.width),height:Math.round(r.height),boxSizing:'border-box',scrollX:state.scrollX,scrollY:state.scrollY},'*');place()};handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);addEventListener('pointerup',finish,true);addEventListener('pointercancel',finish,true);})();<\/script>`;
const PREVIEW_SCROLL_SCRIPT = `<script>(()=>{let timer=0;addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(()=>parent.postMessage({type:'uds-canvas-scroll',x:scrollX,y:scrollY},'*'),40)},{passive:true});const afterLayout=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));Promise.resolve(document.fonts?.ready).then(afterLayout).then(()=>parent.postMessage({type:'uds-canvas-preview-ready'},'*'));addEventListener('message',e=>{const m=e.data;if(m?.type!=='uds-canvas-restore-scroll'||!Number.isFinite(m.x)||!Number.isFinite(m.y))return;const x=Math.max(0,m.x),y=Math.max(0,m.y);Promise.resolve(document.fonts?.ready).then(afterLayout).then(()=>{const style=document.documentElement.style,previous=style.getPropertyValue('scroll-behavior'),priority=style.getPropertyPriority('scroll-behavior'),anchor=style.getPropertyValue('overflow-anchor'),anchorPriority=style.getPropertyPriority('overflow-anchor');style.setProperty('scroll-behavior','auto','important');style.setProperty('overflow-anchor','none','important');document.documentElement.getBoundingClientRect();scrollTo({left:x,top:y,behavior:'instant'});requestAnimationFrame(()=>requestAnimationFrame(()=>{if(previous)style.setProperty('scroll-behavior',previous,priority);else style.removeProperty('scroll-behavior');if(anchor)style.setProperty('overflow-anchor',anchor,anchorPriority);else style.removeProperty('overflow-anchor');parent.postMessage({type:'uds-canvas-scroll-restored',x:scrollX,y:scrollY,targetX:x,targetY:y},'*')}))})})})();<\/script>`;
function previewHtml(html) {
  const scripts = PREVIEW_SCROLL_SCRIPT + (arrangeMode ? ARRANGE_SCRIPT + CANVAS_DRAG_SCRIPT + CANVAS_SCRIPT + CANVAS_RESIZE_SCRIPT : '');
  return html.replace(/<\/body>(?![\s\S]*<\/body>)/, scripts + '</body>');
}
let canvasAspectRatio = 0;
let selectedCanvasKey = '';
let activeCanvasBreakpoint = 'all';
let canvasInspectorOpen = false;
let canvasStyleClipboard = null;
let canvasPositionClipboard = null;
let pendingCanvasBlockId = '';
let pendingCanvasDuplicateKey = '';
let pendingCanvasElementId = '';
let pendingCanvasImageTarget = null;
let selectedCanvasMeta = null;
const canvasUndo = [], canvasRedo = [];
const canvasSnapshot = () => JSON.stringify(state.raw);
let canvasFormBefore = null;
$('#form').addEventListener('focusin', e => { if (e.target.matches('input,select,textarea')) canvasFormBefore = canvasSnapshot(); });
$('#form').addEventListener('focusout', e => {
  if (!e.target.matches('input,select,textarea') || (e.relatedTarget && $('#form').contains(e.relatedTarget))) return;
  const before = canvasFormBefore; canvasFormBefore = null;
  setTimeout(() => { if (before && before !== canvasSnapshot()) { canvasUndo.push(before); if (canvasUndo.length > 60) canvasUndo.shift(); canvasRedo.length = 0; refreshCanvasHistory(); } }, 0);
});
function refreshCanvasHistory() {
  $('#canvas-undo').disabled = !canvasUndo.length;
  $('#canvas-redo').disabled = !canvasRedo.length;
}
const RESPONSIVE_CANVAS_KEYS = new Set(['width', 'height', 'fontSize', 'rotation', 'translateX', 'translateY', 'opacity', 'align', 'color', 'background', 'shape', 'animation', 'elementStyle', 'buttonStyle']);
function canvasEditForBreakpoint(key, breakpoint = activeCanvasBreakpoint) {
  const edit = { ...(state.raw.canvasEdits?.[key] || {}) };
  if (breakpoint === 'all') return edit;
  const responsive = state.raw.canvasResponsiveEdits || {};
  for (const range of ['desktop', 'tablet', 'mobile']) {
    Object.assign(edit, responsive[range]?.[key] || {});
    if (range === breakpoint) break;
  }
  return edit;
}
function storeCanvasEditPatch(key, patch, breakpoint = activeCanvasBreakpoint) {
  const responsivePatch = breakpoint === 'all' ? {} : Object.fromEntries(Object.entries(patch).filter(([name]) => RESPONSIVE_CANVAS_KEYS.has(name)));
  const globalPatch = { ...patch };
  for (const name of Object.keys(responsivePatch)) delete globalPatch[name];
  if (Object.keys(globalPatch).length) state.raw.canvasEdits = { ...(state.raw.canvasEdits || {}), [key]: { ...(state.raw.canvasEdits?.[key] || {}), ...globalPatch } };
  if (Object.keys(responsivePatch).length) {
    // Keep an empty global entry so the shared canvas runtime assigns a stable DOM key before responsive styles run.
    if (!state.raw.canvasEdits?.[key]) state.raw.canvasEdits = { ...(state.raw.canvasEdits || {}), [key]: {} };
    const responsive = { ...(state.raw.canvasResponsiveEdits || {}) };
    responsive[breakpoint] = { ...(responsive[breakpoint] || {}), [key]: { ...(responsive[breakpoint]?.[key] || {}), ...responsivePatch } };
    state.raw.canvasResponsiveEdits = responsive;
  }
}
function canvasColorHex(value, fallback) {
  if (/^#[\da-f]{6}$/i.test(value || '')) return value;
  const match = String(value || '').match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?/i);
  if (!match || (match[4] !== undefined && Number(match[4]) < .15)) return fallback;
  return '#' + match.slice(1, 4).map(channel => Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, '0')).join('');
}
function rememberCanvasChange() {
  canvasUndo.push(canvasSnapshot()); if (canvasUndo.length > 60) canvasUndo.shift();
  canvasRedo.length = 0; refreshCanvasHistory();
}
function refreshCanvasOverlapLayers(sectionId = selectedCanvasMeta?.sectionId) {
  const row = $('#canvas-overlap-list-row'), select = $('#canvas-overlap-layers');
  const entries = Object.entries(state.raw.canvasMoves || {}).filter(([, move]) => move?.sectionId === sectionId)
    .sort(([keyA], [keyB]) => (Number(state.raw.canvasEdits?.[keyB]?.zIndex) || 0) - (Number(state.raw.canvasEdits?.[keyA]?.zIndex) || 0));
  row.hidden = !sectionId || entries.length < 2;
  const labels = new Map([...$('#canvas-layers').options].map(option => [option.value, option.textContent]));
  select.replaceChildren(...entries.map(([key], index) => new Option(`${index + 1}. ${labels.get(key) || key}`, key, false, key === selectedCanvasKey)));
}
function setCanvasSelection(info) {
  if (!info || !/^(?:\d+(?:\.\d+)*|u:[\w-]+:\d+)$/.test(info.key || '')) return;
  selectedCanvasKey = info.key; selectedCanvasMeta = info;
  const edit = canvasEditForBreakpoint(selectedCanvasKey);
  const customElement = info.elementId && info.sectionId
    ? (state.raw.canvasElements?.[info.sectionId] || []).find(item => item.id === info.elementId)
    : null;
  $('#canvas-inspector').hidden = !canvasInspectorOpen;
  $('#canvas-selected-label').textContent = info.label || info.tag || 'Элемент';
  $('#canvas-breakpoint').value = activeCanvasBreakpoint;
  $('#canvas-options-trigger').hidden = false;
  const textless = ['img','figure','svg','dialog'].includes(info.tag) && !customElement;
  $('#canvas-text').closest('label').hidden = textless || (info.layout && !customElement);
  $('#canvas-font-size-field').hidden = textless || (info.layout && !customElement);
  $('#canvas-button-style-field').hidden = !(info.button || customElement?.type === 'button');
  const linkElement = info.tag === 'a' || customElement?.type === 'button';
  $('#canvas-href-field').hidden = !linkElement;
  $('#canvas-href').value = edit.href ?? customElement?.href ?? info.href ?? '';
  const photoElement = ['img','figure'].includes(info.tag) || customElement?.type === 'image';
  $('#canvas-element-style-field').hidden = Boolean(info.button || customElement?.type === 'button');
  const elementStyles = photoElement
    ? [['inherit','По умолчанию'],['photo-frame','Фоторамка'],['polaroid','Полароид'],['monochrome','Чёрно-белое'],['warm','Тёплый тон'],['cinematic','Кинематографичное']]
    : [['inherit','По умолчанию'],['soft','Мягкая карточка'],['outline','Контур'],['glass','Стекло'],['accent','Акцентная заливка'],['quote','Цитата']];
  const elementStyle = $('#canvas-element-style');
  elementStyle.replaceChildren(...elementStyles.map(([value,label]) => new Option(label,value)));
  elementStyle.value = elementStyles.some(([value]) => value === edit.elementStyle) ? edit.elementStyle : 'inherit';
  const shapeControl = $('#canvas-shape');
  const shapeOptions = photoElement
    ? [['auto', 'Прямоугольник со скруглением']]
    : [['auto', 'По умолчанию'], ['square', 'Прямые углы'], ['soft', 'Мягкие углы'], ['round', 'Скруглённый'], ['pill', 'Капсула'], ['circle', 'Круглая маска']];
  shapeControl.replaceChildren(...shapeOptions.map(([value, label]) => new Option(label, value)));
  shapeControl.disabled = photoElement;
  shapeControl.value = photoElement ? 'auto' : edit.shape || 'auto';
  $('#canvas-button-style').value = edit.buttonStyle || 'inherit';
  $('#canvas-animation').value = edit.animation || 'none';
  $('#canvas-text').value = edit.text ?? (customElement
    ? (customElement.type === 'card' && info.tag !== 'h3' ? customElement.text : customElement.title || customElement.text)
    : info.text) ?? '';
  $('#canvas-alt-field').hidden = info.tag !== 'img' && customElement?.type !== 'image';
  $('#canvas-alt').value = edit.alt ?? info.alt ?? customElement?.alt ?? '';
  $('#canvas-color').value = canvasColorHex(edit.color || info.color, '#202329');
  $('#canvas-background').value = canvasColorHex(edit.background || info.background, '#ffffff');
  const size = Number(edit.fontSize || info.fontSize || 24);
  $('#canvas-size').value = String(Math.max(12, Math.min(96, size)));
  $('#canvas-size-out').value = `${$('#canvas-size').value} px`;
  const opacity = Math.max(0, Math.min(1, Number(edit.opacity ?? info.opacity ?? 1)));
  $('#canvas-opacity').value = String(Math.round(opacity * 100));
  $('#canvas-opacity-out').value = `${$('#canvas-opacity').value}%`;
  $('#canvas-width').value = edit.width ?? Math.round(info.rect?.width || 0);
  $('#canvas-height').value = edit.height ?? Math.round(info.rect?.height || 0);
  const currentWidth = Number($('#canvas-width').value), currentHeight = Number($('#canvas-height').value);
  canvasAspectRatio = currentWidth > 0 && currentHeight > 0 ? currentWidth / currentHeight : 0;
  const rotation = Math.max(-45, Math.min(45, Number(edit.rotation || 0)));
  $('#canvas-rotation').value = String(rotation);
  $('#canvas-rotation-out').value = `${rotation}°`;
  const offsetX = Number(edit.translateX || 0);
  const offsetY = Number(edit.translateY || 0);
  $('#canvas-offset-x').value = String(Math.max(-1600, Math.min(1600, Number.isFinite(offsetX) ? offsetX : 0)));
  $('#canvas-offset-y').value = String(Math.max(-1200, Math.min(1200, Number.isFinite(offsetY) ? offsetY : 0)));
  const placementRow = $('#canvas-block-placement-row');
  placementRow.hidden = !info.blockId;
  if (info.blockId) {
    const block = (state.raw.canvasBlocks || []).find(item => item.id === info.blockId);
    const available = result?.concept?.homepage?.sectionOrder || [];
    const labels = { about: 'О нас', items: 'Каталог', advantages: 'Преимущества', process: 'Этапы работы', gallery: 'Галерея', faq: 'Вопросы и ответы' };
    const positions = [['hero', 'Первый экран'], ...available.filter(id => id !== 'contact').map(id => [id, labels[id] || id]), ['contact', 'Перед контактами']];
    const select = $('#canvas-block-placement');
    select.replaceChildren(...positions.map(([value, label]) => new Option(label, value)));
    select.value = positions.some(([value]) => value === block?.after) ? block.after : 'contact';
  }
  const layer = $('#canvas-layers');
  for (const option of layer.options) option.selected = option.value === selectedCanvasKey;
  refreshCanvasOverlapLayers(info.sectionId);
  $('#canvas-paste-style').disabled = !canvasStyleClipboard;
  $('#canvas-paste-position').disabled = !canvasPositionClipboard;
  $('#canvas-reset-edit').disabled = !state.raw.canvasEdits?.[selectedCanvasKey] && !['desktop','tablet','mobile'].some(range => state.raw.canvasResponsiveEdits?.[range]?.[selectedCanvasKey]);
  $('#canvas-reset-breakpoint').disabled = activeCanvasBreakpoint === 'all' || !state.raw.canvasResponsiveEdits?.[activeCanvasBreakpoint]?.[selectedCanvasKey];
  const moved = Boolean(state.raw.canvasMoves?.[selectedCanvasKey]);
  $('#canvas-layer-actions').hidden = !moved && !info.sectionId;
  $('#canvas-bring-front').hidden = !moved; $('#canvas-send-back').hidden = !moved;
  $('#canvas-menu').querySelectorAll('[data-canvas-menu^="tag-"]').forEach(button => { button.disabled = ['img','figure','svg','dialog'].includes(info.tag)||info.layout; });
  $('#canvas-menu').querySelectorAll('[data-canvas-menu^="align-"]').forEach(button => { button.disabled = ['img','figure','svg','dialog'].includes(info.tag)||info.layout; });
  $('#canvas-menu').querySelectorAll('[data-canvas-menu^="replace-"]').forEach(button => { button.disabled = !info.sectionId || (info.layout && !info.elementId); });
}
function canvasPreview(patch) {
  $('#frame').contentWindow?.postMessage({ type: 'uds-canvas-preview', key: selectedCanvasKey, patch }, '*');
}
function safeCanvasHref(value) {
  const href = String(value ?? '').trim().slice(0, 2048);
  return /^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href) ? href : '';
}
function commitCanvasEdit(patch) {
  if (!selectedCanvasKey) return;
  if (typeof patch.href === 'string') {
    patch = { ...patch, href: safeCanvasHref(patch.href) };
    if (!patch.href) { toast('Укажите http(s)-адрес, почту, телефон или якорь #раздел'); return; }
  }
  if (selectedCanvasMeta?.elementId && selectedCanvasMeta?.sectionId && (typeof patch.text === 'string' || typeof patch.alt === 'string' || typeof patch.href === 'string')) {
    const sectionId = selectedCanvasMeta.sectionId, elementId = selectedCanvasMeta.elementId;
    const items = [...(state.raw.canvasElements?.[sectionId] || [])];
    const index = items.findIndex(item => item.id === elementId);
    if (index >= 0) {
      const item = { ...items[index] };
      if (typeof patch.alt === 'string') item.alt = patch.alt.slice(0, 240);
      if (typeof patch.href === 'string' && item.type === 'button') item.href = patch.href;
      if (typeof patch.text === 'string') {
        if (item.type === 'button' || item.type === 'image' || item.type === 'heading' || /^h[1-4]$/.test(selectedCanvasMeta.tag || '') || selectedCanvasMeta.tag === 'figcaption') item.title = patch.text.slice(0, 180);
        else item.text = patch.text.slice(0, 1200);
      }
      items[index] = item; rememberCanvasChange();
      state.raw.canvasElements = { ...(state.raw.canvasElements || {}), [sectionId]: items };
      run(); return;
    }
  }
  rememberCanvasChange();
  storeCanvasEditPatch(selectedCanvasKey, patch);
  run();
}
function addCanvasBlock(type = 'text') {
  rememberCanvasChange();
  const names = { text: ['Новый раздел', 'Добавьте содержание этого блока.'], quote: ['Цитата', 'Ваша цитата появится здесь.'], features: ['Преимущества', 'Коротко расскажите, чем вы полезны.'], cta: ['Следующий шаг', 'Подскажите посетителю, что сделать дальше.'] };
  const [title, text] = names[type] || names.text;
  const id = `canvas-${Date.now().toString(36)}`;
  state.raw.canvasBlocks = [...(state.raw.canvasBlocks || []), { id, type, title, text }];
  pendingCanvasBlockId = id;
  run(); toast('Блок добавлен перед контактами');
}
function addCanvasElement(type, sectionId, alreadyRemembered = false) {
  if (!sectionId || !['card', 'button', 'image', 'text', 'heading'].includes(type)) { toast('Сначала выберите секцию, куда добавить элемент'); return; }
  const id = `element-${Date.now().toString(36)}`;
  const item = type === 'button'
    ? { id, type, title: 'Новая кнопка', text: '', href: '#contact' }
    : type === 'image'
      ? { id, type, title: 'Новое фото', alt: 'Иллюстрация к секции', src: '' }
      : { id, type: 'card', title: 'Новая карточка', text: 'Добавьте описание карточки.' };
  if (!alreadyRemembered) rememberCanvasChange();
  state.raw.canvasElements = { ...(state.raw.canvasElements || {}), [sectionId]: [...(state.raw.canvasElements?.[sectionId] || []), item] };
  pendingCanvasElementId = id;
  if (type === 'image') pendingCanvasImageTarget = { sectionId, id };
  run();
  if (type === 'image') $('#canvas-element-image-file').click();
  toast(type === 'image' ? 'Выберите изображение для секции' : 'Элемент добавлен в выбранную секцию');
}
function executeCanvasCommand() {
  const input = $('#canvas-command');
  const command = input.value.trim();
  const add = command.match(/^(?:добавь|добавить|вставь)\s+(текст|заголовок)\s*:\s*(.+)$/i);
  if (add) {
    const sectionId = selectedCanvasMeta?.sectionId;
    if (!sectionId) { toast('Сначала выберите секцию на холсте, затем повторите команду'); return; }
    const id = `element-${Date.now().toString(36)}`;
    const value = add[2].slice(0, 1200);
    const item = add[1].toLowerCase() === 'заголовок'
      ? { id, type: 'heading', title: value, text: '' }
      : { id, type: 'text', title: '', text: value };
    rememberCanvasChange();
    state.raw.canvasElements = { ...(state.raw.canvasElements || {}), [sectionId]: [...(state.raw.canvasElements?.[sectionId] || []), item] };
    pendingCanvasElementId = id; run(); input.value = '';
    toast(add[1].toLowerCase() === 'заголовок' ? 'Заголовок добавлен и выделен' : 'Текст добавлен и выделен');
    return;
  }
  if (/^(?:убери|скрой)\s+(?:выбранный элемент|выбранный|элемент|иллюстрацию|фото)$/i.test(command)) {
    if (!selectedCanvasKey) { toast('Сначала выберите элемент, который нужно скрыть'); return; }
    rememberCanvasChange();
    state.raw.canvasEdits = { ...(state.raw.canvasEdits || {}), [selectedCanvasKey]: { ...(state.raw.canvasEdits?.[selectedCanvasKey] || {}), hidden: true } };
    run(); toast('Элемент скрыт; его настройки сохранены. Выберите его в списке слоёв, чтобы вернуть.');
    return;
  }
  if (/^(?:верни|покажи)\s+(?:выбранный элемент|выбранный|элемент|иллюстрацию|фото)$/i.test(command)) {
    if (!selectedCanvasKey) { toast('Выберите скрытый элемент в списке слоёв, чтобы вернуть его'); return; }
    rememberCanvasChange();
    state.raw.canvasEdits = { ...(state.raw.canvasEdits || {}), [selectedCanvasKey]: { ...(state.raw.canvasEdits?.[selectedCanvasKey] || {}), hidden: false } };
    run(); toast('Элемент восстановлен с прежними настройками');
    return;
  }
  toast('Команда не распознана. Примеры: «Добавь текст: …», «Добавь заголовок: …», «Скрой выбранный элемент», «Верни выбранный элемент».');
}
function replaceCanvasElement(type) {
  const sectionId = selectedCanvasMeta?.sectionId;
  if (!sectionId || !['card', 'button', 'image'].includes(type)) { toast('Выберите элемент внутри секции'); return; }
  const text = String(selectedCanvasMeta.text || selectedCanvasMeta.label || '').trim().slice(0, 180);
  rememberCanvasChange();
  if (selectedCanvasMeta.elementId) {
    const items = [...(state.raw.canvasElements?.[sectionId] || [])];
    const index = items.findIndex(item => item.id === selectedCanvasMeta.elementId);
    if (index < 0) return;
    const previous = items[index];
    const title = String(previous.title || previous.text || text || 'Новый элемент').slice(0, 180);
    const replacement = type === 'image'
      ? { id: previous.id, type, title, alt: previous.alt || text || 'Иллюстрация к секции', src: '' }
      : type === 'button'
        ? { id: previous.id, type, title, text: '', href: previous.href || '#contact' }
        : { id: previous.id, type, title, text: previous.text || text || 'Добавьте описание карточки.' };
    items[index] = replacement;
    state.raw.canvasElements = { ...(state.raw.canvasElements || {}), [sectionId]: items };
    pendingCanvasElementId = replacement.id;
    if (type === 'image') pendingCanvasImageTarget = { sectionId, id: replacement.id };
    run();
    if (type === 'image') $('#canvas-element-image-file').click();
    toast(type === 'image' ? 'Элемент заменён. Выберите фото' : 'Элемент заменён');
    return;
  }
  state.raw.canvasEdits = { ...(state.raw.canvasEdits || {}), [selectedCanvasKey]: { ...(state.raw.canvasEdits?.[selectedCanvasKey] || {}), deleted: true } };
  addCanvasElement(type, sectionId, true);
}
function restoreCanvasSnapshot(snapshot, from, to) {
  to.push(canvasSnapshot());
  state.raw = JSON.parse(snapshot);
  from.pop(); refreshCanvasHistory(); run(); buildForm();
}
$('#canvas-text').addEventListener('input', e => canvasPreview({ text: e.target.value }));
$('#canvas-text').addEventListener('change', e => commitCanvasEdit({ text: e.target.value }));
$('#canvas-alt').addEventListener('input', e => canvasPreview({ alt: e.target.value }));
const commitCanvasAlt = () => {
  const value = $('#canvas-alt').value.slice(0, 240);
  const custom = selectedCanvasMeta?.elementId && selectedCanvasMeta?.sectionId
    ? (state.raw.canvasElements?.[selectedCanvasMeta.sectionId] || []).find(item => item.id === selectedCanvasMeta.elementId)?.alt
    : undefined;
  const existing = custom ?? canvasEditForBreakpoint(selectedCanvasKey).alt ?? selectedCanvasMeta?.alt ?? '';
  if (value !== existing) commitCanvasEdit({ alt: value });
};
$('#canvas-alt').addEventListener('change', commitCanvasAlt);
$('#canvas-alt').addEventListener('blur', commitCanvasAlt);
$('#canvas-href').addEventListener('input', e => canvasPreview({ href: safeCanvasHref(e.target.value) }));
$('#canvas-href').addEventListener('change', e => commitCanvasEdit({ href: e.target.value }));
$('#canvas-color').addEventListener('input', e => canvasPreview({ color: e.target.value }));
$('#canvas-color').addEventListener('change', e => commitCanvasEdit({ color: e.target.value }));
$('#canvas-background').addEventListener('input', e => canvasPreview({ background: e.target.value }));
$('#canvas-background').addEventListener('change', e => commitCanvasEdit({ background: e.target.value }));
$('#canvas-size').addEventListener('input', e => { $('#canvas-size-out').value = `${e.target.value} px`; canvasPreview({ fontSize: Number(e.target.value) }); });
$('#canvas-size').addEventListener('change', e => commitCanvasEdit({ fontSize: Number(e.target.value) }));
$('#canvas-opacity').addEventListener('input', e => { $('#canvas-opacity-out').value = `${e.target.value}%`; canvasPreview({ opacity: Number(e.target.value) / 100 }); });
$('#canvas-opacity').addEventListener('change', e => commitCanvasEdit({ opacity: Math.max(0, Math.min(1, Number(e.target.value) / 100)) }));
function canvasDimensionPreview(axis, raw) {
  const parse = value => value === '' ? null : Math.max(0, Number(value));
  let width = parse(axis === 'width' ? raw : $('#canvas-width').value);
  let height = parse(axis === 'height' ? raw : $('#canvas-height').value);
  if ($('#canvas-lock-ratio').checked && canvasAspectRatio > 0) {
    if (axis === 'width' && width !== null) { height = Math.min(1200, Math.round(width / canvasAspectRatio)); $('#canvas-height').value = String(height); }
    if (axis === 'height' && height !== null) { width = Math.min(1600, Math.round(height * canvasAspectRatio)); $('#canvas-width').value = String(width); }
  }
  return { width, height };
}
$('#canvas-width').addEventListener('input', e => canvasPreview(canvasDimensionPreview('width', e.target.value)));
$('#canvas-height').addEventListener('input', e => canvasPreview(canvasDimensionPreview('height', e.target.value)));
$('#canvas-lock-ratio').addEventListener('change', () => {
  const width = Number($('#canvas-width').value), height = Number($('#canvas-height').value);
  canvasAspectRatio = width > 0 && height > 0 ? width / height : 0;
});
$('#canvas-width').addEventListener('change', e => {
  const width = e.target.value === '' ? null : Math.max(0, Math.min(1600, Number(e.target.value)));
  const height = $('#canvas-lock-ratio').checked && canvasAspectRatio > 0 && width !== null ? Math.max(0, Math.min(1200, Math.round(width / canvasAspectRatio))) : ($('#canvas-height').value === '' ? null : Number($('#canvas-height').value));
  if (height !== null && $('#canvas-lock-ratio').checked) $('#canvas-height').value = String(height);
  commitCanvasEdit({ width, ...(height !== null && $('#canvas-lock-ratio').checked ? { height } : {}) });
});
$('#canvas-height').addEventListener('change', e => {
  const height = e.target.value === '' ? null : Math.max(0, Math.min(1200, Number(e.target.value)));
  const width = $('#canvas-lock-ratio').checked && canvasAspectRatio > 0 && height !== null ? Math.max(0, Math.min(1600, Math.round(height * canvasAspectRatio))) : ($('#canvas-width').value === '' ? null : Number($('#canvas-width').value));
  if (width !== null && $('#canvas-lock-ratio').checked) $('#canvas-width').value = String(width);
  commitCanvasEdit({ height, ...(width !== null && $('#canvas-lock-ratio').checked ? { width } : {}) });
});
$('#canvas-rotation').addEventListener('input', e => { $('#canvas-rotation-out').value = `${e.target.value}°`; canvasPreview({ rotation: Number(e.target.value) }); });
$('#canvas-rotation').addEventListener('change', e => commitCanvasEdit({ rotation: Math.max(-45, Math.min(45, Number(e.target.value))) }));
$('#canvas-bring-front').addEventListener('click', () => { const sectionId=state.raw.canvasMoves?.[selectedCanvasKey]?.sectionId; if(!sectionId)return; const values=Object.entries(state.raw.canvasMoves||{}).filter(([,m])=>m.sectionId===sectionId).map(([key])=>Number(state.raw.canvasEdits?.[key]?.zIndex)||0); commitCanvasEdit({zIndex:Math.min(100,Math.max(0,...values)+1)}); });
$('#canvas-send-back').addEventListener('click', () => { const sectionId=state.raw.canvasMoves?.[selectedCanvasKey]?.sectionId; if(!sectionId)return; const values=Object.entries(state.raw.canvasMoves||{}).filter(([,m])=>m.sectionId===sectionId).map(([key])=>Number(state.raw.canvasEdits?.[key]?.zIndex)||0); commitCanvasEdit({zIndex:Math.max(-100,Math.min(0,...values)-1)}); });
$('#canvas-fan-five').addEventListener('click', () => { const sectionId=selectedCanvasMeta?.sectionId || state.raw.canvasMoves?.[selectedCanvasKey]?.sectionId; if(!sectionId){toast('Выберите секцию для веера фотографий');return;} $('#frame').contentWindow?.postMessage({type:'uds-canvas-arrange-fan',sectionId},'*'); });
function canvasOffsetValues(axis, value) {
  const parse = (raw, limit) => Math.max(-limit, Math.min(limit, Number.isFinite(Number(raw)) ? Number(raw) : 0));
  const x = parse(axis === 'x' ? value : $('#canvas-offset-x').value, 1600);
  const y = parse(axis === 'y' ? value : $('#canvas-offset-y').value, 1200);
  return { translateX: x, translateY: y };
}
$('#canvas-offset-x').addEventListener('input', e => canvasPreview(canvasOffsetValues('x', e.target.value)));
$('#canvas-offset-y').addEventListener('input', e => canvasPreview(canvasOffsetValues('y', e.target.value)));
$('#canvas-offset-x').addEventListener('change', e => commitCanvasEdit(canvasOffsetValues('x', e.target.value)));
$('#canvas-offset-y').addEventListener('change', e => commitCanvasEdit(canvasOffsetValues('y', e.target.value)));
$('#canvas-shape').addEventListener('change', e => commitCanvasEdit({ shape: e.target.value }));
$('#canvas-element-style').addEventListener('change', e => commitCanvasEdit({ elementStyle: e.target.value }));
$('#canvas-button-style').addEventListener('change', e => commitCanvasEdit({ buttonStyle: e.target.value }));
$('#canvas-animation').addEventListener('change', e => commitCanvasEdit({ animation: e.target.value }));
$('#canvas-breakpoint').addEventListener('change', e => {
  activeCanvasBreakpoint = e.target.value;
  const widths = { all: '', desktop: '1280', tablet: '768', mobile: '390' };
  const width = widths[activeCanvasBreakpoint];
  $('#frame').style.width = width ? width + 'px' : '100%';
  $('#view-preview').classList.toggle('sized', Boolean(width));
  $('#preview-custom-width').value = '';
  document.querySelectorAll('.sizes button').forEach(button => button.setAttribute('aria-pressed', button.dataset.w === width));
  selectTab($('#tab-preview'));
  if (selectedCanvasKey) setTimeout(() => $('#frame').contentWindow?.postMessage({ type: 'uds-canvas-select-key', key: selectedCanvasKey }, '*'), 80);
});
$('#canvas-options-trigger').addEventListener('click', () => { if (!selectedCanvasKey || !arrangeMode) return; canvasInspectorOpen = true; $('#canvas-inspector').hidden = false; $('#canvas-inspector').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); ($('#canvas-text').closest('label').hidden ? $('#canvas-shape') : $('#canvas-text')).focus({ preventScroll: true }); });
$('#canvas-copy-position').addEventListener('click', () => {
  if (!selectedCanvasKey) return;
  const edit = canvasEditForBreakpoint(selectedCanvasKey);
  canvasPositionClipboard = { translateX: Number(edit.translateX || 0), translateY: Number(edit.translateY || 0) };
  $('#canvas-paste-position').disabled = false;
  toast('Положение скопировано');
});
$('#canvas-paste-position').addEventListener('click', () => {
  if (!canvasPositionClipboard || !selectedCanvasKey) return;
  $('#canvas-offset-x').value = String(canvasPositionClipboard.translateX);
  $('#canvas-offset-y').value = String(canvasPositionClipboard.translateY);
  commitCanvasEdit({ ...canvasPositionClipboard });
  toast('Положение применено');
});
$('#canvas-copy-style').addEventListener('click', () => {
  if (!selectedCanvasKey || !selectedCanvasMeta) return;
  const edit = canvasEditForBreakpoint(selectedCanvasKey);
  const align = edit.align || selectedCanvasMeta.align;
  canvasStyleClipboard = {
    color: edit.color || canvasColorHex(selectedCanvasMeta.color, '#202329'),
    background: edit.background || canvasColorHex(selectedCanvasMeta.background, '#ffffff'),
    fontSize: Math.max(12, Math.min(96, Number(edit.fontSize || selectedCanvasMeta.fontSize || 24))),
    ...( ['left', 'center', 'right'].includes(align) ? { align } : {}),
    ...( ['square', 'soft', 'round', 'pill', 'circle'].includes(edit.shape) ? { shape: edit.shape } : {}),
    ...( ['soft', 'outline', 'glass', 'accent', 'quote', 'photo-frame', 'polaroid', 'monochrome', 'warm', 'cinematic'].includes(edit.elementStyle) ? { elementStyle: edit.elementStyle } : {}),
    ...( ['solid', 'outline', 'ghost', 'gradient', 'glass', 'glow'].includes(edit.buttonStyle) ? { buttonStyle: edit.buttonStyle } : {}),
    ...( ['none', 'fade', 'rise', 'float', 'pulse', 'glow', 'tilt'].includes(edit.animation) ? { animation: edit.animation } : {}),
    ...(Number.isFinite(Number(edit.opacity)) ? { opacity: Math.max(0, Math.min(1, Number(edit.opacity))) } : {}),
  };
  $('#canvas-paste-style').disabled = false;
  toast('Стиль скопирован');
});
$('#canvas-paste-style').addEventListener('click', () => {
  if (!canvasStyleClipboard || !selectedCanvasKey) return;
  commitCanvasEdit({ ...canvasStyleClipboard });
  toast('Стиль применён');
});
$('#canvas-reset-edit').addEventListener('click', () => {
  if (!selectedCanvasKey) return;
  rememberCanvasChange();
  const edits = { ...state.raw.canvasEdits };
  delete edits[selectedCanvasKey];
  if (Object.keys(edits).length) state.raw.canvasEdits = edits;
  else delete state.raw.canvasEdits;
  const responsive = { ...(state.raw.canvasResponsiveEdits || {}) };
  for (const range of ['desktop','tablet','mobile']) {
    const bucket = { ...(responsive[range] || {}) };
    delete bucket[selectedCanvasKey];
    if (Object.keys(bucket).length) responsive[range] = bucket; else delete responsive[range];
  }
  if (Object.keys(responsive).length) state.raw.canvasResponsiveEdits = responsive; else delete state.raw.canvasResponsiveEdits;
  run();
  toast('Правки элемента сброшены');
});
$('#canvas-reset-breakpoint').addEventListener('click', () => {
  if (!selectedCanvasKey || activeCanvasBreakpoint === 'all') return;
  rememberCanvasChange();
  const responsive = { ...(state.raw.canvasResponsiveEdits || {}) };
  const bucket = { ...(responsive[activeCanvasBreakpoint] || {}) };
  delete bucket[selectedCanvasKey];
  if (Object.keys(bucket).length) responsive[activeCanvasBreakpoint] = bucket; else delete responsive[activeCanvasBreakpoint];
  if (Object.keys(responsive).length) state.raw.canvasResponsiveEdits = responsive; else delete state.raw.canvasResponsiveEdits;
  run();
  $('#canvas-reset-breakpoint').disabled = true;
  toast('Переопределение экрана сброшено; применены унаследованные настройки');
});
$('#canvas-block-placement').addEventListener('change', e => {
  const blockId = selectedCanvasMeta?.blockId;
  if (!blockId) return;
  rememberCanvasChange();
  state.raw.canvasBlocks = (state.raw.canvasBlocks || []).map(block => block.id === blockId ? { ...block, after: e.target.value } : block);
  pendingCanvasBlockId = blockId;
  run(); buildForm();
});
$('#canvas-inspector-close').addEventListener('click', () => { canvasInspectorOpen = false; $('#canvas-inspector').hidden = true; $('#canvas-options-trigger').hidden = true; $('#canvas-paste-style').disabled = !canvasStyleClipboard; });
$('#canvas-layers').addEventListener('change', e => { selectedCanvasKey = e.target.value; $('#frame').contentWindow?.postMessage({ type: 'uds-canvas-select-key', key: selectedCanvasKey }, '*'); });
$('#canvas-overlap-layers').addEventListener('change', e => { selectedCanvasKey = e.target.value; $('#frame').contentWindow?.postMessage({ type: 'uds-canvas-select-key', key: selectedCanvasKey }, '*'); });
$('#canvas-add').addEventListener('click', () => $('#canvas-menu').showModal());
$('#canvas-replace').addEventListener('click', () => $('#canvas-menu').showModal());
$('#canvas-command-run').addEventListener('click', executeCanvasCommand);
$('#canvas-command').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); executeCanvasCommand(); } });
$('#canvas-duplicate').addEventListener('click', () => {
  if (selectedCanvasMeta?.elementId && selectedCanvasMeta?.sectionId) {
    const sectionId = selectedCanvasMeta.sectionId;
    const original = (state.raw.canvasElements?.[sectionId] || []).find(item => item.id === selectedCanvasMeta.elementId);
    if (!original) return;
    rememberCanvasChange();
    const id = `element-${Date.now().toString(36)}`;
    state.raw.canvasElements = { ...state.raw.canvasElements, [sectionId]: [...state.raw.canvasElements[sectionId], { ...structuredClone(original), id }] };
    pendingCanvasElementId = id; run(); toast('Элемент продублирован');
  } else if (selectedCanvasMeta?.blockId) {
    const block = (state.raw.canvasBlocks || []).find(item => item.id === selectedCanvasMeta.blockId);
    if (!block) return;
    rememberCanvasChange(); const id = `canvas-${Date.now().toString(36)}`; state.raw.canvasBlocks = [...state.raw.canvasBlocks, { ...structuredClone(block), id }]; pendingCanvasBlockId = id; run(); toast('Блок продублирован');
  } else {
    pendingCanvasDuplicateKey = selectedCanvasKey;
    commitCanvasEdit({ duplicate: true });
  }
});
$('#canvas-delete').addEventListener('click', () => {
  if (selectedCanvasMeta?.elementId && selectedCanvasMeta?.sectionId) {
    const { sectionId, elementId } = selectedCanvasMeta;
    rememberCanvasChange();
    const elements = { ...(state.raw.canvasElements || {}) };
    elements[sectionId] = (elements[sectionId] || []).filter(item => item.id !== elementId);
    if (!elements[sectionId].length) delete elements[sectionId];
    state.raw.canvasElements = elements; selectedCanvasKey = ''; selectedCanvasMeta = null; $('#canvas-inspector').hidden = true; run(); toast('Элемент удалён');
  } else if (selectedCanvasMeta?.blockId) {
    rememberCanvasChange(); state.raw.canvasBlocks = (state.raw.canvasBlocks || []).filter(item => item.id !== selectedCanvasMeta.blockId); selectedCanvasKey = ''; selectedCanvasMeta = null; $('#canvas-inspector').hidden = true; run(); toast('Блок удалён');
  } else commitCanvasEdit({ deleted: true });
});
function canvasAutoAlignment() {
  const rect = selectedCanvasMeta?.rect;
  return !rect || Math.abs(rect.center - rect.viewport / 2) < rect.viewport * .12 ? 'center' : rect.center > rect.viewport / 2 ? 'right' : 'left';
}
$('#canvas-reset-position').addEventListener('click', () => {
  if (!selectedCanvasKey) return;
  $('#canvas-offset-x').value = '0';
  $('#canvas-offset-y').value = '0';
  commitCanvasEdit({ translateX: 0, translateY: 0 });
});
$('#canvas-align').addEventListener('click', () => {
  const align = canvasAutoAlignment();
  commitCanvasEdit({ align, translateX: 0, translateY: 0 }); toast(`Выравнивание: ${align === 'left' ? 'слева' : align === 'right' ? 'справа' : 'по центру'}`);
});
$('#canvas-undo').addEventListener('click', () => { if (canvasUndo.length) restoreCanvasSnapshot(canvasUndo.at(-1), canvasUndo, canvasRedo); });
$('#canvas-redo').addEventListener('click', () => { if (canvasRedo.length) restoreCanvasSnapshot(canvasRedo.at(-1), canvasRedo, canvasUndo); });
function runCanvasShortcut(key, modifier, shift = false) {
  if (!arrangeMode) return;
  if (modifier && key === 'd') { $('#canvas-duplicate').click(); return; }
  if (['arrowleft','arrowright','arrowup','arrowdown'].includes(key) && selectedCanvasKey) {
    const current = state.raw.canvasEdits?.[selectedCanvasKey] || {};
    const step = shift ? 10 : 1;
    const translateX = Math.max(-1600, Math.min(1600, Number(current.translateX || 0) + (key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0)));
    const translateY = Math.max(-1200, Math.min(1200, Number(current.translateY || 0) + (key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0)));
    $('#canvas-offset-x').value = String(translateX);
    $('#canvas-offset-y').value = String(translateY);
    commitCanvasEdit({ translateX, translateY });
    return;
  }
  if (key === 'delete' && selectedCanvasKey) { $('#canvas-delete').click(); return; }
  if (!modifier || !['z', 'y'].includes(key)) return;
  if (key === 'y' || shift) { if (canvasRedo.length) restoreCanvasSnapshot(canvasRedo.at(-1), canvasRedo, canvasUndo); }
  else if (canvasUndo.length) restoreCanvasSnapshot(canvasUndo.at(-1), canvasUndo, canvasRedo);
}
document.addEventListener('keydown', e => {
  if (!arrangeMode || e.target.matches('input,textarea,select,[contenteditable="true"]')) return;
  const key = e.key.toLowerCase();
  const modifier = e.ctrlKey || e.metaKey;
  if (!(modifier && ['d', 'z', 'y'].includes(key)) && !(key === 'delete' && selectedCanvasKey) && !(['arrowleft','arrowright','arrowup','arrowdown'].includes(key) && selectedCanvasKey)) return;
  e.preventDefault();
  runCanvasShortcut(key, modifier, e.shiftKey);
});
$('#canvas-menu').addEventListener('click', e => {
  const action = e.target.closest('[data-canvas-menu]')?.dataset.canvasMenu;
  if (!action) return;
  if (action.startsWith('add-')) {
    const type = action.slice(4);
    if (['card', 'button', 'image'].includes(type)) addCanvasElement(type, selectedCanvasMeta?.sectionId);
    else addCanvasBlock(type);
    return;
  }
  if (action.startsWith('replace-')) { replaceCanvasElement(action.slice(8)); return; }
  if (action.startsWith('tag-')) { commitCanvasEdit({ tag: action.slice(4) }); return; }
  if (action.startsWith('align-')) { commitCanvasEdit({ align: action.slice(6) === 'auto' ? canvasAutoAlignment() : action.slice(6) }); return; }
});
$('#canvas-menu').addEventListener('close', () => { if (selectedCanvasKey) $('#canvas-text').focus({ preventScroll: true }); });
$('#canvas-element-image-file').addEventListener('change', async e => {
  const file = e.target.files?.[0], target = pendingCanvasImageTarget;
  e.target.value = '';
  if (!file || !target) return;
  pendingCanvasImageTarget = null;
  try {
    const optimized = await optimizeImage(file, 1600);
    if (imageDataSize() + optimized.data.length > MAX_IMAGE_DATA) throw new Error('Достигнут лимит хранилища изображений проекта (3,8 МБ).');
    rememberCanvasChange();
    const elements = [...(state.raw.canvasElements?.[target.sectionId] || [])].map(item => item.id === target.id ? { ...item, src: optimized.data, alt: item.alt || file.name.slice(0, 240) } : item);
    state.raw.canvasElements = { ...(state.raw.canvasElements || {}), [target.sectionId]: elements };
    pendingCanvasElementId = target.id; run(); toast('Фото добавлено в секцию');
  } catch (error) { toast(error.message || 'Не удалось добавить изображение'); }
});
$('#frame').addEventListener('load', () => {
  const scroll = pendingCanvasFrameScroll;
  pendingCanvasFrameScroll = null;
  if (scroll) setTimeout(() => $('#frame').contentWindow?.postMessage({ type: 'uds-canvas-restore-scroll', x: scroll.x, y: scroll.y }, '*'), 40);
  if (arrangeMode && (selectedCanvasKey || pendingCanvasBlockId || pendingCanvasDuplicateKey || pendingCanvasElementId)) setTimeout(() => {
    const message = pendingCanvasBlockId ? { type: 'uds-canvas-select-block', blockId: pendingCanvasBlockId } : pendingCanvasElementId ? { type: 'uds-canvas-select-element', elementId: pendingCanvasElementId } : pendingCanvasDuplicateKey ? { type: 'uds-canvas-select-duplicate', key: pendingCanvasDuplicateKey } : { type: 'uds-canvas-select-key', key: selectedCanvasKey };
    $('#frame').contentWindow?.postMessage(message, '*');
    pendingCanvasBlockId = '';
    pendingCanvasDuplicateKey = '';
    pendingCanvasElementId = '';
  }, 30);
});
window.addEventListener('message', e => {
  if (e.source !== $('#frame').contentWindow) return;
  if (e.data?.type === 'uds-canvas-resize-start') { document.body.classList.add('canvas-resizing'); return; }
  if (e.data?.type === 'uds-canvas-resize-end') { document.body.classList.remove('canvas-resizing'); return; }
  if (e.data?.type === 'uds-canvas-move') {
    const { key, sectionId, x, y, elementId, fromSectionId } = e.data;
    if (!/^u:[\w-]+:\d+$/.test(key || '') || !/^(?:hero|[\w-]{1,64})$/.test(sectionId || '') || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return;
    rememberCanvasChange();
    if (typeof elementId === 'string' && /^[\w-]{1,64}$/.test(elementId) && /^(?:hero|[\w-]{1,64})$/.test(fromSectionId || '') && fromSectionId !== sectionId) {
      const elements = { ...(state.raw.canvasElements || {}) };
      const source = (elements[fromSectionId] || []).filter(item => item.id !== elementId);
      const moving = (elements[fromSectionId] || []).find(item => item.id === elementId);
      if (moving) {
        const destination = [...(elements[sectionId] || []).filter(item => item.id !== elementId), moving];
        elements[fromSectionId] = source; elements[sectionId] = destination;
        state.raw.canvasElements = elements;
      }
    }
    state.raw.canvasMoves = { ...(state.raw.canvasMoves || {}), [key]: { sectionId, x, y } };
    run(); toast('Элемент перемещён в другой блок'); return;
  }
  if (e.data?.type === 'uds-canvas-fan-error') { toast(e.data.message || 'В этой секции найдено меньше пяти фотографий'); return; }
  if (e.data?.type === 'uds-canvas-fan') {
    const { sectionId, photos } = e.data;
    const placements=canvasFanPlacements(photos); if (!/^(?:hero|[\w-]{1,64})$/.test(sectionId||'') || !placements) return;
    rememberCanvasChange();
    const moves={...(state.raw.canvasMoves||{})}, edits={...(state.raw.canvasEdits||{})};
    placements.forEach(p=>{moves[p.key]={sectionId,x:p.x,y:p.y};edits[p.key]={...(edits[p.key]||{}),rotation:p.rotation,zIndex:p.zIndex,width:Math.min(240,Math.max(120,Math.round((window.innerWidth||1000)*.22)))}});
    state.raw.canvasMoves=moves; state.raw.canvasEdits=edits; run(); toast('Пять фотографий разложены веером'); return;
  }
  if (e.data?.type === 'uds-canvas-preview-ready' && e.source === visualPreviewFrame?.contentWindow) {
    const scroll = readCanvasFrameScroll();
    e.source.postMessage({ type: 'uds-canvas-restore-scroll', x: scroll.x, y: scroll.y }, '*');
    return;
  }
  if (e.data?.type === 'uds-canvas-scroll') { if (Number.isFinite(e.data.x) && Number.isFinite(e.data.y)) canvasFrameScroll = { x: Math.max(0, e.data.x), y: Math.max(0, e.data.y) }; return; }
  if (e.data?.type === 'uds-canvas-resize') {
    document.body.classList.remove('canvas-resizing');
    const { key, width, height, scrollX, scrollY } = e.data;
    if (!/^u:[\w-]+:\d+$/.test(key || '') || !Number.isFinite(width) || !Number.isFinite(height) || width < 40 || width > 1600 || height < 24 || height > 1200) return;
    const scrollRestore = Number.isFinite(scrollX) && Number.isFinite(scrollY) ? { x: Math.max(0, scrollX), y: Math.max(0, scrollY) } : null;
    if (scrollRestore) canvasFrameScroll = scrollRestore;
    rememberCanvasChange();
    storeCanvasEditPatch(key, { width, height, boxSizing: 'border-box' });
    run();
    if (scrollRestore) pendingCanvasFrameScroll = scrollRestore;
    toast('Размер элемента сохранён'); return;
  }
  if (e.data?.type === 'uds-canvas-position') {
    const { key, translateX, translateY } = e.data;
    if (!/^(?:\d+(?:\.\d+)*|u:[\w-]+:\d+)$/.test(key || '') || !Number.isFinite(translateX) || !Number.isFinite(translateY)) return;
    rememberCanvasChange();
    storeCanvasEditPatch(key, { translateX: Math.max(-1600, Math.min(1600, translateX)), translateY: Math.max(-1200, Math.min(1200, translateY)) });
    run(); toast('Положение элемента сохранено'); return;
  }
  if (e.data?.type === 'uds-canvas-shortcut') {
    const key = String(e.data.key || '').toLowerCase();
    if (!['z', 'y', 'd', 'delete', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) return;
    runCanvasShortcut(key, Boolean(e.data.modifier), Boolean(e.data.shift));
    return;
  }
  if (e.data?.type === 'uds-canvas-select') { setCanvasSelection(e.data); return; }
  if (e.data?.type === 'uds-canvas-inline-commit') {
    const { key, text } = e.data;
    if (!/^(?:\d+(?:\.\d+)*|u:[\w-]+:\d+)$/.test(key || '') || typeof text !== 'string' || text.length > 2000) return;
    if (text === (state.raw.canvasEdits?.[key]?.text ?? selectedCanvasMeta?.text)) return;
    rememberCanvasChange();
    state.raw.canvasEdits = { ...(state.raw.canvasEdits || {}), [key]: { ...(state.raw.canvasEdits?.[key] || {}), text } };
    run();
    return;
  }
  if (e.data?.type === 'uds-canvas-layers') {
    const select = $('#canvas-layers'), current = selectedCanvasKey;
    select.replaceChildren(...(e.data.layers || []).map(layer => new Option(layer.label, layer.key, false, layer.key === current)));
    refreshCanvasOverlapLayers();
    return;
  }
  if (e.data?.type === 'uds-canvas-options') {
    if (e.data.key && /^(?:\d+(?:\.\d+)*|u:[\w-]+:\d+)$/.test(e.data.key) && e.data.key !== selectedCanvasKey) $('#frame').contentWindow?.postMessage({ type: 'uds-canvas-select-key', key: e.data.key }, '*');
    canvasInspectorOpen = true; $('#canvas-inspector').hidden = false; $('#canvas-options-trigger').hidden = false;
    return;
  }
  if (e.data?.type === 'uds-canvas-menu') {
    if (!e.data.key) {
      selectedCanvasKey = ''; selectedCanvasMeta = null; $('#canvas-inspector').hidden = true;
      $('#canvas-menu').querySelectorAll('[data-canvas-menu^="tag-"],[data-canvas-menu^="align-"]').forEach(button => { button.disabled = true; });
    }
    if (!$('#canvas-menu').open) $('#canvas-menu').showModal(); return;
  }
  if (e.data?.type !== 'uds-arrange') return;
  const { kind, from, to, order } = e.data;
  if (kind === 'canvas-order') {
    const group = String(e.data.group || ''), keys = e.data.keys;
    if (!/^path:(?:\d+(?:\.\d+)*)?$/.test(group) || !Array.isArray(keys) || keys.length < 2 || keys.length > 100 || keys.some(key => !/^u:[\w-]+:\d+$/.test(key)) || new Set(keys).size !== keys.length) return;
    rememberCanvasChange();
    state.raw.canvasOrder = { ...(state.raw.canvasOrder || {}), [group]: keys };
    run(); toast('Порядок элементов сохранён');
    return;
  }
  if (kind === 'custom-place') {
    const blocks = Array.isArray(state.raw.canvasBlocks) ? [...state.raw.canvasBlocks] : [];
    const sourceIndex = blocks.findIndex(block => block.id === e.data.blockId);
    const target = e.data.targetBlockId ? blocks.find(block => block.id === e.data.targetBlockId) : null;
    if (sourceIndex < 0 || (e.data.targetBlockId && (!target || target.id === e.data.blockId))) return;
    const allowed = new Set(['hero', ...currentSectionOrder(), 'contact']);
    const after = target ? (allowed.has(target.after) ? target.after : 'contact') : e.data.after;
    if (!allowed.has(after)) return;
    rememberCanvasChange();
    const [block] = blocks.splice(sourceIndex, 1);
    block.after = after;
    let insertAt = target ? blocks.findIndex(item => item.id === target.id) + 1 : -1;
    if (insertAt < 0) {
      blocks.forEach((item, index) => { if ((item.after || 'contact') === after) insertAt = index + 1; });
      if (insertAt < 0) insertAt = blocks.length;
    }
    blocks.splice(insertAt, 0, block);
    state.raw.canvasBlocks = blocks;
    pendingCanvasBlockId = block.id;
    run(); buildForm(); toast('Блок перемещён на страницу');
    return;
  }
  if (!Number.isInteger(from) || !Number.isInteger(to)) return;
  if (kind === 'section') {
    if (Array.isArray(order) && order.every(id => typeof id === 'string')) {
      const next = [...order]; next.splice(to, 0, next.splice(from, 1)[0]);
      rememberCanvasChange(); state.raw.sectionOrder = next; run(); buildForm(); toast('Порядок секций сохранён');
    }
  } else if (kind === 'item') reorderLayout('services', from, to);
  else if (kind === 'custom-block') reorderLayout('canvasBlocks', from, to);
});
$('#arrange-toggle')?.addEventListener('click', e => {
  arrangeMode = !arrangeMode;
  if (!arrangeMode) { canvasInspectorOpen = false; $('#canvas-options-trigger').hidden = true; $('#canvas-inspector').hidden = true; }
  e.currentTarget.setAttribute('aria-pressed', String(arrangeMode));
  if (result) $('#frame').srcdoc = previewHtml(result.html);
  toast(arrangeMode ? 'Перетаскивайте текст и изображения в пределах блока. Размер и стиль меняются в панели; ПКМ или долгое нажатие открывает меню.' : 'Режим редактирования на странице выключен');
});

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
// Сброс цвета перехода к «Авто»: поле удаляется из проекта, цвет снова берётся из палитры.
$('#form').addEventListener('click', e => {
  const demoFill = e.target.closest('[data-demo-fill]');
  if (demoFill) {
    Object.assign(state.raw, {
      brand: 'Демо: студия «Линия»', niche: 'дизайн интерьера',
      title: 'Интерьеры, в которых удобно жить',
      description: 'Демонстрационный проект вымышленной студии. Данные и цены придуманы для примера — замените их перед публикацией.',
      mainOffer: 'Проектируем спокойные и функциональные пространства под ваш образ жизни.',
      cta: 'Обсудить проект', targetAudience: 'Демонстрационная аудитория: владельцы квартир и домов',
      servicesTitle: 'Услуги студии',
      services: [['Планировка', 'Функциональная схема и сценарии жизни', 'от 15 000 ₽'], ['Дизайн-проект', 'Планировочные и визуальные решения', 'от 45 000 ₽'], ['Комплектация', 'Подбор материалов и предметов интерьера', 'от 20 000 ₽']],
      advantages: [['Внимание к деталям', 'Учитываем привычки и ежедневные сценарии.'], ['Прозрачные этапы', 'Показываем ход работы и согласуем решения.'], ['Цельная концепция', 'Связываем материалы, свет и мебель в единую систему.']],
      process: [['Знакомство', 'Обсуждаем задачу и пожелания.'], ['Планировка', 'Готовим и согласуем варианты.'], ['Дизайн', 'Разрабатываем визуальную концепцию.'], ['Реализация', 'Помогаем пройти путь от проекта к готовому интерьеру.']],
      pricingTitle: 'Демонстрационные пакеты',
      pricing: [['Планировка', 'Пример наполнения пакета', '15 000 ₽'], ['Полный проект', 'Пример расширенного пакета', '45 000 ₽']],
      casesTitle: 'Пример кейса — вымышленный',
      cases: [['Демо: квартира 68 м²', 'Учебный пример: зонирование пространства и подбор материалов. Это не реальный проект.', '', '', '']],
      testimonials: [], team: [], stats: [], gallery: [],
      quiz: { enabled: true }, quizTitle: 'Подберём формат проекта',
      aboutTitle: 'О демонстрационной студии',
      aboutText: 'Вымышленный пример для знакомства с возможностями генератора. Замените название, тексты, цены и кейсы на подтверждённую информацию о вашем бизнесе.',
      faqTitle: 'Частые вопросы',
      faqs: [['Сколько стоит проект?', 'В этом примере указаны вымышленные демонстрационные цены.'], ['С чего начать?', 'Опишите задачу — студия предложит подходящий формат работы.']],
    });
    state.raw.demoContent = true;
    buildForm();
    schedule();
    toast('Добавлен вымышленный пример. Замените демонстрационные данные перед публикацией.');
    return;
  }
  const refreshDesign = e.target.closest('[data-refresh-design]');
  if (refreshDesign) {
    state.raw.designVariant = Math.min(1_000_000, Math.max(0, Math.trunc(Number(state.raw.designVariant) || 0)) + 1);
    schedule();
    toast('Автоматические решения дизайна пересобраны; ручные настройки сохранены');
    return;
  }
  const refreshEffects = e.target.closest('[data-refresh-effects]');
  if (refreshEffects) {
    const mode = state.raw.effectMode || (state.raw.cardEffect || state.raw.heroEffect ? 'mixed' : 'auto');
    const autoAvailable = mode === 'auto' || (mode === 'mixed' && (!state.raw.cardEffect || !state.raw.heroEffect));
    if (!autoAvailable) return;
    const effects = result?.concept?.visualSystem?.effects;
    if (effects) state.raw.effectsAvoid = { card: effects.card, hero: effects.hero };
    state.raw.effectsSeed = (Number(state.raw.effectsSeed) || 0) + 1;
    schedule();
    toast('Автоматические эффекты обновлены');
    return;
  }
  const b = e.target.closest('[data-transition-reset]'); if (!b) return;
  delete state.raw[b.dataset.transitionReset];
  b.disabled = true;
  const st = $('#form').querySelector(`[data-transition-state="${b.dataset.transitionReset}"]`); if (st) st.textContent = 'авто';
  schedule();
});
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

const tabs = [...document.querySelectorAll('.tabs [role=tab]')]; // только вкладки результата, не вкладки панели
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
  $('#preview-custom-width').value = '';
  activeCanvasBreakpoint = w === '390' ? 'mobile' : w === '768' ? 'tablet' : w === '1280' ? 'desktop' : 'all';
  $('#canvas-breakpoint').value = activeCanvasBreakpoint;
  if (selectedCanvasKey) setTimeout(() => $('#frame').contentWindow?.postMessage({ type: 'uds-canvas-select-key', key: selectedCanvasKey }, '*'), 80);
  selectTab($('#tab-preview'));
}));
$('#preview-custom-width')?.addEventListener('change', e => {
  const width = Math.max(320, Math.min(1920, Number(e.target.value) || 320));
  e.target.value = String(width);
  $('#frame').style.width = width + 'px';
  $('#view-preview').classList.add('sized');
  activeCanvasBreakpoint = width <= 600 ? 'mobile' : width <= 900 ? 'tablet' : 'desktop';
  $('#canvas-breakpoint').value = activeCanvasBreakpoint;
  document.querySelectorAll('.sizes button').forEach(button => button.setAttribute('aria-pressed', 'false'));
  selectTab($('#tab-preview'));
  if (selectedCanvasKey) setTimeout(() => $('#frame').contentWindow?.postMessage({ type: 'uds-canvas-select-key', key: selectedCanvasKey }, '*'), 80);
});

const previewFullscreenButton = $('#preview-fullscreen');
const previewView = $('#view-preview');
function syncPreviewFullscreen() {
  const active = document.fullscreenElement === previewView || previewView?.classList.contains('is-fullscreen-fallback');
  if (!previewFullscreenButton) return;
  previewFullscreenButton.setAttribute('aria-pressed', String(active));
  previewFullscreenButton.setAttribute('aria-label', active ? 'Выйти из полноэкранного режима' : 'Развернуть предпросмотр на весь экран');
  previewFullscreenButton.title = active ? 'Выйти из полноэкранного режима (Esc)' : 'На весь экран';
  previewFullscreenButton.innerHTML = active ? '⤢ <span>Свернуть</span>' : '⛶ <span>На весь экран</span>';
}
function exitPreviewFullscreen() {
  if (previewView?.classList.contains('is-fullscreen-fallback')) {
    previewView.classList.remove('is-fullscreen-fallback');
    document.body.classList.remove('preview-fullscreen-active');
    syncPreviewFullscreen();
    return;
  }
  if (document.fullscreenElement === previewView && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {
      previewView.classList.remove('is-fullscreen-fallback');
      document.body.classList.remove('preview-fullscreen-active');
      syncPreviewFullscreen();
    });
  }
}
previewFullscreenButton?.addEventListener('click', async () => {
  if (!previewView) return;
  const active = document.fullscreenElement === previewView || previewView.classList.contains('is-fullscreen-fallback');
  if (active) { exitPreviewFullscreen(); return; }
  selectTab($('#tab-preview'));
  if (previewView.requestFullscreen) {
    try { await previewView.requestFullscreen(); }
    catch {
      previewView.classList.add('is-fullscreen-fallback');
      document.body.classList.add('preview-fullscreen-active');
    }
  } else {
    previewView.classList.add('is-fullscreen-fallback');
    document.body.classList.add('preview-fullscreen-active');
  }
  syncPreviewFullscreen();
});
document.addEventListener('fullscreenchange', syncPreviewFullscreen);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && previewView?.classList.contains('is-fullscreen-fallback')) exitPreviewFullscreen();
});

$('#change-preview')?.addEventListener('click', () => {
  updateChangePreviewButton();
  if ($('#change-preview').disabled) return toast('Сначала внесите изменение в проект — тогда появится сравнение.');
  if (pendingDesignPreview?.projectId === state.raw.id) {
    try {
      const { concept, ...snapshot } = pendingDesignPreview;
      snapshot.afterRaw = exportProject(normalizeProject(snapshot.afterRaw), concept);
      localStorage.setItem(PREVIEW_STORE, JSON.stringify(snapshot));
      storedDesignPreviewAvailable = true;
      storedDesignPreviewProjectId = snapshot.projectId;
    } catch { return toast('Не удалось подготовить сравнение: возможно, в браузере закончилось место. Основной проект не затронут.'); }
  }
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
  if (persistFailed) return toast(persistBackupFailed ? PERSIST_ERROR : PERSIST_PENDING);
  toast(`«${result.entry.brand}» сохранён в реестр`);
});
$('#view-registry').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.load) { const item = state.library[b.dataset.load]; state.analysis = item.analysis ? { projectId: item.raw.id, data: item.analysis } : null; load(item.raw, 'Проект открыт из реестра'); return; }
  if (b.dataset.del) { state.library.splice(Number(b.dataset.del), 1); run(); return; }
  try {
    if (b.hasAttribute('data-history-save')) {
      const snapshot = await saveProjectVersion({ projectId: result.project.id, raw: result.exported, analysis: currentAnalysis(), label: $('#history-label')?.value || '' });
      if ($('#history-label')) $('#history-label').value = '';
      toast('Версия сохранена: ' + new Date(snapshot.createdAt).toLocaleString('ru-RU'));
      await renderProjectHistory();
      return;
    }
    if (b.dataset.historyCompare) {
      const host = $('#project-history-diff');
      host.innerHTML = '<p class="note">Сравниваем сохранённую версию с текущим проектом…</p>';
      const version = await getProjectVersion(b.dataset.historyCompare);
      if (!version) { host.replaceChildren(); return toast('Версия уже недоступна'); }
      const changes = compareProjectSnapshots(version.raw, state.raw);
      host.innerHTML = '<h4>Сравнение: ' + esc(version.label || 'Сохранённая версия') + ' → текущая</h4>' + (changes.length
        ? '<table><thead><tr><th>Поле</th><th>В версии</th><th>Сейчас</th></tr></thead><tbody>' + changes.map(item => '<tr><td>' + esc(item.field) + '</td><td>' + esc(item.before) + '</td><td>' + esc(item.after) + '</td></tr>').join('') + '</tbody></table>'
        : '<p class="note">В основных полях и количестве материалов отличий нет.</p>');
      return;
    }
    if (b.dataset.historyRestore) {
      const version = await getProjectVersion(b.dataset.historyRestore);
      if (!version) return toast('Версия уже недоступна');
      if (!confirm('Восстановить эту версию? Текущая работа сначала будет сохранена отдельным снимком.')) return;
      await saveProjectVersion({ projectId: result.project.id, raw: result.exported, analysis: currentAnalysis(), label: 'Перед восстановлением' });
      load({ ...version.raw, __udsAnalysis: version.analysis ? { data: version.analysis } : null }, 'Версия восстановлена. Текущая работа сохранена в истории.');
      return;
    }
    if (b.dataset.historyDelete) {
      if (!confirm('Удалить сохранённую версию? Это действие нельзя отменить.')) return;
      await deleteProjectVersion(b.dataset.historyDelete);
      $('#project-history-diff').replaceChildren();
      await renderProjectHistory();
      toast('Версия удалена');
    }
  } catch (error) { toast('Ошибка истории версий: ' + (error.message || 'не удалось выполнить действие')); }
});

await restoreEmergencyBackupIfNewer();
run();
buildForm();
renderDashboard();

// Меню «Ещё» в шапке: закрываем после выбора действия и по клику вне меню.
document.querySelector('.top-more')?.addEventListener('click', e => { if (e.target.closest('.top-more__menu button')) e.currentTarget.open = false; });
document.addEventListener('click', e => { const menu = document.querySelector('.top-more[open]'); if (menu && !menu.contains(e.target)) menu.open = false; });
document.addEventListener('keydown', e => { const menu = document.querySelector('.top-more[open]'); if (e.key === 'Escape' && menu) { menu.open = false; menu.querySelector('summary').focus(); } });
// В переносящейся шапке кнопка «Ещё» может стоять у любого края: раскрываем меню туда, где оно помещается.
document.querySelector('.top-more')?.addEventListener('toggle', e => {
  const menu = e.currentTarget.querySelector('.top-more__menu');
  if (!e.currentTarget.open || !menu) return;
  // На узких экранах меню фиксировано под шапкой: ставим его сразу под нижний край шапки.
  if (getComputedStyle(menu).position === 'fixed') { const top = document.querySelector('body>.top'); menu.style.setProperty('--top-more-y', Math.round((top ? top.getBoundingClientRect().bottom : 56) + 6) + 'px'); return; }
  menu.style.left = ''; menu.style.right = '';
  const r = menu.getBoundingClientRect();
  if (r.right > innerWidth - 8) { menu.style.left = 'auto'; menu.style.right = '0'; }
  else if (r.left < 8) { menu.style.left = '0'; menu.style.right = 'auto'; }
});

