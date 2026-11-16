// Лёгкий терпимый к ошибкам разбор HTML без DOM: одинаково работает в браузере, Node и Cloudflare Worker.
// Не исполняет скрипты и не загружает ресурсы — только строит дерево для статического анализа разметки.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title', 'noscript', 'template']);
// Открытие тега из ключа закрывает незакрытый тег из значения (упрощённые правила HTML).
const AUTO_CLOSE = { li: ['li'], option: ['option'], tr: ['tr', 'td', 'th'], td: ['td', 'th'], th: ['td', 'th'], dt: ['dt', 'dd'], dd: ['dt', 'dd'] };
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…', copy: '©', rub: '₽' };

export const MAX_HTML = 3_000_000;

export function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

function parseAttrs(src) {
  const attrs = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

/** @returns {{tag:string, attrs:object, children:Array, parent:object|null}} корневой узел #root */
export function parseHtml(input) {
  const html = String(input ?? '').slice(0, MAX_HTML);
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[^>]*>|<\/([a-zA-Z][\w:-]*)[^>]*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0, m;
  const text = (from, to) => {
    if (to <= from) return;
    const t = html.slice(from, to);
    if (t.trim()) cur.children.push({ text: decodeEntities(t).replace(/\s+/g, ' ') });
  };
  while ((m = re.exec(html))) {
    text(last, m.index);
    last = re.lastIndex;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      let n = cur;
      while (n !== root && n.tag !== tag) n = n.parent;
      if (n !== root) cur = n.parent;
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      const closes = AUTO_CLOSE[tag];
      if (closes && closes.includes(cur.tag)) cur = cur.parent;
      const node = { tag, attrs: parseAttrs(m[3] || ''), children: [], parent: cur };
      cur.children.push(node);
      if (RAW.has(tag)) {
        const close = new RegExp(`</${tag}\\s*>`, 'i');
        const rest = html.slice(last);
        const end = rest.search(close);
        const raw = end < 0 ? rest : rest.slice(0, end);
        if (raw.trim()) node.children.push({ text: tag === 'script' || tag === 'style' ? raw : decodeEntities(raw) });
        last = end < 0 ? html.length : last + end + rest.slice(end).match(close)[0].length;
        re.lastIndex = last;
      } else if (!VOID.has(tag) && !/\/\s*$/.test(m[3] || '')) cur = node;
    }
  }
  text(last, html.length);
  return root;
}

// ---------- Обход дерева ----------
export function walk(node, fn) {
  for (const c of node.children || []) {
    if (!c.tag) continue;
    if (fn(c) === false) continue;
    walk(c, fn);
  }
}
export function findAll(node, test) {
  const out = [];
  const ok = typeof test === 'string' ? (n => n.tag === test) : test;
  walk(node, n => { if (ok(n)) out.push(n); });
  return out;
}
export const find = (node, test) => findAll(node, test)[0] || null;
export const elements = node => (node.children || []).filter(c => c.tag);

const SKIP_TEXT = new Set(['script', 'style', 'noscript', 'template', 'svg']);
/** Видимый текст узла (без скриптов и стилей), пробелы схлопнуты. */
export function textOf(node) {
  if (node.text != null) return node.text;
  if (SKIP_TEXT.has(node.tag)) return '';
  let out = '';
  for (const c of node.children || []) out += (c.text != null ? c.text : textOf(c)) + ' ';
  return out.replace(/\s+/g, ' ').trim();
}
export const classOf = node => (node.attrs.class || '').toLowerCase();
export function closest(node, test) {
  for (let n = node; n && n.tag !== '#root'; n = n.parent) if (test(n)) return n;
  return null;
}
