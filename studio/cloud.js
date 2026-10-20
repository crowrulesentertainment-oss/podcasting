(()=>{
  const $=id=>document.getElementById(id);
  const cfg=window.CROWRULES_SUPABASE_CONFIG;
  const privateBucket='crowrules-podcast-studio';
  const publicBucket='crowrules-podcast-published';
  let client=null,session=null,currentUser=null,currentProjectId=null,shows=[],projects=[];
  const say=(message,error=false)=>{for(const id of ['cloudMessage','deliveryStatus','saveStatus']){const el=$(id);if(el&&id!=='saveStatus'){el.textContent=message;el.classList.toggle('error',error)}}};
  const setStatus=label=>{const el=$('cloudStatus');if(el)el.textContent=label};
  function setAccountUI(state,message=''){
    const caption=$('accountCaption'),heading=$('accountHeading'),memberState=$('memberState'),accountMessage=$('accountMessage'),toggle=$('accountToggle'),form=$('studioSignInForm'),actions=$('signedInActions');
    if(memberState)memberState.textContent=state;
    if(accountMessage&&message)accountMessage.textContent=message;
    const signedIn=!!currentUser;
    if(caption)caption.textContent=signedIn?`Signed in as ${currentUser.email||'your account'}${state==='MEMBER VERIFIED'?' · CrowRules member verified':' · member profile needs attention'}`:'Not signed in · sign in to load your shows and cloud projects.';
    if(heading)heading.textContent=signedIn?'Your CrowRules account':'Sign in to CrowRules';
    if(toggle){toggle.textContent=signedIn?'Account options':'Sign in';toggle.hidden=false}
    if(form)form.hidden=signedIn;
    if(actions)actions.hidden=!signedIn;
    if(signedIn&&$('accountPanel'))$('accountPanel').hidden=true;
  }
  function showAuthPanel(){const panel=$('accountPanel');if(panel){panel.hidden=false;if(!currentUser)$('signInEmail')?.focus()}}
  const selectedShow=()=>shows.find(s=>s.id===($('show')?.value||''))||null;
  const showName=()=>selectedShow()?.title||'';
  const slugify=s=>(s||'episode').normalize('NFKD').replace(/[^\w-]+/g,'-').replace(/^-|-$/g,'').slice(0,65)||'episode';
  function localProject(){return{title:$('title')?.value.trim()||'Untitled Podcast Session',show:showName(),showId:$('show')?.value||'',notes:$('notes')?.value.trim()||'',updatedAt:new Date().toISOString()}}
  function renderShowOptions(preferredId=''){
    const el=$('show');if(!el)return;const old=preferredId||el.value;el.replaceChildren();
    const first=new Option(!currentUser?'Sign in to load your shows…':shows.length?'Choose a show…':'No shows found', '');el.add(first);
    shows.forEach(s=>el.add(new Option(s.title+(s.status==='draft'?' · Draft show':''),s.id)));
    if(old&&shows.some(s=>s.id===old))el.value=old;
    const help=$('showHelp');if(help)help.textContent=shows.length?`${shows.length} show${shows.length===1?'':'s'} connected to your account. Published episodes go directly to the selected show.`:'No shows are linked to this account. Check that your CrowRules Podcasting creator profile is connected.';
  }
  async function loadShows(preferredId=''){
    if(!client||!currentUser)return;
    const {data:member,error:memberError}=await client.from('members').select('id').eq('user_id',currentUser.id).maybeSingle();
    if(memberError){setAccountUI('MEMBER CHECK FAILED',memberError.message);throw Error('Could not find your CrowRules member profile: '+memberError.message)}
    if(!member){shows=[];renderShowOptions();setStatus('NO MEMBER PROFILE');setAccountUI('NO MEMBER PROFILE','You are authenticated, but no row in the members table matches this login. Sign in with the account linked to your CrowRules member profile, or ask an administrator to connect it.');return}
    const {data:creator,error:creatorError}=await client.from('creators').select('id').eq('member_id',member.id).maybeSingle();
    if(creatorError)throw Error('Could not load your creator profile: '+creatorError.message);
    if(!creator){shows=[];renderShowOptions();setStatus('MEMBER · NO CREATOR');setAccountUI('MEMBER VERIFIED','Your CrowRules member profile is verified, but it does not have a creator profile linked yet.');return}
    const {data,error}=await client.from('podcasts').select('id,title,slug,status,creator_id').eq('creator_id',creator.id).order('title');
    if(error)throw Error('Could not load your shows: '+error.message);
    shows=data||[];renderShowOptions(preferredId);setStatus('MEMBER VERIFIED');setAccountUI('MEMBER VERIFIED',`Member verified. ${shows.length} podcast show${shows.length===1?'':'s'} available for this account.`);
  }
  function projectPayload(){const p=localProject();return{title:p.title,show_name:p.show,notes:p.notes,podcast_id:p.showId||null,updated_at:new Date().toISOString()}}
  async function loadProjects(preferredId=''){
    const picker=$('savedProjectSelect');if(!client||!currentUser){if(picker)picker.replaceChildren(new Option('Sign in to load projects',''));return}
    const {data,error}=await client.from('crowrules_studio_projects').select('id,title,show_name,notes,podcast_id,updated_at,created_at').order('updated_at',{ascending:false}).limit(100);
    if(error)throw Error('Could not load saved projects: '+error.message);
    projects=data||[];
    if(picker){picker.replaceChildren(new Option(projects.length?'Choose a saved project…':'No saved projects yet',''));projects.forEach(p=>picker.add(new Option(`${p.title} · ${p.show_name||'No show'}`,p.id)));if(preferredId&&projects.some(p=>p.id===preferredId))picker.value=preferredId}
  }
  function applyProject(p){if(!p)return;$('title').value=p.title||'Untitled Podcast Session';$('notes').value=p.notes||'';if($('show'))$('show').value=p.podcast_id||p.showId||'';currentProjectId=p.id||null;try{localStorage.setItem('crowrulesStudioProject',JSON.stringify({title:p.title,show:p.show_name||p.show||showName(),showId:p.podcast_id||p.showId||'',notes:p.notes||'',updatedAt:p.updated_at||p.updatedAt||new Date().toISOString()}));if(currentProjectId)localStorage.setItem('crowrulesStudioCloudProjectId',currentProjectId)}catch(_){}const st=$('saveStatus');if(st)st.textContent='Loaded saved project from Supabase.'}
  async function saveProject(){
    if(!client||!currentUser)throw Error('Sign in through your main CrowRules Podcasting account to save projects to Supabase.');
    const payload=projectPayload();if(!payload.podcast_id)throw Error('Choose one of your podcast shows before saving this project.');
    let result;
    if(currentProjectId){result=await client.from('crowrules_studio_projects').update(payload).eq('id',currentProjectId).eq('owner_id',currentUser.id).select('id').maybeSingle();if(result.error)throw Error('Cloud save failed: '+result.error.message);if(!result.data)currentProjectId=null}
    if(!currentProjectId){result=await client.from('crowrules_studio_projects').insert({...payload,owner_id:currentUser.id}).select('id').single();if(result.error)throw Error('Cloud save failed: '+result.error.message);currentProjectId=result.data.id}
    try{localStorage.setItem('crowrulesStudioCloudProjectId',currentProjectId);localStorage.setItem('crowrulesStudioProject',JSON.stringify({...localProject(),id:currentProjectId}))}catch(_){}
    await loadProjects(currentProjectId);const st=$('saveStatus');if(st)st.textContent='Saved to Supabase · '+new Date().toLocaleTimeString();return currentProjectId;
  }
  async function loadExports(){
    if(!client||!currentUser)return;const el=$('cloudExports');if(!el)return;
    const {data,error}=await client.from('crowrules_studio_exports').select('id,title,show_name,audio_path,storage_bucket,file_bytes,created_at,delivery_status').order('created_at',{ascending:false}).limit(10);
    if(error){el.textContent='Could not load exports: '+error.message;return}if(!data?.length){el.textContent='No cloud exports yet.';return}el.replaceChildren();
    for(const item of data){const div=document.createElement('div');div.className='cloud-export-item';const strong=document.createElement('strong');strong.textContent=item.title;const small=document.createElement('small');small.textContent=`${item.show_name||'Show not specified'} · ${item.delivery_status==='published'?'Published':'Ready for show'} · ${new Date(item.created_at).toLocaleString()} · ${Math.round((item.file_bytes||0)/1024)} KB`;const a=document.createElement('a');a.href='#';a.textContent='Open audio';a.addEventListener('click',async e=>{e.preventDefault();const bucket=item.storage_bucket||privateBucket;let linkData,error;if(bucket===publicBucket){const res=client.storage.from(bucket).getPublicUrl(item.audio_path);linkData={signedUrl:res.data.publicUrl}}else{const res=await client.storage.from(bucket).createSignedUrl(item.audio_path,600);linkData=res.data;error=res.error}if(error){say(error.message,true);return}window.open(linkData.signedUrl,'_blank','noopener');});div.append(strong,small,a);el.append(div)}
  }
  async function uploadToShow(){
    if(!client||!currentUser)throw Error('Sign in through your main CrowRules Podcasting account before sending an episode.');
    const show=selectedShow();if(!show)throw Error('Choose the destination show from the dropdown.');
    const mix=window.CrowRulesStudioMix?.getMix?.();if(!mix?.blob)throw Error('Build the full episode mix first.');
    const projectId=await saveProject();const title=$('title').value.trim()||'Untitled Podcast Episode';const path=`${currentUser.id}/${show.id}/${Date.now()}-${slugify(title)}.wav`;
    say('Uploading the finished WAV to private storage…');const {error:uploadError}=await client.storage.from(privateBucket).upload(path,mix.blob,{contentType:'audio/wav',upsert:false});if(uploadError)throw Error('Private audio upload failed: '+uploadError.message);
    const {data:row,error:rowError}=await client.from('crowrules_studio_exports').insert({owner_id:currentUser.id,project_id:projectId,podcast_id:show.id,title,show_name:show.title,audio_path:path,storage_bucket:privateBucket,mime_type:'audio/wav',file_bytes:mix.blob.size,duration_seconds:Math.round(mix.duration||0),delivery_status:'ready_for_show'}).select('id').single();
    if(rowError)throw Error('Audio uploaded but its draft record failed: '+rowError.message);await loadExports();return row;
  }
  async function publishToShow(){
    if(!client||!currentUser)throw Error('Sign in through your main CrowRules Podcasting account before publishing.');
    const show=selectedShow();if(!show)throw Error('Choose the destination show from the dropdown.');
    if(show.status!=='published')throw Error(`“${show.title}” is currently a draft show. Publish the show first, or use “Save draft to selected show”.`);
    const mix=window.CrowRulesStudioMix?.getMix?.();if(!mix?.blob)throw Error('Build the full episode mix first.');
    const projectId=await saveProject();const title=$('title').value.trim()||'Untitled Podcast Episode';const description=$('notes').value.trim();const slug=`${slugify(title)}-${Date.now().toString(36)}`;const path=`${currentUser.id}/${show.id}/${Date.now()}-${slugify(title)}.wav`;
    say('Uploading episode audio to the public podcast media bucket…');const {error:uploadError}=await client.storage.from(publicBucket).upload(path,mix.blob,{contentType:'audio/wav',upsert:false});if(uploadError)throw Error('Public episode audio upload failed: '+uploadError.message);
    const audioUrl=client.storage.from(publicBucket).getPublicUrl(path).data.publicUrl;
    const {data:episode,error:episodeError}=await client.from('podcast_episodes').insert({podcast_id:show.id,title,slug,description,show_notes:description||null,duration_seconds:Math.round(mix.duration||0),audio_url:audioUrl,status:'published',is_published:true,published_at:new Date().toISOString(),release_date:new Date().toISOString().slice(0,10)}).select('id,title,slug,podcast_id').single();
    if(episodeError){await client.storage.from(publicBucket).remove([path]);throw Error('Audio uploaded, but the episode could not be published: '+episodeError.message)}
    const {error:exportError}=await client.from('crowrules_studio_exports').insert({owner_id:currentUser.id,project_id:projectId,podcast_id:show.id,episode_id:episode.id,title,show_name:show.title,audio_path:path,storage_bucket:publicBucket,mime_type:'audio/wav',file_bytes:mix.blob.size,duration_seconds:Math.round(mix.duration||0),delivery_status:'published'});
    await loadExports();if(exportError)console.warn('Episode published, export history row failed:',exportError.message);
    return {episode,show};
  }
  async function deliver(){
    const mode=document.querySelector('input[name="deliveryMode"]:checked')?.value||'download';const status=$('deliveryStatus');const mix=window.CrowRulesStudioMix?.getMix?.();if(!mix?.blob){status.textContent='Build the episode mix first.';return}
    if(mode==='download'){window.CrowRulesStudioMix.download();status.textContent='Download started. Nothing was uploaded.';return}
    const button=$('deliverMix');button.disabled=true;button.textContent=mode==='send'?'Saving draft…':'Publishing…';
    try{if(mode==='send'){await uploadToShow();status.textContent=`Saved as a private draft for ${showName()}. It is not public yet.`}else{const {episode,show}=await publishToShow();status.textContent=`Published “${episode.title}” to ${show.title}. The episode record and public audio URL are saved in Supabase.`;if(mode==='both')window.CrowRulesStudioMix.download()}}
    catch(e){status.textContent=e.message||'Could not deliver episode.';say(status.textContent,true)}finally{button.disabled=false;button.textContent='Continue'}
  }
  async function refreshAccount(preferredId=''){
    if(!currentUser){
      shows=[];projects=[];setStatus('SIGNED OUT');setAccountUI('SIGNED OUT','Sign in with the same account you use on the main CrowRules Podcasting website. Supabase will verify your member profile before loading shows.');
      renderShowOptions();
      const picker=$('savedProjectSelect');if(picker)picker.replaceChildren(new Option('Sign in to load projects',''));
      return;
    }
    setStatus('CHECKING MEMBER');setAccountUI('CHECKING MEMBER','Checking your login against the CrowRules members and creators records…');
    try{
      await loadShows(preferredId);
      const requestedProject=new URLSearchParams(window.location.search).get('project');
      await loadProjects(requestedProject||'');await loadExports();
      const savedId=requestedProject||localStorage.getItem('crowrulesStudioCloudProjectId');
      if(savedId){const p=projects.find(x=>x.id===savedId);if(p)applyProject(p)}
      else{const local=JSON.parse(localStorage.getItem('crowrulesStudioProject')||'null');if(local){if(local.showId&&shows.some(s=>s.id===local.showId)&&$('show'))$('show').value=local.showId;if($('title'))$('title').value=local.title||$('title').value;if($('notes'))$('notes').value=local.notes||''}}
    }catch(e){setStatus('MEMBER CHECK ERROR');setAccountUI('MEMBER CHECK ERROR',e.message||'Could not verify this member session.');say(e.message,true)}
  }
  async function init(){
    const toggle=$('accountToggle'),panel=$('accountPanel'),form=$('studioSignInForm');
    toggle?.addEventListener('click',()=>{if(currentUser){showAuthPanel();const actions=$('signedInActions');if(actions)actions.hidden=false;const f=$('studioSignInForm');if(f)f.hidden=true}else if(panel?.hidden)showAuthPanel();else if(panel)panel.hidden=true});
    $('accountCancel')?.addEventListener('click',()=>{if(panel)panel.hidden=true});
    $('signOutButton')?.addEventListener('click',async()=>{if(!client)return;const b=$('signOutButton');if(b)b.disabled=true;try{const {error}=await client.auth.signOut();if(error)throw error;if(panel)panel.hidden=true;setAccountUI('SIGNED OUT','You have signed out. Sign in again to access your member shows and cloud projects.')}catch(e){setAccountUI('SIGN OUT FAILED',e.message);say(e.message,true)}finally{if(b)b.disabled=false}});
    form?.addEventListener('submit',async e=>{e.preventDefault();if(!client){const n=$('authNotice');if(n)n.textContent='Supabase is not connected yet.';return}const email=$('signInEmail')?.value.trim(),password=$('signInPassword')?.value;const button=$('signInSubmit'),notice=$('authNotice');if(button){button.disabled=true;button.textContent='Signing in…'}if(notice){notice.textContent='Verifying credentials with Supabase Auth…';notice.classList.remove('error')}
      try{const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;session=data.session;currentUser=data.user||data.session?.user||null;if(notice)notice.textContent='Signed in. Checking your CrowRules member profile…';if(panel)panel.hidden=true;await refreshAccount()}
      catch(err){if(notice){notice.textContent=err.message||'Sign-in failed.';notice.classList.add('error')}setStatus('SIGN IN FAILED');setAccountUI('SIGN IN FAILED',err.message||'Sign-in failed. Check your email and password.');if(panel)panel.hidden=false}
      finally{if(button){button.disabled=false;button.textContent='Sign in securely'}}
    });
    $('show')?.addEventListener('change',()=>{try{localStorage.setItem('crowrulesStudioProject',JSON.stringify(localProject()))}catch(_){} });
    $('savedProjectSelect')?.addEventListener('change',()=>{const p=projects.find(x=>x.id===$('savedProjectSelect').value);if(p)applyProject(p)});
    $('deliverMix')?.addEventListener('click',()=>deliver());
    $('save')?.addEventListener('click',async()=>{try{await saveProject();say('Project saved to Supabase.',false)}catch(e){const st=$('saveStatus');if(st)st.textContent=e.message;say(e.message,true)}});
    if(!cfg||!window.supabase?.createClient){setStatus('SUPABASE NOT LOADED');setAccountUI('CONNECTION ERROR','Supabase client could not load. Check your internet connection and configuration.');return}
    client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data,error}=await client.auth.getSession();if(error){setStatus('SESSION ERROR');setAccountUI('SESSION ERROR',error.message);return}session=data.session;currentUser=session?.user||null;
    await refreshAccount();
    client.auth.onAuthStateChange((_event,newSession)=>{session=newSession;currentUser=newSession?.user||null;if(!currentUser){currentProjectId=null;refreshAccount().catch(e=>say(e.message,true))}else{setAccountUI('CHECKING MEMBER','Login detected. Verifying your CrowRules member profile…');refreshAccount().catch(e=>say(e.message,true))}});
  }
  init().catch(e=>{setStatus('ERROR');say(e.message,true)});
  window.CrowRulesCloud={saveProject,uploadToShow,publishToShow,loadProjects,loadShows};
})();