/* CrowRules Guests Lounge — published Supabase show catalog and live community features.
 * Public browser client only. Guest applications remain private and insert-only.
 */
(()=>{'use strict';
if(window.__CR_GUEST_LOUNGE_BACKEND__)return;
window.__CR_GUEST_LOUNGE_BACKEND__=true;
const $=s=>document.querySelector(s);
let client=null,channel=null,started=false,shows=[],activeShow=null;
const busy=new WeakSet(),lastSent={community:0,episode:0};
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
const safeUrl=v=>{try{const u=new URL(String(v||''));return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
function setConnection(state,message){
 const pill=$('#glSupabaseStatus'),value=$('#glConnectionValue');
 if(pill){pill.textContent=message;pill.dataset.state=state;}
 if(value)value.textContent=state==='online'?'CONNECTED':state==='offline'?'RETRY NEEDED':'CONNECTING';
}
function note(message){
 const r=$('#applicationResult'),t=$('#glToast');
 if(r){r.textContent=message;r.classList.remove('gl-hidden');r.setAttribute('role','status');}
 if(t){t.textContent=message;t.classList.add('show');clearTimeout(note.timer);note.timer=setTimeout(()=>t.classList.remove('show'),4500);}
}
async function db(){
 if(client)return client;
 const cfg=window.CROW_CONFIG;
 if(!window.supabase?.createClient)throw Error('Supabase JavaScript library did not load.');
 if(!cfg?.supabaseUrl||!cfg?.supabaseKey)throw Error('Supabase public configuration is missing.');
 client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},realtime:{params:{eventsPerSecond:5}}});
 return client;
}
function addMsg(log,m){
 if(!log||!m?.id||log.querySelector('[data-cloud-id="'+CSS.escape(m.id)+'"]'))return;
 const el=document.createElement('div');el.className='gl-msg';el.dataset.cloudId=m.id;
 const name=document.createElement('strong'),body=document.createElement('span');
 name.textContent=clean(m.display_name,40);body.textContent=clean(m.message,500);
 el.append(name,body);log.append(el);
 while(log.children.length>60)log.firstElementChild.remove();
 log.scrollTop=log.scrollHeight;
}
function addIdea(m){
 const grid=$('#topicGrid');if(!grid||!m?.id||grid.querySelector('[data-cloud-id="'+CSS.escape(m.id)+'"]'))return;
 if(grid.querySelector('.gl-empty'))grid.replaceChildren();
 const card=document.createElement('article');card.className='gl-card gl-topic';card.dataset.category=m.category||'community';card.dataset.cloudId=m.id;
 const top=document.createElement('div');top.className='gl-topic-top';
 const tag=document.createElement('span');tag.className='gl-tag';tag.textContent=clean(m.category||'community',30).toUpperCase();top.append(tag);
 const title=document.createElement('h3'),description=document.createElement('p'),save=document.createElement('button');
 title.textContent=clean(m.title,120);description.textContent=clean(m.description,1500);
 save.type='button';save.className='gl-btn gl-save-topic';save.textContent='Save topic';
 save.addEventListener('click',()=>{const list=$('#savedTopics');if(!list)return;if(list.querySelector('[data-title="'+CSS.escape(title.textContent)+'"]'))return;const row=document.createElement('p');row.dataset.title=title.textContent;row.textContent=title.textContent;list.append(row);});
 card.append(top,title,description,save);grid.prepend(card);
 while(grid.children.length>35)grid.lastElementChild.remove();
}
function chooseShow(id){
 const s=shows.find(item=>item.id===id);if(!s)return;activeShow=s;
 document.querySelectorAll('.gl-media-tab').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.showId===s.id)));
 const title=$('#mediaTitle'),desc=$('#mediaDescription'),kicker=$('#mediaKicker'),chatName=$('#chatShowName'),player=$('#mediaPlayer'),status=$('#mediaStatus');
 if(title)title.textContent=s.title;
 if(desc)desc.textContent=clean(s.description,1200)||'Published CrowRules Podcasting show.';
 if(kicker)kicker.textContent=s.is_live?'LIVE SHOW':'PUBLISHED SHOW';
 if(chatName)chatName.textContent='Discussion: '+s.title;
 if(player){
  player.replaceChildren();
  const media=safeUrl(s.trailer_url);
  if(media&&/\.(mp4|webm|ogg)(\?|#|$)/i.test(media)){
   const video=document.createElement('video');video.className='gl-video';video.controls=true;video.preload='metadata';video.src=media;player.append(video);
   if(status)status.textContent='Playing the published show media URL.';
  }else{
   const placeholder=document.createElement('div');placeholder.className='gl-video-placeholder';
   const inner=document.createElement('div'),symbol=document.createElement('div'),strong=document.createElement('strong'),p=document.createElement('p');
   symbol.style.fontSize='2rem';symbol.textContent='▶';strong.textContent=s.title;
   p.textContent=media?'A show preview link exists, but it is not a direct video file.':'No playable media URL is configured for this show yet.';
   inner.append(symbol,strong,p);placeholder.append(inner);player.append(placeholder);
   if(status)status.textContent=media?'Preview URL is available, but direct playback is not supported for this link.':'No episode source connected.';
  }
 }
 const showUrl='show.html?show='+encodeURIComponent(s.slug||s.id);
 ['watchBtn','listenBtn'].forEach(id=>{const button=$('#'+id);if(button){button.disabled=false;button.onclick=()=>{location.href=showUrl;};button.textContent=id==='watchBtn'?'Open show ↗':'Open show page ↗';}});
 loadEpisodeMessages().catch(err=>console.warn('[Guests Lounge] Could not load show discussion',err));
}
function renderShows(){
 const catalog=$('#glShowCatalog'),tabs=$('#glMediaTabs'),select=$('#guestShow'),count=$('#glShowCount'),status=$('#glShowCatalogStatus');
 if(count)count.textContent=String(shows.length).padStart(2,'0');
 if(!shows.length){
  if(catalog)catalog.innerHTML='<div class="gl-card gl-empty">No published shows are currently available in Supabase. Draft and unpublished shows are hidden.</div>';
  if(tabs)tabs.innerHTML='<span class="gl-empty">No published shows available.</span>';
  if(select)select.innerHTML='<option value="">No published shows available</option><option value="Open to suggestions">Open to suggestions</option>';
  if(status)status.textContent='No published shows were returned. Check the status and public read access in Supabase.';
  return;
 }
 if(status)status.textContent='Showing '+shows.length+' published show'+(shows.length===1?'':'s')+' from Supabase. Draft and unpublished shows are excluded.';
 if(catalog){
  catalog.replaceChildren();
  shows.forEach(s=>{
   const card=document.createElement('article');card.className='gl-card';
   const art=document.createElement('div');art.className='gl-art';
   const kicker=document.createElement('span');kicker.textContent=clean(s.category||'CROWRULES PODCASTING',80).toUpperCase();
   const artTitle=document.createElement('strong');artTitle.textContent=s.title;art.append(kicker,artTitle);
   const h=document.createElement('h3');h.textContent=s.title;
   const p=document.createElement('p');p.textContent=clean(s.description,800)||'Published CrowRules Podcasting show.';
   const chips=document.createElement('div');chips.className='gl-chips';
   const tag=document.createElement('span');tag.className='gl-tag';tag.textContent=s.is_live?'LIVE SHOW':'PUBLISHED SHOW';chips.append(tag);
   const btn=document.createElement('button');btn.type='button';btn.className='gl-btn primary';btn.textContent='Request this show ↗';
   btn.addEventListener('click',()=>{const sel=$('#guestShow');if(sel)sel.value=s.title;$('#guest-request')?.scrollIntoView({behavior:'smooth',block:'start'});});
   card.append(art,chips,h,p,btn);catalog.append(card);
  });
 }
 if(tabs){
  tabs.replaceChildren();
  shows.forEach((s,i)=>{const btn=document.createElement('button');btn.type='button';btn.className='gl-btn gl-media-tab';btn.dataset.showId=s.id;btn.setAttribute('aria-pressed',String(i===0));btn.textContent=s.title;btn.addEventListener('click',()=>chooseShow(s.id));tabs.append(btn);});
 }
 if(select){
  const old=select.value;select.replaceChildren();
  const first=document.createElement('option');first.value='';first.textContent='Choose a published show';select.append(first);
  shows.forEach(s=>{const o=document.createElement('option');o.value=s.title;o.textContent=s.title;select.append(o);});
  const open=document.createElement('option');open.value='Open to suggestions';open.textContent='Open to suggestions';select.append(open);
  if(shows.some(s=>s.title===old))select.value=old;
 }
 chooseShow((activeShow&&activeShow.id)||shows[0].id);
}
function withSubmit(id,handler){
 const form=$('#'+id);if(!form)return;
 document.addEventListener('submit',async event=>{
  if(event.target!==form)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!form.reportValidity()||busy.has(form))return;
  busy.add(form);const button=form.querySelector('button[type="submit"]'),old=button?.textContent;
  if(button){button.disabled=true;button.textContent='Sending…';}
  try{await handler(form);}catch(error){
   console.error('[CrowRules Guests Lounge]',id,error);
   const message=/row-level security|permission denied|not allowed/i.test(String(error?.message))?'Supabase permissions blocked this request.':/network|fetch|load failed/i.test(String(error?.message))?'Could not reach Supabase. Check your connection and retry.':'Could not save this right now. Please check the fields and try again.';
   note(message);
  }finally{busy.delete(form);if(button){button.disabled=false;button.textContent=old||'Submit';}}
 },true);
}
withSubmit('guestForm',async form=>{
 const f=new FormData(form),c=await db();
 const selected=clean(f.get('show'),120);
 if(selected!=='Open to suggestions'&&!shows.some(s=>s.title===selected))throw Error('Choose a published show from the Supabase catalog.');
 const row={name:clean(f.get('name'),100),email:clean(f.get('email'),200),links:clean(f.get('links'),500),show_name:selected||'Open to suggestions',appearance_type:clean(f.get('appearance'),40)||'Not sure yet',availability:clean(f.get('availability'),200),topics:clean(f.get('topics'),5000),questions:clean(f.get('questions'),3000),needs:clean(f.get('needs'),1500),public_profile_opt_in:$('#guestPublic')?.checked===true,status:'pending'};
 if(!$('#guestConsent')?.checked)throw Error('Please confirm the application privacy notice.');
 if(!row.name||!row.email||!row.topics)throw Error('Please complete the required fields.');
 const {error}=await c.from('cr_guest_applications').insert(row);if(error)throw error;
 form.reset();const counter=$('#topicCount');if(counter)counter.textContent='0 / 5000';
 note('Guest application submitted and stored privately for host review. This is not an appearance booking confirmation.');
});
withSubmit('ideaForm',async form=>{
 const c=await db(),title=clean($('#ideaTitle')?.value,120),description=clean($('#ideaDescription')?.value,1500),category=clean($('#ideaCategory')?.value,30)||'community';
 if(!title||!description)throw Error('Add an idea title and description.');
 const {data,error}=await c.from('cr_lounge_ideas').insert({title,description,category,status:'submitted'}).select('id,title,description,category').single();
 if(error)throw error;addIdea(data);form.reset();note('Episode idea saved to Supabase.');
});
async function sendMessage(room){
 const now=Date.now();if(now-lastSent[room]<2500)throw Error('Please wait before posting another message.');
 const c=await db();let displayName,message,showName;
 if(room==='community'){displayName=clean($('#chatNickname')?.value,40);message=clean($('#loungeMessage')?.value,500);showName='Community Hangout';}
 else{displayName=clean($('#episodeDisplayName')?.value,40)||'LOUNGE LISTENER';message=clean($('#episodeMessage')?.value,500);showName=activeShow?.title||'';}
 if(!displayName||!message)throw Error('Enter a display name and message.');
 if(room==='episode'&&!shows.some(s=>s.title===showName))throw Error('Choose a published show before posting.');
 const {data,error}=await c.from('cr_lounge_messages').insert({room,show_name:showName,display_name:displayName,message,status:'visible'}).select('id,display_name,message,room,show_name').single();
 if(error)throw error;lastSent[room]=Date.now();addMsg(room==='community'?$('#loungeChat'):$('#episodeChat'),data);
 const input=$('#'+(room==='community'?'loungeMessage':'episodeMessage'));if(input)input.value='';
}
withSubmit('episodeChatForm',()=>sendMessage('episode'));
withSubmit('loungeChatForm',()=>sendMessage('community'));
async function loadEpisodeMessages(){
 const log=$('#episodeChat');if(!log||!activeShow)return;
 const c=await db(),{data,error}=await c.from('cr_lounge_messages').select('id,display_name,message,show_name').eq('room','episode').eq('show_name',activeShow.title).eq('status','visible').order('created_at',{ascending:true}).limit(50);
 if(error)throw error;
 log.replaceChildren();(data||[]).forEach(m=>addMsg(log,m));
 if(!data?.length){const empty=document.createElement('div');empty.className='gl-empty';empty.textContent='Be the first to start this show’s discussion.';log.append(empty);}
}
async function loadSharedContent(c){
 const catalog=await c.from('podcasts').select('id,title,slug,description,category,artwork_url,trailer_url,website_url,is_live,is_featured,status').eq('status','published').order('is_featured',{ascending:false}).order('title',{ascending:true});
 if(catalog.error)throw catalog.error;
 shows=(catalog.data||[]).filter(s=>s.id&&s.title&&s.status==='published');
 renderShows();
 const [ideas,community]=await Promise.all([
  c.from('cr_lounge_ideas').select('id,title,category,description').in('status',['submitted','selected']).order('created_at',{ascending:false}).limit(30),
  c.from('cr_lounge_messages').select('id,display_name,message').eq('room','community').eq('status','visible').order('created_at',{ascending:true}).limit(50)
 ]);
 if(ideas.error)throw ideas.error;if(community.error)throw community.error;
 const grid=$('#topicGrid');if(grid)grid.replaceChildren();
 (ideas.data||[]).reverse().forEach(addIdea);
 if(grid&&!ideas.data?.length){const empty=document.createElement('div');empty.className='gl-card gl-empty';empty.textContent='No community-submitted ideas yet. Be the first to suggest one.';grid.append(empty);}
 const lounge=$('#loungeChat');if(lounge)lounge.replaceChildren();
 (community.data||[]).forEach(m=>addMsg(lounge,m));
}
function connectRealtime(c){
 if(channel){c.removeChannel(channel);channel=null;}
 channel=c.channel('cr-guests-lounge-live')
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'cr_lounge_messages'},event=>{
  const m=event.new;if(m?.status!=='visible')return;
  if(m.room==='community')addMsg($('#loungeChat'),m);
  if(m.room==='episode'&&activeShow&&m.show_name===activeShow.title)addMsg($('#episodeChat'),m);
 })
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'cr_lounge_ideas'},event=>{if(['submitted','selected'].includes(event.new?.status))addIdea(event.new);})
 .subscribe(state=>{if(state==='SUBSCRIBED')setConnection('online','Supabase connected · live updates on');else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT')setConnection('offline','Database loaded · live updates reconnecting');else if(state==='CLOSED')setConnection('offline','Live updates disconnected');});
}
async function start(){
 if(started)return;started=true;setConnection('pending','Connecting to Supabase…');
 try{const c=await db();await loadSharedContent(c);setConnection('online','Supabase connected · published shows loaded');connectRealtime(c);}
 catch(error){console.error('[CrowRules Guests Lounge] Supabase initialization failed',error);setConnection('offline','Supabase unavailable');
  const status=$('#glShowCatalogStatus');if(status)status.textContent='Could not load the published show catalog from Supabase. Refresh and try again.';
  const catalog=$('#glShowCatalog');if(catalog)catalog.innerHTML='<div class="gl-card gl-empty">Show catalog unavailable. No placeholder shows are displayed.</div>';
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.CrowRulesGuestsLounge={retry:()=>{started=false;return start();}};
})();