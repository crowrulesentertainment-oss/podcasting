import {getSupabase} from "./supabase.js";
const el=document.querySelector("#replayList");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const fmt=n=>{n=Number(n||0);const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return(h?h+"h ":"")+(m?m+"m ":"")+s+"s"};
(async()=>{
 const db=await getSupabase();if(!db){el.innerHTML='<div class="panel empty"><h2>Supabase is not configured.</h2></div>';return}
 const {data:user}=await db.auth.getUser();if(!user?.user){el.innerHTML='<div class="panel empty"><h2>Sign in to view replays.</h2><a class="btn primary" href="account.html">Open account</a></div>';return}
 const {data,error}=await db.from("podcast_live_broadcasts").select("*,podcast_live_replays(*)").eq("user_id",user.user.id).order("created_at",{ascending:false}).limit(50);
 if(error){el.innerHTML='<div class="panel empty"><h2>Replay engine unavailable.</h2><p>'+esc(error.message)+'</p></div>';return}
 const rows=data||[];
 el.innerHTML=rows.length?rows.map(b=>{const r=(b.podcast_live_replays||[])[0];const hls=r?.hls_url||b.playback_hls_url;return '<article class="panel"><span class="badge">'+esc(b.status)+'</span><h2>'+esc(b.title)+'</h2><p>'+esc(b.description||"Live broadcast")+'</p><div class="status-list"><span>Duration <b>'+fmt(b.duration_seconds)+'</b></span><span>Peak viewers <b>'+Number(b.peak_viewers||0).toLocaleString()+'</b></span><span>Replay processing <b>'+esc(r?.processing_status||"NOT CREATED")+'</b></span><span>HLS <b>'+(hls?"READY":"WAITING")+'</b></span></div>'+(hls?'<video controls preload="metadata" style="width:100%;margin-top:15px;border-radius:14px" src="'+esc(hls)+'"></video>':"")+(r?.mp4_url?'<p><a class="btn" href="'+esc(r.mp4_url)+'" target="_blank" rel="noopener">Open MP4 replay</a></p>':"")+(r?.processing_error?'<p class="notice">'+esc(r.processing_error)+'</p>':"")+'</article>'}).join(""):'<div class="panel empty"><h2>No live broadcasts yet.</h2><p>Start a transmission from the Live Production Studio.</p><a class="btn primary" href="live-production.html">Open studio</a></div>';
})();