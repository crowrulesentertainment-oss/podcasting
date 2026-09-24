/* CrowRules Podcasting — Membership Domain Service 1.0 */
(()=>{"use strict";if(window.CrowRulesMembership)return;
const api=()=>window.CrowRulesData.getClientAsync();
async function user(){return window.CrowRulesData.guard("member")}
async function subscriptions(){const u=await user(),db=await api();return db.from("membership_subscriptions").select("*,membership_plans(*)").eq("user_id",u.id).order("created_at",{ascending:false})}
async function current(){const r=await subscriptions();if(r.error)throw r.error;return (r.data||[]).find(x=>["active","trialing","past_due"].includes(x.status))||null}
async function plans(){const db=await api();return db.from("membership_plans").select("*").eq("is_active",true).order("sort_order",{ascending:true})}
async function podcastSubscriptions(){const u=await user(),db=await api();return db.from("podcast_subscriptions").select("*").eq("user_id",u.id).order("created_at",{ascending:false})}
async function entitlement(){const u=await user(),db=await api();return db.from("cr_podcast_entitlements").select("*").eq("member_user_id",u.id).eq("status","active").order("updated_at",{ascending:false}).limit(1).maybeSingle()}
window.CrowRulesMembership={version:"1.1",user,subscriptions,current,plans,podcastSubscriptions,entitlement};
})();