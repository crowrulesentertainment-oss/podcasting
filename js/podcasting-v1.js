(()=>{"use strict";
if(window.__CROW_PODCASTING_V1__)return;
window.__CROW_PODCASTING_V1__=true;
const VERSION="1.0.0",BASE="/podcasting/";
const log=(...a)=>{try{console.debug("[CrowRules Podcasting V1]",...a)}catch(_){}};
const ready=async()=>{try{if(window.CROW_CONFIG_CLIENT_READY)await window.CROW_CONFIG_CLIENT_READY;else if(window.CROW_DB_READY)await window.CROW_DB_READY;return window.CROW_SUPABASE||null}catch(e){window.dispatchEvent(new CustomEvent("crow:v1:error",{detail:{area:"supabase",error:e}}));return null}};
const normalize=(url)=>{if(!url)return BASE;try{const u=new URL(url,location.href);if(u.origin===location.origin&&u.pathname.startsWith(BASE))return u.href;return url}catch(_){return url}};
function mark(){document.documentElement.dataset.crowPodcastingVersion=VERSION;document.body?.setAttribute("data-crow-podcasting-version",VERSION)}
function nav(){const n=document.querySelector(".cr-universal-nav");if(n){n.setAttribute("data-crow-v1-nav","true");document.querySelectorAll(".cr-nav-menu a,.cr-nav-link").forEach(a=>{if(a.dataset.crowV1)return;a.dataset.crowV1="1";a.href=normalize(a.getAttribute("href"))});}}
function player(){const p=document.querySelector(".cr-universal-player,.cr13-player");if(p)p.setAttribute("data-crow-v1-player","true");}
function stripe(){window.CROW_STRIPE=window.CROW_STRIPE||{version:"2026-08-26.dahlia",checkout:async({functionName,body})=>{const sb=await ready();if(!sb)throw Error("Supabase is not ready.");const fn=functionName||window.CROW_CONFIG?.podcastCheckoutFunction||"create-podcast-checkout";const r=await sb.functions.invoke(fn,{body:body||{}});if(r.error)throw r.error;if(!r.data?.url)throw Error(r.data?.error||"Checkout URL was not returned.");location.href=r.data.url;}}}
function health(){const run=async()=>{const sb=await ready();window.CROW_PODCASTING_V1={version:VERSION,supabase:!!sb,stripe:!!window.CROW_STRIPE,player:!!document.querySelector("[data-crow-v1-player]"),nav:!!document.querySelector("[data-crow-v1-nav]")};window.dispatchEvent(new CustomEvent("crow:v1:ready",{detail:window.CROW_PODCASTING_V1}));log(window.CROW_PODCASTING_V1)};setTimeout(run,0)}
window.addEventListener("error",e=>{if(/supabase|stripe|podcast/i.test(String(e.message||"")))log("runtime",e.message)});
window.addEventListener("unhandledrejection",e=>{if(/supabase|stripe|podcast/i.test(String(e.reason?.message||e.reason||"")))log("promise",e.reason)});
function boot(){mark();nav();player();stripe();health()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();