import { sb } from "./client.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));
const dateLabel = value => value ? new Intl.DateTimeFormat("en-US", {
  month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit",
  timeZone:"America/Los_Angeles", timeZoneName:"short"
}).format(new Date(value)) : "To be announced";
const safeEpisodeUrl = value => {
  try { const url = new URL(String(value || "").trim()); return url.protocol === "https:" ? url.href : ""; }
  catch { return ""; }
};
const now = () => new Date();

export async function mountChallengeProgram() {
  const root = document.querySelector("#cr27-program");
  if (!root) return;

  if (!document.getElementById("cr27-program-styles")) {
    const style = document.createElement("style");
    style.id = "cr27-program-styles";
    style.textContent = `
      .cr27-live-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
      .cr27-live-card{border:1px solid #ffffff20;border-radius:17px;background:linear-gradient(145deg,#17181c,#0d0e11);padding:22px;min-width:0}
      .cr27-live-card h3{font-size:20px;margin:8px 0 10px}
      .cr27-live-card p{font-size:12px;color:#aaa69f;line-height:1.65}
      .cr27-live-card label{display:block;color:#d8c9a9;font-size:10px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;margin:14px 0 6px}
      .cr27-live-card input,.cr27-live-card select,.cr27-live-card textarea{width:100%;background:#090a0d;color:#f8f5ef;border:1px solid #ffffff2c;border-radius:10px;padding:12px;font:inherit;font-size:13px}
      .cr27-live-card textarea{min-height:92px;resize:vertical}
      .cr27-live-card input:focus,.cr27-live-card select:focus,.cr27-live-card textarea:focus{outline:2px solid #e7bd68;outline-offset:2px}
      .cr27-live-card button{margin-top:14px}
      .cr27-live-card button:disabled{opacity:.42;cursor:not-allowed;transform:none;box-shadow:none}
      .cr27-live-meta{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
      .cr27-live-chip{font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:6px 9px;border:1px solid #e7bd6840;color:#e7c77e;border-radius:99px}
      .cr27-live-notice{padding:13px 15px;border-radius:12px;background:#ffffff08;border:1px solid #ffffff1c;color:#c7c0b3;font-size:12px;line-height:1.6;margin-top:13px}
      .cr27-live-list{display:grid;gap:10px;margin-top:15px}
      .cr27-live-entry{padding:14px;border:1px solid #ffffff1c;background:#ffffff06;border-radius:12px}
      .cr27-live-entry h4{font-size:14px;margin:0 0 5px}
      .cr27-live-entry p{margin:4px 0}
      .cr27-live-entry a{color:#e7bd68;text-decoration:underline;font-size:11px}
      .cr27-live-entry .cr27-entry-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .cr27-live-entry .cr27-entry-actions button{margin-top:8px;padding:8px 12px;font-size:10px}
      .cr27-badge-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}
      .cr27-badge{border:1px solid #ffffff20;border-radius:13px;padding:13px;background:#ffffff06;text-align:center;min-width:0}
      .cr27-badge .emblem{font-size:27px}
      .cr27-badge strong{display:block;font-size:10px;margin:6px 0 4px}
      .cr27-badge small{display:block;color:#aaa69f;font-size:9px;line-height:1.4}
      .cr27-badge.earned{border-color:#e7bd6877;background:linear-gradient(145deg,#e7bd681c,#ffffff05)}
      .cr27-badge .badge-state{display:inline-block;margin-top:7px;color:#d7bd7e;font-size:8px;letter-spacing:.12em;text-transform:uppercase}
      .cr27-champion-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:15px}
      .cr27-champion{padding:17px;border:1px solid #e7bd6850;border-radius:14px;background:radial-gradient(ellipse at top right,#a8202b25,transparent 60%),#111216}
      .cr27-champion .crown{font-size:27px}
      .cr27-champion strong{display:block;margin:7px 0 4px;font-size:14px}
      .cr27-champion small{color:#b9b1a3;font-size:10px;line-height:1.5}
      .cr27-admin-panel{border:1px solid #a8202b77;background:#a8202b12;border-radius:17px;padding:20px;margin-top:18px}
      .cr27-admin-panel h3{margin:8px 0}
      .cr27-status-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#d7bd7e;margin-right:7px}
      .cr27-loading{color:#aaa69f;font-size:12px;padding:15px 0}
      @media(max-width:760px){.cr27-live-grid{grid-template-columns:1fr}.cr27-badge-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.cr27-champion-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:480px){.cr27-badge-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cr27-champion-grid{grid-template-columns:1fr}.cr27-live-card{padding:17px}}
    `;
    document.head.appendChild(style);
  }

  root.innerHTML = `
    <div class="cr27-wrap">
      <div class="cr27-section-head">
        <div><div class="cr27-kicker">THE LIVE CREATOR PROGRAM</div><h2>Enter. Be heard.<br>Earn your crown.</h2>
        <p class="cr27-lead">The challenge calendar is connected to CrowRules Podcasting. Sign in to submit an entry, vote during the official voting window, track your achievements and explore the Hall of Champions.</p></div>
      </div>
      <div class="cr27-live-grid">
        <section class="cr27-live-card" aria-labelledby="cr27-entry-title">
          <div class="cr27-kicker">01 / CREATOR SUBMISSIONS</div><h3 id="cr27-entry-title">Submit your monthly entry</h3>
          <div id="cr27-entry-area" class="cr27-loading">Connecting to the challenge program…</div>
        </section>
        <section class="cr27-live-card" aria-labelledby="cr27-vote-title">
          <div class="cr27-kicker">02 / COMMUNITY VOTING</div><h3 id="cr27-vote-title">Choose a community favorite</h3>
          <div id="cr27-vote-area" class="cr27-loading">Loading approved entries…</div>
        </section>
      </div>
      <section class="cr27-section" style="padding:45px 0 0">
        <div class="cr27-section-head"><div><div class="cr27-kicker">03 / YOUR CREATOR RECORD</div><h2>Badges & achievements.</h2><p class="cr27-lead">Approved participation earns a season badge. Monthly champions receive a permanent month-specific badge on their CrowRules Podcasting profile.</p></div></div>
        <div id="cr27-badge-area" class="cr27-loading">Loading the badge collection…</div>
      </section>
      <section class="cr27-section" style="padding:45px 0 0">
        <div class="cr27-section-head"><div><div class="cr27-kicker">04 / THE PERMANENT RECORD</div><h2>Hall of Champions.</h2><p class="cr27-lead">A year-round archive of verified monthly winners. Each published champion is recorded with their winning entry and creator profile.</p></div></div>
        <div id="cr27-hall-area" class="cr27-loading">Loading champion records…</div>
      </section>
      <section id="cr27-admin-area" style="display:none" class="cr27-section" aria-label="Challenge administration"></section>
    </div>`;

  const entryArea = document.querySelector("#cr27-entry-area");
  const voteArea = document.querySelector("#cr27-vote-area");
  const badgeArea = document.querySelector("#cr27-badge-area");
  const hallArea = document.querySelector("#cr27-hall-area");
  const adminArea = document.querySelector("#cr27-admin-area");

  const [userResult, challengeResult, badgeResult, hallResult] = await Promise.all([
    sb.auth.getUser(),
    sb.from("podcast_monthly_challenges").select("id,challenge_month,title,description,requirements,status,submission_opens_at,submission_closes_at,voting_opens_at,voting_closes_at").eq("challenge_year",2027).neq("status","draft").order("challenge_month"),
    sb.from("podcast_badge_catalog").select("badge_key,name,description,icon,category,display_order").eq("is_active",true).eq("category","Challenges").order("display_order"),
    sb.from("podcast_challenge_results").select("challenge_id,winning_submission_id,winner_user_id,valid_vote_count,announced_at").eq("is_published",true).eq("result_status","finalized")
  ]);

  const user = userResult.data?.user || null;
  if (challengeResult.error) {
    entryArea.innerHTML = '<div class="cr27-live-notice">The challenge calendar could not be reached. Please refresh later. ('+esc(challengeResult.error.message)+')</div>';
    voteArea.innerHTML = '<div class="cr27-live-notice">Voting information is temporarily unavailable.</div>';
    return;
  }
  const challenges = challengeResult.data || [];
  const challengeById = new Map(challenges.map(c => [c.id,c]));
  const current = now();
  const isOpen = (start,end) => start && end && current >= new Date(start) && current <= new Date(end);
  const nextSubmission = challenges.find(c => isOpen(c.submission_opens_at,c.submission_closes_at)) ||
    challenges.find(c => new Date(c.submission_opens_at) > current) || challenges[0];
  const votingChallenge = challenges.find(c => isOpen(c.voting_opens_at,c.voting_closes_at));
  const nextVoting = votingChallenge || challenges.find(c => new Date(c.voting_opens_at) > current);
  const monthName = month => new Date(2027,Number(month)-1,1).toLocaleString("en-US",{month:"long"});
  const submissionWindow = c => isOpen(c?.submission_opens_at,c?.submission_closes_at);
  const votingWindow = c => isOpen(c?.voting_opens_at,c?.voting_closes_at);

  let creatorMember = false;
  let mySubmissions = [];
  let myVotes = [];
  let ownBadges = [];
  let approvedEntries = [];
  let admin = false;
  let pendingSubmissions = [];
  if (user) {
    const [memberRes, ownRes, voteRes, badgeOwnRes, adminRes] = await Promise.all([
      sb.from("podcast_creators").select("id").eq("user_id",user.id).limit(1),
      sb.from("podcast_challenge_submissions").select("id,challenge_id,show_name,episode_title,episode_url,status,review_notes,submitted_at").eq("creator_user_id",user.id).order("submitted_at",{ascending:false}),
      sb.from("podcast_challenge_votes").select("challenge_id,submission_id").eq("voter_user_id",user.id),
      sb.from("podcast_badge_assignments").select("badge_key,awarded_at,note").eq("target_type","profile").eq("target_id",user.id).eq("is_public",true),
      sb.from("cr_admins").select("user_id,role,is_active").eq("user_id",user.id).eq("is_active",true).maybeSingle()
    ]);
    creatorMember = !memberRes.error && (memberRes.data || []).length > 0;
    mySubmissions = ownRes.data || [];
    myVotes = voteRes.data || [];
    ownBadges = badgeOwnRes.data || [];
    admin = !!adminRes.data?.is_active;
  }
  const approvedRes = await sb.from("podcast_challenge_submissions")
    .select("id,challenge_id,creator_user_id,show_name,episode_title,episode_url,creator_statement,status")
    .eq("status","approved").order("submitted_at",{ascending:true});
  approvedEntries = approvedRes.data || [];

  const existingForChallenge = c => mySubmissions.find(s => s.challenge_id === c?.id);
  const loginLink = '<a class="cr27-btn secondary" href="/podcasting/login.html">Sign in to participate ↗</a>';
  const signupLink = '<a class="cr27-btn secondary" href="/podcasting/signup.html">Create a creator account ↗</a>';

  function renderEntry() {
    if (!user) {
      entryArea.innerHTML = '<div class="cr27-live-notice">Sign in with your CrowRules Podcasting account to submit an original entry and track its review status.</div>'+loginLink;
      return;
    }
    if (!creatorMember) {
      entryArea.innerHTML = '<div class="cr27-live-notice">Your account is signed in, but it is not currently linked to a podcast creator profile. Set up your creator account before entering a monthly challenge.</div>'+signupLink;
      return;
    }
    if (!nextSubmission) {
      entryArea.innerHTML = '<div class="cr27-live-notice">The 2027 challenge schedule is being prepared. Check back soon.</div>';
      return;
    }
    const mine = existingForChallenge(nextSubmission);
    const open = submissionWindow(nextSubmission);
    const openText = open
      ? 'Entries close '+dateLabel(nextSubmission.submission_closes_at)+'.'
      : current < new Date(nextSubmission.submission_opens_at)
        ? 'Submissions open '+dateLabel(nextSubmission.submission_opens_at)+'.'
        : 'The submission window has closed for this month.';
    let myHtml = mySubmissions.length ? '<div class="cr27-live-list">'+mySubmissions.map(s=>{
      const ch=challengeById.get(s.challenge_id);
      return '<div class="cr27-live-entry"><h4>'+esc(s.episode_title)+'</h4><p>'+esc(ch?.title||"2027 Challenge")+' · '+esc(s.show_name)+' · <span class="cr27-live-chip">'+esc(s.status)+'</span></p>'+(s.review_notes?'<p>'+esc(s.review_notes)+'</p>':'')+'</div>';
    }).join("")+'</div>' : '<div class="cr27-live-notice">Your challenge entry history will appear here after you submit.</div>';
    entryArea.innerHTML = '<div class="cr27-live-meta"><span class="cr27-live-chip">'+esc(monthName(nextSubmission.challenge_month))+' 2027</span><span class="cr27-live-chip">'+(open?'Entries open':'Upcoming entry')+'</span></div><h4>'+esc(nextSubmission.title)+'</h4><p>'+esc(nextSubmission.description)+'</p><p><strong>Entry requirements:</strong> '+esc(nextSubmission.requirements)+'</p><div class="cr27-live-notice">'+esc(openText)+'</div>'+
      (mine ? '<div class="cr27-live-notice"><strong>Your entry:</strong> '+esc(mine.episode_title)+' · '+esc(mine.status)+'. One entry per creator is allowed for each monthly challenge.</div>' :
      '<form id="cr27-submit-form"><label for="cr27-show-name">Podcast / show name</label><input id="cr27-show-name" name="show_name" maxlength="120" required placeholder="Your show name"><label for="cr27-episode-title">Episode title</label><input id="cr27-episode-title" name="episode_title" maxlength="180" required placeholder="Title of your challenge episode"><label for="cr27-episode-url">Public episode link</label><input id="cr27-episode-url" name="episode_url" type="url" maxlength="1000" required placeholder="https://…"><label for="cr27-statement">Tell us how your entry fits the theme</label><textarea id="cr27-statement" name="creator_statement" maxlength="1200" placeholder="A short note for the review team"></textarea><button type="submit" '+(!open?'disabled':'')+'>Submit my challenge entry ↗</button><div class="cr27-feature-note">One original entry per creator per month. Entries begin as pending and appear in the public voting gallery only after approval.</div></form>')+
      '<div style="margin-top:22px"><div class="cr27-kicker">MY SUBMISSION HISTORY</div>'+myHtml+'</div>';
    const form=document.querySelector("#cr27-submit-form");
    form?.addEventListener("submit",async event=>{
      event.preventDefault();
      const data=new FormData(form);
      const url=safeEpisodeUrl(data.get("episode_url"));
      if(!url){alert("Please provide a valid public HTTPS episode link.");return;}
      const button=form.querySelector("button[type=submit]");
      button.disabled=true;button.textContent="Submitting…";
      const {error}=await sb.from("podcast_challenge_submissions").insert({
        challenge_id:nextSubmission.id,creator_user_id:user.id,
        show_name:String(data.get("show_name")||"").trim(),
        episode_title:String(data.get("episode_title")||"").trim(),
        episode_url:url,creator_statement:String(data.get("creator_statement")||"").trim()
      });
      if(error){alert(error.code==="23505"?"You already submitted an entry for this monthly challenge.":error.message);button.disabled=false;button.textContent="Submit my challenge entry ↗";return;}
      alert("Your entry has been submitted for review. You can track its status here.");
      await mountChallengeProgram();
    });
  }

  function renderVoting() {
    if (!votingChallenge) {
      voteArea.innerHTML = nextVoting
        ? '<div class="cr27-live-meta"><span class="cr27-live-chip">'+esc(monthName(nextVoting.challenge_month))+' 2027</span><span class="cr27-live-chip">Voting not open</span></div><h4>'+esc(nextVoting.title)+'</h4><div class="cr27-live-notice">Community voting opens '+esc(dateLabel(nextVoting.voting_opens_at))+' and closes '+esc(dateLabel(nextVoting.voting_closes_at))+'. Approved entries will appear here when voting opens.</div>'
        : '<div class="cr27-live-notice">The 2027 voting calendar will appear here when the challenge schedule is published.</div>';
      return;
    }
    const entries=approvedEntries.filter(s=>s.challenge_id===votingChallenge.id);
    const myVote=myVotes.find(v=>v.challenge_id===votingChallenge.id);
    voteArea.innerHTML='<div class="cr27-live-meta"><span class="cr27-live-chip">'+esc(monthName(votingChallenge.challenge_month))+' 2027</span><span class="cr27-live-chip">Voting is live</span></div><h4>'+esc(votingChallenge.title)+'</h4><p>Voting closes '+esc(dateLabel(votingChallenge.voting_closes_at))+'. Each signed-in member may cast one vote. Creators cannot vote for their own entry. Vote totals remain hidden until results are verified.</p>'+
      (myVote?'<div class="cr27-live-notice">Your vote has been recorded. Thank you for supporting a fellow creator.</div>':!user?'<div class="cr27-live-notice">Sign in to cast your one vote for this month.</div>'+loginLink:'')+
      (entries.length?'<div class="cr27-live-list">'+entries.map(s=>'<article class="cr27-live-entry"><h4>'+esc(s.episode_title)+'</h4><p>'+esc(s.show_name)+'</p><p>'+esc(s.creator_statement||"A CrowRules creator challenge entry.")+'</p><a href="'+esc(s.episode_url)+'" target="_blank" rel="noopener noreferrer">Listen / watch entry ↗</a><div class="cr27-entry-actions">'+(myVote?'':user?(s.creator_user_id===user.id?'<span class="cr27-feature-note">You cannot vote for your own entry.</span>':'<button type="button" data-vote-for="'+esc(s.id)+'">Vote for this entry</button>'):'')+'</div></article>').join("")+'</div>':'<div class="cr27-live-notice">No approved entries are available for voting yet. Check back when creators have submitted their episodes and reviews are complete.</div>');
    voteArea.querySelectorAll("[data-vote-for]").forEach(button=>button.addEventListener("click",async()=>{
      if(!user)return;
      if(!confirm("Cast your one vote for this monthly challenge? Votes cannot be changed."))return;
      button.disabled=true;button.textContent="Recording vote…";
      const {error}=await sb.from("podcast_challenge_votes").insert({
        challenge_id:votingChallenge.id,submission_id:button.dataset.voteFor,voter_user_id:user.id
      });
      if(error){alert(error.code==="23505"?"You have already voted in this challenge.":error.message);button.disabled=false;button.textContent="Vote for this entry";return;}
      alert("Your vote has been recorded.");
      await mountChallengeProgram();
    }));
  }

  async function renderBadges() {
    const catalog=badgeResult.data||[];
    if (!catalog.length) {
      badgeArea.innerHTML='<div class="cr27-live-notice">Challenge badges are being prepared.</div>';return;
    }
    const earned=new Set(ownBadges.map(b=>b.badge_key));
    badgeArea.innerHTML='<div class="cr27-live-meta"><span class="cr27-live-chip">'+earned.size+' earned</span><span class="cr27-live-chip">'+catalog.length+' in the collection</span></div><div class="cr27-badge-grid">'+catalog.map(b=>{
      const isEarned=earned.has(b.badge_key);
      return '<div class="cr27-badge '+(isEarned?'earned':'')+'"><div class="emblem">'+esc(b.icon||"🏅")+'</div><strong>'+esc(b.name)+'</strong><small>'+esc(b.description)+'</small><span class="badge-state">'+(isEarned?'Earned':'To be earned')+'</span></div>';
    }).join("")+'</div>'+(user?'':'<div class="cr27-live-notice">Sign in to see which challenge badges you have earned.</div>');
  }

  async function renderHall() {
    const results=hallResult.data||[];
    if(!results.length){
      hallArea.innerHTML='<div class="cr27-live-notice"><strong>The first crown is waiting.</strong><br>No champions have been announced yet. The Hall of Champions will permanently record each verified 2027 monthly winner.</div>';return;
    }
    const winnerIds=[...new Set(results.map(r=>r.winner_user_id).filter(Boolean))];
    let profiles=[];
    if(winnerIds.length){
      const profileRes=await sb.from("podcast_member_profiles").select("user_id,display_name,username,avatar_url").in("user_id",winnerIds).eq("is_public",true);
      profiles=profileRes.data||[];
    }
    const profileMap=new Map(profiles.map(p=>[p.user_id,p]));
    const submissionIds=results.map(r=>r.winning_submission_id).filter(Boolean);
    let entries=[];
    if(submissionIds.length){
      const entryRes=await sb.from("podcast_challenge_submissions").select("id,episode_title,show_name,episode_url").in("id",submissionIds);
      entries=entryRes.data||[];
    }
    const entryMap=new Map(entries.map(e=>[e.id,e]));
    hallArea.innerHTML='<div class="cr27-champion-grid">'+results.sort((a,b)=>(challengeById.get(a.challenge_id)?.challenge_month||0)-(challengeById.get(b.challenge_id)?.challenge_month||0)).map(r=>{
      const c=challengeById.get(r.challenge_id),p=profileMap.get(r.winner_user_id),e=entryMap.get(r.winning_submission_id);
      return '<article class="cr27-champion"><div class="crown">🏆</div><div class="cr27-kicker">'+esc(c?monthName(c.challenge_month).toUpperCase():"2027 CHAMPION")+' 2027</div><strong>'+(p?.username?'<a href="/podcasting/profile.html?username='+encodeURIComponent(p.username)+'">'+esc(p.display_name||p.username)+'</a>':esc(p?.display_name||"CrowRules Creator"))+'</strong><small>'+esc(c?.title||"Monthly Challenge")+(e?' · '+esc(e.episode_title):'')+'</small>'+(e?.episode_url?'<p><a href="'+esc(e.episode_url)+'" target="_blank" rel="noopener noreferrer">Watch the winning entry ↗</a></p>':'')+'<div class="cr27-live-chip">Verified champion</div></article>';
    }).join("")+'</div>';
  }

  async function renderAdmin() {
    if(!admin)return;
    adminArea.style.display="block";
    const [pendingRes, allSubRes] = await Promise.all([
      sb.from("podcast_challenge_submissions").select("id,challenge_id,creator_user_id,show_name,episode_title,episode_url,creator_statement,submitted_at").eq("status","pending").order("submitted_at"),
      sb.from("podcast_challenge_submissions").select("id,challenge_id,creator_user_id,show_name,episode_title,episode_url,status").order("submitted_at")
    ]);
    pendingSubmissions=pendingRes.data||[];
    const allSubmissions=allSubRes.data||[];
    const publishedResultIds=new Set((hallResult.data||[]).map(r=>r.challenge_id));
    const reviewHtml=pendingSubmissions.length?pendingSubmissions.map(s=>{
      const c=challengeById.get(s.challenge_id);
      return '<article class="cr27-live-entry"><h4>'+esc(s.episode_title)+'</h4><p>'+esc(s.show_name)+' · '+esc(c?.title||"Challenge")+'</p><a href="'+esc(s.episode_url)+'" target="_blank" rel="noopener noreferrer">Open submitted episode ↗</a><div class="cr27-entry-actions"><button type="button" data-review="'+esc(s.id)+'" data-status="approved">Approve entry</button><button type="button" class="secondary" data-review="'+esc(s.id)+'" data-status="rejected">Reject entry</button></div></article>';
    }).join(""):'<div class="cr27-live-notice">No submissions are waiting for review.</div>';
    const readyChallenges=challenges.filter(c=>new Date(c.voting_closes_at)<current&&!publishedResultIds.has(c.id));
    const finalizeHtml=readyChallenges.map(c=>{
      const entries=allSubmissions.filter(s=>s.challenge_id===c.id&&s.status==="approved");
      return '<div class="cr27-live-entry"><h4>'+esc(c.title)+'</h4><div data-finalize-list="'+esc(c.id)+'" class="cr27-loading">Calculating verified vote totals…</div></div>';
    }).join("");
    adminArea.innerHTML='<div class="cr27-admin-panel"><div class="cr27-kicker">ADMINISTRATION / RESTRICTED</div><h3>Challenge review & results desk</h3><p>Only active CrowRules administrators can see and use these controls. Approving an entry grants the participant badge. Publishing a verified champion grants that month’s permanent champion badge.</p><h4>Pending entry review</h4><div class="cr27-live-list">'+reviewHtml+'</div><h4 style="margin-top:22px">Finalize completed challenges</h4><div class="cr27-live-list">'+(finalizeHtml||'<div class="cr27-live-notice">No completed voting windows are waiting for a result.</div>')+'</div></div>';
    adminArea.querySelectorAll("[data-review]").forEach(button=>button.addEventListener("click",async()=>{
      const status=button.dataset.status;
      const note=status==="approved"?"Approved for the 2027 community voting gallery.":"Not approved for this challenge.";
      button.disabled=true;
      const {error}=await sb.from("podcast_challenge_submissions").update({status,review_notes:note,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",button.dataset.review);
      if(error){alert(error.message);button.disabled=false;return;}
      await mountChallengeProgram();
    }));
    for(const c of readyChallenges){
      const [voteRes, entriesRes]=await Promise.all([
        sb.from("podcast_challenge_votes").select("submission_id").eq("challenge_id",c.id),
        sb.from("podcast_challenge_submissions").select("id,creator_user_id,episode_title,show_name").eq("challenge_id",c.id).eq("status","approved")
      ]);
      const counts=new Map();
      (voteRes.data||[]).forEach(v=>counts.set(v.submission_id,(counts.get(v.submission_id)||0)+1));
      const ranked=(entriesRes.data||[]).map(e=>({...e,votes:counts.get(e.id)||0})).sort((a,b)=>b.votes-a.votes);
      const list=adminArea.querySelector('[data-finalize-list="'+c.id+'"]');
      if(!list)continue;
      if(voteRes.error||entriesRes.error){list.textContent="Could not retrieve results for this challenge.";continue;}
      if(!ranked.length||ranked[0].votes===0){list.textContent="No approved entries with votes. No champion can be finalized yet.";continue;}
      const top=ranked[0].votes;
      const tied=ranked.filter(e=>e.votes===top);
      list.innerHTML='<p>'+ranked.map(e=>esc(e.episode_title)+' — '+e.votes+' vote'+(e.votes===1?'':'s')).join('<br>')+'</p>'+
        (tied.length>1?'<div class="cr27-live-notice">Tie detected. Administrator must select the verified winner after applying the published tie-break rules.</div>':'')+
        '<div class="cr27-entry-actions">'+tied.map(e=>'<button type="button" data-finalize="'+esc(e.id)+'" data-user="'+esc(e.creator_user_id)+'" data-votes="'+e.votes+'">Publish '+esc(e.show_name)+' as champion</button>').join("")+'</div>';
      list.querySelectorAll("[data-finalize]").forEach(button=>button.addEventListener("click",async()=>{
        if(!confirm("Publish this creator as the official "+c.title+" champion? This will add the permanent champion badge."))return;
        button.disabled=true;
        const timestamp=new Date().toISOString();
        const {error}=await sb.from("podcast_challenge_results").upsert({
          challenge_id:c.id,winning_submission_id:button.dataset.finalize,winner_user_id:button.dataset.user,
          valid_vote_count:(voteRes.data||[]).length,result_status:"finalized",is_published:true,
          finalized_by:user.id,finalized_at:timestamp,announced_at:timestamp,
          tie_break_details:tied.length>1?{administrator_selected_tie_break:true,selection_note:"Administrator verified tie-break"}:{}
        },{onConflict:"challenge_id"});
        if(error){alert(error.message);button.disabled=false;return;}
        await sb.from("podcast_monthly_challenges").update({status:"completed"}).eq("id",c.id);
        alert("Champion published and the permanent badge awarded.");
        await mountChallengeProgram();
      }));
    }
  }

  renderEntry();
  renderVoting();
  await Promise.all([renderBadges(),renderHall(),renderAdmin()]);
}
