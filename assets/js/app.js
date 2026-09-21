
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

function nav(){const n=document.querySelector(".navlinks");if(!n)return; n.innerHTML=`<a href="index.html">Home</a><a href="podcasts.html">Podcasts</a><a href="top-10.html">Top 10</a><a href="categories.html">Categories</a><a href="search.html">Search</a><a href="my-podcasts.html">My Podcasts</a><a href="notifications.html">Notifications</a><a href="network.html">Network</a><a href="creator/dashboard.html">Creator</a><a href="login.html">Login</a>`}
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
document.addEventListener("DOMContentLoaded",()=>{nav();initNotificationBell();loadPodcasts();loadTop()});
