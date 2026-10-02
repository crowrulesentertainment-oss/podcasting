(()=>{"use strict";
window.CROW_CONFIG=Object.assign({
 supabaseUrl:"https://cevylpnoexugwgygvtgu.supabase.co",
 supabaseKey:"sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-",
 siteUrl:"https://crowrulesentertainment-oss.github.io/podcasting/",
 membershipCheckoutFunction:"membership-checkout",
 adminFunction:"crowrules-admin-api",
 rssFunction:"podcast-rss",
 connectFunction:"creator-connect-onboarding",
 scheduleFunction:"podcast-schedule",
 pipelineFunction:"podcast-pipeline",
 downloadFunction:"podcast-download"
},window.CROW_CONFIG||{});
window.CROW_CONFIG_READY=true;
window.CROW_SUPABASE_READY=window.CROW_BOOTSTRAP;
window.CROW_SUPABASE_PROMISE=window.CROW_BOOTSTRAP;
function loadScript(src){
 return new Promise((resolve,reject)=>{
   if([...document.scripts].some(s=>s.src===src||s.src.startsWith(src+"?"))){resolve();return}
   const s=document.createElement("script");s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(Error("Failed to load "+src));document.head.appendChild(s);
 });
}
window.CROW_BOOTSTRAP=window.CROW_BOOTSTRAP||(()=>{
 const ready=(async()=>{
   try{
     if(!window.supabase?.createClient)await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
     if(!window.CROW_SUPABASE){
       window.CROW_SUPABASE=window.supabase.createClient(window.CROW_CONFIG.supabaseUrl,window.CROW_CONFIG.supabaseKey,{
         auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}
       });
     }
     window.CROW_SUPABASE_CONNECTION="connected";
     window.dispatchEvent(new CustomEvent("crow:supabase-connected",{detail:{supabase:window.CROW_SUPABASE}}));
   }catch(error){
     window.CROW_SUPABASE_CONNECTION="error";
     window.CROW_SUPABASE_ERROR=error;
     window.dispatchEvent(new CustomEvent("crow:supabase-error",{detail:{error}}));
     throw error;
   }
   return window.CROW_SUPABASE;
 })();
 return ready;
})();
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{
 const hasApp=[...document.scripts].some(s=>/\/js\/app\.js(?:\?|$)/.test(s.src));
 if(!hasApp)loadScript(window.CROW_CONFIG.siteUrl+"js/app.js?v=11").catch(console.error);
},{once:true});
})();