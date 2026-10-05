(()=>{"use strict";
if(window.__CROW_PODCASTING_V13_3__)return;
window.__CROW_PODCASTING_V13_3__=true;

const KEY="crowrules_universal_player_v13_3";
const LEGACY="crowrules_universal_player_v13_2";
const QUEUE_KEY="crowrules_podcast_queue_v13_3";
const MAX_QUEUE=100;
let queueState={items:[],currentIndex:0,autoplay:true,updatedAt:0};
let syncing=false, remoteChannel=null, saveTimer=0;

const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const cleanItem=s=>{
  if(!s)return null;
  const x={
    id:s.id||s.episodeId||s.episode_id||"",
    title:s.title||s.name||"Untitled episode",
    creator:s.creator||s.creator_name||s.author||s.author_name||"CrowRules Podcasting",
    url:s.url||s.audio_url||s.audio||s.src||"",
    artwork:s.artwork||s.artwork_url||s.thumbnail_url||s.image_url||"",
    duration:Number(s.duration||s.duration_seconds||0)
  };
  return x.url?x:null;
};
const unique=items=>{
  const seen=new Set(); return (items||[]).map(cleanItem).filter(x=>x&&(!x.id||!seen.has(x.id)&&(seen.add(x.id),true))).slice(0,MAX_QUEUE);
};
function readLocal(){
  try{
    const raw=JSON.parse(localStorage.getItem(QUEUE_KEY)||"null");
    if(raw&&Array.isArray(raw.items))return raw;
  }catch(_){}
  try{
    const legacy=JSON.parse(localStorage.getItem(LEGACY)||"null");
    if(legacy?.url)return {items:[cleanItem(legacy)],currentIndex:0,autoplay:true,updatedAt:0};
  }catch(_){}
  return {items:[],currentIndex:0,autoplay:true,updatedAt:0};
}
function writeLocal(){
  queueState.items=unique(queueState.items);
  queueState.currentIndex=Math.max(0,Math.min(queueState.currentIndex,Math.max(0,queueState.items.length-1)));
  queueState.updatedAt=Date.now();
  try{localStorage.setItem(QUEUE_KEY,JSON.stringify(queueState));}catch(_){}
  window.dispatchEvent(new CustomEvent("crow:v13.3:queue",{detail:{...queueState,items:queueState.items.slice()}}));
  render();
}
async function persistRemote(){
  const sb=window.CROW_SUPABASE,u=window.__CROW_USER;
  if(!sb||!u||syncing)return;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{
      await sb.from("podcast_player_queue").upsert({
        user_id:u.id,
        queue:queueState.items,
        current_index:queueState.currentIndex,
        autoplay:queueState.autoplay,
        updated_at:new Date().toISOString()
      },{onConflict:"user_id"});
    }catch(e){console.warn("CrowRules V13.3 queue sync:",e.message||e)}
  },350);
}
async function loadRemote(){
  const sb=window.CROW_SUPABASE,u=window.__CROW_USER;
  if(!sb||!u)return;
  try{
    const r=await sb.from("podcast_player_queue").select("queue,current_index,autoplay,updated_at").eq("user_id",u.id).maybeSingle();
    if(r.error)throw r.error;
    if(r.data){
      const remoteTime=Date.parse(r.data.updated_at||"")||0;
      if(remoteTime>=queueState.updatedAt){
        syncing=true;
        queueState={items:unique(r.data.queue||[]),currentIndex:Number(r.data.current_index)||0,autoplay:r.data.autoplay!==false,updatedAt:remoteTime};
        try{localStorage.setItem(QUEUE_KEY,JSON.stringify(queueState))}catch(_){}
        syncing=false;
        render();
        await restoreCurrent(false);
      }
    }
  }catch(e){console.warn("CrowRules V13.3 remote queue:",e.message||e)}
}
function subscribeRemote(){
  const sb=window.CROW_SUPABASE,u=window.__CROW_USER;
  if(!sb||!u||remoteChannel)return;
  remoteChannel=sb.channel("crowrules-player-queue-v133-"+u.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"podcast_player_queue",filter:"user_id=eq."+u.id},payload=>{
      const row=payload.new;
      if(!row||Date.parse(row.updated_at||"")<=queueState.updatedAt)return;
      syncing=true;
      queueState={items:unique(row.queue||[]),currentIndex:Number(row.current_index)||0,autoplay:row.autoplay!==false,updatedAt:Date.parse(row.updated_at||"")||Date.now()};
      try{localStorage.setItem(QUEUE_KEY,JSON.stringify(queueState))}catch(_){}
      syncing=false;
      render(); restoreCurrent(false);
    }).subscribe();
}
function current(){return queueState.items[queueState.currentIndex]||null}
function getPlayer(){
  return {root:document.querySelector(".cr13-player"),audio:document.getElementById("cr13Audio")};
}
function ensurePlayerUI(){
  const p=getPlayer(); if(!p.root||p.root.dataset.v133)return;
  p.root.dataset.v133="1";
  const close=p.root.querySelector("#cr13Close");
  const queueBtn=document.createElement("button"); queueBtn.id="cr13QueueToggle";queueBtn.title="Up Next";queueBtn.setAttribute("aria-label","Open Up Next");queueBtn.textContent="☷";
  const autoBtn=document.createElement("button"); autoBtn.id="cr13Autoplay";autoBtn.title="Autoplay";autoBtn.textContent="AUTO";
  const miniBtn=document.createElement("button");miniBtn.id="cr13Mini";miniBtn.title="Mini player";miniBtn.textContent="⌄";
  close?.before(queueBtn,autoBtn,miniBtn);
  const panel=document.createElement("aside");panel.className="cr13-queue-panel";panel.hidden=true;
  panel.innerHTML='<div class="cr13-queue-head"><div><small>UP NEXT</small><b id="cr13QueueCount">0 episodes</b></div><div><button id="cr13QueueClear">CLEAR</button><button id="cr13QueueClose">×</button></div></div><div id="cr13QueueList"></div>';
  document.body.appendChild(panel);
  queueBtn.onclick=()=>{panel.hidden=!panel.hidden;render()};
  panel.querySelector("#cr13QueueClose").onclick=()=>panel.hidden=true;
  panel.querySelector("#cr13QueueClear").onclick=()=>{queueState.items=[];queueState.currentIndex=0;writeLocal();persistRemote()};
  autoBtn.onclick=()=>{queueState.autoplay=!queueState.autoplay;writeLocal();persistRemote()};
  miniBtn.onclick=()=>{document.body.classList.toggle("cr13-mini-player");localStorage.setItem("crowrules_player_mini_v13_3",document.body.classList.contains("cr13-mini-player")?"1":"0")};
  p.root.querySelector("#cr13Prev")?.addEventListener("click",()=>previous());
  p.root.querySelector("#cr13Next")?.addEventListener("click",()=>next(true));
  p.audio?.addEventListener("ended",()=>{if(queueState.autoplay)next(true)});
  p.audio?.addEventListener("loadedmetadata",()=>{const c=current();if(c&&p.audio.duration&&!c.duration)c.duration=p.audio.duration;});
  p.audio?.addEventListener("timeupdate",()=>syncCurrentPosition());
  if(localStorage.getItem("crowrules_player_mini_v13_3")==="1")document.body.classList.add("cr13-mini-player");
}
function syncCurrentPosition(){
  const p=getPlayer(),c=current(); if(!p.audio||!c)return;
  const detail={id:c.id,title:c.title,creator:c.creator,url:c.url,artwork:c.artwork,position:p.audio.currentTime,duration:p.audio.duration||c.duration};
  window.CROW_PLAYER_STATE=detail;
}
function loadItem(item,autoplay=true){
  item=cleanItem(item); if(!item)return false;
  let idx=queueState.items.findIndex(x=>x.id&&item.id&&x.id===item.id);
  if(idx<0){queueState.items.push(item);idx=queueState.items.length-1}
  queueState.currentIndex=idx;
  queueState.items[idx]={...queueState.items[idx],...item};
  writeLocal();persistRemote();
  const base=window.__CROW_V133_BASE_LOAD__;
  if(base){base(item,autoplay)}
  else if(window.CROW_PLAYER?.load){window.CROW_PLAYER.load(item,autoplay)}
  updateMediaSession();
  return true;
}
function add(item,playNow=false){
  item=cleanItem(item);if(!item)return false;
  const exists=queueState.items.some(x=>x.id&&item.id&&x.id===item.id);
  if(!exists)queueState.items.push(item);
  if(playNow){queueState.currentIndex=queueState.items.findIndex(x=>x.id===item.id)}
  writeLocal();persistRemote();
  if(playNow)restoreCurrent(true);
  return true;
}
function removeAt(i){
  if(i<0||i>=queueState.items.length)return;
  queueState.items.splice(i,1);
  if(i<queueState.currentIndex)queueState.currentIndex--;
  if(queueState.currentIndex>=queueState.items.length)queueState.currentIndex=Math.max(0,queueState.items.length-1);
  writeLocal();persistRemote();
}
function move(i,j){
  if(i<0||j<0||i>=queueState.items.length||j>=queueState.items.length)return;
  const x=queueState.items.splice(i,1)[0];queueState.items.splice(j,0,x);
  if(queueState.currentIndex===i)queueState.currentIndex=j;
  else if(i<queueState.currentIndex&&j>=queueState.currentIndex)queueState.currentIndex--;
  else if(i>queueState.currentIndex&&j<=queueState.currentIndex)queueState.currentIndex++;
  writeLocal();persistRemote();
}
function previous(){
  const p=getPlayer();if(p.audio&&p.audio.currentTime>3){p.audio.currentTime=0;return}
  if(queueState.currentIndex>0){queueState.currentIndex--;writeLocal();persistRemote();restoreCurrent(true)}
}
function next(fromEnd=false){
  if(queueState.currentIndex+1<queueState.items.length){
    queueState.currentIndex++;writeLocal();persistRemote();restoreCurrent(true);
  }else if(fromEnd){
    window.dispatchEvent(new CustomEvent("crow:v13.3:queue-end"));
  }
}
function restoreCurrent(autoplay=false){
  const c=current();if(!c)return;
  const p=getPlayer();if(!p.audio)return;
  const base=window.__CROW_V133_BASE_LOAD__;
  if(base)base(c,autoplay);
  else if(window.CROW_PLAYER?.load)window.CROW_PLAYER.load(c,autoplay);
  updateMediaSession();
}
function render(){
  const list=document.getElementById("cr13QueueList"),count=document.getElementById("cr13QueueCount"),auto=document.getElementById("cr13Autoplay");
  if(!list)return;
  if(count)count.textContent=queueState.items.length+" episode"+(queueState.items.length===1?"":"s");
  if(auto){auto.textContent=queueState.autoplay?"AUTO ON":"AUTO OFF";auto.classList.toggle("active",queueState.autoplay)}
  if(!queueState.items.length){list.innerHTML='<div class="cr13-queue-empty">Your Up Next queue is empty.<br><small>Use Add to Queue on any episode.</small></div>';return}
  list.innerHTML=queueState.items.map((x,i)=>'<article class="cr13-queue-item '+(i===queueState.currentIndex?"current":"")+'" data-q="'+i+'"><div class="cr13-q-art">'+(x.artwork?'<img src="'+esc(x.artwork)+'" alt="">':'◉')+'</div><button class="cr13-q-main" data-qplay="'+i"><b>'+esc(x.title)+'</b><small>'+esc(x.creator)+'</small></button><button class="cr13-q-up" title="Move up">↑</button><button class="cr13-q-down" title="Move down">↓</button><button class="cr13-q-remove" title="Remove">×</button></article>').join("");
  list.querySelectorAll("[data-qplay]").forEach(b=>b.onclick=()=>{queueState.currentIndex=Number(b.dataset.qplay);writeLocal();persistRemote();restoreCurrent(true)});
  list.querySelectorAll(".cr13-q-remove").forEach(b=>b.onclick=()=>removeAt(Number(b.closest("[data-q]").dataset.q)));
  list.querySelectorAll(".cr13-q-up").forEach(b=>b.onclick=()=>{const i=Number(b.closest("[data-q]").dataset.q);if(i>0)move(i,i-1)});
  list.querySelectorAll(".cr13-q-down").forEach(b=>b.onclick=()=>{const i=Number(b.closest("[data-q]").dataset.q);if(i<queueState.items.length-1)move(i,i+1)});
}
function updateMediaSession(){
  if(!("mediaSession" in navigator))return;
  const c=current();if(!c)return;
  try{
    navigator.mediaSession.metadata=new MediaMetadata({title:c.title||"Podcast",artist:c.creator||"CrowRules Podcasting",album:"CrowRules Podcasting",artwork:c.artwork?[{src:c.artwork}]:[]});
    navigator.mediaSession.setActionHandler("play",()=>window.CROW_PLAYER?.play?.());
    navigator.mediaSession.setActionHandler("pause",()=>window.CROW_PLAYER?.pause?.());
    navigator.mediaSession.setActionHandler("previoustrack",previous);
    navigator.mediaSession.setActionHandler("nexttrack",()=>next(true));
    navigator.mediaSession.setActionHandler("seekbackward",d=>{const p=getPlayer();p.audio.currentTime=Math.max(0,p.audio.currentTime-(d.seekOffset||10))});
    navigator.mediaSession.setActionHandler("seekforward",d=>{const p=getPlayer();p.audio.currentTime=Math.min(p.audio.duration||Infinity,p.audio.currentTime+(d.seekOffset||10))});
  }catch(_){}
}
async function hydrateContinueQueue(){
  const sb=window.CROW_SUPABASE,u=window.__CROW_USER;if(!sb||!u)return;
  if(queueState.items.length)return;
  try{
    const r=await sb.from("podcast_episode_progress").select("episode_id,percent_complete,last_played_at").eq("user_id",u.id).order("last_played_at",{ascending:false}).limit(10);
    const ids=(r.data||[]).map(x=>x.episode_id).filter(Boolean);if(!ids.length)return;
    const e=await sb.from("podcast_episodes").select("id,title,audio_url,thumbnail_url,duration_seconds").in("id",ids).eq("status","published");
    const by=new Map((e.data||[]).map(x=>[x.id,x]));
    const items=ids.map(id=>{const x=by.get(id);return x&&x.audio_url?{id:x.id,title:x.title,creator:"CrowRules Podcasting",url:x.audio_url,artwork:x.thumbnail_url,duration:x.duration_seconds}:null}).filter(Boolean);
    if(items.length){queueState.items=items;queueState.currentIndex=0;writeLocal();persistRemote()}
  }catch(e){console.warn("CrowRules V13.3 Continue Listening queue:",e.message||e)}
}
function interceptPlayButtons(){
  document.addEventListener("click",e=>{
    const b=e.target.closest?.("button,a,[role=button]");if(!b)return;
    const play=b.matches("[data-play],[data-play-episode],.crv15-play,.play")||/^(play|resume|listen|continue|▶|listen now)/i.test((b.textContent||"").trim());
    if(!play)return;
    const d=b.dataset||{};
    const item=cleanItem({id:d.episodeId||d.episode||d.id,title:d.title||d.episodeTitle,creator:d.creator||d.creatorName,url:d.audioUrl||d.audio||d.src||d.play||d.url,artwork:d.artwork||d.artworkUrl,duration:d.duration||d.durationSeconds});
    if(item){add(item,true);e.preventDefault();e.stopImmediatePropagation()}
  },true);
}
function addQueueButtons(){
  document.querySelectorAll("[data-add-to-queue]").forEach(b=>{
    if(b.dataset.v133)return;b.dataset.v133="1";
    b.addEventListener("click",e=>{e.preventDefault();const d=b.dataset;add({id:d.episodeId,title:d.title,creator:d.creator,url:d.audioUrl,artwork:d.artwork,duration:d.duration},false);b.textContent="✓ QUEUED"});
  });
}
function boot(){
  queueState=readLocal();
  ensurePlayerUI();render();interceptPlayButtons();addQueueButtons();
  const base=window.CROW_PLAYER?.load;
  if(base&&!base.__v133){
    window.__CROW_V133_BASE_LOAD__=base;
    const wrapped=function(item,autoplay){const ok=base.call(this,item,autoplay);const c=cleanItem(item);if(c){const idx=queueState.items.findIndex(x=>x.id&&c.id&&x.id===c.id);if(idx>=0)queueState.currentIndex=idx;else queueState.items.push(c);writeLocal();persistRemote();updateMediaSession()}return ok};
    wrapped.__v133=true;
    window.CROW_PLAYER.load=wrapped;
  }
  window.CROW_PLAYER_V13_3={
    version:"13.3.0",state:()=>({...queueState,items:queueState.items.slice()}),
    queue:()=>queueState.items.slice(),add,remove:removeAt,move,previous,next,
    autoplay(v){if(typeof v==="boolean"){queueState.autoplay=v;writeLocal();persistRemote()}return queueState.autoplay},
    load:loadItem,mini:()=>document.body.classList.toggle("cr13-mini-player")
  };
  window.addEventListener("crow:v13.2:navigate",()=>setTimeout(()=>{ensurePlayerUI();render();addQueueButtons();updateMediaSession()},60));
  window.addEventListener("storage",e=>{if(e.key===QUEUE_KEY&&e.newValue){try{queueState=JSON.parse(e.newValue);render();restoreCurrent(false)}catch(_){}}});
  const sync=async()=>{await hydrateContinueQueue();await loadRemote();subscribeRemote();restoreCurrent(false)};
  window.addEventListener("crow:auth",async()=>{if(remoteChannel){try{await window.CROW_SUPABASE?.removeChannel(remoteChannel)}catch(_){}remoteChannel=null}await sync()});
  setTimeout(sync,300);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();