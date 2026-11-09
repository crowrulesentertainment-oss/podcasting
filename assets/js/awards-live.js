import{sb}from"./client.js";import{SITE_BASE}from"./config.js";
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const seasonSelect=$("#seasonSelect"),categorySelect=$("#categorySelect"),grid=$("#nomineeGrid"),notice=$("#votingNotice"),voteStatus=$("#voteStatus");
let seasons=[],activeSeason=null,nominees=[],user=null,selectedCategory="",votingOpen=false,votedNominees=new Set(),refreshTimer=null;
function say(message,type=""){notice.textContent=message;notice.className="notice"+(type?" "+type:"")}
function isVotingOpen(s){const now=Date.now(),start=s?.voting_open_at?new Date(s.voting_open_at).getTime():null,end=s?.voting_close_at?new Date(s.voting_close_at).getTime():null;return !!s?.voting_open&&(start===null||now>=start)&&(end===null||now<end)}
function updateStatus(){votingOpen=isVotingOpen(activeSeason);voteStatus.querySelector("span").textContent=votingOpen?"LIVE VOTING IS OPEN":"VOTING WINDOW CLOSED";$("#broadcastState").textContent=votingOpen?"COMMUNITY VOTING OPEN":"AWARDS BROADCAST";$("#seasonLabel").textContent=activeSeason?.title||"AWARDS SEASON"}
function render(){
 const rows=nominees.filter(n=>!selectedCategory||n.category===selectedCategory);$("#nomineeCount").textContent=rows.length.toString().padStart(2,"0");
 grid.innerHTML=rows.length?rows.map(n=>'<article class="nominee-card"><div class="nominee-art"><span class="nominee-category">'+esc(n.category)+'</span></div><div class="nominee-body"><h3>'+esc(n.nominee)+'</h3><p>'+esc(n.description||"Official CrowRules Awards nominee")+'</p><button class="vote-button '+(votedNominees.has(n.id)?"voted":"")+'" data-id="'+esc(n.id)+'" '+(!user||!votingOpen||votedNominees.has(n.id)?"disabled":"")+'>'+(votedNominees.has(n.id)?"✓ VOTE RECORDED":!user?"SIGN IN TO VOTE":!votingOpen?"VOTING CLOSED":"CAST YOUR VOTE")+'</button></div></article>').join(""):'<div class="empty-card">No official nominees are listed for this category yet. Choose another category or check back soon.</div>';
 grid.querySelectorAll(".vote-button:not(:disabled)").forEach(button=>button.addEventListener("click",()=>castVote(button)));
}
async function castVote(button){const nomineeId=button.dataset.id;if(!user){location.href=SITE_BASE+"login.html?next=awards-live.html";return}if(!activeSeason||!votingOpen)return;button.disabled=true;button.textContent="SUBMITTING…";try{const{data,error}=await sb.rpc("crowrules_cast_award_vote",{p_season_id:activeSeason.id,p_nominee_id:nomineeId});if(error)throw error;votedNominees.add(nomineeId);button.classList.add("voted");button.textContent="✓ VOTE RECORDED";say(typeof data==="string"?data:"Your vote has been securely recorded. Thank you for taking part.","good");render()}catch(error){say(error.message||"Your vote could not be recorded. Please try again.","error");button.disabled=false;button.textContent="CAST YOUR VOTE"}}
async function loadSeason(){activeSeason=seasons.find(s=>s.id===seasonSelect.value)||null;if(!activeSeason)return;selectedCategory=categorySelect.value="";say("Loading official nominees…");grid.innerHTML='<div class="loading-card">The spotlight is getting ready…</div>';const{data,error}=await sb.from("crowrules_award_nominees").select("id,category,nominee,description,published").eq("season_id",activeSeason.id).eq("published",true).order("category").order("nominee");if(error)throw error;nominees=data||[];const cats=[...new Set(nominees.map(n=>n.category))];categorySelect.innerHTML='<option value="">All award categories</option>'+cats.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join("");updateStatus();render();if(!votingOpen)say(activeSeason.announcement_voting||"Voting is not open at this time. You can explore the official nominees while you wait.");else say(user?"Voting is live. Select one nominee in each category and cast your vote.":"Voting is live. Sign in to cast your official community vote.");}
async function init(){try{const[{data:seasonRows,error:seasonError},{data:userData,error:userError}]=await Promise.all([sb.from("crowrules_award_seasons").select("id,slug,title,voting_open,voting_open_at,voting_close_at,announcement_voting,results_public").order("created_at",{ascending:false}),sb.auth.getUser()]);if(seasonError)throw seasonError;if(userError)throw userError;seasons=seasonRows||[];user=userData.user||null;$("#accountLink").textContent=user?"My account":"Sign in";$("#accountLink").href=SITE_BASE+(user?"account.html":"login.html");if(!seasons.length){seasonSelect.innerHTML='<option value="">No published award seasons</option>';say("The Awards team has not published a season yet. The live stage is ready for the next ceremony.");grid.innerHTML='<div class="empty-card">The next CrowRules Awards season will appear here when it is announced.</div>';return}seasonSelect.innerHTML=seasons.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.title)+'</option>').join("");const params=new URLSearchParams(location.search),video=params.get("video");if(video&&/^[\w-]{11}$/.test(video))$("#videoFrame").innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+encodeURIComponent(video)+'?autoplay=0&rel=0" title="CrowRules Awards live broadcast" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';seasonSelect.addEventListener("change",()=>loadSeason().catch(e=>say(e.message,"error")));categorySelect.addEventListener("change",()=>{selectedCategory=categorySelect.value;render()});await loadSeason();refreshTimer=setInterval(async()=>{try{const{data,error}=await sb.from("crowrules_award_seasons").select("id,slug,title,voting_open,voting_open_at,voting_close_at,announcement_voting,results_public").order("created_at",{ascending:false});if(error)throw error;seasons=data||[];const current=seasons.find(s=>s.id===activeSeason?.id);if(current){const wasOpen=votingOpen;activeSeason=current;updateStatus();if(isVotingOpen(current)!==wasOpen)await loadSeason()} }catch(e){console.warn("Awards live refresh:",e.message)}},15000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)loadSeason().catch(e=>say(e.message,"error"))});window.addEventListener("pagehide",()=>clearInterval(refreshTimer),{once:true});}catch(error){console.error(error);voteStatus.querySelector("span").textContent="CONNECTION ISSUE";say("Live awards could not connect: "+(error.message||"Please refresh and try again."),"error");grid.innerHTML='<div class="empty-card">Please refresh the page to reconnect to live voting.</div>'}}
init();

async function initLivePolls(){
 const list=$("#livePollList"),connection=$("#pollConnection");if(!list||!connection)return;
 let currentUser=null,myVotes=new Map(),pollCache=[];
 const note=(msg)=>{connection.textContent=msg};
 const load=async()=>{
  try{
   const[{data:polls,error:pe},{data:userData}]=await Promise.all([
    sb.from("crowrules_award_live_polls").select("id,season_id,question,description,status,results_visible,starts_at,ends_at,created_at").eq("status","active").order("created_at",{ascending:false}),
    sb.auth.getUser()
   ]);
   if(pe)throw pe;currentUser=userData?.user||null;
   if(currentUser){const{data:mine,error:me}=await sb.rpc("crowrules_get_my_award_live_poll_votes");if(me)throw me;myVotes=new Map((mine||[]).map(v=>[v.poll_id,v.option_id]))}
   pollCache=polls||[];
   if(!pollCache.length){list.innerHTML='<div class="poll-empty">The host has not launched a live audience poll yet. Stay with the ceremony — the next question will appear here automatically.</div>';note("CONNECTED · WAITING FOR THE HOST");return}
   const ids=pollCache.map(p=>p.id);
   const{data:options,error:oe}=await sb.from("crowrules_award_live_poll_options").select("id,poll_id,label,sort_order").in("poll_id",ids).order("sort_order");
   if(oe)throw oe;
   const resultsByPoll=new Map();
   for(const p of pollCache){if(p.results_visible){const{data,error}=await sb.rpc("crowrules_get_award_live_poll_results",{p_poll_id:p.id});if(!error)resultsByPoll.set(p.id,data||[])}}
   list.innerHTML=pollCache.map(p=>{
    const opts=(options||[]).filter(o=>o.poll_id===p.id),voted=myVotes.has(p.id),resultRows=resultsByPoll.get(p.id)||[],total=resultRows.reduce((a,x)=>a+Number(x.votes||0),0),resultMap=new Map(resultRows.map(x=>[x.option_id,Number(x.votes||0)])),closed=(p.ends_at&&Date.now()>=new Date(p.ends_at).getTime()),started=(!p.starts_at||Date.now()>=new Date(p.starts_at).getTime()),canVote=!!currentUser&&!voted&&!closed&&started;
    return '<article class="live-poll-card"><div class="poll-card-top"><span class="poll-live-tag"><i></i>'+(closed?"POLL CLOSED":"LIVE CEREMONY POLL")+'</span><span class="poll-meta">'+(p.ends_at?"CLOSES "+new Date(p.ends_at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):"HOST CONTROLLED")+'</span></div><h3>'+esc(p.question)+'</h3><p>'+esc(p.description||"Cast your response while the ceremony is live.")+'</p><div class="poll-options">'+opts.map(o=>{const count=resultMap.get(o.id)||0,pct=total?Math.round(count/total*100):0,show=p.results_visible;return '<button class="poll-option '+(myVotes.get(p.id)===o.id?"selected":"")+'" data-live-poll="'+p.id+'" data-live-option="'+o.id+'" '+(!canVote?"disabled":"")+'>'+(show?'<span class="poll-result-fill" style="width:'+pct+'%"></span>':"")+'<span class="poll-option-label">'+esc(o.label)+'</span>'+(show?'<span class="poll-percent">'+pct+'%</span>':"")+'</button>'}).join("")+'</div><div class="poll-lock-note '+(voted?"poll-voted-note":"")+'">'+(voted?"✓ Your response has been recorded.":!currentUser?"Sign in to participate in this live poll.":closed?"This poll is closed.":!started?"This poll has not started yet.":p.results_visible?"Results are updating as the audience votes.":"Your vote is private until the host reveals the results.")+'</div>'+(p.results_visible?'<div class="poll-count">'+total+' COMMUNITY RESPONSES</div>':'<div class="poll-host-note">RESULTS HELD UNTIL THE HOST REVEALS THEM</div>')+'</article>';
   }).join("");
   list.querySelectorAll("[data-live-poll]:not(:disabled)").forEach(btn=>btn.addEventListener("click",async()=>{
    const pollId=btn.dataset.livePoll,optionId=btn.dataset.liveOption;if(!currentUser){location.href=SITE_BASE+"login.html?next=awards-live.html#ceremonyPolls";return}
    list.querySelectorAll('[data-live-poll="'+pollId+'"]').forEach(b=>b.disabled=true);
    try{const{error}=await sb.rpc("crowrules_cast_award_live_poll_vote",{p_poll_id:pollId,p_option_id:optionId});if(error)throw error;myVotes.set(pollId,optionId);await load()}catch(e){note(e.message||"Vote could not be recorded.");await load()}
   }));
   note("CONNECTED · LIVE POLLS REFRESHING");
  }catch(e){console.error("Live poll refresh:",e);note("POLL CONNECTION ISSUE");list.innerHTML='<div class="poll-empty">Live polls are temporarily unavailable. Please refresh the page shortly.</div>'}
 };
 await load();
 const channel=sb.channel("crowrules-awards-live-polls")
  .on("postgres_changes",{event:"*",schema:"public",table:"crowrules_award_live_polls"},()=>load())
  .on("postgres_changes",{event:"*",schema:"public",table:"crowrules_award_live_poll_options"},()=>load())
  .subscribe();
 const timer=setInterval(load,6000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)load()});
 window.addEventListener("pagehide",()=>{clearInterval(timer);sb.removeChannel(channel)},{once:true});
}
initLivePolls();
