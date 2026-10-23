/* CrowRules Podcast Awards — authenticated nomination submissions.
 * Ballot remains a clearly labeled local demo; no official voting is implied.
 */
(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const toast = $('#awardToast');
  let toastTimer, client, currentUser;
  function announce(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 4800);
  }
  async function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src=src; s.async=true;
      s.onload=resolve; s.onerror=()=>reject(new Error('Could not load required service script.'));
      document.head.appendChild(s);
    });
  }
  async function getClient() {
    if (!window.CROW_CONFIG?.supabaseUrl || !window.CROW_CONFIG?.supabaseKey) {
      await loadScript(new URL('config.js', location.href).href);
    }
    if (!window.supabase?.createClient) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    if (!window.CROW_CONFIG?.supabaseUrl || !window.CROW_CONFIG?.supabaseKey) throw new Error('Supabase public configuration is unavailable.');
    // Reuse a site-wide client if another script has exposed one; otherwise create a public-key client.
    client = window.CrowRulesSupabase || window.supabase.createClient(
      window.CROW_CONFIG.supabaseUrl, window.CROW_CONFIG.supabaseKey,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }
    );
    return client;
  }
  function setAccount(user) {
    currentUser=user||null;
    const status=$('#awardAccountStatus');
    if(status) {
      status.textContent=user ? 'Signed in — nominations can be submitted securely.' : 'Sign in is required to submit a nomination.';
      status.dataset.state=user?'signed-in':'signed-out';
    }
    $$('[data-open-nomination]').forEach(b=>{b.disabled=false; b.title=user?'Submit a nomination':'Sign in before submitting a nomination';});
    const link=$('#awardAccountLink');
    if(link){link.href=user?'account.html':'login.html?next=awards.html';link.textContent=user?'Your Account':'Sign In';}
  }
  async function refreshMyNominations() {
    const host=$('#myNominations');
    if(!host || !client || !currentUser) return;
    const {data,error}=await client.from('crowrules_award_nominations')
      .select('id,category,nominee,status,created_at').eq('user_id',currentUser.id)
      .order('created_at',{ascending:false}).limit(10);
    if(error){host.textContent='Your submissions could not be loaded right now.';return;}
    host.replaceChildren();
    if(!data?.length){host.textContent='Your submitted nominations will appear here.';return;}
    data.forEach(item=>{
      const card=document.createElement('article');card.className='submission-item';
      const title=document.createElement('strong');title.textContent=item.nominee;
      const meta=document.createElement('p');meta.textContent=item.category+' · '+item.status.replace('_',' ')+' · '+new Date(item.created_at).toLocaleDateString();
      card.append(title,meta);host.append(card);
    });
  }
  async function boot() {
    const dialog=$('#nominationDialog'), form=$('#nominationForm');
    $$('[data-open-nomination]').forEach(button=>button.addEventListener('click',()=>{
      if(!currentUser){announce('Please sign in first. Opening the account sign-in page.');location.href='login.html?next=awards.html';return;}
      if(dialog?.showModal) dialog.showModal(); else announce('Your browser does not support the nomination dialog.');
    }));
    $$('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>{if(dialog?.open)dialog.close()}));
    dialog?.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
    try {
      const db=await getClient();
      const {data:{session},error}=await db.auth.getSession();
      if(error) throw error;
      setAccount(session?.user);
      db.auth.onAuthStateChange((_event,next)=>{setAccount(next?.user); if(next?.user)refreshMyNominations();});
      if(currentUser) await refreshMyNominations();
    } catch(error) {
      console.warn('[CrowRules Awards] Auth unavailable:',error?.message||error);
      setAccount(null);
      const status=$('#awardAccountStatus'); if(status) status.textContent='Account status could not be checked. Refresh or sign in again.';
    }
    form?.addEventListener('submit',async event=>{
      event.preventDefault();
      if(!form.reportValidity())return;
      if(!currentUser){announce('Please sign in before submitting.');location.href='login.html?next=awards.html';return;}
      const submit=form.querySelector('[type="submit"]'); if(submit){submit.disabled=true;submit.textContent='Submitting securely…';}
      const data=new FormData(form);
      const url=String(data.get('url')||'').trim();
      const payload={
        user_id:currentUser.id,
        category:String(data.get('category')||''),
        nominee:String(data.get('nominee')||'').trim(),
        public_url:url||null,
        reason:String(data.get('reason')||'').trim(),
        submitter_name:String(data.get('submitter')||'').trim()||null,
        status:'pending'
      };
      try {
        const {error}=await client.from('crowrules_award_nominations').insert(payload);
        if(error)throw error;
        form.reset(); if(dialog?.open)dialog.close();
        announce('Nomination submitted to CrowRules Awards for review. It is pending review and is not yet an official nominee.');
        await refreshMyNominations();
      } catch(error) {
        console.error('[CrowRules Awards] Submission failed:',error?.message||error);
        announce(error?.code==='42501'?'Your account does not have permission to submit this nomination. Please sign in again.':'Could not submit the nomination. Check your connection and try again.');
      } finally {if(submit){submit.disabled=false;submit.textContent='Submit Nomination';}}
    });
    // Local sample ballot progress only — no vote is transmitted or counted.
    const ballot=$('#sampleBallot'), cats=[['community','Best Community Conversation'],['originality','Most Original Concept'],['moment','Favorite Network Moment']];
    function selections(){return cats.flatMap(([name,label])=>{const input=$('input[name="'+name+'"]:checked',ballot);return input?[{category:label,choice:input.closest('label').querySelector('strong')?.textContent||input.value}]:[]})}
    function updateBallot(){
      const selected=selections(),percent=Math.round(selected.length/cats.length*100);
      $('#ballotCount').textContent=selected.length+' of '+cats.length+' selected';$('#ballotPercent').textContent=percent+'%';
      $('#ballotProgressFill').style.width=percent+'%';$('#ballotProgress').setAttribute('aria-valuenow',selected.length);
      const host=$('#ballotSummary');host.replaceChildren();
      if(!selected.length){const p=document.createElement('p');p.className='small-note';p.textContent='Your selections appear here as you complete the sample ballot.';host.append(p);return;}
      selected.forEach(item=>{const div=document.createElement('div');div.className='summary-item';const small=document.createElement('small');small.textContent=item.category;const strong=document.createElement('strong');strong.textContent=item.choice;div.append(small,strong);host.append(div)});
    }
    ballot?.addEventListener('change',updateBallot);
    ballot?.addEventListener('submit',e=>{e.preventDefault();const n=selections().length;announce(n?'Sample ballot preview: '+n+' selection(s). No official vote was submitted.':'Choose at least one sample option first.');});
    ballot?.addEventListener('reset',()=>requestAnimationFrame(updateBallot));
    $('#reviewBallot')?.addEventListener('click',()=>announce(selections().length?'Your selections are shown in the summary. Demo only; no official vote was submitted.':'Your sample ballot is empty.'));
    updateBallot();
    const search=$('#archiveSearch'),year=$('#archiveYear'),archive=$('#awardArchive');
    function filterArchive(){let visible=0;$$('.award-archive-card',archive).forEach(card=>{const show=card.textContent.toLowerCase().includes((search?.value||'').trim().toLowerCase())&&(year?.value==='all'||card.dataset.year===year?.value);card.hidden=!show;if(show)visible++});$('#archiveEmpty').hidden=visible>0;}
    search?.addEventListener('input',filterArchive);year?.addEventListener('change',filterArchive);filterArchive();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
