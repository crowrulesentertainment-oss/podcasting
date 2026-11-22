import { sb } from "../../assets/js/client.js";
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const status=$("#vote-status"),select=$("#vote-challenge"),windowBox=$("#vote-window"),entriesBox=$("#vote-entries");
const say=(message,type="info")=>{status.textContent=message;status.dataset.type=type};
const fmt=value=>new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Los_Angeles"}).format(new Date(value))+" Pacific";
let challenges=[],user=null,currentVotes=[],selectedChallenge=null,busy=false;
const params=new URLSearchParams(location.search);
async function loadChallenges(){
 const {data,error}=await sb.from("podcast_monthly_challenges").select("id,title,slug,challenge_year,challenge_month,status,voting_opens_at,voting_closes_at,description").neq("status","draft").neq("status","archived").order("challenge_year").order("challenge_month");
 if(error)throw error;
 challenges=data||[];
 const now=Date.now();
 const relevant=challenges.filter(c=>new Date(c.voting_closes_at).getTime()>=now);
 const preferred=relevant.find(c=>c.slug===params.get("challenge"))||relevant.find(c=>now>=new Date(c.voting_opens_at).getTime()&&now<=new Date(c.voting_closes_at).getTime())||relevant[0]||challenges.at(-1);
 select.innerHTML=challenges.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.challenge_year+" · "+String(c.challenge_month).padStart(2,"0")+" · "+c.title)+'</option>').join("");
 if(preferred)select.value=preferred.id;
}
function windowState(challenge){
 const now=Date.now(),opens=new Date(challenge.voting_opens_at).getTime(),closes=new Date(challenge.voting_closes_at).getTime();
 const open=["published","voting"].includes(challenge.status)&&now>=opens&&now<=closes;
 const label=open?"Voting is OPEN.":now<opens?"Voting has not opened yet.":"Voting is CLOSED.";
 windowBox.dataset.open=String(open);
 windowBox.innerHTML="<strong>"+label+"</strong>"+esc(fmt(challenge.voting_opens_at))+" – "+esc(fmt(challenge.voting_closes_at));
 return open;
}
async function loadEntries(){
 selectedChallenge=challenges.find(c=>c.id===select.value)||null;
 if(!selectedChallenge){entriesBox.innerHTML='<div class="vote-empty">No challenges are currently available.</div>';say("There are no challenges to display.");return}
 const open=windowState(selectedChallenge);
 const auth=await sb.auth.getUser();
 if(auth.error)throw auth.error;
 user=auth.data.user;
 currentVotes=[];
 if(user){
  const mine=await sb.from("podcast_challenge_votes").select("id,submission_id,created_at").eq("challenge_id",selectedChallenge.id).eq("voter_user_id",user.id).maybeSingle();
  if(mine.error&&mine.error.code!=="PGRST116")throw mine.error;
  if(mine.data)currentVotes=[mine.data];
 }
 const {data,error}=await sb.from("podcast_challenge_submissions").select("id,challenge_id,episode_title,show_name,episode_url,creator_statement,media_type,thumbnail_url,published_at").eq("challenge_id",selectedChallenge.id).eq("status","approved").eq("public_display_consent",true).not("published_at","is",null).is("archived_at",null).order("published_at",{ascending:false});
 if(error)throw error;
 const rows=data||[];
 if(!rows.length){
  entriesBox.innerHTML='<div class="vote-empty"><b>No eligible entries are published yet.</b><p>Approved entries with public-display permission will appear here.</p></div>';
  say(open?"Voting is open. Approved entries will appear here when published.":"Voting schedule: "+(open?"open":"not open")+".");
  return;
 }
 const myVote=currentVotes[0],hasVoted=!!myVote;
 entriesBox.innerHTML=rows.map(entry=>{
  const chosen=myVote?.submission_id===entry.id;
  const art=entry.thumbnail_url?'<img src="'+esc(entry.thumbnail_url)+'" alt="'+esc(entry.episode_title)+' artwork" loading="lazy">':'<div class="no-art">CrowRules Creator Entry</div>';
  const media=entry.media_type==="audio"?"Audio episode":entry.media_type==="video"?"Video episode":entry.media_type==="written"?"Written work":"Creator submission";
  const link=entry.episode_url?'<a class="btn alt" href="'+esc(entry.episode_url)+'" target="_blank" rel="noopener">View original work ↗</a>':"";
  let voteControl="";
  if(!user)voteControl='<a class="btn" href="../../login.html?next='+encodeURIComponent(location.pathname+location.search)+'">Sign in to vote</a>';
  else if(chosen)voteControl='<span class="vote-chosen">✓ Your ballot</span>';
  else voteControl='<button class="btn" type="button" data-vote="'+esc(entry.id)+'" '+(!open||hasVoted||busy?"disabled":"")+'>Cast my vote</button>';
  return '<article class="vote-entry"><div class="vote-art">'+art+'</div><div class="vote-copy"><div class="vote-show">'+esc(entry.show_name)+" · "+esc(media)+'</div><h3>'+esc(entry.episode_title)+'</h3><p>'+esc(entry.creator_statement||"Original work submitted by a CrowRules creator.")+'</p><div class="vote-actions">'+link+voteControl+'</div></div></article>';
 }).join("");
 if(!user)say("Sign in with your CrowRules Podcasting account to cast a ballot.");
 else if(hasVoted)say("Your ballot has been recorded for this challenge. You can review the entries, but cannot cast another vote.");
 else if(!open)say("You can preview eligible entries. Ballot submission is enabled only during the published voting window.");
 else say("Choose the creator entry you want to support. You have one ballot for this challenge.");
 entriesBox.querySelectorAll("[data-vote]").forEach(button=>button.addEventListener("click",()=>castVote(button.dataset.vote,button)));
}
async function castVote(submissionId,button){
 if(!user){say("Sign in before voting.","error");return}
 if(busy||currentVotes.length)return;
 if(!windowState(selectedChallenge)){say("The voting window is not open.","error");return}
 if(!confirm("Cast your one vote for this creator entry? You cannot change your ballot after submission."))return;
 busy=true;button.disabled=true;button.textContent="Recording ballot…";
 try{
  const {error}=await sb.from("podcast_challenge_votes").insert({challenge_id:selectedChallenge.id,submission_id:submissionId,voter_user_id:user.id});
  if(error)throw error;
  say("Your vote has been securely recorded. Thank you for supporting the CrowRules creator community.","success");
  await loadEntries();
 }catch(error){
  if(error.code==="23505")say("A ballot has already been recorded for your account in this challenge.","error");
  else if(error.code==="42501")say("This ballot is not eligible. The voting window, entry approval, public permission or self-vote rules may prevent it.","error");
  else say("We could not record your ballot: "+(error.message||"Please try again."),"error");
  button.disabled=false;button.textContent="Cast my vote";
 }finally{busy=false}
}
select.addEventListener("change",()=>loadEntries().catch(error=>say("Could not load this challenge: "+error.message,"error")));
(async()=>{try{const auth=await sb.auth.getUser();if(auth.error)throw auth.error;user=auth.data.user;await loadChallenges();await loadEntries()}catch(error){console.error("Challenge voting load failed",error);say("Challenge voting could not be loaded: "+(error.message||"Please refresh."),"error");entriesBox.innerHTML='<div class="vote-empty">We could not load challenge voting. Please refresh the page.</div>'}})();
