(()=>{"use strict";
if(window.__CROW_PODCASTING_INTEGRATIONS_V1__)return;
window.__CROW_PODCASTING_INTEGRATIONS_V1__=true;
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
const CDN="https://js.stripe.com/v3/";
const state=window.CROW_INTEGRATIONS={supabase:"connecting",stripe:"connecting",realtime:"connecting",version:"1.0.0"};
const load=(src)=>new Promise((resolve,reject)=>{const old=[...document.scripts].find(s=>s.src===src);if(old){if(old.dataset.loaded==="1")return resolve();old.addEventListener("load",resolve,{once:true});old.addEventListener("error",reject,{once:true});return}const s=document.createElement("script");s.src=src;s.async=true;s.onload=()=>{s.dataset.loaded="1";resolve()};s.onerror=()=>reject(Error("Unable to load "+src));document.head.appendChild(s)});
const cfg=()=>window.CROW_CONFIG||{};
const emit=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail}));
function set(k,v){state[k]=v;emit("crow:integration",{...state,key:k,value:v})}
async function bootStripe(){
 try{
  const c=cfg();
  if(!c.stripePublishableKey){set("stripe","not_configured");return null}
  if(!window.Stripe)await load(CDN);
  window.CROW_STRIPE=window.Stripe(c.stripePublishableKey);
  set("stripe","ready");return window.CROW_STRIPE;
 }catch(e){state.stripe_error=e;set("stripe","error");return null}
}
async function bootSupabase(){
 try{
  const sb=window.CROW_SUPABASE||(window.CROW_BOOTSTRAP?await window.CROW_BOOTSTRAP():null);
  if(!sb){set("supabase","error");return null}
  set("supabase","ready");
  const auth=sb.auth;
  auth.onAuthStateChange((event,session)=>{window.__CROW_USER=session?.user||null;emit("crow:auth",{event,session,user:window.__CROW_USER})});
  return sb;
 }catch(e){state.supabase_error=e;set("supabase","error");return null}
}
async function track(eventName,property="sitewide",metadata={}){
 const sb=window.CROW_SUPABASE;if(!sb)return;
 try{
  const u=window.__CROW_USER||null;
  await sb.from("analytics_events").insert({
   user_id:u?.id||null,
   session_id:sessionStorage.getItem("crow_session_id")||null,
   event_name:String(eventName).slice(0,120),
   property:String(property||"sitewide").slice(0,120),
   page_url:location.href.slice(0,2000),
   content_id:null,content_type:"podcasting",
   watch_seconds:0,duration_seconds:null,
   metadata:{...metadata,path:location.pathname,referrer:document.referrer||null,ts:new Date().toISOString()}
  });
 }catch(_){}
}
async function session(){
 let id=sessionStorage.getItem("crow_session_id");
 if(!id){id=crypto.randomUUID();sessionStorage.setItem("crow_session_id",id)}
 window.CROW_SESSION_ID=id;
}
async function stripeFunction(functionName,payload={}){
 const sb=window.CROW_SUPABASE;if(!sb)throw Error("Supabase is not connected.");
 const {data}=await sb.auth.getSession();const token=data?.session?.access_token;
 if(!token)throw Error("Please sign in to continue.");
 const c=cfg(),endpoint=String(c.supabaseUrl||"").replace(/\/$/,"")+"/functions/v1/"+encodeURIComponent(functionName);
 const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,apikey:c.supabaseKey},body:JSON.stringify({origin:c.siteUrl||location.origin,payload})});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||d.message||"Stripe request failed.");
 return d;
}
window.CROW_STRIPE_CHECKOUT=async(functionName,payload)=>{const d=await stripeFunction(functionName,payload);if(d.url)location.href=d.url;else if(d.client_secret&&window.CROW_STRIPE)return window.CROW_STRIPE.redirectToCheckout({clientSecret:d.client_secret});return d};
window.CROW_STRIPE_PORTAL=async(functionName,payload)=>{const d=await stripeFunction(functionName,payload);if(d.url)location.href=d.url;return d};
function reconnect(){
 const sb=window.CROW_SUPABASE;if(!sb)return;
 try{sb.realtime.connect();set("realtime","connecting")}catch(_){}
}
function wire(){
 const sb=window.CROW_SUPABASE;if(!sb)return;
 sb.realtime?.onOpen?.(()=>set("realtime","ready"));
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")reconnect()},{passive:true});
 window.addEventListener("online",reconnect,{passive:true});
 document.querySelectorAll("[data-crow-event]").forEach(el=>{
  if(el.dataset.crowEventBound)return;el.dataset.crowEventBound="1";
  el.addEventListener("click",()=>track(el.dataset.crowEvent,el.dataset.crowProperty||"interaction",{target:el.dataset.crowTarget||el.textContent?.trim().slice(0,80)||""}),{passive:true});
 });
 set("realtime","ready");
}
async function start(){
 await session();
 const sb=await bootSupabase();
 await bootStripe();
 if(sb){wire();track("site_view","sitewide",{navigation_version:"12.3.2"})}
 emit("crow:integrations-ready",{...state});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();