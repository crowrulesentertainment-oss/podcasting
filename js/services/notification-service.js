/* CrowRules Podcasting — Notification Domain Service 1.0 */
(()=>{"use strict";if(window.CrowRulesNotifications)return;
const api=()=>window.CrowRulesData.getClientAsync();
async function list(limit=50){const u=await window.CrowRulesData.requireAuth(),db=await api();return db.from("podcast_notifications").select("*").eq("user_id",u.id).order("created_at",{ascending:false}).limit(limit)}
async function unread(){const u=await window.CrowRulesData.requireAuth(),db=await api();return db.from("podcast_notifications").select("id",{count:"exact",head:true}).eq("user_id",u.id).eq("is_read",false)}
async function markRead(id){const u=await window.CrowRulesData.requireAuth(),db=await api();return db.from("podcast_notifications").update({is_read:true}).eq("id",id).eq("user_id",u.id)}
async function markAllRead(){const u=await window.CrowRulesData.requireAuth(),db=await api();return db.from("podcast_notifications").update({is_read:true}).eq("user_id",u.id).eq("is_read",false)}
function subscribe(handler){return window.CrowRulesData.subscribe("podcast_notifications",null,handler)}
window.CrowRulesNotifications={version:"1.0",list,unread,markRead,markAllRead,subscribe};
})();