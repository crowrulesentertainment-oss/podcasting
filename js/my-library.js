const sb=window.CROWRULES_SUPABASE||window.crSupabase||supabase.createClient(CROWRULES_CONFIG.supabaseUrl,CROWRULES_CONFIG.supabaseAnonKey);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
async function q(){const {data:{user}}=await sb.auth.getUser();return user;}
async function loadLibrary(){
 const user=await q(); if(!user){document.getElementById("gate").hidden=false;return;}
 document.getElementById("gate").hidden=true;
 const [{data:lib,error:e1},{data:prog,error:e2},{data:done,error:e3}]=await Promise.all([
  sb.rpc("get_my_podcast_library"),sb.rpc("get_my_podcast_playback_progress"),sb.rpc("get_my_podcast_playback_summary")
 ]);
 if(e1) throw e1;
 const rows=lib||[], epIds=[...new Set(rows.filter(x=>x.episode_id).map(x=>x.episode_id))];
 let episodes=[];
 if(epIds.length){const r=await sb.from("podcast_episodes").select("id,title,slug,podcast_id,thumbnail_url,duration_seconds").in("id",epIds);episodes=r.data||[];}
 const map=new Map(episodes.map(x=>[x.id,x]));
 const progress=Array.isArray(prog)?prog:[];
 const saved=rows.filter(x=>x.item_type==="episode").map(x=>({...x,e:map.get(x.episode_id)})).filter(x=>x.e);
 const favorites=rows.filter(x=>x.item_type==="favorite").map(x=>({...x,e:map.get(x.episode_id)})).filter(x=>x.e);
 const continueRows=progress.filter(x=>!x.completed&&Number(x.verified_seconds)>0).slice(0,12);
 const completed=progress.filter(x=>x.completed).slice(0,12);
 render("saved",saved); render("favorites",favorites); renderProgress("continue",continueRows); renderProgress("completed",completed);
 document.getElementById("empty").hidden=!!(saved.length||favorites.length||continueRows.length||completed.length);
}
function card(x,kind){
 const e=x.e||x; const pct=e.duration_seconds?Math.min(100,Math.round((Number(x.verified_seconds||0)/Number(e.duration_seconds))*100)):0;
 const href="episode.html?id="+encodeURIComponent(e.id);
 return '<article class="lib-card"><a class="art" href="'+href+'">'+(e.thumbnail_url?'<img src="'+esc(e.thumbnail_url)+'" alt="">':"CR")+'</a><div class="body"><div class="tag">'+(kind||"EPISODE")+'</div><h3>'+esc(e.title||"Untitled episode")+'</h3><div class="bar"><i style="width:'+pct+'%"></i></div><div class="meta">'+pct+'%'+(kind==="SAVED"||kind==="FAVORITE"?' · <button data-remove="'+esc(x.item_id)+'" data-type="'+esc(x.item_type)+'">REMOVE</button>':"")+'</div></div></article>';
}
function render(id,rows){const host=document.querySelector('[data-section="'+id+'"]');host.innerHTML=rows.length?rows.map(x=>card(x,id==="favorites"?"FAVORITE":"SAVED")).join(""):'<div class="muted">Nothing here yet.</div>';bind();}
function renderProgress(id,rows){const host=document.querySelector('[data-section="'+id+'"]');host.innerHTML=rows.length?rows.map(x=>card(x,id==="completed"?"COMPLETED":"CONTINUE")).join(""):'<div class="muted">Nothing here yet.</div>';}
function bind(){document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=async()=>{await sb.rpc("remove_my_podcast_item",{p_item_type:b.dataset.type,p_item_id:b.dataset.remove});loadLibrary().catch(showError);});}
function showError(e){console.error(e);document.getElementById("error").textContent="Library could not refresh. Please try again.";document.getElementById("error").hidden=false;}
sb.auth.onAuthStateChange(()=>loadLibrary().catch(showError)); loadLibrary().catch(showError);
