(()=>{
'use strict';
const DEFAULTS={
  supabaseUrl:'https://cevylpnoexugwgygvtgu.supabase.co',
  supabaseKey:'sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-',
  stripePublishableKey:'pk_live_51UMQltAEVUNQd17SpvqhxnhP1fcZk8LjrRiFV1Z2StQdrkFUHkwtFNypkS9w754n4zApC3cMCNWuIP7HibtOA2i400JbBaMwYI',
  siteUrl:'https://crowrulesentertainment-oss.github.io/podcasting/',
  membershipCheckoutFunction:'membership-checkout',
  adminFunction:'crowrules-admin-api',
  rssFunction:'podcast-rss-feed-64',
  edgeHealthFunction:'crowrules-edge-health',
  connectFunction:'creator-connect-onboarding',
  podcastCheckoutFunction:'podcast-subscription-checkout',
  podcastSubscriptionCenterFunction:'podcast-subscription-center',
  scheduleFunction:'podcast-schedule',
  pipelineFunction:'podcast-pipeline',
  memberPaymentFunction:'member-payment-checkout-v2',
  platformFeePercent:20,
  downloadFunction:'podcast-download'
};
window.CROW_CONFIG=Object.assign({},DEFAULTS,window.CROW_CONFIG||{});
window.CROW_CONFIG.supabaseUrl=DEFAULTS.supabaseUrl;
window.CROW_CONFIG.supabaseKey=DEFAULTS.supabaseKey;
window.SUPABASE_URL=DEFAULTS.supabaseUrl;
window.SUPABASE_ANON_KEY=DEFAULTS.supabaseKey;
window.CROW_SUPABASE_KEY=DEFAULTS.supabaseKey;
window.CROW_CONFIG_READY=true;
window.CROW_CREATE_CLIENT=window.CROW_CREATE_CLIENT||function(url,key,options){if(!window.supabase?.createClient)throw Error('Supabase client library is not loaded.');return window.supabase.createClient(url||DEFAULTS.supabaseUrl,key||DEFAULTS.supabaseKey,options||{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}})};
})();
