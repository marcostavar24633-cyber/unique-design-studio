const $ = selector => document.querySelector(selector);
const API = 'https://api.github.com';
const HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
const MAX_HTML = 4_000_000;
const MAX_CSS = 1_500_000;
const MAX_STYLESHEETS = 6;
let repository = null;
let originalHtml = '';
let importedCss = [];
let selectedKey = '';
let edits = Object.create(null);
let changed = new Set();

function status(message, error = false) {
  const el = $('#repo-status'); el.textContent = message; el.classList.toggle('notice--err', error);
}
function parseRepository(value) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2 || !/^[a-z\d-]+$/i.test(parts[0]) || !/^[a-z\d_.-]+$/i.test(parts[1])) return null;
    return { owner: parts[0], name: parts[1].replace(/\.git$/i, '') };
  } catch { return null; }
}
async function requestJson(url) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) throw new Error('GitHub временно ограничил запросы. Подождите и повторите.');
    if (response.status === 404) throw new Error('Репозиторий не найден или он закрытый. Поддерживаются публичные репозитории.');
    throw new Error(data?.message || `GitHub ответил кодом ${response.status}`);
  }
  return data;
}
function decodeBlob(blob, limit) {
  if (blob?.encoding !== 'base64' || !blob.content) throw new Error('GitHub не вернул содержимое файла.');
  const bytes = Uint8Array.from(atob(blob.content.replace(/\s/g, '')), char => char.charCodeAt(0));
  if (bytes.length > limit) throw new Error('Файл превышает лимит импорта.');
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}
function resolveRepoPath(path, href) {
  let value = String(href || '').split(/[?#]/, 1)[0];
  try { value = decodeURIComponent(value); } catch { /* Сохраняем исходную строку. */ }
  if (!value || /^(?:[a-z]+:|\/\/|data:|#)/i.test(value)) return '';
  const parts = (value.startsWith('/') ? value.slice(1) : `${path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''}${value}`).split('/');
  const clean = [];
  for (const part of parts) { if (!part || part === '.') continue; if (part === '..') clean.pop(); else clean.push(part); }
  return clean.join('/');
}
function toRawUrl(path) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${repository.branch}/${encoded}`;
}
function rewriteCssUrls(css, stylesheetUrl, repoRootUrl) {
  return css.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (whole, quote, value) => {
    if (/^(?:data:|https?:|\/\/|#)/i.test(value)) return whole;
    try {
      const resolved = new URL(value.startsWith('/') ? value.slice(1) : value, value.startsWith('/') ? repoRootUrl : stylesheetUrl);
      return `url("${resolved.href.replace(/"/g, '%22')}")`;
    } catch { return 'url("")'; }
  });
}

function buildPreview(html, baseUrl, cssParts, repoRootUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const meta of [...doc.querySelectorAll('meta[http-equiv]')]) {
    if (/^(?:refresh|content-security-policy)$/i.test(meta.httpEquiv)) meta.remove();
  }
  for (const node of doc.querySelectorAll('*')) {
    for (const attr of [...node.attributes]) {
      if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
      if (/^(?:href|src|action|formaction|xlink:href)$/i.test(attr.name) && /^\s*javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
    }
    if (node.tagName === 'SCRIPT') { node.type = 'application/x-uds-inert'; node.removeAttribute('src'); }
    if (node.tagName === 'FORM') { node.removeAttribute('action'); node.setAttribute('autocomplete', 'off'); }
    if (node.tagName === 'IFRAME' || node.tagName === 'OBJECT' || node.tagName === 'EMBED') {
      node.removeAttribute('src'); node.removeAttribute('srcdoc'); node.removeAttribute('data');
    }
    if (node.tagName === 'A') node.removeAttribute('target');
    for (const attr of ['src', 'poster', 'data-src', 'srcset']) {
      const value = node.getAttribute(attr);
      if (!value) continue;
      if (attr === 'srcset') {
        node.setAttribute(attr, value.split(',').map(entry => {
          const [url, ...descriptor] = entry.trim().split(/\s+/);
          return `${resolvePreviewUrl(url, baseUrl, repoRootUrl)} ${descriptor.join(' ')}`.trim();
        }).join(', '));
      } else node.setAttribute(attr, resolvePreviewUrl(value, baseUrl, repoRootUrl));
    }
    if (node.tagName === 'A') {
      const href = node.getAttribute('href');
      if (href && !/^(?:[a-z]+:|\/\/|#)/i.test(href)) node.setAttribute('href', '#');
    }
  }
  const csp = doc.createElement('meta'); csp.httpEquiv = 'Content-Security-Policy';
  csp.content = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://raw.githubusercontent.com; img-src data: https://raw.githubusercontent.com; font-src data: https://raw.githubusercontent.com; media-src data: https://raw.githubusercontent.com; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri https://raw.githubusercontent.com";
  doc.head.prepend(csp);
  let base = doc.querySelector('base'); if (!base) { base = doc.createElement('base'); doc.head.insertBefore(base, csp.nextSibling); }
  base.href = baseUrl;
  for (const link of doc.querySelectorAll('link[rel~="stylesheet"]')) link.disabled = true;
  for (const [name, css] of cssParts) {
    const style = doc.createElement('style'); style.dataset.udsImportedCss = name;
    style.textContent = rewriteCssUrls(css, toRawUrl(name), repoRootUrl); doc.head.append(style);
  }
  const nodes = [...doc.body.querySelectorAll('*')];
  nodes.forEach((node, index) => {
    node.dataset.udsRepoKey = String(index);
    node.dataset.udsRepoOriginalStyle = node.getAttribute('style') || '';
  });
  const runtime = doc.createElement('script');
  runtime.textContent = `(()=>{const send=n=>{if(!n)return;const s=getComputedStyle(n),r=n.getBoundingClientRect(),leaf=!n.children.length;const hex=v=>{const m=v.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);return m?'#'+[m[1],m[2],m[3]].map(x=>Number(x).toString(16).padStart(2,'0')).join(''):''};parent.postMessage({type:'uds-repo-select',key:n.dataset.udsRepoKey||'',text:leaf?n.textContent.slice(0,2000):null,color:hex(s.color),background:hex(s.backgroundColor),fontSize:parseFloat(s.fontSize)||16,opacity:Math.round((parseFloat(s.opacity)||0)*100),width:Math.round(r.width),height:Math.round(r.height),radius:parseFloat(s.borderRadius)||0,rotation:parseFloat(s.rotate)||0},'*')};document.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();send(e.target.closest('[data-uds-repo-key]'))},true);document.addEventListener('submit',e=>e.preventDefault(),true);addEventListener('message',e=>{const d=e.data;if(!d||d.type!=='uds-repo-edit')return;const n=document.body.querySelectorAll('*')[Number(d.key)];if(!n)return;if(d.reset){n.setAttribute('style',n.dataset.udsRepoOriginalStyle||'');return}const p=d.patch||{};if(p.text!==undefined&& !n.children.length)n.textContent=p.text;if(p.color)n.style.color=p.color;if(p.background)n.style.backgroundColor=p.background;if(p.fontSize)n.style.fontSize=p.fontSize+'px';if(p.width!==undefined)n.style.width=p.width?p.width+'px':'';if(p.height!==undefined)n.style.height=p.height?p.height+'px':'';if(p.opacity!==undefined)n.style.opacity=String(p.opacity/100);if(p.radius!==undefined)n.style.borderRadius=p.radius?p.radius+'px':'';if(p.rotation!==undefined)n.style.rotate=p.rotation+'deg';if(p.x!==undefined||p.y!==undefined)n.style.translate=(Number(p.x)||0)+'px '+(Number(p.y)||0)+'px'})})();`;
  doc.body.append(runtime);
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}
function resolvePreviewUrl(value, baseUrl, repoRootUrl) {
  const raw = String(value).trim();
  if (!raw || /^(?:[a-z]+:|\/\/|#|data:|blob:)/i.test(raw)) return raw;
  try { return new URL(raw.startsWith('/') ? raw.slice(1) : raw, raw.startsWith('/') ? repoRootUrl : baseUrl).href; }
  catch { return ''; }
}

$('#repo-connect').addEventListener('click', async () => {
  const parsed = parseRepository($('#repo-url').value);
  if (!parsed) { status('Введите ссылку вида https://github.com/owner/repository.', true); return; }
  const button = $('#repo-connect'); button.disabled = true; $('#repo-pages-row').hidden = true;
  status('Ищу HTML-файлы в публичном репозитории…');
  try {
    const base = `${API}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}`;
    const info = await requestJson(base);
    if (info.private) throw new Error('Репозиторий закрытый. В этой версии доступны только публичные репозитории.');
    const branch = String(info.default_branch || 'main');
    const tree = await requestJson(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if (tree.truncated) throw new Error('Список файлов слишком большой для браузерного импорта.');
    const pages = (tree.tree || []).filter(item => item.type === 'blob' && /\.html?$/i.test(item.path) && Number(item.size) <= MAX_HTML);
    if (!pages.length) throw new Error('Не найден HTML-файл размером до 4 МБ.');
    const rank = path => path === 'index.html' ? 0 : /(^|\/)index\.html?$/i.test(path) ? 1 : 2;
    pages.sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path));
    repository = { ...parsed, branch, base, files: tree.tree || [], pages };
    $('#repo-page').replaceChildren(...pages.slice(0, 120).map(item => new Option(item.path, item.path)));
    $('#repo-pages-row').hidden = false;
    status(`Найдено страниц: ${pages.length}. Ветка: ${branch}.`);
  } catch (error) { repository = null; status(error.message || 'Не удалось прочитать репозиторий.', true); }
  finally { button.disabled = false; }
});

$('#repo-load').addEventListener('click', async () => {
  if (!repository) return;
  const button = $('#repo-load'); button.disabled = true;
  try {
    const path = $('#repo-page').value;
    const page = repository.pages.find(item => item.path === path);
    if (!page) throw new Error('Выберите страницу из списка.');
    status(`Загружаю ${path} и CSS…`);
    const html = decodeBlob(await requestJson(`${repository.base}/git/blobs/${page.sha}`), MAX_HTML);
    const byPath = new Map(repository.files.filter(item => item.type === 'blob').map(item => [item.path, item]));
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const styles = [...parsed.querySelectorAll('link[rel~="stylesheet"][href]')].map(link => resolveRepoPath(path, link.getAttribute('href'))).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, MAX_STYLESHEETS);
    const cssParts = [];
    for (const stylePath of styles) {
      const item = byPath.get(stylePath);
      if (!item || Number(item.size) > MAX_CSS) continue;
      try { cssParts.push([stylePath, decodeBlob(await requestJson(`${repository.base}/git/blobs/${item.sha}`), MAX_CSS)]); }
      catch { /* CSS который нельзя прочитать не блокирует импорт HTML. */ }
    }
    originalHtml = html; importedCss = cssParts; edits = Object.create(null); changed.clear(); selectedKey = '';
    const rawPage = toRawUrl(path); const rawBase = rawPage.slice(0, rawPage.lastIndexOf('/') + 1);
    $('#repo-frame').srcdoc = buildPreview(html, rawBase, cssParts, toRawUrl(''));
    $('#repo-current-file').textContent = path;
    $('#editor-workspace').hidden = false;
    $('#repo-apply').disabled = false;
    $('#repo-selection').textContent = 'Выберите элемент на странице.';
    status(`Страница загружена. CSS-файлов: ${cssParts.length}. Код сайта не запускался; репозиторий не менялся.`);
  } catch (error) { status(error.message || 'Не удалось загрузить страницу.', true); }
  finally { button.disabled = false; }
});

window.addEventListener('message', event => {
  if (event.source !== $('#repo-frame').contentWindow || event.data?.type !== 'uds-repo-select') return;
  const data = event.data; selectedKey = String(data.key || '');
  if (!selectedKey) return;
  $('#repo-selection').textContent = `Элемент №${Number(selectedKey) + 1}`;
  const patch = edits[selectedKey] || {};
  $('#repo-text-row').hidden = data.text === null;
  if (data.text !== null) $('#repo-text').value = patch.text ?? data.text;
  $('#repo-color').value = patch.color || data.color || '#202329';
  $('#repo-background').value = patch.background || data.background || '#ffffff';
  $('#repo-size').value = patch.fontSize ?? data.fontSize ?? 16;
  $('#repo-width').value = patch.width ?? '';
  $('#repo-height').value = patch.height ?? '';
  $('#repo-rotation').value = patch.rotation ?? data.rotation ?? 0;
  $('#repo-opacity').value = patch.opacity ?? data.opacity ?? 100;
  $('#repo-radius').value = patch.radius ?? data.radius ?? '';
  $('#repo-x').value = patch.x ?? 0; $('#repo-y').value = patch.y ?? 0;
  changed.clear();
});
const controls = {
  '#repo-text': ['text', el => el.value.slice(0, 2000)], '#repo-color': ['color', el => el.value], '#repo-background': ['background', el => el.value],
  '#repo-size': ['fontSize', el => Math.max(8, Math.min(120, Number(el.value) || 16))], '#repo-width': ['width', el => el.value ? Math.max(0, Math.min(2400, Number(el.value) || 0)) : 0],
  '#repo-height': ['height', el => el.value ? Math.max(0, Math.min(1600, Number(el.value) || 0)) : 0], '#repo-rotation': ['rotation', el => Math.max(-45, Math.min(45, Number(el.value) || 0))],
  '#repo-opacity': ['opacity', el => Math.max(0, Math.min(100, Number(el.value) || 0))], '#repo-radius': ['radius', el => Math.max(0, Math.min(999, Number(el.value) || 0))],
  '#repo-x': ['x', el => Math.max(-1600, Math.min(1600, Number(el.value) || 0))], '#repo-y': ['y', el => Math.max(-1200, Math.min(1200, Number(el.value) || 0))],
};
for (const [selector, [key, read]] of Object.entries(controls)) $(selector).addEventListener('input', event => {
  if (!selectedKey) return;
  changed.add(key); const patch = edits[selectedKey] || (edits[selectedKey] = {}); patch[key] = read(event.target);
});
$('#repo-apply').addEventListener('click', () => {
  if (!selectedKey || !changed.size) return;
  const patch = edits[selectedKey] || (edits[selectedKey] = {});
  const applied = {};
  for (const key of changed) {
    const entry = Object.entries(controls).find(([, control]) => control[0] === key);
    if (!entry) continue;
    const [selector, [, read]] = entry;
    patch[key] = read($(selector));
    applied[key] = patch[key];
  }
  $('#repo-frame').contentWindow.postMessage({ type: 'uds-repo-edit', key: selectedKey, patch: applied }, '*');
  changed.clear(); status(`Правки элемента №${Number(selectedKey) + 1} применены. Скачайте HTML, чтобы сохранить результат.`);
});
$('#repo-reset').addEventListener('click', () => {
  if (!originalHtml) return;
  edits = Object.create(null); changed.clear(); selectedKey = '';
  const path = $('#repo-page').value, rawPage = toRawUrl(path);
  $('#repo-frame').srcdoc = buildPreview(originalHtml, rawPage.slice(0, rawPage.lastIndexOf('/') + 1), importedCss, toRawUrl(''));
  $('#repo-selection').textContent = 'Выберите элемент на странице.'; status('Все локальные правки сброшены.');
});
$('#repo-download').addEventListener('click', () => {
  if (!originalHtml) return;
  const doc = new DOMParser().parseFromString(originalHtml, 'text/html');
  const nodes = [...doc.body.querySelectorAll('*')];
  for (const [key, patch] of Object.entries(edits)) {
    const node = nodes[Number(key)]; if (!node) continue;
    if (patch.text !== undefined && !node.children.length) node.textContent = patch.text;
    if (patch.color) node.style.color = patch.color;
    if (patch.background) node.style.backgroundColor = patch.background;
    if (patch.fontSize) node.style.fontSize = `${patch.fontSize}px`;
    if (patch.width !== undefined) node.style.width = patch.width ? `${patch.width}px` : '';
    if (patch.height !== undefined) node.style.height = patch.height ? `${patch.height}px` : '';
    if (patch.opacity !== undefined) node.style.opacity = String(patch.opacity / 100);
    if (patch.radius !== undefined) node.style.borderRadius = patch.radius ? `${patch.radius}px` : '';
    if (patch.rotation !== undefined) node.style.rotate = `${patch.rotation}deg`;
    if (patch.x !== undefined || patch.y !== undefined) node.style.translate = `${Number(patch.x) || 0}px ${Number(patch.y) || 0}px`;
  }
  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>\n` : '<!doctype html>\n';
  const blob = new Blob([doctype, doc.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = $('#repo-page').value.split('/').pop() || 'edited-site.html';
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  status(`Изменённый HTML скачан. Добавьте файл в репозиторий вручную; исходник в GitHub остался нетронутым.`);
});
