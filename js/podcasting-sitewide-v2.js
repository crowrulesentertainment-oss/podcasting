(()=>{"use strict";
const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co",SUPABASE_KEY="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
const STATE_KEY="crowrules_podcasting_universal_player_v2";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
let state=(()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||"{}")}catch{return{}}})();
let timer=null,audio=null,db=null,member=null;
function save(){localStorage.setItem(STATE_KEY,JSON.stringify({track:state.track||null,position:Number(state.position||0),duration:Number(state.duration||0),playing:false,updatedAt:Date.now()}))}
function ensurePlayer(){
 if(document.getElementById("crUniversalPlayer"))return;
 const el=document.createElement("div");el.id="crUniversalPlayer";el.className="cr-universal-player";
 el.innerHTML='<div class="cr-up-art" id="crUpArt">CR</div><div class="cr-up-main"><div><span class="cr-up-kicker" id="crUpKicker">UNIVERSAL PLAYER</span><span class="cr-up-title" id="crUpTitle">Choose an episode</span><span class="cr-up-show" id="crUpShow">CrowRules Podcasting</span></div><div class="cr-up-progress" id="crUpProgress" role="slider" aria-label="Playback position" tabindex="0"><i id="crUpBar"></i></div></div><button class="cr-up-btn" id="crUpPlay" type="button" aria-label="Play">▶</button><button class="cr-up-close" id="crUpClose" type="button" aria-label="Close player">×</button><span class="cr-up-member" id="crUpMember"></span>';
 document.body.appendChild(el);
 el.querySelector("#crUpPlay").onclick=toggle;
 el.querySelector("#crUpClose").onclick=()=>{el.classList.remove("open");state.closed=true;save()};
 el.querySelector("#crUpProgress").onclick=e=>{if(!state.duration)return;const r=e.currentTarget.getBoundingClientRect();state.position=Math.max(0,Math.min(state.duration,((e.clientX-r.left)/r.width)*state.duration));if(audio)audio.currentTime=state.position;render();save()};
 el.querySelector("#crUpProgress").onkeydown=e=>{if(!state.duration)return;if(e.key==="ArrowRight")state.position=Math.min(state.duration,state.position+15);if(e.key==="ArrowLeft")state.position=Math.max(0,state.position-15);if(e.key==="ArrowRight"||e.key==="ArrowLeft"){if(audio)audio.currentTime=state.position;render();save()}};
}
function render(){
 const el=document.getElementById("crUniversalPlayer");if(!el)return;
 const t=state.track||{};el.classList.toggle("open",!!t&&!state.closed);
 const $=id=>document.getElementById(id);$("crUpArt").textContent=t.art||"CR";$("crUpTitle").textContent=t.title||"Choose an episode";$("crUpShow").textContent=t.show||"CrowRules Podcasting";
 $("crUpKicker").textContent=state.playing?"NOW PLAYING":"UNIVERSAL PLAYER";$("crUpPlay").textContent=state.playing?"❚❚":"▶";$("crUpBar").style.width=state.duration?((state.position/state.duration)*100)+"%":"0%";
 $("crUpMember").textContent=member?(member.role.toUpperCase()+" • "+member.name):"GUEST MODE";
}
function stopTimer(){if(timer){clearInterval(timer);timer=null}}
function tick(){if(!state.playing||!state.track)return;if(audio)return;state.position+=1;if(!state.duration)state.duration=300;if(state.position>=state.duration){state.position=0;state.playing=false;stopTimer()}render();save()}
function startTimer(){stopTimer();timer=setInterval(tick,1000)}
async function toggle(){
 if(!state.track)return;
 state.closed=false;state.playing=!state.playing;
 if(audio){try{if(state.playing)await audio.play();else audio.pause()}catch(e){state.playing=false}}
 else if(state.playing){if(!state.duration)state.duration=300;startTimer()}
 render();save()
}
function play(track){
 state.track={show:track.show||"Podcasting",title:track.title||"Untitled episode",art:track.art||"CR",audio:track.audio||null};
 state.position=Number(track.position||0);state.duration=Number(track.duration||0);state.playing=false;state.closed=false;
 if(audio){audio.pause();audio=null}
 if(state.track.audio){audio=new Audio(state.track.audio);audio.preload="metadata";audio.addEventListener("loadedmetadata",()=>{state.duration=audio.duration;audio.currentTime=state.position;render();save()});audio.addEventListener("timeupdate",()=>{state.position=audio.currentTime;render();save()});audio.addEventListener("ended",()=>{state.playing=false;state.position=0;render();save()})}
 render();save();toggle()
}
window.addEventListener("crowrules:play",e=>{if(e.detail)play(e.detail)});
window.addEventListener("beforeunload",()=>save());
async function memberState(){
 try{
  if(!window.supabase){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
  db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const load=async session=>{if(!session){member=null;render();return}const u=session.user;let name=u.email?.split("@")[0]||"MEMBER",role="listener";try{const r=await db.from("podcasting_profiles").select("display_name,account_type").eq("id",u.id).maybeSingle();if(r.data){name=r.data.display_name||name;role=r.data.account_type==="podcaster"?"podcaster":"listener"}}catch{}member={name,role};render()};
  const s=await db.auth.getSession();await load(s.data.session);db.auth.onAuthStateChange((_event,session)=>setTimeout(()=>load(session),0));
 }catch{member=null;render()}
}
function boot(){ensurePlayer();render();memberState();window.dispatchEvent(new CustomEvent("crowrules:universal-ready"))}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
