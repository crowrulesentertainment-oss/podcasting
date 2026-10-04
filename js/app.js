(()=>{"use strict";
const page=(location.pathname.split("/").pop()||"index.html").toLowerCase();
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
const VERSION="20261004-28";

function installHalloweenTheme(){
  try{
    document.documentElement.dataset.crowSeason="halloween";
    document.body?.classList.add("cr-halloween-theme");
    if(!document.querySelector('link[data-crow-halloween]')){
      const link=document.createElement("link");
      link.rel="stylesheet";
      link.href=BASE+"css/halloween-cinematic-v1.css?v=20261004-01";
      link.dataset.crowHalloween="true";
      document.head.appendChild(link);
    }
    if(document.body&&!document.querySelector(".cr-halloween-bats")){
      const bats=document.createElement("div");
      bats.className="cr-halloween-bats";
      bats.setAttribute("aria-hidden","true");
      document.body.appendChild(bats);
    }
  }catch(e){console.warn("CrowRules Halloween theme:",e)}
}
if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",installHalloweenTheme,{once:true});
}else{
  installHalloweenTheme();
}

if(page==="index.html"||page==="launch.html")return;

function syncBootstrap(){
  try{
    if(!window.supabase?.createClient){
      document.write('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\\/script>');
      document.write('<script src="https://unpkg.com/@supabase/supabase-js@2"><\\/script>');
    }
    if(!window.CROW_CONFIG_READY){
      document.write('<script src="'+BASE+'js/config.js?v='+VERSION+'"><\\/script>');
    }
  }catch(e){console.warn("CrowRules bootstrap loader:",e)}
  const cfg=window.CROW_CONFIG||{};
  if(!window.CROW_SUPABASE&&window.supabase?.createClient&&cfg.supabaseUrl&&cfg.supabaseKey){
    window.CROW_SUPABASE=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}
    });
  }
  if(window.CROW_SUPABASE){
    const sb=window.CROW_SUPABASE;
    window.CROW_SUPABASE_READY=Promise.resolve(sb);
    window.CROW_APP_READY=window.CROW_SUPABASE_READY;
    window.CROW_BOOTSTRAP=async()=>sb;
    window.CROW_DATA=window.CROW_DATA||{};
    window.CROW_DATA.ready=async()=>sb;
    if(!window.__CROW_APP_AUTH_BOUND){
      window.__CROW_APP_AUTH_BOUND=true;
      sb.auth.onAuthStateChange((event,session)=>{
        window.__CROW_USER=session?.user||null;
        window.__CROW_AUTH_READY=true;
        try{const token=session?.access_token||null;if(sb.realtime?.setAuth)sb.realtime.setAuth(token||undefined)}catch(_){}
        window.dispatchEvent(new CustomEvent("crow:auth",{detail:{event,session,user:window.__CROW_USER,supabase:sb}}));
        window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:sb,user:window.__CROW_USER,session}}));
      });
    }
    window.CROW_SUPABASE_ERROR=null;
    window.CROW_SUPABASE_CONNECTION="connected";
    window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:true,label:"SUPABASE ONLINE"}}));
    Promise.race([sb.auth.getSession(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("Supabase health check timed out.")),8000))]).then(r=>{
      if(r?.error)throw r.error;
      window.CROW_SUPABASE_CONNECTION="connected";
      window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:true,label:"SUPABASE ONLINE"}}));
    }).catch(e=>{
      window.CROW_SUPABASE_CONNECTION="degraded";
      window.CROW_SUPABASE_ERROR=e;
      window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:false,label:"SUPABASE DEGRADED",error:e.message||String(e)}}));
    });
  }else{
    const e=new Error("CrowRules Supabase client could not initialize.");
    window.CROW_SUPABASE_ERROR=e;
    window.CROW_SUPABASE_READY=Promise.reject(e);
    window.CROW_SUPABASE_READY.catch(()=>{});
    window.CROW_BOOTSTRAP=async()=>{throw e};
    window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:false,label:"SUPABASE ERROR"}}));
  }
}
syncBootstrap();

if(!document.querySelector('script[data-crow-rebuild]')){
  const s=document.createElement("script");
  s.src=BASE+"js/crow-podcasting-rebuild.js?v="+VERSION;
  s.defer=true;
  s.dataset.crowRebuild="true";
  document.head.appendChild(s);
}
})();