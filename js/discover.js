(()=>{"use strict";
const $=s=>document.querySelector(s),grid=$("#showGrid"),status=$("#networkStatus"),search=$("#searchInput"),filter=$("#categoryFilter"),empty=$("#emptyState"),cfg=window.CROW_CONFIG||{};
let shows=[];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fallback="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=900&q=80";
let client=window.CrowRulesSupabase||null;
if(!client&&window.supabase?.createClient&&cfg.supabaseUrl&&cfg.supabaseKey)client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"},global:{headers:{"x-application-name":"crowrules-podcasting-discover"}}});
function card(s){
 const title=esc(s.title||"Untitled podcast"),art=esc(s.artwork_url||fallback),category=esc(s.category||"Podcast"),description=esc(s.description||"Discover this show on CrowRules Podcasting."),creator=esc(s.author_name||"CrowRules Creator");
 return '<article class="dn-show-card"><div class="dn-show-art"><img loading="lazy" src="'+art+'" alt="">'+(s.is_featured?'<span class="dn-featured">FEATURED</span>':"")+'</div><div class="dn-show-copy"><h3>'+title+'</h3><p>'+description+'</p><div class="dn-show-meta"><span>'+category+'</span><span>'+creator+'</span></div><a class="dn-show-open" href="listener/index.html">EXPLORE SHOW →</a></div></article>';
}
function render(){
 const q=search.value.trim().toLowerCase(),cat=filter.value;
 const filtered=shows.filter(s=>(!cat||s.category===cat)&&(!q||[s.title,s.description,s.category,s.author_name].some(v=>String(v||"").toLowerCase().includes(q))));
 grid.innerHTML=filtered.map(card).join("");
 grid.querySelectorAll("img").forEach(img=>img.addEventListener("error",()=>{img.src=fallback},{once:true}));
 empty.hidden=filtered.length>0;
 status.textContent=shows.length?filtered.length+" published show"+(filtered.length===1?"":"s")+" in the network":"No published shows are available yet.";
}
async function load(){
 if(!client){status.textContent="The podcast catalogue is temporarily unavailable. Please try again later.";grid.innerHTML="";return;}
 try{
  const [{data:rows,error},{data:categories}]=await Promise.all([
   client.from("podcasts").select("id,title,slug,category,description,artwork_url,author_name,is_featured,is_live,total_plays,listener_count,published_at").eq("status","published").order("is_featured",{ascending:false}).order("total_plays",{ascending:false}).limit(32),
   client.from("podcast_categories").select("name,slug").eq("is_active",true).order("sort_order",{ascending:true}).limit(40)
  ]);
  if(error)throw error;
  shows=rows||[];
  (categories||[]).forEach(c=>{const o=document.createElement("option");o.value=c.name;o.textContent=c.name;filter.appendChild(o);});
  if(!shows.length){grid.innerHTML="";status.textContent="The network catalogue is ready for its first published shows.";empty.hidden=false;empty.querySelector("strong").textContent="The next great show starts here.";empty.querySelector("span").textContent="Creator applications are open. Be among the voices that shape the network.";return;}
  render();
 }catch(err){console.error("[CrowRules Discover]",err);grid.innerHTML="";status.textContent="We couldn't load the catalogue right now. Please refresh in a moment.";}
}
search.addEventListener("input",render);filter.addEventListener("change",render);$("#year").textContent=new Date().getFullYear();load();
})();