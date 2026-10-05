(()=>{"use strict";
if(window.__CROW_DB_BOOTSTRAP_V2__)return;
window.__CROW_DB_BOOTSTRAP_V2__=true;
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/",VERSION="20261004-v14";
const timeout=ms=>new Promise((_,r)=>setTimeout(()=>r(Error("Supabase bootstrap timeout")),ms));
const load=src=>new Promise((ok,no)=>{const x=document.createElement("script");x.src=src;x.async=false;x.onload=ok;x.onerror=()=>no(Error("Unable to load "+src));document.head.appendChild(x)});
async function boot(){
 if(!window.CROW_CONFIG_READY)await load(BASE+"js/config.js?v="+VERSION);
 const cfg=window.CROW_CONFIG||{};
 if(!cfg.supabaseUrl||!cfg.supabaseKey)throw Error("CrowRules Supabase configuration is incomplete.");
 if(window.CROW_CONFIG_CLIENT_READY){try{await Promise.race([window.CROW_CONFIG_CLIENT_READY,timeout(12000)])}catch(_){}}
 if(!window.supabase?.createClient)await load("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
 if(!window.supabase?.createClient)throw Error("Supabase client library is unavailable.");
 if(!window.CROW_SUPABASE)window.CROW_SUPABASE=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
 window.CROW_SUPABASE_READY=Promise.resolve(window.CROW_SUPABASE);window.CROW_APP_READY=window.CROW_SUPABASE_READY;window.CROW_BOOTSTRAP=async()=>window.CROW_SUPABASE;window.CROW_DATA=window.CROW_DATA||{};window.CROW_DATA.ready=async()=>window.CROW_SUPABASE;
 const sb=window.CROW_SUPABASE;let session=null;try{session=(await Promise.race([sb.auth.getSession(),timeout(10000)])).data?.session||null}catch(_){}
 window.__CROW_USER=session?.user||null;window.__CROW_AUTH_READY=true;window.CROW_SUPABASE_CONNECTION="connected";try{sb.realtime?.setAuth(session?.access_token||undefined)}catch(_){}
 if(!window.__CROW_AUTH_BOUND_V14){window.__CROW_AUTH_BOUND_V14=true;sb.auth.onAuthStateChange((event,next)=>{window.__CROW_USER=next?.user||null;window.__CROW_AUTH_READY=true;try{sb.realtime?.setAuth(next?.access_token||undefined)}catch(_){};window.dispatchEvent(new CustomEvent("crow:auth",{detail:{event,session:next,user:window.__CROW_USER,supabase:sb}}));window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:sb,user:window.__CROW_USER,session:next}}));});}
 window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:true,label:"SUPABASE ONLINE"}}));window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:sb,user:window.__CROW_USER,session}}));return sb;
}
window.CROW_DB_READY=boot().catch(e=>{window.CROW_SUPABASE_ERROR=e;window.CROW_SUPABASE_CONNECTION="error";window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:false,label:"SUPABASE ERROR",error:e.message||String(e)}}));throw e});
})();