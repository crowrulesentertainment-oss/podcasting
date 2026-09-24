/* CrowRules Podcasting — Continue Listening UI Engine 106.0 */
(()=>{"use strict";
const cfg=window.CROWRULES_CONFIG||{},url=cfg.supabaseUrl,key=cfg.supabasePublishableKey;
if(!url||!key||!window.supabase)return;
const db=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function load(){
 const mount=document.querySelector("[data-continue-listening]"); if(!mount)return;
 const {data:{session}}=await db.auth.getSession();
 if(!session){mount.hidden=true;return}
 const r=await db.rpc("get_my_podcast_playback_progress",{p_episode_id:null});
 if(r.error||!Array.isArray(r.data)){mount.hidden=true;return}
 const rows=r.data.filter(x=>!x.completed&&Number(x.verified_seconds||0)>0).slice(0,12);
 if(!rows.length){mount.hidden=true;return}
 const ids=rows.map(x=>x.episode_id);
 const q=await db.from("podcast_episodes").select("id,title,slug,podcast_id,thumbnail_url").in("id",ids);
 const byId=new Map((q.data||[]).map(x=>[x.id,x]));
 mount.hidden=false;
 mount.innerHTML='<div class="continue-listening-head"><div><span class="eyebrow">YOUR LISTENING</span><h2>Continue Listening</h2><p>Pick up where you left off.</p></div></div><div class="continue-listening-grid">'+rows.map(x=>{
   const e=byId.get(x.episode_id)||{},pct=Math.min(100,Math.max(0,Number(x.progress_percent||0)));
   const href=e.slug?("episode.html?slug="+encodeURIComponent(e.slug)):("episode.html?id="+encodeURIComponent(x.episode_id));
   return '<article class="continue-card"><a class="continue-art" href="'+href+'" aria-label="Resume '+esc(e.title||"episode")+'">'+(e.thumbnail_url?'<img src="'+esc(e.thumbnail_url)+'" alt="" loading="lazy">':'<span>CR</span>')+'</a><div class="continue-body"><h3>'+esc(e.title||"Untitled Episode")+'</h3><div class="continue-meta">'+Math.round(pct)+'% played</div><div class="continue-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><i style="width:'+pct+'%"></i></div><a class="continue-resume" href="'+href+'">Resume →</a></div></article>'
 }).join("")+'</div>';
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load,{once:true});else load();
})();