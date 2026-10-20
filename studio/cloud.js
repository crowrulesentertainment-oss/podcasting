(()=>{
  const $=id=>document.getElementById(id);
  const cfg=window.CROWRULES_SUPABASE_CONFIG;
  const privateBucket='crowrules-podcast-studio';
  const publicBucket='crowrules-podcast-published';
  let client=null,session=null,currentUser=null,currentProjectId=null,shows=[],projects=[],authListener=null;
  const say=(message,error=false)=>{for(const id of ['cloudMessage','deliveryStatus','saveStatus','finalizeStatus']){const el=$(id);if(el){el.textContent=message;el.classList.toggle('error',error)}}};
  const setStatus=label=>{const el=$('cloudStatus');if(el)el.textContent=label};
  const setAccountUI=(state,message='')=>{
    const caption=$('accountCaption'),heading=$('accountHeading'),memberState=$('memberState'),accountMessage=$('accountMessage'),toggle=$('accountToggle'),form=$('studioSignInForm'),actions=$('signedInActions');
    if(memberState)memberState.textContent=state;if(accountMessage&&message)accountMessage.textContent=message;
    const signedIn=!!currentUser;
    if(caption)caption.textContent=signedIn?`Signed in as ${currentUser.email||'your account'}${state==='MEMBER VERIFIED'?' · CrowRules member verified':' · member profile needs attention'}`:'Not signed in · sign in to load shows and cloud projects.';
    if(heading)heading.textContent=signedIn?'Your CrowRules account':'Sign in to CrowRules';
    if(toggle){toggle.textContent=signedIn?'Account options':'Sign in';toggle.hidden=false}
    if(form)form.hidden=signedIn;if(actions)actions.hidden=!signedIn;
    if(signedIn&&$('accountPanel'))$('accountPanel').hidden=true;
  };
  function showAuthPanel(){const p=$('accountPanel');if(p){p.hidden=false;if(!currentUser)$('signInEmail')?.focus()}}
  const selectedShow=()=>shows.find(s=>s.id===($('show')?.value||''))||null;
  const showName=()=>selectedShow()?.title||'';
  const slugify=s=>(s||'episode').normalize('NFKD').replace(/[^\w-]+/g,'-').replace(/^-|-$/g,'').slice(0,65)||'episode';
  function localProject(){return{title:$('title')?.value.trim()||'Untitled Podcast Session',show:showName(),showId:$('show')?.value||'',notes:$('notes')?.value.trim()||'',updatedAt:new Date().toISOString()}}
  function renderShowOptions(preferredId=''){
    const el=$('show');if(!el)return;const old=preferredId||el.value;el.replaceChildren();
    el.add(new Option(!currentUser?'Sign in to load your shows…':shows.length?'Choose a show…':'No shows found',''));
    shows.forEach(s=>el.add(new Option(s.title+(s.status==='draft'?' · Draft show':''),s.id)));
    if(old&&shows.some(s=>s.id===old))el.value=old;
    const help=$('showHelp');if(help)help.textContent=shows.length?`${shows.length} show${shows.length===1?'':'s'} connected to your account. Publishing requires a published show.`:'No shows are linked to this account. Check the creator profile connected to your CrowRules member account.';
  }
  async function loadShows(preferredId=''){
    if(!client||!currentUser)return;
    const {data:member,error:memberError}=await client.from('members').select('id').eq('user_id',currentUser.id).maybeSingle();
    if(memberError)throw Error('Could not check your CrowRules member profile: '+memberError.message);
    if(!member){shows=[];renderShowOptions();setStatus('NO MEMBER PROFILE');setAccountUI('NO MEMBER PROFILE','You are signed in, but this login has no matching CrowRules member record.');return}
    const {data:creator,error:creatorError}=await client.from('creators').select('id').eq('member_id',member.id).maybeSingle();
    if(creatorError)throw Error('Could not load your creator profile: '+creatorError.message);
    if(!creator){shows=[];renderShowOptions();setStatus('MEMBER · NO CREATOR');setAccountUI('MEMBER VERIFIED','Your member account is verified, but no creator profile is linked yet.');return}
    const {data,error}=await client.from('podcasts').select('id,title,slug,status,creator_id').eq('creator_id',creator.id).order('title');
    if(error)throw Error('Could not load your shows: '+error.message);
    shows=data||[];renderShowOptions(preferredId);setStatus('MEMBER VERIFIED');setAccountUI('MEMBER VERIFIED',`Member verified. ${shows.length} show${shows.length===1?'':'s'} available.`);
  }
  function projectPayload(status='draft'){
    const p=localProject();return{title:p.title,show_name:p.show||'No show selected',notes:p.notes,podcast_id:p.showId||null,updated_at:new Date().toISOString(),project_status:status};
  }
  async function loadProjects(preferredId=''){
    const picker=$('savedProjectSelect');if(!client||!currentUser){if(picker)picker.replaceChildren(new Option('Sign in to load projects',''));return}
    const {data,error}=await client.from('crowrules_studio_projects').select('id,owner_id,title,show_name,notes,podcast_id,audio_path,storage_bucket,project_status,mix_duration_seconds,updated_at,created_at').eq('owner_id',currentUser.id).order('updated_at',{ascending:false}).limit(100);
    if(error)throw Error('Could not load saved projects: '+error.message);projects=data||[];
    if(picker){picker.replaceChildren(new Option(projects.length?'Choose a saved project…':'No saved projects yet',''));projects.forEach(p=>picker.add(new Option(`${p.title} · ${p.project_status||'draft'} · ${p.show_name||'No show'}`,p.id)));if(preferredId&&projects.some(p=>p.id===preferredId))picker.value=preferredId}
  }
  async function restoreProjectAudio(p){
    if(!p?.audio_path||!client||!currentUser)return;
    const bucket=p.storage_bucket||privateBucket;const {data,error}=await client.storage.from(bucket).download(p.audio_path);
    if(error)throw Error('Project details loaded, but its saved audio could not be restored: '+error.message);
    const duration=Number(p.mix_duration_seconds||0);window.CrowRulesStudioMix?.restoreMix?.(data,duration);
    const status=$('mixStatus');if(status)status.textContent=`Resumed saved episode mix from Supabase${duration?` · ${Math.round(duration)} seconds`:''}. You can listen, download, finalize, or publish it.`;
  }
  async function applyProject(p){
    if(!p)return;$('title').value=p.title||'Untitled Podcast Session';$('notes').value=p.notes||'';
    if($('show'))$('show').value=p.podcast_id||'';currentProjectId=p.id||null;
    try{localStorage.setItem('crowrulesStudioProject',JSON.stringify({title:p.title,show:p.show_name||'',showId:p.podcast_id||'',notes:p.notes||'',updatedAt:p.updated_at||new Date().toISOString(),id:p.id}));if(currentProjectId)localStorage.setItem('crowrulesStudioCloudProjectId',currentProjectId)}catch(_){}
    const st=$('saveStatus');if(st)st.textContent=`Loaded cloud project · ${p.project_status||'draft'}.`;
    if(p.audio_path)await restoreProjectAudio(p);
    else {const status=$('mixStatus');if(status)status.textContent='Project details resumed. No finished mix has been saved to this project yet.'}
  }
  async function saveProject({finalize=false}={}){
    if(!client||!currentUser)throw Error('Sign in to save projects to Supabase.');
    const mix=window.CrowRulesStudioMix?.getMix?.();if(finalize&&!mix?.blob)throw Error('Build or restore the finished episode mix before finalizing.');
    const payload=projectPayload(finalize?'finalized':(projects.find(p=>p.id===currentProjectId)?.project_status==='published'?'published':'draft'));
    let result;
    if(currentProjectId){result=await client.from('crowrules_studio_projects').update(payload).eq('id',currentProjectId).eq('owner_id',currentUser.id).select('id').maybeSingle();if(result.error)throw Error('Cloud save failed: '+result.error.message);if(!result.data)currentProjectId=null}
    if(!currentProjectId){result=await client.from('crowrules_studio_projects').insert({...payload,owner_id:currentUser.id}).select('id').single();if(result.error)throw Error('Cloud save failed: '+result.error.message);currentProjectId=result.data.id}
    if(mix?.blob){const path=`${currentUser.id}/projects/${currentProjectId}/episode-mix.wav`;const {error:uploadError}=await client.storage.from(privateBucket).upload(path,mix.blob,{contentType:'audio/wav',upsert:true});if(uploadError)throw Error('Project details saved, but audio upload failed: '+uploadError.message);
      const {error:updateError}=await client.from('crowrules_studio_projects').update({audio_path:path,storage_bucket:privateBucket,mix_duration_seconds:Math.round(mix.duration||0),project_status:finalize?'finalized':payload.project_status,updated_at:new Date().toISOString()}).eq('id',currentProjectId).eq('owner_id',currentUser.id);
      if(updateError)throw Error('Audio uploaded, but project audio metadata could not be saved: '+updateError.message);
    }
    try{localStorage.setItem('crowrulesStudioCloudProjectId',currentProjectId);localStorage.setItem('crowrulesStudioProject',JSON.stringify({...localProject(),id:currentProjectId}))}catch(_){}
    await loadProjects(currentProjectId);const st=$('saveStatus');if(st)st.textContent=`${finalize?'Finalized and saved to Supabase':'Saved to Supabase'} · ${new Date().toLocaleTimeString()}`;
    if(finalize&&$('finalizeStatus'))$('finalizeStatus').textContent='Finalized. Your episode mix is stored privately in Supabase and can be resumed later.';
    return currentProjectId;
  }
  async function loadExports(){
    if(!client||!currentUser)return;const el=$('cloudExports');if(!el)return;
    const {data,error}=await client.from('crowrules_studio_exports').select('id,title,show_name,audio_path,storage_bucket,file_bytes,created_at,delivery_status').eq('owner_id',currentUser.id).order('created_at',{ascending:false}).limit(20);
    if(error){el.textContent='Could not load exports: '+error.message;return}if(!data?.length){el.textContent='No cloud exports yet.';return}el.replaceChildren();
    for(const item of data){const div=document.createElement('div');div.className='cloud-export-item';const strong=document.createElement('strong');strong.textContent=item.title;const small=document.createElement('small');small.textContent=`${item.show_name||'Show not specified'} · ${item.delivery_status==='published'?'Published':'Private draft'} · ${new Date(item.created_at).toLocaleString()} · ${Math.round((item.file_bytes||0)/1024)} KB`;const a=document.createElement('a');a.href='#';a.textContent='Open audio';a.addEventListener('click',async e=>{e.preventDefault();let url;if((item.storage_bucket||privateBucket)===publicBucket)url=client.storage.from(publicBucket).getPublicUrl(item.audio_path).data.publicUrl;else{const res=await client.storage.from(privateBucket).createSignedUrl(item.audio_path,600);if(res.error){say(res.error.message,true);return}url=res.data.signedUrl}window.open(url,'_blank','noopener')});div.append(strong,small,a);el.append(div)}
  }
  async function uploadToShow(){
    if(!client||!currentUser)throw Error('Sign in before sending an episode.');const show=selectedShow();if(!show)throw Error('Choose the destination show.');
    const mix=window.CrowRulesStudioMix?.getMix?.();if(!mix?.blob)throw Error('Build or resume the finished episode mix first.');
    const projectId=await saveProject();const title=$('title').value.trim()||'Untitled Podcast Episode';const path=`${currentUser.id}/${show.id}/${Date.now()}-${slugify(title)}.wav`;
    say('Uploading the finished WAV to private storage…');const {error:uploadError}=await client.storage.from(privateBucket).upload(path,mix.blob,{contentType:'audio/wav',upsert:false});if(uploadError)throw Error('Private audio upload failed: '+uploadError.message);
    const {error:rowError}=await client.from('crowrules_studio_exports').insert({owner_id:currentUser.id,project_id:projectId,podcast_id:show.id,title,show_name:show.title,audio_path:path,storage_bucket:privateBucket,mime_type:'audio/wav',file_bytes:mix.blob.size,duration_seconds:Math.round(mix.duration||0),delivery_status:'ready_for_show'});
    if(rowError)throw Error('Audio uploaded but its private draft record failed: '+rowError.message);await loadExports();return {projectId,show};
  }
  async function publishToShow(){
    if(!client||!currentUser)throw Error('Sign in before publishing.');const show=selectedShow();if(!show)throw Error('Choose the destination show.');
    if(show.status!=='published')throw Error(`“${show.title}” is a draft show. Publish the show first, or save this as a private draft.`);
    const mix=window.CrowRulesStudioMix?.getMix?.();if(!mix?.blob)throw Error('Build or resume the finished episode mix first.');
    const projectId=await saveProject({finalize:true});const title=$('title').value.trim()||'Untitled Podcast Episode';const description=$('notes').value.trim();const slug=`${slugify(title)}-${Date.now().toString(36)}`;const path=`${currentUser.id}/${show.id}/${Date.now()}-${slugify(title)}.wav`;
    say('Uploading episode audio to the public podcast media bucket…');const {error:uploadError}=await client.storage.from(publicBucket).upload(path,mix.blob,{contentType:'audio/wav',upsert:false});if(uploadError)throw Error('Public episode audio upload failed: '+uploadError.message);
    const audioUrl=client.storage.from(publicBucket).getPublicUrl(path).data.publicUrl;
    const {data:episode,error:episodeError}=await client.from('podcast_episodes').insert({podcast_id:show.id,title,slug,description,show_notes:description||null,duration_seconds:Math.round(mix.duration||0),audio_url:audioUrl,status:'published',is_published:true,published_at:new Date().toISOString(),release_date:new Date().toISOString().slice(0,10)}).select('id,title,slug,podcast_id').single();
    if(episodeError){await client.storage.from(publicBucket).remove([path]);throw Error('Audio uploaded, but the episode could not be published: '+episodeError.message)}
    const {error:exportError}=await client.from('crowrules_studio_exports').insert({owner_id:currentUser.id,project_id:projectId,podcast_id:show.id,episode_id:episode.id,title,show_name:show.title,audio_path:path,storage_bucket:publicBucket,mime_type:'audio/wav',file_bytes:mix.blob.size,duration_seconds:Math.round(mix.duration||0),delivery_status:'published'});
    await client.from('crowrules_studio_projects').update({project_status:'published',updated_at:new Date().toISOString()}).eq('id',projectId).eq('owner_id',currentUser.id);
    await loadProjects(projectId);await loadExports();if(exportError)console.warn('Episode published, export history row failed:',exportError.message);return {episode,show};
  }
  async function deliver(){
    const mode=document.querySelector('input[name="deliveryMode"]:checked')?.value||'download';const status=$('deliveryStatus');const mix=window.CrowRulesStudioMix?.getMix?.();if(!mix?.blob){status.textContent='Build or resume the episode mix first.';return}
    if(mode==='download'){window.CrowRulesStudioMix.download();status.textContent='Download started. Nothing was uploaded.';return}
    const button=$('deliverMix');button.disabled=true;button.textContent=mode==='send'?'Saving private draft…':'Publishing…';
    try{if(mode==='send'){const {show}=await uploadToShow();status.textContent=`Saved a private audio draft for ${show.title}. It is not public.`}else{const {episode,show}=await publishToShow();status.textContent=`Published “${episode.title}” to ${show.title}. Public audio and episode metadata are stored in Supabase.`;if(mode==='both')window.CrowRulesStudioMix.download()}}
    catch(e){status.textContent=e.message||'Could not deliver episode.';say(status.textContent,true)}finally{button.disabled=false;button.textContent='Continue'}
  }
  async function newProject(){
    currentProjectId=null;try{localStorage.removeItem('crowrulesStudioCloudProjectId')}catch(_){}
    if($('title'))$('title').value='Untitled Podcast Session';if($('notes'))$('notes').value='';if($('show'))$('show').value='';
    window.CrowRulesStudioMix?.clearRestoredMix?.();if($('savedProjectSelect'))$('savedProjectSelect').value='';
    if($('saveStatus'))$('saveStatus').textContent='New project · not saved yet.';if($('finalizeStatus'))$('finalizeStatus').textContent='Save or finalize to store this project in Supabase.';
  }
  async function refreshAccount(preferredId=''){
    if(!currentUser){shows=[];projects=[];currentProjectId=null;setStatus('SIGNED OUT');setAccountUI('SIGNED OUT','Sign in with your CrowRules account to load your shows, projects, and saved audio.');renderShowOptions();const picker=$('savedProjectSelect');if(picker)picker.replaceChildren(new Option('Sign in to load projects',''));return}
    setStatus('CHECKING MEMBER');setAccountUI('CHECKING MEMBER','Checking your login against the CrowRules member and creator records…');
    try{await loadShows(preferredId);const requestedProject=new URLSearchParams(window.location.search).get('project');await loadProjects(requestedProject||'');await loadExports();const savedId=requestedProject||preferredId||localStorage.getItem('crowrulesStudioCloudProjectId');if(savedId){const p=projects.find(x=>x.id===savedId);if(p)await applyProject(p)}else{const local=JSON.parse(localStorage.getItem('crowrulesStudioProject')||'null');if(local){if(local.showId&&shows.some(s=>s.id===local.showId)&&$('show'))$('show').value=local.showId;if($('title'))$('title').value=local.title||$('title').value;if($('notes'))$('notes').value=local.notes||''}}}
    catch(e){setStatus('MEMBER CHECK ERROR');setAccountUI('MEMBER CHECK ERROR',e.message||'Could not verify this member session.');say(e.message,true)}
  }
  async function init(){
    const toggle=$('accountToggle'),panel=$('accountPanel'),form=$('studioSignInForm');
    toggle?.addEventListener('click',()=>{if(currentUser){showAuthPanel();if($('signedInActions'))$('signedInActions').hidden=false;if(form)form.hidden=true}else if(panel?.hidden)showAuthPanel();else if(panel)panel.hidden=true});
    $('accountCancel')?.addEventListener('click',()=>{if(panel)panel.hidden=true});
    $('signOutButton')?.addEventListener('click',async()=>{if(!client)return;const b=$('signOutButton');if(b)b.disabled=true;try{const {error}=await client.auth.signOut();if(error)throw error;if(panel)panel.hidden=true;setAccountUI('SIGNED OUT','You have signed out.')}catch(e){setAccountUI('SIGN OUT FAILED',e.message);say(e.message,true)}finally{if(b)b.disabled=false}});
    form?.addEventListener('submit',async e=>{e.preventDefault();if(!client){$('authNotice').textContent='Supabase is not connected.';return}const email=$('signInEmail')?.value.trim(),password=$('signInPassword')?.value;const button=$('signInSubmit'),notice=$('authNotice');if(button){button.disabled=true;button.textContent='Signing in…'}if(notice){notice.textContent='Verifying credentials with Supabase Auth…';notice.classList.remove('error')}try{const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;session=data.session;currentUser=data.user||data.session?.user||null;if(panel)panel.hidden=true;await refreshAccount()}catch(err){if(notice){notice.textContent=err.message||'Sign-in failed.';notice.classList.add('error')}setStatus('SIGN IN FAILED');setAccountUI('SIGN IN FAILED',err.message||'Sign-in failed.');if(panel)panel.hidden=false}finally{if(button){button.disabled=false;button.textContent='Sign in securely'}}});
    $('show')?.addEventListener('change',()=>{try{localStorage.setItem('crowrulesStudioProject',JSON.stringify(localProject()))}catch(_){}});
    $('savedProjectSelect')?.addEventListener('change',async()=>{const p=projects.find(x=>x.id===$('savedProjectSelect').value);if(p){try{await applyProject(p)}catch(e){say(e.message,true)}}});
    $('deliverMix')?.addEventListener('click',deliver);$('save')?.addEventListener('click',async()=>{const b=$('save');if(b)b.disabled=true;try{await saveProject();say('Project saved to Supabase.',false)}catch(e){const st=$('saveStatus');if(st)st.textContent=e.message;say(e.message,true)}finally{if(b)b.disabled=false}});
    $('finalizeProject')?.addEventListener('click',async()=>{const b=$('finalizeProject');if(b){b.disabled=true;b.textContent='Finalizing…'}try{await saveProject({finalize:true})}catch(e){say(e.message,true);if($('finalizeStatus'))$('finalizeStatus').textContent=e.message}finally{if(b){b.disabled=false;b.textContent='Finalize & save audio'}}});
    $('newProject')?.addEventListener('click',newProject);
    if(!cfg||!window.supabase?.createClient){setStatus('SUPABASE NOT LOADED');setAccountUI('CONNECTION ERROR','Supabase client could not load. Check the network and public configuration.');return}
    client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data,error}=await client.auth.getSession();if(error){setStatus('SESSION ERROR');setAccountUI('SESSION ERROR',error.message);return}session=data.session;currentUser=session?.user||null;await refreshAccount();
    if(new URLSearchParams(window.location.search).get('signin')==='1'&&!currentUser)showAuthPanel();
    client.auth.onAuthStateChange((_event,newSession)=>{session=newSession;currentUser=newSession?.user||null;if(!currentUser){currentProjectId=null;refreshAccount().catch(e=>say(e.message,true))}else{setAccountUI('CHECKING MEMBER','Login detected. Verifying your member profile…');refreshAccount().catch(e=>say(e.message,true))}});
  }
  init().catch(e=>{setStatus('ERROR');say(e.message,true)});
  window.CrowRulesCloud={saveProject,uploadToShow,publishToShow,loadProjects,loadShows,newProject};
})();