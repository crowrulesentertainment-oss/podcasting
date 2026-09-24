import {getSupabase} from "./supabase.js";

const supabase=await getSupabase();
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const toast=msg=>{let t=$(".toast");if(!t){t=document.createElement("div");t.className="toast";document.body.append(t)}t.textContent=msg;t.classList.add("show");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("show"),2600)};
const slug=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90);
const user=async()=>{if(!supabase)return null;const {data}=await supabase.auth.getUser();return data?.user||null};
const owned=async podcastId=>{const u=await user();if(!u)return false;const {data}=await supabase.from("podcast_creators").select("id").eq("podcast_id",podcastId).eq("user_id",u.id).eq("can_manage",true).maybeSingle();return !!data};
const duration=async file=>new Promise(resolve=>{if(!file)return resolve(null);const a=document.createElement("audio");a.preload="metadata";a.onloadedmetadata=()=>{const n=Number.isFinite(a.duration)?Math.round(a.duration):null;URL.revokeObjectURL(a.src);resolve(n)};a.onerror=()=>{URL.revokeObjectURL(a.src);resolve(null)};a.src=URL.createObjectURL(file)});
const upload=async(bucket,path,file)=>{const {data,error}=await supabase.storage.from(bucket).upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type||undefined});if(error)throw error;return data.path};
const publicUrl=(bucket,path)=>supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

async function loadCreatorPodcasts(select){
 if(!supabase)return;
 const u=await user();if(!u){select.innerHTML='<option value="">Sign in first</option>';return}
 const {data,error}=await supabase.from("podcast_creators").select("podcast_id,podcasts(id,title,slug,status)").eq("user_id",u.id).eq("can_manage",true);
 if(error){select.innerHTML='<option value="">Unable to load shows</option>';return}
 select.innerHTML=(data||[]).map(x=>'<option value="'+esc(x.podcast_id)+'">'+esc(x.podcasts?.title||"Untitled")+' — '+esc(x.podcasts?.status||"draft")+'</option>').join("")||'<option value="">No podcasts yet</option>';
}

async function createPodcast(){
 const form=$("[data-create-podcast]");if(!form)return;
 const selectFile=form.querySelector('[name="artwork_file"]');
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(!supabase){toast("Supabase is not configured");return}
  const u=await user();if(!u){toast("Sign in before creating a podcast");return}
  const fd=new FormData(form),title=String(fd.get("name")||"").trim();if(!title){toast("Podcast name is required");return}
  const base=slug(title)||"podcast";
  const {data:member}=await supabase.from("members").select("id").eq("user_id",u.id).maybeSingle();
  const {data:creator}=member?await supabase.from("creators").select("id").eq("member_id",member.id).maybeSingle():{data:null};
  let unique=base, n=2;
  while(true){const {data}=await supabase.from("podcasts").select("id").eq("slug",unique).maybeSingle();if(!data)break;unique=base+"-"+n++}
  const {data:podcast,error}=await supabase.from("podcasts").insert({title,slug:unique,description:String(fd.get("description")||""),category:String(fd.get("genre")||"Podcast"),status:"draft",creator_id:creator?.id||null}).select("id").single();
  if(error){toast(error.message);return}
  const {error:mapError}=await supabase.from("podcast_creators").insert({podcast_id:podcast.id,user_id:u.id,role:"owner",can_manage:true});
  if(mapError){await supabase.from("podcasts").delete().eq("id",podcast.id);toast(mapError.message);return}
  const file=selectFile?.files?.[0];
  if(file){
    try{
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
      const path=u.id+"/"+podcast.id+"/artwork-"+Date.now()+"."+ext;
      await upload("podcast-avatars",path,file);
      const {error:upErr}=await supabase.from("podcasts").update({artwork_url:publicUrl("podcast-avatars",path)}).eq("id",podcast.id);
      if(upErr)throw upErr;
    }catch(err){toast("Podcast created, but artwork upload failed: "+err.message)}
  }
  toast("Podcast draft created");
  location.href="studio.html";
 });
}

async function addEpisode(){
 const form=$("[data-add-episode]");if(!form)return;
 const select=form.querySelector('[name="podcast_id"]');await loadCreatorPodcasts(select);
 form.addEventListener("change",e=>{if(e.target.name==="media_file"){const f=e.target.files?.[0];if(f)duration(f).then(d=>{const out=form.querySelector("[data-duration]");if(out)out.textContent=d?("Detected duration: "+Math.floor(d/60)+":"+String(d%60).padStart(2,"0")):"Duration unavailable"})}});
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(!supabase){toast("Supabase is not configured");return}
  const u=await user();if(!u){toast("Sign in before adding an episode");return}
  const fd=new FormData(form),podcastId=String(fd.get("podcast_id")||"");if(!podcastId||!(await owned(podcastId))){toast("You do not have publishing access to this show");return}
  const title=String(fd.get("title")||"").trim(),media=form.querySelector('[name="media_file"]')?.files?.[0],art=form.querySelector('[name="artwork_file"]')?.files?.[0];
  if(!title||!media){toast("Episode title and media file are required");return}
  const base=slug(title)||"episode", {data:existing}=await supabase.from("podcast_episodes").select("slug").eq("podcast_id",podcastId).like("slug",base+"%");let unique=base,n=2;const taken=new Set((existing||[]).map(x=>x.slug));while(taken.has(unique))unique=base+"-"+n++;
  const dur=await duration(media);
  const access=fd.get("access_level")==="premium"?"premium":"free";
  const bucket=access==="premium"?"podcast-premium":"podcast-audio";
  const ext=(media.name.split(".").pop()||"mp3").toLowerCase();
  const {data:ep,error}=await supabase.from("podcast_episodes").insert({podcast_id:podcastId,title,slug:unique,description:String(fd.get("description")||""),episode_number:fd.get("episode_number")?Number(fd.get("episode_number")):null,season_number:fd.get("season_number")?Number(fd.get("season_number")):null,duration_seconds:dur,show_notes:String(fd.get("show_notes")||""),status:"draft",access_level:access,is_explicit:fd.get("is_explicit")==="on"}).select("id").single();
  if(error){toast(error.message);return}
  try{
    const path=u.id+"/"+ep.id+"/media-"+Date.now()+"."+ext;
    await upload(bucket,path,media);
    const audioUrl=access==="premium"?"storage://"+bucket+"/"+path:publicUrl(bucket,path);
    const {error:mediaErr}=await supabase.from("podcast_episodes").update({audio_url:audioUrl}).eq("id",ep.id);if(mediaErr)throw mediaErr;
    const {error:recordErr}=await supabase.from("podcast_episode_uploads").insert({episode_id:ep.id,uploaded_by:u.id,storage_bucket:bucket,storage_path:path,original_filename:media.name,mime_type:media.type,file_size_bytes:media.size,duration_seconds:dur,status:"ready"});if(recordErr)throw recordErr;
    if(art){
      const ae=(art.name.split(".").pop()||"jpg").toLowerCase(),ap=u.id+"/"+ep.id+"/artwork-"+Date.now()+"."+ae;
      await upload("podcast-avatars",ap,art);
      const {error:aeErr}=await supabase.from("podcast_episodes").update({thumbnail_url:publicUrl("podcast-avatars",ap)}).eq("id",ep.id);if(aeErr)throw aeErr;
    }
    const next=fd.get("submit_review")==="on"?"review":"draft";
    await supabase.from("podcast_episodes").update({status:next}).eq("id",ep.id);
    toast(next==="review"?"Episode submitted for review":"Episode saved as draft");
    location.href="studio.html";
  }catch(err){
    await supabase.from("podcast_episode_uploads").update({status:"failed",error_message:String(err.message||err)}).eq("episode_id",ep.id);
    toast("Media pipeline failed: "+err.message);
  }
 });
}

async function adminPublishing(){
 const el=$("[data-admin-publishing]");if(!el||!supabase)return;
 const u=await user();if(!u){el.innerHTML='<div class="panel empty"><h2>Administrator sign-in required.</h2><a class="btn primary" href="account.html">Sign in</a></div>';return}
 const {data:admin}=await supabase.rpc("crowrules_is_admin");if(!admin){el.innerHTML='<div class="panel empty"><h2>Administrator access is not active.</h2></div>';return}
 async function render(){
  const {data,error}=await supabase.from("podcast_episodes").select("id,title,slug,status,access_level,duration_seconds,created_at,published_at,podcast_id,podcasts(title)").in("status",["draft","review","scheduled","published"]).order("created_at",{ascending:false});
  if(error){el.innerHTML='<div class="panel empty"><p>'+esc(error.message)+'</p></div>';return}
  el.innerHTML='<div class="table">'+(data||[]).map(x=>'<div><div><b>'+esc(x.title)+'</b><br><span>'+esc(x.podcasts?.title||"Unknown show")+' • '+esc(x.status)+' • '+esc(x.access_level)+'</span></div><span>'+((x.duration_seconds||0)?Math.floor(x.duration_seconds/60)+":"+String(x.duration_seconds%60).padStart(2,"0"):"—")+'</span><div class="actions">'+(x.status==="review"?'<button class="btn primary" data-publish="'+x.id+'">Publish</button>':"")+(x.status==="published"?'<button class="btn" data-archive="'+x.id+'">Archive</button>':"")+(x.status==="draft"?'<button class="btn" data-review="'+x.id+'">Request review</button>':"")+'</div></div>').join("")+'</div>';
 }
 el.addEventListener("click",async e=>{
  const b=e.target.closest("[data-publish],[data-archive],[data-review]");if(!b)return;
  const id=b.dataset.publish||b.dataset.archive||b.dataset.review;
  const next=b.dataset.publish?"published":b.dataset.archive?"archived":"review";
  const patch={status:next};if(next==="published")patch.published_at=new Date().toISOString();
  const {error}=await supabase.from("podcast_episodes").update(patch).eq("id",id);if(error)toast(error.message);else{toast("Episode status: "+next);render()}
 });
 await render();
}

async function episodePage(){
 const el=$("[data-episode-page]");if(!el||!supabase)return;
 const params=new URLSearchParams(location.search),id=params.get("id");
 if(!id){el.innerHTML='<div class="panel empty"><h2>Episode not specified.</h2></div>';return}
 const {data:ep,error}=await supabase.from("podcast_episodes").select("*,podcasts(id,title,slug,artwork_url,status)").eq("id",id).eq("status","published").maybeSingle();
 if(error||!ep){el.innerHTML='<div class="panel empty"><h2>Episode unavailable.</h2><p>'+esc(error?.message||"This episode is not published.")+'</p></div>';return}
 let mediaUrl=ep.audio_url;
 if(String(mediaUrl||"").startsWith("storage://")){
  const parts=mediaUrl.slice(10).split("/"),bucket=parts.shift(),path=parts.join("/");
  const {data:signed,error:sErr}=await supabase.storage.from(bucket).createSignedUrl(path,3600);
  if(sErr||!signed?.signedUrl){el.innerHTML='<div class="panel empty"><h2>Premium access required.</h2><p>Sign in with an active subscription to play this episode.</p><a class="btn primary" href="subscriptions.html?show='+encodeURIComponent(ep.podcasts?.slug||"")+'">View subscription</a></div>';return}
  mediaUrl=signed.signedUrl;
 }
 const art=ep.thumbnail_url||ep.podcasts?.artwork_url||"";
 el.innerHTML='<article class="episode-page panel"><img class="episode-art" src="'+esc(art)+'" alt=""><div><p class="eyebrow">'+(ep.access_level==="premium"?"PREMIUM EPISODE":"EPISODE")+'</p><h1>'+esc(ep.title)+'</h1><p class="lead">'+esc(ep.description||"")+'</p><audio class="episode-audio" controls preload="metadata" src="'+esc(mediaUrl)+'"></audio><div class="stats"><span><b>'+((ep.duration_seconds||0)?Math.floor(ep.duration_seconds/60)+":"+String(ep.duration_seconds%60).padStart(2,"0"):"—")+'</b> duration</span><span><b>'+Number(ep.play_count||0).toLocaleString()+'</b> plays</span></div></div></article><section class="panel episode-notes"><p class="eyebrow">SHOW NOTES</p><div class="notes">'+esc(ep.show_notes||"No show notes yet.")+'</div></section>';
}
createPodcast();addEpisode();adminPublishing();episodePage();


async function creatorWorkspace(){
 const el=$("[data-creator-workspace]");if(!el||!supabase)return;
 const u=await user();if(!u){el.innerHTML='<div class="panel empty"><h2>Sign in to manage your episodes.</h2><a class="btn primary" href="account.html">Sign in</a></div>';return}
 async function render(){
  const {data,error}=await supabase.from("podcast_episodes").select("id,podcast_id,title,slug,description,show_notes,status,access_level,duration_seconds,thumbnail_url,audio_url,episode_number,season_number,published_at,updated_at,podcasts(title,slug)").order("updated_at",{ascending:false});
  if(error){el.innerHTML='<div class="panel empty"><h2>Unable to load workspace.</h2><p>'+esc(error.message)+'</p></div>';return}
  const rows=data||[];
  if(!rows.length){el.innerHTML='<div class="panel empty"><h2>No episodes yet.</h2><p>Create your first episode and it will appear here.</p><a class="btn primary" href="add-episode.html">Add episode</a></div>';return}
  el.innerHTML='<div class="workspace-toolbar"><div><p class="eyebrow">YOUR CATALOG</p><h2>'+rows.length+' episode'+(rows.length===1?'':'s')+'</h2></div><a class="btn primary" href="add-episode.html">＋ New episode</a></div><div class="workspace-list">'+rows.map(x=>'<article class="workspace-row" data-row="'+esc(x.id)+'"><div class="workspace-art">'+(x.thumbnail_url?'<img src="'+esc(x.thumbnail_url)+'" alt="">':'<span>CR</span>')+'</div><div class="workspace-main"><div class="workspace-title"><div><p class="eyebrow">'+esc(x.podcasts?.title||"Podcast")+'</p><h3>'+esc(x.title)+'</h3></div><span class="status-pill status-'+esc(x.status)+'">'+esc(x.status)+'</span></div><p>'+esc(x.description||"No description yet.")+'</p><small>'+esc(x.access_level||"free")+' • '+((x.duration_seconds||0)?Math.floor(x.duration_seconds/60)+":"+String(x.duration_seconds%60).padStart(2,"0"):"duration pending")+'</small><div class="workspace-actions"><button class="btn" data-edit="'+esc(x.id)+'">Edit</button>'+(x.status==="draft"?'<button class="btn" data-submit="'+esc(x.id)+'">Submit review</button>':"")+(x.status==="review"?'<button class="btn primary" data-withdraw="'+esc(x.id)+'">Back to draft</button>':"")+(x.status==="draft"||x.status==="review"?'<button class="btn" data-schedule="'+esc(x.id)+'">Schedule</button>':"")+(x.status==="scheduled"?'<button class="btn" data-unschedule="'+esc(x.id)+'">Unschedule</button>':"")+(x.status==="published"?'<a class="btn" href="episode.html?id='+encodeURIComponent(x.id)+'">View</a>':"")+'</div></div></article>').join("")+'</div>';
 }
 async function schedule(id){
  const {data:e}=await supabase.from("podcast_episodes").select("id,podcast_id,title").eq("id",id).maybeSingle();if(!e){toast("Episode unavailable");return}
  const when=prompt("Enter publication time in local ISO format, e.g. 2026-10-01T18:00:00");if(!when)return;const d=new Date(when);if(Number.isNaN(d.getTime())||d<=new Date()){toast("Choose a future date and time");return}
  const {error:se}=await supabase.from("podcast_schedule").insert({podcast_id:e.podcast_id,episode_id:e.id,title:e.title,starts_at:d.toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC",status:"scheduled"});if(se){toast(se.message);return}
  const {error}=await supabase.from("podcast_episodes").update({status:"scheduled",updated_at:new Date().toISOString()}).eq("id",id);if(error)toast(error.message);else{toast("Episode scheduled");render()}
 }
 async function edit(id){
  const {data:e,error}=await supabase.from("podcast_episodes").select("*,podcasts(title)").eq("id",id).maybeSingle();if(error||!e){toast(error?.message||"Episode unavailable");return}
  const modal=document.createElement("div");modal.className="modal-backdrop";modal.innerHTML='<div class="modal panel"><button class="modal-close" data-close>×</button><p class="eyebrow">EPISODE EDITOR</p><h2>'+esc(e.title)+'</h2><form class="form" data-editor><label>Title<input name="title" required value="'+esc(e.title)+'"></label><div class="split"><label>Season<input name="season_number" type="number" min="1" value="'+(e.season_number??"")+'"></label><label>Episode #<input name="episode_number" type="number" min="1" value="'+(e.episode_number??"")+'"></label></div><label>Description<textarea name="description" rows="4">'+esc(e.description||"")+'</textarea></label><label>Show notes<textarea name="show_notes" rows="7">'+esc(e.show_notes||"")+'</textarea></label><label>Access<select name="access_level"><option value="free" '+(e.access_level==="free"?"selected":"")+'>Free</option><option value="premium" '+(e.access_level==="premium"?"selected":"")+'>Premium</option></select></label><label>Replace media<input name="media_file" type="file" accept="audio/*,video/mp4,video/webm,video/quicktime"></label><label>Replace artwork<input name="artwork_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save changes</button></div></form></div>';
  document.body.append(modal);modal.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>modal.remove());
  modal.querySelector("form").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget),patch={title:String(fd.get("title")||"").trim(),description:String(fd.get("description")||""),show_notes:String(fd.get("show_notes")||""),access_level:fd.get("access_level")==="premium"?"premium":"free",season_number:fd.get("season_number")?Number(fd.get("season_number")):null,episode_number:fd.get("episode_number")?Number(fd.get("episode_number")):null,updated_at:new Date().toISOString()};if(!patch.title){toast("Title is required");return}try{const media=modal.querySelector('[name="media_file"]').files?.[0],art=modal.querySelector('[name="artwork_file"]').files?.[0];if(media){const d=await duration(media),bucket=patch.access_level==="premium"?"podcast-premium":"podcast-audio",ext=(media.name.split(".").pop()||"mp3").toLowerCase(),path=u.id+"/"+id+"/media-"+Date.now()+"."+ext;await upload(bucket,path,media);patch.audio_url=patch.access_level==="premium"?"storage://"+bucket+"/"+path:publicUrl(bucket,path);patch.duration_seconds=d;await supabase.from("podcast_episode_uploads").insert({episode_id:id,uploaded_by:u.id,storage_bucket:bucket,storage_path:path,original_filename:media.name,mime_type:media.type,file_size_bytes:media.size,duration_seconds:d,status:"ready"});}
 if(art){const ext=(art.name.split(".").pop()||"jpg").toLowerCase(),path=u.id+"/"+id+"/artwork-"+Date.now()+"."+ext;await upload("podcast-avatars",path,art);patch.thumbnail_url=publicUrl("podcast-avatars",path)}
 const {error:saveErr}=await supabase.from("podcast_episodes").update(patch).eq("id",id);if(saveErr)throw saveErr;toast("Episode saved");modal.remove();render()}catch(err){toast("Save failed: "+err.message)}};
 }
 el.onclick=async ev=>{const b=ev.target.closest("[data-edit],[data-submit],[data-withdraw],[data-unschedule]");if(!b)return;const id=b.dataset.edit||b.dataset.submit||b.dataset.withdraw||b.dataset.unschedule||b.dataset.schedule;if(b.dataset.edit)return edit(id);if(b.dataset.schedule)return schedule(id);let patch;if(b.dataset.submit)patch={status:"review"};else if(b.dataset.withdraw)patch={status:"draft"};else patch={status:"draft"};const {error}=await supabase.from("podcast_episodes").update(patch).eq("id",id);if(error)toast(error.message);else{if(b.dataset.unschedule)await supabase.from("podcast_schedule").update({status:"cancelled"}).eq("episode_id",id).eq("status","scheduled");toast("Episode updated");render()}};
 await render();
}
creatorWorkspace();
