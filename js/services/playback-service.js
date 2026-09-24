/* CrowRules Podcasting — Playback Domain Service 1.0 */
(()=>{"use strict";if(window.CrowRulesPlayback)return;
const api=()=>window.CrowRulesData.getClientAsync();
const rpc=async(name,args)=>{const db=await api(),r=await db.rpc(name,args);if(r.error)throw r.error;return r.data};
async function conflicts(){return rpc("get_my_podcast_playback_conflicts")}
async function devices(){return rpc("get_my_podcast_playback_devices")}
async function events(limit=50){return rpc("get_my_podcast_playback_device_events",{p_limit:limit})}
async function progress(episodeId){return rpc("get_my_podcast_playback_progress",{p_episode_id:episodeId})}
async function run(task){return window.CrowRulesData.run(task)}
async function start(episodeId,type,userAgent,clientId){return rpc("start_my_podcast_playback_session",{p_episode_id:episodeId,p_media_type:type,p_user_agent:userAgent,p_client_instance_id:clientId})}
async function heartbeat(sessionId,position,delta){return rpc("record_my_podcast_playback_heartbeat",{p_session_id:sessionId,p_position_seconds:position,p_delta_seconds:delta})}
async function finish(sessionId,status,position){return rpc("finish_my_podcast_playback_session",{p_session_id:sessionId,p_status:status,p_position_seconds:position})}
async function takeover(episodeId,type){return rpc("takeover_my_podcast_playback",{p_episode_id:episodeId,p_media_type:type})}
async function expireStale(){return rpc("expire_my_stale_podcast_playback_sessions")}
async function securitySummary(){return rpc("get_my_podcast_playback_security_summary")}
async function library(){return rpc("get_my_podcast_library")}
async function state(){return rpc("get_my_podcast_playback_state")}
async function summary(){return rpc("get_my_podcast_playback_summary")}
async function episodes(ids=[]){if(!ids.length)return [];const db=await api(),r=await db.from("podcast_episodes").select("id,title,slug,podcast_id,thumbnail_url,duration_seconds").in("id",ids);if(r.error)throw r.error;return r.data||[]}
async function registerDevice(id,ua,type){return rpc("register_my_podcast_playback_device",{p_client_instance_id:id,p_user_agent:ua,p_device_type:type,p_device_name:type==="desktop"?"My Desktop":type==="mobile"?"My Phone":type==="tablet"?"My Tablet":"My Device"})}
async function renameDevice(id,name){return rpc("rename_my_podcast_playback_device",{p_client_instance_id:id,p_device_name:name})}
async function revokeDevice(id){return rpc("revoke_my_podcast_playback_device",{p_client_instance_id:id})}
const contract=fn=>async(...args)=>window.CrowRulesData.execute(()=>fn(...args));
window.CrowRulesPlayback={version:"2.0",conflicts:contract(conflicts),devices:contract(devices),events:contract(events),progress:contract(progress),start:contract(start),heartbeat:contract(heartbeat),finish:contract(finish),takeover:contract(takeover),expireStale:contract(expireStale),securitySummary:contract(securitySummary),library:contract(library),state:contract(state),summary:contract(summary),episodes:contract(episodes),registerDevice:contract(registerDevice),renameDevice:contract(renameDevice),revokeDevice:contract(revokeDevice)};
})();