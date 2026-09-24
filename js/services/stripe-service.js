/* CrowRules Podcasting — Stripe Connect Domain Service 3.0 */
(()=>{"use strict";if(window.CrowRulesStripe)return;
const base=()=>window.CROWRULES_CONFIG?.supabaseUrl||window.CROWRULES_SUPABASE_URL;
const key=()=>window.CROWRULES_CONFIG?.supabasePublishableKey||window.CROWRULES_SUPABASE_PUBLISHABLE_KEY;
async function token(){return window.CrowRulesData.getAccessToken()}
async function call(path,body={}){const t=await token();if(!t)throw new Error("Authentication required");const r=await fetch(base()+"/functions/v1/"+path,{method:"POST",headers:{Authorization:"Bearer "+t,apikey:key()||"","Content-Type":"application/json"},body:JSON.stringify(body)});let data=null;try{data=await r.json()}catch{}if(!r.ok)throw new Error(data?.error||"Stripe Connect request failed.");return data}
async function status(){await window.CrowRulesData.guard("creator");return call("creator-connect-status",{})}
async function begin(){await window.CrowRulesData.guard("creator");return call("creator-connect-onboarding",{return_path:"monetization.html"})}
async function refresh(){await window.CrowRulesData.guard("creator");return call("creator-connect-status",{})}
const contract=fn=>async(...args)=>window.CrowRulesData.execute(()=>fn(...args));
window.CrowRulesStripe={version:"3.0",status:contract(status),begin:contract(begin),refresh:contract(refresh)};
})();