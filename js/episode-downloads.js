(()=>{"use strict";
const C=window.CROW_CONFIG||{},S=window.supabase,app=document.getElementById("app");
if(!S?.createClient||!C.supabaseUrl||!C.supabaseKey||!app)return;
const db=S.createClient(C.supabaseUrl,C.supabaseKey),params=new URLSearchParams(location.search);
const showId=params.get("id")||params.get("podcast_id")||params.get("podcast")||params.get("show_id")||params.get("show")||params.get("slug")||params.get("podcast_slug");
if(!showId)return;
const safeName=s=>String(s||"episode").normalize("NFKD").replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"-").slice(0,90)||"episode";
const style=document.createElement("style");style.textContent=".episode-download{white-space:nowrap}.episode-download[aria-busy=true]{opacity:.65;pointer-events:none}@media(max-width:800px){.episode-download{flex:1 1 auto}}";document.head.appendChild(style);
const files=new Map();
function addButtons(){
 document.querySelectorAll("#episodeList .episode-row[data-episode]").forEach(row=>{
  const id=row.getAttribute("data-episode");if(!id||row.querySelector("[data-download-episode]"))return;
  const ep=files.get(String(id));if(!ep||!ep.audio_url||/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(ep.audio_url))return;
  const actions=row.querySelector(".episode-actions");if(!actions)return;
  const b=document.createElement("button");b.type="button";b.className="btn episode-download";b.dataset.downloadEpisode=id;b.textContent="⬇ DOWNLOAD";b.setAttribute("aria-label","Download "+(ep.title||"episode"));
  b.addEventListener("click",async()=>{
   if(b.getAttribute("aria-busy")==="true")return;
   b.setAttribute("aria-busy","true");b.textContent="PREPARING…";
   try{
    const response=await fetch(ep.audio_url,{mode:"cors"});
    if(!response.ok)throw Error("The audio host did not provide a downloadable response.");
    const blob=await response.blob();if(!blob.size)throw Error("The episode file is empty.");
    const objectUrl=URL.createObjectURL(blob),a=document.createElement("a");
    const ext=(blob.type.split("/")[1]||"mp3").split(";")[0].replace("mpeg","mp3").replace(/[^a-z0-9]/gi,"")||"mp3";
    a.href=objectUrl;a.download=safeName(ep.title)+"."+ext;a.style.display="none";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
    b.textContent="✓ DOWNLOAD STARTED";
   }catch(err){
    // A direct link still gives the listener access when the host blocks cross-origin file fetching.
    const a=document.createElement("a");a.href=ep.audio_url;a.target="_blank";a.rel="noopener noreferrer";a.download=safeName(ep.title);a.textContent="Open episode audio";a.style.display="none";document.body.appendChild(a);a.click();a.remove();
    b.textContent="↗ OPEN AUDIO";b.title="Your browser opened the original audio URL because this host does not allow direct file downloading.";
   }finally{b.removeAttribute("aria-busy");setTimeout(()=>{if(b.isConnected&&b.textContent!=="⬇ DOWNLOAD")b.textContent="⬇ DOWNLOAD"},4500)}
  });
  actions.appendChild(b);
 });
}
async function load(){
 try{
  let q=db.from("podcast_episodes").select("id,podcast_id,title,audio_url").eq("podcast_id",showId);
  const result=await q;
  if(result.error)throw result.error;
  (result.data||[]).forEach(e=>files.set(String(e.id),e));addButtons();
 }catch(e){console.warn("[CrowRules downloads] Could not load episode download links",e.message)}
}
const observer=new MutationObserver(addButtons);observer.observe(app,{childList:true,subtree:true});
load();
})();