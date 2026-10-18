/* CrowRules Podcasting — responsive shared navigation enhancements.
 * Enhances existing navigation without replacing page-specific links or workflows.
 */
(()=>{"use strict";
if(window.__CROW_SITE_NAV__)return;window.__CROW_SITE_NAV__=true;
const MOBILE_QUERY="(max-width:950px)";
function enhance(){
 document.querySelectorAll(".topbar .nav,header .nav").forEach((nav,index)=>{
  if(nav.dataset.crNavReady==="true")return;
  const links=nav.querySelector(".links");
  if(!links)return;
  nav.dataset.crNavReady="true";
  links.id=links.id||"cr-site-links-"+index;
  let toggle=nav.querySelector("[data-cr-nav-toggle]");
  if(!toggle){
   toggle=document.createElement("button");
   toggle.type="button";toggle.dataset.crNavToggle="true";
   toggle.className="btn cr-nav-toggle";
   toggle.setAttribute("aria-controls",links.id);
   toggle.setAttribute("aria-expanded","false");
   toggle.setAttribute("aria-label","Open site navigation");
   toggle.innerHTML='<span aria-hidden="true">☰</span> <span class="cr-nav-toggle-label">MENU</span>';
   const brand=nav.querySelector(".brand");
   if(brand&&brand.nextSibling)nav.insertBefore(toggle,brand.nextSibling);else nav.appendChild(toggle);
  }
  const mobile=()=>window.matchMedia(MOBILE_QUERY).matches;
  const close=()=>{links.classList.remove("cr-nav-open");toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-label","Open site navigation");toggle.querySelector(".cr-nav-toggle-label").textContent="MENU";};
  const sync=()=>{if(mobile()){links.classList.remove("cr-nav-open");toggle.hidden=false;toggle.setAttribute("aria-expanded","false");}else{links.classList.remove("cr-nav-open");toggle.hidden=true;links.style.removeProperty("display");toggle.setAttribute("aria-expanded","false");}};
  toggle.addEventListener("click",()=>{const open=!links.classList.contains("cr-nav-open");links.classList.toggle("cr-nav-open",open);toggle.setAttribute("aria-expanded",String(open));toggle.setAttribute("aria-label",open?"Close site navigation":"Open site navigation");toggle.querySelector(".cr-nav-toggle-label").textContent=open?"CLOSE":"MENU";});
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
@media(max-width:950px){
 .topbar .nav,header .nav{position:relative;flex-wrap:wrap;gap:8px;padding-top:8px;padding-bottom:8px}
 .cr-nav-toggle{display:inline-flex!important;align-items:center;gap:7px;margin-left:auto;padding:10px 12px}
 .cr-nav-toggle[hidden]{display:none!important}
 .topbar .nav .links,header .nav .links{display:none;order:10;flex:0 0 100%;width:100%;max-width:100%;justify-content:flex-start;align-items:stretch;flex-direction:column;flex-wrap:nowrap;gap:4px;padding:8px 0 4px}
 .topbar .nav .links.cr-nav-open,header .nav .links.cr-nav-open{display:flex}
 .topbar .nav .links a,header .nav .links a{display:flex;align-items:center;min-height:42px;padding:11px 13px;font-size:12px}
 .topbar .nav .user,header .nav .user{display:flex;flex-wrap:wrap;gap:3px}
}
@media(prefers-reduced-motion:reduce){.cr-nav-toggle{transition:none!important}}
`;
document.head.appendChild(css);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enhance,{once:true});else enhance();
})();
