(()=>{"use strict";
const d={supabaseUrl:"https://cevylpnoexugwgygvtgu.supabase.co",supabaseKey:"sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-",stripePublishableKey:"pk_live_51UMQltAEVUNQd17SpvqhxnhP1fcZk8LjrRiFV1Z2StQdrkFUHkwtFNypkS9w754n4zApC3cMCNWuIP7HibtOA2i400JbBaMwYI",siteUrl:"https://crowrulesentertainment-oss.github.io/podcasting/",adminFunction:"crowrules-admin-api",pipelineFunction:"podcast-pipeline",rssFunction:"podcast-rss",podcastSubscriptionCenterFunction:"podcast-subscription-center",podcastSubscriptionCheckoutFunction:"podcast-subscription-checkout",creatorProductFunction:"create-podcast-product",manageProductFunction:"manage-podcast-product",podcastCheckoutFunction:"create-podcast-checkout",platformFeePercent:20,defaultAudioUrl:"https://cevylpnoexugwgygvtgu.supabase.co/storage/v1/object/public/podcast-audio/Tacoma%20Nights.mp3",podcastingVersion:"1.0.0"};
window.CROW_CONFIG=Object.assign({},d,window.CROW_CONFIG||{});
window.SUPABASE_URL=window.CROW_CONFIG.supabaseUrl;window.SUPABASE_ANON_KEY=window.CROW_CONFIG.supabaseKey;window.CROW_SUPABASE_KEY=window.CROW_CONFIG.supabaseKey;window.CROW_CONFIG_READY=true;
window.CROW_CONFIG_CLIENT_READY=(async()=>{
  if(window.CROW_SUPABASE)return window.CROW_SUPABASE;
  if(!window.supabase?.createClient){
    await new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-crow-supabase-cdn]');
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(Error('Unable to load Supabase client library.')),{once:true});return;}
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.113.0';s.async=false;s.dataset.crowSupabaseCdn='true';s.onload=resolve;s.onerror=()=>reject(Error('Unable to load Supabase client library.'));document.head.appendChild(s);
    });
  }
  if(!window.supabase?.createClient)throw Error('Supabase client library is unavailable.');
  if(window.CROW_SUPABASE)return window.CROW_SUPABASE;
  window.CROW_SUPABASE=window.supabase.createClient(window.CROW_CONFIG.supabaseUrl,window.CROW_CONFIG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
  window.CROW_SUPABASE_READY=Promise.resolve(window.CROW_SUPABASE);window.CROW_APP_READY=window.CROW_SUPABASE_READY;
  window.CROW_BOOTSTRAP=async()=>window.CROW_SUPABASE;window.CROW_DATA=window.CROW_DATA||{};window.CROW_DATA.ready=async()=>window.CROW_SUPABASE;return window.CROW_SUPABASE;
})().catch(e=>{window.CROW_CONFIG_ERROR=e;throw e;});
window.dispatchEvent(new CustomEvent("crow:config-ready",{detail:{config:window.CROW_CONFIG}}));
window.CROW_CREATE_CLIENT=window.CROW_CREATE_CLIENT||function(url,key,options){if(!window.supabase?.createClient)throw Error("Supabase client library is not loaded.");return window.supabase.createClient(url||window.CROW_CONFIG.supabaseUrl,key||window.CROW_CONFIG.supabaseKey,options||{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}})};
})();