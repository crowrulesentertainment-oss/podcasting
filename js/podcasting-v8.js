(()=>{"use strict";
const VERSION="10.0.0";
const PODCASTING_LOGO="https://cevylpnoexugwgygvtgu.supabase.co/storage/v1/object/public/images/podcastinglogo.png";
const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
function inject(tag,attrs={},parent=document.head){const e=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent.appendChild(e);return e}
function toast(message,kind="info"){let t=$("#cr8-toast");if(!t){t=document.createElement("div");t.id="cr8-toast";t.className="cr8-toast";t.setAttribute("role","status");t.setAttribute("aria-live","polite");document.body.appendChild(t)}t.dataset.kind=kind;t.textContent=message;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),3200)}
function setupGlobalPlayer(){
 if(window.CrowPlayer)return;
 const host=document.querySelector("#cr-player")||document.body,box=document.createElement("section");box.id="cr8-player";box.className="cr8-player";box.innerHTML='<div class="cr8-player-art"><img id="cr8-player-art-img" alt=""><img id="cr8-player-brand-logo" src="'+PODCASTING_LOGO+'" alt="CrowRules Podcasting" onerror="this.style.display=\'none\'"><span id="cr8-player-art-fallback">CR</span></div><div class="cr8-player-main"><div class="cr8-player-brand"><img src="'+PODCASTING_LOGO+'" alt="" onerror="this.style.display=\'none\'"><span>CROWRULES PODCASTING</span></div><strong id="cr8-player-title">CrowRules Podcasting</strong><small id="cr8-player-show">Choose an episode to begin</small><div class="cr8-player-controls"><button id="cr8-prev" type="button" aria-label="Previous">⏮</button><button id="cr8-play" type="button" aria-label="Play">▶</button><button id="cr8-next" type="button" aria-label="Next">⏭</button><audio id="cr8-audio" preload="metadata"></audio></div><div class="cr8-player-track"><i id="cr8-player-progress"></i></div></div><button id="cr8-player-close" type="button" aria-label="Close player">×</button>';
 host.appendChild(box);
 const audio=box.querySelector("#cr8-audio"),title=box.querySelector("#cr8-player-title"),show=box.querySelector("#cr8-player-show"),art=box.querySelector("#cr8-player-art-img"),fallback=box.querySelector("#cr8-player-art-fallback"),prog=box.querySelector("#cr8-player-progress"),playBtn=box.querySelector("#cr8-play");
 const state={item:null,queue:[],lastSave:0,lastSignal:0};
 const getUser=async()=>{try{return(await window.CROW_PODCASTING?.auth.getUser())?.data?.user||null}catch(_){return null}};
 async function savePosition(force=false){const item=state.item;if(!item||!window.CROW_PODCASTING)return;const user=await getUser();if(!user)return;const seconds=Math.floor(audio.currentTime||0),duration=Math.floor(audio.duration||item.duration_seconds||0);if(!force&&seconds-state.lastSave<8)return;state.lastSave=seconds;try{const q=window.CROW_PODCASTING;const{data:existing}=await q.from("podcast_user_episode_progress").select("id").eq("user_id",user.id).eq("episode_id",item.id).maybeSingle();const row={user_id:user.id,episode_id:item.id,position_seconds:seconds,duration_seconds:duration,completed:duration>0&&seconds>=Math.max(0,duration-5),updated_at:new Date().toISOString()};if(existing)await q.from("podcast_user_episode_progress").update(row).eq("id",existing.id);else await q.from("podcast_user_episode_progress").insert(row);const{data:recent}=await q.from("podcast_user_recently_played").select("id").eq("user_id",user.id).eq("episode_id",item.id).maybeSingle();const rr={user_id:user.id,episode_id:item.id,last_played_at:new Date().toISOString(),play_position_seconds:seconds};if(recent)await q.from("podcast_user_recently_played").update(rr).eq("id",recent.id);else await q.from("podcast_user_recently_played").insert(rr)}catch(_){}}
 async function signal(kind,seconds=0){const item=state.item;if(!item)return;try{const u=await getUser();window.CrowListener?.signal?.(u?.id,{id:item.id,podcast_id:item.podcast_id,category:item.category,seconds},kind)}catch(_){}}
 async function play(item){if(!item?.id||!item.audio_url)return false;state.item=item;title.textContent=item.title||"Episode";show.textContent=item.podcast_title||"CrowRules Podcasting";if(item.artwork_url){art.src=item.artwork_url;art.style.display="block";fallback.style.display="none"}else{art.removeAttribute("src");art.style.display="none";fallback.style.display="grid"}if(audio.src!==item.audio_url){audio.src=item.audio_url;audio.currentTime=Number(item.position_seconds||0)}box.classList.add("show");await signal("play");await audio.play().catch(()=>{});playBtn.textContent=audio.paused?"▶":"❚❚";return true}
 async function addToQueue(item){const u=await getUser();if(!u||!item?.id||!window.CROW_PODCASTING)return false;const{data}=await window.CROW_PODCASTING.from("podcast_user_queue").select("position").eq("user_id",u.id).order("position",{ascending:false}).limit(1);const pos=Number(data?.[0]?.position??-1)+1;const{error}=await window.CROW_PODCASTING.from("podcast_user_queue").insert({user_id:u.id,episode_id:item.id,position:pos});return !error}
 async function playNext(item){return addToQueue(item)}
 async function nextFromQueue(){const u=await getUser();if(!u)return false;const{data}=await window.CROW_PODCASTING.from("podcast_user_queue").select("id,episode_id,position").eq("user_id",u.id).order("position").limit(1);const row=data?.[0];if(!row)return false;const{data:e}=await window.CROW_PODCASTING.from("podcast_episodes").select("id,podcast_id,title,audio_url,thumbnail_url,duration_seconds,podcasts(title,category,artwork_url)").eq("id",row.episode_id).maybeSingle();if(!e?.audio_url)return false;await window.CROW_PODCASTING.from("podcast_user_queue").delete().eq("id",row.id);return play({id:e.id,podcast_id:e.podcast_id,title:e.title,audio_url:e.audio_url,duration_seconds:e.duration_seconds,podcast_title:e.podcasts?.title,category:e.podcasts?.category,artwork_url:e.thumbnail_url||e.podcasts?.artwork_url})}
 playBtn.onclick=()=>audio.paused?audio.play():audio.pause();audio.addEventListener("play",()=>{playBtn.textContent="❚❚";signal("play")});audio.addEventListener("pause",()=>{playBtn.textContent="▶";savePosition(true)});audio.addEventListener("timeupdate",()=>{const d=audio.duration||state.item?.duration_seconds||0;prog.style.width=d?Math.min(100,(audio.currentTime/d)*100)+"%":"0%";if(audio.currentTime-state.lastSignal>=30){state.lastSignal=audio.currentTime;signal("progress",30);savePosition()}});audio.addEventListener("ended",async()=>{await savePosition(true);await signal("complete");await nextFromQueue()});box.querySelector("#cr8-next").onclick=()=>nextFromQueue();box.querySelector("#cr8-prev").onclick=()=>{if(state.item)audio.currentTime=0};box.querySelector("#cr8-player-close").onclick=()=>{audio.pause();box.classList.remove("show")};
 window.CrowPlayer={play,addToQueue,playNext,next:nextFromQueue,element:audio,getState:()=>({...state})};
}
function setupGlobalNav(){
 if(!document.body||document.getElementById("cr8-nav")||document.querySelector(".topbar"))return;
 const nav=document.createElement("header");nav.id="cr8-nav";nav.className="cr8-nav";
 nav.innerHTML='<a class="cr8-brand" href="home.html" aria-label="CrowRules Podcasting home"><img src="'+PODCASTING_LOGO+'" alt="CrowRules Podcasting"><span><b>CROWRULES</b><small>PODCASTING</small></span></a><button class="cr8-nav-toggle" type="button" aria-expanded="false" aria-controls="cr8-nav-links">MENU</button><nav id="cr8-nav-links" class="cr8-nav-links" aria-label="Podcasting navigation"><a href="home.html">HOME</a><a href="discover.html">DISCOVER</a><a href="library.html">LIBRARY</a><a href="create-podcast.html">CREATE</a><a href="creator.html">CREATOR STUDIO</a><a href="account.html">ACCOUNT</a><a class="cr8-nav-join" href="signup.html">JOIN</a></nav>';
 document.body.prepend(nav);
 const toggle=nav.querySelector(".cr8-nav-toggle"),links=nav.querySelector(".cr8-nav-links");toggle.onclick=()=>{const open=links.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));};
 links.addEventListener("click",e=>{if(e.target.closest("a")){links.classList.remove("open");toggle.setAttribute("aria-expanded","false");}});
}
function setupChrome(){
 if(!document.body)return;
 if(!$("#cr8-progress")){const p=document.createElement("div");p.id="cr8-progress";p.className="cr8-progress";p.innerHTML="<i></i>";document.body.appendChild(p)}
 if(!$("#cr8-skip")){const a=document.createElement("a");a.id="cr8-skip";a.className="cr8-skip";a.href="#main";a.textContent="Skip to main content";document.body.prepend(a)}
 const main=$("main");if(main&&!main.id)main.id="main";
 if(!$("#cr8-up")){const b=document.createElement("button");b.id="cr8-up";b.className="cr8-up";b.type="button";b.setAttribute("aria-label","Back to top");b.textContent="↑";b.onclick=()=>scrollTo({top:0,behavior:"smooth"});document.body.appendChild(b)}
 if(!$("#cr8-online")){const n=document.createElement("div");n.id="cr8-online";n.className="cr8-online";n.textContent=navigator.onLine?"NETWORK ONLINE":"OFFLINE MODE";document.body.appendChild(n)}
 if(!$("#cr8-footer")){const f=document.createElement("footer");f.id="cr8-footer";f.className="cr8-footer";f.innerHTML='<div class="cr8-footer-grid"><div><strong>CROWRULES / PODCASTING</strong><br>One account. One universe. Built for listeners, creators and the next generation of independent voices.</div><nav aria-label="Podcasting footer"><a href="home.html">Home</a><a href="discover.html">Discover</a><a href="library.html">Library</a><a href="creator.html">Creator Studio</a><a href="profile.html">Profile</a><a href="login.html">Sign In</a><a href="signup.html">Join</a></nav></div><div style="margin-top:16px">© '+new Date().getFullYear()+' CrowRules Entertainment • Podcasting V'+VERSION+'</div>';document.body.appendChild(f)}
}
function setupAccountUI(){
 const id="cr8-account";
 if(!document.body||document.getElementById(id))return;
 const wrap=document.createElement("div");wrap.id=id;wrap.className="cr8-account";
 wrap.innerHTML='<button class="cr8-account-trigger" type="button" aria-expanded="false"><span class="cr8-account-avatar"><img data-cr-account-avatar alt=""></span><span class="cr8-account-copy"><b data-cr-account-name>Account</b><small data-cr-account-membership>Sign in to Podcasting</small></span><span class="cr8-account-chevron">⌄</span></button><div class="cr8-account-menu" hidden><div class="cr8-account-summary"><strong data-cr-account-name>Account</strong><span data-cr-account-points>CrowPoints: 0</span><span data-cr-account-badge>FREE</span></div><a href="account.html">ACCOUNT DASHBOARD</a><a href="library.html">LIBRARY</a><a href="profile.html">PROFILE</a><a href="creator.html" data-cr-creator-link>CREATOR STUDIO</a><a href="login.html" data-cr-signin>SIGN IN</a><a href="signup.html" data-cr-join>JOIN CROW RULES</a><button type="button" data-cr-signout>SIGN OUT</button></div>';
 document.body.appendChild(wrap);
 const trigger=wrap.querySelector(".cr8-account-trigger"),menu=wrap.querySelector(".cr8-account-menu");
 trigger.onclick=()=>{const open=menu.hidden;menu.hidden=!open;trigger.setAttribute("aria-expanded",String(open))};
 document.addEventListener("click",e=>{if(!wrap.contains(e.target)){menu.hidden=true;trigger.setAttribute("aria-expanded","false")}});
 wrap.querySelector("[data-cr-signout]").onclick=async()=>{try{await window.CROW_PODCASTING?.auth.signOut();toast("Signed out.");}catch(e){toast("Sign out failed.","error")}};
 const update=state=>{
  const signed=!!state?.user, creator=!!(state?.creator?.is_active||state?.profile?.is_creator), member=state?.membership;
  const name=state?.profile?.display_name||state?.member?.display_name||state?.user?.user_metadata?.full_name||state?.user?.email?.split("@")[0]||"Account";
  const avatar=state?.profile?.avatar_url||state?.member?.avatar_url||state?.user?.user_metadata?.avatar_url||"";
  wrap.querySelectorAll("[data-cr-account-name]").forEach(e=>e.textContent=name);
  wrap.querySelector("[data-cr-account-membership]").textContent=signed?(member?.type||"free").toUpperCase()+" MEMBER":"Sign in to Podcasting";
  wrap.querySelector("[data-cr-account-points]").textContent="CrowPoints: "+Number(member?.points||0).toLocaleString();
  wrap.querySelector("[data-cr-account-badge]").textContent=(member?.type||"free").toUpperCase();
  const img=wrap.querySelector("[data-cr-account-avatar] img");if(avatar){img.src=avatar;img.style.display="block"}else{img.removeAttribute("src");img.style.display="none"}
  wrap.querySelector("[data-cr-signin]").hidden=signed;wrap.querySelector("[data-cr-join]").hidden=signed;wrap.querySelector("[data-cr-signout]").hidden=!signed;wrap.querySelector("[data-cr-creator-link]").hidden=!creator;
 };
 if(window.CrowAccount?.onChange)window.CrowAccount.onChange(update);else window.addEventListener("crowrules:account",e=>update(e.detail));
}
function setupProgress(){
 const bar=$("#cr8-progress i");if(!bar)return;
 const update=()=>{const max=document.documentElement.scrollHeight-innerHeight;bar.style.width=(max>0?Math.min(100,scrollY/max*100):0)+"%";$("#cr8-up")?.classList.toggle("show",scrollY>700)};
 addEventListener("scroll",update,{passive:true});addEventListener("resize",update,{passive:true});update();
}
function setupNav(){
 const here=(location.pathname.split("/").pop()||"home.html").toLowerCase();
 $$("a[href]").forEach(a=>{try{const u=new URL(a.href,location.href);const p=(u.pathname.split("/").pop()||"home.html").toLowerCase();if(p===here&&!a.href.includes("#"))a.classList.add("cr8-nav-active")}catch(_){}});
 document.addEventListener("keydown",e=>{if(e.key!=="/"||e.ctrlKey||e.metaKey||e.altKey)return;if(/input|textarea|select/i.test(e.target.tagName))return;const q=$('input[type="search"],input[placeholder*="Search" i],#search');if(q){e.preventDefault();q.focus()}});
}
function setupNetwork(){const n=$("#cr8-online");if(!n)return;const set=()=>{n.textContent=navigator.onLine?"NETWORK ONLINE":"OFFLINE MODE";n.classList.toggle("cr8-offline",!navigator.onLine)};addEventListener("online",()=>{set();toast("Connection restored.")});addEventListener("offline",()=>{set();toast("You're offline. Saved local playback controls remain available.","error")});set()}
function setupLinks(){
 document.addEventListener("click",e=>{
  const a=e.target.closest("a[href]");if(!a||a.target==="_blank"||a.hasAttribute("download"))return;
  let u;try{u=new URL(a.href,location.href)}catch(_){return}
  if(u.origin!==location.origin)return;
  const next=u.pathname.split("/").pop()||"home.html";
  if(next==="login.html"||next==="signup.html")return;
  try{sessionStorage.setItem("crp_last_page",location.href)}catch(_){}
 });
}
function setupAuthUX(){
 const update=(state)=>{
  document.documentElement.dataset.crSignedIn=state?.user?"true":"false";
  document.documentElement.dataset.crCreator=state?.creator?.is_active||state?.profile?.is_creator?"true":"false";
  document.documentElement.dataset.crMembership=String(state?.membership?.type||"free");
  document.querySelectorAll("[data-cr-account-name]").forEach(e=>e.textContent=state?.profile?.display_name||state?.member?.display_name||state?.user?.user_metadata?.full_name||"Account");
  document.querySelectorAll("[data-cr-account-avatar]").forEach(e=>{const u=state?.profile?.avatar_url||state?.member?.avatar_url||state?.user?.user_metadata?.avatar_url;if(u)e.src=u;});
 };
 if(window.CrowAccount?.onChange) window.CrowAccount.onChange(update);
 else window.addEventListener("crowrules:account",e=>update(e.detail));
 window.addEventListener("crowrules:auth",e=>{
  const next=new URLSearchParams(location.search).get("next");
  if(e.detail?.event==="SIGNED_IN"&&next&&/^[A-Za-z0-9_./?=&-]+\.html(?:[?#].*)?$/.test(next)&&!location.pathname.endsWith(next.split("?")[0].split("#")[0])) location.href=next;
 });
}
function setupTheme(){document.body.dataset.crPodcastingVersion=VERSION;try{localStorage.setItem("crp_site_version",VERSION)}catch(_){}}
function setupServiceLinks(){
 const manifest=location.pathname.includes("/podcasting/")?"manifest.json":null;
 if(manifest&&!document.querySelector('link[rel="manifest"]'))inject("link",{rel:"manifest",href:manifest});
}
function loadListener(){if(window.CrowListener||document.querySelector('script[data-cr-listener]'))return;const s=document.createElement("script");s.src="js/listener-engine.js?v=20261007-v9.0.0";s.defer=true;s.dataset.crListener="v9";document.head.appendChild(s)}\nfunction boot(){loadListener();setupGlobalNav();setupChrome();setupGlobalPlayer();setupAccountUI();setupProgress();setupNav();setupNetwork();setupLinks();setupAuthUX();setupTheme();setupServiceLinks();root.dataset.crPodcasting="v9";window.CrowPodcastingV8={version:VERSION,toast};}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();