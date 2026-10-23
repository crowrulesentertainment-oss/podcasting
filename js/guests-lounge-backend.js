/* CrowRules Guests Lounge — Supabase integration.
 * Uses only the project's public publishable key. Private guest applications are insert-only.
 */
(()=>{'use strict';
if(window.__CR_GUEST_LOUNGE_BACKEND__)return;
window.__CR_GUEST_LOUNGE_BACKEND__=true;
const $=s=>document.querySelector(s);
let client=null,channel=null,started=false;
const busy=new WeakSet();
const lastSent={community:0,episode:0};
const text=(value,max)=>String(value??'').trim().slice(0,max);
function setConnection(state,message){
 const pill=$('#glSupabaseStatus'),value=$('#glConnectionValue');
 if(pill){pill.textContent=message;pill.dataset.state=state; pill.style.borderColor=state==='online'?'rgba(74,222,128,.55)':state==='offline'?'rgba(251,113,133,.6)':'rgba(103,232,249,.3)';}
 if(value)value.textContent=state==='online'?'CONNECTED':state==='offline'?'RETRY NEEDED':'CONNECTING';
}
function note(message,kind='info'){
 const r=$('#applicationResult'),t=$('#glToast');
 if(r){r.textContent=message;r.classList.remove('gl-hidden');r.setAttribute('role','status');r.dataset.kind=kind;}
 if(t){t.textContent=message;t.classList.add('show');clearTimeout(note.timer);note.timer=setTimeout(()=>t.classList.remove('show'),4500);}
}
async function db(){
 if(client)return client;
 const cfg=window.CROW_CONFIG;
 if(!window.supabase||typeof window.supabase.createClient!=='function')throw Error('The Supabase JavaScript library did not load.');
 if(!cfg?.supabaseUrl||!cfg?.supabaseKey)throw Error('Supabase URL or publishable key is missing from config.js.');
 client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
  realtime:{params:{eventsPerSecond:5}}
 });
 return client;
}
function addMsg(log,m){
 if(!log||!m?.id||log.querySelector('[data-cloud-id="'+CSS.escape(m.id)+'"]'))return;
 const el=document.createElement('div');el.className='gl-msg';el.dataset.cloudId=m.id;
 const n=document.createElement('strong'),b=document.createElement('span');
 n.textContent=text(m.display_name,40);b.textContent=text(m.message,500);
 el.append(n,b);log.append(el);
 while(log.children.length>60)log.firstElementChild.remove();
 log.scrollTop=log.scrollHeight;
}
function addIdea(m){
 const grid=$('#topicGrid');if(!grid||!m?.id||grid.querySelector('[data-cloud-id="'+CSS.escape(m.id)+'"]'))return;
 const card=document.createElement('article');card.className='gl-card gl-topic';card.dataset.category=m.category||'community';card.dataset.cloudId=m.id;
 const tag=document.createElement('span');tag.className='gl-tag';tag.textContent=text(m.category||'community',30).toUpperCase();
 const top=document.createElement('div');top.className='gl-topic-top';top.append(tag);
 const h=document.createElement('h3'),p=document.createElement('p');h.textContent=text(m.title,120);p.textContent=text(m.description,1500);
 const save=document.createElement('button');save.type='button';save.className='gl-btn gl-save-topic';save.textContent='Save topic';
 save.addEventListener('click',()=>{const list=$('#savedTopics');if(!list)return;const row=document.createElement('p');row.textContent=m.title;list.append(row);});
 card.append(top,h,p,save);grid.prepend(card);
 while(grid.children.length>35)grid.lastElementChild.remove();
}
function withSubmit(formId,handler){
 const form=$('#'+formId);if(!form)return;
 // Capture at document level to prevent the legacy demo-only form handler from running.
 document.addEventListener('submit',async event=>{
  if(event.target!==form)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!form.reportValidity()||busy.has(form))return;
  busy.add(form);const submit=form.querySelector('button[type="submit"]');const old=submit?.textContent;
  if(submit){submit.disabled=true;submit.textContent='Sending…';}
  try{await handler(form);}
  catch(error){console.error('[CrowRules Guests Lounge]',formId,error);note(userMessage(error),'error');}
  finally{busy.delete(form);if(submit){submit.disabled=false;submit.textContent=old||'Submit';}}
 },true);
}
function userMessage(error){
 const msg=String(error?.message||'');
 if(/row-level security|permission denied|not allowed/i.test(msg))return 'Supabase blocked this request. Check the Guests Lounge table permissions and RLS policies.';
 if(/network|fetch|load failed|failed to fetch/i.test(msg))return 'Could not reach Supabase. Check your connection and try again.';
 if(/duplicate|unique/i.test(msg))return 'This item may already have been submitted. Please check and try again.';
 return 'We could not save that to Supabase right now. Please try again in a moment.';
}
withSubmit('guestForm',async form=>{
 const f=new FormData(form),c=await db();
 const row={
  name:text(f.get('name'),100),email:text(f.get('email'),200),links:text(f.get('links'),500),
  show_name:text(f.get('show'),40)||'Open to suggestions',
  appearance_type:text(f.get('appearance'),40)||'Not sure yet',
  availability:text(f.get('availability'),200),topics:text(f.get('topics'),5000),
  questions:text(f.get('questions'),3000),needs:text(f.get('needs'),1500),
  public_profile_opt_in:$('#guestPublic')?.checked===true,status:'pending'
 };
 if(!$('#guestConsent')?.checked)throw Error('Please confirm the application privacy notice.');
 if(!row.name||!row.email||!row.topics)throw Error('Please complete the required fields.');
 const {error}=await c.from('cr_guest_applications').insert(row);
 if(error)throw error;
 form.reset();const count=$('#topicCount');if(count)count.textContent='0 / 5000';
 note('Application submitted successfully and stored privately for host review. This is not an appearance booking confirmation.','success');
});
withSubmit('ideaForm',async form=>{
 const c=await db(),title=text($('#ideaTitle')?.value,120),description=text($('#ideaDescription')?.value,1500),category=text($('#ideaCategory')?.value,30)||'community';
 if(!title||!description)throw Error('Please add an idea title and description.');
 const {data,error}=await c.from('cr_lounge_ideas').insert({title,description,category,status:'submitted'}).select('id,title,description,category').single();
 if(error)throw error;
 addIdea(data);form.reset();note('Episode idea saved to Supabase and shared for community discovery.','success');
});
async function sendMessage(form,room){
 const now=Date.now();
 if(now-lastSent[room]<2500)throw Error('Please wait a moment before posting another message.');
 const c=await db();
 let displayName,message,showName;
 if(room==='community'){
  displayName=text($('#chatNickname')?.value,40);message=text($('#loungeMessage')?.value,500);showName='Community Hangout';
 }else{
  displayName='LOUNGE LISTENER';message=text($('#episodeMessage')?.value,500);
  showName=text($('#chatShowName')?.textContent?.replace(/^Discussion:\s*/,''),40);
  if(!['Back Deck Live','Tacoma Nights','Bird Brains'].includes(showName))showName='Back Deck Live';
 }
 if(!displayName||!message)throw Error('Enter a display name and message before posting.');
 const {data,error}=await c.from('cr_lounge_messages').insert({room,show_name:showName,display_name:displayName,message,status:'visible'}).select('id,display_name,message,room,show_name').single();
 if(error)throw error;
 lastSent[room]=Date.now();addMsg(room==='community'?$('#loungeChat'):$('#episodeChat'),data);
 const input=room==='community'?$('#loungeMessage'):$('#episodeMessage');if(input)input.value='';
}
withSubmit('episodeChatForm',form=>sendMessage(form,'episode'));
withSubmit('loungeChatForm',form=>sendMessage(form,'community'));
async function loadSharedContent(c){
 const [ideas,community,episode]=await Promise.all([
  c.from('cr_lounge_ideas').select('id,title,category,description').in('status',['submitted','selected']).order('created_at',{ascending:false}).limit(30),
  c.from('cr_lounge_messages').select('id,display_name,message').eq('room','community').eq('status','visible').order('created_at',{ascending:true}).limit(50),
  c.from('cr_lounge_messages').select('id,display_name,message').eq('room','episode').eq('status','visible').order('created_at',{ascending:true}).limit(50)
 ]);
 for(const result of [ideas,community,episode])if(result.error)throw result.error;
 (ideas.data||[]).reverse().forEach(addIdea);
 (community.data||[]).forEach(m=>addMsg($('#loungeChat'),m));
 (episode.data||[]).forEach(m=>addMsg($('#episodeChat'),m));
}
function connectRealtime(c){
 if(channel){c.removeChannel(channel);channel=null;}
 channel=c.channel('cr-guests-lounge-live')
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'cr_lounge_messages'},event=>{
  const m=event.new;if(m?.status!=='visible')return;
  addMsg(m.room==='community'?$('#loungeChat'):m.room==='episode'?$('#episodeChat'):null,m);
 })
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'cr_lounge_ideas'},event=>{
  if(['submitted','selected'].includes(event.new?.status))addIdea(event.new);
 })
 .subscribe(state=>{
  if(state==='SUBSCRIBED')setConnection('online','Supabase connected · live updates on');
  else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT')setConnection('offline','Database loaded · live updates reconnecting');
  else if(state==='CLOSED')setConnection('offline','Live updates disconnected');
 });
}
async function start(){
 if(started)return;started=true;
 setConnection('pending','Connecting to Supabase…');
 try{
  const c=await db();
  await loadSharedContent(c);
  setConnection('online','Supabase connected · live content enabled');
  connectRealtime(c);
 }catch(error){
  console.error('[CrowRules Guests Lounge] Supabase initialization failed',error);
  setConnection('offline','Supabase unavailable · submissions may fail');
  const noteNode=document.createElement('p');noteNode.className='gl-muted';noteNode.setAttribute('role','status');
  noteNode.textContent='We could not load shared lounge content from Supabase. You can retry by refreshing this page.';
  const page=$('.gl-page');if(page&&!page.querySelector('[data-gl-load-error]')){noteNode.dataset.glLoadError='true';page.prepend(noteNode);}
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.CrowRulesGuestsLounge={retry:()=>{started=false;return start();}};
})();