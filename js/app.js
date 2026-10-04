(()=>{
"use strict";
const VERSION="12.0";
const BASE="https://crowrulesentertainment-oss.github.io/podcasting";
function ensureStyles(){
 if(document.getElementById("cr-shell-css"))return;
 const s=document.createElement("style");s.id="cr-shell-css";s.textContent=`.cr-offline{display:none;position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:12000;background:#21121a;border:1px solid #ff4f8b55;color:#ffd8e5;padding:8px 12px;border-radius:999px;font:800 9px Montserrat,sans-serif;text-transform:uppercase;letter-spacing:.04em}.cr-offline.show{display:block}.cr-toast{position:fixed;right:18px;bottom:22px;z-index:12001;max-width:min(420px,calc(100vw - 36px));padding:12px 15px;border:1px solid #55e7ff33;border-radius:12px;background:#090d17f5;color:#eaf3ff;box-shadow:0 18px 50px #0009;font:600 11px Montserrat,sans-serif;transform:translateY(18px);opacity:0;pointer-events:none;transition:.25s}.cr-toast.show{transform:none;opacity:1}.cr-toast.error{border-color:#ff4f8b66}`;
 document.head.appendChild(s);
}
function toast(message,type="info"){
 let el=document.getElementById("crToast");
 if(!el){el=document.createElement("div");el.id="crToast";el.className="cr-toast";document.body.appendChild(el)}
 el.textContent=String(message||"");el.className="cr-toast show"+(type==="error"?" error":"");
 clearTimeout(window.__CROW_TOAST_TIMER);window.__CROW_TOAST_TIMER=setTimeout(()=>el.classList.remove("show"),4200);
}
function ensureChrome(){
 if(!document.body)return;
 ensureStyles();
 let host=document.querySelector("[data-nav]");
 if(!host){host=document.createElement("div");host.dataset.nav="";document.body.prepend(host)}
 host.dataset.navOwner="crowrules-podcasting-nav-v7";
 if(!document.querySelector("script[data-podcasting-nav-v7]")){
  const s=document.createElement("script");s.src=BASE+"/js/podcasting-nav-v7.js?v=7.0.0";s.defer=true;s.dataset.podcastingNavV7="true";document.head.appendChild(s);
 }
 if(!document.getElementById("crOffline")){const o=document.createElement("div");o.id="crOffline";o.className="cr-offline";o.textContent="Offline — changes will resume when connection returns";document.body.appendChild(o)}
}
function setUser(user){
 window.__CROW_USER=user||null;window.__CROW_AUTH_READY=true;
 window.dispatchEvent(new CustomEvent("crow:auth-changed",{detail:{user,supabase:window.CROW_SUPABASE||null}}));
 window.dispatchEvent(new CustomEvent("crow:ready",{detail:{user,supabase:window.CROW_SUPABASE||null}}));
}
async function timeout(p,ms){let t;try{return await Promise.race([p,new Promise((_,reject)=>t=setTimeout(()=>reject(new Error("Supabase authentication timed out.")),ms))])}finally{clearTimeout(t)}}
async function start(){
 ensureChrome();
 try{
  const sb=window.CROW_SUPABASE||(typeof window.CROW_BOOTSTRAP==="function"?await window.CROW_BOOTSTRAP():null);
  if(!sb)throw new Error("Supabase client is unavailable.");
  window.CROW_SUPABASE=sb;
  const r=await timeout(sb.auth.getSession(),7000);setUser(r.data?.session?.user||null);
  if(!window.__CROW_AUTH_SUB){const sub=sb.auth.onAuthStateChange((event,session)=>{setUser(session?.user||null);if(event==="SIGNED_OUT")window.dispatchEvent(new CustomEvent("crow:signed-out"))});window.__CROW_AUTH_SUB=sub.data?.subscription}
  window.CROW_SUPABASE_CONNECTION="connected";window.CROW_SUPABASE_READY=Promise.resolve(sb);window.CROW_SUPABASE_PROMISE=window.CROW_SUPABASE_READY;window.__CROW_APP_VERSION=VERSION;
  return sb;
 }catch(error){
  window.__CROW_APP_ERROR=error;window.CROW_SUPABASE_CONNECTION="error";setUser(null);console.error("CrowRules shell:",error);toast(error.message||"Connection unavailable","error");return null;
 }
}
window.CROW_TOAST=toast;
window.CROW_APP_READY=window.CROW_SUPABASE_READY=start();
window.addEventListener("online",()=>document.getElementById("crOffline")?.classList.remove("show"));
window.addEventListener("offline",()=>document.getElementById("crOffline")?.classList.add("show"));
window.addEventListener("unhandledrejection",e=>{console.error(e.reason)});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ensureChrome,{once:true});else ensureChrome();
})();
