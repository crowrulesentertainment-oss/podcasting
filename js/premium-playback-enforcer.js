/* CrowRules Podcasting — Premium Playback Enforcer 88.0 */
(()=>{"use strict";
const cfg=window.CROWRULES_CONFIG||{},url=cfg.supabaseUrl,key=cfg.supabasePublishableKey;if(!url||!key||!window.supabase)return;
const db=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
const params=new URLSearchParams(location.search);
async function gate(){
 let episodeId=params.get("id")||params.get("episode_id");
 if(!episodeId&&params.get("slug")){const r=await db.from("podcast_episodes").select("id").eq("slug",params.get("slug")).eq("status","published").maybeSingle();episodeId=r.data?.id||null}
 if(!episodeId)return;
 const q=await db.rpc("get_podcast_episode_for_viewer",{p_episode_id:episodeId});if(q.error||!q.data?.length)return;
 const e=q.data[0];if(e.access_level!=="premium")return;
 const auth=await db.auth.getSession(),token=auth.data.session?.access_token;
 const media=[...document.querySelectorAll("audio,video")],iframe=[...document.querySelectorAll(".video iframe")];
 if(e.has_premium_access!==true){media.forEach(x=>{x.removeAttribute("src");x.load();x.controls=false});iframe.forEach(x=>x.closest(".video")?.remove());return}
 if(!token)return;
 async function authorize(type){const r=await fetch(url+"/functions/v1/premium-media-playback",{method:"POST",headers:{Authorization:"Bearer "+token,"apikey":key,"Content-Type":"application/json"},body:JSON.stringify({episode_id:e.id,media_type:type})});return r.ok?r.json():null}
 const a=await authorize("audio"),audio=document.querySelector("audio");
 if(audio){if(a?.signed_url){audio.src=a.signed_url;audio.dataset.privatePlayback="true";audio.load()}else{audio.removeAttribute("src");audio.load();audio.closest(".player")?.insertAdjacentHTML("beforeend",'<p class="notice">Private premium audio is not available yet. Legacy premium playback is blocked.</p>')}}
 const v=await authorize("video");
 let nativeVideo=document.querySelector("video");
 if(v?.signed_url){
  if(!nativeVideo){const box=document.querySelector(".video");if(box){box.innerHTML="";nativeVideo=document.createElement("video");nativeVideo.controls=true;nativeVideo.preload="metadata";nativeVideo.playsInline=true;box.appendChild(nativeVideo)}}
  if(nativeVideo){nativeVideo.src=v.signed_url;nativeVideo.dataset.privatePlayback="true";nativeVideo.load()}
 }else{if(nativeVideo)nativeVideo.remove();iframe.forEach(x=>x.closest(".video")?.remove())}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(gate,350),{once:true});else setTimeout(gate,350);
})();
