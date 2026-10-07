(()=>{"use strict";
const U="https://cevylpnoexugwgygvtgu.supabase.co",K="sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-",recentKey="crowrules_podcasting_recent";
let db=null,shows=[],eps=[],genre="All",sort="latest";
const $=s=>document.querySelector(s), esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fallbackShows=[
{name:"Tacoma Nights",genre:"Documentary",tag:"LOCAL / DOCS",desc:"Stories, people and places from Tacoma and the South Sound.",art:"TN",eps:0},
{name:"Back Deck Live",genre:"Talk",tag:"CONVERSATION",desc:"Building CrowRules in public — one conversation at a time.",art:"BD",eps:0},
{name:"Bird Brains",genre:"Comedy",tag:"COMMUNITY / FUN",desc:"Unfiltered conversations, laughs and whatever lands on the perch.",art:"BB",eps:0}
];
const fallbackEps=[
{show:"Tacoma Nights",genre:"Documentary",date:"OCT 04, 2026",title:"The City After Dark",desc:"A cinematic walk through Tacoma after the sun goes down.",art:"TN"},
{show:"Back Deck Live",genre:"Talk",date:"OCT 03, 2026",title:"What Are We Building?",desc:"College, YouTube, AI and the next chapter of CrowRules.",art:"BD"},
{show:"Bird Brains",genre:"Comedy",date:"OCT 01, 2026",title:"Welcome Back to the Perch",desc:"The latest Bird Brains transmission.",art:"BB"},
{show:"Tacoma Nights",genre:"Documentary",date:"SEP 27, 2026",title:"Rain, Neon & Tacoma",desc:"Why the city feels different when the streets start shining.",art:"TN"},
{show:"Back Deck Live",genre:"Talk",date:"SEP 26, 2026",title:"Starting Small",desc:"Why Dreamscapes is the first step.",art:"BD"}
];
function recent(){try{return JSON.parse(localStorage.getItem(recentKey)||"[]")}catch{return[]}}
function remember(e){const a=recent().filter(x=>x.key!==e.key);a.unshift(e);localStorage.setItem(recentKey,JSON.stringify(a.slice(0,6)));renderContinue()}
function mapShow(s,count){return{name:s.title,genre:s.genre,tag:(s.genre+" / PODCAST").toUpperCase(),desc:s.description||"A CrowRules Podcasting show.",art:(s.title||"CR").slice(0,2).toUpperCase(),eps:count||0,id:s.id,artwork:s.artwork_url||null}}
function mapEpisode(e,s){const d=e.published_at?new Date(e.published_at):null;return{key:e.id,show:s.title,genre:s.genre,date:d?d.toLocaleDateString("en-US",{month:"short",day:"2-digit",year:"numeric"}).toUpperCase():"JUST ADDED",title:e.title,desc:e.description||"",art:(s.title||"CR").slice(0,2).toUpperCase(),artwork:e.artwork_url||s.artwork_url||null,audio:e.audio_url||null,duration:e.duration_seconds||0,episodeId:e.id,showId:s.id}}
async function loadCatalog(){
 try{
  if(!window.supabase)throw new Error("Supabase client unavailable");
  db=window.supabase.createClient(U,K,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const [sr,er]=await Promise.all([
   db.from("podcasting_shows").select("id,title,description,genre,artwork_url").eq("published",true).order("created_at",{ascending:false}),
   db.from("podcasting_episodes").select("id,show_id,title,description,audio_url,artwork_url,duration_seconds,published_at").eq("published",true).order("published_at",{ascending:false})
  ]);
  if(sr.error)throw sr.error;if(er.error)throw er.error;
  const catalog=sr.data||[],rows=er.data||[],byId=new Map(catalog.map(s=>[s.id,s]));
  shows=catalog.map(s=>mapShow(s,rows.filter(e=>e.show_id===s.id).length));
  eps=rows.map(e=>mapEpisode(e,byId.get(e.show_id))).filter(Boolean);
  if(!shows.length){shows=fallbackShows;eps=fallbackEps}
  const status=$("#episodeSummary");if(status)status.dataset.catalog="supabase";
 }catch(error){console.warn("[CrowRules Catalog V5]",error);shows=fallbackShows;eps=fallbackEps}
}
function renderGenres(){const genres=["All",...new Set(shows.map(x=>x.genre))];$("#genreChips").innerHTML=genres.map(g=>'<button class="chip '+(g===genre?"active":"")+'" data-genre="'+esc(g)+'">'+esc(g.toUpperCase())+"</button>").join("");document.querySelectorAll("[data-genre]").forEach(b=>b.onclick=()=>{genre=b.dataset.genre;renderGenres();renderShows();renderEpisodes()})}
function renderShows(){const a=genre==="All"?shows:shows.filter(x=>x.genre===genre);$("#showGrid").innerHTML=a.map((s,i)=>'<article class="show" data-name="'+esc(s.name)+'"><small class="eyebrow">SIGNAL '+String(i+1).padStart(2,"0")+"</small><div class="showArt">"+(s.artwork?'<img src="'+esc(s.artwork)+'" alt="" loading="lazy">':esc(s.art))+'</div><h3>'+esc(s.name)+"</h3><p>"+esc(s.desc)+'</p><div class="showMeta"><span>'+esc(s.tag)+'</span><span>'+s.eps+" EPISODES</span></div></article>").join("")||'<div class="emptyState">No published shows match this signal.</div>';document.querySelectorAll(".show").forEach(x=>x.onclick=()=>{location.hash="episodes";renderEpisodes(x.dataset.name)})}
function renderEpisodes(filter){let a=filter?eps.filter(e=>e.show===filter):(genre==="All"?eps:eps.filter(e=>e.genre===genre));a=[...a].sort((x,y)=>sort==="alpha"?x.title.localeCompare(y.title):String(y.date).localeCompare(String(x.date)));$("#episodeSummary").textContent=a.length+" TRANSMISSIONS • SUPABASE CATALOG";$("#episodeList").innerHTML=a.map(e=>'<article class="episode"><div class="art">'+(e.artwork?'<img src="'+esc(e.artwork)+'" alt="" loading="lazy">':esc(e.art))+'</div><div><small>'+esc(e.show)+" • "+esc(e.date)+'</small><h3>'+esc(e.title)+'</h3><p>'+esc(e.desc)+'</p></div><div class="episodeActions"><button aria-label="Play '+esc(e.title)+'">▶</button><button type="button" class="queueBtn" aria-label="Add '+esc(e.title)+' to queue">＋</button></div></article>').join("")||'<div class="emptyState">No published episodes match this signal.</div>';document.querySelectorAll(".episodeActions button").forEach(b=>b.onclick=ev=>{ev.stopPropagation();const i=[...document.querySelectorAll(".episode")].indexOf(b.closest(".episode"));if(i<0)return;if(b.classList.contains("queueBtn"))window.dispatchEvent(new CustomEvent("crowrules:queue",{detail:a[i]}));else play(a[i])})}
function renderContinue(){const a=recent();$("#continueList").innerHTML=a.length?a.map(e=>'<article class="continueCard"><div class="art">'+esc(e.art||"CR")+'</div><div><small>'+esc(e.show)+'</small><b>'+esc(e.title)+'</b><span>RECENTLY PLAYED</span></div><button>▶</button></article>').join(""):'<div class="emptyState">Your listening trail will appear here when you play an episode.</div>';document.querySelectorAll(".continueCard button").forEach((b,i)=>b.onclick=()=>play(a[i]))}
function play(e){remember(e);window.dispatchEvent(new CustomEvent("crowrules:play",{detail:e}))}
$("#clearHistory").onclick=()=>{localStorage.removeItem(recentKey);renderContinue()};
document.querySelectorAll("[data-sort]").forEach(b=>b.onclick=()=>{sort=b.dataset.sort;document.querySelectorAll("[data-sort]").forEach(x=>x.classList.toggle("active",x===b));renderEpisodes()});
$("#clearFilter").onclick=()=>{genre="All";renderGenres();renderShows();renderEpisodes()};
$("#sortEpisodes").onclick=()=>{sort=sort==="latest"?"alpha":"latest";document.querySelectorAll("[data-sort]").forEach(x=>x.classList.toggle("active",x.dataset.sort===sort));renderEpisodes()};
$("#allShows").onclick=()=>{genre="All";renderGenres();renderShows();renderEpisodes();document.getElementById("shows")?.scrollIntoView({behavior:"smooth"})};
$("#searchOpen").onclick=()=>{$("#modal").classList.add("open");$("#search").focus()};
$("#searchClose").onclick=()=>$("#modal").classList.remove("open");
$("#modal").onclick=e=>{if(e.target.id==="modal")$("#modal").classList.remove("open")};
$("#search").oninput=e=>{const q=e.target.value.toLowerCase().trim();const r=q?[...shows.map(s=>({t:s.name,d:s.desc})),...eps.map(x=>({t:x.title,d:x.show+" — "+x.desc}))].filter(x=>(x.t+" "+x.d).toLowerCase().includes(q)):[];$("#results").innerHTML=r.slice(0,10).map(x=>'<div class="result"><b>'+esc(x.t)+'</b><small>'+esc(x.d)+'</small></div>').join("")};
$("#signup").onsubmit=e=>{e.preventDefault();$("#msg").textContent="SIGNAL RECEIVED — WELCOME TO THE NETWORK.";e.target.reset()};
async function boot(){if(!window.supabase){await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";s.onload=res;s.onerror=rej;document.head.appendChild(s)})}await loadCatalog();renderGenres();renderShows();renderEpisodes();renderContinue()}
boot().catch(error=>{console.error("[CrowRules Catalog]",error);shows=fallbackShows;eps=fallbackEps;renderGenres();renderShows();renderEpisodes();renderContinue()});
})();