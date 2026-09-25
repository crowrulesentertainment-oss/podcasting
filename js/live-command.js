import {getSupabase} from "./supabase.js";
const db=await getSupabase(),root=document.querySelector("#liveCommand");let user,ids=[],broadcasts=[],metrics=[],events=[],egress=[],channels=[];
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
 const [m,e,g,r]=await Promise.all([
  db.from("podcast_live_metrics").select("*").eq("broadcast_id",live.id).order("captured_at",{ascending:false}).limit(60),
  db.from("podcast_live_engagement_events").select("id,event_type,metadata,created_at,user_id,session_id").eq("broadcast_id",live.id).order("created_at",{ascending:false}).limit(80),
  db.from("podcast_live_egress_jobs").select("*").eq("broadcast_id",live.id).maybeSingle(),
  db.from("podcast_live_replays").select("processing_status,hls_url,mp4_url,duration_seconds,processing_error,processing_started_at,processing_completed_at").eq("broadcast_id",live.id).maybeSingle()
 ]);metrics=m.data||[];events=e.data||[];egress=g.data?[g.data]:[];const replay=r.data;
 render(live,replay);
}
function render(b,replay){
 if(!b){root.innerHTML='<div class="panel empty-state"><h2>No live broadcast found</h2><p>Start a broadcast from the Live Production Studio.</p><a class="btn primary" href="live-production.html">Open Production Studio</a></div>';return}
 const latest=metrics[0],current=latest?.concurrent_viewers||0,peak=Math.max(b.peak_viewers||0,...metrics.map(x=>x.concurrent_viewers||0)),chat=events.filter(x=>x.event_type==="chat").length,reactions=events.filter(x=>x.event_type==="reaction").length,joins=events.filter(x=>x.event_type==="join").length,points=events.filter(x=>x.metadata?.crowpoints!=null).reduce((n,x)=>n+Number(x.metadata.crowpoints||0),0);
 const active=new Set(events.filter(x=>x.event_type==="heartbeat"||x.event_type==="join").filter(x=>x.session_id).map(x=>x.session_id)).size;
 const health=b.status==="live"?"LIVE / HEALTHY":b.status==="failed"?"BROADCAST FAILED":"PROCESSING";
 const rec=egress[0],recState=rec?.status||"not started";
 const replayState=replay?.processing_status||(["replay_ready","published"].includes(b.status)?"ready":"waiting");
 const timeline=events.slice(0,30).map(x=>'<div class="event"><b>'+esc(x.event_type.replaceAll("_"," ").toUpperCase())+'</b><span>'+esc(ago(x.created_at))+' • '+esc(x.metadata?.message||x.metadata?.reaction||"Audience activity")+'</span></div>').join("");
 root.innerHTML='<section class="kpis"><div class="panel kpi"><span class="muted">Current viewers</span><strong>'+fmt(current)+'</strong></div><div class="panel kpi"><span class="muted">Peak viewers</span><strong>'+fmt(peak)+'</strong></div><div class="panel kpi"><span class="muted">Chat activity</span><strong>'+fmt(chat)+'</strong></div><div class="panel kpi"><span class="muted">Reactions</span><strong>'+fmt(reactions)+'</strong></div><div class="panel kpi"><span class="muted">Active sessions</span><strong>'+fmt(active)+'</strong></div><div class="panel kpi"><span class="muted">CrowPoints</span><strong>'+fmt(points)+'</strong></div></section><section class="live-grid"><article class="panel live-card"><p class="eyebrow">LIVE NOW</p><h2>'+esc(b.title||"CrowRules Live")+'</h2><p class="insight"><span class="live-dot '+(b.status==="live"?"pulse":"")+'"></span>'+esc(health)+'</p><p class="muted">Broadcast started '+esc(ago(b.started_at))+' • '+fmt(b.total_viewers)+' total viewers</p><div class="momentum"><i style="width:'+Math.min(100,current?Math.max(8,current/Math.max(peak,1)*100):0)+'%"></i></div></article><article class="panel live-card"><p class="eyebrow">RECORDING / EGRESS</p><h2>'+esc(recState.toUpperCase())+'</h2><p class="muted">'+(rec?.egress_id?"Egress "+esc(rec.egress_id):"No Egress job recorded")+'</p><p>'+((rec?.duration_seconds||b.duration_seconds)?fmt(rec?.duration_seconds||b.duration_seconds)+" seconds captured":"Waiting for recording telemetry…")+'</p></article><article class="panel live-card"><p class="eyebrow">LIVE → REPLAY</p><h2>'+esc(String(replayState).toUpperCase())+'</h2><p class="muted">'+(replay?.hls_url?"HLS replay ready":replay?.mp4_url?"MP4 replay ready":replay?.processing_error?esc(replay.processing_error):"Replay processing is waiting for recording completion.")+'</p><div class="actions"><a class="btn" href="live-replays.html">Replay Library</a></div></article><article class="panel live-card"><p class="eyebrow">ENGAGEMENT TIMELINE</p><h2>Audience activity</h2><div class="event-list">'+(timeline||'<div class="empty-state muted">Waiting for engagement…</div>')+'</div></article></section>';
}
function subscribe(){
 channels.push(db.channel("creator-live-command-5-9")
 .on("postgres_changes",{event:"INSERT",schema:"public",table:"podcast_live_metrics"},p=>{if(broadcasts.some(b=>b.id===p.new.broadcast_id)){metrics.unshift(p.new);render(broadcasts.find(b=>b.id===p.new.broadcast_id))}})
 .on("postgres_changes",{event:"INSERT",schema:"public",table:"podcast_live_engagement_events"},p=>{if(broadcasts.some(b=>b.id===p.new.broadcast_id)){events.unshift(p.new);render(broadcasts.find(b=>b.id===p.new.broadcast_id))}})
 .on("postgres_changes",{event:"UPDATE",schema:"public",table:"podcast_live_broadcasts"},p=>{if(broadcasts.some(b=>b.id===p.new.id)){const i=broadcasts.findIndex(b=>b.id===p.new.id);broadcasts[i]=p.new;refresh()}})
 .on("postgres_changes",{event:"UPDATE",schema:"public",table:"podcast_live_egress_jobs"},p=>{refresh()})
 .on("postgres_changes",{event:"UPDATE",schema:"public",table:"podcast_live_replays"},p=>{refresh()})
 .subscribe());
}
boot().catch(e=>{console.error(e);root.innerHTML='<div class="panel empty"><h2>Live Command Center could not load.</h2><p>'+esc(e.message||e)+'</p></div>'});
