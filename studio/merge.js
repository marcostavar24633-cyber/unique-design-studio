// Merge Control Center: состояние PR, CI и публикации из общедоступного API GitHub.
// Браузер ничего не меняет в репозитории: проверки на результате слияния и само слияние выполняет
// исполнитель Merge Engine в GitHub Actions (.github/workflows/merge-engine.yml).
import { BASE, REPO, STATUS_LABELS, publicStatus, summarizeCi } from '../src/merge/rules.mjs';

const API = `https://api.github.com/repos/${REPO}`;
const ACTIONS_URL = `https://github.com/${REPO}/actions/workflows/merge-engine.yml`;
const CACHE_KEY = 'uds:merge-center';
const CACHE_MS = 2 * 60 * 1000; // без токена GitHub даёт 60 запросов в час — не дёргаем API чаще

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = iso => (iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const safeHref = url => (/^https:\/\/github\.com\//.test(url || '') ? url : '#');

async function api(path, { allow404 = false } = {}) {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 404 && allow404) return null;
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    throw new Error(`исчерпан лимит запросов GitHub без авторизации; повторите после ${new Date(reset).toLocaleTimeString('ru-RU')}`);
  }
  if (!res.ok) throw new Error(`GitHub ответил ${res.status}`);
  return res.json();
}

async function load() {
  const [prs, main, merged, deployRuns, engineRuns] = await Promise.all([
    api('/pulls?state=open&per_page=100'),
    api(`/branches/${BASE}`),
    api('/pulls?state=closed&sort=updated&direction=desc&per_page=20'),
    api(`/actions/workflows/pages.yml/runs?branch=${BASE}&per_page=5`, { allow404: true }),
    api('/actions/workflows/merge-engine.yml/runs?per_page=10', { allow404: true }),
  ]);
  const items = await Promise.all(prs.map(async p => {
    const [detail, runs, status] = await Promise.all([
      api(`/pulls/${p.number}`), api(`/commits/${p.head.sha}/check-runs?per_page=100`), api(`/commits/${p.head.sha}/status`),
    ]);
    const ci = summarizeCi(runs.check_runs || [], status.statuses || []);
    const facts = { state: detail.state, merged: detail.merged, draft: detail.draft, baseRef: detail.base.ref, mergeable: detail.mergeable, mergeableState: detail.mergeable_state, ci };
    return { number: p.number, title: p.title, url: p.html_url, head: p.head.ref, author: p.user?.login, updatedAt: p.updated_at, behind: detail.mergeable_state === 'behind', facts, status: publicStatus(facts) };
  }));
  return {
    checkedAt: new Date().toISOString(), mainSha: main.commit.sha, items,
    merged: merged.filter(p => p.merged_at).slice(0, 8).map(p => ({ number: p.number, title: p.title, at: p.merged_at, url: p.html_url })),
    deploy: deployRuns?.workflow_runs?.[0] || null,
    engineInstalled: engineRuns !== null,
    engineRuns: (engineRuns?.workflow_runs || []).map(r => ({ at: r.created_at, event: r.event, status: r.status, conclusion: r.conclusion, url: r.html_url, title: r.display_title })),
  };
}

const badgeClass = s => ({ candidate: 'ok', ready: 'ok', checking: 'warn', 'ci-pending': 'warn', draft: 'muted', closed: 'muted' }[s] || 'err');
function runState(r) {
  if (!r) return { text: 'нет данных', cls: 'muted' };
  if (r.status !== 'completed') return { text: 'выполняется', cls: 'warn' };
  return r.conclusion === 'success' ? { text: 'успешно', cls: 'ok' } : { text: `ошибка (${r.conclusion})`, cls: 'err' };
}

function render(d) {
  const count = s => d.items.filter(i => i.status === s).length;
  // CI считается по фактам, а не по итоговому статусу: у черновика или конфликтующего PR CI тоже может падать.
  const ciFailed = d.items.filter(i => i.facts.ci.failed.length).length, ciPending = d.items.filter(i => !i.facts.ci.failed.length && i.facts.ci.pending).length;
  const deploy = runState(d.deploy);
  const deployFresh = d.deploy && d.deploy.head_sha === d.mainSha;
  $('mc-checked').textContent = `Проверено: ${when(d.checkedAt)}`;
  $('mc-stats').innerHTML = [
    ['Открыто PR', d.items.length],
    ['Кандидаты на слияние', count('candidate')],
    ['Заблокировано', d.items.length - count('candidate') - count('conflict')],
    ['Конфликтуют с main', count('conflict')],
    ['Последний main', `<code>${esc(d.mainSha.slice(0, 7))}</code>`],
    ['CI открытых PR', ciFailed ? `<span class="mc-badge err">ошибки: ${ciFailed}</span>` : ciPending ? '<span class="mc-badge warn">выполняется</span>' : '<span class="mc-badge ok">без ошибок</span>'],
    ['Публикация', d.deploy ? `<span class="mc-badge ${deploy.cls}">${esc(deploy.text)}</span>${deployFresh ? '' : '<br><span>не для последнего main</span>'}` : '<span class="mc-badge muted">нет данных</span>'],
  ].map(([label, value]) => `<div class="mc-stat"><b>${value}</b><span>${label}</span></div>`).join('');

  $('mc-prs').innerHTML = d.items.length ? d.items.map(i => {
    const f = i.facts, ci = f.ci;
    const rows = [
      [!f.draft, f.draft ? 'Черновик (draft)' : 'Не черновик'],
      [f.baseRef === BASE, `Целевая ветка: ${f.baseRef}`],
      [ci.failed.length ? false : ci.pending ? 'wait' : ci.total > 0, ci.failed.length ? `CI: не прошли ${ci.failed.join(', ')}` : ci.pending ? `CI: выполняется ${ci.pending} из ${ci.total}` : ci.total ? `CI: успешно ${ci.success} из ${ci.total}` : 'CI не запускался'],
      [f.mergeable === null ? 'wait' : f.mergeable !== false, f.mergeable === false ? 'Есть конфликты с main' : f.mergeable === null ? 'GitHub ещё проверяет конфликты' : 'Конфликтов с main нет'],
    ];
    if (i.behind) rows.push(['wait', 'Ветка отстаёт от main']);
    return `<article class="mc-pr"><div class="mc-pr-head"><a href="${esc(safeHref(i.url))}" target="_blank" rel="noopener">#${i.number} ${esc(i.title)}</a><span class="mc-badge ${badgeClass(i.status)}">${esc(STATUS_LABELS[i.status])}</span></div>
      <div class="mc-pr-meta">${esc(i.head)} · ${esc(i.author || '')} · обновлён ${when(i.updatedAt)}</div>
      <ul class="mc-checks">${rows.map(([okv, text]) => `<li class="${okv === 'wait' ? 'wait' : okv ? '' : 'no'}">${esc(text)}</li>`).join('')}</ul></article>`;
  }).join('') : '<p class="hint">Открытых Pull Request нет.</p>';

  $('mc-runs').innerHTML = !d.engineInstalled
    ? '<p class="hint">Исполнитель Merge Engine ещё не установлен в main (нет файла .github/workflows/merge-engine.yml).</p>'
    : d.engineRuns.length ? `<ul class="mc-list">${d.engineRuns.map(r => { const s = runState(r); return `<li><a href="${esc(safeHref(r.url))}" target="_blank" rel="noopener">${esc(r.title || 'Merge Engine')}</a> <span class="mc-badge ${s.cls}">${esc(s.text)}</span><br><span>${when(r.at)} · ${r.event === 'schedule' ? 'по расписанию' : 'вручную'}</span></li>`; }).join('')}</ul>` : '<p class="hint">Запусков ещё не было.</p>';
  $('mc-merged').innerHTML = d.merged.length ? `<ul class="mc-list">${d.merged.map(m => `<li><a href="${esc(safeHref(m.url))}" target="_blank" rel="noopener">#${m.number} ${esc(m.title)}</a><br><span>${when(m.at)}</span></li>`).join('')}</ul>` : '<p class="hint">—</p>';
}

function note(text, err = false) { const n = $('mc-note'); n.textContent = text; n.classList.toggle('err', err); }

async function refresh({ force = false } = {}) {
  if (!force) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - Date.parse(cached.checkedAt) < CACHE_MS) { render(cached); return cached; }
    } catch { /* нет хранилища */ }
  }
  note('Запрашиваю данные GitHub…');
  document.querySelectorAll('[data-mc]').forEach(b => { b.disabled = true; });
  try {
    const d = await load();
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* нет хранилища */ }
    render(d);
    note(`Данные GitHub получены: ${when(d.checkedAt)}.`);
    return d;
  } catch (e) {
    const stale = $('mc-stats').childElementCount > 0;
    if (!stale) $('mc-prs').innerHTML = '<p class="hint">Нет данных: GitHub не ответил.</p>';
    note(`Не удалось получить данные GitHub: ${e.message}.${stale ? ' Ниже — данные предыдущей проверки.' : ''}`, true);
    return null;
  } finally {
    document.querySelectorAll('[data-mc]').forEach(b => { b.disabled = false; });
  }
}

// Операции, меняющие репозиторий или требующие запуска тестов, выполняет исполнитель в GitHub Actions.
const ENGINE_STEPS = {
  tests: 'Откроется страница исполнителя Merge Engine. Нажмите «Run workflow», выберите command = check и укажите номер PR: исполнитель запустит тесты и сборку на результате слияния с актуальным main.',
  prepare: 'Откроется страница исполнителя. Выберите command = merge, укажите номер PR и оставьте execute выключенным: это пробный прогон всех условий без слияния.',
  merge: 'Откроется страница исполнителя. Выберите command = merge, номер PR и включите execute. Слияние выполнится, только если все обязательные условия выполнены. Результат появится в «Истории операций» после завершения запуска.',
};

document.querySelector('.mc-actions').addEventListener('click', async e => {
  const b = e.target.closest('[data-mc]'); if (!b) return;
  const op = b.dataset.mc;
  if (op === 'refresh' || op === 'conflicts') {
    const d = await refresh({ force: true });
    if (d && op === 'conflicts') {
      const c = d.items.filter(i => i.status === 'conflict'), wait = d.items.filter(i => i.status === 'checking');
      note(c.length ? `Конфликтуют с main: ${c.map(i => '#' + i.number).join(', ')}.` : wait.length ? `GitHub ещё проверяет: ${wait.map(i => '#' + i.number).join(', ')} — повторите через минуту.` : 'По данным GitHub конфликтов с main нет.');
    }
    return;
  }
  if (op === 'history') { $('mc-history-panel').scrollIntoView({ behavior: 'smooth' }); return; }
  const d = await refresh();
  if (d && !d.engineInstalled) { note('Исполнитель Merge Engine ещё не установлен в main: сначала слейте PR с файлом .github/workflows/merge-engine.yml.', true); return; }
  note(ENGINE_STEPS[op]);
  window.open(ACTIONS_URL, '_blank', 'noopener');
});

refresh();
