(()=>{
"use strict";
const VERSION="11.1";
const BASE="https://crowrulesentertainment-oss.github.io/podcasting";
function css(){if(document.getElementById("cr-shell-css"))return;const s=document.createElement("style");s.id="cr-shell-css";s.textContent=`
.nav-search{border:1px solid #ffffff16;background:#ffffff08;color:#cbd3e5;border-radius:9px;padding:7px 9px;font:600 9px Montserrat;cursor:pointer;white-space:nowrap}.nav-search kbd{font:600 8px Montserrat;color:#78849b;margin-left:5px}.nav-account-action{width:100%;margin-top:4px;border:1px solid #ffffff10;background:#ffffff06;color:#dbe5f7;border-radius:8px;padding:10px;text-align:left;font:600 10px Montserrat;cursor:pointer}.nav-account-action:hover{background:#55e7ff0d;color:#fff}.cr-loading{position:fixed;inset:0;z-index:9999;background:#05050bf5;display:grid;place-items:center;transition:opacity .3s}.cr-loading.done{opacity:0;pointer-events:none}.cr-loading-box{text-align:center;color:#9eabc2;font:600 10px Montserrat;letter-spacing:.16em;text-transform:uppercase}.cr-loading-dot{width:34px;height:34px;margin:0 auto 14px;border:2px solid #ffffff12;border-top-color:#55e7ff;border-right-color:#a66cff;border-radius:50%;animation:crspin .8s linear infinite}@keyframes crspin{to{transform:rotate(360deg)}}.cr-toast{position:fixed;right:18px;bottom:24px;z-index:10000;max-width:min(420px,calc(100vw - 36px));padding:12px 15px;border:1px solid #55e7ff33;border-radius:12px;background:#090d17f5;color:#eaf3ff;box-shadow:0 18px 50px #0009;font:600 11px Montserrat;transform:translateY(20px);opacity:0;transition:.25s}.cr-toast.show{transform:none;opacity:1}.cr-toast.error{border-color:#ff4f8b55}.cr-search-modal{position:fixed;inset:0;z-index:10001;background:#03040acc;backdrop-filter:blur(14px);display:none;place-items:start center;padding:12vh 18px}.cr-search-modal.open{display:grid}.cr-search-box{width:min(680px,100%);background:#0a0e18;border:1px solid #ffffff18;border-radius:20px;padding:18px;box-shadow:0 30px 100px #000b}.cr-search-box input{width:100%;background:#050811;border:1px solid #55e7ff33;color:#fff;border-radius:12px;padding:16px;font:600 15px Montserrat;outline:none}.cr-search-hint{color:#748198;font-size:9px;margin:10px 3px 0}.cr-search-results{display:grid;gap:6px;margin-top:12px}.cr-search-results a{padding:11px 12px;border-radius:9px;color:#dce5f4;text-decoration:none;font-size:11px}.cr-search-results a:hover{background:#55e7ff0b}.cr-offline{display:none;position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:10001;background:#21121a;border:1px solid #ff4f8b55;color:#ffd8e5;padding:8px 12px;border-radius:999px;font-size:9px;font-weight:800;text-transform:uppercase}.cr-offline.show{display:block}@media(max-width:850px){.nav-search{display:none}.nav-user{display:none}}
`;document.head.appendChild(s)}
function ensureStyles(){if(![...document.querySelectorAll('link[rel="stylesheet"]')].some(l=>/podcasting\.css(?:\?|$)/.test(l.href||""))){const l=document.createElement("link");l.rel="stylesheet";l.href=`${BASE}/css/podcasting.css?v=8`;document.head.appendChild(l)}}
function ensureChrome(){
 css();ensureStyles();
 if(!document.body)return;
 let host=document.querySelector("[data-nav]");
 if(!host){host=document.createElement("div");host.dataset.nav="";document.body.prepend(host)}
 host.dataset.navOwner="crowrules-podcasting-nav-v7";
 if(!document.querySelector('script[data-podcasting-nav-v7]')){
  const ns=document.createElement("script");
  ns.src=BASE+"/js/podcasting-nav-v7.js?v=7.0.0";
  ns.defer=true;ns.dataset.podcastingNavV7="true";
  document.head.appendChild(ns);
 }
 if(!document.getElementById("crOffline")){
  const o=document.createElement("div");o.id="crOffline";o.className="cr-offline";
  o.textContent="Offline — changes will resume when connection returns";document.body.appendChild(o);
 }
};
function timeout(p,ms,msg){let t;return Promise.race([p,new Promise((_,r)=>t=setTimeout(()=>r(Error(msg)),ms))]).finally(()=>clearTimeout(t))}
function setUser(user){window.__CROW_USER=user||null;window.__CROW_AUTH_READY=true;const name=user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email||"Member";const n=document.getElementById("navUser"),si=document.getElementById("crSignIn"),so=document.getElementById("crSignOut");if(n)n.textContent=user?name:"Guest";if(si)si.hidden=!!user;if(so)so.hidden=!user;window.dispatchEvent(new CustomEvent("crow:auth-changed",{detail:{user,supabase:window.CROW_SUPABASE}}));window.dispatchEvent(new CustomEvent("crow:ready",{detail:{user,supabase:window.CROW_SUPABASE}}))}
async function auth(sb){try{const r=await timeout(sb.auth.getSession(),7000,"Supabase authentication timed out.");setUser(r.data?.session?.user||null)}catch(e){console.warn(e);setUser(null)}if(!window.__CROW_AUTH_SUB){const {data}=sb.auth.onAuthStateChange((event,session)=>{setUser(session?.user||null);if(event==="SIGNED_OUT"){window.__CROW_PRESENCE_CHANNEL&&sb.removeChannel(window.__CROW_PRESENCE_CHANNEL);window.__CROW_PRESENCE_CHANNEL=null}});window.__CROW_AUTH_SUB=data?.subscription}}
async function presence(sb){if(!sb||window.__CROW_PRESENCE_CHANNEL)return;const key=window.__CROW_USER?.id||`guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,ch=sb.channel("podcasting-online",{config:{presence:{key}}});window.__CROW_PRESENCE_CHANNEL=ch;const track=()=>document.hidden?null:ch.track({user_id:window.__CROW_USER?.id||null,display_name:window.__CROW_USER?.user_metadata?.full_name||window.__CROW_USER?.email||"Guest",page:document.title,last_seen_at:new Date().toISOString()}).catch(()=>{});ch.subscribe(s=>{if(s==="SUBSCRIBED")track()});setInterval(track,30000)}
async function alerts(sb){const user=window.__CROW_USER,b=document.getElementById("navAlertBadge");if(!sb||!user||!b)return;
let creatorId=null;
try{const r=await timeout(sb.rpc("get_my_podcast_creator_id"),7000,"Creator alert identity lookup timed out.");if(!r.error)creatorId=r.data||null}catch(e){console.warn("Creator alert identity:",e)}
if(!creatorId)return;
const refresh=async()=>{try{const r=await sb.from("cr_creator_alerts").select("id",{count:"exact",head:true}).eq("creator_id",creatorId).is("read_at",null).is("muted_at",null);if(!r.error){const n=Number(r.count||0);b.textContent=n>99?"99+":n;b.hidden=n<1}}catch(e){console.warn("Creator alerts:",e)}};
await refresh();
window.__CROW_ACTIVITY_CHANNEL=sb.channel(`creator-activity-${creatorId}`).on("postgres_changes",{event:"*",schema:"public",table:"cr_creator_alerts",filter:`creator_id=eq.${creatorId}`},refresh).subscribe()}
async function start(){ensureChrome();try{const bootstrap=window.CROW_BOOTSTRAP;
const sb=window.CROW_SUPABASE||(typeof bootstrap==="function"?await bootstrap():client());if(!sb)throw Error("Supabase client is unavailable.");window.CROW_SUPABASE=sb;await auth(sb);await presence(sb);await alerts(sb);window.__CROW_APP_VERSION=VERSION;window.CROW_SUPABASE_CONNECTION="connected";
       window.CROW_SUPABASE_READY=Promise.resolve(sb);
       window.CROW_SUPABASE_PROMISE=window.CROW_SUPABASE_READY;window.dispatchEvent(new CustomEvent("crow:ready",{detail:{user:window.__CROW_USER||null,supabase:sb}}));return sb}catch(e){console.error("CrowRules shell:",e);window.__CROW_APP_ERROR=e;window.CROW_SUPABASE_CONNECTION="error";setUser(null);toast(e.message||"Connection unavailable","error");return null}finally{}}
window.CROW_TOAST=toast;window.CROW_OPEN_SEARCH=openSearch;window.CROW_SUPABASE_READY=start();window.CROW_APP_READY=window.CROW_SUPABASE_READY;
window.addEventListener("online",()=>document.getElementById("crOffline")?.classList.remove("show"));window.addEventListener("offline",()=>document.getElementById("crOffline")?.classList.add("show"));window.addEventListener("error",e=>{if(e.error)console.error(e.error)});window.addEventListener("unhandledrejection",e=>{console.error(e.reason);if(window.CROW_TOAST)window.CROW_TOAST("A page action encountered an error. Please try again.","error")});document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openSearch()}if(e.key==="Escape")document.querySelector(".cr-search-modal.open")?.classList.remove("open")});if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ensureChrome,{once:true});else ensureChrome();
})();