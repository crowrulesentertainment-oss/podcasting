(()=>{"use strict";
if(window.__CROW_GLOBAL_AUDIO__)return;window.__CROW_GLOBAL_AUDIO__=true;
const C=window.CROW_CONFIG||{};let analyticsClient=null;try{if(window.supabase?.createClient&&C.supabaseUrl&&C.supabaseKey)analyticsClient=window.supabase.createClient(C.supabaseUrl,C.supabaseKey)}catch(_){}
let activeListenSessionKey=null,lastListenFlush=0,listenEventBusy=false,listenAccumulatedSeconds=0;
async function resolveEpisodeId(t){if(t?.episodeId)return t.episodeId;if(!analyticsClient||!t)return null;try{let q=analyticsClient.from("podcast_episodes").select("id").eq("audio_url",String(t.url||"")).limit(1);let r=await q.maybeSingle();if(!r.error&&r.data?.id){t.episodeId=r.data.id;queue[index]=t;save();return t.episodeId}const title=String(t.title||"").trim();if(title){q=analyticsClient.from("podcast_episodes").select("id").eq("title",title).limit(2);if(t.podcastId)q=q.eq("podcast_id",t.podcastId);r=await q; if(!r.error&&r.data?.length===1){t.episodeId=r.data[0].id;queue[index]=t;save();return t.episodeId}}}catch(e){console.debug("[CrowRules] episode lookup failed",e?.message||e)}return null}
async function startListenEvent(){const t=queue[index]||{};if(!analyticsClient||listenEventBusy)return;listenEventBusy=true;try{const episodeId=await resolveEpisodeId(t);if(episodeId&&!t.episodeId)t.episodeId=episodeId;const {data:{session}}=await analyticsClient.auth.getSession();const trackKey=String(t.url||"");const canResume=!!state.listenSessionKey&&state.listenEpisodeUrl===trackKey&&Date.now()-Number(state.listenSessionAt||0)<7200000;activeListenSessionKey=canResume?state.listenSessionKey:((window.crypto&&crypto.randomUUID)?crypto.randomUUID():"cr-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2)+"-"+Math.random().toString(36).slice(2));if(!canResume)listenAccumulatedSeconds=0;else listenAccumulatedSeconds=Math.max(listenAccumulatedSeconds,Number(state.listenAccumulatedSeconds)||0);state.listenSessionKey=activeListenSessionKey;state.listenEpisodeUrl=trackKey;state.listenSessionAt=Date.now();lastListenFlush=Date.now();save();const eventRow={session_key:activeListenSessionKey,episode_id:episodeId||null,podcast_id:t.podcastId||null,episode_title:String(t.title||"Untitled audio").slice(0,300),audio_url:trackKey.slice(0,2000),user_id:session?.user?.id||null,event_type:"play"};const {error:insertError}=await analyticsClient.from("podcast_play_events").insert(eventRow);const alreadyRecorded=insertError?.code==="23505";if(insertError&&!alreadyRecorded)console.warn("[CrowRules] play event could not be saved to Supabase:",insertError.message);if(!insertError||alreadyRecorded){window.dispatchEvent(new CustomEvent("crowrules:play-recorded",{detail:{episodeId:episodeId||null,podcastId:t.podcastId||null,title:eventRow.episode_title,sessionKey:activeListenSessionKey,duplicate:alreadyRecorded}}));if(episodeId)refreshEpisodePlayCount()}if(episodeId){const {error}=await analyticsClient.rpc("record_podcast_listen_session",{p_episode_id:episodeId,p_session_key:activeListenSessionKey,p_seconds_listened:listenAccumulatedSeconds,p_completed:false});if(error)console.debug("[CrowRules] detailed listening session unavailable:",error.message)}else console.debug("[CrowRules] play counted as an event; no matching podcast_episodes row was found",t.title||"");if(audio.ended)await flushListenDuration(true,true);else if(audio.paused)await flushListenDuration(true,false)}catch(e){console.warn("[CrowRules] listening event failed",e?.message||e)}finally{listenEventBusy=false}}
async function flushListenDuration(final=false,closeSession=final){if(!analyticsClient||!activeListenSessionKey)return;const now=Date.now();if(!final&&now-lastListenFlush<15000)return;const elapsed=Math.max(0,Math.min(120,Math.floor((now-lastListenFlush)/1000)));if(!audio.paused||final)listenAccumulatedSeconds+=elapsed;lastListenFlush=now;state.listenAccumulatedSeconds=listenAccumulatedSeconds;state.listenSessionAt=now;const t=queue[index]||{};try{if(t.episodeId){const {error}=await analyticsClient.rpc("record_podcast_listen_session",{p_episode_id:t.episodeId,p_session_key:activeListenSessionKey,p_seconds_listened:listenAccumulatedSeconds,p_completed:!!audio.ended});if(error)console.debug("[CrowRules] listening duration could not be saved",error.message)}if(closeSession){activeListenSessionKey=null;listenAccumulatedSeconds=0;lastListenFlush=0;state.listenSessionKey=null;state.listenEpisodeUrl=null;state.listenSessionAt=0;state.listenAccumulatedSeconds=0}save()}catch(e){console.debug("[CrowRules] listening duration update failed",e?.message||e);if(closeSession){activeListenSessionKey=null;listenAccumulatedSeconds=0;lastListenFlush=0;state.listenSessionKey=null;state.listenEpisodeUrl=null;state.listenSessionAt=0;state.listenAccumulatedSeconds=0}save()}}
const KEY="crowrules.globalAudio.v1",esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let state={},queue=[],index=0;try{state=JSON.parse(localStorage.getItem(KEY)||"{}");queue=Array.isArray(state.queue)?state.queue:[];index=Math.max(0,Number(state.index)||0)}catch(_){}
const css=[
'#cr-global-audio{position:fixed;z-index:99999;left:50%;bottom:12px;transform:translateX(-50%);width:min(960px,calc(100vw - 20px));color:#f6f8ff;font:500 12px Montserrat,Arial,sans-serif;display:none}',
'#cr-global-audio *{box-sizing:border-box}#cr-global-audio .panel{background:rgba(5,8,17,.97);border:1px solid rgba(103,232,249,.35);border-radius:16px;box-shadow:0 18px 70px #000b;backdrop-filter:blur(20px);overflow:hidden}',
'#cr-global-audio .top{display:flex;align-items:center;gap:10px;padding:10px 12px}#cr-global-audio .art{width:42px;height:42px;flex:0 0 42px;border-radius:9px;object-fit:cover;background:linear-gradient(135deg,#123044,#34214d);color:#67e8f9;display:grid;place-items:center;font-weight:900}',
'#cr-global-audio .meta{min-width:0;flex:1}#cr-global-audio .title{font:700 11px Orbitron,Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#67e8f9}#cr-global-audio .artist{font-size:10px;color:#9aa8bd;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'#cr-global-audio button,#cr-global-audio select{border:1px solid #29374d;border-radius:9px;background:#0c1422;color:#f6f8ff;padding:8px 10px;font:700 10px Montserrat,Arial,sans-serif;cursor:pointer}#cr-global-audio button:hover{border-color:#67e8f9}#cr-global-audio button:focus-visible,#cr-global-audio input:focus-visible{outline:2px solid #67e8f9;outline-offset:2px}',
'#cr-global-audio .controls,#cr-global-audio .tools{display:flex;align-items:center;gap:6px}#cr-global-audio .play{border-color:#67e8f9;background:linear-gradient(135deg,#123646,#30234c);min-width:42px;font-size:14px}',
'#cr-global-audio .progress{display:flex;align-items:center;gap:8px;padding:0 14px 10px;font-size:9px;color:#9aa8bd}#cr-global-audio input[type=range]{accent-color:#67e8f9;min-width:0;cursor:pointer}#cr-global-audio .seek{flex:1;width:100%}#cr-global-audio .volume{width:70px}',
'#cr-global-audio .queue{display:none;border-top:1px solid #263248;max-height:180px;overflow:auto;padding:7px}#cr-global-audio .queue.open{display:block}#cr-global-audio .track{display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin:3px 0}#cr-global-audio .track.active{border-color:#67e8f9;color:#67e8f9}',
'#cr-global-audio .launcher{position:fixed;right:16px;bottom:14px;border:1px solid #67e8f9;border-radius:999px;background:linear-gradient(135deg,#071925,#211738);color:#fff;padding:12px 16px;box-shadow:0 8px 34px #0009;font:800 10px Orbitron,Arial,sans-serif;cursor:pointer}',
'@media(max-width:620px){#cr-global-audio{bottom:6px;width:calc(100vw - 12px)}#cr-global-audio .top{gap:6px;padding:8px}#cr-global-audio .art{width:34px;height:34px;flex-basis:34px}#cr-global-audio button{padding:7px}#cr-global-audio .volume,#cr-global-audio .speed{display:none}}'
].join('\n');
const style=document.createElement("style");style.id="cr-global-audio-style";style.textContent=css;document.head.appendChild(style);
const host=document.createElement("div");host.id="cr-global-audio";host.innerHTML='<div class="panel"><div class="top"><img class="art" id="cr-ga-art" alt="" hidden><div class="art" id="cr-ga-fallback">CR</div><div class="meta"><div class="title" id="cr-ga-title">CrowRules Global Audio</div><div class="artist" id="cr-ga-artist">Choose an episode to start listening</div><div class="artist" id="cr-ga-plays">Episode plays: —</div></div><div class="controls"><button type="button" id="cr-ga-prev" aria-label="Previous track">⏮</button><button type="button" class="play" id="cr-ga-play" aria-label="Play">▶</button><button type="button" id="cr-ga-next" aria-label="Next track">⏭</button></div><div class="tools"><select class="speed" id="cr-ga-speed" aria-label="Playback speed"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="1.75">1.75×</option><option value="2">2×</option></select><button type="button" id="cr-ga-queue" aria-expanded="false">QUEUE</button><button type="button" id="cr-ga-hide" aria-label="Minimize player">—</button></div></div><div class="progress"><span id="cr-ga-current">0:00</span><input class="seek" id="cr-ga-seek" type="range" min="0" max="1000" value="0" aria-label="Seek audio"><span id="cr-ga-duration">0:00</span><input class="volume" id="cr-ga-volume" type="range" min="0" max="1" value=".85" step=".01" aria-label="Volume"></div><div class="queue" id="cr-ga-list"></div></div><button type="button" class="launcher" id="cr-ga-open">♫ CROWRULES AUDIO</button>';
document.body.appendChild(host);
const $=s=>host.querySelector(s),audio=document.createElement("audio");audio.preload="metadata";audio.setAttribute("aria-label","CrowRules global audio playback");audio.style.display="none";host.appendChild(audio);
function fmt(n){if(!Number.isFinite(n)||n<0)return"0:00";n=Math.floor(n);return Math.floor(n/60)+":"+String(n%60).padStart(2,"0")}
function save(){try{state.url=audio.currentSrc||audio.src||state.url;state.time=audio.currentTime||state.time;state.volume=audio.volume;state.rate=audio.playbackRate;state.wasPlaying=!audio.paused;state.queue=queue;state.index=index;localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}}
function show(){host.style.display="block";$(".panel").style.display="block";$(".launcher").style.display="none";state.expanded=true;save()}
function minimize(){host.style.display="block";$(".panel").style.display="none";$(".launcher").style.display="block";state.expanded=false;save()}
async function refreshEpisodePlayCount(){const t=queue[index]||{},el=$("#cr-ga-plays");if(!el)return;if(!analyticsClient){el.textContent="Episode plays: — · Show plays: —";return}const fmt=n=>Number(n||0).toLocaleString();let episodePlays=null,showPlays=null;try{if(t.episodeId){const r=await analyticsClient.from("podcast_episodes").select("play_count,podcast_id").eq("id",t.episodeId).maybeSingle();if(r.error)throw r.error;if(r.data){episodePlays=Number(r.data.play_count||0);if(!t.podcastId)t.podcastId=r.data.podcast_id||null;}}if(t.podcastId){const r=await analyticsClient.from("podcasts").select("total_plays").eq("id",t.podcastId).maybeSingle();if(r.error)throw r.error;if(r.data)showPlays=Number(r.data.total_plays||0)}el.textContent="Episode plays: "+(episodePlays===null?"—":fmt(episodePlays))+" · Show plays: "+(showPlays===null?"—":fmt(showPlays))}catch(e){el.textContent="Play counts temporarily unavailable";console.debug("[CrowRules] play counts unavailable",e?.message||e)}}
function render(){const t=queue[index]||{};$("#cr-ga-title").textContent=t.title||state.title||"CrowRules Global Audio";$("#cr-ga-artist").textContent=t.artist||state.artist||"CrowRules Podcasting";if(t.artwork||state.artwork){$("#cr-ga-art").src=t.artwork||state.artwork;$("#cr-ga-art").hidden=false;$("#cr-ga-fallback").style.display="none"}else{$("#cr-ga-art").hidden=true;$("#cr-ga-fallback").style.display="grid"}$("#cr-ga-play").textContent=audio.paused?"▶":"❚❚";$("#cr-ga-play").setAttribute("aria-label",audio.paused?"Play":"Pause");$("#cr-ga-current").textContent=fmt(audio.currentTime);$("#cr-ga-duration").textContent=fmt(audio.duration);$("#cr-ga-seek").value=Number.isFinite(audio.duration)&&audio.duration>0?Math.round(audio.currentTime/audio.duration*1000):0;$("#cr-ga-volume").value=audio.volume;$("#cr-ga-speed").value=String(audio.playbackRate);$("#cr-ga-list").innerHTML=queue.length?queue.map((x,i)=>'<button type="button" class="track '+(i===index?"active":"")+'" data-track="'+i+'">'+(i===index?"♫":"▶")+' '+esc(x.title||"Untitled episode")+' <span style="margin-left:auto;color:#9aa8bd">'+esc(x.artist||"")+'</span></button>').join(""):'<div class="artist" style="padding:10px">Your queue is empty. Choose an episode on CrowRules Podcasting.</div>';try{if("mediaSession"in navigator&&"MediaMetadata"in window){navigator.mediaSession.metadata=new MediaMetadata({title:t.title||state.title||"CrowRules Podcasting",artist:t.artist||state.artist||"CrowRules Podcasting",album:"CrowRules Podcasting",artwork:t.artwork?[{src:t.artwork,sizes:"512x512",type:"image/png"}]:[]});navigator.mediaSession.playbackState=audio.paused?"paused":"playing"}}catch(_){}}
async function resolvePlayableUrl(raw){const value=String(raw||"");if(!value.startsWith("storage://"))return value;if(!analyticsClient)throw new Error("Supabase client is unavailable for private media");const spec=value.slice(10),slash=spec.indexOf("/");if(slash<1||slash===spec.length-1)throw new Error("Invalid storage media reference");const bucket=spec.slice(0,slash),path=spec.slice(slash+1);const {data,error}=await analyticsClient.storage.from(bucket).createSignedUrl(path,3600);if(error||!data?.signedUrl)throw error||new Error("Could not create signed media URL");return data.signedUrl}async function loadTrack(i,autoplay=true){if(!queue.length)return;await flushListenDuration(true);index=(i+queue.length)%queue.length;const t=queue[index];refreshEpisodePlayCount();if(!t||!t.url)return;state.url=t.url;state.title=t.title||"CrowRules Podcasting";state.artist=t.artist||"CrowRules Podcasting";state.artwork=t.artwork||"";show();let playable;try{playable=await resolvePlayableUrl(t.url)}catch(e){$("#cr-ga-artist").textContent="Unable to access audio: "+(e?.message||"media URL unavailable");render();return}if(audio.src!==playable){audio.src=playable;audio.load()}render();if(autoplay){try{await audio.play();state.wasPlaying=true;render()}catch(_){state.wasPlaying=false;$("#cr-ga-artist").textContent=(t.artist||"CrowRules Podcasting")+" · Tap Play to start";render()}}save()}
async function play(item,opts={}){if(!item||!item.url)return false;await flushListenDuration(true);const entry={url:String(item.url),title:item.title||"CrowRules episode",artist:item.artist||"CrowRules Podcasting",artwork:item.artwork||"",episodeId:item.episodeId||null,podcastId:item.podcastId||null};if(opts.queue){if(!queue.some(x=>x.url===entry.url))queue.push(entry);index=queue.findIndex(x=>x.url===entry.url)}else{queue=[entry];index=0}refreshEpisodePlayCount();state.time=0;state.url=entry.url;state.title=entry.title;state.artist=entry.artist;state.artwork=entry.artwork;await loadTrack(index,opts.autoplay!==false);return true}
async function toggle(){if(!audio.src){if(queue.length)return loadTrack(index,true);return}if(audio.paused){try{await audio.play()}catch(_){$("#cr-ga-artist").textContent="Playback blocked — tap Play again"}}else audio.pause();render();save()}
$("#cr-ga-play").addEventListener("click",toggle);$("#cr-ga-prev").addEventListener("click",()=>loadTrack(index-1,true));$("#cr-ga-next").addEventListener("click",()=>loadTrack(index+1,true));$("#cr-ga-hide").addEventListener("click",minimize);$("#cr-ga-open").addEventListener("click",show);$("#cr-ga-queue").addEventListener("click",()=>{const q=$("#cr-ga-list"),open=!q.classList.contains("open");q.classList.toggle("open",open);$("#cr-ga-queue").setAttribute("aria-expanded",String(open))});$("#cr-ga-list").addEventListener("click",e=>{const b=e.target.closest("[data-track]");if(b)loadTrack(Number(b.dataset.track),true)});$("#cr-ga-seek").addEventListener("input",()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=Number($("#cr-ga-seek").value)/1000*audio.duration});$("#cr-ga-volume").addEventListener("input",()=>{audio.volume=Number($("#cr-ga-volume").value);save()});$("#cr-ga-speed").addEventListener("change",()=>{audio.playbackRate=Number($("#cr-ga-speed").value)||1;save()});
audio.addEventListener("play",()=>{if(!activeListenSessionKey)startListenEvent()});audio.addEventListener("timeupdate",()=>{flushListenDuration(false)});audio.addEventListener("pause",()=>{if(!audio.ended)flushListenDuration(true,false)});["play","pause","timeupdate","durationchange","loadedmetadata","volumechange","ratechange","ended","error"].forEach(ev=>audio.addEventListener(ev,()=>{render();save()}));audio.addEventListener("ended",async()=>{await flushListenDuration(true,true);if(index<queue.length-1)loadTrack(index+1,true)});audio.addEventListener("error",()=>{$("#cr-ga-artist").textContent="Unable to load audio. Check the episode media URL.";render()});
if("mediaSession"in navigator){try{navigator.mediaSession.setActionHandler("play",()=>audio.play());navigator.mediaSession.setActionHandler("pause",()=>audio.pause());navigator.mediaSession.setActionHandler("previoustrack",()=>loadTrack(index-1,true));navigator.mediaSession.setActionHandler("nexttrack",()=>loadTrack(index+1,true));navigator.mediaSession.setActionHandler("seekbackward",d=>audio.currentTime=Math.max(0,audio.currentTime-(d.seekOffset||10)));navigator.mediaSession.setActionHandler("seekforward",d=>audio.currentTime=Math.min(audio.duration||Infinity,audio.currentTime+(d.seekOffset||10)))}catch(_){}}
window.CrowRulesAudioPlayer={play,async playQueue(items,start=0){await flushListenDuration(true);queue=(items||[]).filter(x=>x&&x.url);index=Math.max(0,Math.min(start,queue.length-1));return loadTrack(index,true)},add(item){if(item&&item.url&&!queue.some(x=>x.url===item.url))queue.push(item);render();save()},toggle,show,minimize,getState(){return{queue,index,paused:audio.paused,currentTime:audio.currentTime,src:audio.currentSrc}}};
document.addEventListener("click",e=>{const b=e.target.closest("[data-global-audio-url]");if(!b)return;e.preventDefault();play({url:b.dataset.globalAudioUrl,title:b.dataset.globalAudioTitle||b.textContent.trim(),artist:b.dataset.globalAudioArtist,artwork:b.dataset.globalAudioArtwork},{queue:b.dataset.globalAudioQueue==="true"})});
try{if(state.url){if(!queue.length)queue=[{url:state.url,title:state.title,artist:state.artist,artwork:state.artwork}];index=Math.max(0,Math.min(index,queue.length-1));const t=queue[index],shouldResume=!!state.wasPlaying,restoreTime=Number(state.time)||0;audio.src=t.url;audio.volume=Number(state.volume??.85);audio.playbackRate=Number(state.rate)||1;state.expanded?show():minimize();render();refreshEpisodePlayCount();audio.addEventListener("loadedmetadata",()=>{if(restoreTime>0)try{audio.currentTime=restoreTime}catch(_){}if(shouldResume)audio.play().catch(()=>{$("#cr-ga-artist").textContent="Playback paused after page change · Tap Play to resume";state.wasPlaying=false;save()})},{once:true})}else minimize()}catch(e){console.warn("[CrowRules global audio] restore skipped",e)}

/* Keep the actual audio element alive while navigating between same-origin pages.
   A normal document navigation destroys it, so eligible links use a lightweight
   body swap while this player and its playback state remain mounted. */
let crNavigationBusy=false;
function crInternalPageLink(a){
  if(!a||a.hasAttribute("download")||a.target&&a.target!=="_self"||a.getAttribute("rel")==="external")return false;
  const raw=a.getAttribute("href")||"";
  if(!raw||raw.startsWith("#")||/^(mailto:|tel:|javascript:|data:|blob:)/i.test(raw))return false;
  let u;try{u=new URL(raw,location.href)}catch(_){return false}
  if(u.origin!==location.origin||u.pathname===location.pathname&&u.search===location.search&&u.hash)return false;
  if(!/\.html?$/i.test(u.pathname))return false;
  return true;
}
async function crLoadPage(url,{push=true,scroll=true}={}){
  if(crNavigationBusy)return;
  const target=new URL(url,location.href);
  if(target.origin!==location.origin)return;
  crNavigationBusy=true;
  document.documentElement.setAttribute("data-cr-navigating","true");
  try{
    save();
    const response=await fetch(target.href,{credentials:"same-origin",headers:{"X-CrowRules-Navigation":"1"}});
    if(!response.ok)throw new Error("Page request failed: "+response.status);
    const html=await response.text();
    const next=new DOMParser().parseFromString(html,"text/html");
    if(!next.body||!next.title)throw new Error("Page response was not a complete HTML document");
    // Set the URL before inserting markup so relative images, links, and assets resolve against the destination page.
    if(push)history.pushState({crNavigation:true},"",target.href);
    else if(location.href!==target.href)history.replaceState({crNavigation:true},"",target.href);
    const keepHost=host;
    const currentPlayerStyle=document.getElementById("cr-global-audio-style");
    document.title=next.title;
    const nextDescription=next.querySelector('meta[name="description"]');
    let currentDescription=document.querySelector('meta[name="description"]');
    if(nextDescription){if(!currentDescription){currentDescription=document.createElement("meta");currentDescription.name="description";document.head.appendChild(currentDescription)}currentDescription.content=nextDescription.content}
    for(const name of ["theme-color","robots"]){
      const incoming=next.querySelector('meta[name="'+name+'"]');
      let existing=document.querySelector('meta[name="'+name+'"]');
      if(incoming){if(!existing){existing=document.createElement("meta");existing.name=name;document.head.appendChild(existing)}existing.content=incoming.content}
    }
    const canonical=next.querySelector('link[rel="canonical"]');
    let currentCanonical=document.querySelector('link[rel="canonical"]');
    if(canonical){if(!currentCanonical){currentCanonical=document.createElement("link");currentCanonical.rel="canonical";document.head.appendChild(currentCanonical)}currentCanonical.href=new URL(canonical.getAttribute("href"),target.href).href}
    document.querySelectorAll('link[rel="stylesheet"]').forEach(el=>el.remove());
    next.querySelectorAll('link[rel="stylesheet"]').forEach(el=>{
      const link=document.createElement("link");
      for(const attr of el.attributes)link.setAttribute(attr.name,attr.value);
      if(link.href)link.href=new URL(el.getAttribute("href"),target.href).href;
      document.head.appendChild(link);
    });
    document.querySelectorAll("head style:not(#cr-global-audio-style)").forEach(el=>el.remove());
    next.querySelectorAll("head style").forEach(el=>{const st=document.createElement("style");for(const attr of el.attributes)st.setAttribute(attr.name,attr.value);st.textContent=el.textContent;document.head.appendChild(st)});
    // Replace page markup, but never remove the host or its live HTMLAudioElement.
    Array.from(document.body.children).forEach(el=>{if(el!==keepHost)el.remove()});
    const scripts=[];
    for(const child of Array.from(next.body.childNodes)){
      if(child.nodeType===1&&child.tagName==="SCRIPT"){
        scripts.push(child.cloneNode(true));
      }else{
        document.body.appendChild(document.importNode(child,true));
      }
    }
    document.body.appendChild(keepHost);
    for(const source of scripts){
      const src=source.getAttribute("src")||"";
      if(/(?:^|\/)global-audio-player\.js(?:\?|$)/i.test(src))continue;
      if(/(?:^|\/)(?:crowpoints|online-presence|live-visitors)\.js(?:\?|$)/i.test(src))continue;
      const script=document.createElement("script");
      for(const attr of source.attributes){
        if(attr.name==="src")script.src=new URL(source.getAttribute("src"),target.href).href;
        else script.setAttribute(attr.name,attr.value);
      }
      if(!source.src)script.textContent=source.textContent;
      await new Promise((resolve,reject)=>{
        if(script.src){script.onload=resolve;script.onerror=()=>reject(new Error("Could not load page script: "+script.src))}
        document.body.appendChild(script);
        if(!script.src)resolve();
      });
    }
    document.dispatchEvent(new CustomEvent("crowrules:navigated",{detail:{url:target.href}}));
    if(scroll){const y=target.hash?document.getElementById(decodeURIComponent(target.hash.slice(1)))?.getBoundingClientRect().top+window.scrollY:0;window.scrollTo(0,Number.isFinite(y)?y:0)}
    render();save();
  }catch(error){
    console.warn("[CrowRules navigation] Keeping normal page navigation as fallback:",error?.message||error);
    if(push)location.href=target.href;
    else location.reload();
  }finally{
    crNavigationBusy=false;
    document.documentElement.removeAttribute("data-cr-navigating");
  }
}
document.addEventListener("click",event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const a=event.target.closest("a");
  if(!crInternalPageLink(a))return;
  event.preventDefault();
  crLoadPage(a.href,{push:true,scroll:true});
});
window.addEventListener("popstate",()=>crLoadPage(location.href,{push:false,scroll:true}));

let lastLifecycleFlush=0;
async function flushForLifecycle(){
  const now=Date.now();
  if(now-lastLifecycleFlush<1000){save();return}
  lastLifecycleFlush=now;
  try{if(activeListenSessionKey&&!audio.paused)await flushListenDuration(true,false)}catch(e){console.debug("[CrowRules] lifecycle listen flush deferred",e?.message||e)}
  save();
}
window.addEventListener("pagehide",()=>{flushForLifecycle()});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushForLifecycle()});
})();