// Правила допуска Pull Request к автоматическому слиянию (Merge Engine).
// Чистый модуль без зависимостей: используется исполнителем (Node) и панелью Merge Control Center (браузер).
// Решение принимается только по фактам; если факт неизвестен (null), условие считается НЕ выполненным.

export const REPO = 'marcostavar24633-cyber/unique-design-studio';
export const BASE = 'main';
export const MERGE_METHOD = 'squash';
/** Метка, которой владелец подтверждает, что прочитал изменения в чувствительных файлах (CI, доступ, данные). */
export const REVIEWED_LABEL = 'merge-engine: reviewed';
/** Сколько строк, существующих в main, слияние может убрать без ручной проверки. */
export const MAX_MAIN_LINES_REMOVED = 120;
export const STALE_DAYS = 14;

/** Пути, изменения в которых требуют ручной проверки владельцем. */
export const SENSITIVE_PATTERNS = [
  /^\.github\//,                       // CI и права исполнителей
  /(^|\/)wrangler\.(toml|jsonc?)$/,    // привязки и секреты Cloudflare
  /(^|\/)(auth|oauth|login|session|permissions?)[\w.-]*\.(m?js|ts|json)$/i,
  /(^|\/)(migrations?|migrate)[\w./-]*$/i,
  /(^|\/)\.env/,
  /(^|\/)package(-lock)?\.json$/,      // зависимости и скрипты сборки
];

export const isSensitivePath = path => SENSITIVE_PATTERNS.some(re => re.test(path));

/**
 * @typedef {object} PrFacts
 * @property {string} repo
 * @property {number} number
 * @property {string} state            'open' | 'closed'
 * @property {boolean} merged
 * @property {boolean} draft
 * @property {string} baseRef
 * @property {string} headSha
 * @property {string[]} labels
 * @property {string} updatedAt
 * @property {{total:number, success:number, pending:number, failed:string[]}|null} ci
 * @property {boolean|null} conflicts
 * @property {number|null} behindBy
 * @property {{mainLinesRemoved:number, filesRemoved:string[], symbolsRemoved:string[]}|null} removal
 * @property {string[]|null} secrets
 * @property {string[]|null} sensitiveFiles
 * @property {boolean|null} testsPassed
 * @property {boolean|null} buildPassed
 * @property {string[]|null} allowedMergeMethods
 */

const ok = (id, label, detail = '') => ({ id, label, ok: true, detail });
const fail = (id, label, detail) => ({ id, label, ok: false, detail });

/**
 * Проверяет все обязательные условия. Возвращает { eligible, status, checks, warnings }.
 * status: ready | draft | conflict | ci-failed | ci-pending | blocked | closed
 * @param {PrFacts} f
 * @param {{now?: number}} [opts]
 */
export function evaluate(f, { now = Date.now() } = {}) {
  const checks = [];
  const warnings = [];

  checks.push(f.repo === REPO ? ok('repo', 'Репозиторий') : fail('repo', 'Репозиторий', `PR из другого репозитория: ${f.repo || 'неизвестно'}`));
  checks.push(f.state === 'open' && !f.merged ? ok('open', 'PR открыт') : fail('open', 'PR открыт', f.merged ? 'уже слит' : 'закрыт'));
  checks.push(f.baseRef === BASE ? ok('base', 'Целевая ветка main') : fail('base', 'Целевая ветка main', `целевая ветка: ${f.baseRef}`));
  checks.push(!f.draft ? ok('draft', 'Не черновик') : fail('draft', 'Не черновик', 'PR в режиме draft'));

  const ci = f.ci;
  if (!ci) checks.push(fail('ci', 'CI', 'статус проверок неизвестен'));
  else if (ci.failed.length) checks.push(fail('ci', 'CI', `не прошли: ${ci.failed.join(', ')}`));
  else if (ci.pending) checks.push(fail('ci', 'CI', `ещё выполняются: ${ci.pending}`));
  else if (!ci.total) checks.push(fail('ci', 'CI', 'проверки не запускались'));
  else checks.push(ok('ci', 'CI', `успешно: ${ci.success} из ${ci.total}`));

  if (f.conflicts === null || f.conflicts === undefined) checks.push(fail('conflicts', 'Конфликты с main', 'не проверено'));
  else checks.push(f.conflicts ? fail('conflicts', 'Конфликты с main', 'есть конфликты с актуальным main') : ok('conflicts', 'Конфликты с main', 'нет'));

  const r = f.removal;
  if (!r) checks.push(fail('removal', 'Удаление существующего кода', 'не проверено'));
  else {
    const problems = [];
    if (r.filesRemoved.length) problems.push(`удаляются файлы: ${r.filesRemoved.slice(0, 5).join(', ')}${r.filesRemoved.length > 5 ? '…' : ''}`);
    if (r.symbolsRemoved.length) problems.push(`пропадают экспорты: ${r.symbolsRemoved.slice(0, 5).join(', ')}${r.symbolsRemoved.length > 5 ? '…' : ''}`);
    if (r.mainLinesRemoved > MAX_MAIN_LINES_REMOVED) problems.push(`из main убирается ${r.mainLinesRemoved} строк (порог ${MAX_MAIN_LINES_REMOVED})`);
    checks.push(problems.length ? fail('removal', 'Удаление существующего кода', problems.join('; ')) : ok('removal', 'Удаление существующего кода', `убирается строк из main: ${r.mainLinesRemoved}`));
  }

  if (!f.secrets) checks.push(fail('secrets', 'Секреты и персональные данные', 'не проверено'));
  else checks.push(f.secrets.length ? fail('secrets', 'Секреты и персональные данные', f.secrets.slice(0, 5).join('; ')) : ok('secrets', 'Секреты и персональные данные', 'не найдены'));

  const reviewed = (f.labels || []).includes(REVIEWED_LABEL);
  if (!f.sensitiveFiles) checks.push(fail('security', 'Проверка безопасности', 'не проверено'));
  else if (f.sensitiveFiles.length && !reviewed) checks.push(fail('security', 'Проверка безопасности', `меняются чувствительные файлы (${f.sensitiveFiles.slice(0, 4).join(', ')}); нужна метка «${REVIEWED_LABEL}» от владельца`));
  else checks.push(ok('security', 'Проверка безопасности', f.sensitiveFiles.length ? 'чувствительные файлы проверены владельцем' : 'чувствительные файлы не затронуты'));

  if (f.testsPassed !== true || f.buildPassed !== true) {
    const what = [f.testsPassed === false ? 'тесты упали' : f.testsPassed !== true ? 'тесты не запускались' : '', f.buildPassed === false ? 'сборка упала' : f.buildPassed !== true ? 'сборка не запускалась' : ''].filter(Boolean).join(', ');
    checks.push(fail('tests', 'Тесты и сборка на результате слияния', what));
  } else checks.push(ok('tests', 'Тесты и сборка на результате слияния', 'пройдены'));

  const methods = f.allowedMergeMethods;
  if (!methods) checks.push(fail('method', 'Способ слияния', 'настройки репозитория неизвестны'));
  else checks.push(methods.includes(MERGE_METHOD) ? ok('method', 'Способ слияния', MERGE_METHOD) : fail('method', 'Способ слияния', `squash запрещён настройками; разрешено: ${methods.join(', ') || 'ничего'}`));

  if (f.behindBy) warnings.push(`ветка отстаёт от main на ${f.behindBy} коммит(ов) — тесты запускаются на результате слияния с актуальным main`);
  const updated = Date.parse(f.updatedAt || '');
  if (updated && now - updated > STALE_DAYS * 864e5) warnings.push(`PR не обновлялся больше ${STALE_DAYS} дней`);

  const failed = id => checks.some(c => c.id === id && !c.ok);
  const eligible = checks.every(c => c.ok);
  const status = eligible ? 'ready'
    : failed('open') ? 'closed'
    : failed('draft') ? 'draft'
    : failed('conflicts') && f.conflicts === true ? 'conflict'
    : failed('ci') && ci && ci.failed.length ? 'ci-failed'
    : failed('ci') && ci && ci.pending ? 'ci-pending'
    : 'blocked';
  return { eligible, status, checks, warnings };
}

/** Сводит check-runs и commit statuses GitHub к {total, success, pending, failed}. */
export function summarizeCi(checkRuns = [], statuses = []) {
  // Перезапуски: по каждому имени берём самый свежий запуск.
  const latest = new Map();
  for (const run of checkRuns) {
    const prev = latest.get(run.name);
    if (!prev || Date.parse(run.started_at || 0) >= Date.parse(prev.started_at || 0)) latest.set(run.name, run);
  }
  const out = { total: 0, success: 0, pending: 0, failed: [] };
  for (const run of latest.values()) {
    out.total++;
    if (run.status !== 'completed') out.pending++;
    else if (['success', 'neutral', 'skipped'].includes(run.conclusion)) out.success++;
    else out.failed.push(`${run.name} (${run.conclusion})`);
  }
  for (const s of statuses) {
    out.total++;
    if (s.state === 'success') out.success++;
    else if (s.state === 'pending') out.pending++;
    else out.failed.push(`${s.context} (${s.state})`);
  }
  return out;
}

/** Разрешённые способы слияния из настроек репозитория (поля доступны только с токеном). */
export function allowedMergeMethods(repo) {
  if (!repo || repo.allow_squash_merge === undefined) return null;
  return [repo.allow_squash_merge && 'squash', repo.allow_merge_commit && 'merge', repo.allow_rebase_merge && 'rebase'].filter(Boolean);
}

/**
 * Предварительный статус по общедоступным данным GitHub (для панели в браузере, без токена).
 * Тесты на результате слияния, удаление кода и поиск секретов выполняет только исполнитель,
 * поэтому лучший возможный статус здесь — «кандидат», а не «готов».
 * @param {{state:string, merged:boolean, draft:boolean, baseRef:string, mergeable:boolean|null, mergeableState:string, ci:object|null}} f
 */
export function publicStatus(f) {
  if (f.state !== 'open' || f.merged) return 'closed';
  if (f.draft) return 'draft';
  if (f.mergeable === false || f.mergeableState === 'dirty') return 'conflict';
  if (f.baseRef !== BASE) return 'blocked';
  if (!f.ci) return 'blocked';
  if (f.ci.failed.length) return 'ci-failed';
  if (f.ci.pending) return 'ci-pending';
  if (!f.ci.total) return 'blocked';
  if (f.mergeable === null || f.mergeableState === 'unknown') return 'checking';
  return 'candidate';
}

export const STATUS_LABELS = {
  ready: 'Готов к слиянию', candidate: 'Кандидат на слияние', checking: 'GitHub проверяет', draft: 'Черновик', conflict: 'Конфликт',
  'ci-failed': 'CI не прошёл', 'ci-pending': 'CI выполняется', blocked: 'Заблокирован', closed: 'Закрыт',
};
