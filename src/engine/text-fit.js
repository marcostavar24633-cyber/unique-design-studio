// Подгоняет короткие подписи к доступной ширине, не трогая абзацы и описания.
export const TEXT_FIT_CSS = '.uds-fit-text{min-width:0;white-space:nowrap!important;text-wrap:nowrap!important}';

export function textFitScript() {
  return `(function(){
var selector='h1,h2,h3,.kicker,.nav__cta,.ds-button,.item__title,.price,[data-uds-fit-text]';
var original=new WeakMap(),scheduled=false,observedParents=new WeakSet(),parentWidths=new WeakMap();
var resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(function(entries){
  var changed=false;
  entries.forEach(function(entry){var width=entry.contentRect.width,previous=parentWidths.get(entry.target);parentWidths.set(entry.target,width);if(previous!==undefined&&Math.abs(previous-width)>.5)changed=true});
  if(changed)schedule();
}):null;
function textWidth(el){var range=document.createRange();range.selectNodeContents(el);return range.getBoundingClientRect().width}
function fit(){
  scheduled=false;
  document.querySelectorAll(selector).forEach(function(el){
    var saved=original.get(el);
    if(!saved){saved={font:el.style.fontSize,max:el.style.maxWidth,width:el.style.width};original.set(el,saved)}
    el.style.fontSize=saved.font||'';el.style.maxWidth=saved.max||'';el.style.width=saved.width||'';el.classList.remove('uds-fit-text');
    var rect=el.getBoundingClientRect();
    if(rect.right<=0||rect.left>=innerWidth||rect.width<2)return;
    el.classList.add('uds-fit-text');
    var parent=el.parentElement,parentRect=parent&&parent.getBoundingClientRect(),parentStyle=parent&&getComputedStyle(parent);
    if(parent&&resizeObserver&&!observedParents.has(parent)){observedParents.add(parent);resizeObserver.observe(parent)}
    var padLeft=parseFloat(parentStyle&&parentStyle.paddingLeft)||0,padRight=parseFloat(parentStyle&&parentStyle.paddingRight)||0;
    var parentWidth=parent?Math.max(1,parent.clientWidth-padLeft-padRight):innerWidth-(parentRect?parentRect.left:rect.left)-16;
    var parentLeft=parentRect?parentRect.left+padLeft:rect.left;
    var available=Math.max(1,Math.min(parentWidth,innerWidth-Math.max(0,parentLeft)-16));
    if(parentWidth<24){el.style.fontSize=saved.font||'';el.style.maxWidth=saved.max||'';el.style.width=saved.width||'';el.classList.remove('uds-fit-text');original.delete(el);return}
    var cssMax=getComputedStyle(el).maxWidth,calcMatch=cssMax.match(/^calc\\(\\s*100%\\s*-\\s*([\\d.]+)px\\s*\\)$/);
    var parsedMax=cssMax.endsWith('%')?parentWidth*(parseFloat(cssMax)/100):calcMatch?parentWidth-parseFloat(calcMatch[1]):cssMax.startsWith('calc(')?available:parseFloat(cssMax);
    var limit=cssMax==='none'||!parsedMax||parsedMax<24?available:Math.min(parsedMax,available);
    el.style.maxWidth=limit+'px';
    el.style.width=Math.min(rect.width,limit,available)+'px';
    var style=getComputedStyle(el),padding=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0),border=(parseFloat(style.borderLeftWidth)||0)+(parseFloat(style.borderRightWidth)||0);
    var width=Math.max(1,el.clientWidth-padding-border),base=parseFloat(style.fontSize);
    if(!base||width<8)return;
    if(textWidth(el)<=width-2)return;
    var low=Math.min(base,1),high=base;
    for(var i=0;i<14;i++){var mid=(low+high)/2;el.style.fontSize=mid+'px';if(textWidth(el)<=width-2)low=mid;else high=mid}
    el.style.fontSize=Math.max(1,low)+'px';
  });
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(fit)}
window.addEventListener('resize',schedule,{passive:true});document.addEventListener('scroll',schedule,true);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(schedule);
if('MutationObserver'in window)new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true});
schedule();
})();`;
}
