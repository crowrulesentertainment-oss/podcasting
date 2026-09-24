/* CrowRules Podcasting — Membership Domain Service 1.0 */
(()=>{"use strict";if(window.CrowRulesMembership)return;
const api=()=>window.CrowRulesData.getClientAsync();
async function user(){return window.CrowRulesData.requireAuth()}
async function subscriptions(){const u=await user(),db=await api();return db.from("membership_subscriptions").select("*,membership_plans(*)").eq("user_id",u.id).order("created_at",{ascending:false})}
async function current(){const r=await subscriptions();if(r.error)throw r.error;return (r.data||[]).find(x=>["active","trialing","past_due"].includes(x.status))||null}
async function plans(){const db=await api();return db.from("membership_plans").select("*").eq("is_active",true).order("sort_order",{ascending:true})}
async function podcastSubscriptions(){const u=await user(),db=await api();return db.from("podcast_subscriptions").select("*").eq("user_id",u.id).order("created_at",{ascending:false})}
window.CrowRulesMembership={version:"1.0",user,subscriptions,current,plans,podcastSubscriptions};
})();