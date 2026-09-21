/* CrowRules Podcasting — persistent global audio player */
(function(){
  if(window.CrowRulesGlobalPlayer)return;
  window.CrowRulesGlobalPlayer=true;
  const KEY="crowrules_podcast_player";
  const state={episode_id:null,title:"",show:"",audio_url:"",artwork_url:"",position:0,playing:false};
  try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||"{}"));}catch(_){}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){}}
  function mount(){
    if(document.getElementById("crGlobalPlayer"))return;
    const el=document.createElement("aside");el.id="crGlobalPlayer";el.className="cr-global-player";el.hidden=!state.audio_url;el.setAttribute("aria-label","CrowRules Podcasting audio player");
    el.innerHTML='<img id="crgpArt" class="cr-global-art" alt=""><div class="cr-global-info"><div id="crgpTitle" class="cr-global-title">CrowRules Podcasting</div><div id="crgpShow" class="cr-global-show"></div></div><audio id="crgpAudio" controls preload="metadata"></audio><button id="crgpClose" class="cr-global-close" aria-label="Close player">×</button>';
    document.body.appendChild(el);const audio=el.querySelector("audio");
    function render(){el.hidden=!state.audio_url;if(state.audio_url&&audio.src!==state.audio_url)audio.src=state.audio_url;el.querySelector("#crgpArt").src=state.artwork_url||"";el.querySelector("#crgpArt").alt=state.title||"Podcast artwork";el.querySelector("#crgpTitle").textContent=state.title||"CrowRules Podcasting";el.querySelector("#crgpShow").textContent=state.show||""}
    audio.addEventListener("loadedmetadata",()=>{if(state.position>0&&state.position<audio.duration)audio.currentTime=state.position;if(state.playing)audio.play().catch(()=>{state.playing=false;save()})});
    audio.addEventListener("timeupdate",()=>{state.position=audio.currentTime;if(Math.floor(audio.currentTime)%5===0)save()});
    audio.addEventListener("play",()=>{state.playing=true;save()});audio.addEventListener("pause",()=>{state.playing=false;state.position=audio.currentTime;save()});audio.addEventListener("ended",()=>{state.playing=false;state.position=0;save()});
    el.querySelector("#crgpClose").onclick=()=>{audio.pause();Object.assign(state,{audio_url:"",playing:false,position:0});save();el.hidden=true};render();
  }
  window.CrowRulesPlayEpisode=function(data){if(!data?.audio_url)return false;Object.assign(state,{episode_id:data.id||null,title:data.title||"Untitled Episode",show:data.show||data.podcast_title||"",audio_url:data.audio_url,artwork_url:data.artwork_url||data.thumbnail_url||"",position:0,playing:true});save();mount();const audio=document.querySelector("#crgpAudio");if(audio){audio.src=state.audio_url;audio.load();audio.play().catch(()=>{state.playing=false;save()})}return true};
  window.CrowRulesGetPlayerState=function(){return {...state}};
  document.addEventListener("DOMContentLoaded",mount);
})();