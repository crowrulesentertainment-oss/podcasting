import {getSupabase} from "./supabase.js";
const db=await getSupabase(),root=document.querySelector("#liveCommand");
const API="https://cevylpnoexugwgygvtgu.supabase.co/functions/v1/podcast-live-moderation";
let user,ids=[],broadcasts=[],metrics=[],events=[],egress=[],replay,chatMessages=[],moderation=[],presence=[],reactionDisabled=false,channel;
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",""":"&quot;","'":"&#39;"}[m]));
const fmt=n=>Number(n||0).toLocaleString();
const ago=t=>{if(!t)return "—";const s=Math.max(0,Math.floor((Date.now()-new Date(t))/1000));return s<60?s+"s ago":Math.floor(s/60)+"m ago"};
async function boot(){
 if(!db){root.innerHTML='<div class="panel empty">Supabase is not configured.</div>';return}
 const a=await db.auth.getUser();user=a.data.user;if(!user){root.innerHTML='<div class="panel empty"><h2>Sign in to open Live Creator Command Center.</h2><a class="btn primary" href="account.html">Open account</a></div>';return}
 const c=await db.from("podcast_creators").select("podcast_id").eq("user_id",user.id).eq("can_manage",true);if(c.error)throw c.error;
 ids=(c.data||[]).map(x=>x.podcast_id);if(!ids.length){root.innerHTML='<div class="panel empty"><h2>No managed podcasts yet.</h2><a class="btn primary" href="create-podcast.html">Create podcast</a></div>';return}
 await refresh();subscribe();setInterval(refresh,10000);
}
async function refresh(){
 const b=await db.from("podcast_live_broadcasts").select("id,podcast_id,title,description,status,started_at,ended_at,duration_seconds,peak_viewers,total_viewers,egress_id,replay_episode_id,playback_hls_url,updated_at").in("podcast_id",ids).order("created_at",{ascending:false}).limit(20);if(b.error)throw b.error;
 broadcasts=b.data||[];const live=broadcasts.find(x=>["live","processing","replay_ready","published"].includes(x.status))||broadcasts[0];if(!live){render(null);return}
 const [m,e,g,r,room,pr,ma]=await Promise.all([
  db.from("podcast_live_metrics").select("*").eq("broadcast_id",live.id).order("captured_at",{ascending:false}).limit(60),
  db.from("podcast_live_engagement_events").select("id,event_type,metadata,created_at,user_id,session_id").eq("broadcast_id",live.id).order("created_at",{ascending:false}).limit(80),
  db.from("podcast_live_egress_jobs").select("*").eq("broadcast_id",live.id).maybeSingle(),
  db.from("podcast_live_replays").select("processing_status,hls_url,mp4_url,duration_seconds,processing_error").eq("broadcast_id",live.id).maybeSingle(),
  db.from("podcast_chat_rooms").select("id").eq("podcast_id",live.podcast_id).maybeSingle(),
  db.from("podcast_live_presence").select("user_id,session_id,joined_at,last_seen_at,left_at").eq("broadcast_id",live.id).is("left_at",null).gte("last_seen_at",new Date(Date.now()-60000).toISOString()),
  db.from("podcast_live_moderation_actions").select("id,action,target_message_id,target_user_id,reason,expires_at,created_at").eq("broadcast_id",live.id).order("created_at",{ascending:false}).limit(100)
 ]);
 metrics=m.data||[];events=e.data||[];egress=g.data?[g.data]:[];replay=r.data;presence=pr.data||[];moderation=ma.data||[];
 reactionDisabled=isReactionDisabled();
 chatMessages=[];if(room.data?.id){const cm=await db.from("podcast_chat_messages").select("id,user_id,display_name,message,created_at,is_hidden").eq("room_id",room.data.id).order("created_at",{ascending:false}).limit(30);chatMessages=cm.data||[]}
 render(live);
}
function isReactionDisabled(){
 const acts=moderation.filter(x=>["disable_reactions","enable_reactions"].includes(x.action)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 if(!acts.length)return false;
 const x=acts[0];return x.action==="disable_reactions" && (!x.expires_at||new Date(x.expires_at)>new Date());
}
function render(b){
 if(!b){root.innerHTML='<div class="panel empty-state"><h2>No live broadcast found</h2><p>Start a broadcast from the Live Production Studio.</p><a class="btn primary" href="live-production.html">Open Production Studio</a></div>';return}
 const latest=metrics[0],current=latest?.concurrent_viewers||0,peak=Math.max(b.peak_viewers||0,...metrics.map(x=>x.concurrent_viewers||0));
 const chat=events.filter(x=>x.event_type==="chat").length,reactions=events.filter(x=>x.event_type==="reaction").length;
 const active=presence.length||new Set(events.filter(x=>["heartbeat","join"].includes(x.event_type)&&x.session_id).map(x=>x.session_id)).size;
 const points=events.reduce((n,x)=>n+Number(x.metadata?.crowpoints||0),0),rec=egress[0],replayState=replay?.processing_status||(["replay_ready","published"].includes(b.status)?"ready":"waiting");
 const timeline=events.slice(0,30).map(x=>'<div class="event"><b>'+esc(x.event_type.replaceAll("_"," ").toUpperCase())+'</b><span>'+esc(ago(x.created_at))+" • "+esc(x.metadata?.message||x.metadata?.reaction||"Audience activity")+"</span></div>").join("");
 const chats=chatMessages.map(x=>'<div class="mod-item"><strong>'+esc(x.display_name||"Listener")+'</strong><p>'+esc(x.message)+'</p><small>'+esc(ago(x.created_at))+" • "+(x.is_hidden?"HIDDEN":"VISIBLE")+'</small><div class="mod-actions"><button class="btn" data-mod-action="'+(x.is_hidden?"unhide_message":"hide_message")+'" data-message-id="'+x.id+'">'+(x.is_hidden?"Unhide":"Hide")+'</button><button class="btn" data-mod-action="timeout" data-user-id="'+(x.user_id||"")+'">10m Timeout</button><button class="btn" data-history-user="'+(x.user_id||"")+'">History</button></div></div>').join("");
 const mods=moderation.slice(0,30).map(x=>'<div class="event"><b>'+esc(x.action.replaceAll("_"," ").toUpperCase())+'</b><span>'+esc(ago(x.created_at))+" • "+esc(x.reason||"Creator action")+(x.target_user_id?" • "+esc(x.target_user_id):"")+"</span></div>").join("");
 const audience=presence.map(x=>'<div class="event"><b>'+esc(x.user_id)+'</b><span>Active '+esc(ago(x.last_seen_at))+' • session '+esc(x.session_id)+'</span><div class="mod-actions"><button class="btn" data-mod-action="timeout" data-user-id="'+x.user_id+'">10m Timeout</button><button class="btn" data-history-user="'+x.user_id+'">History</button></div></div>').join("");
 root.innerHTML='<section class="kpis"><div class="panel kpi"><span class="muted">Current viewers</span><strong>'+fmt(current)+'</strong></div><div class="panel kpi"><span class="muted">Peak viewers</span><strong>'+fmt(peak)+'</strong></div><div class="panel kpi"><span class="muted">Chat activity</span><strong>'+fmt(chat)+'</strong></div><div class="panel kpi"><span class="muted">Reactions</span><strong>'+fmt(reactions)+'</strong></div><div class="panel kpi"><span class="muted">Active sessions</span><strong>'+fmt(active)+'</strong></div><div class="panel kpi"><span class="muted">CrowPoints</span><strong>'+fmt(points)+'</strong></div></section><section class="live-grid"><article class="panel live-card"><p class="eyebrow">LIVE CONTROL</p><h2>'+esc(b.title||"CrowRules Live")+'</h2><p><span class="live-dot"></span>'+esc(b.status.toUpperCase())+'</p><div class="toolbar"><button class="btn" data-mod-action="'+(reactionDisabled?"enable_reactions":"disable_reactions")+'">'+(reactionDisabled?"Enable Reactions":"Disable Reactions")+'</button><button class="btn" data-mod-action="alert">Send Audience Alert</button><button class="btn" data-mod-action="refresh">Refresh</button><a class="btn" href="live-room.html?room="+encodeURIComponent((awaitSlugFallback(b.podcast_id)||""))+"">Open Live Room</a></div><div class="alert-box"><strong>Safety state:</strong> Reactions '+(reactionDisabled?"disabled":"enabled")+'. Chat timeouts are enforced at submission.</div></article><article class="panel live-card"><p class="eyebrow">AUDIENCE</p><h2>Active Audience</h2><div class="event-list">'+(audience||'<div class="empty-state muted">No authenticated audience sessions detected.</div>')+'</div></article><article class="panel live-card"><p class="eyebrow">MODERATION</p><h2>Audience Control</h2><div class="mod-list">'+(chats||'<div class="empty-state muted">No chat messages.</div>')+'</div></article><article class="panel live-card"><p class="eyebrow">MODERATION LOG</p><h2>Creator Actions</h2><div class="event-list">'+(mods||'<div class="empty-state muted">No moderation actions yet.</div>')+'</div></article><article class="panel live-card"><p class="eyebrow">RECORDING / EGRESS</p><h2>'+esc((rec?.status||"NOT STARTED").toUpperCase())+'</h2><p class="muted">'+(rec?.egress_id?"Egress "+esc(rec.egress_id):"No Egress job recorded")+'</p></article><article class="panel live-card"><p class="eyebrow">LIVE → REPLAY</p><h2>'+esc(String(replayState).toUpperCase())+'</h2><p class="muted">'+(replay?.hls_url?"HLS replay ready":replay?.mp4_url?"MP4 replay ready":replay?.processing_error?esc(replay.processing_error):"Waiting for recording completion.")+'</p><a class="btn" href="live-replays.html">Replay Library</a></article><article class="panel live-card"><p class="eyebrow">ENGAGEMENT TIMELINE</p><h2>Audience activity</h2><div class="event-list">'+(timeline||'<div class="empty-state muted">Waiting for engagement…</div>')+'</div></article></section>';
}
function awaitSlugFallback(){return "";}
async function subscribe(){channel=db.channel("creator-live-command-5-11").on("postgres_changes",{event:"*",schema:"public",table:"podcast_live_engagement_events"},p=>{if(broadcasts.some(b=>b.id===p.new.broadcast_id))refresh()}).on("postgres_changes",{event:"*",schema:"public",table:"podcast_chat_messages"},()=>refresh()).on("postgres_changes",{event:"*",schema:"public",table:"podcast_live_moderation_actions"},()=>refresh()).on("postgres_changes",{event:"*",schema:"public",table:"podcast_live_presence"},()=>refresh()).on("postgres_changes",{event:"*",schema:"public",table:"podcast_live_broadcasts"},()=>refresh()).on("postgres_changes",{event:"*",schema:"public",table:"podcast_live_egress_jobs"},()=>refresh()).on("postgres_changes",{event:"*",schema:"public",table:"podcast_live_replays"},()=>refresh()).subscribe()}
async function moderate(action,message_id,target_user_id){
 if(action==="refresh"){refresh();return}
 const session=(await db.auth.getSession()).data.session;if(!session)return;
 const live=broadcasts.find(b=>["live","processing"].includes(b.status));if(!live)return;
 let reason="Creator Command Center action",expires_at=null,metadata={};
 if(action==="timeout")expires_at=new Date(Date.now()+600000).toISOString();
 if(action==="alert"){const message=prompt("Audience alert message:");if(!message)return;metadata={message:message.slice(0,280),public:true};reason="Creator audience alert"}
 const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},body:JSON.stringify({action,broadcast_id:live.id,message_id:message_id||null,target_user_id:target_user_id||null,reason,expires_at,metadata})});
 const o=await r.json();if(o.error)alert(o.error);else refresh()
}
async function showHistory(uid){if(!uid)return;const h=moderation.filter(x=>x.target_user_id===uid);alert(h.length?"Moderation history for "+uid+"\n\n"+h.map(x=>x.action+" — "+(x.reason||"Creator action")+" — "+new Date(x.created_at).toLocaleString()).join("\n"):"No moderation history for "+uid)}
document.addEventListener("click",e=>{const b=e.target.closest("[data-mod-action]");if(b)moderate(b.dataset.modAction,b.dataset.messageId,b.dataset.userId);const h=e.target.closest("[data-history-user]");if(h)showHistory(h.dataset.historyUser)});
boot().catch(e=>{console.error(e);root.innerHTML='<div class="panel empty"><h2>Live Command Center could not load.</h2><p>'+esc(e.message||e)+'</p></div>'});
