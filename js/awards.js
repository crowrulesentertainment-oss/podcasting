/* CrowRules Podcast Awards — live Supabase nominations, official ballots, and admin review. */
(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const CATEGORIES = [
    'Podcast of the Year','Outstanding Host','Best Episode','Best Community Conversation',
    'Most Original Concept','Best Audio & Production','Breakout Voice',
    'Most Meaningful Conversation','Best Guest Appearance',"Listeners' Choice",
    'Outstanding Series','Community Impact Award'
  ];
  let db, user=null, season=null, toastTimer;
  const toast = $('#awardToast');
  const announce = message => {
    if (!toast) return;
    toast.textContent = message; toast.classList.add('visible');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('visible'),5200);
  };
  async function loadScript(src) {
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load a required service script.'));document.head.appendChild(s);});
  }
  async function getClient() {
    if (!window.CROW_CONFIG?.supabaseUrl || !window.CROW_CONFIG?.supabaseKey) await loadScript(new URL('config.js',location.href).href);
    if (!window.supabase?.createClient) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    if (!window.CROW_CONFIG?.supabaseUrl || !window.CROW_CONFIG?.supabaseKey) throw new Error('Supabase public configuration is unavailable.');
    db=window.CrowRulesSupabase||window.supabase.createClient(window.CROW_CONFIG.supabaseUrl,window.CROW_CONFIG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
    return db;
  }
  function setAccount(nextUser) {
    user=nextUser||null;
    const status=$('#awardAccountStatus');
    if(status){status.textContent=user?'Signed in — nominations and voting are linked to your account.':'Sign in to nominate or cast an official vote.';status.dataset.state=user?'signed-in':'signed-out';}
    const link=$('#awardAccountLink'); if(link){link.href=user?'account.html':'login.html?next=awards.html';link.textContent=user?'Your Account':'Sign In';}
  }
  async function loadSeason() {
    const {data,error}=await db.from('crowrules_award_seasons').select('*').order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    season=data||null;
    const label=$('#awardSeasonLabel');
    if(label) label.textContent=season?.title||'Awards season is being prepared';
    const now=Date.now();
    const nominationsOpen=!!season?.nominations_open&&(!season.nominations_open_at||now>=Date.parse(season.nominations_open_at))&&(!season.nominations_close_at||now<Date.parse(season.nominations_close_at));
    const votingOpen=!!season?.voting_open&&(!season.voting_open_at||now>=Date.parse(season.voting_open_at))&&(!season.voting_close_at||now<Date.parse(season.voting_close_at));
    const nomStatus=$('#nominationLiveStatus');
    if(nomStatus){nomStatus.textContent=nominationsOpen?'NOMINATIONS OPEN':'NOMINATIONS CLOSED';nomStatus.classList.toggle('is-live',nominationsOpen);}
    const voteStatus=$('#votingLiveStatus');
    if(voteStatus){voteStatus.textContent=votingOpen?'LIVE VOTING':'VOTING CLOSED';voteStatus.classList.toggle('is-live',votingOpen);}
    const form=$('#nominationForm'),submit=form?.querySelector('[type=submit]');
    if(submit)submit.disabled=!nominationsOpen;
  }
  async function refreshMyNominations() {
    const host=$('#myNominations'); if(!host)return;
    if(!user){host.textContent='Sign in to view your private nomination submissions.';return;}
    const {data,error}=await db.from('crowrules_award_nominations').select('id,category,nominee,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20);
    if(error){host.textContent='Your submissions could not be loaded right now.';return;}
    host.replaceChildren();
    if(!data?.length){host.textContent='You have not submitted a nomination in this season yet.';return;}
    data.forEach(item=>{
      const card=document.createElement('article');card.className='submission-item';
      const title=document.createElement('strong');title.textContent=item.nominee;
      const meta=document.createElement('p');meta.textContent=item.category+' · '+String(item.status).replace('_',' ')+' · '+new Date(item.created_at).toLocaleDateString();
      card.append(title,meta);host.append(card);
    });
  }
  function node(tag, cls, text) {const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
  async function refreshBallot() {
    const host=$('#liveBallot'); if(!host)return;
    host.replaceChildren();
    if(!season){host.append(node('p','small-note','The awards season could not be loaded. Refresh to try again.'));return;}
    const {data:nominees,error}=await db.from('crowrules_award_nominees').select('id,category,nominee,public_url,description,created_at').eq('season_id',season.id).eq('published',true).order('category').order('nominee');
    if(error){host.append(node('p','small-note','The official ballot could not be loaded. Please refresh and try again.'));return;}
    const alreadyVoted=new Map();
    if(user){const r=await db.from('crowrules_award_votes').select('category,nominee_id').eq('season_id',season.id).eq('user_id',user.id);if(!r.error)(r.data||[]).forEach(v=>alreadyVoted.set(v.category,v.nominee_id));}
    const now=Date.now(),votingOpen=!!season.voting_open&&(!season.voting_open_at||now>=Date.parse(season.voting_open_at))&&(!season.voting_close_at||now<Date.parse(season.voting_close_at));
    const groups=CATEGORIES.map(category=>({category,items:(nominees||[]).filter(n=>n.category===category)})).filter(g=>g.items.length);
    const info=node('div','award-final-note');
    info.textContent=!votingOpen?'Voting is currently closed. Published nominees remain visible.':!groups.length?'Voting is open for this season, but no official nominees have been published yet. Award administrators can review submissions and publish eligible nominees.':user?'Choose one nominee in each category and submit your vote. Each signed-in account may vote once per category.':'The official ballot is live. Sign in to cast one vote per category.';
    host.append(info);
    if(!groups.length){const empty=node('article','award-feature-panel');empty.append(node('h3','','The ballot is waiting for nominees'),node('p','award-subtitle','Nominations submitted through this page are saved in Supabase and remain pending until an administrator reviews and publishes them.'));host.append(empty);}
    for(const group of groups) {
      const card=node('article','award-live-category');
      const head=node('div','award-live-category-head');head.append(node('div','eyebrow','OFFICIAL CATEGORY'),node('h3','',group.category),node('span','award-tag',group.items.length+' NOMINEE'+(group.items.length===1?'':'S')));card.append(head);
      const options=node('div','award-live-options');
      group.items.forEach(item=>{
        const label=node('label','award-live-option');
        const radio=document.createElement('input');radio.type='radio';radio.name='vote-'+group.category;radio.value=item.id;radio.disabled=!user||!votingOpen||alreadyVoted.has(group.category);
        if(alreadyVoted.get(group.category)===item.id)radio.checked=true;
        const body=node('span','');body.append(node('strong','',item.nominee));
        if(item.description)body.append(node('small','',item.description));
        if(item.public_url){const a=node('a','','View nominee ↗');a.href=item.public_url;a.target='_blank';a.rel='noopener noreferrer';a.addEventListener('click',e=>e.stopPropagation());body.append(a);}
        label.append(radio,body);if(alreadyVoted.has(group.category))label.classList.add('already-voted');options.append(label);
      });
      card.append(options);
      const action=node('div','award-live-action');
      if(alreadyVoted.has(group.category)) action.append(node('span','award-vote-confirmed','✓ Vote recorded for this category'));
      else {
        const button=node('button','btn award-primary','Submit vote');button.type='button';button.disabled=!user||!votingOpen;
        button.addEventListener('click',async()=>{
          if(!user){location.href='login.html?next=awards.html';return;}
          const selected=options.querySelector('input:checked');
          if(!selected){announce('Choose a nominee in '+group.category+' first.');return;}
          button.disabled=true;button.textContent='Recording vote…';
          try{
            const {error}=await db.rpc('crowrules_cast_award_vote',{p_season_id:season.id,p_nominee_id:selected.value});
            if(error)throw error;
            announce('Your vote for '+group.category+' has been recorded securely.');
            await refreshBallot();
          }catch(e){announce(e?.code==='23505'?'A vote has already been recorded for this category.':(e?.message||'Could not record your vote. Please try again.'));button.disabled=false;button.textContent='Submit vote';}
        });
        action.append(button);
      }
      card.append(action);host.append(card);
    }
    const resultHost=$('#liveResults');
    if(resultHost){
      resultHost.replaceChildren();
      if(season.results_public){
        const {data,error}=await db.rpc('crowrules_get_award_results',{p_season_id:season.id});
        if(error)resultHost.append(node('p','small-note','Published results are temporarily unavailable.'));
        else if(!data?.length)resultHost.append(node('p','small-note','No published results yet.'));
        else{const wrap=node('div','award-results-list');data.forEach(row=>{const c=node('div','summary-item');c.append(node('small','',row.category),node('strong','',row.nominee),node('small','',String(row.votes)+' vote'+(Number(row.votes)===1?'':'s')));wrap.append(c);});resultHost.append(wrap);}
      }else resultHost.append(node('p','small-note','Vote totals stay hidden while voting is in progress. Official results appear here when the awards team publishes them.'));
    }
  }
  async function isAdmin(){if(!user)return false;try{const {data,error}=await db.rpc('crowrules_is_admin');return !error&&data===true;}catch(_){return false;}}
  async function refreshAdminPanel() {
    const panel=$('#awardAdminPanel');if(!panel)return;
    const admin=await isAdmin();panel.hidden=!admin;if(!admin)return;
    panel.replaceChildren();
    const heading=node('div','award-heading-row'),copy=node('div','');
    copy.append(node('div','eyebrow','RESTRICTED TO AWARDS ADMINISTRATORS'),node('h2','','Awards control room'),node('p','award-subtitle','Review nominations, publish official nominees, and control the live voting window.'));heading.append(copy);panel.append(heading);
    const controls=node('div','award-admin-controls');
    [['nominations_open','Close nominations','Open nominations'],['voting_open','Close voting','Open voting'],['results_public','Hide results','Publish results']].forEach(([field,onLabel,offLabel])=>{
      const b=node('button','btn award-secondary',season?.[field]?onLabel:offLabel);b.type='button';b.addEventListener('click',async()=>{
        b.disabled=true;const {error}=await db.from('crowrules_award_seasons').update({[field]:!season[field],updated_at:new Date().toISOString()}).eq('id',season.id);
        if(error)announce('Could not update awards settings. Check admin permissions.');else{announce('Awards settings updated.');await loadSeason();await refreshBallot();await refreshAdminPanel();}b.disabled=false;
      });controls.append(b);
    });
    panel.append(controls);
    const {data,error}=await db.from('crowrules_award_nominations').select('id,category,nominee,public_url,reason,submitter_name,status,created_at').eq('season_id',season.id).order('created_at',{ascending:false}).limit(100);
    if(error){panel.append(node('p','small-note','The review queue could not be loaded.'));return;}
    const pending=(data||[]).filter(n=>n.status==='pending'||n.status==='in_review');
    panel.append(node('h3','','Nomination review queue ('+pending.length+')'));
    if(!pending.length)panel.append(node('p','small-note','No pending nominations. New submissions appear here after sign-in.'));
    for(const item of pending){
      const card=node('article','award-admin-nomination');card.append(node('span','award-tag',item.category),node('h3','',item.nominee),node('p','award-subtitle',item.reason),node('p','small-note',(item.submitter_name||'Community member')+' · '+new Date(item.created_at).toLocaleString()));
      if(item.public_url){const a=node('a','','Open public link ↗');a.href=item.public_url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
      const actions=node('div','award-actions');
      const approve=node('button','btn award-primary','Approve & publish nominee');approve.type='button';
      approve.addEventListener('click',async()=>{
        approve.disabled=true;
        try{
          const {error:insertError}=await db.from('crowrules_award_nominees').insert({season_id:season.id,nomination_id:item.id,category:item.category,nominee:item.nominee,public_url:item.public_url,description:item.reason,published:true});
          if(insertError)throw insertError;
          const {error:updateError}=await db.from('crowrules_award_nominations').update({status:'approved',updated_at:new Date().toISOString()}).eq('id',item.id);
          if(updateError)throw updateError;
          announce('Nominee approved and added to the live ballot.');await refreshAdminPanel();await refreshBallot();await refreshMyNominations();
        }catch(e){announce(e?.code==='23505'?'This nominee is already published in that category.':(e?.message||'Could not publish nominee.'));}
        finally{approve.disabled=false;}
      });
      const reject=node('button','btn award-secondary','Reject');reject.type='button';reject.addEventListener('click',async()=>{if(!confirm('Reject this nomination?'))return;const {error}=await db.from('crowrules_award_nominations').update({status:'rejected',updated_at:new Date().toISOString()}).eq('id',item.id);if(error)announce('Could not update nomination status.');else{announce('Nomination marked as rejected.');await refreshAdminPanel();await refreshMyNominations();}});
      actions.append(approve,reject);card.append(actions);panel.append(card);
    }
  }
  function bindNominationDialog(){
    const dialog=$('#nominationDialog'),form=$('#nominationForm');
    $$('[data-open-nomination]').forEach(b=>b.addEventListener('click',()=>{if(!user){location.href='login.html?next=awards.html';return;}if(!season?.nominations_open){announce('Nominations are currently closed.');return;}if(dialog?.showModal)dialog.showModal();}));
    $$('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>{if(dialog?.open)dialog.close();}));
    dialog?.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
    form?.addEventListener('submit',async e=>{
      e.preventDefault();if(!form.reportValidity())return;
      if(!user){location.href='login.html?next=awards.html';return;}
      if(!season?.nominations_open){announce('Nominations are currently closed.');return;}
      const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='Submitting securely…';
      const f=new FormData(form),url=String(f.get('url')||'').trim();
      const payload={season_id:season.id,user_id:user.id,category:String(f.get('category')||''),nominee:String(f.get('nominee')||'').trim(),public_url:url||null,reason:String(f.get('reason')||'').trim(),submitter_name:String(f.get('submitter')||'').trim()||null,status:'pending'};
      try{const {error}=await db.from('crowrules_award_nominations').insert(payload);if(error)throw error;form.reset();dialog.close();announce('Nomination submitted to Supabase for review. It is not official until approved.');await refreshMyNominations();await refreshAdminPanel();}
      catch(e){announce(e?.message||'Could not submit nomination. Please try again.');}
      finally{button.disabled=false;button.textContent='Submit Nomination';}
    });
  }
  async function boot(){
    bindNominationDialog();
    try{
      await getClient();
      const {data:{session},error}=await db.auth.getSession();if(error)throw error;setAccount(session?.user);
      db.auth.onAuthStateChange((_event,next)=>{setAccount(next?.user);setTimeout(async()=>{await refreshMyNominations();await refreshBallot();await refreshAdminPanel();},0);});
      await loadSeason();await refreshMyNominations();await refreshBallot();await refreshAdminPanel();
      if(db.channel){
        db.channel('crowrules-awards-live')
          .on('postgres_changes',{event:'*',schema:'public',table:'crowrules_award_nominees'},()=>refreshBallot())
          .on('postgres_changes',{event:'*',schema:'public',table:'crowrules_award_seasons'},async()=>{await loadSeason();await refreshBallot();await refreshAdminPanel();})
          .on('postgres_changes',{event:'*',schema:'public',table:'crowrules_award_nominations'},()=>{refreshMyNominations();refreshAdminPanel();})
          .subscribe();
      }
    }catch(e){console.warn('[CrowRules Awards]',e?.message||e);const status=$('#awardAccountStatus');if(status)status.textContent='Awards services could not connect. Refresh and try again.';announce('Could not connect to CrowRules Awards services.');}
    const search=$('#archiveSearch'),year=$('#archiveYear'),archive=$('#awardArchive');
    function filterArchive(){let visible=0;$$('.award-archive-card',archive).forEach(card=>{const show=card.textContent.toLowerCase().includes((search?.value||'').trim().toLowerCase())&&(year?.value==='all'||card.dataset.year===year?.value);card.hidden=!show;if(show)visible++;});const empty=$('#archiveEmpty');if(empty)empty.hidden=visible>0;}
    search?.addEventListener('input',filterArchive);year?.addEventListener('change',filterArchive);filterArchive();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();