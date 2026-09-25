import {getSupabase} from "./supabase.js";
const db=await getSupabase(),root=document.querySelector("#liveCommand");
const API="https://cevylpnoexugwgygvtgu.supabase.co/functions/v1/podcast-live-moderation";
let user,ids=[],broadcasts=[],metrics=[],events=[],egress=[],replay,chatMessages=[],moderation=[],channel;
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
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
 const [m,e,g,r,room]=await Promise.all([
  db.from("podcast_live_metrics").select("*").eq("broadcast_id",live.id).order("captured_at",{ascending:false}).limit(60),
  db.from("podcast_live_engagement_events").select("id,event_type,metadata,created_at,user_id,session_id").eq("broadcast_id",live.id).order("created_at",{ascending:false}).limit(80),
  db.from("podcast_live_egress_jobs").select("*").eq("broadcast_id",live.id).maybeSingle(),
  db.from("podcast_live_replays").select("processing_status,hls_url,mp4_url,duration_seconds,processing_error").eq("broadcast_id",live.id).maybeSingle(),
  db.from("podcast_chat_rooms").select("id").eq("podcast_id",live.podcast_id).maybeSingle()
 ]);
 metrics=m.data||[];events=e.data||[];egress=g.data?[g.data]:[];replay=r.data;
 chatMessages=[];if(room.data?.id){const cm=await db.from("podcast_chat_messages").select("id,user_id,display_name,message,created_at,is_hidden").eq("room_id",room.data.id).order("created_at",{ascending:false}).limit(30);chatMessages=cm.data||[]}
 const ma=await db.from("podcast_live_moderation_actions").select("id,action,target_message_id,target_user_id,reason,created_at").eq("broadcast_id",live.id).order("created_at",{ascending:false}).limit(20);moderation=ma.data||[];
 render(live);
}
function render(b){
 if(!b){root.innerHTML='<div class="panel empty-state"><h2>No live broadcast found</h2><p>Start a broadcast from the Live Production Studio.</p><a class="btn primary" href="live-production.html">Open Production Studio</a></div>';return}
 const latest=metrics[0],current=latest?.concurrent_viewers||0,peak=Math.max(b.peak_viewers||0,...metrics.map(x=>x.concurrent_viewers||0));
 const chat=events.filter(x=>x.event_type==="chat").length,reactions=events.filter(x=>x.event_type==="reaction").length;
 const active=new Set(events.filter(x=>["heartbeat","join"].includes(x.event_type)&&x.session_id).map(x=>x.session_id)).size;
 const points=events.reduce((n,x)=>n+Number(x.metadata?.crowpoints||0),0),rec=egress[0],replayState=replay?.processing_status||(["replay_ready","published"].includes(b.status)?"ready":"waiting");
 const timeline=events.slice(0,30).map(x=>'<div class="event"><b>'+esc(x.event_type.replaceAll("_"," ").toUpperCase())+'</b><span>'+esc(ago(x.created_at))+' • '+esc(x.metadata?.message||x.metadata?.reaction||"Audience activity")+'</span></div>').join("");
 const chats=chatMessages.map(x=>'<div class="mod-item"><strong>'+esc(x.display_name||"Listener")+'</strong><p>'+esc(x.message)+'</p><small>'+esc(ago(x.created_at))+' • '+(x.is_hidden?"HIDDEN":"VISIBLE")+'</small><div class="mod-actions"><button class="btn" data-mod-action="'+(x.is_hidden?"unhide_message":"hide_message")+'" data-message-id="'+x.id+'">'+(x.is_hidden?"Unhide":"Hide")+'</button><button class="btn" data-mod-action="timeout" data-user-id="'+(x.user_id||"")+'">10m Timeout</button></div></div>').join("");
 const mods=moderation.map(x=>'<div class="event"><b>'+esc(x.action.replaceAll("_"," ").toUpperCase())+'</b><span>'+esc(ago(x.created_at))+' • '+esc(x.reason||"Creator action")+'</span></div>').join("");
 root.innerHTML='<section class="kpis"><div class="panel kpi"><span class="muted">Current viewers</span><strong>'+fmt(current)+'</strong></div><div class="panel kpi"><span class="muted">Peak viewers</span><strong>'+fmt(peak)+'</strong></div><div class="panel kpi"><span class="muted">Chat activity</span><strong>'+fmt(chat)+'</strong></div><div class="panel kpi"><span class="muted">Reactions</span><strong>'+fmt(reactions)+'</strong></div><div class="panel kpi"><span class="muted">Active sessions</span><strong>'+fmt(active)+'</strong></div><div class="panel kpi"><span class="muted">CrowPoints</span><strong>'+fmt(points)+'</strong></div></section><section class="live-grid"><article class="panel live-card"><p class="eyebrow">MODERATION</p><h2>Audience Control</h2><div class="mod-list">'+(chats||'<div class="empty-state muted">No chat messages.</div>')+'</div></article><article class="panel live-card"><p class="eyebrow">MODERATION LOG</p><h2>Creator Actions</h2><div class="event-list">'+(mods||'<div class="empty-state muted">No moderation actions yet.</div>')+'</div></article><article class="panel live-card"><p class="eyebrow">LIVE NOW</p><h2>'+esc(b.title||"CrowRules Live")+'</h2><p><span class="live-dot"></span>'+esc(b.status.toUpperCase())+'</p><p class="muted">'+fmt(b.total_viewers)+' total viewers</p></article><article class="panel live-card"><p class="eyebrow">RECORDING / EGRESS</p><h2>'+esc((rec?.status||"NOT STARTED").toUpperCase())+'</h2><p class="muted">'+(rec?.egress_id?"Egress "+esc(rec.egress_id):"No Egress job recorded")+'</p></article><article class="panel live-card"><p class="eyebrow">LIVE → REPLAY</p><h2>'+esc(String(replayState).toUpperCase())+'</h2><p class="muted">'+(replay?.hls_url?"HLS replay ready":replay?.mp4_url?"MP4 replay ready":replay?.processing_error?esc(replay.processing_error):"Waiting for recording completion.")+'</p><a class="btn" href="live-replays.html">Replay Library</a></article><article class="panel live-card"><p class="eyebrow">ENGAGEMENT TIMELINE</p><h2>Audience activity</h2><div class="event-list">'+(timeline||'<div class="empty-state muted">Waiting for engagement…</div>')+'</div></article></section>';
}
function subscribe(){channel=db.channel("creator-live-command-5-10").on("postgres_changes",{event:"*",schema:"public",table:"podcast_live_engagement_events"},p=>{if(broadcasts.some(b=>b.id===p.new.broadcast_id))refresh()}).on("postgres_changes",{event:"*",schema:"public",table:"podcast_chat_messages"},()=>refresh()).on("postgres_changes",{event:"*",schema:"public",table:"podcast_live_broadcasts"},()=>refresh()).on("postgres_changes",{event:"*",schema:"public",table:"podcast_live_egress_jobs"},()=>refresh()).on("postgres_changes",{event:"*",schema:"public",table:"podcast_live_replays"},()=>refresh()).subscribe()}
async function moderate(action,message_id,target_user_id){const session=(await db.auth.getSession()).data.session;if(!session)return;const live=broadcasts.find(b=>["live","processing"].includes(b.status));if(!live)return;const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},body:JSON.stringify({action,broadcast_id:live.id,message_id:message_id||null,target_user_id:target_user_id||null,reason:"Creator Command Center action",expires_at:action==="timeout"?new Date(Date.now()+600000).toISOString():null})});const o=await r.json();if(o.error)alert(o.error);else refresh()}
document.addEventListener("click",e=>{const b=e.target.closest("[data-mod-action]");if(b)moderate(b.dataset.modAction,b.dataset.messageId,b.dataset.userId)});
boot().catch(e=>{console.error(e);root.innerHTML='<div class="panel empty"><h2>Live Command Center could not load.</h2><p>'+esc(e.message||e)+'</p></div>'});
