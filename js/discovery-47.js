import {getSupabase} from "./supabase.js";
const db=await getSupabase();const root=document.querySelector("#newReleases");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
async function boot(){if(!root)return;if(!db){root.innerHTML='<div class="panel empty"><p>Connect Supabase to load new releases.</p></div>';return}
const {data,error}=await db.from("podcast_episodes").select("id,podcast_id,title,description,published_at,duration_seconds,play_count,status").eq("status","published").order("published_at",{ascending:false}).limit(30);
if(error){root.innerHTML='<div class="panel empty"><p>'+esc(error.message)+'</p></div>';return}
const rows=data||[];root.innerHTML=rows.length?rows.map(e=>'<article class="episode"><button class="play" data-episode-id="'+esc(e.id)+'">▶</button><div><span>'+new Date(e.published_at||Date.now()).toLocaleDateString()+'</span><h3>'+esc(e.title)+'</h3><p>'+esc(e.description||"New CrowRules Podcasting transmission.")+'</p></div><span>'+Number(e.play_count||0).toLocaleString()+' plays</span></article>').join(""):'<div class="panel empty"><p>No published episodes yet.</p></div>'}
boot();