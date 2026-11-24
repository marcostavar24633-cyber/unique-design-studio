// Каталог для магазинов: фильтры по категориям, сортировка по цене и «корзина-заявка».
// Оплата не имитируется: посетитель собирает список, а отправляет его через настроенную форму, письмом или звонком.
// Итог считается только по ценам, которые указал владелец; если хоть у одной позиции цены нет — «стоимость уточним».
import { esc } from './util.js';

/** Ниши, в которых посетитель выбирает товары, а не одну услугу. */
export const COMMERCE_NICHES = new Set(['shop', 'appliances', 'optics', 'furniture', 'apparel', 'music', 'gifts', 'seafood', 'boutique']);

const COPY = {
  ru: { categories: 'Категории', all: 'Все', sort: 'Сортировка', default: 'По умолчанию', lowPrice: 'Сначала дешевле', highPrice: 'Сначала дороже', add: 'Добавить', addToRequest: 'В заявку', inRequest: 'В заявке', request: 'Заявка', submit: 'Перейти к отправке', emailList: 'Отправить список на e-mail', copyList: 'Скопировать список', note: 'Это заявка, а не оплата: мы подтвердим наличие, стоимость и доставку.', call: 'Позвоните нам', clear: 'Очистить', quantity: 'количество', decrease: 'Уменьшить', increase: 'Увеличить', itemCount: 'шт.', total: 'Итого по ценам каталога', totalUnknown: 'Стоимость уточним при подтверждении заявки', subject: 'Заявка с сайта', order: 'Хочу заказать:', copied: 'Список скопирован.', downloaded: 'Список скачан в TXT.', shown: 'Показано', found: 'Найдено' },
  en: { categories: 'Categories', all: 'All', sort: 'Sort by', default: 'Default', lowPrice: 'Price: low to high', highPrice: 'Price: high to low', add: 'Add', addToRequest: 'Add to request', inRequest: 'In request', request: 'Request', submit: 'Continue to submit', emailList: 'Email this list', copyList: 'Copy list', note: 'This is a request, not a payment. We will confirm availability, price, and delivery.', call: 'Call us', clear: 'Clear', quantity: 'quantity', decrease: 'Decrease', increase: 'Increase', itemCount: 'items', total: 'Total based on catalog prices', totalUnknown: 'We will confirm the total with your request', subject: 'Website request', order: 'I would like to order:', copied: 'List copied.', downloaded: 'List downloaded as TXT.', shown: 'Shown', found: 'Found' },
};
const copyFor = lang => COPY[String(lang || '').toLowerCase().startsWith('en') ? 'en' : 'ru'];

function currencyFor(project) {
  const prices = project.services.map(item => item.price || '').join(' ');
  if (/\$|\bUSD\b/i.test(prices)) return 'USD';
  if (/€|\bEUR\b/i.test(prices)) return 'EUR';
  if (/£|\bGBP\b/i.test(prices)) return 'GBP';
  if (/¥|\bJPY\b/i.test(prices)) return 'JPY';
  if (/₽|руб/i.test(prices)) return 'RUB';
  return '';
}

/** Числовая цена из строки владельца («12 900 ₽», «от 3 500 руб.»). «от …» и диапазоны не суммируются. */
export function parsePrice(text) {
  const t = String(text || '').trim();
  if (!t || /^от\s|[–—-]\s*\d|договор|запрос/i.test(t)) return null;
  const m = t.replace(/ /g, ' ').match(/\d[\d ]*(?:[.,]\d{1,2})?/);
  if (!m) return null;
  const n = Number(m[0].replace(/ /g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Режим каталога: { tools, cart }. tools — фильтры и сортировка (магазинная ниша, от двух позиций, есть категории или цены);
 * cart — корзина-заявка: только если у позиций есть реальные цены владельца (или project.commerce === true).
 * Черновик автопилота с разделами без цен корзину не получает. project.commerce === false выключает всё.
 */
export function commerceEnabled(project, nicheId) {
  const off = { tools: false, cart: false };
  if (project.commerce === false) return off;
  const items = project.services.filter(i => i.title);
  if (items.length < 2 || !(project.commerce === true || COMMERCE_NICHES.has(nicheId))) return off;
  const f = catalogFacts(project);
  return { tools: f.filterable || f.sortable, cart: project.commerce === true || f.priced >= 1 };
}

export function catalogFacts(project) {
  const items = project.services.filter(i => i.title);
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
  const priced = items.filter(i => parsePrice(i.price) !== null).length;
  return { categories, priced, sortable: priced >= 2, filterable: categories.length >= 2 };
}

/** Панель фильтров и сортировки. Скрыта без JS — без скрипта каталог просто показывает все позиции. */
export function catalogControls(project) {
  const f = catalogFacts(project);
  if (!f.filterable && !f.sortable) return '';
  const copy = copyFor(project.lang);
  const chips = f.filterable
    ? `<div class="filters" role="group" aria-label="${copy.categories}"><button type="button" class="chip" data-filter="" aria-pressed="true">${copy.all}</button>${f.categories.map(cat => `<button type="button" class="chip" data-filter="${esc(cat)}" aria-pressed="false">${esc(cat)}</button>`).join('')}</div>`
    : '';
  const sort = f.sortable
    ? `<label class="sort" for="catalog-sort">${copy.sort}<select class="ds-field" id="catalog-sort" data-sort><option value="">${copy.default}</option><option value="asc">${copy.lowPrice}</option><option value="desc">${copy.highPrice}</option></select></label>`
    : '';
  return `<div class="catalog-tools" data-catalog-tools hidden>${chips}${sort}<p class="catalog-count" data-catalog-count aria-live="polite"></p></div>`;
}

export const itemAttrs = (i) => {
  const price = parsePrice(i.price);
  return `${i.category ? ` data-category="${esc(i.category)}"` : ''}${price !== null ? ` data-price="${price}"` : ''}`;
};

export const addButton = (i, n, lang = 'ru') => {
  const copy = copyFor(lang);
  return `<button type="button" class="ds-button ds-button--secondary item__add" data-add="${n}" hidden aria-label="${copy.add} «${esc(i.title)}» ${copy.addToRequest.toLowerCase()}">${copy.addToRequest}</button>`;
};

/** Панель заявки. Способ отправки — только реально настроенный владельцем. */
export function cartPanel(project) {
  const k = project.contacts || {};
  const via = project.formAction ? 'form' : k.email ? 'email' : k.phone ? 'phone' : '';
  if (!via) return '';
  const copy = copyFor(project.lang);
  const send = via === 'form' ? copy.submit : via === 'email' ? copy.emailList : copy.copyList;
  return `<aside class="cart" data-cart data-cart-via="${via}"${via === 'email' ? ` data-cart-email="${esc(k.email)}"` : ''}${via === 'phone' ? ` data-cart-phone="${esc(k.phone)}"` : ''} hidden aria-labelledby="cart-h">
<button type="button" class="cart__toggle" data-cart-toggle aria-expanded="false" aria-controls="cart-body"><span id="cart-h">${copy.request}</span> <b data-cart-count>0</b></button>
<div class="cart__body" id="cart-body" hidden>
<ul class="cart__list" data-cart-list></ul>
<p class="cart__total" data-cart-total aria-live="polite"></p>
<p class="cart__note">${copy.note}${via === 'phone' ? ` ${copy.call}: <a href="tel:${esc(String(k.phone).replace(/[^\d+]/g, ''))}">${esc(k.phone)}</a>.` : ''}</p>
<div class="cart__actions"><button type="button" class="ds-button" data-cart-send>${send}</button><button type="button" class="ds-button ds-button--secondary" data-cart-clear>${copy.clear}</button></div>
</div>
</aside>`;
}

export const COMMERCE_CSS = `.catalog-tools{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin:0 0 18px}.catalog-tools[hidden]{display:none}
.filters{display:flex;flex-wrap:wrap;gap:6px}.chip{min-height:40px;padding:6px 14px;border-radius:999px;border:1px solid var(--ds-border,currentColor);background:transparent;color:inherit;font:inherit;cursor:pointer}
.chip[aria-pressed="true"]{background:var(--ds-accent);border-color:var(--ds-accent);color:var(--ds-accent-contrast,#fff)}
.sort{display:flex;align-items:center;gap:8px;font-size:.9rem}.sort .ds-field{width:auto;min-height:40px}
.catalog-count{margin:0;color:var(--ds-text-muted);font-size:.9rem}
.item[hidden]{display:none!important}.item__add{margin-top:.8em;min-height:44px}.item__add[aria-pressed="true"]{background:var(--ds-accent);color:var(--ds-accent-contrast,#fff)}
.cart{position:fixed;right:clamp(12px,3vw,24px);bottom:clamp(12px,3vw,24px);z-index:50;width:min(380px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:var(--ds-surface,var(--u-tint,#fff));color:inherit;border:1px solid var(--ds-border,currentColor);border-radius:var(--ds-radius-card,12px);box-shadow:0 12px 40px rgba(0,0,0,.25)}
.cart[hidden]{display:none}.cart__toggle{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:48px;padding:10px 16px;border:0;background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer}
.cart__toggle b{min-width:28px;padding:2px 8px;border-radius:999px;background:var(--ds-accent);color:var(--ds-accent-contrast,#fff);text-align:center}
.cart__body{padding:0 16px 16px}.cart__list{list-style:none;margin:0;padding:0}.cart__list li{display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--ds-border,rgba(0,0,0,.12))}
.cart__qty{display:flex;align-items:center;gap:4px}.cart__qty button{min-width:36px;min-height:36px;border:1px solid var(--ds-border,currentColor);border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.cart__total{font-weight:700;margin:10px 0 4px}.cart__note{font-size:.85rem;color:var(--ds-text-muted)}.cart__actions{display:flex;flex-wrap:wrap;gap:8px}
@media(prefers-reduced-motion:no-preference){.cart{transition:box-shadow .2s}}`;

/** Скрипт каталога: фильтр, сортировка, корзина-заявка. Хранит выбор в localStorage этой страницы, если оно доступно. */
export function commerceScript(project) {
  const key = JSON.stringify('uds-cart:' + (project.id || project.brand || 'site'));
  const copy = JSON.stringify(copyFor(project.lang));
  const currency = JSON.stringify(currencyFor(project));
  const locale = JSON.stringify(project.lang || 'ru-RU');
  return `var copy=${copy},currency=${currency},locale=${locale},list=document.querySelector('#items ul');if(list){var items=[].slice.call(list.querySelectorAll('.item'));var tools=document.querySelector('[data-catalog-tools]'),count=document.querySelector('[data-catalog-count]'),cat='';
function apply(){var sf=document.querySelector('[data-search] input'),q=sf?sf.value.trim().toLowerCase():'';var n=0;items.forEach(function(li){var categoryOk=!cat||li.getAttribute('data-category')===cat;var searchOk=!q||li.textContent.toLowerCase().indexOf(q)>-1;var ok=categoryOk&&searchOk;li.hidden=!ok;if(ok)n++});if(count)count.textContent=(cat||q)?copy.shown+': '+n+' / '+items.length:'';var st=document.querySelector('[data-search-status]');if(st&&q)st.textContent=copy.found+': '+n}
if(tools){tools.hidden=false;tools.addEventListener('click',function(e){var b=e.target.closest('[data-filter]');if(!b)return;cat=b.getAttribute('data-filter');tools.querySelectorAll('[data-filter]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});apply()});tools.addEventListener('uds:catalog-search',apply);
var so=tools.querySelector('[data-sort]');if(so)so.addEventListener('change',function(){var d=so.value;var arr=items.slice();if(d)arr.sort(function(a,b){var pa=a.hasAttribute('data-price')?+a.getAttribute('data-price'):Infinity,pb=b.hasAttribute('data-price')?+b.getAttribute('data-price'):Infinity;return d==='asc'?pa-pb:(pa===Infinity?1:pb===Infinity?-1:pb-pa)});arr.forEach(function(li){list.appendChild(li)})})}
var cart=document.querySelector('[data-cart]');if(cart){var store={};try{store=JSON.parse(localStorage.getItem(${key})||'{}')||{}}catch(e){}
var names=items.map(function(li){return li.querySelector('h3').textContent});var prices=items.map(function(li){return li.hasAttribute('data-price')?+li.getAttribute('data-price'):null});
var body=cart.querySelector('#cart-body'),tg=cart.querySelector('[data-cart-toggle]');
function save(){try{localStorage.setItem(${key},JSON.stringify(store))}catch(e){}}
function lines(){return Object.keys(store).filter(function(k){return store[k]>0&&names[k]}).map(function(k){return {i:+k,name:names[k],q:store[k],p:prices[k]}})}
function text(){return lines().map(function(l){return l.name+' — '+l.q+' '+copy.itemCount}).join('\\n')}
function render(){var ls=lines(),total=0,known=true,qty=0;cart.hidden=!ls.length;var ul=cart.querySelector('[data-cart-list]');ul.textContent='';ls.forEach(function(l){qty+=l.q;if(l.p===null)known=false;else total+=l.p*l.q;var li=document.createElement('li');var s=document.createElement('span');s.textContent=l.name;var q=document.createElement('span');q.className='cart__qty';[["−",-1,copy.decrease],["+",1,copy.increase]].forEach(function(b,ix){var btn=document.createElement('button');btn.type='button';btn.textContent=b[0];btn.setAttribute('aria-label',b[2]+' '+copy.quantity+': '+l.name);btn.addEventListener('click',function(){store[l.i]=Math.max(0,(store[l.i]||0)+b[1]);if(!store[l.i])delete store[l.i];save();render()});if(ix===1){var v=document.createElement('span');v.textContent=l.q;q.appendChild(v)}q.appendChild(btn)});q.insertBefore(q.lastChild,null);li.appendChild(s);li.appendChild(q);ul.appendChild(li)});
cart.querySelector('[data-cart-count]').textContent=qty;var money=currency?new Intl.NumberFormat(locale,{style:'currency',currency:currency}).format(total):new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(total);cart.querySelector('[data-cart-total]').textContent=ls.length?(known?copy.total+': '+money:copy.totalUnknown):'';
items.forEach(function(li,i){var b=li.querySelector('[data-add]');if(b){b.setAttribute('aria-pressed',String(!!store[i]));b.textContent=store[i]?copy.inRequest+' ('+store[i]+')':copy.addToRequest}})}
items.forEach(function(li,i){var b=li.querySelector('[data-add]');if(!b)return;b.hidden=false;b.addEventListener('click',function(){store[i]=(store[i]||0)+1;save();render()})});
function setOpen(open){body.hidden=!open;tg.setAttribute('aria-expanded',String(open))}tg.addEventListener('click',function(){setOpen(body.hidden)});cart.addEventListener('keydown',function(e){if(e.key==='Escape'&&!body.hidden){setOpen(false);tg.focus()}});
cart.querySelector('[data-cart-clear]').addEventListener('click',function(){store={};save();render()});
cart.querySelector('[data-cart-send]').addEventListener('click',function(){var t=text(),via=cart.getAttribute('data-cart-via');if(!t)return;
if(via==='form'){var f=document.querySelector('#contact form')||document.querySelector('form.form');if(f){var o=f.querySelector('[name=order]');if(!o){o=document.createElement('input');o.type='hidden';o.name='order';f.appendChild(o)}o.value=t;f.scrollIntoView({behavior:'smooth'});var first=f.querySelector('input,select,textarea');if(first)first.focus()}}
else if(via==='email'){location.href='mailto:'+cart.getAttribute('data-cart-email')+'?subject='+encodeURIComponent(copy.subject)+'&body='+encodeURIComponent(copy.order+'\\n'+t)}
else{var note=cart.querySelector('.cart__note');function downloaded(){var blob=new Blob([t],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='order-request.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);note.append(' '+copy.downloaded)}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){note.append(' '+copy.copied)},downloaded)}else downloaded()}});
render()}}`;
}

