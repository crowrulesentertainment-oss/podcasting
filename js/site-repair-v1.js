/* CrowRules Podcasting — Site Repair Guard V1.0 */
(()=>{"use strict";
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
const hide=el=>{if(!el)return;el.classList.remove("loading","is-loading","active");el.setAttribute("aria-hidden","true");el.style.setProperty("display","none","important")};
function repairLoading(){
  const selectors=["#loadingScreen","#loading-screen","#pageLoading",".loading-screen",".page-loading",".app-loading","[data-loading-screen]","[data-crow-loading]"];
  selectors.forEach(sel=>document.querySelectorAll(sel).forEach(hide));
  document.querySelectorAll("[data-loading],[data-status]").forEach(el=>{
    const t=(el.textContent||"").trim().toLowerCase();
    if(/^(connecting|checking|loading|please wait)(\.\.\.)?$/.test(t)) {
      el.removeAttribute("aria-busy");
      if(window.CROW_SUPABASE_CONNECTION==="connected") el.textContent="READY";
    }
  });
}
function ensureShell(){
  if(!document.querySelector("[data-nav]")){
    const host=document.createElement("div");host.setAttribute("data-nav","");host.dataset.navOwner="crowrules-podcasting-nav-v7";
    document.body.prepend(host);
  }
  if(!document.querySelector('script[data-site-repair="v1"]')){
    const s=document.createElement("script");s.dataset.siteRepair="v1";s.src=BASE+"js/site-repair-v1.js?v=20261004-2";s.defer=true;document.head.appendChild(s);
  }
}
function boot(){
  repairLoading();
  window.addEventListener("crow:ready",repairLoading);
  window.addEventListener("crow:auth-changed",repairLoading);
  window.addEventListener("crow:supabase-connected",repairLoading);
  window.addEventListener("crow:supabase-error",repairLoading);
  window.addEventListener("online",repairLoading);
  setTimeout(repairLoading,2500);setTimeout(repairLoading,8000);setTimeout(repairLoading,15000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();