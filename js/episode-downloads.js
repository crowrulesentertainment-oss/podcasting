(()=>{"use strict";
const C=window.CROW_CONFIG||{},S=window.supabase,app=document.getElementById("app");
if(!S?.createClient||!C.supabaseUrl||!C.supabaseKey||!app)return;
const db=window.CrowRulesSupabase||S.createClient(C.supabaseUrl,C.supabaseKey),params=new URLSearchParams(location.search);
const showId=params.get("id")||params.get("podcast_id")||params.get("podcast")||params.get("show_id")||params.get("show")||params.get("slug")||params.get("podcast_slug");
if(!showId)return;
const safeName=s=>String(s||"episode").normalize("NFKD").replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"-").slice(0,90)||"episode";
const style=document.createElement("style");style.textContent=".episode-download{white-space:nowrap}.episode-download[aria-busy=true]{opacity:.65;pointer-events:none}.episode-download-count{display:inline-block;font-size:10px;opacity:.8;margin-left:3px}@media(max-width:800px){.episode-download{flex:1 1 auto}}";document.head.appendChild(style);
const files=new Map(),counts=new Map();
async function loadCounts(){
 try{
  const {data,error}=await db.rpc("get_podcast_episode_download_counts",{p_podcast_id:showId});
  if(error)throw error;
  counts.clear();
  (data||[]).forEach(x=>counts.set(String(x.episode_id),Number(x.download_count)||0));
  document.querySelectorAll("[data-download-count]").forEach(el=>{
   el.textContent=(counts.get(el.dataset.downloadCount)||0).toLocaleString()+" downloads";
  });
 }catch(e){console.warn("[CrowRules downloads] Download totals unavailable",e.message)}
}
function addButtons(){
 document.querySelectorAll("#episodeList .episode-row[data-episode]").forEach(row=>{
  const id=row.getAttribute("data-episode");if(!id)return;
  const ep=files.get(String(id));if(!ep)return;
  let b=row.querySelector("[data-download-episode]");
  if(!ep.audio_url||/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(ep.audio_url)){if(b)b.remove();return}
  const actions=row.querySelector(".episode-actions");if(!actions)return;
  if(!b){
   b=document.createElement("button");b.type="button";b.className="btn episode-download";b.dataset.downloadEpisode=id;b.textContent="⬇ DOWNLOAD";b.setAttribute("aria-label","Download "+(ep.title||"episode"));
   b.addEventListener("click",async()=>{
    if(b.getAttribute("aria-busy")==="true")return;
    b.setAttribute("aria-busy","true");b.textContent="PREPARING…";
    try{
     const response=await fetch(ep.audio_url,{mode:"cors"});
     if(!response.ok)throw Error("Audio host blocked download");
     const blob=await response.blob();if(!blob.size)throw Error("Empty episode file");
     const objectUrl=URL.createObjectURL(blob),a=document.createElement("a");
     const ext=(blob.type.split("/")[1]||"mp3").split(";")[0].replace("mpeg","mp3").replace(/[^a-z0-9]/gi,"")||"mp3";
     a.href=objectUrl;a.download=safeName(ep.title)+"."+ext;a.style.display="none";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
     await logDownload(ep);b.textContent="✓ DOWNLOAD STARTED";
    }catch(err){
     b.textContent="↗ OPEN AUDIO";b.title="The audio host blocked direct downloading. Open the audio URL to save it if supported.";
     // Record that the listener requested the download/open action, not proof the file was saved.
     await logDownload(ep);
     window.open(ep.audio_url,"_blank","noopener,noreferrer");
    }finally{b.removeAttribute("aria-busy");setTimeout(()=>{if(b.isConnected)b.textContent="⬇ DOWNLOAD"},4500)}
   });
   actions.appendChild(b);
  }
  let counter=row.querySelector("[data-download-count]");
  if(!counter){counter=document.createElement("span");counter.className="episode-download-count";counter.dataset.downloadCount=id;counter.setAttribute("aria-live","polite");actions.appendChild(counter)}
  counter.textContent=(counts.get(String(id))||0).toLocaleString()+" downloads";
 });
}
let currentUser=null;
async function logDownload(ep){
 try{
  if(!currentUser){const {data}=await db.auth.getUser();currentUser=data?.user||null}
  const {error}=await db.from("podcast_episode_download_events").insert({episode_id:ep.id,podcast_id:ep.podcast_id||showId,user_id:currentUser?.id||null,source:"listener_show"});
  if(error)throw error;
  counts.set(String(ep.id),(counts.get(String(ep.id))||0)+1);
  const counter=Array.from(document.querySelectorAll("[data-download-count]")).find(el=>el.dataset.downloadCount===String(ep.id));
  if(counter)counter.textContent=counts.get(String(ep.id)).toLocaleString()+" downloads";
 }catch(e){console.warn("[CrowRules downloads] Could not record download request",e.message)}
}
async function load(){
 try{
  const result=await db.from("podcast_episodes").select("id,podcast_id,title,audio_url").eq("podcast_id",showId);
  if(result.error)throw result.error;
  (result.data||[]).forEach(e=>files.set(String(e.id),e));
  await loadCounts();addButtons();
 }catch(e){console.warn("[CrowRules downloads] Could not load episode download links",e.message)}
}
const observer=new MutationObserver(addButtons);observer.observe(app,{childList:true,subtree:true});
load();
})();