/* CrowRules Podcasting V21 universal navigation + autoplay-safe audio player */
(()=>{"use strict";
const A="https://cevylpnoexugwgygvtgu.supabase.co/storage/v1/object/public/podcast-audio/Tacoma%20Nights.mp3";
const page=location.pathname.split("/").pop()||"index.html";
const nav=[["Home","home.html"],["Discover","discover.html"],["Podcasts","podcasts.html"],["Episodes","episodes.html"],["Library","library.html"],["Search","search.html"]];
const creators=[["Creator Center","creator-center.html"],["Dashboard","creator-dashboard.html"],["Create Podcast","create-podcast.html"],["Create Episode","create-episode.html"],["Plans","creator-plans.html"]];
const community=[["Notifications","notifications.html"],["Live Chat","live-chat.html"],["Presence","presence.html"],["Membership","membership.html"]];
const esc=s=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const dropdown=(label,items,key)=>'<div class="cr-nav-drop" data-dropdown="'+key+'"><button type="button" class="cr-nav-drop-toggle" aria-expanded="false">'+esc(label)+' <span aria-hidden="true">▾</span></button><div class="cr-nav-menu" role="menu">'+items.map(x=>'<a role="menuitem" href="'+esc(x[1])+'">'+esc(x[0])+'</a>').join("")+"</div></div>";
function shell(){
 if(document.querySelector(".cr-universal-nav"))return;
 const n=document.createElement("nav");n.className="cr-universal-nav";
 n.innerHTML='<div class="cr-nav-inner"><a class="cr-brand" href="home.html">◉ CrowRules Podcasting</a><button class="cr-nav-mobile-toggle" type="button" aria-expanded="false" aria-label="Open navigation">☰</button><div class="cr-nav-links">'+nav.map(x=>'<a class="cr-nav-link '+(page===x[1]?"active":"")+'" href="'+x[1]+'">'+esc(x[0])+"</a>").join("")+dropdown("Creators",creators,"creators")+dropdown("Community",community,"community")+"</div></div>";
 document.body.prepend(n);
 const mobile=n.querySelector(".cr-nav-mobile-toggle");mobile?.addEventListener("click",e=>{e.stopPropagation();const open=n.classList.toggle("mobile-open");mobile.setAttribute("aria-expanded",String(open));});
 n.querySelectorAll(".cr-nav-drop-toggle").forEach(btn=>btn.addEventListener("click",e=>{
   e.stopPropagation();const box=btn.parentElement;const open=box.classList.contains("open");
   n.querySelectorAll(".cr-nav-drop.open").forEach(x=>{x.classList.remove("open");x.querySelector("button")?.setAttribute("aria-expanded","false")});
   if(!open){box.classList.add("open");btn.setAttribute("aria-expanded","true")}
 }));
 document.addEventListener("click",()=>n.querySelectorAll(".cr-nav-drop.open").forEach(x=>{x.classList.remove("open");x.querySelector("button")?.setAttribute("aria-expanded","false")}),{once:false});
 n.addEventListener("keydown",e=>{if(e.key==="Escape"){n.classList.remove("mobile-open");mobile?.setAttribute("aria-expanded","false");n.querySelectorAll(".cr-nav-drop.open").forEach(x=>x.classList.remove("open"))}});
}
function player(){
 if(document.querySelector(".cr-universal-player"))return;
 const p=document.createElement("section");p.className="cr-universal-player";
 p.innerHTML='<div class="cr-player-inner"><div class="cr-track"><div class="cr-track-title">Tacoma Nights</div><div class="cr-track-meta">CrowRules Podcasting • Universal Player</div></div><div class="cr-controls"><div class="cr-control-row"><button class="cr-player-btn" data-a="b" aria-label="Back 15 seconds">↶</button><button class="cr-player-btn primary" data-a="p" aria-label="Play or pause">▶</button><button class="cr-player-btn" data-a="f" aria-label="Forward 30 seconds">↷</button><button class="cr-player-btn" data-a="m" aria-label="Mute">🔊</button></div><input class="cr-progress" data-e="r" type="range" min="0" max="100" value="0" step=".1" aria-label="Playback progress"><div class="cr-time"><span data-e="c">0:00</span><span data-e="d">0:00</span></div></div><div class="cr-volume">Volume <input data-e="v" type="range" min="0" max="1" step=".01" value=".8" aria-label="Volume"><div class="cr-player-status" data-e="s">Starting…</div></div><audio data-e="a" preload="metadata" autoplay loop playsinline></audio></div>';
 document.body.appendChild(p);
 const a=p.querySelector('[data-e="a"]'),b=p.querySelector('[data-a="p"]'),r=p.querySelector('[data-e="r"]'),v=p.querySelector('[data-e="v"]'),s=p.querySelector('[data-e="s"]'),ct=p.querySelector('[data-e="c"]'),dt=p.querySelector('[data-e="d"]');
 a.autoplay=true;a.muted=localStorage.getItem("crMuted")==="1";a.volume=+(localStorage.getItem("crVolume")||.8);v.value=a.volume;a.src=localStorage.getItem("crAudioSrc")||A;
 const fmt=x=>Number.isFinite(x)?Math.floor(x/60)+":"+String(Math.floor(x%60)).padStart(2,"0"):"0:00";
 const sync=()=>{ct.textContent=fmt(a.currentTime);dt.textContent=fmt(a.duration);r.value=a.duration?a.currentTime/a.duration*100:0;b.textContent=a.paused?"▶":"❚❚"};
 const play=()=>a.play().then(()=>{s.textContent="Playing • Loop on"}).catch(()=>{s.textContent="Autoplay blocked — press ▶";});
document.addEventListener("play",e=>{if(e.target instanceof HTMLMediaElement && e.target!==a && e.target.tagName==="AUDIO")e.target.pause()},true);
 a.addEventListener("loadedmetadata",()=>{const t=+localStorage.getItem("crAudioTime");if(t&&t<a.duration)a.currentTime=t;sync();play()},{once:true});
 a.addEventListener("play",()=>{s.textContent="Playing • Loop on";sync()});
 a.addEventListener("pause",()=>{s.textContent="Paused • Silent";sync();});
 a.addEventListener("ended",()=>{if(!a.loop)s.textContent="Ended"});
 a.addEventListener("timeupdate",()=>{sync();if(Math.floor(a.currentTime)%5===0)localStorage.setItem("crAudioTime",a.currentTime)});
 a.addEventListener("error",()=>{s.textContent="Audio unavailable";sync()});
 b.onclick=()=>a.paused?play():a.pause();
 p.querySelector('[data-a="b"]').onclick=()=>{a.currentTime=Math.max(0,a.currentTime-15)};
 p.querySelector('[data-a="f"]').onclick=()=>{a.currentTime=Math.min(a.duration||1e99,a.currentTime+30)};
 p.querySelector('[data-a="m"]').onclick=()=>{a.muted=!a.muted;localStorage.setItem("crMuted",a.muted?"1":"0");sync();};
 r.oninput=()=>{if(a.duration)a.currentTime=r.value/100*a.duration};
 v.oninput=()=>{a.volume=+v.value;localStorage.setItem("crVolume",a.volume)};
 window.CROW_DEFAULT_AUDIO_URL=A;window.CROW_UNIVERSAL_AUDIO=a;window.CROW_PLAY_AUDIO=play;
}
function boot(){document.body.classList.add("cr-shell-ready");shell();player();if(!document.querySelector(".cr-player-spacer")){const x=document.createElement("div");x.className="cr-player-spacer";document.body.appendChild(x)}}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot):boot();
})();