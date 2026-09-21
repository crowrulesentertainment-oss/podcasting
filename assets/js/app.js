
const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co";
const SUPABASE_KEY=window.CROWRULES_SUPABASE_KEY||"sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";
let sb=null;
async function loadSupabase(){if(sb)return sb;const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";await new Promise((r,j)=>{s.onload=r;s.onerror=j});sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);return sb}
async function auth(){const c=await loadSupabase();return c.auth.getUser()}

function notificationBell(){
  if(document.getElementById("crNotificationBell"))return;
  const style=document.createElement("style");
  style.id="crNotificationBellStyle";
  style.textContent=`
    #crNotificationBell{position:fixed;right:18px;top:18px;z-index:10000;width:46px;height:46px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(8,8,18,.92);backdrop-filter:blur(12px);display:none;place-items:center;color:#fff;text-decoration:none;box-shadow:0 10px 30px rgba(0,0,0,.35)}
    #crNotificationBell:hover{border-color:#00e5ff;transform:translateY(-1px)}
    #crNotificationBell svg{width:20px;height:20px}
    #crNotificationBell .crNotifBadge{position:absolute;right:-5px;top:-5px;min-width:19px;height:19px;padding:0 5px;border-radius:99px;background:#ff2bd6;color:#fff;font:900 9px/19px Montserrat;text-align:center;box-shadow:0 0 16px rgba(255,43,214,.55)}
    @media(max-width:600px){#crNotificationBell{right:12px;top:12px;width:42px;height:42px}}
  `;
  document.head.appendChild(style);
  const a=document.createElement("a");
  a.id="crNotificationBell";
  a.href="notifications.html";
  a.setAttribute("aria-label","Notifications");
  a.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span class="crNotifBadge" hidden>0</span>';
  document.body.appendChild(a);
  return a;
}
async function updateNotificationBell(){
  const bell=notificationBell();
  try{
    const c=await loadSupabase();
    const {data}=await c.auth.getUser();
    if(!data.user){bell.style.display="none";return}
    bell.style.display="grid";
    const q=await c.from("podcast_notifications").select("id",{count:"exact",head:true}).eq("user_id",data.user.id).eq("is_read",false);
    if(q.error)throw q.error;
    const badge=bell.querySelector(".crNotifBadge");
    const count=q.count||0;
    badge.textContent=count>99?"99+":String(count);
    badge.hidden=count===0;
  }catch(e){console.warn("CrowRules notification badge:",e)}
}
function initNotificationBell(){
  updateNotificationBell();
  window.addEventListener("focus",updateNotificationBell);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)updateNotificationBell()});
  setInterval(updateNotificationBell,60000);
}

function nav(){const n=document.querySelector(".navlinks");if(!n)return;const root=/\\/(creator|admin)\\//.test(location.pathname)?"../":"";n.innerHTML=[["index.html","Home"],["podcasts.html","Podcasts"],["top-10.html","Top 10"],["categories.html","Categories"],["search.html","Search"],["my-podcasts.html","My Podcasts"],["notifications.html","Notifications"],["notification-preferences.html","Preferences"],["member-activity.html","Members"],["member-discovery.html","Discover"],["network.html","Network"],["creator/dashboard.html","Creator"],["login.html","Login"]].map(([href,label])=>\`<a href="${root}${href}">${label}</a>\`).join("");n.querySelectorAll("a").forEach(a=>{const target=new URL(a.href,location.href).pathname.replace(/\\/$/,"/index.html"),current=location.pathname.replace(/\\/$/,"/index.html");if(target===current){a.setAttribute("aria-current","page");a.classList.add("active")}})}
async function protect(){const {data}=await (await loadSupabase()).auth.getUser();if(!data.user)location.href="../login.html"}
async function signup(){const c=await loadSupabase();const email=v("email"),password=v("password");const {data,error}=await c.auth.signUp({email,password,options:{data:{display_name:v("display_name"),account_type:v("account_type")}}});msg(error?error.message:"Account created. Check your email if confirmation is required.");if(!error&&data.user)location.href="creator/dashboard.html"}
async function login(){const c=await loadSupabase();const {error}=await c.auth.signInWithPassword({email:v("email"),password:v("password")});msg(error?error.message:"Signed in.");if(!error)location.href="creator/dashboard.html"}
async function logout(){await (await loadSupabase()).auth.signOut();location.href="../index.html"}
function v(id){return document.getElementById(id)?.value.trim()||""}function msg(x){const e=document.getElementById("msg");if(e)e.textContent=x}
async function loadPodcasts(){try{const c=await loadSupabase();const {data,error}=await c.from("podcasts").select("*").order("created_at",{ascending:false}).limit(24);if(error)throw error;renderCards(data||[],"podcastGrid")}catch(e){document.getElementById("podcastGrid")?.insertAdjacentHTML("beforeend",`<p class="notice">Connect your Supabase publishable key in assets/js/app.js to load live data.</p>`)}}
async function loadTop(){try{const c=await loadSupabase();const {data,error}=await c.from("podcast_top10_podcasts_current").select("*").order("rank",{ascending:true}).limit(10);if(error)throw error;renderRanks(data||[])}catch(e){document.getElementById("rankings")?.insertAdjacentHTML("beforeend",`<p class="notice">Top 10 will appear here after rankings are populated.</p>`)}}
function renderCards(rows,id){const el=document.getElementById(id);if(!el)return;if(!rows.length){el.innerHTML="<p class='notice'>No podcasts yet.</p>";return}el.innerHTML=rows.map(x=>`<article class="card"><div class="cover">${x.artwork_url?`<img class="cover" src="${esc(x.artwork_url)}" alt="">`:"PODCAST"}</div><h3>${esc(x.title||"Untitled")}</h3><p>${esc(x.description||"New CrowRules podcast")}</p><span class="badge">${esc(x.category||"Podcast")}</span></article>`).join("")}
function renderRanks(rows){const el=document.getElementById("rankings");if(!rows.length){el.innerHTML="<p class='notice'>No rankings yet.</p>";return}el.innerHTML=rows.map((x,i)=>`<div class="card rank"><div class="ranknum">${x.rank||i+1}</div><div><h3>${esc(x.title||x.podcast_title||"Podcast")}</h3><p>${esc(x.category||"")}</p></div></div>`).join("")}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function initUniversalUX(){if(document.getElementById("crUniversalUX"))return;const style=document.createElement("style");style.id="crUniversalUX";style.textContent=\`.cr-skip{position:fixed;left:12px;top:-60px;z-index:20000;padding:10px 14px;border-radius:10px;background:#00e5ff;color:#030308;font:800 12px Montserrat;text-decoration:none;transition:top .2s}.cr-skip:focus{top:12px}.cr-progress{position:fixed;left:0;top:0;width:100%;height:3px;z-index:19999;pointer-events:none}.cr-progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,#00e5ff,#8b5cf6,#ff2bd6);box-shadow:0 0 12px rgba(0,229,255,.6)}.navlinks a.active{color:#00e5ff!important;border-color:rgba(0,229,255,.45)!important}.cr-status{position:fixed;left:14px;bottom:14px;z-index:9998;padding:7px 10px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:rgba(8,8,18,.9);color:#9da5bd;font:700 9px Orbitron;letter-spacing:.08em;opacity:0;transition:opacity .2s}.cr-status.show{opacity:1}\`;document.head.appendChild(style);const skip=document.createElement("a");skip.className="cr-skip";skip.href="#main-content";skip.textContent="Skip to main content";document.body.prepend(skip);const main=document.querySelector("main");if(main&&!main.id)main.id="main-content";const progress=document.createElement("div");progress.className="cr-progress";progress.innerHTML="<i></i>";progress.setAttribute("aria-hidden","true");document.body.appendChild(progress);const bar=progress.firstElementChild,update=()=>{const max=document.documentElement.scrollHeight-innerHeight;bar.style.width=(max>0?Math.min(100,Math.max(0,scrollY/max*100)):0)+"%"};addEventListener("scroll",update,{passive:true});addEventListener("resize",update);update();const status=document.createElement("div");status.className="cr-status";status.setAttribute("role","status");status.textContent="CROWRULES // ONLINE";document.body.appendChild(status);setTimeout(()=>status.classList.add("show"),200);setTimeout(()=>status.classList.remove("show"),2200);addEventListener("offline",()=>{status.textContent="CROWRULES // OFFLINE";status.classList.add("show")});addEventListener("online",()=>{status.textContent="CROWRULES // ONLINE";status.classList.add("show");setTimeout(()=>status.classList.remove("show"),1800)})}
function initPageEnhancements(){if(document.getElementById("crPageEnhancements"))return;const style=document.createElement("style");style.id="crPageEnhancements";style.textContent=\`.cr-loading{position:fixed;inset:0;z-index:30000;display:grid;place-items:center;background:#030308;transition:opacity .35s}.cr-loading.hide{opacity:0;pointer-events:none}.cr-loading-box{font:800 11px Orbitron;color:#00e5ff;letter-spacing:.18em;text-align:center}.cr-loading-ring{width:42px;height:42px;margin:0 auto 14px;border:2px solid rgba(0,229,255,.16);border-top-color:#00e5ff;border-radius:50%;animation:crspin .8s linear infinite}@keyframes crspin{to{transform:rotate(360deg)}}.cr-top{position:fixed;right:16px;bottom:16px;z-index:9997;width:42px;height:42px;border:1px solid rgba(0,229,255,.3);border-radius:12px;background:rgba(8,8,18,.92);color:#fff;display:none;place-items:center;cursor:pointer;font:900 16px Montserrat}.cr-top.show{display:grid}.cr-top:hover{border-color:#00e5ff;transform:translateY(-2px)}\`;document.head.appendChild(style);const loader=document.createElement("div");loader.className="cr-loading";loader.innerHTML="<div class=\"cr-loading-box\"><div class=\"cr-loading-ring\"></div>CROWRULES // LOADING</div>";document.body.appendChild(loader);const hide=()=>loader.classList.add("hide");if(document.readyState==="complete")setTimeout(hide,100);else addEventListener("load",()=>setTimeout(hide,150),{once:true});const top=document.createElement("button");top.className="cr-top";top.type="button";top.setAttribute("aria-label","Back to top");top.textContent="↑";document.body.appendChild(top);const toggle=()=>top.classList.toggle("show",scrollY>500);addEventListener("scroll",toggle,{passive:true});top.onclick=()=>scrollTo({top:0,behavior:"smooth"});toggle()}
function initInteractionEnhancements(){if(document.getElementById("crInteractionEnhancements"))return;const style=document.createElement("style");style.id="crInteractionEnhancements";style.textContent=\`.cr-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);z-index:25000;max-width:min(92vw,520px);padding:11px 16px;border:1px solid rgba(0,229,255,.3);border-radius:12px;background:rgba(7,7,17,.96);color:#fff;font:700 11px Montserrat;box-shadow:0 12px 35px rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:.25s}.cr-toast.show{opacity:1;transform:translate(-50%,0)}button,a{touch-action:manipulation}@media(prefers-reduced-motion:reduce){.cr-toast{transition:none}}\`;document.head.appendChild(style);const toast=document.createElement("div");toast.className="cr-toast";toast.id="crToast";toast.setAttribute("role","status");document.body.appendChild(toast);let timer;window.crowToast=(message)=>{toast.textContent=message;toast.classList.add("show");clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove("show"),2600)};document.addEventListener("click",e=>{const a=e.target.closest("a");if(!a||a.target==="_blank"||a.hasAttribute("download")||a.href.startsWith("javascript:"))return;const u=new URL(a.href,location.href);if(u.origin===location.origin&&u.pathname!==location.pathname){sessionStorage.setItem("crLastNavigation",Date.now())}})}
document.addEventListener("DOMContentLoaded",()=>{initUniversalUX();initPageEnhancements();initInteractionEnhancements();nav();initNotificationBell();loadPodcasts();loadTop()});
