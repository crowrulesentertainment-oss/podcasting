(()=>{"use strict";
const DEFAULTS={
  supabaseUrl:"https://cevylpnoexugwgygvtgu.supabase.co",
  supabaseKey:"sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-",
  stripePublishableKey:"pk_live_51UMQltAEVUNQd17SpvqhxnhP1fcZk8LjrRiFV1Z2StQdrkFUHkwtFNypkS9w754n4zApC3cMCNWuIP7HibtOA2i400JbBaMwYI",
  siteUrl:"https://crowrulesentertainment-oss.github.io/podcasting/",
  membershipCheckoutFunction:"membership-checkout",
  adminFunction:"crowrules-admin-api",
  rssFunction:"podcast-rss-feed-64",
  edgeHealthFunction:"crowrules-edge-health",
  connectFunction:"creator-connect-onboarding",
  podcastCheckoutFunction:"podcast-subscription-checkout",
  podcastSubscriptionCenterFunction:"podcast-subscription-center",
  scheduleFunction:"podcast-schedule",
  pipelineFunction:"podcast-pipeline",
  memberPaymentFunction:"member-payment-checkout-v2",
  platformFeePercent:20,
  downloadFunction:"podcast-download"
};
const incoming=window.CROW_CONFIG&&typeof window.CROW_CONFIG==="object"?window.CROW_CONFIG:{};
window.CROW_CONFIG=Object.assign({},DEFAULTS,incoming);
window.CROW_CONFIG.supabaseUrl=DEFAULTS.supabaseUrl;
window.CROW_CONFIG.supabaseKey=DEFAULTS.supabaseKey;
window.SUPABASE_URL=window.CROW_CONFIG.supabaseUrl;
window.SUPABASE_ANON_KEY=window.CROW_CONFIG.supabaseKey;
window.CROW_SUPABASE_KEY=window.CROW_CONFIG.supabaseKey;
window.CROW_CONFIG_READY=true;
function loadScript(src){return new Promise((resolve,reject)=>{
  if([...document.scripts].some(s=>s.src===src||s.src.startsWith(src.split("?")[0]+"?"))){resolve();return}
  const s=document.createElement("script");s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error("Failed to load "+src));document.head.appendChild(s);
});}
window.CROW_CREATE_CLIENT=window.CROW_CREATE_CLIENT||function(url,key,options){
  if(!window.supabase?.createClient)throw new Error("Supabase client library is not loaded.");
  return window.supabase.createClient(url||window.CROW_CONFIG.supabaseUrl,key||window.CROW_CONFIG.supabaseKey,options||{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
};
window.CROW_BOOTSTRAP=window.CROW_BOOTSTRAP||function(){
  if(window.CROW_SUPABASE)return Promise.resolve(window.CROW_SUPABASE);
  if(window.__CROW_BOOTSTRAP_PROMISE)return window.__CROW_BOOTSTRAP_PROMISE;
  window.__CROW_BOOTSTRAP_PROMISE=(async()=>{
    if(!window.supabase?.createClient){
      try{await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2")}
      catch(e){await loadScript("https://unpkg.com/@supabase/supabase-js@2")}
    }
    if(!window.supabase?.createClient)throw new Error("Supabase client library failed to load.");
    window.CROW_SUPABASE=window.supabase.createClient(window.CROW_CONFIG.supabaseUrl,window.CROW_CONFIG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
    window.CROW_SUPABASE_CONNECTION="connected";
    window.dispatchEvent(new CustomEvent("crow:supabase-connected",{detail:{supabase:window.CROW_SUPABASE}}));
    return window.CROW_SUPABASE;
  })().catch(error=>{window.CROW_SUPABASE_CONNECTION="error";window.CROW_SUPABASE_ERROR=error;window.dispatchEvent(new CustomEvent("crow:supabase-error",{detail:{error}}));throw error});
  return window.__CROW_BOOTSTRAP_PROMISE;
};
window.CROW_SUPABASE_READY=window.CROW_SUPABASE_READY||window.CROW_BOOTSTRAP();
})();