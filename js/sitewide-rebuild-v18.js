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
 p.innerHTML='<div class="cr-player-inner"><div class="cr-track"><div class="cr-art" data-e="art">🎙️</div><div class="cr-track-info"><div class="cr-track-title" data-e="title">Tacoma Nights</div><div class="cr-track-meta" data-e="meta">CrowRules Podcasting • Universal Player</div></div></div><div class="cr-controls"><div class="cr-control-row"><button class="cr-player-btn" data-a="b" aria-label="Back 15 seconds">↶</button><button class="cr-player-btn primary" data-a="p" aria-label="Play or pause">▶</button><button class="cr-player-btn" data-a="f" aria-label="Forward 30 seconds">↷</button><button class="cr-player-btn" data-a="q" aria-label="Show queue">☷</button><button class="cr-player-btn" data-a="m" aria-label="Mute">🔊</button></div><input class="cr-progress" data-e="r" type="range" min="0" max="100" value="0" step=".1" aria-label="Playback progress"><div class="cr-time"><span data-e="c">0:00</span><span data-e="d">0:00</span></div></div><div class="cr-volume">Volume <input data-e="v" type="range" min="0" max="1" step=".01" value=".8" aria-label="Volume"><div class="cr-player-status" data-e="s">Starting…</div><div class="cr-queue" data-e="queue" hidden></div></div></div><audio data-e="a" preload="metadata" autoplay loop playsinline></audio></div>';
 document.body.appendChild(p);
 const a=p.querySelector('[data-e="a"]'),b=p.querySelector('[data-a="p"]'),r=p.querySelector('[data-e="r"]'),v=p.querySelector('[data-e="v"]'),s=p.querySelector('[data-e="s"]'),ct=p.querySelector('[data-e="c"]'),dt=p.querySelector('[data-e="d"]'),title=p.querySelector('[data-e="title"]'),meta=p.querySelector('[data-e="meta"]'),art=p.querySelector('[data-e="art"]'),queueBox=p.querySelector('[data-e="queue"]');
 const saved=JSON.parse(localStorage.getItem("crPlayerState")||"{}"), queue=JSON.parse(localStorage.getItem("crAudioQueue")||"[]");
 const current=saved.url||localStorage.getItem("crAudioSrc")||A;
 const track={url:current,title:saved.title||"Tacoma Nights",meta:saved.meta||"CrowRules Podcasting • Universal Player",artwork:saved.artwork||""};
 a.autoplay=true;a.muted=localStorage.getItem("crMuted")==="1";a.volume=+(localStorage.getItem("crVolume")||.8);v.value=a.volume;a.src=current;
 const render=()=>{title.textContent=track.title;meta.textContent=track.meta;art.innerHTML=track.artwork?'<img src="'+track.artwork.replace(/"/g,"&quot;")+'" alt="">':'🎙️';};
 const save=()=>localStorage.setItem("crPlayerState",JSON.stringify({...track,time:a.currentTime||0,paused:a.paused}));
 const fmt=x=>Number.isFinite(x)?Math.floor(x/60)+":"+String(Math.floor(x%60)).padStart(2,"0"):"0:00";
 const sync=()=>{ct.textContent=fmt(a.currentTime);dt.textContent=fmt(a.duration);r.value=a.duration?a.currentTime/a.duration*100:0;b.textContent=a.paused?"▶":"❚❚";save()};
 const play=()=>a.play().then(()=>{s.textContent=a.muted?"Playing • Muted":"Playing • Loop on";save()}).catch(()=>{
   if(!a.muted){
     a.muted=true;
     localStorage.setItem("crMuted","1");
     a.play().then(()=>{s.textContent="Playing • Muted — click 🔊 for sound";save()}).catch(()=>{s.textContent="Ready • press ▶";save()});
   }else{s.textContent="Ready • press ▶";save()}
 });
 const unlock=()=>{if(a.paused){play();return}if(a.muted&&localStorage.getItem("crMuted")!=="1"){a.muted=false;localStorage.setItem("crMuted","0");a.play().then(()=>{s.textContent="Playing • Loop on";save()}).catch(()=>{})}};
 ["pointerdown","keydown","touchstart"].forEach(ev=>document.addEventListener(ev,unlock,{once:true,passive:true}));
 const renderQueue=()=>{queueBox.innerHTML=queue.length?'<strong>Up Next</strong>'+queue.map((x,i)=>'<button type="button" data-q="'+i+'">'+String(x.title||"Untitled").replace(/[<>]/g,"")+'</button>').join(""):"<strong>Up Next</strong><div>Queue empty</div>";queueBox.querySelectorAll("[data-q]").forEach(btn=>btn.onclick=()=>loadTrack(queue[+btn.dataset.q],true));};
 const loadTrack=x=>{if(!x||!x.url)return;Object.assign(track,{url:x.url,title:x.title||"Untitled",meta:x.meta||"CrowRules Podcasting",artwork:x.artwork||""});a.src=track.url;a.currentTime=0;render();save();play();};
 a.addEventListener("loadedmetadata",()=>{const t=saved.url===track.url?+saved.time:0;if(t&&t<a.duration)a.currentTime=t;render();sync();if(saved.paused){s.textContent="Ready • press ▶ to resume"}else play()},{once:true});
 a.addEventListener("play",()=>{s.textContent=a.muted?"Playing • Muted":"Playing • Loop on";sync()});
 a.addEventListener("pause",()=>{s.textContent="Paused • Silent";save();sync()});
 a.addEventListener("timeupdate",()=>{sync()});
 a.addEventListener("error",()=>{s.textContent="Audio unavailable";save()});
 document.addEventListener("play",e=>{if(e.target instanceof HTMLMediaElement&&e.target!==a&&e.target.tagName==="AUDIO")e.target.pause()},true);
 b.onclick=()=>a.paused?play():a.pause();
 p.querySelector('[data-a="b"]').onclick=()=>{a.currentTime=Math.max(0,a.currentTime-15);save()};
 p.querySelector('[data-a="f"]').onclick=()=>{a.currentTime=Math.min(a.duration||1e99,a.currentTime+30);save()};
 p.querySelector('[data-a="m"]').onclick=()=>{a.muted=!a.muted;localStorage.setItem("crMuted",a.muted?"1":"0");sync()};
 p.querySelector('[data-a="q"]').onclick=()=>{queueBox.hidden=!queueBox.hidden;renderQueue()};
 r.oninput=()=>{if(a.duration)a.currentTime=r.value/100*a.duration};
 v.oninput=()=>{a.volume=+v.value;localStorage.setItem("crVolume",a.volume)};
 window.CROW_DEFAULT_AUDIO_URL=A;window.CROW_UNIVERSAL_AUDIO=a;window.CROW_PLAY_AUDIO=play;
 window.CROW_PLAYER={load:loadTrack,queue,renderQueue,getState:()=>({...track,time:a.currentTime,paused:a.paused}),addToQueue:x=>{queue.push(x);localStorage.setItem("crAudioQueue",JSON.stringify(queue));renderQueue()}};
 render();renderQueue();
}
function boot(){document.body.classList.add("cr-shell-ready");shell();player();if(!document.querySelector(".cr-player-spacer")){const x=document.createElement("div");x.className="cr-player-spacer";document.body.appendChild(x)}}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot):boot();
})();