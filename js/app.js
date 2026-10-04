(()=>{"use strict";
const BASE="https://crowrulesentertainment-oss.github.io/podcasting/";
const VERSION="20261004-v13";
const page=(location.pathname.split("/").pop()||"index.html").toLowerCase();
function css(href,id){if(document.getElementById(id))return;const l=document.createElement("link");l.rel="stylesheet";l.href=href;l.id=id;document.head.appendChild(l)}
function script(src,id){return new Promise((resolve,reject)=>{if(document.getElementById(id)||[...document.scripts].some(s=>s.src.startsWith(src))){resolve();return}const s=document.createElement("script");s.src=src;s.id=id;s.defer=true;s.onload=resolve;s.onerror=()=>reject(Error("Unable to load "+src));document.head.appendChild(s)})}
function halloween(){
  document.documentElement.dataset.crowSeason="halloween";document.body?.classList.add("cr-halloween-theme");
  css(BASE+"css/halloween-cinematic-v2.css?v="+VERSION,"crow-halloween-v2");
  if(page!=="home.html")return;
  if(document.querySelector("[data-crow-haunted-experience]"))return;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const entered="cr_halloween_entered_v2",audioKey="cr_halloween_audio_v2";
  ["cr-halloween-cemetery","cr-halloween-pumpkins","cr-halloween-ghosts","cr-halloween-lightning","cr-halloween-candle"].forEach(c=>{if(!document.querySelector("."+c)){const e=document.createElement("div");e.className=c;e.setAttribute("aria-hidden","true");document.body.appendChild(e)}});
  const gate=document.createElement("div");gate.className="cr-haunted-gate";gate.dataset.crowHauntedExperience="true";
  gate.innerHTML='<div class="cr-haunted-gate-panel" role="dialog" aria-modal="true" aria-labelledby="crHauntedTitle"><div class="cr-haunted-gate-moon" aria-hidden="true">☾</div><div class="cr-haunted-gate-kicker">CROWRULES PODCASTING • HALLOWEEN 2026</div><h1 id="crHauntedTitle">ENTER IF YOU DARE</h1><p class="cr-haunted-stage-text">The lights are low. The air is cold. The podcasts are waiting.</p><div class="cr-haunted-gate-actions"><button class="cr-haunted-enter" type="button">ENTER IF YOU DARE</button><button class="cr-haunted-silent" type="button">Continue silently</button></div><p class="cr-haunted-note">Sound is optional. Nothing plays until you choose.</p></div>';
  document.body.appendChild(gate);
  const sound=document.createElement("button");sound.type="button";sound.className="cr-haunted-audio";sound.textContent="🔇 Sound: Off";sound.setAttribute("aria-pressed","false");sound.setAttribute("aria-label","Toggle spooky ambience");document.body.appendChild(sound);
  let audio=null,on=false;
  function makeAudio(){if(audio)return audio;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;const ctx=new AC(),master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);const o=ctx.createOscillator(),l=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=54;l.frequency.value=.07;g.gain.value=9;l.connect(g);g.connect(o.frequency);o.connect(master);o.start();l.start();audio={ctx,master};return audio}
  function setSound(v){const a=makeAudio();if(!a){sound.disabled=true;sound.textContent="🔇 Sound unavailable";return}if(a.ctx.state==="suspended")a.ctx.resume().catch(()=>{});on=!!v;a.master.gain.setTargetAtTime(on?.028:0,a.ctx.currentTime,.4);sound.textContent=on?"🔊 Sound: On":"🔇 Sound: Off";sound.setAttribute("aria-pressed",String(on));try{sessionStorage.setItem(audioKey,on?"1":"0")}catch(_){}}
  function enter(silent){try{sessionStorage.setItem(entered,"1")}catch(_){}document.documentElement.classList.remove("cr-haunted-lock");gate.classList.add("is-hidden");sound.classList.add("is-visible");setSound(!silent);if(!reduced){const f=document.querySelector(".cr-halloween-lightning");if(f){setInterval(()=>{f.classList.remove("flash");void f.offsetWidth;f.classList.add("flash")},18000+Math.random()*14000)}}setTimeout(()=>gate.remove(),700)}
  gate.querySelector(".cr-haunted-enter").onclick=()=>enter(false);gate.querySelector(".cr-haunted-silent").onclick=()=>enter(true);sound.onclick=()=>setSound(!on);
  let was=false;try{was=sessionStorage.getItem(entered)==="1"}catch(_){}
  if(was){gate.classList.add("is-hidden");sound.classList.add("is-visible");let a=false;try{a=sessionStorage.getItem(audioKey)==="1"}catch(_){}if(a)setSound(true);setTimeout(()=>gate.remove(),700)}else{document.documentElement.classList.add("cr-haunted-lock");if(!reduced)setTimeout(()=>gate.classList.add("awaken"),250);gate.querySelector(".cr-haunted-enter").focus()}
}
async function boot(){
  try{if(document.readyState==="loading")await new Promise(r=>document.addEventListener("DOMContentLoaded",r,{once:true}));halloween();css(BASE+"css/sitewide-v13.css?v="+VERSION,"crow-sitewide-v13");if(!window.supabase?.createClient)await script("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2","crow-supabase-js");if(!window.CROW_CONFIG_READY)await script(BASE+"js/config.js?v="+VERSION,"crow-config-v13");const cfg=window.CROW_CONFIG||{};if(!window.supabase?.createClient||!cfg.supabaseUrl||!cfg.supabaseKey)throw Error("CrowRules Supabase configuration is incomplete.");
    if(!window.CROW_SUPABASE)window.CROW_SUPABASE=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
    window.CROW_SUPABASE_READY=Promise.resolve(window.CROW_SUPABASE);window.CROW_APP_READY=window.CROW_SUPABASE_READY;window.CROW_BOOTSTRAP=async()=>window.CROW_SUPABASE;window.CROW_DATA=window.CROW_DATA||{};window.CROW_DATA.ready=async()=>window.CROW_SUPABASE;
    const {data}=await window.CROW_SUPABASE.auth.getSession();window.__CROW_USER=data?.session?.user||null;window.__CROW_AUTH_READY=true;window.CROW_SUPABASE_CONNECTION="connected";
    try{window.CROW_SUPABASE.realtime?.setAuth(data?.session?.access_token||undefined)}catch(_){}
    if(!window.__CROW_AUTH_BOUND_V13){window.__CROW_AUTH_BOUND_V13=true;window.CROW_SUPABASE.auth.onAuthStateChange((event,session)=>{window.__CROW_USER=session?.user||null;window.__CROW_AUTH_READY=true;try{window.CROW_SUPABASE.realtime?.setAuth(session?.access_token||undefined)}catch(_){}window.dispatchEvent(new CustomEvent("crow:auth",{detail:{event,session,user:window.__CROW_USER,supabase:window.CROW_SUPABASE}}));window.dispatchEvent(new CustomEvent("crow:ready",{detail:{supabase:window.CROW_SUPABASE,user:window.__CROW_USER,session}}))})}
    window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:true,label:"SUPABASE ONLINE"}}));
  }catch(e){window.CROW_SUPABASE_ERROR=e;window.CROW_SUPABASE_CONNECTION="error";window.CROW_SUPABASE_READY=Promise.reject(e);window.CROW_SUPABASE_READY.catch(()=>{});window.dispatchEvent(new CustomEvent("crow:connection",{detail:{ok:false,label:"SUPABASE ERROR",error:e.message||String(e)}}))}
  await script(BASE+"js/sitewide-v13.js?v="+VERSION,"crow-sitewide-v13");
}
boot();
})();