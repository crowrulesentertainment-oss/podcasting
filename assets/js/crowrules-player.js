/* CrowRules Podcasting — Universal persistent audio player */
(function(){
  if(window.CrowRulesGlobalPlayer)return;
  window.CrowRulesGlobalPlayer=true;

  const KEY="crowrules_podcast_player_v3";
  const state={episode_id:null,title:"",show:"",audio_url:"",artwork_url:"",position:0,playing:false,duration:0,listen_id:null,session_key:null,total_session_seconds:0,completed:false};
  try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||"{}"));}catch(_){}
  const now=()=>Date.now();
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){}};
  let sb=null,syncTimer=null,started=false,audio=null;

  async function client(){
    if(sb)return sb;
    if(window.crowSupabase){sb=window.crowSupabase;return sb;}
    if(window.getSupabaseClient){sb=await window.getSupabaseClient();return sb;}
    if(window.loadSupabase){sb=await window.loadSupabase();return sb;}
    return null;
  }

  async function beginSession(){
    if(!state.episode_id||started)return;
    started=true;
    state.session_key=state.session_key||crypto.randomUUID();
    const c=await client();if(!c)return;
    const {data:{user}}=await c.auth.getUser().catch(()=>({data:{user:null}}));
    const row={episode_id:state.episode_id,user_id:user?.id||null,started_at:new Date().toISOString(),seconds_listened:0,completed:false,session_key:state.session_key};
    const {data}=await c.from("podcast_listens").insert(row).select("id").maybeSingle();
    if(data?.id)state.listen_id=data.id;
    state.last_synced=now();save();
  }

  async function syncProgress(force){
    if(!audio||!state.episode_id||!started)return;
    const seconds=Math.max(0,Math.floor(audio.currentTime));
    state.position=audio.currentTime;
    state.duration=Number.isFinite(audio.duration)?audio.duration:state.duration;
    if(!force&&seconds<=Number(state.total_session_seconds||0))return;
    state.total_session_seconds=seconds;
    const c=await client();if(!c)return;
    const patch={seconds_listened:seconds,completed:!!state.completed};
    if(state.listen_id)await c.from("podcast_listens").update(patch).eq("id",state.listen_id);
    else await beginSession();
    state.last_synced=now();save();
  }

  function css(){
    if(document.getElementById("crUniversalPlayerStyles"))return;
    const s=document.createElement("style");s.id="crUniversalPlayerStyles";s.textContent=`
      .cr-global-player{position:fixed;left:18px;right:18px;bottom:16px;z-index:12000;display:grid;grid-template-columns:auto 44px minmax(120px,1fr) minmax(150px,1.8fr) auto auto;align-items:center;gap:12px;padding:10px 13px;border:1px solid rgba(0,229,255,.2);border-radius:18px;background:rgba(5,6,14,.94);backdrop-filter:blur(22px);box-shadow:0 20px 70px rgba(0,0,0,.55),0 0 35px rgba(0,229,255,.06);font-family:Montserrat,sans-serif}.cr-global-art{width:42px;height:42px;border-radius:10px;object-fit:cover;background:#11111d;border:1px solid rgba(255,255,255,.08)}.cr-global-info{min-width:0}.cr-global-title{font:800 11px Orbitron,sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cr-global-show{margin-top:3px;color:#858da3;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cr-global-play{width:42px;height:42px;border:0;border-radius:50%;background:linear-gradient(135deg,#00e5ff,#8b5cf6);color:#05050b;font-weight:900;cursor:pointer}.cr-global-play:disabled{opacity:.35;cursor:not-allowed}.cr-global-progress{min-width:0}.cr-global-range{width:100%;accent-color:#00e5ff;cursor:pointer}.cr-global-meta{display:flex;justify-content:space-between;color:#737b91;font:700 8px Orbitron,sans-serif}.cr-global-select,.cr-global-volume{background:#090a13;color:#dce1ef;border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:7px;font-size:10px}.cr-global-volume{width:82px}.cr-global-status{color:#00e5ff;font:800 8px Orbitron,sans-serif;letter-spacing:.08em;white-space:nowrap}@media(max-width:820px){.cr-global-player{left:8px;right:8px;bottom:8px;grid-template-columns:auto 40px minmax(0,1fr) auto}.cr-global-art{width:38px;height:38px}.cr-global-progress{grid-column:1/-1;grid-row:2}.cr-global-select,.cr-global-volume{display:none}.cr-global-status{display:none}}`
    ;document.head.appendChild(s);
  }

  function mount(){
    if(document.getElementById("crGlobalPlayer"))return;
    css();
    const el=document.createElement("aside");
    el.id="crGlobalPlayer";el.className="cr-global-player";el.setAttribute("aria-label","CrowRules universal audio player");
    el.innerHTML='<img id="crgpArt" class="cr-global-art" alt="Podcast artwork"><div class="cr-global-info"><div id="crgpTitle" class="cr-global-title">CrowRules Podcasting</div><div id="crgpShow" class="cr-global-show">Universal Audio Player · Ready</div></div><button id="crgpPlay" class="cr-global-play" type="button" aria-label="Play">▶</button><div class="cr-global-progress"><input id="crgpRange" class="cr-global-range" type="range" min="0" max="1000" value="0" aria-label="Seek audio"><div class="cr-global-meta"><span id="crgpTime">0:00</span><span id="crgpDuration">0:00</span></div></div><select id="crgpSpeed" class="cr-global-select" aria-label="Playback speed"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="1.75">1.75×</option><option value="2">2×</option></select><input id="crgpVolume" class="cr-global-volume" type="range" min="0" max="1" step=".01" value=".9" aria-label="Volume"><span id="crgpStatus" class="cr-global-status">READY</span></aside>';
    document.body.appendChild(el);
    audio=new Audio();audio.preload="metadata";audio.volume=.9;

    const fmt=s=>{s=Math.max(0,Math.floor(s||0));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");};
    const title=el.querySelector("#crgpTitle"),show=el.querySelector("#crgpShow"),art=el.querySelector("#crgpArt"),play=el.querySelector("#crgpPlay"),range=el.querySelector("#crgpRange"),time=el.querySelector("#crgpTime"),duration=el.querySelector("#crgpDuration"),status=el.querySelector("#crgpStatus"),speed=el.querySelector("#crgpSpeed"),volume=el.querySelector("#crgpVolume");

    function render(){
      title.textContent=state.title||"CrowRules Podcasting";
      show.textContent=state.show||"Universal Audio Player · Ready";
      art.src=state.artwork_url||"";
      art.alt=state.title||"Podcast artwork";
      play.disabled=!state.audio_url;
      play.textContent=state.playing?"❚❚":"▶";
      status.textContent=state.audio_url?(state.playing?"PLAYING":"PAUSED"):"READY";
      if(state.audio_url&&audio.src!==state.audio_url){audio.src=state.audio_url;audio.load();}
      time.textContent=fmt(state.position);
      duration.textContent=fmt(state.duration);
    }

    audio.addEventListener("loadedmetadata",()=>{
      state.duration=audio.duration||state.duration;
      if(state.position>0&&state.position<audio.duration)audio.currentTime=state.position;
      duration.textContent=fmt(audio.duration);save();
      if(state.playing)audio.play().catch(()=>{state.playing=false;save();render();});
    });
    audio.addEventListener("play",async()=>{state.playing=true;save();render();await beginSession();});
    audio.addEventListener("pause",async()=>{state.playing=false;state.position=audio.currentTime;save();render();await syncProgress(true);});
    audio.addEventListener("timeupdate",()=>{
      state.position=audio.currentTime;state.duration=audio.duration||state.duration;
      range.value=state.duration?Math.round(audio.currentTime/state.duration*1000):0;
      time.textContent=fmt(audio.currentTime);duration.textContent=fmt(state.duration);
      if(!syncTimer)syncTimer=setTimeout(async()=>{syncTimer=null;await syncProgress(false);},10000);
      save();
    });
    audio.addEventListener("ended",async()=>{state.position=audio.duration||state.position;state.completed=true;state.playing=false;await syncProgress(true);save();render();});
    play.onclick=()=>{if(!state.audio_url)return;if(audio.paused)audio.play().catch(()=>{});else audio.pause();};
    range.oninput=()=>{if(audio.duration)audio.currentTime=(Number(range.value)/1000)*audio.duration;};
    speed.onchange=()=>{audio.playbackRate=Number(speed.value);};
    volume.oninput=()=>{audio.volume=Number(volume.value);try{localStorage.setItem("crowrules_player_volume",volume.value);}catch(_){}};
    try{const v=Number(localStorage.getItem("crowrules_player_volume"));if(Number.isFinite(v)){audio.volume=v;volume.value=v;}}catch(_){}
    render();
  }

  window.CrowRulesPlayEpisode=async function(data){
    if(!data?.audio_url)return false;
    const same=state.episode_id===data.id&&state.audio_url===data.audio_url;
    if(!same){
      if(audio&&!audio.paused){audio.pause();await syncProgress(true);}
      Object.assign(state,{episode_id:data.id||null,title:data.title||"Untitled Episode",show:data.show||data.podcast_title||"",audio_url:data.audio_url,artwork_url:data.artwork_url||data.thumbnail_url||"",position:0,playing:true,duration:0,listen_id:null,session_key:crypto.randomUUID(),last_synced:0,total_session_seconds:0,completed:false});
      started=false;
    }else state.playing=true;
    save();mount();
    audio.src=state.audio_url;audio.load();audio.play().catch(()=>{state.playing=false;save();renderPlayer();});
    return true;
  };

  function renderPlayer(){const e=document.getElementById("crGlobalPlayer");if(!e)return;const p=e.querySelector("#crgpPlay"),st=e.querySelector("#crgpStatus");p.textContent=state.playing?"❚❚":"▶";p.disabled=!state.audio_url;st.textContent=state.audio_url?(state.playing?"PLAYING":"PAUSED"):"READY";}

  window.CrowRulesGetPlayerState=()=>({...state});
  window.CrowRulesSyncPlayer=()=>syncProgress(true);
  window.addEventListener("pagehide",()=>{state.position=audio?.currentTime||state.position;save();});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")save();});
  document.addEventListener("DOMContentLoaded",mount);
})();