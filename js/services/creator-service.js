/* CrowRules Podcasting — Creator/Episode Domain Service 2.0 */
(()=>{"use strict";if(window.CrowRulesCreator)return;
const api=()=>window.CrowRulesData.getClientAsync();
const creatorGuard=()=>window.CrowRulesData.guard("creator");
async function creator(){const u=await creatorGuard(),db=await api();return db.from("creator_profiles").select("*").eq("user_id",u.id).maybeSingle()}
async function podcasts(limit=100){const u=await creatorGuard(),db=await api();return db.from("podcasts").select("*").eq("creator_id",u.id).order("created_at",{ascending:false}).limit(limit)}
async function episodes(podcastId=null,limit=100){const u=await creatorGuard(),db=await api();let q=db.from("podcast_episodes").select("*").eq("created_by",u.id);if(podcastId)q=q.eq("podcast_id",podcastId);return q.order("created_at",{ascending:false}).limit(limit)}
async function getEpisode(id){const db=await api();return db.from("podcast_episodes").select("*").eq("id",id).maybeSingle()}
async function savePodcast(id,patch){const u=await creatorGuard(),db=await api();return db.from("podcasts").update(patch).eq("id",id).eq("creator_id",u.id)}
async function saveEpisode(id,patch){const u=await creatorGuard(),db=await api();return db.from("podcast_episodes").update(patch).eq("id",id).eq("created_by",u.id)}
async function governance(action,payload={}){await creatorGuard();const db=await api(),r=await db.functions.invoke("creator-governance",{body:{action,...payload}});if(r.error)throw r.error;if(r.data?.error)throw new Error(r.data.error);return r.data||{}}
const realtime={},channels={};
function realtimeStart(name,handlers=[],options={}){const db=window.CrowRulesData.getClient();if(!db?.channel||!window.CrowRulesData.getUser)return()=>{};if(realtime[name])return realtime[name];const ch=db.channel(name,options);channels[name]=ch;for(const h of handlers){if(h.type==="postgres_changes")ch.on("postgres_changes",h.filter||{event:"*",schema:"public",table:h.table},h.handler);else ch.on(h.type,h.filter||{},h.handler)}window.CrowRulesData.registerChannel(name,ch);ch.subscribe();const stop=()=>{try{window.CrowRulesData.unregisterChannel(name)}catch(_){}try{db.removeChannel(ch)}catch(_){}delete realtime[name];delete channels[name];if(window.CrowRulesCreatorRealtimeChannel===ch)window.CrowRulesCreatorRealtimeChannel=null};realtime[name]=stop;return stop}
function realtimeStop(name){realtime[name]?.()}
function realtimeStopAll(){Object.keys(realtime).forEach(realtimeStop)}
function realtimeChannel(name){return channels[name]||null}
async function governanceRealtime(){await creatorGuard();return{start:(name,handlers,options)=>{const stop=realtimeStart(name,handlers,options);window.CrowRulesCreatorRealtimeChannel=realtimeChannel(name);return stop},stop:realtimeStop,stopAll:realtimeStopAll,channel:realtimeChannel}}
const contract=fn=>async(...args)=>window.CrowRulesData.execute(()=>fn(...args));
window.CrowRulesCreator={version:"2.1",creator:contract(creator),podcasts:contract(podcasts),episodes:contract(episodes),getEpisode:contract(getEpisode),savePodcast:contract(savePodcast),saveEpisode:contract(saveEpisode),governance:contract(governance),governanceRealtime};
window.addEventListener("crowrules:data-realtime-reset",realtimeStopAll);
})();