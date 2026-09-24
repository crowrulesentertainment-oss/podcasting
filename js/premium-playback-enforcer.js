/* CrowRules Podcasting — Premium Playback Enforcer 88.0 */
(()=>{"use strict";
const cfg=window.CROWRULES_CONFIG||{},url=cfg.supabaseUrl,key=cfg.supabasePublishableKey;if(!url||!key||!window.supabase)return;
const db=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
const params=new URLSearchParams(location.search),episodeRef=params.get("id")||params.get("episode_id")||params.get("slug");
const esc=v=>String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
async function gate(){
 if(!document.body)return;
 let episodeId=params.get("id")||params.get("episode_id");
 if(!episodeId&&params.get("slug")){const r=await db.from("podcast_episodes").select("id").eq("slug",params.get("slug")).eq("status","published").maybeSingle();episodeId=r.data?.id||null}
 if(!episodeId)return;
 const q=await db.rpc("get_podcast_episode_for_viewer",{p_episode_id:episodeId});if(q.error||!q.data?.length)return;
 const e=q.data[0];if(e.access_level!=="premium")return;
 const premium=e.has_premium_access===true;
 const auth=await db.auth.getSession();const token=auth.data.session?.access_token;
 const media=[...document.querySelectorAll("audio,video")];
 const iframe=[...document.querySelectorAll(".video iframe")];
 if(!premium){media.forEach(x=>{x.removeAttribute("src");x.load();x.disabled=true});iframe.forEach(x=>x.closest(".video")?.remove());return}
 if(!token){return}
 async function authorize(type){
  const r=await fetch(url+"/functions/v1/premium-media-playback",{method:"POST",headers:{Authorization:"Bearer "+token,"apikey":key,"Content-Type":"application/json"},body:JSON.stringify({episode_id:e.id,media_type:type})});
  return r.ok?r.json():null;
 }
 const a=await authorize("audio");
 const audio=document.querySelector("audio");
 if(audio){if(a?.signed_url){audio.src=a.signed_url;audio.dataset.privatePlayback="true";audio.load()}else{audio.removeAttribute("src");audio.load();audio.closest(".player")?.insertAdjacentHTML("beforeend",'<p class="notice">Private premium audio is not available yet. Legacy premium playback is blocked.</p>')}}
 const v=await authorize("video");
 const nativeVideo=document.querySelector("video");
 if(nativeVideo){if(v?.signed_url){nativeVideo.src=v.signed_url;nativeVideo.dataset.privatePlayback="true";nativeVideo.load()}else{nativeVideo.remove();nativeVideo.closest(".video")?.insertAdjacentHTML("beforeend",'<p class="notice">Private premium video is not available yet. Legacy premium playback is blocked.</p>')}}
 iframe.forEach(x=>{x.closest(".video")?.remove()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(gate,350),{once:true});else setTimeout(gate,350);
})();
