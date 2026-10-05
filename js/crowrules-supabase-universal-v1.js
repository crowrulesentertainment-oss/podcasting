(()=>{"use strict";
if(window.__CROW_SUPABASE_UNIVERSAL_V1__)return;
window.__CROW_SUPABASE_UNIVERSAL_V1__=true;
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
const CDN="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const load=(src,id)=>new Promise((resolve,reject)=>{
  const existing=document.getElementById(id)||[...document.scripts].find(s=>s.src===src||s.src.startsWith(src+"?"));
  if(existing){if(src.includes("supabase-js")&&window.supabase?.createClient)return resolve();existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",()=>reject(new Error("Unable to load "+src)),{once:true});return}
  const s=document.createElement("script");s.id=id;s.src=src;s.defer=true;s.onload=resolve;s.onerror=()=>reject(new Error("Unable to load "+src));document.head.appendChild(s);
});
async function boot(){
  if(window.CROW_SUPABASE) return window.CROW_SUPABASE;
  if(!window.supabase?.createClient) await load(CDN,"crow-supabase-js-universal-v1");
  if(!window.CROW_CONFIG_READY) await load(BASE+"js/config.js?v=20261004-v13","crow-config-universal-v1");
  const cfg=window.CROW_CONFIG||{};
  if(!cfg.supabaseUrl||!cfg.supabaseKey) throw new Error("CrowRules Supabase configuration is incomplete.");
  window.CROW_SUPABASE=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"},
    realtime:{params:{eventsPerSecond:10}}
  });
  window.CROW_SUPABASE_READY=Promise.resolve(window.CROW_SUPABASE);
  window.CROW_BOOTSTRAP=async()=>window.CROW_SUPABASE;
  window.CROW_DATA=window.CROW_DATA||{};
  window.CROW_DATA.ready=async()=>window.CROW_SUPABASE;
  const session=(await window.CROW_SUPABASE.auth.getSession()).data?.session||null;
  window.__CROW_USER=session?.user||null;
  window.__CROW_AUTH_READY=true;
  try{window.CROW_SUPABASE.realtime?.setAuth(session?.access_token||undefined)}catch(_){}
  if(!window.__CROW_AUTH_BOUND_UNIVERSAL_V1){
    window.__CROW_AUTH_BOUND_UNIVERSAL_V1=true;
    window.CROW_SUPABASE.auth.onAuthStateChange((event,s)=>{
      window.__CROW_USER=s?.user||null;window.__CROW_AUTH_READY=true;
      try{window.CROW_SUPABASE.realtime?.setAuth(s?.access_token||undefined)}catch(_){}
      window.dispatchEvent(new CustomEvent("crow:auth",{detail:{event,session:s,user:window.__CROW_USER,supabase:window.CROW_SUPABASE}}));
      window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:window.CROW_SUPABASE,user:window.__CROW_USER,session:s}}));
    });
  }
  window.CROW_SUPABASE_CONNECTION="connected";
  window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:true,label:"SUPABASE ONLINE",project:"cevylpnoexugwgygvtgu"}}));
  return window.CROW_SUPABASE;
}
window.CROW_SUPABASE_READY=boot().catch(e=>{
  window.CROW_SUPABASE_ERROR=e;window.CROW_SUPABASE_CONNECTION="error";
  const p=Promise.reject(e);p.catch(()=>{});window.CROW_SUPABASE_READY=p;
  window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:false,label:"SUPABASE ERROR",error:e.message||String(e),project:"cevylpnoexugwgygvtgu"}}));
  throw e;
});
window.CROW_SUPABASE_READY.catch(()=>{});
})();