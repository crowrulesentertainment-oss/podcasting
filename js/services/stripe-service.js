/* CrowRules Podcasting — Stripe Connect Domain Service 1.0 */
(()=>{"use strict";if(window.CrowRulesStripe)return;
async function token(){return window.CrowRulesData.getAccessToken()}
async function status(){const u=await window.CrowRulesData.guard("creator"),db=await window.CrowRulesData.getClientAsync();return db.from("cr_podcast_stripe_accounts").select("*").eq("user_id",u.id).maybeSingle()}
async function begin(){const t=await token();if(!t)throw new Error("Authentication required");const r=await fetch((window.CROWRULES_CONFIG?.supabaseUrl||"")+"/functions/v1/create-stripe-connect-account",{method:"POST",headers:{Authorization:"Bearer "+t,apikey:window.CROWRULES_CONFIG?.supabasePublishableKey||"","Content-Type":"application/json"}});if(!r.ok)throw new Error("Unable to start Stripe Connect onboarding.");return r.json()}
async function refresh(){const t=await token();if(!t)throw new Error("Authentication required");const r=await fetch((window.CROWRULES_CONFIG?.supabaseUrl||"")+"/functions/v1/stripe-connect-status",{method:"GET",headers:{Authorization:"Bearer "+t,apikey:window.CROWRULES_CONFIG?.supabasePublishableKey||""}});if(!r.ok)throw new Error("Unable to refresh Stripe Connect status.");return r.json()}
const contract=fn=>async(...args)=>window.CrowRulesData.execute(()=>fn(...args));
window.CrowRulesStripe={version:"2.0",status:contract(status),begin:contract(begin),refresh:contract(refresh)};
})();