(()=>{"use strict";
const $=s=>document.querySelector(s),grid=$("#showGrid"),status=$("#networkStatus"),search=$("#searchInput"),filter=$("#categoryFilter"),sort=$("#sortFilter"),empty=$("#emptyState"),more=$("#loadMore"),count=$("#resultCount"),cfg=window.CROW_CONFIG||{};
const PAGE_SIZE=24;
let shows=[],categories=[],offset=0,hasMore=true,loading=false,client=window.CrowRulesSupabase||null,loadError=false;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fallback="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=900&q=80";
if(!client&&window.supabase?.createClient&&cfg.supabaseUrl&&cfg.supabaseKey)client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
function card(s){
 const title=esc(s.title||"Untitled podcast"),art=esc(s.artwork_url||fallback),category=esc(s.category||"Podcast"),description=esc(s.description||"Discover this show on CrowRules Podcasting."),creator=esc(s.author_name||"CrowRules Creator");
 const plays=Number(s.total_plays)||0;
 return '<article class="dn-show-card"><div class="dn-show-art"><img loading="lazy" decoding="async" src="'+art+'" alt="">'+(s.is_featured?'<span class="dn-featured">FEATURED</span>':"")+'</div><div class="dn-show-copy"><h3>'+title+'</h3><p>'+description+'</p><div class="dn-show-meta"><span>'+category+'</span><span>'+creator+'</span></div><div class="dn-show-meta dn-play-meta"><span>'+plays.toLocaleString()+' PLAYS</span><span>'+(s.is_live?"LIVE":"ON DEMAND")+'</span></div><a class="dn-show-open" href="listener/show.html?id='+encodeURIComponent(s.id)+'">OPEN SHOW →</a></div></article>';
}
function visibleShows(){
 const q=search.value.trim().toLowerCase(),cat=filter.value;
 return shows.filter(s=>(!cat||s.category===cat)&&(!q||[s.title,s.description,s.category,s.author_name].some(v=>String(v||"").toLowerCase().includes(q))));
}
function render(){
 const filtered=visibleShows(),mode=sort.value;
 filtered.sort((a,b)=>{
  if(mode==="newest")return new Date(b.published_at||0)-new Date(a.published_at||0);
  if(mode==="popular")return (Number(b.total_plays)||0)-(Number(a.total_plays)||0);
  if(mode==="az")return String(a.title||"").localeCompare(String(b.title||""));
  return Number(!!b.is_featured)-Number(!!a.is_featured)||(Number(b.total_plays)||0)-(Number(a.total_plays)||0);
 });
 grid.innerHTML=filtered.map(card).join("");
 grid.querySelectorAll("img").forEach(img=>img.addEventListener("error",()=>{img.src=fallback},{once:true}));
 empty.hidden=filtered.length>0;
 if(!filtered.length&&shows.length){empty.querySelector("strong").textContent="No matching shows.";empty.querySelector("span").textContent="Try a different search or category.";}
 else if(!shows.length&&!loading){empty.querySelector("strong").textContent="The next great show starts here.";empty.querySelector("span").textContent="Creator applications are open. Be among the voices that shape the network.";}
 count.textContent=shows.length?("SHOWING "+filtered.length+" OF "+shows.length+" LOADED"):"";
 status.textContent=loadError?"Some catalog results could not be loaded. Please try again.":shows.length?(hasMore?"Explore the network — more shows are available below.":"You've reached the end of the catalog."):"";
 more.hidden=!hasMore||loadError;
 more.disabled=loading;
 more.textContent=loading?"LOADING SHOWS…":"LOAD MORE SHOWS ↓";
}
function setStatus(message){status.textContent=message;}
function sortQuery(q){
 if(sort.value==="newest")return q.order("published_at",{ascending:false,nullsFirst:false}).order("id",{ascending:true});
 if(sort.value==="popular")return q.order("total_plays",{ascending:false,nullsFirst:false}).order("published_at",{ascending:false,nullsFirst:false});
 if(sort.value==="az")return q.order("title",{ascending:true}).order("id",{ascending:true});
 return q.order("is_featured",{ascending:false}).order("total_plays",{ascending:false,nullsFirst:false}).order("published_at",{ascending:false,nullsFirst:false});
}
async function loadPage(reset){
 if(loading)return;
 if(reset){offset=0;shows=[];hasMore=true;loadError=false;grid.innerHTML='<article class="dn-skeleton"></article><article class="dn-skeleton"></article><article class="dn-skeleton"></article>';more.hidden=true;}
 if(!client){setStatus("The podcast catalogue is temporarily unavailable. Please try again later.");grid.innerHTML="";return;}
 loading=true;more.disabled=true;more.hidden=false;more.textContent="LOADING SHOWS…";
 try{
  let q=client.from("podcasts").select("id,title,slug,category,description,artwork_url,author_name,is_featured,is_live,total_plays,listener_count,published_at").eq("status","published");
  if(filter.value)q=q.eq("category",filter.value);
  const term=search.value.trim().replace(/[^a-zA-Z0-9\s'-]/g," ").replace(/\s+/g," ").trim();
  if(term){const pattern="%"+term+"%";q=q.or("title.ilike."+pattern+",description.ilike."+pattern+",author_name.ilike."+pattern);}
  q=sortQuery(q).range(offset,offset+PAGE_SIZE-1);
  const {data,error}=await q;if(error)throw error;
  const rows=data||[];shows=reset?rows:shows.concat(rows);offset+=rows.length;hasMore=rows.length===PAGE_SIZE;
  loadError=false;render();
 }catch(err){console.error("[CrowRules Discover]",err);loadError=true;setStatus("We couldn't load the catalog. Please refresh in a moment.");if(!shows.length)grid.innerHTML="";more.hidden=false;more.textContent="RETRY LOADING";}
 finally{loading=false;more.disabled=false;if(!loadError)render();}
}
async function loadCategories(){
 try{
  const {data,error}=await client.from("podcast_categories").select("name,slug").eq("is_active",true).order("sort_order",{ascending:true}).limit(100);
  if(error)throw error;categories=data||[];
  const selected=new URLSearchParams(location.search).get("category")||"";
  categories.forEach(c=>{const o=document.createElement("option");o.value=c.name;o.textContent=c.name;filter.appendChild(o);});
  if(selected){const match=categories.find(c=>c.name.toLowerCase()===selected.toLowerCase()||c.slug?.toLowerCase()===selected.toLowerCase());if(match)filter.value=match.name;}
 }catch(err){console.warn("[CrowRules Discover] Categories unavailable",err);}
}
function updateUrl(){
 const params=new URLSearchParams(location.search);
 if(filter.value){const item=categories.find(c=>c.name===filter.value);params.set("category",item?.slug||filter.value);}else params.delete("category");
 if(search.value.trim())params.set("q",search.value.trim());else params.delete("q");
 const query=params.toString();history.replaceState(null,"",location.pathname+(query?"?"+query:"")+location.hash);
}
let searchTimer=null;
search.addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{updateUrl();loadPage(true);},280);});
filter.addEventListener("change",()=>{updateUrl();loadPage(true);});
sort.addEventListener("change",()=>loadPage(true));
more.addEventListener("click",()=>loadPage(false));
$("#year").textContent=new Date().getFullYear();
(async()=>{if(!client){await loadPage(true);return;}await loadCategories();const q=new URLSearchParams(location.search).get("q");if(q)search.value=q;await loadPage(true);})();
})();