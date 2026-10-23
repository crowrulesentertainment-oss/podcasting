/* CrowRules Podcasting — responsive shared navigation and reliable page transitions.
 * Enhances existing navigation without replacing page-specific links or workflows.
 */
(()=>{"use strict";
if(window.__CROW_SITE_NAV__)return;window.__CROW_SITE_NAV__=true;
/* Shared visual redesign: inject from the canonical repository root so nested pages resolve correctly. */
if(!document.querySelector('link[data-cr-sitewide-upgrade]')){
 const visual=document.createElement('link');
 visual.rel='stylesheet';visual.dataset.crSitewideUpgrade='true';
 visual.href='https://crowrulesentertainment-oss.github.io/podcasting/css/sitewide-upgrade.css?v=20261023-layout';
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
function enhance(){
 /* Keep Awards discoverable throughout the podcasting site. Resolve from this shared script so nested pages get the correct root URL. */
 const awardsUrl=new URL('../awards.html',document.currentScript?.src||'https://crowrulesentertainment-oss.github.io/podcasting/js/site-navigation.js').href;
 const studioUrl=new URL('../theme-studio.html',document.currentScript?.src||'https://crowrulesentertainment-oss.github.io/podcasting/js/site-navigation.js').href;
 const menus=new Set(document.querySelectorAll('header nav,header .links,header .nav-links,header .listener-links,nav[aria-label*=navigation],.home-top .home-actions,.home-actions,.top-actions,.header-actions,.main-nav,.primary-nav'));
 document.querySelectorAll('nav .links,nav .nav-links,nav .listener-links,header .nav .links,header .nav-links').forEach(menu=>menus.add(menu));
 menus.forEach(menu=>{
  if(!menu||!menu.querySelectorAll)return;
  if(!menu.querySelector('a[href*="awards.html"]')){
   const a=document.createElement('a');a.href=awardsUrl;a.textContent='Awards';a.setAttribute('data-cr-awards-link','true');a.classList.add('cr-global-nav-link');if(menu.classList.contains('home-actions'))a.classList.add('cr-awards-home-link');menu.appendChild(a);
  }
  if(!menu.querySelector('a[href*="theme-studio.html"]')){
   const a=document.createElement('a');a.href=studioUrl;a.textContent='Theme Studio';a.setAttribute('data-cr-theme-studio-link','true');a.classList.add('cr-global-nav-link');menu.appendChild(a);
  }
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
.cr-nav-toggle{display:none;flex:0 0 auto;white-space:nowrap}
.links a[aria-current="page"],.links a.cr-nav-current{color:#e7fcff!important;background:rgba(103,232,249,.11);box-shadow:inset 0 0 0 1px rgba(103,232,249,.2)}
.cr-awards-home-link{border-color:rgba(167,139,250,.42)!important;background:linear-gradient(110deg,rgba(103,232,249,.08),rgba(167,139,250,.13))!important}\n.cr-global-nav-link{white-space:nowrap}\n[data-cr-awards-link]{--cr-link-accent:#c4b5fd}\n[data-cr-theme-studio-link]{--cr-link-accent:#67e8f9}\n.cr-global-nav-link:hover{color:var(--cr-link-accent,#67e8f9)!important}\n@media(max-width:950px){
 .topbar .nav,header .nav,.top .nav,nav .nav,header .listener-nav{position:relative;flex-wrap:wrap;gap:8px;padding-top:8px;padding-bottom:8px}
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