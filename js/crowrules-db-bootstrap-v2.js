(()=>{"use strict";
if(window.__CROW_DB_BOOTSTRAP_V2__)return;
window.__CROW_DB_BOOTSTRAP_V2__=true;
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/",VERSION="20261004-v14.7";
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
 window.CROW_SUPABASE_READY=Promise.resolve(window.CROW_SUPABASE);window.CROW_APP_READY=window.CROW_SUPABASE_READY;window.CROW_BOOTSTRAP=async()=>window.CROW_SUPABASE;window.CROW_DATA=window.CROW_DATA||{};
 const cache=window.CROW_DATA.cache=window.CROW_DATA.cache||{catalog:null,account:null,notifications:[],progress:new Map(),follows:new Set(),saved:new Set()};
 const key=v=>String(v||"");
 const api=window.CROW_DATA;
 api.ready=async()=>window.CROW_SUPABASE;
 api.getPodcast=async(id)=>{const s=api.snapshot(),x=(s.catalog?.podcasts||[]).find(x=>String(x.id)===String(id));if(x)return x;const r=await window.CROW_SUPABASE.from("podcasts").select("*").eq("id",id).maybeSingle();return r.data||null};
 api.getEpisode=async(id)=>{const s=api.snapshot(),x=(s.catalog?.episodes||[]).find(x=>String(x.id)===String(id));if(x)return x;const r=await window.CROW_SUPABASE.from("podcast_episodes").select("*").eq("id",id).maybeSingle();return r.data||null};
 api.getCreator=async(id)=>{const s=api.snapshot(),x=(s.catalog?.creators||[]).find(x=>String(x.id)===String(id));if(x)return x;const r=await window.CROW_SUPABASE.from("creators").select("*").eq("id",id).maybeSingle();return r.data||null};
 api.refreshFollows=async()=>{const u=window.__CROW_USER,sb=window.CROW_SUPABASE;if(!u||!sb){cache.follows=new Set();return []}const r=await sb.from("podcast_follows").select("podcast_id").eq("user_id",u.id);cache.follows=new Set((r.data||[]).map(x=>String(x.podcast_id)));window.dispatchEvent(new CustomEvent("crow:data:follows",{detail:Array.from(cache.follows)}));return Array.from(cache.follows)};
 api.refreshSaved=async()=>{const u=window.__CROW_USER,sb=window.CROW_SUPABASE;if(!u||!sb){cache.saved=new Set();return []}const r=await sb.from("podcast_saved_episodes").select("episode_id").eq("user_id",u.id);cache.saved=new Set((r.data||[]).map(x=>String(x.episode_id)));window.dispatchEvent(new CustomEvent("crow:data:saved",{detail:Array.from(cache.saved)}));return Array.from(cache.saved)};
 api.refreshCatalog=async()=>{const sb=window.CROW_SUPABASE;if(!sb)return null;const [p,e,c]=await Promise.all([sb.from("podcasts").select("*").eq("status","published").order("created_at",{ascending:false}),sb.from("podcast_episodes").select("*").eq("status","published").order("created_at",{ascending:false}),sb.from("creators").select("*").eq("is_active",true).order("sort_order",{ascending:true})]);cache.catalog={podcasts:p.data||[],episodes:e.data||[],creators:c.data||[],errors:[p.error,e.error,c.error].filter(Boolean)};window.dispatchEvent(new CustomEvent("crow:data:catalog",{detail:cache.catalog}));return cache.catalog};
 api.refreshAccount=async()=>{const u=window.__CROW_USER,sb=window.CROW_SUPABASE;if(!u||!sb){cache.account=null;return null}const r=await sb.from("members").select("display_name,username,membership_type,role,status").eq("user_id",u.id).maybeSingle();cache.account={user:u,member:r.data||null,error:r.error||null};window.dispatchEvent(new CustomEvent("crow:data:account",{detail:cache.account}));return cache.account};
 api.refreshNotifications=async()=>{const u=window.__CROW_USER,sb=window.CROW_SUPABASE;if(!u||!sb){cache.notifications=[];return []}const r=await sb.from("podcast_notifications").select("*").eq("user_id",u.id).order("created_at",{ascending:false}).limit(50);cache.notifications=r.data||[];window.dispatchEvent(new CustomEvent("crow:data:notifications",{detail:cache.notifications}));return cache.notifications};
 api.refreshProgress=async(limit=50)=>{const u=window.__CROW_USER,sb=window.CROW_SUPABASE;if(!u||!sb){cache.progress.clear();return[]}const r=await sb.from("podcast_episode_progress").select("*").eq("user_id",u.id).order("last_played_at",{ascending:false}).limit(limit);(r.data||[]).forEach(x=>cache.progress.set(key(x.episode_id),x));window.dispatchEvent(new CustomEvent("crow:data:progress",{detail:r.data||[]}));return r.data||[]};
 api.snapshot=()=>({catalog:cache.catalog,account:cache.account,notifications:cache.notifications.slice(),progress:Array.from(cache.progress.values()),follows:Array.from(cache.follows),saved:Array.from(cache.saved)});
 api.bootstrap=async()=>{await api.refreshCatalog();if(window.__CROW_USER)await Promise.allSettled([api.refreshAccount(),api.refreshNotifications(),api.refreshProgress(),api.refreshFollows(),api.refreshSaved()]);return api.snapshot()};
 window.addEventListener("crow:auth",()=>{api.bootstrap().catch(()=>{})});
 ["podcasts","podcast_episodes","creators"].forEach(t=>window.addEventListener("crow:v13:catalog-change",()=>api.refreshCatalog().catch(()=>{})));
 window.addEventListener("crow:v13:podcast_notifications-change",()=>api.refreshNotifications().catch(()=>{}));
 window.addEventListener("crow:v13:podcast_episode_progress-change",()=>api.refreshProgress().catch(()=>{}));
 window.addEventListener("crow:v13:podcast_follows-change",()=>api.refreshFollows().catch(()=>{}));
 window.addEventListener("crow:v13:podcast_saved_episodes-change",()=>api.refreshSaved().catch(()=>{}));
 window.addEventListener("crow:ready",()=>{api.bootstrap().catch(()=>{})},{once:true});
 const sb=window.CROW_SUPABASE;let session=null;try{session=(await Promise.race([sb.auth.getSession(),timeout(10000)])).data?.session||null}catch(_){}
 window.__CROW_USER=session?.user||null;window.__CROW_AUTH_READY=true;window.CROW_SUPABASE_CONNECTION="connected";try{sb.realtime?.setAuth(session?.access_token||undefined)}catch(_){}
 if(!window.__CROW_AUTH_BOUND_V14){window.__CROW_AUTH_BOUND_V14=true;sb.auth.onAuthStateChange((event,next)=>{window.__CROW_USER=next?.user||null;window.__CROW_AUTH_READY=true;try{sb.realtime?.setAuth(next?.access_token||undefined)}catch(_){};window.dispatchEvent(new CustomEvent("crow:auth",{detail:{event,session:next,user:window.__CROW_USER,supabase:sb}}));window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:sb,user:window.__CROW_USER,session:next}}));});}
 window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:true,label:"SUPABASE ONLINE"}}));window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:sb,user:window.__CROW_USER,session}}));
 try{if("serviceWorker" in navigator)navigator.serviceWorker.register(BASE+"sw.js",{scope:"/podcasting/"}).catch(()=>{})}catch(_){}
 if(!window.__CROW_V14_7_UNIVERSAL__)try{await load(BASE+"js/crowrules-v14-universal.js?v="+VERSION)}catch(_){}
 return sb;
}
window.CROW_DB_READY=boot().catch(e=>{window.CROW_SUPABASE_ERROR=e;window.CROW_SUPABASE_CONNECTION="error";window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:false,label:"SUPABASE ERROR",error:e.message||String(e)}}));throw e});
})();