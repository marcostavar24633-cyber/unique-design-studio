// Клиент GitHub REST API для Merge Engine. Токен берётся только из окружения (GITHUB_TOKEN / GH_TOKEN)
// и никогда не выводится в журнал и отчёты.

export class GitHubError extends Error {
  constructor(message, status, path) { super(message); this.status = status; this.path = path; }
}

export function createGitHub({ repo, token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '', fetchImpl = globalThis.fetch, apiBase = 'https://api.github.com' } = {}) {
  const authenticated = Boolean(token);

  async function api(path, { method = 'GET', body, allow404 = false } = {}) {
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'uds-merge-engine' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetchImpl(`${apiBase}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (res.status === 404 && allow404) return null;
    if (!res.ok) {
      const hint = res.status === 401 ? 'нет авторизации или токен недействителен'
        : res.status === 403 ? (data.message || 'недостаточно прав или исчерпан лимит запросов')
        : res.status === 405 ? (data.message || 'GitHub отказал в слиянии')
        : res.status === 409 ? (data.message || 'голова PR изменилась или есть конфликт')
        : res.status === 422 ? (data.message || 'запрос отклонён GitHub')
        : data.message || `ошибка ${res.status}`;
      throw new GitHubError(`GitHub ${method} ${path}: ${hint}`, res.status, path);
    }
    return data;
  }

  const r = `/repos/${repo}`;
  return {
    authenticated,
    api,
    getRepo: () => api(r),
    getBranch: name => api(`${r}/branches/${encodeURIComponent(name)}`),
    getBranchProtection: name => api(`${r}/branches/${encodeURIComponent(name)}/protection`, { allow404: true }),
    listOpenPrs: () => api(`${r}/pulls?state=open&per_page=100`),
    listMergedPrs: () => api(`${r}/pulls?state=closed&sort=updated&direction=desc&per_page=30`).then(list => list.filter(p => p.merged_at)),
    getPr: n => api(`${r}/pulls/${n}`),
    listPrsForHead: (owner, ref) => api(`${r}/pulls?state=open&head=${encodeURIComponent(`${owner}:${ref}`)}`),
    checkRuns: sha => api(`${r}/commits/${sha}/check-runs?per_page=100`).then(d => d.check_runs || []),
    statuses: sha => api(`${r}/commits/${sha}/status`).then(d => d.statuses || []),
    merge: (n, { sha, method, title }) => api(`${r}/pulls/${n}/merge`, { method: 'PUT', body: { sha, merge_method: method, commit_title: title } }),
    deleteBranch: ref => api(`${r}/git/refs/heads/${ref.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE' }),
    dispatchWorkflow: (file, ref) => api(`${r}/actions/workflows/${file}/dispatches`, { method: 'POST', body: { ref } }),
    workflowRuns: (file, params = '') => api(`${r}/actions/workflows/${file}/runs?per_page=10${params}`).then(d => d.workflow_runs || []),
  };
}
