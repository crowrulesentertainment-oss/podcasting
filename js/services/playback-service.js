/* CrowRules Podcasting — Playback Domain Service 1.0 */
(()=>{"use strict";if(window.CrowRulesPlayback)return;
const api=()=>window.CrowRulesData.getClientAsync();
const RPC=Object.freeze({
 conflicts:"get_my_podcast_playback_conflicts",devices:"get_my_podcast_playback_devices",events:"get_my_podcast_playback_device_events",
 progress:"get_my_podcast_playback_progress",start:"start_my_podcast_playback_session",heartbeat:"record_my_podcast_playback_heartbeat",
 finish:"finish_my_podcast_playback_session",takeover:"takeover_my_podcast_playback",expireStale:"expire_my_stale_podcast_playback_sessions",
 securitySummary:"get_my_podcast_playback_security_summary",library:"get_my_podcast_library",state:"get_my_podcast_playback_state",
 summary:"get_my_podcast_playback_summary",registerDevice:"register_my_podcast_playback_device",renameDevice:"rename_my_podcast_playback_device",
 revokeDevice:"revoke_my_podcast_playback_device"
});
const call=async(key,args={})=>{const name=RPC[key];if(!name)throw new Error("Unsupported playback operation.");const db=await api(),r=await db.rpc(name,args);if(r.error)throw r.error;return r.data};

async function conflicts(){return call("conflicts")}
async function devices(){return call("devices")}
async function events(limit=50){return call("events",{p_limit:limit})}
async function progress(episodeId){return call("progress",{p_episode_id:episodeId})}
async function run(task){return window.CrowRulesData.run(task)}
async function start(episodeId,type,userAgent,clientId){return call("start",{p_episode_id:episodeId,p_media_type:type,p_user_agent:userAgent,p_client_instance_id:clientId})}
async function heartbeat(sessionId,position,delta){return call("heartbeat",{p_session_id:sessionId,p_position_seconds:position,p_delta_seconds:delta})}
async function finish(sessionId,status,position){return call("finish",{p_session_id:sessionId,p_status:status,p_position_seconds:position})}
async function takeover(episodeId,type){return call("takeover",{p_episode_id:episodeId,p_media_type:type})}
async function expireStale(){return call("expireStale")}
async function securitySummary(){return call("securitySummary")}
async function library(){return call("library")}
async function state(){return call("state")}
async function summary(){return call("summary")}
async function episodes(ids=[]){if(!ids.length)return [];const db=await api(),r=await db.from("podcast_episodes").select("id,title,slug,podcast_id,thumbnail_url,duration_seconds").in("id",ids);if(r.error)throw r.error;return r.data||[]}
async function registerDevice(id,ua,type){return call("registerDevice",{p_client_instance_id:id,p_user_agent:ua,p_device_type:type,p_device_name:type==="desktop"?"My Desktop":type==="mobile"?"My Phone":type==="tablet"?"My Tablet":"My Device"})}
async function renameDevice(id,name){return call("renameDevice",{p_client_instance_id:id,p_device_name:name})}
async function revokeDevice(id){return call("revokeDevice",{p_client_instance_id:id})}
const contract=fn=>async(...args)=>window.CrowRulesData.execute(()=>fn(...args));
window.CrowRulesPlayback={version:"2.0",conflicts:contract(conflicts),devices:contract(devices),events:contract(events),progress:contract(progress),start:contract(start),heartbeat:contract(heartbeat),finish:contract(finish),takeover:contract(takeover),expireStale:contract(expireStale),securitySummary:contract(securitySummary),library:contract(library),state:contract(state),summary:contract(summary),episodes:contract(episodes),registerDevice:contract(registerDevice),renameDevice:contract(renameDevice),revokeDevice:contract(revokeDevice)};
})();