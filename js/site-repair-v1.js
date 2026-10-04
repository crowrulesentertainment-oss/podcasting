/* CrowRules Podcasting — Site Repair Guard V1.1 */
(()=>{"use strict";
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
const isLaunch=()=>/launch\.html$/i.test(location.pathname);
const hide=el=>{if(!el)return;el.classList.remove("loading","is-loading","active");el.setAttribute("aria-hidden","true");el.style.setProperty("display","none","important")};
function removeLaunchNavigation(){
 if(!isLaunch())return;
 document.querySelectorAll("[data-nav],.crv8,.crv8search,.top nav,.top .links").forEach(el=>el.remove());
 if(!document.getElementById("crow-launch-no-nav")){const s=document.createElement("style");s.id="crow-launch-no-nav";s.textContent="[data-nav],.crv8,.crv8search,.top nav,.top .links{display:none!important}";document.head.appendChild(s)}
}
function repairLoading(){
 const selectors=["#loadingScreen","#loading-screen","#pageLoading",".loading-screen",".page-loading",".app-loading","[data-loading-screen]","[data-crow-loading]"];
 selectors.forEach(sel=>document.querySelectorAll(sel).forEach(hide));
 document.querySelectorAll("[data-loading],[data-status]").forEach(el=>{const t=(el.textContent||"").trim().toLowerCase();if(/^(connecting|checking|loading|please wait)(\.\.\.)?$/.test(t)){el.removeAttribute("aria-busy");if(window.CROW_SUPABASE_CONNECTION==="connected")el.textContent="READY"}});
 removeLaunchNavigation();
}
function boot(){
 removeLaunchNavigation();repairLoading();
 window.addEventListener("crow:ready",repairLoading);window.addEventListener("crow:auth-changed",repairLoading);window.addEventListener("crow:supabase-connected",repairLoading);window.addEventListener("crow:supabase-error",repairLoading);window.addEventListener("online",repairLoading);
 if(isLaunch()){const observer=new MutationObserver(removeLaunchNavigation);observer.observe(document.documentElement,{childList:true,subtree:true})}
 setTimeout(repairLoading,2500);setTimeout(repairLoading,8000);setTimeout(repairLoading,15000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
