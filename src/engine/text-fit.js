// Подгоняет короткие подписи к доступной ширине, не трогая абзацы и описания.
export const TEXT_FIT_CSS = '.uds-fit-text{min-width:0;white-space:nowrap!important;text-wrap:nowrap!important}.uds-fit-text--wrap{white-space:normal!important;text-wrap:wrap!important;overflow-wrap:anywhere}';

export function textFitScript() {
  return `(function(){
var selector='h1,h2,h3,.kicker,.nav__cta,.ds-button,.item__title,.price,[data-uds-fit-text]';
var original=new WeakMap(),scheduled=false,observedParents=new WeakSet(),parentWidths=new WeakMap(),pending=new Set(),visible=new Set();
var resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(function(entries){
  entries.forEach(function(entry){var width=entry.contentRect.width,previous=parentWidths.get(entry.target);parentWidths.set(entry.target,width);if(previous===undefined||Math.abs(width-previous)>.5)entry.target.querySelectorAll(selector).forEach(function(el){if(visible.has(el))pending.add(el)})});
  flush();
}):null;
var visibilityObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(function(entries){
  entries.forEach(function(entry){if(entry.isIntersecting){visible.add(entry.target);pending.add(entry.target)}else visible.delete(entry.target)});
  flush();
},{rootMargin:'120px 0px'}):null;
function textWidth(el){var range=document.createRange();range.selectNodeContents(el);return range.getBoundingClientRect().width}
function fit(){
  scheduled=false;
  var batch=Array.from(pending);
  pending.clear();
  batch.forEach(function(el){
    if(!el.isConnected)return;
    var saved=original.get(el);
    if(!saved){saved={font:el.style.fontSize,max:el.style.maxWidth,width:el.style.width};original.set(el,saved)}
    el.style.fontSize=saved.font||'';el.style.maxWidth=saved.max||'';el.style.width=saved.width||'';el.classList.remove('uds-fit-text','uds-fit-text--wrap');
    var rect=el.getBoundingClientRect();
    if(rect.right<=0||rect.left>=innerWidth||rect.width<2)return;
    el.classList.add('uds-fit-text');
    var parent=el.parentElement,parentRect=parent&&parent.getBoundingClientRect(),parentStyle=parent&&getComputedStyle(parent);
    if(parent&&resizeObserver&&!observedParents.has(parent)){observedParents.add(parent);resizeObserver.observe(parent)}
    var padLeft=parseFloat(parentStyle&&parentStyle.paddingLeft)||0,padRight=parseFloat(parentStyle&&parentStyle.paddingRight)||0;
    var parentWidth=parent?Math.max(1,parent.clientWidth-padLeft-padRight):innerWidth-(parentRect?parentRect.left:rect.left)-16;
    var parentLeft=parentRect?parentRect.left+padLeft:rect.left;
    var available=Math.max(1,Math.min(parentWidth,innerWidth-Math.max(0,parentLeft)-16));
    if(available<24){el.style.maxWidth=available+'px';el.style.width=available+'px';el.classList.add('uds-fit-text--wrap');return}
    var cssMax=getComputedStyle(el).maxWidth,calcMatch=cssMax.match(/^calc\\(\\s*100%\\s*-\\s*([\\d.]+)px\\s*\\)$/);
    var parsedMax=cssMax.endsWith('%')?parentWidth*(parseFloat(cssMax)/100):calcMatch?parentWidth-parseFloat(calcMatch[1]):cssMax.startsWith('calc(')?available:parseFloat(cssMax);
    var limit=cssMax==='none'||!parsedMax||parsedMax<24?available:Math.min(parsedMax,available);
    el.style.maxWidth=limit+'px';
    el.style.width=Math.min(rect.width,limit,available)+'px';
    var style=getComputedStyle(el),padding=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0),border=(parseFloat(style.borderLeftWidth)||0)+(parseFloat(style.borderRightWidth)||0);
    var width=Math.max(1,el.clientWidth-padding-border),base=parseFloat(style.fontSize);
    if(!base||width<8)return;
    if(textWidth(el)<=width-6)return;
    var low=Math.min(base,1),high=base;
    for(var i=0;i<14;i++){var mid=(low+high)/2;el.style.fontSize=mid+'px';if(textWidth(el)<=width-6)low=mid;else high=mid}
    el.style.fontSize=Math.max(1,low)+'px';
    // Correct late browser font metric changes without doing layout work during scrolling.
    for(var pass=0;pass<4;pass++){
      var rendered=textWidth(el),contentWidth=Math.max(1,el.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0)-(parseFloat(style.borderLeftWidth)||0)-(parseFloat(style.borderRightWidth)||0));
      if(rendered<=contentWidth-8)break;
      var current=parseFloat(getComputedStyle(el).fontSize)||1;
      el.style.fontSize=Math.max(1,current*Math.max(.5,(contentWidth-10)/rendered))+'px';
    }
  });
}
function flush(){if(scheduled||!pending.size)return;scheduled=true;requestAnimationFrame(fit)}
function schedule(){if(visibilityObserver){visible.forEach(function(el){pending.add(el)});flush();return}document.querySelectorAll(selector).forEach(function(el){var r=el.getBoundingClientRect();if(r.bottom>=-120&&r.top<=innerHeight+120)pending.add(el)});flush()}
window.addEventListener('resize',schedule,{passive:true});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(schedule);
if(document.fonts&&document.fonts.addEventListener)document.fonts.addEventListener('loadingdone',schedule);
if(visibilityObserver)document.querySelectorAll(selector).forEach(function(el){visibilityObserver.observe(el)});
if('MutationObserver'in window)new MutationObserver(function(records){records.forEach(function(record){if(record.type==='characterData'){var el=record.target.parentElement?.closest(selector);if(el)pending.add(el)}else{if(record.target.nodeType===1){var parent=record.target.closest(selector);if(parent)pending.add(parent)}record.addedNodes.forEach(function(node){if(node.nodeType!==1)return;if(node.matches(selector)){pending.add(node);if(visibilityObserver)visibilityObserver.observe(node)}node.querySelectorAll?.(selector).forEach(function(el){if(visibilityObserver)visibilityObserver.observe(el);else pending.add(el)})})}});flush()}).observe(document.body,{subtree:true,childList:true,characterData:true});
if(!visibilityObserver)schedule();
})();`;
}
