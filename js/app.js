(()=>{"use strict";
const page=(location.pathname.split("/").pop()||"index.html").toLowerCase();
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
const VERSION="20261004-30";

function installHalloweenTheme(){
  try{
    document.documentElement.dataset.crowSeason="halloween";
    document.body?.classList.add("cr-halloween-theme");
    if(!document.querySelector('link[data-crow-halloween-v2]')){
      const v2=document.createElement("link");
      v2.rel="stylesheet";
      v2.href=BASE+"css/halloween-cinematic-v2.css?v=20261004-02";
      v2.dataset.crowHalloweenV2="true";
      document.head.appendChild(v2);
    }
    if(!document.querySelector('link[data-crow-halloween]')){
      const link=document.createElement("link");
      link.rel="stylesheet";
      link.href=BASE+"css/halloween-cinematic-v1.css?v=20261004-01";
      link.dataset.crowHalloween="true";
      document.head.appendChild(link);
    }
    if(document.body&&!document.querySelector(".cr-halloween-bats")){
      const bats=document.createElement("div");
      bats.className="cr-halloween-bats";
      bats.setAttribute("aria-hidden","true");
      document.body.appendChild(bats);
    }
    if(page==="home.html") installHalloweenExperience();
  }catch(e){console.warn("CrowRules Halloween theme:",e)}
}

function installHalloweenExperience(){
  if(document.querySelector("[data-crow-haunted-experience]"))return;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const enteredKey="cr_halloween_entered", audioKey="cr_halloween_audio";
  const gate=document.createElement("div");
  gate.className="cr-haunted-gate"; gate.dataset.crowHauntedExperience="true";
  gate.innerHTML='<div class="cr-haunted-gate-panel" role="dialog" aria-modal="true" aria-labelledby="crHauntedTitle"><div class="cr-haunted-gate-moon" aria-hidden="true"></div><div class="cr-haunted-gate-kicker">CROWRULES PODCASTING • HALLOWEEN 2026</div><h1 id="crHauntedTitle">ENTER IF YOU DARE</h1><p class="cr-haunted-stage-text">The lights are low. The air is cold. The podcasts are waiting.</p><div class="cr-haunted-gate-actions"><button class="cr-haunted-enter" type="button">ENTER IF YOU DARE</button><button class="cr-haunted-silent" type="button">Continue silently</button></div><div class="cr-haunted-note">Sound is optional. Enter to experience the haunted atmosphere.</div></div>';
  ["cr-halloween-cemetery","cr-halloween-pumpkins","cr-halloween-ghosts","cr-halloween-lightning","cr-halloween-candle"].forEach(cls=>{const el=document.createElement("div");el.className=cls;el.setAttribute("aria-hidden","true");document.body.appendChild(el)});
  document.body.appendChild(gate);
  const sound=document.createElement("button"); sound.type="button"; sound.className="cr-haunted-audio"; sound.setAttribute("aria-pressed","false"); sound.textContent="🔇 Sound: Off"; sound.title="Toggle spooky ambience"; document.body.appendChild(sound);

  let audio=null,audioEnabled=false,lightningTimer=null;
  const makeAudio=()=>{
    if(audio)return audio; const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
    const ctx=new AC(),master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
    const drone=ctx.createOscillator(),lfo=ctx.createOscillator(),lg=ctx.createGain();
    drone.type="sine";drone.frequency.value=54;lfo.frequency.value=.07;lg.gain.value=9;lfo.connect(lg);lg.connect(drone.frequency);drone.connect(master);drone.start();lfo.start();
    audio={ctx,master};return audio;
  };
  const tone=(freq,dur,gain=.018,type="sine")=>{
    if(!audioEnabled||!audio)return; const ctx=audio.ctx,o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(45,freq*.55),ctx.currentTime+dur);
    g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(gain,ctx.currentTime+.025);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);
    o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+dur+.02);
  };
  const setSound=on=>{
    const a=makeAudio(); if(!a){sound.textContent="🔇 Sound unavailable";sound.disabled=true;return}
    if(a.ctx.state==="suspended")a.ctx.resume().catch(()=>{});
    audioEnabled=!!on;a.master.gain.setTargetAtTime(audioEnabled?.028:0,a.ctx.currentTime,.4);
    sound.setAttribute("aria-pressed",String(audioEnabled));sound.textContent=audioEnabled?"🔊 Sound: On":"🔇 Sound: Off";
    try{sessionStorage.setItem(audioKey,audioEnabled?"1":"0")}catch(_){}
  };
  const startOpeningAudio=()=>{
    if(!audioEnabled||!audio)return;
    tone(72,1.8,.025,"sine"); setTimeout(()=>tone(49,2.4,.012,"triangle"),500);
  };
  const hoverSound=()=>tone(175,.16,.014,"triangle");
  const startLightning=()=>{
    if(reduced)return; const flash=document.querySelector(".cr-halloween-lightning");if(!flash)return;
    const schedule=()=>{lightningTimer=setTimeout(()=>{flash.classList.remove("flash");void flash.offsetWidth;flash.classList.add("flash");schedule()},14000+Math.random()*18000)};schedule();
  };
  const enter=(silent)=>{
    try{sessionStorage.setItem(enteredKey,"1")}catch(_){}
    document.documentElement.classList.remove("cr-haunted-lock");
    gate.classList.add("is-hidden"); sound.classList.add("is-visible");
    if(!silent){setSound(true);startOpeningAudio()} else setSound(false);
    startLightning(); document.querySelector(".cr-haunted-enter")?.blur();
    setTimeout(()=>gate.remove(),850);
  };
  gate.querySelector(".cr-haunted-enter").addEventListener("click",()=>enter(false));
  gate.querySelector(".cr-haunted-silent").addEventListener("click",()=>enter(true));
  sound.addEventListener("click",()=>setSound(!audioEnabled));
  document.addEventListener("pointerover",e=>{if(e.target?.closest?.(".btn,.quick-pick,.card,.episode-row,.nav-trigger"))hoverSound()},{passive:true});

  let already=false;try{already=sessionStorage.getItem(enteredKey)==="1"}catch(_){}
  if(already){
    document.documentElement.classList.remove("cr-haunted-lock");gate.classList.add("is-hidden");sound.classList.add("is-visible");
    let wasOn=false;try{wasOn=sessionStorage.getItem(audioKey)==="1"}catch(_){}
    if(wasOn)setSound(true); startLightning(); setTimeout(()=>gate.remove(),850);
  }else{
    document.documentElement.classList.add("cr-haunted-lock");
    if(!reduced)setTimeout(()=>gate.classList.add("cr-haunted-awaken"),350);
    gate.querySelector(".cr-haunted-enter").focus();
  }
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installHalloweenTheme,{once:true});
else installHalloweenTheme();

if(page==="index.html"||page==="launch.html")return;

function syncBootstrap(){
  try{
    if(!window.supabase?.createClient){
      document.write('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\\/script>');
      document.write('<script src="https://unpkg.com/@supabase/supabase-js@2"><\\/script>');
    }
    if(!window.CROW_CONFIG_READY)document.write('<script src="'+BASE+'js/config.js?v='+VERSION+'"><\\/script>');
  }catch(e){console.warn("CrowRules bootstrap loader:",e)}
  const cfg=window.CROW_CONFIG||{};
  if(!window.CROW_SUPABASE&&window.supabase?.createClient&&cfg.supabaseUrl&&cfg.supabaseKey){
    window.CROW_SUPABASE=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
  }
  if(window.CROW_SUPABASE){
    const sb=window.CROW_SUPABASE;
    window.CROW_SUPABASE_READY=Promise.resolve(sb);window.CROW_APP_READY=window.CROW_SUPABASE_READY;window.CROW_BOOTSTRAP=async()=>sb;
    window.CROW_DATA=window.CROW_DATA||{};window.CROW_DATA.ready=async()=>sb;
    if(!window.__CROW_APP_AUTH_BOUND){
      window.__CROW_APP_AUTH_BOUND=true;
      sb.auth.onAuthStateChange((event,session)=>{
        window.__CROW_USER=session?.user||null;window.__CROW_AUTH_READY=true;
        try{const token=session?.access_token||null;if(sb.realtime?.setAuth)sb.realtime.setAuth(token||undefined)}catch(_){}
        window.dispatchEvent(new CustomEvent("crow:auth",{detail:{event,session,user:window.__CROW_USER,supabase:sb}}));
        window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:sb,user:window.__CROW_USER,session}}));
      });
    }
    window.CROW_SUPABASE_ERROR=null;window.CROW_SUPABASE_CONNECTION="connected";
    window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:true,label:"SUPABASE ONLINE"}}));
    Promise.race([sb.auth.getSession(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("Supabase health check timed out.")),8000))]).then(r=>{
      if(r?.error)throw r.error;window.CROW_SUPABASE_CONNECTION="connected";window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:true,label:"SUPABASE ONLINE"}}));
    }).catch(e=>{
      window.CROW_SUPABASE_CONNECTION="degraded";window.CROW_SUPABASE_ERROR=e;window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:false,label:"SUPABASE DEGRADED",error:e.message||String(e)}}));
    });
  }else{
    const e=new Error("CrowRules Supabase client could not initialize.");window.CROW_SUPABASE_ERROR=e;window.CROW_SUPABASE_READY=Promise.reject(e);window.CROW_SUPABASE_READY.catch(()=>{});window.CROW_BOOTSTRAP=async()=>{throw e};
    window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:false,label:"SUPABASE ERROR"}}));
  }
}
syncBootstrap();
if(!document.querySelector('script[data-crow-rebuild]')){
  const s=document.createElement("script");s.src=BASE+"js/crow-podcasting-rebuild.js?v="+VERSION;s.defer=true;s.dataset.crowRebuild="true";document.head.appendChild(s);
}
})();