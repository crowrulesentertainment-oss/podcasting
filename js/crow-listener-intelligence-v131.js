(()=>{"use strict";
if(window.__CROW_LISTENER_INTELLIGENCE_V131__)return;
window.__CROW_LISTENER_INTELLIGENCE_V131__=true;
const RETRACK=15000;
let lastKey="",timer=0;
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function activeAudio(){return [...document.querySelectorAll("audio")].find(a=>!a.paused&&!a.ended&&a.currentTime>0)||null}
function meta(a){
  const d=a?.dataset||{};
  const root=a?.closest("[data-podcast-id],[data-episode-id],[data-content-id],article,section")||null;
  const podcastId=d.podcastId||root?.dataset?.podcastId||null;
  const episodeId=d.episodeId||root?.dataset?.episodeId||null;
  const contentTitle=d.episodeTitle||d.contentTitle||root?.dataset?.contentTitle||root?.querySelector("[data-episode-title],h1,h2,h3")?.textContent?.trim()||document.title;
  return {podcast_id:podcastId,episode_id:episodeId,content_title:contentTitle};
}
async function track(){
  const ch=window.CROW_PRESENCE_CHANNEL,u=window.__CROW_USER;
  if(!ch||!u)return;
  const a=activeAudio(),m=meta(a),mode=a?"listener":"browser";
  const key=[mode,m.podcast_id||"",m.episode_id||"",m.content_title||"",location.pathname].join("|");
  if(key===lastKey)return;
  lastKey=key;
  try{await ch.track({user_id:u.id,online_at:new Date().toISOString(),page:location.pathname.split("/").pop()||"home.html",mode,podcast_id:m.podcast_id,episode_id:m.episode_id,content_title:mode==="listener"?m.content_title:null,title:document.title})}catch(e){}
}
function bind(){
  document.querySelectorAll("audio").forEach(a=>{
    if(a.dataset.crowListenerIntel==="1")return;
    a.dataset.crowListenerIntel="1";
    ["play","pause","ended","loadedmetadata"].forEach(ev=>a.addEventListener(ev,()=>track()));
  });
  track();
}
function start(){
  if(!window.__CROW_USER)return;
  bind();
  clearInterval(timer);timer=setInterval(()=>{bind();},RETRACK);
  document.addEventListener("visibilitychange",track,{passive:true});
}
function boot(){
  if(window.__CROW_USER&&window.CROW_PRESENCE_CHANNEL)start();
  window.addEventListener("crow:ready",()=>setTimeout(start,150));
  window.addEventListener("crow:auth",()=>setTimeout(start,150));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();