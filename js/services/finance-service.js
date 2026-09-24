/* CrowRules Podcasting — Finance Domain Service 3.0 */
(()=>{"use strict";if(window.CrowRulesFinance)return;
const api=()=>window.CrowRulesData.getClientAsync();
const payouts=()=>window.CrowRulesData.guard("payouts");
async function stripeAccount(){const u=await payouts(),db=await api();const r=await db.from("cr_podcast_stripe_accounts").select("id,creator_id,user_id,stripe_account_id,account_type,onboarding_status,charges_enabled,payouts_enabled,details_submitted,country,default_currency,requirements_due,requirements_currently_due,disabled_reason,created_at,updated_at").eq("user_id",u.id).maybeSingle();if(r.error)throw r.error;return r.data}
async function payoutReadiness(){const row=await stripeAccount();return{connected:!!row?.stripe_account_id,onboardingStatus:row?.onboarding_status||"not_connected",chargesEnabled:!!row?.charges_enabled,payoutsEnabled:!!row?.payouts_enabled,detailsSubmitted:!!row?.details_submitted,requirementsDue:row?.requirements_due||[],requirementsCurrentlyDue:row?.requirements_currently_due||[],disabledReason:row?.disabled_reason||null}}
const contract=fn=>async(...args)=>window.CrowRulesData.execute(()=>fn(...args));
window.CrowRulesFinance={version:"3.0",stripeAccount:contract(stripeAccount),payoutReadiness:contract(payoutReadiness)};
})();