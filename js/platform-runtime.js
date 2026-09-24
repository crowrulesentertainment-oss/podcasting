/* CrowRules Podcasting — Platform Runtime 4.0 */
(function(){
"use strict";
if(window.__CROWRULES_PLATFORM_RUNTIME_40__)return;
window.__CROWRULES_PLATFORM_RUNTIME_40__=true;
const root=document.documentElement;
const state={online:navigator.onLine};
function progress(width,done){
 let bar=document.querySelector(".cr-platform-progress");
 if(!bar){bar=document.createElement("div");bar.className="cr-platform-progress";bar.setAttribute("aria-hidden","true");document.body?.appendChild(bar)}
 bar.style.width=width+"%";
 if(done){bar.style.opacity="0";setTimeout(()=>bar.remove(),350)}
}
function toast(message){
 if(!message)return;
 let el=document.querySelector(".cr-platform-toast");
 if(!el){el=document.createElement("div");el.className="cr-platform-toast";el.setAttribute("role","status");el.setAttribute("aria-live","polite");document.body.appendChild(el)}
 el.textContent=String(message);el.classList.add("is-visible");
 clearTimeout(el.__timer);el.__timer=setTimeout(()=>el.classList.remove("is-visible"),3200);
}
function syncNetwork(){
 state.online=navigator.onLine;
 root.dataset.network=state.online?"online":"offline";
 window.dispatchEvent(new CustomEvent("crowrules:network-state",{detail:{online:state.online}}));
 if(!state.online)toast("You are offline. Changes may be delayed until your connection returns.");
 else if(document.readyState!=="loading")toast("Connection restored.");
}
function boot(){
 root.dataset.crowrulesPlatform="4.0";
 root.dataset.crowrulesPage=(location.pathname.split("/").pop()||"index.html").toLowerCase();
 progress(35,false);
 requestAnimationFrame(()=>{document.body.classList.add("cr-platform-ready");progress(72,false);setTimeout(()=>progress(100,true),120)});
 window.addEventListener("online",syncNetwork,{passive:true});
 window.addEventListener("offline",syncNetwork,{passive:true});
 document.addEventListener("click",e=>{
   const a=e.target.closest("a[href]");
   if(!a||a.target==="_blank"||a.hasAttribute("download")||a.href.startsWith("mailto:")||a.href.startsWith("tel:"))return;
   try{const u=new URL(a.href);if(u.origin===location.origin||u.origin==="https://crowrulesentertainment-oss.github.io"){progress(18,false);setTimeout(()=>progress(100,true),900)}}catch(_){}
 },true);
 window.CrowRulesPlatform={version:"4.0",toast,network:()=>state.online,progress};
 syncNetwork();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();