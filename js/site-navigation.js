/* CrowRules Podcasting — responsive shared navigation and reliable page transitions.
 * Enhances existing navigation without replacing page-specific links or workflows.
 */
(()=>{"use strict";
if(window.__CROW_SITE_NAV__)return;window.__CROW_SITE_NAV__=true;
/* Shared visual redesign: inject from the canonical repository root so nested pages resolve correctly. */
if(!document.querySelector('link[data-cr-sitewide-upgrade]')){
 const visual=document.createElement('link');
 visual.rel='stylesheet';visual.dataset.crSitewideUpgrade='true';
 visual.href='https://crowrulesentertainment-oss.github.io/podcasting/css/sitewide-upgrade.css?v=20261023-theme-hero-v2';
 (document.head||document.documentElement).appendChild(visual);
}
/* Bootstrap the shared theme engine on pages that only include navigation/sitewide helpers. */
if(!window.CrowRulesThemeSystem&&!document.querySelector('script[src*="/js/theme-system.js"]')){
 const themeScript=document.createElement('script');
 themeScript.src='https://crowrulesentertainment-oss.github.io/podcasting/js/theme-system.js?v=20261023-sitewide-sync';
 themeScript.async=true;
 themeScript.onerror=()=>console.warn('[CrowRules] Shared theme synchronization could not be loaded.');
 (document.head||document.documentElement).appendChild(themeScript);
}
const MOBILE_QUERY="(max-width:950px)";

function ensureThemeHero(){
 const KEY='crowrules-global-theme-v1',STUDIO_KEY='crowrules-theme-studio-v5';
 const defaults={id:'cyberwave',name:'Cyberwave',c1:'#00e5ff',c2:'#9c5cff',image:'',cat:'Originals',mood:'Cinematic'};
 const readTheme=()=>{try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');return raw&&typeof raw.name==='string'?{...defaults,...raw}:defaults}catch(_){return defaults}};
 let hero=document.querySelector('[data-cr-theme-hero]');
 if(!hero){
  hero=document.createElement('section');hero.dataset.crThemeHero='true';hero.className='cr-theme-hero';hero.setAttribute('aria-label','Current visual theme');
  hero.innerHTML='<div class="cr-theme-hero-art" aria-hidden="true"></div><div class="cr-theme-hero-content"><span class="cr-theme-hero-kicker">CROWRULES PODCASTING · THEME WORLD</span><h2 data-cr-theme-name>Cyberwave</h2><p data-cr-theme-copy>Your stories. Your atmosphere. One universe.</p><div class="cr-theme-hero-meta"><span data-cr-theme-category>ORIGINALS</span><span data-cr-theme-mood>CINEMATIC</span></div></div><a class="cr-theme-hero-cta" data-cr-theme-link href="theme-studio.html">Explore Theme Studio <span aria-hidden="true">↗</span></a>';
  const header=document.querySelector('body > header,body > .topbar,body > .top,body > nav,body > .site-header');
  const main=document.querySelector('body > main,body > #app,body > .shell,body > .page,body > .container,body > .content');
  if(header&&header.parentNode)header.parentNode.insertBefore(hero,header.nextSibling);
  else if(main&&main.parentNode)main.parentNode.insertBefore(hero,main);
  else document.body.prepend(hero);
 }
 const studioUrl=new URL('../theme-studio.html',document.currentScript?.src||'https://crowrulesentertainment-oss.github.io/podcasting/js/site-navigation.js').href;
 const paint=()=>{
  let t=readTheme();
  try{const state=JSON.parse(localStorage.getItem(STUDIO_KEY)||'null');if(state?.selectedTheme&&typeof state.selectedTheme.name==='string')t={...t,...state.selectedTheme};}catch(_){}
  const title=hero.querySelector('[data-cr-theme-name]'),cat=hero.querySelector('[data-cr-theme-category]'),mood=hero.querySelector('[data-cr-theme-mood]'),copy=hero.querySelector('[data-cr-theme-copy]'),art=hero.querySelector('.cr-theme-hero-art'),link=hero.querySelector('[data-cr-theme-link]');
  if(title)title.textContent=t.name||'Cyberwave';
  if(cat)cat.textContent=String(t.cat||'ORIGINALS').toUpperCase();
  if(mood)mood.textContent=String(t.mood||'CINEMATIC').toUpperCase();
  if(copy)copy.textContent=(t.name||'Cyberwave')+' theme is active across your CrowRules experience.';
  hero.style.setProperty('--cr-hero-a',/^#[0-9a-f]{6}$/i.test(t.c1||'')?t.c1:'#00e5ff');
  hero.style.setProperty('--cr-hero-b',/^#[0-9a-f]{6}$/i.test(t.c2||'')?t.c2:'#9c5cff');
  if(art){const image=typeof t.image==='string'&&/^https?:\/\//i.test(t.image)?t.image:'';art.style.backgroundImage=image?'linear-gradient(90deg,rgba(5,7,14,.9),rgba(5,7,14,.42)),url("'+image.replace(/["\\\\]/g,'')+'")':'radial-gradient(ellipse at 75% 18%, '+(t.c2||'#9c5cff')+'66, transparent 35%),radial-gradient(ellipse at 58% 100%, '+(t.c1||'#00e5ff')+'55, transparent 45%),linear-gradient(120deg,#080b16,#111027 58%,#080b16)';}
  if(link)link.href=studioUrl;
 };
 paint();
 window.addEventListener('storage',event=>{if(!event.key||event.key===KEY||event.key===STUDIO_KEY)paint()});
 window.addEventListener('crowrules-theme-state-loaded',paint);
 window.addEventListener('crowrules-theme-local-state',paint);
 window.addEventListener('crowrules:theme-changed',paint);
}

function enhance(){
 ensureThemeHero();
 /* Keep Awards discoverable throughout the podcasting site. Resolve from this shared script so nested pages get the correct root URL. */
 const awardsUrl=new URL('../awards.html',document.currentScript?.src||'https://crowrulesentertainment-oss.github.io/podcasting/js/site-navigation.js').href;
 const studioUrl=new URL('../theme-studio.html',document.currentScript?.src||'https://crowrulesentertainment-oss.github.io/podcasting/js/site-navigation.js').href;
 const rootUrl=new URL('../',document.currentScript?.src||'https://crowrulesentertainment-oss.github.io/podcasting/js/site-navigation.js');
 const globalLinks=[
  {label:'Home',file:'home.html',key:'home'},
  {label:'Shows & Episodes',file:'show.html',key:'shows'},
  {label:'Guests Lounge',file:'guests-lounge.html',key:'guests'},
  {label:'Creator Studio',file:'studio.html',key:'studio'},
  {label:'Community',file:'listener/community.html',key:'community'},
  {label:'Awards',file:'awards.html',key:'awards'},
  {label:'Theme Studio',file:'theme-studio.html',key:'themes'}
 ];
 const menus=new Set(document.querySelectorAll('header nav,header .links,header .nav-links,header .listener-links,nav[aria-label*=navigation],.home-top .home-actions,.home-actions,.top-actions,.header-actions,.main-nav,.primary-nav,nav .links,nav .nav-links,nav .listener-links,header .nav .links,header .nav-links'));
 menus.forEach(menu=>{
  if(!menu||!menu.querySelectorAll)return;
  if(menu.matches('.home-actions,.top-actions,.header-actions'))menu.dataset.crNavActions='true';
  globalLinks.forEach(item=>{
   const url=new URL(item.file,rootUrl).href;
   const exists=Array.from(menu.querySelectorAll('a[href]')).some(a=>{try{return new URL(a.href,location.href).pathname.replace(/\\/$/,'')===new URL(url).pathname.replace(/\\/$/,'')}catch(_){return false}});
   if(exists)return;
   const a=document.createElement('a');a.href=url;a.textContent=item.label;a.dataset.crGlobalNav=item.key;a.classList.add('cr-global-nav-link');
   if(item.key==='awards')a.dataset.crAwardsLink='true';
   if(item.key==='themes')a.dataset.crThemeStudioLink='true';
   if(item.key==='guests')a.dataset.crGuestsLoungeLink='true';
   menu.appendChild(a);
  });
 });
 document.querySelectorAll("header .nav,header .listener-nav,.topbar .nav,.top .nav,nav .nav,.nav").forEach((nav,index)=>{
  if(nav.dataset.crNavReady==="true")return;
  const links=nav.querySelector(".links,.nav-links,.listener-links,[aria-label*=navigation]");
  if(!links)return;
  nav.dataset.crNavReady="true";
  links.id=links.id||"cr-site-links-"+index;
  let toggle=nav.querySelector("[data-cr-nav-toggle]");
  if(!toggle){
   toggle=document.createElement("button");toggle.type="button";toggle.dataset.crNavToggle="true";
   toggle.className="btn cr-nav-toggle";toggle.setAttribute("aria-controls",links.id);
   toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-label","Open site navigation");
   toggle.innerHTML='<span aria-hidden="true">☰</span> <span class="cr-nav-toggle-label">MENU</span>';
   const brand=nav.querySelector(".brand");
   if(brand&&brand.nextSibling)nav.insertBefore(toggle,brand.nextSibling);else nav.appendChild(toggle);
  }
  const mobile=()=>window.matchMedia(MOBILE_QUERY).matches;
  const close=()=>{links.classList.remove("cr-nav-open");toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-label","Open site navigation");const label=toggle.querySelector(".cr-nav-toggle-label");if(label)label.textContent="MENU";};
  const sync=()=>{if(mobile()){toggle.hidden=false;toggle.setAttribute("aria-expanded","false");}else{links.classList.remove("cr-nav-open");toggle.hidden=true;links.style.removeProperty("display");toggle.setAttribute("aria-expanded","false");}};
  toggle.addEventListener("click",()=>{const open=!links.classList.contains("cr-nav-open");links.classList.toggle("cr-nav-open",open);toggle.setAttribute("aria-expanded",String(open));toggle.setAttribute("aria-label",open?"Close site navigation":"Open site navigation");const label=toggle.querySelector(".cr-nav-toggle-label");if(label)label.textContent=open?"CLOSE":"MENU";});
  links.addEventListener("click",event=>{if(event.target.closest("a")&&mobile())close();});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")close();});
  window.addEventListener("resize",sync,{passive:true});sync();
  const current=new URL(location.href);
  links.querySelectorAll("a[href]").forEach(a=>{try{const target=new URL(a.href,location.href);if(target.origin===current.origin&&target.pathname.replace(/\/$/,"")===current.pathname.replace(/\/$/,"")){a.setAttribute("aria-current","page");a.classList.add("cr-nav-current");}}catch(_){}});
 });
}
const css=document.createElement("style");
css.textContent=`
.cr-nav-toggle{display:none;flex:0 0 auto;white-space:nowrap;min-height:42px;padding:10px 15px;border:1px solid rgba(103,232,249,.42);border-radius:12px;background:linear-gradient(120deg,rgba(8,145,178,.18),rgba(109,40,217,.2));color:#eafaff;font-weight:850;letter-spacing:.09em;box-shadow:0 8px 24px rgba(0,0,0,.2)}
.cr-nav-toggle:focus-visible,.cr-global-nav-link:focus-visible{outline:2px solid #67e8f9;outline-offset:3px}
.cr-global-nav-link{white-space:nowrap}
header .nav .links,header .listener-nav .listener-links{align-items:center}
header .nav .links a[aria-current="page"],header .nav .links a.cr-nav-current{position:relative;color:#eafaff!important;background:linear-gradient(120deg,rgba(103,232,249,.13),rgba(167,139,250,.12));border-color:rgba(103,232,249,.38)!important}
header .nav .links a[aria-current="page"]:after,header .nav .links a.cr-nav-current:after{content:"";position:absolute;left:14px;right:14px;bottom:3px;height:2px;border-radius:2px;background:linear-gradient(90deg,#67e8f9,#a78bfa)}

.links a[aria-current="page"],.links a.cr-nav-current{color:#e7fcff!important;background:rgba(103,232,249,.11);box-shadow:inset 0 0 0 1px rgba(103,232,249,.2)}
.cr-awards-home-link{border-color:rgba(167,139,250,.42)!important;background:linear-gradient(110deg,rgba(103,232,249,.08),rgba(167,139,250,.13))!important}\n.cr-global-nav-link{white-space:nowrap}\n[data-cr-awards-link]{--cr-link-accent:#c4b5fd}\n[data-cr-theme-studio-link]{--cr-link-accent:#67e8f9}\n.cr-global-nav-link:hover{color:var(--cr-link-accent,#67e8f9)!important}\n@media(max-width:950px){
 .topbar .nav,header .nav,.top .nav,nav .nav,header .listener-nav{position:relative;display:flex;flex-wrap:wrap;gap:10px;padding:10px 0}
 header .nav .brand{min-width:0;max-width:calc(100% - 95px)}
 header .nav .brand small{display:block;line-height:1.35}
 header .nav .links.cr-nav-open{padding:12px;margin-top:4px;border:1px solid rgba(103,232,249,.2);border-radius:16px;background:rgba(5,9,21,.97);box-shadow:0 22px 48px rgba(0,0,0,.4);backdrop-filter:blur(18px)}
 .cr-nav-open a{border-radius:10px!important;border:1px solid transparent!important;background:rgba(255,255,255,.025)!important}
 .cr-nav-open a:hover,.cr-nav-open a:focus-visible{background:rgba(103,232,249,.09)!important;border-color:rgba(103,232,249,.25)!important}
 .cr-nav-toggle{display:inline-flex!important;align-items:center;gap:7px;margin-left:auto;padding:10px 12px}
 header .listener-nav{flex-wrap:wrap}
 .topbar .nav .links,header .nav .links,.top .nav .links,nav .nav .links,header .listener-nav .listener-links{display:none;order:10;flex:0 0 100%;width:100%;max-width:100%;justify-content:flex-start;align-items:stretch;flex-direction:column;flex-wrap:nowrap;gap:4px;padding:8px 0 4px}
 .topbar .nav .links.cr-nav-open,header .nav .links.cr-nav-open,.top .nav .links.cr-nav-open,nav .nav .links.cr-nav-open,header .listener-nav .listener-links.cr-nav-open{display:flex!important}
 .topbar .nav .links a,header .nav .links a,.top .nav .links a,nav .nav .links a,header .listener-nav .listener-links a{display:flex!important;align-items:center;min-height:42px;padding:11px 13px;font-size:12px}
 .cr-nav-toggle[hidden]{display:none!important}
 .topbar .nav .user,header .nav .user{display:flex;flex-wrap:wrap;gap:3px}
}
@media(prefers-reduced-motion:reduce){.cr-nav-toggle{transition:none!important}}
html.cr-page-leaving body{opacity:0;transform:translateY(3px)}
body{transition:opacity .12s ease,transform .12s ease}
@media(prefers-reduced-motion:reduce){body{transition:none!important}html.cr-page-leaving body{opacity:1;transform:none}}
`;
document.head.appendChild(css);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enhance,{once:true});else enhance();
/* Keep normal browser navigation semantics; only add a brief fade for ordinary same-tab links. */
document.addEventListener("click",event=>{
 const a=event.target.closest("a[href]");
 if(!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 if(a.target&&a.target!=="_self"||a.hasAttribute("download")||a.getAttribute("href")?.startsWith("#"))return;
 let target;try{target=new URL(a.href,location.href)}catch(_){return}
 if(target.origin!==location.origin||target.href===location.href||target.pathname===location.pathname&&target.search===location.search)return;
 if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 event.preventDefault();
 document.documentElement.classList.add("cr-page-leaving");
 window.setTimeout(()=>{location.href=target.href},110);
});
})();