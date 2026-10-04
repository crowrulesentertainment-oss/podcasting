(()=>{
'use strict';
if(window.__CROW_PODCASTING_V12__)return;window.__CROW_PODCASTING_V12__=true;
const BASE='https://crowrulesentertainment-oss.github.io/podcasting/';
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
const load=(src,attr)=>new Promise((resolve,reject)=>{if(document.querySelector('script['+attr+']'))return resolve();const s=document.createElement('script');s.src=src;s.defer=true;s.setAttribute(attr,'true');s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
function css(){if(document.getElementById('cr12css'))return;const l=document.createElement('link');l.id='cr12css';l.rel='stylesheet';l.href=BASE+'css/podcasting-v12.css?v=20261004-12';document.head.appendChild(l)}
function client(){return window.CROW_SUPABASE||null}
async function user(){const sb=client();if(!sb)return null;const r=await sb.auth.getUser();return r.data?.user||null}
function openSearch(){
 if(document.getElementById('cr12Search'))return;
 const o=document.createElement('div');o.id='cr12Search';o.className='cr12-overlay';o.innerHTML='<section class="cr12-search-card"><div class="cr12-kicker">CROWRULES PODCASTING INTELLIGENCE</div><button class="cr12-close" aria-label="Close">×</button><h2>Search the Podcast Universe</h2><p>Find podcasts, episodes and creators from one search.</p><input id="cr12SearchInput" class="cr12-input" autocomplete="off" placeholder="Search podcasts, episodes, creators…"><div id="cr12SearchMeta" class="cr12-muted">Start typing to search.</div><div id="cr12SearchResults" class="cr12-results"></div></section>';
 document.body.appendChild(o);const q=o.querySelector('#cr12SearchInput');o.querySelector('.cr12-close').onclick=()=>o.remove();o.onclick=e=>{if(e.target===o)o.remove()};q.oninput=()=>search(q.value);q.focus();
}
let searchTimer;
async function search(term){clearTimeout(searchTimer);searchTimer=setTimeout(async()=>{const sb=client(),box=document.getElementById('cr12SearchResults'),meta=document.getElementById('cr12SearchMeta');if(!sb||term.trim().length<2){if(meta)meta.textContent='Start typing to search.';if(box)box.innerHTML='';return}meta.textContent='Searching…';try{const t='%'+term.trim().replace(/[%_]/g,'')+'%';const [p,e,c]=await Promise.all([
 sb.from('podcasts').select('id,title,slug,description,artwork_url,status,creator_id').ilike('title',t).eq('status','published').limit(8),
 sb.from('podcast_episodes').select('id,title,slug,description,podcast_id,thumbnail_url,status').ilike('title',t).eq('status','published').limit(8),
 sb.from('creators').select('id,name,display_name,slug,bio,avatar_url,is_active').or('name.ilike.'+t+',display_name.ilike.'+t).eq('is_active',true).limit(8)
]);
 const rows=[];(p.data||[]).forEach(x=>rows.push({kind:'Podcast',title:x.title,desc:x.description,url:'podcast.html?slug='+encodeURIComponent(x.slug||x.id),img:x.artwork_url}));(e.data||[]).forEach(x=>rows.push({kind:'Episode',title:x.title,desc:x.description,url:'episode.html?id='+encodeURIComponent(x.id),img:x.thumbnail_url}));(c.data||[]).forEach(x=>rows.push({kind:'Creator',title:x.display_name||x.name,desc:x.bio,url:'creator.html?slug='+encodeURIComponent(x.slug||x.id),img:x.avatar_url}));meta.textContent=rows.length?rows.length+' results':'No matches found';box.innerHTML=rows.map(x=>'<a class="cr12-result" href="'+esc(x.url)+'">'+(x.img?'<img src="'+esc(x.img)+'" alt="">':'<span class="cr12-result-icon">◉</span>')+'<span><b>'+esc(x.title)+'</b><small>'+esc(x.kind)+' · '+esc(x.desc||'')+'</small></span></a>').join('')||'<div class="cr12-empty">Try a podcast title, episode title, or creator name.</div>';
 }catch(err){meta.textContent='Search is temporarily unavailable';box.innerHTML='<div class="cr12-empty">'+esc(err.message||'Connection error')+'</div>'}},180)}
async function injectPersonal(){
 const sb=client();if(!sb)return;const u=await user().catch(()=>null);if(!u)return;
 const host=document.querySelector('[data-crow-intelligence]');if(!host)return;
 host.innerHTML='<div class="cr12-kicker">PERSONALIZED INTELLIGENCE</div><h2>Continue Listening</h2><div id="cr12Continue" class="cr12-grid"><div class="cr12-empty">Loading your listening trail…</div></div><div class="cr12-intel-divider"></div><h2>Recommended for You</h2><div id="cr12Recommended" class="cr12-grid"><div class="cr12-empty">Building recommendations…</div></div>';
 const prog=await sb.from('cr_podcast_playback_progress').select('episode_id,position_seconds,duration_seconds,progress_percent,last_played_at').eq('user_id',u.id).eq('completed',false).order('last_played_at',{ascending:false}).limit(8);
 const ids=(prog.data||[]).map(x=>x.episode_id);let eps=[];if(ids.length){const r=await sb.from('podcast_episodes').select('id,title,podcast_id,thumbnail_url,description,duration_seconds,status').in('id',ids).eq('status','published');eps=r.data||[]}
 const cm=document.getElementById('cr12Continue');cm.innerHTML=eps.length?eps.map(e=>{const p=(prog.data||[]).find(x=>x.episode_id===e.id)||{};const pct=Math.max(0,Math.min(100,Number(p.progress_percent||((p.position_seconds||0)/(p.duration_seconds||e.duration_seconds||1)*100))));return '<a class="cr12-media" href="episode.html?id='+encodeURIComponent(e.id)+'"><img src="'+esc(e.thumbnail_url||'')+'" alt=""><b>'+esc(e.title)+'</b><small>'+Math.round(pct)+'% complete</small><i style="width:'+pct+'%"></i></a>'}).join(''):'<div class="cr12-empty">Nothing in progress yet. Start an episode and your listening trail will appear here.</div>';
 const rec=await sb.from('podcasts').select('id,title,slug,description,artwork_url,category,total_plays').eq('status','published').order('total_plays',{ascending:false}).limit(6);const rb=document.getElementById('cr12Recommended');rb.innerHTML=(rec.data||[]).map(x=>'<a class="cr12-media" href="podcast.html?slug='+encodeURIComponent(x.slug||x.id)+'"><img src="'+esc(x.artwork_url||'')+'" alt=""><b>'+esc(x.title)+'</b><small>'+esc(x.category||'Podcast')+'</small></a>').join('')||'<div class="cr12-empty">Recommendations will appear as the catalog grows.</div>';
}
function injectShell(){
 css();
 if(!document.getElementById('cr12SearchButton')){const b=document.createElement('button');b.id='cr12SearchButton';b.className='cr12-fab';b.title='Podcast Intelligence Search';b.innerHTML='⌕ <span>INTELLIGENCE SEARCH</span>';b.onclick=openSearch;document.body.appendChild(b)}
 const host=document.querySelector('[data-crow-intelligence]');if(host)injectPersonal().catch(console.warn);
 if(document.body.dataset.cr12Creator==='true')injectCreatorIntelligence().catch(console.warn);
}
async function injectCreatorIntelligence(){
 const sb=client(),u=await user().catch(()=>null),host=document.querySelector('[data-crow-creator-intelligence]');if(!sb||!u||!host)return;
 const cr=await sb.rpc('get_my_podcast_creator_id');if(cr.error||!cr.data)return;
 const cid=cr.data;const p=await sb.from('podcasts').select('id,title,total_plays,listener_count,status').eq('creator_id',cid);const podcasts=p.data||[];const ids=podcasts.map(x=>x.id);
 let eps=[];if(ids.length){const e=await sb.from('podcast_episodes').select('id,title,status,play_count,updated_at').in('podcast_id',ids);eps=e.data||[]}
 const follows=ids.length?await sb.from('podcast_follows').select('id',{count:'exact',head:true}).in('podcast_id',ids):{count:0};
 const plays=podcasts.reduce((n,x)=>n+Number(x.total_plays||0),0),published=eps.filter(x=>x.status==='published').length,followers=Number(follows.count||0);
 host.innerHTML='<div class="cr12-kicker">CREATOR INTELLIGENCE</div><div class="cr12-kpi-grid"><div><b>'+podcasts.length+'</b><small>Shows</small></div><div><b>'+eps.length+'</b><small>Episodes</small></div><div><b>'+plays.toLocaleString()+'</b><small>Total Plays</small></div><div><b>'+followers.toLocaleString()+'</b><small>Followers</small></div></div><div class="cr12-summary"><b>Signal</b><span>'+published+' published episodes · '+(eps.length-published)+' in production</span></div>';
}
function realtime(){const sb=client();if(!sb)return;const ch=sb.channel('podcasting-v12-intelligence').on('postgres_changes',{event:'*',schema:'public',table:'podcast_episodes'},()=>document.dispatchEvent(new CustomEvent('crow:intelligence-refresh'))).on('postgres_changes',{event:'*',schema:'public',table:'podcast_follows'},()=>document.dispatchEvent(new CustomEvent('crow:intelligence-refresh'))).subscribe();window.CROW_PODCASTING_INTELLIGENCE={channel:ch,search:openSearch};}
async function start(){css();try{await load(BASE+'js/podcasting-v11.js?v=20261004-11','data-crow-v11-core')}catch(e){}setTimeout(()=>{injectShell();realtime();},150)}
start();
})();
