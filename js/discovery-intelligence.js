/* CrowRules Podcasting — Personalization Engine 4.0 */
(function () {
  "use strict";
  const db=window.supabase.createClient(window.CROWRULES_SUPABASE_URL,window.CROWRULES_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=s=>document.querySelector(s), esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])), norm=v=>String(v??"").toLowerCase().trim();
  const ago=d=>d?Math.max(0,(Date.now()-new Date(d).getTime())/86400000):9999;
  const art=(u,l)=>u?'<img src="'+esc(u)+'" alt="" loading="lazy">':'<span>'+esc((l||"CR").slice(0,2).toUpperCase())+'</span>';
  const state={podcasts:[],episodes:[],creators:[],user:null,followed:new Set(),saved:new Set(),history:new Set(),categories:new Map(),creatorIds:new Set()};
  function score(p,personal=false){
    let s=Number(p.total_plays||0)/1000+Number(p.listener_count||0)*.5;
    s+=Math.max(0,45-ago(p.updated_at||p.created_at))*1.5;
    if(p.is_featured)s+=18;if(p.is_live)s+=10;
    if(personal){if(state.categories.has(norm(p.category)))s+=55;if(state.followed.has(p.id))s+=90;if(state.creatorIds.has(p.creator_id))s+=45}
    return s;
  }
  function card(p,badge){
    return '<article class="di-card"><div class="di-art">'+art(p.artwork_url,p.title)+'<span class="di-badge">'+esc(badge||"PODCAST")+'</span></div><div class="di-body"><div class="di-type">PODCAST</div><h3>'+esc(p.title||"Untitled Podcast")+'</h3><p>'+esc(p.description||"Discover this CrowRules podcast.")+'</p><small>'+esc([p.category,Number(p.listener_count||0).toLocaleString()+" listeners",Number(p.total_plays||0).toLocaleString()+" plays"].filter(Boolean).join(" · "))+'</small><a class="di-link" href="podcast.html?slug='+encodeURIComponent(p.slug||p.id)+'">Open Podcast →</a></div></article>';
  }
  function episode(e){
    return '<article class="di-card"><div class="di-art">'+art(e.thumbnail_url,e.title)+'<span class="di-badge">NEW</span></div><div class="di-body"><div class="di-type">EPISODE</div><h3>'+esc(e.title||"Untitled Episode")+'</h3><p>Episode '+esc(e.episode_number||"")+'</p><small>'+esc(e.published_at?new Date(e.published_at).toLocaleDateString():"Recently published")+'</small><a class="di-link" href="episode.html?id='+encodeURIComponent(e.id)+'">Listen →</a></div></article>';
  }
  function creator(c){return '<article class="di-creator"><div class="di-avatar">'+art(c.avatar_url,c.name)+'</div><div><div class="di-type">CREATOR</div><h3>'+esc(c.name||"CrowRules Creator")+'</h3><p>'+esc([c.role,c.discipline].filter(Boolean).join(" · ")||"Podcast creator")+'</p><a class="di-link" href="creators.html#creator-'+encodeURIComponent(c.slug||c.id)+'">View Creator →</a></div></article>'}
  function render(id,html,count){const e=$("#"+id);e.innerHTML=html||'<div class="di-empty">No items are available in this section yet.</div>';const c=e.parentElement.querySelector(".di-count");if(c)c.textContent=count+" available";}
  function rankCategories(episodes,podcasts){
    const byId=new Map(podcasts.map(p=>[p.id,p]));episodes.forEach(e=>{const p=byId.get(e.podcast_id);if(p?.category)state.categories.set(norm(p.category),(state.categories.get(norm(p.category))||0)+1)});
  }
  async function personalSignals(){
    const {data:{user}}=await db.auth.getUser();state.user=user;
    if(!user)return;
    const [f,s,l,p,cf]=await Promise.all([
      db.from("podcast_follows").select("podcast_id").eq("user_id",user.id).limit(500),
      db.from("podcast_saved_episodes").select("episode_id").eq("user_id",user.id).limit(500),
      db.from("podcast_listens").select("episode_id").eq("user_id",user.id).order("created_at",{ascending:false}).limit(500),
      db.from("podcast_episode_progress").select("episode_id").eq("user_id",user.id).order("last_played_at",{ascending:false}).limit(500),
      db.from("podcast_member_follows").select("followed_user_id").eq("follower_user_id",user.id).limit(500)
    ]);
    (f.data||[]).forEach(x=>state.followed.add(x.podcast_id));
    (s.data||[]).forEach(x=>state.saved.add(x.episode_id));
    const hist=[...(l.data||[]),...(p.data||[])];hist.forEach(x=>state.history.add(x.episode_id));
    const followedUsers=(cf.data||[]).map(x=>x.followed_user_id).filter(Boolean);
    if(followedUsers.length) state.creators=new Set(followedUsers);
    const ids=[...state.history,...state.saved];
    if(ids.length){
      const er=await db.from("podcast_episodes").select("id,podcast_id").in("id",ids.slice(0,500));
      const pids=[...(er.data||[])].map(x=>x.podcast_id).filter(Boolean);
      if(pids.length){
        const pr=await db.from("podcasts").select("id,category,creator_id").in("id",[...new Set(pids)].slice(0,500));
        (pr.data||[]).forEach(x=>{if(x.category)state.categories.set(norm(x.category),(state.categories.get(norm(x.category))||0)+1);if(x.creator_id)state.creatorIds.add(x.creator_id)});
      }
    }
  }
  async function load(){
    const [p,e,c]=await Promise.all([
      db.from("podcasts").select("id,creator_id,title,slug,category,description,artwork_url,status,is_featured,is_live,listener_count,total_plays,created_at,updated_at").in("status",["active","published","live"]).limit(300),
      db.from("podcast_episodes").select("id,podcast_id,title,episode_number,published_at,thumbnail_url,status").in("status",["published","public","live"]).order("published_at",{ascending:false}).limit(60),
      db.from("creators").select("id,name,slug,role,discipline,bio,avatar_url,is_active,is_featured,created_at,updated_at").eq("is_active",true).limit(150)
    ]);
    if(p.error||e.error||c.error)throw(p.error||e.error||c.error);
    state.podcasts=p.data||[];state.episodes=e.data||[];state.creators=c.data||[];
    rankCategories(state.episodes,state.podcasts);await personalSignals();
    const trending=[...state.podcasts].sort((a,b)=>score(b)-score(a)).slice(0,6);
    const featured=[...state.podcasts].filter(x=>x.is_featured||x.is_live).sort((a,b)=>score(b)-score(a)).slice(0,6);
    const newest=state.episodes.slice(0,6);
    const creators=[...state.creators].sort((a,b)=>(b.is_featured-a.is_featured)||((b.podcast_count||0)-(a.podcast_count||0))).slice(0,6);
    const rec=[...state.podcasts].map(p=>({p,s:score(p,true)})).sort((a,b)=>b.s-a.s).slice(0,6).map(x=>x.p);
    render("trending",trending.map(x=>card(x,"TRENDING")).join(""),trending.length);
    render("featured",featured.map(x=>card(x,x.is_live?"LIVE":"FEATURED")).join(""),featured.length);
    render("new-releases",newest.map(episode).join(""),newest.length);
    render("popular-creators",creators.map(creator).join(""),creators.length);
    render("recommended",rec.map(x=>card(x,state.user?"FOR YOU":"DISCOVER")).join(""),rec.length);
    $("#di-status").textContent=(state.user?"Personalized for your CrowRules account":"Public discovery mode")+" · "+state.podcasts.length+" podcasts · "+state.episodes.length+" episodes · "+state.creators.length+" creators";
    $("#recommendation-note").textContent=state.user?"Based on your follows, saved episodes, listening history, progress, categories, and creator connections.":"Sign in to activate account-based recommendations.";
    $("#account-link").textContent=state.user?"MY PROFILE":"SIGN IN";$("#account-link").href=state.user?"profile.html":"login.html?next="+encodeURIComponent("discover.html");
  }
  $("#discovery-search").addEventListener("submit",e=>{e.preventDefault();const q=$("#discovery-query").value.trim();if(q)location.href="search.html?q="+encodeURIComponent(q)});
  $("#discovery-category").addEventListener("change",function(){if(this.value)location.href="search.html?type=podcast&category="+encodeURIComponent(this.value)});
  load().catch(e=>{$("#di-status").textContent="Discovery intelligence is temporarily unavailable.";console.error(e);["trending","featured","new-releases","popular-creators","recommended"].forEach(id=>render(id,"",0))});
})();