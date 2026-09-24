/* CrowRules Podcasting — Playback Domain Service 1.0 */
(()=>{"use strict";if(window.CrowRulesPlayback)return;
const api=()=>window.CrowRulesData.getClientAsync();
const rpc=async(name,args)=>{const db=await api(),r=await db.rpc(name,args);if(r.error)throw r.error;return r.data};
async function conflicts(){return rpc("get_my_podcast_playback_conflicts")}
async function devices(){return rpc("get_my_podcast_playback_devices")}
async function events(limit=50){return rpc("get_my_podcast_playback_device_events",{p_limit:limit})}
async function progress(episodeId){return rpc("get_my_podcast_playback_progress",{p_episode_id:episodeId})}
async function start(episodeId,type,userAgent,clientId){return rpc("start_my_podcast_playback_session",{p_episode_id:episodeId,p_media_type:type,p_user_agent:userAgent,p_client_instance_id:clientId})}
async function heartbeat(sessionId,position,delta){return rpc("record_my_podcast_playback_heartbeat",{p_session_id:sessionId,p_position_seconds:position,p_delta_seconds:delta})}
async function finish(sessionId,status,position){return rpc("finish_my_podcast_playback_session",{p_session_id:sessionId,p_status:status,p_position_seconds:position})}
async function takeover(episodeId,type){return rpc("takeover_my_podcast_playback",{p_episode_id:episodeId,p_media_type:type})}
async function expireStale(){return rpc("expire_my_stale_podcast_playback_sessions")}
async function securitySummary(){return rpc("get_my_podcast_playback_security_summary")}
window.CrowRulesPlayback={version:"1.0",conflicts,devices,events,progress,start,heartbeat,finish,takeover,expireStale,securitySummary};
})();