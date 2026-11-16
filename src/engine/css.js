// Стили генерируемой страницы. В итоговый HTML попадают только фрагменты выбранной концепции:
// токены проекта, навигация, hero и варианты блоков — поэтому страницы разных архитектур
// отличаются композицией, а не только значениями переменных.

export function tokensCss(vs) {
  const p = vs.palette, t = vs.typography, s = vs.shape;
  const space = { compact: 'clamp(44px, 6vw, 84px)', regular: 'clamp(56px, 8vw, 112px)', airy: 'clamp(60px, 9vw, 124px)' }[vs.layout.rhythm];
  const vw = Math.round((t.h1max - 1) * 1.25 * 100) / 100;
  const h2max = Math.round(Math.min(Math.max(t.h1max * 0.55, 1.7), 2.9) * 100) / 100;
  return `:root{color-scheme:${p.mode};--ds-bg:${p.bg};--ds-surface:${p.surface};--ds-text:${p.text};--ds-text-muted:${p.muted};--ds-border:${p.border};--ds-accent:${p.accent};--ds-accent-contrast:${p.accentText};--ds-focus:${p.focus};--ds-container:${vs.layout.container}px;--ds-section-space:${space};--ds-radius-sm:${s.sm};--ds-radius-md:${s.md};--ds-radius-lg:${s.lg};--ds-radius-pill:${s.button};--ds-font-body:${t.body};--ds-font-display:${t.display};--u-accent-ink:${p.accentInk};--u-tint:${p.tint};--u-dw:${t.weight};--u-dt:${t.tracking};--u-dc:${t.transform};--u-h1:clamp(${t.h1min}rem, calc(1rem + ${vw}vw), ${t.h1max}rem);--u-h2:clamp(1.45rem, calc(1rem + 1.9vw), ${h2max}rem);--u-h3:clamp(1.08rem, calc(1rem + .35vw), 1.3rem)}`;
}

export const BASE_CSS = `
html{-webkit-text-size-adjust:100%}
body{font-size:clamp(1rem,.96rem + .2vw,1.09rem);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-wrap:break-word}
h1,h2,h3{font-family:var(--ds-font-display);font-weight:var(--u-dw);letter-spacing:var(--u-dt);text-transform:var(--u-dc);line-height:1.06;margin:0 0 .5em;overflow-wrap:anywhere;text-wrap:balance}
@media(max-width:560px){h1,h2{hyphens:auto}}
h1{font-size:var(--u-h1)}h2{font-size:var(--u-h2);line-height:1.12}h3{font-size:var(--u-h3);line-height:1.25;letter-spacing:0}
p{margin:0 0 1em}p:last-child{margin-bottom:0}a{color:inherit}img,svg{max-width:100%}
ul[role=list],ol[role=list]{list-style:none;margin:0;padding:0}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.skip{position:absolute;left:8px;top:-80px;z-index:100;padding:10px 14px;background:var(--ds-surface);color:var(--ds-text);border-radius:var(--ds-radius-sm)}.skip:focus{top:8px}
.kicker{margin:0 0 1rem;font-size:.8rem;font-weight:650;letter-spacing:.12em;text-transform:uppercase;color:var(--u-accent-ink)}
.lede{max-width:56ch;font-size:1.14em;color:var(--ds-text-muted)}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:1.6rem}
.ds-button{max-width:100%;text-align:center;overflow-wrap:anywhere}
.price{font-weight:700;font-variant-numeric:tabular-nums;color:var(--ds-text)}
.visual{position:relative;width:100%;min-width:0;overflow:hidden;background:var(--u-tint);border-radius:var(--ds-radius-lg)}
.visual>.ds-media{position:absolute;inset:0}
.hero{position:relative}.hero h1{margin-bottom:.35em}
.sec__head{max-width:62ch;margin-bottom:clamp(24px,4vw,48px)}.sec__intro{color:var(--ds-text-muted);font-size:1.08em}
.item,.adv>li,.proc>li{min-width:0}
.item p,.adv p,.proc p{color:var(--ds-text-muted)}.item .price{margin-top:.6em}
.sec--about .about__text{max-width:64ch;font-size:1.12em}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:clamp(10px,1.6vw,20px)}
.gallery figure{margin:0}.gallery img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--ds-radius-md);background:var(--u-tint)}
.gallery figcaption{margin-top:8px;font-size:.9rem;color:var(--ds-text-muted)}
.faq{max-width:780px}.faq details{border-top:1px solid var(--ds-border)}.faq details:last-child{border-bottom:1px solid var(--ds-border)}
.faq summary{display:flex;justify-content:space-between;gap:16px;min-height:56px;align-items:center;padding:10px 0;font-weight:650;cursor:pointer;list-style:none}
.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:"+";font-size:1.4em;line-height:1;color:var(--u-accent-ink)}.faq details[open] summary::after{content:"–"}
.faq details p{padding:0 0 18px;max-width:62ch;color:var(--ds-text-muted)}
.sec--contact{background:var(--u-tint)}
.contact{display:grid;gap:clamp(24px,5vw,64px)}@media(min-width:860px){.contact--two{grid-template-columns:minmax(0,1fr) minmax(0,.9fr);align-items:start}}
.contact__list{display:grid;gap:10px;margin:1.4rem 0 0;padding:0;list-style:none}.contact__list a{display:inline-flex;align-items:center;min-height:44px;text-underline-offset:4px;overflow-wrap:anywhere}
.contact__list span{display:block;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ds-text-muted)}
.form{display:grid;gap:14px}.form label{display:grid;gap:6px;font-size:.92rem;font-weight:600}
.form .ds-field{font-weight:400}.form textarea.ds-field{min-height:96px;resize:vertical}
.foot{padding-block:28px;border-top:1px solid var(--ds-border);font-size:.92rem;color:var(--ds-text-muted)}
.foot .ds-container{display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between}
html.js-reveal [data-reveal]{opacity:0;transform:translateY(14px);transition:opacity var(--ds-duration-slow) var(--ds-ease),transform var(--ds-duration-slow) var(--ds-ease)}
html.js-reveal [data-reveal].is-in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){html.js-reveal [data-reveal]{opacity:1;transform:none}.ds-button:hover{transform:none}}
`;

export const BUTTON_CSS = {
  solid: '',
  outline: `.ds-button{background:transparent;color:var(--ds-text);border:2px solid var(--ds-text)}.ds-button:hover{background:var(--ds-text);color:var(--ds-bg)}.ds-button--secondary{border-width:1px;border-color:var(--ds-border)}`,
  block: `.ds-button{border:2px solid var(--ds-text);box-shadow:5px 5px 0 var(--ds-text);text-transform:uppercase;letter-spacing:.06em;font-weight:800}.ds-button:hover{transform:translate(2px,2px);box-shadow:3px 3px 0 var(--ds-text)}.ds-button--secondary{box-shadow:none}@media(max-width:480px){.ds-button{width:calc(100% - 5px)}.nav .ds-button{max-width:calc(100% - 5px)}}`,
  underline: `.ds-button{background:transparent;color:var(--ds-text);border:0;border-bottom:3px solid var(--ds-accent);border-radius:0;padding-inline:2px;justify-content:flex-start}.ds-button:hover{transform:none;border-bottom-color:var(--ds-text)}.ds-button--secondary{border-bottom:1px solid var(--ds-border)}@media(max-width:480px){.ds-button{width:auto}}`,
};

const NAV_BASE = `
.nav{display:flex;flex-wrap:wrap;align-items:center;gap:8px 28px;padding:12px var(--ds-gutter)}
.nav__brand{font-family:var(--ds-font-display);font-weight:var(--u-dw);font-size:1.3rem;letter-spacing:var(--u-dt);text-transform:var(--u-dc);text-decoration:none;display:inline-flex;align-items:center;min-height:44px;min-width:0;overflow-wrap:anywhere}
.nav__links{display:flex;gap:4px 22px;margin:0;padding:0;list-style:none;max-width:100%;overflow-x:auto;scrollbar-width:none}
.nav__links a{display:inline-flex;align-items:center;min-height:44px;font-size:.95rem;white-space:nowrap;text-decoration:none}
.nav__links a:hover{text-decoration:underline;text-underline-offset:6px}
.nav .ds-button{width:auto;min-height:44px;padding:8px 18px}
@media(max-width:760px){.nav__links{order:3;width:100%}}
`;

export const NAV_CSS = {
  bar: NAV_BASE + `.nav--bar{border-bottom:1px solid var(--ds-border)}.nav--bar .nav__links{margin-left:auto}@media(max-width:760px){.nav--bar .nav__cta{margin-left:auto}}`,
  masthead: NAV_BASE + `.nav--masthead{flex-direction:column;gap:6px;padding-top:22px;text-align:center}.nav--masthead .nav__brand{font-size:clamp(1.6rem,4vw,2.4rem)}.nav--masthead .nav__links{justify-content:center;width:100%;border-block:1px solid var(--ds-border);padding-block:2px}@media(max-width:560px){.nav--masthead .nav__links{justify-content:flex-start}}`,
  overlay: NAV_BASE + `.nav--overlay{position:absolute;inset:0 0 auto 0;z-index:5;color:#fff}.nav--overlay .nav__links{margin-left:auto}.nav--overlay a:focus-visible{outline-color:#fff}`,
  rail: NAV_BASE + `.nav--rail{border-bottom:1px solid var(--ds-border)}.nav--rail .nav__links{margin-left:auto}
@media(max-width:760px){.nav--rail .nav__cta{margin-left:auto}}
@media(min-width:1100px){body{padding-left:232px}.nav--rail{position:fixed;inset:0 auto 0 0;z-index:5;width:232px;flex-direction:column;flex-wrap:nowrap;align-items:flex-start;gap:20px;padding:32px 26px;border-bottom:0;border-right:1px solid var(--ds-border);background:var(--ds-bg);overflow-y:auto}.nav--rail .nav__links{flex-direction:column;gap:0;margin-left:0;overflow:visible}.nav--rail .nav__links a{white-space:normal}.nav--rail .nav__cta{margin-top:auto}}`,
  category: NAV_BASE + `.nav--category{border-bottom:1px solid var(--ds-border)}.nav--category .nav__links{margin-left:auto}@media(max-width:760px){.nav--category .nav__cta{margin-left:auto}}
.cats{display:flex;gap:8px;margin:0;padding:10px var(--ds-gutter);list-style:none;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--ds-border);background:var(--ds-surface)}
.cats a{display:inline-flex;align-items:center;min-height:40px;padding:6px 14px;border:1px solid var(--ds-border);border-radius:var(--ds-radius-pill);font-size:.9rem;white-space:nowrap;text-decoration:none}.cats a:hover{border-color:var(--ds-text)}`,
  minimal: NAV_BASE + `.nav--minimal{justify-content:space-between}`,
};

export const HERO_CSS = {
  'product-first': `
.hero--product-first{padding-block:clamp(28px,5vw,72px)}
.hero--product-first .hero__grid{display:grid;gap:clamp(24px,4vw,56px);align-items:center}
.spotlight{display:grid}.spotlight__media{position:relative;aspect-ratio:4/3;background:var(--u-tint)}.spotlight__media>.ds-media{position:absolute;inset:0}
.spotlight__body{display:grid;gap:8px;padding:clamp(16px,2.5vw,28px)}.spotlight__body h2{margin:0;font-size:var(--u-h3);letter-spacing:0;line-height:1.25}
.spotlight__body p{margin:0;color:var(--ds-text-muted)}.spotlight__body .ds-button{justify-self:start;margin-top:8px}
.spotlight__label{font-size:.78rem;letter-spacing:.1em;text-transform:uppercase}
@media(min-width:860px){.hero--product-first:not(.is-spotlight-stage) .hero__grid{grid-template-columns:minmax(0,1fr) minmax(0,.92fr)}.is-spotlight-left .spotlight{order:-1}
.is-spotlight-stage .hero__copy{order:2;text-align:center;justify-self:center}.is-spotlight-stage .lede{margin-inline:auto}.is-spotlight-stage .actions{justify-content:center}
.is-spotlight-stage .spotlight{grid-template-columns:1.5fr 1fr;align-items:center}.is-spotlight-stage .spotlight__media{aspect-ratio:auto;min-height:340px;height:100%}}`,
  editorial: `
.hero--editorial{padding-block:clamp(32px,6vw,88px) clamp(28px,4vw,56px)}
.hero--editorial .kicker{display:flex;align-items:center;gap:14px}.hero--editorial .kicker::after{content:"";flex:1;height:1px;background:var(--ds-border)}
.hero__cols{display:grid;gap:20px 48px;margin-block:clamp(20px,3vw,36px)}
.dropcap::first-letter{float:left;font-family:var(--ds-font-display);font-size:3.3em;line-height:.82;padding:.06em .1em 0 0;color:var(--u-accent-ink)}
.hero__aside{align-self:end}.hero__aside p{font-size:.95rem;color:var(--ds-text-muted)}.hero__aside .actions{margin-top:.8rem}
.hero__figure{margin:0;aspect-ratio:16/9}@media(min-width:800px){.hero__figure{aspect-ratio:16/7}}
.is-headline-over-figure h1{text-align:center;max-width:16ch;margin-inline:auto}
@media(min-width:800px){.is-headline-over-figure .hero__cols{grid-template-columns:1.4fr 1fr}}
@media(min-width:900px){.is-column-and-plate .ds-container{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.78fr);column-gap:clamp(32px,5vw,80px);align-content:start}
.is-column-and-plate h1{font-size:clamp(2.2rem,calc(1rem + 3.4vw),4.4rem)}.is-column-and-plate .hero__figure{grid-column:2;grid-row:1/span 3;aspect-ratio:auto;height:100%;min-height:clamp(420px,44vw,620px)}.is-column-and-plate .hero__cols{align-self:start}}`,
  immersive: `
.hero--immersive{display:flex;min-height:min(100svh,920px);color:#fff;background:#111;overflow:hidden}
.hero__bg{position:absolute;inset:-4% 0;will-change:transform}.hero__bg>.ds-media{position:absolute;inset:0}
.hero__scrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.84),rgba(0,0,0,.56) 55%,rgba(0,0,0,.66))}
.is-bleed-center .hero__scrim{background:rgba(0,0,0,.66)}
.hero--immersive .hero__content{position:relative;z-index:1;align-self:flex-end;padding-block:132px clamp(40px,8vw,96px)}
.hero--immersive .kicker,.hero--immersive .lede{color:#fff}.hero--immersive .ds-button--secondary{color:#fff;border-color:rgba(255,255,255,.7)}
.hero--immersive :focus-visible{outline-color:#fff}
.is-bleed-center .hero__content{align-self:center;text-align:center}.is-bleed-center .lede{margin-inline:auto}.is-bleed-center .actions{justify-content:center}
@media(max-width:600px){
.hero--immersive{min-height:min(88svh,760px)}
.hero__scrim{background:linear-gradient(to top,rgba(0,0,0,.9) 0%,rgba(0,0,0,.76) 48%,rgba(0,0,0,.34) 100%)}
.is-bleed-center .hero__scrim{background:linear-gradient(to top,rgba(0,0,0,.88),rgba(0,0,0,.58))}
.hero--immersive .hero__content{width:100%;padding-block:104px 36px}
.hero--immersive h1{max-width:14ch;font-size:clamp(2rem,9vw,3.2rem);line-height:1.06;text-wrap:balance}
.hero--immersive .lede{max-width:42ch;font-size:1rem}
.hero--immersive .actions .ds-button{min-height:48px}
}`,
  asymmetric: `
.hero--asymmetric{padding-block:clamp(28px,5vw,72px)}
.hero__canvas{display:grid;gap:24px}.hero__canvas .visual{aspect-ratio:4/3}
.hero__note{max-width:44ch}.hero__tag{margin:0;padding:14px 18px;border-left:4px solid var(--ds-accent);background:var(--ds-surface);font-size:.95rem}
@media(min-width:900px){.hero__canvas{grid-template-columns:repeat(12,minmax(0,1fr));gap:0 24px;align-items:start}
.hero__canvas h1{position:relative;z-index:1;grid-row:1;margin:clamp(24px,5vw,72px) 0 0;padding-bottom:clamp(20px,3vw,40px);background:var(--ds-bg)}
.hero__canvas .visual{grid-row:1/span 3;aspect-ratio:auto;min-height:clamp(440px,48vw,640px)}
.hero__note{grid-row:2}.hero__tag{grid-row:3;align-self:end;margin-top:28px}
.is-offset-right h1{grid-column:1/10;padding-right:clamp(20px,3vw,40px)}.is-offset-right .visual{grid-column:6/13}.is-offset-right .hero__note,.is-offset-right .hero__tag{grid-column:1/6}
.is-offset-left h1{grid-column:5/13;padding-left:clamp(20px,3vw,40px)}.is-offset-left .visual{grid-column:1/8}.is-offset-left .hero__note,.is-offset-left .hero__tag{grid-column:8/13}}`,
  catalog: `
.hero--catalog{padding-block:clamp(20px,3.5vw,44px);background:var(--ds-surface);border-bottom:1px solid var(--ds-border)}
.hero__wrap{display:grid;gap:clamp(18px,3vw,36px)}.hero--catalog .lede{font-size:1.02em}
.search{display:flex;gap:8px;margin-top:1.2rem;max-width:520px}.search .ds-field{flex:1;min-width:0}
.search__status{margin:.5rem 0 0;font-size:.88rem;color:var(--ds-text-muted);min-height:1.4em}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:10px}
.tiles a{display:grid;align-content:space-between;gap:18px;height:100%;min-height:104px;padding:14px;border:1px solid var(--ds-border);border-radius:var(--ds-radius-md);background:var(--ds-bg);font-weight:650;line-height:1.25;text-decoration:none}
.tiles a:hover{border-color:var(--ds-accent);background:var(--u-tint)}.tiles .n{font-size:.78rem;font-weight:500;color:var(--ds-text-muted);font-variant-numeric:tabular-nums}
@media(min-width:960px){.is-tiles-beside-copy .hero__wrap{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);align-items:center}}`,
  'split-utility': `
.hero--split-utility{padding-block:clamp(28px,5vw,80px)}
.hero__split{display:grid;gap:clamp(24px,4vw,64px);align-items:center}
.checks{display:grid;gap:8px;margin:1.6rem 0 0;padding:0;list-style:none}.checks li{display:flex;gap:10px}.checks li::before{content:"";flex:none;width:10px;height:10px;margin-top:.55em;border-radius:50%;background:var(--ds-accent)}
.tool{padding:clamp(18px,3vw,32px);overflow:visible}.tool__title{font-size:var(--u-h3);letter-spacing:0;line-height:1.25}
.picker{display:grid;margin:0 0 18px;padding:0;list-style:none}
.picker a{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:52px;padding:8px 0;border-bottom:1px solid var(--ds-border);text-decoration:none}
.picker a::after{content:"→";color:var(--u-accent-ink)}.picker a:hover{color:var(--u-accent-ink)}
.tool .ds-button{width:100%}
@media(min-width:880px){.hero__split{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)}.is-tool-left .tool{order:-1}}`,
  storytelling: `
.hero--storytelling{padding-top:clamp(40px,8vw,120px)}
.chapter-no{margin:0 0 1.2rem;font-family:var(--ds-font-display);font-size:.95rem;letter-spacing:.08em;color:var(--u-accent-ink)}
.hero--storytelling h1{max-width:18ch}
.chapters{display:grid;gap:0;margin:clamp(28px,5vw,56px) 0 0;padding:0;list-style:none;border-top:1px solid var(--ds-border)}
.chapters a{display:flex;gap:14px;align-items:baseline;min-height:52px;padding:14px 0;border-bottom:1px solid var(--ds-border);text-decoration:none}
.chapters a:hover{color:var(--u-accent-ink)}.chapters .n{font-size:.8rem;color:var(--ds-text-muted);font-variant-numeric:tabular-nums}
.hero__band{position:relative;height:clamp(140px,26vw,340px);margin-top:clamp(32px,6vw,72px);background:var(--u-tint);overflow:hidden}.hero__band>.ds-media{position:absolute;inset:0}
@media(min-width:760px){.is-chapter-index .chapters{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));column-gap:24px}}
@media(min-width:960px){.is-chapter-side .hero__story{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,.7fr);column-gap:clamp(40px,6vw,96px);align-items:end}.is-chapter-side .chapters{margin-top:0}}
body{counter-reset:chapter 1}.sec h2::before{counter-increment:chapter;content:counter(chapter,decimal-leading-zero);display:block;margin-bottom:.9em;font-size:.9rem;letter-spacing:.08em;color:var(--u-accent-ink)}`,
  'modular-grid': `
.hero--modular-grid{padding-block:clamp(16px,2.5vw,32px)}
.bento{display:grid;gap:clamp(10px,1.4vw,18px)}
.bento__cell{min-width:0;padding:clamp(18px,2.6vw,32px);border-radius:var(--ds-radius-lg);background:var(--ds-surface);border:1px solid var(--ds-border)}
.bento__head{display:grid;align-content:end;min-height:clamp(240px,34vw,420px);background:var(--u-tint);border-color:transparent}
.bento__visual{position:relative;min-height:200px;padding:0;overflow:hidden}.bento__visual>.ds-media{position:absolute;inset:0}
.bento__cta{display:flex;justify-content:space-between;align-items:center;gap:16px;min-height:84px;background:var(--ds-accent);color:var(--ds-accent-contrast);border-color:transparent;font-size:1.2rem;font-weight:700;text-decoration:none}
.bento__cta:hover span:last-child{transform:translateX(4px)}.bento__cta span:last-child{transition:transform var(--ds-duration-base) var(--ds-ease)}
.bento__entry{display:grid;gap:6px;align-content:start;text-decoration:none}.bento__entry:hover{border-color:var(--ds-accent)}
.bento__entry .n{font-size:.78rem;color:var(--ds-text-muted)}.bento__entry strong{font-size:1.08rem;line-height:1.25}.bento__entry span:last-child{font-size:.93rem;color:var(--ds-text-muted)}
@media(min-width:860px){.bento{grid-template-columns:repeat(6,minmax(0,1fr))}.bento__head{grid-column:span 4}.bento__visual{grid-column:span 2}.bento__entry{grid-column:span 2}.bento__cta{grid-column:1/-1}
.bento--n1 .bento__cta{grid-column:span 4}.bento--n2 .bento__cta{grid-column:span 2}
.is-bento-visual-first .bento__visual{order:-1;grid-column:span 3}.is-bento-visual-first .bento__head{grid-column:span 3}}`,
  brutalist: `
.hero--brutalist{padding:clamp(12px,2vw,24px) var(--ds-gutter)}
.hero__frame{border:3px solid var(--ds-text)}
.brut__top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 20px;padding:10px clamp(12px,2vw,24px);border-bottom:3px solid var(--ds-text);font-size:.8rem;letter-spacing:.1em;text-transform:uppercase}
.hero--brutalist h1{margin:0;padding:clamp(20px,4vw,56px) clamp(12px,2vw,24px);line-height:.92}
.brut__side{display:grid;gap:22px;align-content:space-between;padding:clamp(16px,2.5vw,32px) clamp(12px,2vw,24px);border-top:3px solid var(--ds-text);background:var(--ds-accent);color:var(--ds-accent-contrast)}
.brut__side .lede{color:inherit;margin:0}.brut__side .ds-button{background:var(--ds-accent-contrast);color:var(--ds-accent);border-color:var(--ds-accent-contrast);box-shadow:none}
.brut__side :focus-visible{outline-color:var(--ds-accent-contrast)}
.brut__index{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));margin:0;padding:0;list-style:none;border-top:3px solid var(--ds-text)}
.brut__index a{display:flex;gap:10px;align-items:center;min-height:56px;padding:10px clamp(12px,2vw,24px);font-weight:700;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;box-shadow:inset -3px 0 0 var(--ds-text)}
.brut__index a:hover{background:var(--ds-text);color:var(--ds-bg)}.brut__index .n{font-weight:400}
@media(min-width:900px){.is-type-and-block .brut__main{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}.is-type-and-block .brut__side{border-top:0;border-left:3px solid var(--ds-text)}
.is-type-wall .brut__side{grid-template-columns:1fr auto;align-items:center}}
.sec{border-top:3px solid var(--ds-text)}.ds-card{border-width:2px;border-color:var(--ds-text)}`,
  minimal: `
.hero--minimal{padding-block:clamp(56px,12vw,168px)}
.hero__stack>*{max-width:780px}.is-center-stack .hero__stack{text-align:center}.is-center-stack .hero__stack>*{margin-inline:auto}
.is-center-stack .actions,.is-center-stack .proof{justify-content:center}
.proof{display:flex;flex-wrap:wrap;gap:8px 24px;margin:2.2rem 0 0;padding:0;list-style:none;font-size:.92rem;color:var(--ds-text-muted)}
.proof li{display:flex;gap:8px;align-items:center}.proof li::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ds-accent)}`,
};

export const ITEMS_CSS = {
  cards: `.items--cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:clamp(12px,2vw,24px)}.items--cards .item{padding:clamp(18px,2.4vw,28px);border:1px solid var(--ds-border);border-radius:var(--ds-radius-lg);background:var(--ds-surface)}`,
  product: `.items--product{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:clamp(12px,2vw,24px)}.items--product .item{display:flex;flex-direction:column;border:1px solid var(--ds-border);border-radius:var(--ds-radius-lg);background:var(--ds-surface);overflow:hidden}
.item__media{aspect-ratio:4/3;background:var(--u-tint)}.items--product .item__body{display:flex;flex-direction:column;flex:1;padding:clamp(14px,2vw,22px)}.items--product .price{margin-top:auto;padding-top:.8em;font-size:1.15rem}`,
  rules: `.items--rules .item{display:grid;gap:6px 40px;padding-block:clamp(18px,2.6vw,30px);border-top:1px solid var(--ds-border)}.items--rules .item:last-child{border-bottom:1px solid var(--ds-border)}.items--rules h3{margin:0;font-family:var(--ds-font-display);font-size:clamp(1.2rem,1rem + 1vw,1.7rem);letter-spacing:var(--u-dt)}
@media(min-width:760px){.items--rules .item__body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:40px;align-items:baseline}}`,
  numbered: `.items--numbered{counter-reset:item;display:grid;gap:0}.items--numbered .item{counter-increment:item;display:grid;grid-template-columns:auto minmax(0,1fr);gap:clamp(14px,3vw,40px);padding-block:clamp(18px,3vw,34px);border-top:1px solid var(--ds-border)}
.items--numbered .item::before{content:counter(item,decimal-leading-zero);font-family:var(--ds-font-display);font-size:clamp(1.6rem,1rem + 3vw,3.4rem);font-weight:var(--u-dw);line-height:1;color:var(--u-accent-ink);min-width:1.6em}`,
  bento: `.items--bento{display:grid;gap:clamp(10px,1.4vw,18px)}.items--bento .item{padding:clamp(18px,2.6vw,32px);border-radius:var(--ds-radius-lg);background:var(--ds-surface);border:1px solid var(--ds-border)}
.items--bento .item:nth-child(4n+1){background:var(--u-tint);border-color:transparent}
@media(min-width:760px){.items--bento{grid-template-columns:repeat(6,minmax(0,1fr))}.items--bento .item{grid-column:span 2}.items--bento .item:nth-child(4n+1),.items--bento .item:nth-child(4n){grid-column:span 4}.items--bento .item:last-child:nth-child(3n+1){grid-column:1/-1}}`,
  menu: `.items--menu{display:grid;gap:0 clamp(32px,6vw,80px)}.items--menu .item{padding-block:16px;border-bottom:1px dashed var(--ds-border)}
.items--menu .item__body{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 16px;align-items:baseline}.items--menu h3{margin:0;font-family:var(--ds-font-display);letter-spacing:var(--u-dt)}
.items--menu p{grid-column:1;margin:0;font-size:.95rem}.items--menu .price{grid-column:2;grid-row:1;margin:0}
@media(min-width:760px){.items--menu{grid-template-columns:repeat(2,minmax(0,1fr))}}`,
};

export const ADV_CSS = {
  inline: `.adv--inline{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:clamp(20px,3vw,40px)}.adv--inline>li{padding-top:18px;border-top:2px solid var(--ds-accent)}`,
  cards: `.adv--cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:clamp(12px,2vw,20px)}.adv--cards>li{padding:clamp(18px,2.4vw,28px);border-radius:var(--ds-radius-lg);background:var(--u-tint)}`,
  statement: `.adv--statement>li{display:grid;gap:6px 48px;padding-block:clamp(18px,3vw,36px);border-top:1px solid var(--ds-border)}.adv--statement h3{margin:0;font-family:var(--ds-font-display);font-size:clamp(1.4rem,1rem + 2.2vw,2.6rem);font-weight:var(--u-dw);letter-spacing:var(--u-dt);line-height:1.1}
@media(min-width:800px){.adv--statement>li{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);align-items:baseline}}`,
};

export const PROC_CSS = {
  steps: `.proc--steps{counter-reset:step;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:clamp(20px,3vw,36px)}.proc--steps>li{counter-increment:step}
.proc--steps>li::before{content:counter(step);display:grid;place-items:center;width:44px;height:44px;margin-bottom:14px;border-radius:var(--ds-radius-pill);background:var(--ds-accent);color:var(--ds-accent-contrast);font-weight:700}`,
  timeline: `.proc--timeline{counter-reset:step;max-width:760px;border-left:2px solid var(--ds-border)}.proc--timeline>li{counter-increment:step;position:relative;padding:0 0 clamp(24px,4vw,40px) clamp(24px,4vw,44px)}.proc--timeline>li:last-child{padding-bottom:0}
.proc--timeline>li::before{content:"";position:absolute;left:-8px;top:.35em;width:14px;height:14px;border-radius:50%;background:var(--ds-accent);box-shadow:0 0 0 4px var(--ds-bg)}
.proc--timeline h3::before{content:counter(step,decimal-leading-zero) " — ";color:var(--u-accent-ink)}`,
};
