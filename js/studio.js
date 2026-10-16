(() => {
'use strict';
const cfg = window.CROW_CONFIG || {};
const supabaseUrl = cfg.supabaseUrl;
const supabaseKey = cfg.supabaseKey;
const BUCKET = 'studio-recordings';
const $ = id => document.getElementById(id);
const state = { client:null, user:null, devices:[], tracks:[], master:null, audioContext:null, destination:null, startedAt:0, elapsedBeforePause:0, timerInterval:null, raf:null, saved:[], busy:false };
const say = (message, error=false) => { const el=$('status'); el.textContent=message; el.classList.toggle('error',!!error); };
const fmt = seconds => { seconds=Math.max(0,Math.floor(seconds)); return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':'); };
const slug = s => (s||'episode').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'episode';
const safeName = s => (s||'track').replace(/[^a-z0-9_-]+/gi,'-').slice(0,40)||'track';
function client(){ if(!supabaseUrl||!supabaseKey||!window.supabase){throw new Error('Supabase browser configuration was not found in config.js.');} return window.supabase.createClient(supabaseUrl,supabaseKey); }
async function init(){
 try {
  state.client=client();
  const {data:{session},error}=await state.client.auth.getSession(); if(error) throw error;
  if(!session){$('authState').textContent='Not signed in';say('Please sign in to CrowRules Podcasting, then reopen Studio.');$('savedList').innerHTML='<div class="message">Sign-in required. <a href="creator.html" style="color:var(--cyan)">Return to creator dashboard →</a></div>';return;}
  state.user=session.user; $('authState').textContent='Signed in · '+(session.user.email||'Creator account');
  await loadPodcasts(); await loadSaved(); await refreshDevices();
 } catch(e){say(e.message||String(e),true);}
}
async function loadPodcasts(){
 const {data:member,error:me}=await state.client.from('members').select('id').eq('user_id',state.user.id).maybeSingle();
 if(me) throw me;
 if(!member){$('podcastSelect').innerHTML='<option value="">No linked creator profile found</option>';return;}
 const {data:creators,error:ce}=await state.client.from('creators').select('id').eq('member_id',member.id);
 if(ce) throw ce;
 const ids=(creators||[]).map(x=>x.id); if(!ids.length){$('podcastSelect').innerHTML='<option value="">No linked creator profile found</option>';return;}
 const {data:shows,error:pe}=await state.client.from('podcasts').select('id,title,status').in('creator_id',ids).order('title');
 if(pe) throw pe;
 $('podcastSelect').innerHTML='<option value="">Private recording — choose later</option>';
 (shows||[]).forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.title+(p.status==='draft'?' · Draft':'');$('podcastSelect').append(o);});
}
async function refreshDevices(){
 try{
  if(!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone recording requires a supported browser on HTTPS or localhost.');
  const permission=await navigator.mediaDevices.getUserMedia({audio:true}); permission.getTracks().forEach(t=>t.stop());
  const all=await navigator.mediaDevices.enumerateDevices(); state.devices=all.filter(d=>d.kind==='audioinput');
  const select=$('inputSelect'); select.innerHTML='';
  state.devices.forEach((d,i)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||'Microphone '+(i+1);select.append(o);});
  if(!state.devices.length) select.innerHTML='<option value="">No microphones found</option>';
  say('Microphone access is ready. Add a track for each input you want to record.');
 }catch(e){say(e.message||String(e),true);}
}
function drawWave(){
 const canvas=$('waveform'),ctx=canvas.getContext('2d');
 const resize=()=>{const dpr=window.devicePixelRatio||1;canvas.width=canvas.clientWidth*dpr;canvas.height=canvas.clientHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);};
 resize();window.addEventListener('resize',resize);
 const draw=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(57,231,255,.16)';ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();let active=state.tracks.filter(t=>t.analyser&&t.recorder&&t.recorder.state==='recording');if(!active.length&&state.master?.analyser&&state.master.recorder?.state==='recording')active=[state.master];active.forEach((t,idx)=>{const a=t.analyser;const data=new Uint8Array(a.fftSize);a.getByteTimeDomainData(data);ctx.beginPath();ctx.lineWidth=1.5;ctx.strokeStyle=idx%2?'#9b6cff':'#39e7ff';data.forEach((v,i)=>{const x=i/(data.length-1)*w;const y=(v/255)*h;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();});state.raf=requestAnimationFrame(draw);};
 draw();
}
function renderTracks(){
 const root=$('tracks');root.innerHTML='';$('trackCount').textContent=state.tracks.length+' track'+(state.tracks.length===1?'':'s');
 if(!state.tracks.length){root.innerHTML='<div class="message">No tracks added yet. Select a microphone above and choose “Add microphone track”.</div>';return;}
 state.tracks.forEach((t,i)=>{const row=document.createElement('div');row.className='track';const info=document.createElement('div');const name=document.createElement('b');name.textContent=t.name;const sub=document.createElement('small');sub.textContent=t.status||'Ready';info.append(name,sub);const sel=document.createElement('select');sel.setAttribute('aria-label','Microphone for '+t.name);state.devices.forEach((d,n)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||'Microphone '+(n+1);sel.append(o);});sel.value=t.deviceId;sel.disabled=state.busy;sel.addEventListener('change',()=>{t.deviceId=sel.value;});const remove=document.createElement('button');remove.className='btn';remove.textContent='Remove';remove.disabled=state.busy;remove.addEventListener('click',()=>{t.stream?.getTracks().forEach(x=>x.stop());state.tracks=state.tracks.filter(x=>x!==t);renderTracks();});row.append(info,sel,remove);root.append(row);});
}
function addTrack(){
 if(state.busy)return;
 const deviceId=$('inputSelect').value;if(!deviceId){say('Choose a microphone first.',true);return;}
 if(state.tracks.some(t=>t.deviceId===deviceId)){say('That microphone is already assigned to a track. Choose another input or use the same device in your operating system mixer.',true);return;}
 state.tracks.push({id:crypto.randomUUID(),name:'Track '+(state.tracks.length+1),deviceId,stream:null,recorder:null,chunks:[],blob:null,status:'Ready',analyser:null,source:null});
 renderTracks();
}
function recorderFor(stream,trackName){
 const types=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'];
 const mime=types.find(t=>MediaRecorder.isTypeSupported(t))||'';
 return new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
}
async function startRecording(){
 if(state.busy||!state.user)return;
 if(!state.tracks.length){say('Add at least one microphone track before recording.',true);return;}
 if(!window.MediaRecorder){say('This browser does not support MediaRecorder.',true);return;}
 state.busy=true;renderTracks();$('startBtn').disabled=true;
 try{
  state.audioContext=new (window.AudioContext||window.webkitAudioContext)();
  state.destination=state.audioContext.createMediaStreamDestination();
  for(const t of state.tracks){
   t.stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:t.deviceId},echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
   t.chunks=[];t.blob=null;t.source=state.audioContext.createMediaStreamSource(t.stream);t.analyser=state.audioContext.createAnalyser();t.analyser.fftSize=1024;t.source.connect(t.analyser);t.source.connect(state.destination);
   t.recorder=recorderFor(t.stream,t.name);t.recorder.ondataavailable=e=>{if(e.data?.size)t.chunks.push(e.data);};t.recorder.onstop=()=>{t.blob=new Blob(t.chunks,{type:t.recorder.mimeType||'audio/webm'});t.status='Captured · '+(t.blob.size/1024/1024).toFixed(1)+' MB';renderTracks();};
  }
  const mixStream=state.destination.stream;
  state.master={name:'Master mix',stream:mixStream,chunks:[],blob:null,recorder:recorderFor(mixStream,'Master mix'),analyser:state.tracks[0]?.analyser};
  state.master.recorder.ondataavailable=e=>{if(e.data?.size)state.master.chunks.push(e.data);};
  state.master.recorder.onstop=()=>{state.master.blob=new Blob(state.master.chunks,{type:state.master.recorder.mimeType||'audio/webm'});};
  state.tracks.forEach(t=>{t.recorder.start(1000);t.status='Recording';});state.master.recorder.start(1000);
  state.startedAt=Date.now();state.elapsedBeforePause=0;state.timerInterval=setInterval(()=>{$('timer').textContent=fmt(state.elapsedBeforePause+(state.startedAt?((Date.now()-state.startedAt)/1000):0));},250);
  $('pauseBtn').disabled=false;$('stopBtn').disabled=false;$('pauseBtn').textContent='Ⅱ Pause';say('Recording. Keep this browser tab open. All tracks are captured separately plus the master mix.');
 }catch(e){cleanupStreams();say('Could not start every track: '+(e.message||e)+'. Check device permissions and try again.',true);}
 finally{state.busy=false;renderTracks();$('startBtn').disabled=false;}
}
function pauseRecording(){
 const recs=[...state.tracks.map(t=>t.recorder),state.master?.recorder].filter(Boolean);
 if(recs.some(r=>r.state==='recording')){recs.forEach(r=>{if(r.state==='recording')r.pause();});state.elapsedBeforePause+=(Date.now()-state.startedAt)/1000;state.startedAt=0;clearInterval(state.timerInterval);$('pauseBtn').textContent='▶ Resume';say('Recording paused.');}
 else if(recs.some(r=>r.state==='paused')){recs.forEach(r=>{if(r.state==='paused')r.resume();});state.startedAt=Date.now();state.timerInterval=setInterval(()=>{$('timer').textContent=fmt(state.elapsedBeforePause+(Date.now()-state.startedAt)/1000);},250);$('pauseBtn').textContent='Ⅱ Pause';say('Recording resumed.');}
}
function cleanupStreams(){state.tracks.forEach(t=>t.stream?.getTracks().forEach(x=>x.stop()));state.master?.stream?.getTracks().forEach(x=>x.stop());if(state.audioContext&&state.audioContext.state!=='closed')state.audioContext.close().catch(()=>{});state.audioContext=null;}
async function stopRecording(){
 const recs=[...state.tracks.map(t=>t.recorder),state.master?.recorder].filter(Boolean);
 if(!recs.some(r=>r.state==='recording'||r.state==='paused'))return;
 clearInterval(state.timerInterval);if(state.startedAt)state.elapsedBeforePause+=(Date.now()-state.startedAt)/1000;state.startedAt=0;$('timer').textContent=fmt(state.elapsedBeforePause);
 await Promise.all(recs.map(r=>new Promise(resolve=>{if(r.state==='inactive')return resolve();r.addEventListener('stop',resolve,{once:true});try{r.stop();}catch{resolve();}})));
 state.tracks.forEach(t=>t.stream?.getTracks().forEach(x=>x.stop()));state.master?.stream?.getTracks().forEach(x=>x.stop());
 if(state.audioContext&&state.audioContext.state!=='closed')await state.audioContext.close().catch(()=>{});state.audioContext=null;
 $('pauseBtn').disabled=true;$('stopBtn').disabled=true;$('startBtn').disabled=false;$('pauseBtn').textContent='Ⅱ Pause';
 state.tracks.forEach(t=>{t.status='Captured · '+((t.blob?.size||0)/1024/1024).toFixed(1)+' MB';});renderTracks();
 say('Recording stopped. Save session to upload the separate tracks and master mix privately.');
 showPreview();
}
function showPreview(){
 const root=$('savedList');const preview=document.createElement('div');preview.className='saved';const title=document.createElement('strong');title.textContent='Current take · not saved yet';preview.append(title);
 const master=state.master?.blob;if(master){const audio=document.createElement('audio');audio.controls=true;audio.src=URL.createObjectURL(master);audio.style.width='100%';preview.append(audio);}
 const save=document.createElement('button');save.className='btn primary';save.textContent='Save private recording';save.style.marginTop='10px';save.addEventListener('click',()=>saveRecording(save));preview.append(save);root.prepend(preview);
}
async function saveRecording(button){
 if(state.busy)return;const all=[...state.tracks.filter(t=>t.blob?.size),...(state.master?.blob?.size?[state.master]:[])];
 if(!all.length){say('No captured audio found. Record a take first.',true);return;}
 state.busy=true;button.disabled=true;
 const title=$('sessionTitle').value.trim()||'Untitled recording';const podcastId=$('podcastSelect').value||null;const recordingId=crypto.randomUUID();const uploaded=[];
 try{
  for(let i=0;i<all.length;i++){
   const t=all[i];const ext=(t.blob.type.includes('mp4')?'mp4':t.blob.type.includes('ogg')?'ogg':'webm');
   const path=state.user.id+'/'+recordingId+'/'+(t.name==='Master mix'?'master-mix':safeName(t.name))+'.'+ext;
   say('Uploading '+(i+1)+' of '+all.length+': '+t.name+'…');
   const {error}=await state.client.storage.from(BUCKET).upload(path,t.blob,{contentType:(t.blob.type||'audio/webm').split(';')[0],upsert:false});if(error)throw error;
   uploaded.push({name:t.name,path,mime_type:t.blob.type||'audio/webm',size_bytes:t.blob.size,role:t.name==='Master mix'?'master':'track'});
  }
  const duration=Math.round(state.elapsedBeforePause);
  const {data:row,error}=await state.client.from('studio_recordings').insert({id:recordingId,owner_user_id:state.user.id,podcast_id:podcastId,title,status:'saved',duration_seconds:duration,tracks:uploaded}).select().single();if(error)throw error;
  say('Saved privately. '+uploaded.length+' audio files uploaded. You can create an episode draft below.');
  await loadSaved();
 }catch(e){
  if(uploaded.length){await state.client.storage.from(BUCKET).remove(uploaded.map(x=>x.path)).catch(()=>{});}
  say('Save failed: '+(e.message||String(e))+' — any uploaded partial files were queued for cleanup and remain private.',true);
 }finally{state.busy=false;button.disabled=false;}
}
async function loadSaved(){
 const {data,error}=await state.client.from('studio_recordings').select('id,title,status,duration_seconds,tracks,created_at,podcast_id').neq('status','deleted').order('created_at',{ascending:false}).limit(25);
 if(error)throw error;state.saved=data||[];const root=$('savedList');root.innerHTML='';
 if(!state.saved.length){root.innerHTML='<div class="message">No saved recordings yet. Your private sessions will show here.</div>';return;}
 state.saved.forEach(row=>{const card=document.createElement('div');card.className='saved';const strong=document.createElement('strong');strong.textContent=row.title;const p=document.createElement('p');p.textContent=fmt(row.duration_seconds)+' · '+(row.tracks||[]).length+' files · '+row.status+' · '+new Date(row.created_at).toLocaleString();card.append(strong,p);
  const master=(row.tracks||[]).find(t=>t.role==='master');if(master){const play=document.createElement('button');play.className='btn';play.textContent='▶ Preview master mix';play.addEventListener('click',async()=>{try{const {data,error}=await state.client.storage.from(BUCKET).createSignedUrl(master.path,300);if(error)throw error;const audio=document.createElement('audio');audio.controls=true;audio.src=data.signedUrl;audio.style.width='100%';play.replaceWith(audio);}catch(e){say('Could not create private preview: '+e.message,true);}});card.append(play);}
  if(row.podcast_id){const draft=document.createElement('button');draft.className='btn primary';draft.style.marginLeft='6px';draft.textContent='Create episode draft';draft.addEventListener('click',()=>createDraft(row,draft));card.append(draft);}
  else {const note=document.createElement('p');note.textContent='Select a podcast above and save a new session to link it, or choose a podcast in the draft form below.';card.append(note);const choose=document.createElement('select');choose.style.cssText='width:100%;margin:6px 0;background:#090a13;color:white;border:1px solid #ffffff22;padding:10px;border-radius:8px';choose.innerHTML=$('podcastSelect').innerHTML;card.append(choose);const draft=document.createElement('button');draft.className='btn primary';draft.textContent='Create episode draft';draft.addEventListener('click',()=>createDraft(row,draft,choose.value));card.append(draft);}
  root.append(card);
 });
}
async function createDraft(row,button,chosenPodcast){
 const podcastId=chosenPodcast||row.podcast_id||$('podcastSelect').value;if(!podcastId){say('Choose one of your podcasts before creating an episode draft.',true);return;}
 const {data:show,error:showErr}=await state.client.from('podcasts').select('id,title,creator_id').eq('id',podcastId).maybeSingle();if(showErr)throw showErr;if(!show){say('Podcast not found or not accessible.',true);return;}
 const {data:member,error:me}=await state.client.from('members').select('id').eq('user_id',state.user.id).maybeSingle();if(me)throw me;
 const {data:creator,error:ce}=await state.client.from('creators').select('id').eq('member_id',member?.id||'00000000-0000-0000-0000-000000000000');if(ce)throw ce;
 if(!(creator||[]).some(c=>c.id===show.creator_id)){say('You can only create episode drafts for podcasts linked to your creator account.',true);return;}
 const master=(row.tracks||[]).find(t=>t.role==='master');if(!master){say('This recording has no master mix track.',true);return;}
 button.disabled=true;
 try{
  const {data:episodes,error:countErr}=await state.client.from('podcast_episodes').select('episode_number').eq('podcast_id',podcastId).order('episode_number',{ascending:false}).limit(1);if(countErr)throw countErr;
  const next=(episodes?.[0]?.episode_number||0)+1;const episodeSlug=slug(row.title)+'-'+row.id.slice(0,8);
  const {data:episode,error}=await state.client.from('podcast_episodes').insert({podcast_id:podcastId,title:row.title,slug:episodeSlug,description:'Recorded in CrowRules Studio. Audio is private until the episode is reviewed and published.',episode_number:next,duration_seconds:row.duration_seconds,audio_url:master.path,status:'draft',is_published:false,is_active:true,access_level:'free'}).select('id').single();if(error)throw error;
  const {error:updateErr}=await state.client.from('studio_recordings').update({status:'draft_created',podcast_id:podcastId}).eq('id',row.id);if(updateErr)throw updateErr;
  say('Episode draft created for '+show.title+'. The recording remains private; publishing must preserve authenticated access to the private audio or copy it to your approved delivery bucket.');
  await loadSaved();
 }catch(e){say('Could not create episode draft: '+(e.message||String(e)),true);button.disabled=false;}
}
$('refreshDevices').addEventListener('click',refreshDevices);$('addTrack').addEventListener('click',addTrack);$('startBtn').addEventListener('click',startRecording);$('pauseBtn').addEventListener('click',pauseRecording);$('stopBtn').addEventListener('click',stopRecording);
window.addEventListener('beforeunload',e=>{if(state.tracks.some(t=>t.recorder&&t.recorder.state!=='inactive')){e.preventDefault();e.returnValue='Recording in progress';}});
drawWave();init();
})();