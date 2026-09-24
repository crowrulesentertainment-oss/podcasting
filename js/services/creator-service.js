/* CrowRules Podcasting — Creator/Episode Domain Service 1.0 */
(()=>{"use strict";if(window.CrowRulesCreator)return;
const api=()=>window.CrowRulesData.getClientAsync();
async function creator(){const u=await window.CrowRulesData.guard("creator"),db=await api();return db.from("creator_profiles").select("*").eq("user_id",u.id).maybeSingle()}
async function podcasts(limit=100){const u=await window.CrowRulesData.requireAuth(),db=await api();return db.from("podcasts").select("*").eq("creator_id",u.id).order("created_at",{ascending:false}).limit(limit)}
async function episodes(podcastId=null,limit=100){const u=await window.CrowRulesData.requireAuth(),db=await api();let q=db.from("podcast_episodes").select("*");if(podcastId)q=q.eq("podcast_id",podcastId);return q.eq("created_by",u.id).order("created_at",{ascending:false}).limit(limit)}
async function getEpisode(id){const db=await api();return db.from("podcast_episodes").select("*").eq("id",id).maybeSingle()}
async function savePodcast(id,patch){const u=await window.CrowRulesData.requireAuth(),db=await api();return db.from("podcasts").update(patch).eq("id",id).eq("creator_id",u.id)}
async function saveEpisode(id,patch){const u=await window.CrowRulesData.requireAuth(),db=await api();return db.from("podcast_episodes").update(patch).eq("id",id).eq("created_by",u.id)}
window.CrowRulesCreator={version:"1.1",creator,podcasts,episodes,getEpisode,savePodcast,saveEpisode};
})();