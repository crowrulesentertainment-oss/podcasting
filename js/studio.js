(() => {
'use strict';
const cfg = window.CROW_CONFIG || {};
const supabaseUrl = cfg.supabaseUrl;
const supabaseKey = cfg.supabaseKey;
const BUCKET = 'studio-recordings';
const $ = id => document.getElementById(id);
const state = { client:null, user:null, devices:[], tracks:[], master:null, openingFile:null, endingFile:null, openingBuffer:null, endingBuffer:null, openingSource:null, endingSource:null, openingGain:0.7, endingGain:0.7, previewSource:null, audioContext:null, destination:null, startedAt:0, elapsedBeforePause:0, timerInterval:null, raf:null, saved:[], resumeRow:null, resumeMasterBlob:null, busy:false };
const say = (message, error=false) => { const el=$('status'); el.textContent=message; el.classList.toggle('error',!!error); };
const fmt = seconds => { seconds=Math.max(0,Math.floor(seconds)); return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':'); };
const slug = s => (s||'episode').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'episode';
const safeName = s => (s||'track').replace(/[^a-z0-9_-]+/gi,'-').slice(0,40)||'track';
function client(){ if(!supabaseUrl||!supabaseKey||!window.supabase){throw new Error('Supabase browser configuration was not found in config.js.');} return window.supabase.createClient(supabaseUrl,supabaseKey); }
async function init(){
 const auth=$('authState');let watchdog=setTimeout(()=>{if(auth&&auth.textContent==='Checking account…'){auth.textContent='Account check timed out';say('The sign-in check is taking too long. Check your connection and Supabase config, then reload. Your browser-local draft tools may still be available.',true);}},9000);
 try {
  state.client=client();
  const authResult=await Promise.race([state.client.auth.getSession(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Account check timed out. Verify config.js and Supabase availability, then reload.')),8500))]);
  const {data:{session},error}=authResult;if(error)throw error;
  if(!session){$('authState').textContent='Not signed in';say('You are not signed in. Sign in through the creator dashboard, then return to Audio Studio.');$('savedList').innerHTML='<div class="message">Sign-in required. <a href="../creator.html" style="color:var(--cyan)">Sign in / return to creator dashboard →</a></div>';return;}
  state.user=session.user; $('authState').textContent='Signed in · '+(session.user.email||'Creator account');
  state.client.auth.onAuthStateChange((event,nextSession)=>{if(nextSession?.user){state.user=nextSession.user;if(auth)auth.textContent='Signed in · '+(nextSession.user.email||'Creator account')}else{state.user=null;if(auth)auth.textContent='Not signed in';$('savedList').innerHTML='<div class="message">Your session ended. Sign in again to access private recordings.</div>'}});
  await loadPodcasts(); await loadSaved(); await refreshDevices();
 } catch(e){if(auth)auth.textContent='Account unavailable';say(e.message||String(e),true);if($('savedList'))$('savedList').innerHTML='<div class="message">Could not verify your account. Check your connection and Supabase configuration, then reload. <a href="../creator.html" style="color:var(--cyan)">Return to creator dashboard →</a></div>';}
 finally{clearTimeout(watchdog)}
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
 const requestedPodcast=new URLSearchParams(location.search).get("podcast_id");if(requestedPodcast&&(shows||[]).some(p=>String(p.id)===requestedPodcast))$("podcastSelect").value=requestedPodcast;
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
 const draw=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(57,231,255,.16)';ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();let active=state.tracks.filter(t=>t.analyser&&t.recorder&&t.recorder.state==='recording');state.tracks.forEach(t=>{if(!t.analyser)return;const samples=new Uint8Array(t.analyser.fftSize);t.analyser.getByteTimeDomainData(samples);let sum=0,peak=0;samples.forEach(v=>{const n=(v-128)/128;sum+=n*n;peak=Math.max(peak,Math.abs(n));});const rms=Math.sqrt(sum/samples.length);const pct=Math.min(100,Math.round(rms*180));const fill=$('meter-'+t.id),db=$('db-'+t.id);if(fill){fill.style.width=pct+'%';fill.style.background=peak>.96?'#ff4f81':'linear-gradient(90deg,var(--cyan),var(--green) 75%,#ff4f81)';fill.parentElement.setAttribute('aria-valuenow',String(pct));}if(db)db.textContent=peak>.96?'CLIP':(rms>0?Math.round(20*Math.log10(rms))+' dB':'−∞ dB');});if(!active.length&&state.master?.analyser&&state.master.recorder?.state==='recording')active=[state.master];active.forEach((t,idx)=>{const a=t.analyser;const data=new Uint8Array(a.fftSize);a.getByteTimeDomainData(data);ctx.beginPath();ctx.lineWidth=1.5;ctx.strokeStyle=idx%2?'#9b6cff':'#39e7ff';data.forEach((v,i)=>{const x=i/(data.length-1)*w;const y=(v/255)*h;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();});state.raf=requestAnimationFrame(draw);};
 draw();
}
function renderTracks(){
 const root=$('tracks');root.innerHTML='';$('trackCount').textContent=state.tracks.length+' track'+(state.tracks.length===1?'':'s');
 if(!state.tracks.length){root.innerHTML='<div class="message">No tracks added yet. Select a microphone above and choose “Add microphone track”.</div>';return;}
 state.tracks.forEach((t,i)=>{
  const row=document.createElement('div');row.className='track';
  const info=document.createElement('div');
  const name=document.createElement('input');name.className='track-name';name.value=t.name;name.maxLength=60;name.setAttribute('aria-label','Track name');name.disabled=state.busy;
  name.addEventListener('input',()=>{t.name=name.value.trim()||('Track '+(i+1));});
  name.addEventListener('change',()=>{t.name=name.value.trim()||('Track '+(i+1));name.value=t.name;});
  const sub=document.createElement('div');sub.className='track-status';sub.textContent=t.status||'Ready';
  const meterWrap=document.createElement('div');meterWrap.className='meter-wrap';
  const meter=document.createElement('div');meter.className='level-meter';meter.setAttribute('role','meter');meter.setAttribute('aria-label',t.name+' input level');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');meter.setAttribute('aria-valuenow','0');
  const fill=document.createElement('div');fill.className='level-meter-fill';fill.id='meter-'+t.id;meter.append(fill);
  const db=document.createElement('span');db.className='level-db';db.id='db-'+t.id;db.textContent='— dB';
  meterWrap.append(meter,db);
  const volumeRow=document.createElement('div');volumeRow.style.cssText='display:grid;grid-template-columns:auto minmax(90px,1fr) auto;align-items:center;gap:10px;margin-top:9px;max-width:440px';
  const volumeLabel=document.createElement('label');volumeLabel.textContent='Mix volume';volumeLabel.style.cssText='font-size:12px;color:var(--muted)';
  const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='200';volume.step='5';volume.value=String(Math.round((t.mixGain??1)*100));volume.setAttribute('aria-label','Mix volume for '+t.name);volume.disabled=state.busy;
  const volumeValue=document.createElement('output');volumeValue.textContent=volume.value+'%';volumeValue.style.cssText='font-size:12px;min-width:42px;text-align:right;color:var(--cyan)';
  volume.addEventListener('input',()=>{const gain=Number(volume.value)/100;t.mixGain=gain;if(t.gainNode)t.gainNode.gain.setTargetAtTime(gain,t.gainNode.context.currentTime,.015);volumeValue.textContent=volume.value+'%';});
  volumeRow.append(volumeLabel,volume,volumeValue);info.append(name,sub,meterWrap,volumeRow);
  const sel=document.createElement('select');sel.setAttribute('aria-label','Microphone for '+t.name);
  state.devices.forEach((d,n)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||'Microphone '+(n+1);sel.append(o);});
  sel.value=t.deviceId;sel.disabled=state.busy;sel.addEventListener('change',()=>{t.deviceId=sel.value;});
  const remove=document.createElement('button');remove.className='btn';remove.textContent='Remove';remove.disabled=state.busy;
  remove.addEventListener('click',()=>{t.stream?.getTracks().forEach(x=>x.stop());state.tracks=state.tracks.filter(x=>x!==t);renderTracks();});
  row.append(info,sel,remove);root.append(row);
 });
}
async function setupBedTracks(){
 state.openingFile=$('openingFile').files?.[0]||null;
 state.endingFile=$('endingFile').files?.[0]||null;
 state.openingSource=null;state.endingSource=null;
 const getSaved=async id=>{
  if(!id)return null;
  for(const row of state.saved||[]){
   const track=(row.tracks||[]).find(t=>t.path===id);
   if(track)return {row,track};
  }
  return null;
 };
 if(!state.openingFile){state.openingSource=await getSaved($('openingSavedTrack').value);if(state.openingSource){const {data,error}=await state.client.storage.from(BUCKET).download(state.openingSource.track.path);if(error)throw error;state.openingFile=new File([data],state.openingSource.track.name||'saved-opening-track',{type:state.openingSource.track.mime_type||data.type||'audio/webm'});}}
 if(!state.endingFile){state.endingSource=await getSaved($('endingSavedTrack').value);if(state.endingSource){const {data,error}=await state.client.storage.from(BUCKET).download(state.endingSource.track.path);if(error)throw error;state.endingFile=new File([data],state.endingSource.track.name||'saved-ending-track',{type:state.endingSource.track.mime_type||data.type||'audio/webm'});}}
}
async function decodeOptionalTrack(file){
 if(!file)return null;
 const bytes=await file.arrayBuffer();
 return await state.audioContext.decodeAudioData(bytes.slice(0));
}
function playBuffer(buffer,role='opening',preview=false){
 if(!buffer||!state.audioContext||!state.destination)return null;
 if(preview&&state.previewSource){try{state.previewSource.stop();}catch{}state.previewSource=null;}
 const source=state.audioContext.createBufferSource();const gain=state.audioContext.createGain();
 source.buffer=buffer;gain.gain.value=role==='ending'?state.endingGain:state.openingGain;
 source.connect(gain);gain.connect(state.destination);source.start();
 if(preview){state.previewSource=source;source.onended=()=>{if(state.previewSource===source)state.previewSource=null;};}
 return source;
}
async function previewBed(role){
 if(state.busy||state.tracks.some(t=>t.recorder&&t.recorder.state!=='inactive')){say('Stop recording before previewing the music tracks.',true);return;}
 try{
  if(!state.user)throw new Error('Sign in before previewing private saved tracks.');
  state.busy=true;$('previewOpening').disabled=true;$('previewEnding').disabled=true;
  await setupBedTracks();state.audioContext=new (window.AudioContext||window.webkitAudioContext)();state.destination=state.audioContext.createMediaStreamDestination();
  const file=role==='ending'?state.endingFile:state.openingFile;const buffer=await decodeOptionalTrack(file);
  if(!buffer)throw new Error('Choose an uploaded or saved '+role+' track first.');
  if(state.audioContext.state==='suspended')await state.audioContext.resume();
  const source=state.audioContext.createBufferSource();const gain=state.audioContext.createGain();source.buffer=buffer;gain.gain.value=role==='ending'?state.endingGain:state.openingGain;source.connect(gain);gain.connect(state.audioContext.destination);source.start();
  source.onended=()=>{if(state.audioContext&&state.audioContext.state!=='closed')state.audioContext.close().catch(()=>{});state.audioContext=null;state.destination=null;state.previewSource=null;};
  state.previewSource=source;say('Previewing '+role+' music at '+Math.round((role==='ending'?state.endingGain:state.openingGain)*100)+'% volume.');
 }catch(e){say('Could not preview music: '+(e.message||e),true);if(state.audioContext&&state.audioContext.state!=='closed')await state.audioContext.close().catch(()=>{});state.audioContext=null;state.destination=null;}
 finally{state.busy=false;$('previewOpening').disabled=false;$('previewEnding').disabled=false;}
}
async function runSoundCheck(){
 if(state.busy||!state.user)return;
 if(!state.tracks.length){say('Add at least one microphone track before running the sound check.',true);return;}
 state.busy=true;$('soundCheckBtn').disabled=true;$('startBtn').disabled=true;
 const results=[];
 try{
  for(const t of state.tracks){
   $('soundCheckResult').textContent='Checking '+t.name+'… Please speak normally for about two seconds.';
   const stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:t.deviceId},echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
   const context=new (window.AudioContext||window.webkitAudioContext)();const source=context.createMediaStreamSource(stream);const analyser=context.createAnalyser();analyser.fftSize=2048;source.connect(analyser);
   const samples=new Uint8Array(analyser.fftSize);let sumSquares=0,count=0,peak=0;
   const started=Date.now();
   try{while(Date.now()-started<2200){analyser.getByteTimeDomainData(samples);for(let i=0;i<samples.length;i++){const n=(samples[i]-128)/128;sumSquares+=n*n;peak=Math.max(peak,Math.abs(n));count++;}await new Promise(resolve=>setTimeout(resolve,100));}}
   finally{stream.getTracks().forEach(track=>track.stop());source.disconnect();await context.close().catch(()=>{});}
   const rms=count?Math.sqrt(sumSquares/count):0;const db=rms>0?20*Math.log10(rms):-Infinity;
   results.push({name:t.name,db,peak});
  }
  $('soundCheckResult').textContent=results.map(x=>x.name+': '+(Number.isFinite(x.db)?x.db.toFixed(1)+' dB RMS':'no signal')+(x.peak>.96?' · possible clipping':x.db<-45?' · very quiet':' · signal detected')).join(' | ');
  say('Sound check complete. Speak at your normal recording distance and adjust your microphone or track mix as needed.');
 }catch(e){$('soundCheckResult').textContent='Sound check could not finish: '+(e.message||e);say('Sound check failed: '+(e.message||e),true);}
 finally{state.busy=false;$('soundCheckBtn').disabled=false;$('startBtn').disabled=false;}
}
function addTrack(){
 if(state.busy)return;
 const deviceId=$('inputSelect').value;if(!deviceId){say('Choose a microphone first.',true);return;}
 if(state.tracks.some(t=>t.deviceId===deviceId)){say('That microphone is already assigned to a track. Choose another input or use the same device in your operating system mixer.',true);return;}
 state.tracks.push({id:crypto.randomUUID(),name:'Track '+(state.tracks.length+1),deviceId,stream:null,recorder:null,chunks:[],blob:null,status:'Ready',analyser:null,source:null,gainNode:null,mixGain:1});
 renderTracks();
}
function recorderFor(stream,trackName){
 const types=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'];
 const mime=types.find(t=>MediaRecorder.isTypeSupported(t))||'';
 return new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
}
async function quickRecord(){
 if(state.busy||!state.user){say('Sign in to CrowRules Podcasting before recording.',true);return;}
 try{
  if(!state.devices.length)await refreshDevices();
  if(!$('inputSelect').value){say('Choose a microphone, then press Quick record again.',true);return;}
  if(!state.tracks.length)addTrack();
  await startRecording();
 }catch(e){say('Quick record could not start: '+(e.message||e),true);}
}
async function startRecording(){
 if(state.busy||!state.user)return;
 if(!state.tracks.length){say('Add at least one microphone track before recording.',true);return;}
 if(!window.MediaRecorder){say('This browser does not support MediaRecorder.',true);return;}
 state.busy=true;renderTracks();$('startBtn').disabled=true;
 try{
  await setupBedTracks();
  state.audioContext=new (window.AudioContext||window.webkitAudioContext)();
  state.destination=state.audioContext.createMediaStreamDestination();
  state.openingBuffer=await decodeOptionalTrack(state.openingFile);state.endingBuffer=await decodeOptionalTrack(state.endingFile);
  for(const t of state.tracks){
   t.stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:t.deviceId},echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
   t.chunks=[];t.blob=null;t.source=state.audioContext.createMediaStreamSource(t.stream);t.analyser=state.audioContext.createAnalyser();t.analyser.fftSize=1024;t.source.connect(t.analyser);t.gainNode=state.audioContext.createGain();t.mixGain=t.mixGain??1;t.gainNode.gain.value=t.mixGain;t.source.connect(t.gainNode);t.gainNode.connect(state.destination);
   t.recorder=recorderFor(t.stream,t.name);t.recorder.ondataavailable=e=>{if(e.data?.size)t.chunks.push(e.data);};t.recorder.onstop=()=>{t.blob=new Blob(t.chunks,{type:t.recorder.mimeType||'audio/webm'});t.status='Captured · '+(t.blob.size/1024/1024).toFixed(1)+' MB';renderTracks();};
  }
  const mixStream=state.destination.stream;
  state.master={name:'Master mix',stream:mixStream,chunks:[],blob:null,recorder:recorderFor(mixStream,'Master mix'),analyser:state.tracks[0]?.analyser};
  state.master.recorder.ondataavailable=e=>{if(e.data?.size)state.master.chunks.push(e.data);};
  state.master.recorder.onstop=()=>{state.master.blob=new Blob(state.master.chunks,{type:state.master.recorder.mimeType||'audio/webm'});};
  state.tracks.forEach(t=>{t.recorder.start(1000);t.status='Recording';});state.master.recorder.start(1000);
  if(state.openingBuffer)playBuffer(state.openingBuffer,'opening');
  state.startedAt=Date.now();state.elapsedBeforePause=Number(state.resumeRow?.duration_seconds||0);$('timer').textContent=fmt(state.elapsedBeforePause);const badge=$('recordingState');if(badge)badge.innerHTML='<span class="dot" style="background:#ff4f81"></span> Recording in progress';state.timerInterval=setInterval(()=>{$('timer').textContent=fmt(state.elapsedBeforePause+(state.startedAt?((Date.now()-state.startedAt)/1000):0));},250);
  $('pauseBtn').disabled=false;$('stopBtn').disabled=false;$('pauseBtn').textContent='Ⅱ Pause';say('Recording. Keep this browser tab open. All tracks are captured separately plus the master mix.');
 }catch(e){cleanupStreams();say('Could not start every track: '+(e.message||e)+'. Check device permissions and try again.',true);}
 finally{state.busy=false;renderTracks();$('startBtn').disabled=false;}
}
function pauseRecording(){
 const recs=[...state.tracks.map(t=>t.recorder),state.master?.recorder].filter(Boolean);
 if(recs.some(r=>r.state==='recording')){recs.forEach(r=>{if(r.state==='recording')r.pause();});state.elapsedBeforePause+=(Date.now()-state.startedAt)/1000;state.startedAt=0;clearInterval(state.timerInterval);$('pauseBtn').textContent='▶ Resume';const badge=$('recordingState');if(badge)badge.innerHTML='<span class="dot" style="background:#ffc857"></span> Paused · resume when ready';say('Recording paused.');}
 else if(recs.some(r=>r.state==='paused')){recs.forEach(r=>{if(r.state==='paused')r.resume();});state.startedAt=Date.now();state.timerInterval=setInterval(()=>{$('timer').textContent=fmt(state.elapsedBeforePause+(Date.now()-state.startedAt)/1000);},250);$('pauseBtn').textContent='Ⅱ Pause';const badge=$('recordingState');if(badge)badge.innerHTML='<span class="dot" style="background:#ff4f81"></span> Recording in progress';say('Recording resumed.');}
}
function cleanupStreams(){state.tracks.forEach(t=>t.stream?.getTracks().forEach(x=>x.stop()));state.master?.stream?.getTracks().forEach(x=>x.stop());if(state.audioContext&&state.audioContext.state!=='closed')state.audioContext.close().catch(()=>{});state.audioContext=null;}
async function stopRecording(){
 const recs=[...state.tracks.map(t=>t.recorder),state.master?.recorder].filter(Boolean);
 if(!recs.some(r=>r.state==='recording'||r.state==='paused'))return;
 if(state.endingBuffer&&state.audioContext){
  $('stopBtn').disabled=true;$('pauseBtn').disabled=true;
  [...state.tracks.map(t=>t.recorder),state.master?.recorder].filter(Boolean).forEach(r=>{if(r.state==='paused')r.resume();});
  if(!state.startedAt)state.startedAt=Date.now();
  say('Playing ending track into the master mix…');
  try{if(state.audioContext.state==='suspended')await state.audioContext.resume();playBuffer(state.endingBuffer,'ending');await new Promise(resolve=>setTimeout(resolve,state.endingBuffer.duration*1000+150));}catch(e){say('Ending track could not finish: '+(e.message||e)+'. Stopping recording now.',true);}
 }
 clearInterval(state.timerInterval);if(state.startedAt)state.elapsedBeforePause+=(Date.now()-state.startedAt)/1000;state.startedAt=0;$('timer').textContent=fmt(state.elapsedBeforePause);
 await Promise.all(recs.map(r=>new Promise(resolve=>{if(r.state==='inactive')return resolve();r.addEventListener('stop',resolve,{once:true});try{r.stop();}catch{resolve();}})));
 if(state.resumeMasterBlob&&state.master?.blob?.size){try{say('Combining this take with the previously saved master…');state.master.blob=await mergeAudioBlobs(state.resumeMasterBlob,state.master.blob);state.master.durationSeconds=Math.round(state.resumeRow?.duration_seconds||0)+Math.round(Math.max(0,state.elapsedBeforePause-(state.resumeRow?.duration_seconds||0)));}catch(e){say('Could not combine the previous master automatically: '+(e.message||e)+'. This new take can still be saved separately.',true);state.elapsedBeforePause=Math.max(0,state.elapsedBeforePause-Number(state.resumeRow?.duration_seconds||0));state.resumeRow=null;state.resumeMasterBlob=null;}}
 state.tracks.forEach(t=>t.stream?.getTracks().forEach(x=>x.stop()));state.master?.stream?.getTracks().forEach(x=>x.stop());
 if(state.audioContext&&state.audioContext.state!=='closed')await state.audioContext.close().catch(()=>{});state.audioContext=null;
 $('pauseBtn').disabled=true;$('stopBtn').disabled=true;$('startBtn').disabled=false;$('pauseBtn').textContent='Ⅱ Pause';const badge=$('recordingState');if(badge)badge.innerHTML='<span class="dot"></span> Take captured · review below';
 state.tracks.forEach(t=>{t.status='Captured · '+((t.blob?.size||0)/1024/1024).toFixed(1)+' MB';});renderTracks();
 say('Recording stopped. Save session to upload the separate tracks and master mix privately.');
 showPreview();
}
function bytesLabel(bytes){
 if(!Number.isFinite(bytes)||bytes<0)return '—';
 if(bytes<1024)return bytes+' B';
 const units=['KB','MB','GB'];let value=bytes/1024,index=0;
 while(value>=1024&&index<units.length-1){value/=1024;index++;}
 return value.toFixed(value>=100?0:value>=10?1:2)+' '+units[index];
}
function encodeWav(buffer){
 const channels=buffer.numberOfChannels,samples=buffer.length,rate=buffer.sampleRate,bytes=44+samples*channels*2;
 const out=new ArrayBuffer(bytes),view=new DataView(out);
 const write=(offset,str)=>{for(let i=0;i<str.length;i++)view.setUint8(offset+i,str.charCodeAt(i));};
 write(0,'RIFF');view.setUint32(4,bytes-8,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);view.setUint32(28,rate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,bytes-44,true);
 const data=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));let offset=44;
 for(let i=0;i<samples;i++)for(let c=0;c<channels;c++){const sample=Math.max(-1,Math.min(1,data[c][i]));view.setInt16(offset,sample<0?sample*32768:sample*32767,true);offset+=2;}
 return new Blob([out],{type:'audio/wav'});
}
async function applyMasterEdit(button,player,startInput,endInput,fadeInInput,fadeOutInput,notice){
 const sourceBlob=state.master?.originalBlob||state.master?.blob;if(!sourceBlob?.size)return;
 const originalLabel=button.textContent;button.disabled=true;button.textContent='Processing audio…';
 try{
  const bytes=await sourceBlob.arrayBuffer();const decodeContext=new (window.AudioContext||window.webkitAudioContext)();let decoded;
  try{decoded=await decodeContext.decodeAudioData(bytes);}finally{await decodeContext.close().catch(()=>{});}
  const duration=decoded.duration;const start=Math.max(0,Math.min(duration,Number(startInput.value)||0));const endRaw=endInput.value===''?duration:Number(endInput.value);const end=Math.max(0,Math.min(duration,endRaw));
  if(end<=start)throw new Error('Trim end must be later than trim start.');
  const clipDuration=end-start;const length=Math.max(1,Math.floor(clipDuration*decoded.sampleRate));const offline=new OfflineAudioContext(decoded.numberOfChannels,length,decoded.sampleRate);const source=offline.createBufferSource();source.buffer=decoded;const gain=offline.createGain();const fadeIn=Math.min(clipDuration,Math.max(0,Number(fadeInInput.value)||0));const fadeOut=Math.min(clipDuration-fadeIn,Math.max(0,Number(fadeOutInput.value)||0));const fadeOutStart=clipDuration-fadeOut;
  gain.gain.setValueAtTime(fadeIn>0?0:1,0);if(fadeIn>0)gain.gain.linearRampToValueAtTime(1,fadeIn);if(fadeOut>0){gain.gain.setValueAtTime(1,fadeOutStart);gain.gain.linearRampToValueAtTime(0,clipDuration);}
  source.connect(gain);gain.connect(offline.destination);source.start(0,start,clipDuration);const rendered=await offline.startRendering();const edited=encodeWav(rendered);
  state.master.originalBlob=state.master.originalBlob||state.master.blob;state.master.originalDurationSeconds=state.master.originalDurationSeconds||duration;state.master.blob=edited;state.master.durationSeconds=clipDuration;const originalButton=button.closest('.saved')?.querySelector('[data-original-download]');if(originalButton)originalButton.disabled=false;const restoreButton=button.closest('.saved')?.querySelector('[data-restore-master]');if(restoreButton)restoreButton.disabled=false;
  player.src=URL.createObjectURL(edited);player.load();notice.textContent='Edited master ready · '+fmt(clipDuration)+' · '+bytesLabel(edited.size)+' WAV. Original master is retained in memory; separate microphone tracks are unchanged.';
  say('Master edit applied. Preview the edited mix before saving.');
 }catch(e){notice.textContent='Could not edit master: '+(e.message||e);say('Master edit failed: '+(e.message||e),true);}
 finally{button.disabled=false;button.textContent=originalLabel;}
}
function downloadBlob(blob, filename){
 if(!blob?.size)return;
 const url=URL.createObjectURL(blob);const link=document.createElement('a');
 link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function showPreview(){
 const reviewPanel=$('reviewPanel');if(reviewPanel)reviewPanel.scrollIntoView({behavior:'smooth',block:'start'});
 const root=$('currentTakeHelp');if(!root)return;const preview=document.createElement('div');preview.className='saved';
 const title=document.createElement('strong');title.textContent='Current take · not saved yet';preview.append(title);
 const meta=document.createElement('p');const captured=[...state.tracks.filter(t=>t.blob?.size),...(state.master?.blob?.size?[state.master]:[])];const totalBytes=captured.reduce((sum,t)=>sum+(t.blob?.size||0),0);meta.textContent=fmt(state.elapsedBeforePause)+' · '+captured.length+' audio files · '+bytesLabel(totalBytes)+' total';preview.append(meta);
 const master=state.master?.blob;
 if(master){
  const audio=document.createElement('audio');audio.controls=true;audio.src=URL.createObjectURL(master);audio.style.width='100%';audio.setAttribute('aria-label','Preview master mix');preview.append(audio);
  const masterInfo=document.createElement('p');masterInfo.className='hint';masterInfo.textContent='Master mix · '+bytesLabel(master.size);preview.append(masterInfo);
  const editor=document.createElement('div');editor.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:10px;margin:14px 0;padding:14px;border:1px solid var(--line);border-radius:12px';
  const field=(labelText,min,max,step,value)=>{const wrap=document.createElement('label');wrap.style.cssText='display:grid;gap:5px;font-size:12px;color:var(--muted)';wrap.textContent=labelText;const input=document.createElement('input');input.type='number';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(value);input.style.width='100%';input.setAttribute('aria-label',labelText);wrap.append(input);editor.append(wrap);return input;};
  const trimStart=field('Trim start (seconds)',0,36000,.1,0);const trimEnd=field('Trim end (seconds; blank = full length)',0,36000,.1,'');trimEnd.value='';
  const fadeIn=field('Fade in (seconds)',0,30,.1,0);const fadeOut=field('Fade out (seconds)',0,30,.1,0);
  const editNotice=document.createElement('p');editNotice.className='hint';editNotice.style.gridColumn='1 / -1';editNotice.textContent='Trim and fade the master mix. Separate microphone takes remain untouched.';editor.append(editNotice);
  const apply=document.createElement('button');apply.className='btn primary';apply.textContent='Apply trim & fades';apply.style.gridColumn='1 / -1';apply.addEventListener('click',()=>applyMasterEdit(apply,audio,trimStart,trimEnd,fadeIn,fadeOut,editNotice));editor.append(apply);preview.append(editor);
  const masterDownload=document.createElement('button');masterDownload.className='btn';masterDownload.textContent='↓ Download current master';masterDownload.style.marginTop='8px';
  masterDownload.addEventListener('click',()=>downloadBlob(state.master?.blob,safeName($('sessionTitle').value||'recording')+'-master.'+((state.master?.blob?.type||'').includes('wav')?'wav':'webm')));preview.append(masterDownload);
  const originalDownload=document.createElement('button');originalDownload.className='btn';originalDownload.textContent='↓ Download original master';originalDownload.style.margin='8px 0 0 6px';originalDownload.disabled=!(state.master?.originalBlob?.size);originalDownload.dataset.originalDownload='true';originalDownload.addEventListener('click',()=>{const blob=state.master?.originalBlob;const ext=(blob?.type||'audio/webm').includes('wav')?'wav':(blob?.type||'').includes('mp4')?'m4a':'webm';downloadBlob(blob,safeName($('sessionTitle').value||'recording')+'-master-original.'+ext);});preview.append(originalDownload);const restore=document.createElement('button');restore.className='btn';restore.textContent='↶ Restore original master';restore.style.margin='8px 0 0 6px';restore.disabled=!(state.master?.originalBlob?.size);restore.dataset.restoreMaster='true';restore.addEventListener('click',()=>{const blob=state.master?.originalBlob;if(!blob?.size)return;state.master.blob=blob;state.master.durationSeconds=state.master.originalDurationSeconds||Math.round(state.elapsedBeforePause);audio.src=URL.createObjectURL(blob);audio.load();editNotice.textContent='Original master restored · '+bytesLabel(blob.size)+'. You can apply trim and fades again.';restore.disabled=true;say('Original master restored. Separate microphone tracks are unchanged.');});preview.append(restore);
 }
 const trackReview=document.createElement('div');trackReview.style.cssText='display:grid;gap:12px;margin-top:14px';
 state.tracks.filter(t=>t.blob?.size).forEach((track,index)=>{
  const item=document.createElement('div');item.style.cssText='padding:12px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.02)';
  const label=document.createElement('strong');label.textContent=(track.name||('Microphone track '+(index+1)))+' · '+bytesLabel(track.blob.size);item.append(label);
  const format=document.createElement('p');format.className='hint';format.textContent='Format: '+(track.blob.type||'Browser default audio format');item.append(format);
  const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=URL.createObjectURL(track.blob);audio.style.width='100%';audio.setAttribute('aria-label','Preview '+(track.name||('track '+(index+1))));item.append(audio);
  const link=document.createElement('button');link.className='btn';link.textContent='↓ Download track';link.addEventListener('click',()=>{const mime=(track.blob.type||'audio/webm').toLowerCase();const ext=mime.includes('wav')?'wav':mime.includes('mp4')?'m4a':mime.includes('ogg')?'ogg':mime.includes('mpeg')?'mp3':'webm';downloadBlob(track.blob,safeName($('sessionTitle').value||'recording')+'-'+safeName(track.name||('track-'+(index+1)))+'.'+ext);});item.append(link);
  trackReview.append(item);
 });
 if(trackReview.childElementCount)preview.append(trackReview);
 const downloadAll=document.createElement('button');downloadAll.className='btn';downloadAll.textContent='↓ Download all captured files';downloadAll.style.marginTop='10px';downloadAll.addEventListener('click',async()=>{const files=[...state.tracks.filter(t=>t.blob?.size).map((t,i)=>({blob:t.blob,name:safeName(t.name||('track-'+(i+1)))})),...(state.master?.blob?.size?[{blob:state.master.blob,name:'master-mix'}]:[])];if(!files.length){say('There are no captured audio files to download.',true);return;}downloadAll.disabled=true;try{for(let i=0;i<files.length;i++){const f=files[i];const mime=(f.blob.type||'audio/webm').toLowerCase();const ext=mime.includes('wav')?'wav':mime.includes('mp4')?'m4a':mime.includes('ogg')?'ogg':mime.includes('mpeg')?'mp3':'webm';downloadBlob(f.blob,safeName($('sessionTitle').value||'recording')+'-'+f.name+'.'+ext);say('Download '+(i+1)+' of '+files.length+': '+f.name);await new Promise(resolve=>setTimeout(resolve,350));}say('Download requests sent for '+files.length+' files. Check your browser downloads; some browsers may ask permission for multiple downloads.');}finally{downloadAll.disabled=false;}});preview.append(downloadAll);
 const save=document.createElement('button');save.className='btn primary';save.textContent='Save private recording';save.style.marginTop='10px';save.addEventListener('click',()=>saveRecording(save));preview.append(save);
 root.replaceChildren(preview);
}
async function saveRecording(button){
 if(state.busy)return;const all=[...state.tracks.filter(t=>t.blob?.size),...(state.master?.blob?.size?[state.master]:[])];
 if(!all.length){say('No captured audio found. Record a take first.',true);return;}
 state.busy=true;button.disabled=true;
 const title=$('sessionTitle').value.trim()||'Untitled recording';const podcastId=$('podcastSelect').value||null;const resuming=state.resumeRow;const recordingId=resuming?.id||crypto.randomUUID();const uploadFolder=recordingId+'/take-'+crypto.randomUUID();const uploaded=[];
 if(state.openingFile)all.push({name:'Opening track',blob:state.openingFile,role:'opening'});
 if(state.endingFile)all.push({name:'Ending track',blob:state.endingFile,role:'ending'});
 try{
  for(let i=0;i<all.length;i++){
   const t=all[i];const mime=(t.blob.type||'audio/webm').split(';')[0].toLowerCase();const ext=mime.includes('mp4')?'m4a':mime.includes('mpeg')?'mp3':mime.includes('wav')?'wav':mime.includes('aac')?'aac':mime.includes('ogg')?'ogg':'webm';
   const path=state.user.id+'/'+uploadFolder+'/'+(t.name==='Master mix'?'master-mix':safeName(t.name))+'-'+(i+1)+'.'+ext;
   say('Uploading '+(i+1)+' of '+all.length+': '+t.name+'…');
   const {error}=await state.client.storage.from(BUCKET).upload(path,t.blob,{contentType:(t.blob.type||'audio/webm').split(';')[0],upsert:false});if(error)throw error;
   uploaded.push({name:t.name,path,mime_type:t.blob.type||'audio/webm',size_bytes:t.blob.size,duration_seconds:t.name==='Master mix'?(state.master?.durationSeconds||Math.round(state.elapsedBeforePause)):undefined,role:t.role||(t.name==='Master mix'?'master':'track')});
  }
  const duration=Math.round(state.elapsedBeforePause);
  const mergedTracks=[...(resuming?.tracks||[]).filter(t=>t.role!=='master'),...uploaded];
  const payload={title,podcast_id:podcastId||resuming?.podcast_id||null,status:'saved',duration_seconds:duration,tracks:mergedTracks};
  let error;
  if(resuming){({error}=await state.client.from('studio_recordings').update(payload).eq('id',resuming.id).eq('owner_user_id',state.user.id));}
  else {({error}=await state.client.from('studio_recordings').insert({id:recordingId,owner_user_id:state.user.id,...payload}));}
  if(error)throw error;
  state.resumeRow=null;state.resumeMasterBlob=null;
  say((resuming?'Saved progress to the existing session. ':'Saved privately. ')+uploaded.length+' new audio files uploaded. You can continue later or create an episode draft.');
  await loadSaved();
 }catch(e){
  if(uploaded.length){await state.client.storage.from(BUCKET).remove(uploaded.map(x=>x.path)).catch(()=>{});}
  say('Save failed: '+(e.message||String(e))+' — any uploaded partial files were queued for cleanup and remain private.',true);
 }finally{state.busy=false;button.disabled=false;}
}
async function mergeAudioBlobs(firstBlob,secondBlob){
 const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)throw new Error('Audio decoding is not supported in this browser.');
 const ctx=new Ctx();
 try{
  const [a,b]=await Promise.all([firstBlob.arrayBuffer().then(x=>ctx.decodeAudioData(x.slice(0))),secondBlob.arrayBuffer().then(x=>ctx.decodeAudioData(x.slice(0)))]);
  const rate=Math.max(a.sampleRate,b.sampleRate),channels=Math.max(a.numberOfChannels,b.numberOfChannels);
  const offline=new OfflineAudioContext(channels,Math.ceil((a.duration+b.duration)*rate),rate);
  const makeSource=(buffer,offset)=>{const source=offline.createBufferSource();source.buffer=buffer;source.connect(offline.destination);source.start(offset);};
  makeSource(a,0);makeSource(b,a.duration);
  const merged=await offline.startRendering();return encodeWav(merged);
 }finally{await ctx.close().catch(()=>{});}
}

function populateSavedTrackOptions(){
 for(const id of ['openingSavedTrack','endingSavedTrack']){
  const select=$(id);const prior=select.value;select.innerHTML='<option value="">No saved track selected</option>';
  (state.saved||[]).forEach(row=>(row.tracks||[]).forEach(track=>{
   const option=document.createElement('option');option.value=track.path;
   option.textContent=row.title+' — '+(track.name||track.role||'Audio track');
   select.append(option);
  }));
  if([...select.options].some(o=>o.value===prior))select.value=prior;
 }
}
async function loadSaved(){
 const {data,error}=await state.client.from('studio_recordings').select('id,title,status,duration_seconds,tracks,created_at,podcast_id').neq('status','deleted').order('created_at',{ascending:false}).limit(25);
 if(error)throw error;state.saved=data||[];populateSavedTrackOptions();const root=$('savedList');root.innerHTML='';
 if(!state.saved.length){root.innerHTML='<div class="message">No saved recordings yet. Your private sessions will show here.</div>';return;}
 state.saved.forEach(row=>{const card=document.createElement('div');card.className='saved';const strong=document.createElement('strong');strong.textContent=row.title;const p=document.createElement('p');p.textContent=fmt(row.duration_seconds)+' · '+(row.tracks||[]).length+' files · '+row.status+' · '+new Date(row.created_at).toLocaleString();card.append(strong,p);
  const rename=document.createElement('button');rename.className='btn';rename.textContent='✎ Rename session';rename.style.margin='0 0 8px';rename.addEventListener('click',async()=>{if(state.busy)return;const proposed=window.prompt('Rename this private recording:',row.title||'Untitled recording');if(proposed===null)return;const title=proposed.trim().slice(0,160);if(!title){say('Enter a session title before saving.',true);return;}if(title===row.title)return;rename.disabled=true;const label=rename.textContent;rename.textContent='Saving…';try{const {error}=await state.client.from('studio_recordings').update({title}).eq('id',row.id).eq('owner_user_id',state.user.id);if(error)throw error;row.title=title;say('Recording renamed to “'+title+'”.');await loadSaved();}catch(e){say('Could not rename recording: '+(e.message||String(e)),true);rename.disabled=false;rename.textContent=label;}});card.append(rename);
  const backup=document.createElement('div');backup.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin:8px 0';
  (row.tracks||[]).forEach((track,index)=>{
   const download=document.createElement('button');download.className='btn';download.textContent='↓ '+(track.role==='master'?'Master':(track.name||track.role||('Track '+(index+1))));
   download.title='Download '+(track.name||track.role||'saved audio track');download.addEventListener('click',async()=>{
    if(download.disabled)return;download.disabled=true;const label=download.textContent;download.textContent='Preparing…';
    try{
     const {data,error}=await state.client.storage.from(BUCKET).download(track.path);if(error)throw error;
     const ext=(track.path.split('.').pop()||'webm').replace(/[^a-z0-9]/gi,'').slice(0,8)||'webm';
     downloadBlob(data,safeName(row.title||'recording')+'-'+safeName(track.name||track.role||('track-'+(index+1)))+'.'+ext);
     say('Downloaded '+(track.name||track.role||'audio track')+'.');
    }catch(e){say('Could not download saved track: '+(e.message||String(e)),true);}
    finally{download.disabled=false;download.textContent=label;}
   });backup.append(download);
  });
  if(backup.childElementCount)card.append(backup);
  const master=(row.tracks||[]).find(t=>t.role==='master');if(master){const play=document.createElement('button');play.className='btn';play.textContent='▶ Preview master mix';play.addEventListener('click',async()=>{try{const {data,error}=await state.client.storage.from(BUCKET).createSignedUrl(master.path,300);if(error)throw error;const audio=document.createElement('audio');audio.controls=true;audio.src=data.signedUrl;audio.style.width='100%';play.replaceWith(audio);}catch(e){say('Could not create private preview: '+e.message,true);}});card.append(play);}
  const resume=document.createElement('button');resume.className='btn';resume.style.marginLeft='6px';resume.textContent='Continue session';resume.addEventListener('click',()=>continueSavedSession(row,resume));card.append(resume);
  const choose=document.createElement('select');choose.setAttribute('aria-label','Podcast for new episode');choose.style.cssText='width:100%;margin:8px 0;background:#090a13;color:white;border:1px solid #ffffff22;padding:10px;border-radius:8px';choose.innerHTML=$('podcastSelect').innerHTML;if(row.podcast_id&&[...choose.options].some(o=>o.value===row.podcast_id))choose.value=row.podcast_id;card.append(choose);
  const draft=document.createElement('button');draft.className='btn primary';draft.textContent='＋ Add as new episode draft';draft.addEventListener('click',()=>createDraft(row,draft,choose.value));card.append(draft);
  root.append(card);
 });
}
async function continueSavedSession(row,button){
 if(state.busy||state.tracks.some(t=>t.recorder&&t.recorder.state!=='inactive')){say('Stop the current recording before continuing a saved session.',true);return;}
 const master=(row.tracks||[]).find(t=>t.role==='master');
 if(!master){say('This saved session has no master mix to continue. Save a master mix first.',true);return;}
 button.disabled=true;
 try{
  say('Loading your private saved master…');
  const {data,error}=await state.client.storage.from(BUCKET).download(master.path);if(error)throw error;
  state.resumeRow=row;state.resumeMasterBlob=data;state.tracks=[];state.master=null;renderTracks();
  $('sessionTitle').value=row.title||'';if(row.podcast_id)$('podcastSelect').value=row.podcast_id;
  state.elapsedBeforePause=Number(row.duration_seconds||0);$('timer').textContent=fmt(state.elapsedBeforePause);
  $('openingFile').value='';$('endingFile').value='';state.openingFile=null;state.endingFile=null;
  say('Session ready to continue. Add microphone track(s), record the next segment, then save progress to update this same saved session. Existing takes stay stored.');
  $('sessionTitle').focus();window.scrollTo({top:0,behavior:'smooth'});
 }catch(e){say('Could not load saved session: '+(e.message||String(e)),true);}
 finally{button.disabled=false;}
}
async function createDraft(row,button,chosenPodcast){
 const podcastId=chosenPodcast||row.podcast_id||$('podcastSelect').value;
 if(!podcastId){say('Choose one of your podcasts before creating an episode draft.',true);return;}
 if(button.disabled)return;
 button.disabled=true;const oldLabel=button.textContent;button.textContent='Preparing episode…';
 let publishedPath=null;
 try{
  const {data:show,error:showErr}=await state.client.from('podcasts').select('id,title,creator_id').eq('id',podcastId).maybeSingle();if(showErr)throw showErr;if(!show)throw new Error('Podcast not found or not accessible.');
  const {data:member,error:me}=await state.client.from('members').select('id').eq('user_id',state.user.id).maybeSingle();if(me)throw me;
  const {data:creator,error:ce}=await state.client.from('creators').select('id').eq('member_id',member?.id||'00000000-0000-0000-0000-000000000000');if(ce)throw ce;
  if(!(creator||[]).some(c=>c.id===show.creator_id))throw new Error('You can only create episode drafts for podcasts linked to your creator account.');
  const master=(row.tracks||[]).find(t=>t.role==='master');if(!master)throw new Error('This recording has no master mix track.');
  say('Preparing audio for '+show.title+'…');
  const {data:blob,error:downloadError}=await state.client.storage.from(BUCKET).download(master.path);if(downloadError)throw downloadError;
  const ext=(master.path.split('.').pop()||'webm').replace(/[^a-z0-9]/gi,'').slice(0,8)||'webm';
  const publicPath='podcasts/'+state.user.id+'/'+podcastId+'/episodes/studio-'+row.id+'-'+crypto.randomUUID()+'/audio.'+ext;
  const {error:uploadError}=await state.client.storage.from('podcasting').upload(publicPath,blob,{upsert:false,contentType:master.mime_type||blob.type||'audio/webm',cacheControl:'3600'});if(uploadError)throw uploadError;
  publishedPath=publicPath;
  const audioUrl=state.client.storage.from('podcasting').getPublicUrl(publicPath).data.publicUrl;
  const {data:episodes,error:countErr}=await state.client.from('podcast_episodes').select('episode_number').eq('podcast_id',podcastId).order('episode_number',{ascending:false}).limit(1);if(countErr)throw countErr;
  const next=(episodes?.[0]?.episode_number||0)+1;const episodeSlug=slug(row.title)+'-'+row.id.slice(0,8)+'-'+Date.now().toString(36);
  const {data:episode,error}=await state.client.from('podcast_episodes').insert({podcast_id:podcastId,title:row.title,slug:episodeSlug,description:'Recorded in CrowRules Studio. Review this draft before publishing.',episode_number:next,duration_seconds:master.duration_seconds||row.duration_seconds,audio_url:audioUrl,status:'draft',is_published:false,is_active:true,access_level:'free'}).select('id').single();if(error)throw error;
  const {error:updateErr}=await state.client.from('studio_recordings').update({status:'draft_created',podcast_id:podcastId}).eq('id',row.id).eq('owner_user_id',state.user.id);if(updateErr)throw updateErr;
  publishedPath=null;
  say('New episode draft added to '+show.title+'. The audio was copied to the podcasting delivery bucket; review the episode before publishing.');
  await loadSaved();
 }catch(e){
  if(publishedPath){const {error:cleanupError}=await state.client.storage.from('podcasting').remove([publishedPath]);if(cleanupError)console.warn('Audio cleanup may need attention:',cleanupError);}
  say('Could not create episode draft: '+(e.message||String(e)),true);
  button.disabled=false;button.textContent=oldLabel;
 }
}
$('quickRecordBtn')?.addEventListener('click',quickRecord);
$('fillTitleBtn')?.addEventListener('click',()=>{const input=$('sessionTitle');if(!input.value.trim()||input.value.trim()==='Untitled recording'){const d=new Date();input.value='CrowRules recording — '+d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});}input.focus();});
$('scrollToRecordBtn')?.addEventListener('click',()=>$('startBtn').scrollIntoView({behavior:'smooth',block:'center'}));
$('openingFile').addEventListener('change',()=>{if($('openingFile').files.length)$('openingSavedTrack').value='';});$('endingFile').addEventListener('change',()=>{if($('endingFile').files.length)$('endingSavedTrack').value='';});
$('openingSavedTrack').addEventListener('change',()=>{if($('openingSavedTrack').value)$('openingFile').value='';});$('endingSavedTrack').addEventListener('change',()=>{if($('endingSavedTrack').value)$('endingFile').value='';});
$('openingVolume').addEventListener('input',()=>{state.openingGain=Number($('openingVolume').value)/100;$('openingVolumeValue').textContent=$('openingVolume').value+'%';});$('endingVolume').addEventListener('input',()=>{state.endingGain=Number($('endingVolume').value)/100;$('endingVolumeValue').textContent=$('endingVolume').value+'%';});$('previewOpening').addEventListener('click',()=>previewBed('opening'));$('previewEnding').addEventListener('click',()=>previewBed('ending'));$('soundCheckBtn').addEventListener('click',runSoundCheck);$('refreshDevices').addEventListener('click',refreshDevices);$('addTrack').addEventListener('click',addTrack);$('startBtn').addEventListener('click',startRecording);$('pauseBtn').addEventListener('click',pauseRecording);$('stopBtn').addEventListener('click',stopRecording);
window.addEventListener('beforeunload',e=>{const recording=state.tracks.some(t=>t.recorder&&t.recorder.state!=='inactive')||(state.master?.recorder&&state.master.recorder.state!=='inactive');const unsaved=state.tracks.some(t=>t.blob?.size)||!!state.master?.blob?.size;if(recording||unsaved||state.busy){e.preventDefault();e.returnValue=recording?'Recording in progress':state.busy?'Audio upload in progress':'Your recorded audio has not been saved yet';}});

window.CrowRulesStudioV2 = {
 getCurrentTracks: () => [...state.tracks.filter(t=>t.blob?.size).map((t,i)=>({id:'track-'+i+'-'+safeName(t.name||'mic'),name:t.name||('Microphone '+(i+1)),blob:t.blob,role:'track'})), ...(state.master?.blob?.size?[{id:'master-mix',name:'Master mix',blob:state.master.blob,role:'master'}]:[])],
 getTitle: () => $('sessionTitle')?.value || 'CrowRules recording'
};

drawWave();init();
})();