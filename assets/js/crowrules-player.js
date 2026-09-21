/* CrowRules Podcasting — intelligent persistent audio player */
(function(){
  if(window.CrowRulesGlobalPlayer)return;
  window.CrowRulesGlobalPlayer=true;

  const KEY="crowrules_podcast_player_v2";
  const state={episode_id:null,title:"",show:"",audio_url:"",artwork_url:"",position:0,playing:false,duration:0,listen_id:null,session_key:null,last_synced:0,total_session_seconds:0,completed:false};
  try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||"{}"));}catch(_){}
  const now=()=>Date.now();
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){}};
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  let sb=null, syncTimer=null, started=false;

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
    const c=await client(); if(!c)return;
    const {data:{user}}=await c.auth.getUser().catch(()=>({data:{user:null}}));
    const row={episode_id:state.episode_id,user_id:user?.id||null,started_at:new Date().toISOString(),seconds_listened:0,completed:false,session_key:state.session_key};
    const {data}=await c.from("podcast_listens").insert(row).select("id").maybeSingle();
    if(data?.id)state.listen_id=data.id;
    state.last_synced=now();save();
  }

  async function syncProgress(force){
    const audio=document.querySelector("#crgpAudio");
    if(!audio||!state.episode_id||!started)return;
    const seconds=Math.max(0,Math.floor(audio.currentTime));
    state.position=audio.currentTime;state.duration=Number.isFinite(audio.duration)?audio.duration:state.duration;
    if(!force&&seconds<=Number(state.total_session_seconds||0))return;
    state.total_session_seconds=seconds;
    const c=await client();if(!c)return;
    const patch={seconds_listened:seconds,completed:!!state.completed};
    if(state.listen_id)await c.from("podcast_listens").update(patch).eq("id",state.listen_id);
    else await beginSession();
    state.last_synced=now();save();
  }

  function mount(){
    if(document.getElementById("crGlobalPlayer"))return;
    const el=document.createElement("aside");
    el.id="crGlobalPlayer";el.className="cr-global-player";el.hidden=!state.audio_url;
    el.setAttribute("aria-label","CrowRules Podcasting audio player");
    el.innerHTML='<img id="crgpArt" class="cr-global-art" alt=""><div class="cr-global-info"><div id="crgpTitle" class="cr-global-title">CrowRules Podcasting</div><div id="crgpShow" class="cr-global-show"></div></div><audio id="crgpAudio" controls preload="metadata"></audio><button id="crgpClose" class="cr-global-close" aria-label="Close player">×</button>';
    document.body.appendChild(el);
    const audio=el.querySelector("audio");

    function render(){
      el.hidden=!state.audio_url;
      if(state.audio_url&&audio.src!==state.audio_url)audio.src=state.audio_url;
      el.querySelector("#crgpArt").src=state.artwork_url||"";
      el.querySelector("#crgpArt").alt=state.title||"Podcast artwork";
      el.querySelector("#crgpTitle").textContent=state.title||"CrowRules Podcasting";
      el.querySelector("#crgpShow").textContent=state.show||"";
    }

    audio.addEventListener("loadedmetadata",()=>{
      state.duration=audio.duration||state.duration;
      if(state.position>0&&state.position<audio.duration)audio.currentTime=state.position;
      save();
      if(state.playing)audio.play().catch(()=>{state.playing=false;save();});
    });
    audio.addEventListener("play",async()=>{state.playing=true;save();await beginSession();});
    audio.addEventListener("pause",async()=>{state.playing=false;state.position=audio.currentTime;save();await syncProgress(true);});
    audio.addEventListener("timeupdate",()=>{
      state.position=audio.currentTime;
      if(!syncTimer)syncTimer=setTimeout(async()=>{syncTimer=null;await syncProgress(false);},10000);
      save();
    });
    audio.addEventListener("ended",async()=>{
      state.position=audio.duration||state.position;state.completed=true;state.playing=false;
      await syncProgress(true);save();
    });
    el.querySelector("#crgpClose").onclick=async()=>{
      audio.pause();await syncProgress(true);
      Object.assign(state,{audio_url:"",playing:false,position:0,listen_id:null,session_key:null,total_session_seconds:0,completed:false});
      started=false;save();el.hidden=true;
    };
    render();
  }

  window.CrowRulesPlayEpisode=async function(data){
    if(!data?.audio_url)return false;
    const same=state.episode_id===data.id&&state.audio_url===data.audio_url;
    if(!same){
      const old=document.querySelector("#crgpAudio");
      if(old){old.pause();await syncProgress(true);}
      Object.assign(state,{episode_id:data.id||null,title:data.title||"Untitled Episode",show:data.show||data.podcast_title||"",audio_url:data.audio_url,artwork_url:data.artwork_url||data.thumbnail_url||"",position:0,playing:true,duration:0,listen_id:null,session_key:crypto.randomUUID(),last_synced:0,total_session_seconds:0,completed:false});
      started=false;
    }else state.playing=true;
    save();mount();
    const audio=document.querySelector("#crgpAudio");
    if(audio){audio.src=state.audio_url;audio.load();audio.play().catch(()=>{state.playing=false;save();});}
    return true;
  };

  window.CrowRulesGetPlayerState=()=>({...state});
  window.CrowRulesSyncPlayer=()=>syncProgress(true);

  window.addEventListener("pagehide",()=>{state.position=document.querySelector("#crgpAudio")?.currentTime||state.position;save();});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")save();});
  document.addEventListener("DOMContentLoaded",mount);
})();