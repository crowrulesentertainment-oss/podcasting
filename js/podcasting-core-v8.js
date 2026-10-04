(()=>{
  'use strict';
  if(window.__CROW_PODCASTING_V8__) return;
  window.__CROW_PODCASTING_V8__=true;

  const VERSION='8.0.0';
  const BASE='https://crowrulesentertainment-oss.github.io/podcasting/';
  const SUPABASE_URL='https://cevylpnoexugwgygvtgu.supabase.co';
  const SUPABASE_KEY='sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-';
  const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const page=()=>location.pathname.split('/').pop()||'index.html';
  const go=(file,query='')=>BASE+file+(query?('?'+query.replace(/^\?/,''):'');

  function ensureStyle(){
    if(document.getElementById('cr-v8-css')) return;
    const s=document.createElement('style');s.id='cr-v8-css';s.textContent=`
      :root{--cr-bg:#05070e;--cr-panel:#0b101b;--cr-line:#ffffff14;--cr-text:#eef6ff;--cr-muted:#8e9ab0;--cr-cyan:#55e7ff;--cr-purple:#a66cff;--cr-red:#ff4f7b}
      .crv8-shell{position:relative;z-index:99999;font-family:Montserrat,system-ui,sans-serif}.crv8-bar{position:sticky;top:0;display:flex;align-items:center;gap:14px;min-height:64px;padding:8px max(14px,calc((100vw - 1500px)/2));background:rgba(5,7,14,.96);border-bottom:1px solid var(--cr-line);backdrop-filter:blur(18px);box-shadow:0 12px 40px #0008}.crv8-brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;white-space:nowrap}.crv8-mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid #55e7ff55;border-radius:11px;color:var(--cr-cyan);background:#55e7ff0b;font:900 12px Orbitron}.crv8-brand-text{font:800 10px Orbitron;letter-spacing:.08em}.crv8-brand-text b{color:var(--cr-cyan)}.crv8-mainnav{display:flex;align-items:center;gap:2px;margin-left:auto}.crv8-mainnav a,.crv8-action{color:#b8c4d8;text-decoration:none;border:0;background:transparent;padding:10px 9px;border-radius:9px;font:700 10px Montserrat;cursor:pointer}.crv8-mainnav a:hover,.crv8-mainnav a.active,.crv8-action:hover{background:#ffffff09;color:#fff}.crv8-tools{display:flex;gap:5px}.crv8-search{border:1px solid var(--cr-line);background:#ffffff06;color:#dce7f7;border-radius:9px;padding:9px 11px;cursor:pointer;font:700 10px Montserrat}.crv8-menu-btn{border:1px solid var(--cr-line);background:#ffffff06;color:#fff;border-radius:9px;padding:9px 11px;cursor:pointer;font:800 9px Orbitron}.crv8-drawer{position:absolute;right:max(14px,calc((100vw - 1500px)/2));top:62px;width:min(410px,calc(100vw - 28px));max-height:calc(100vh - 80px);overflow:auto;padding:14px;background:#090d17f8;border:1px solid var(--cr-line);border-radius:16px;box-shadow:0 30px 90px #000a;display:none}.crv8-drawer.open{display:block}.crv8-group{padding:10px 0;border-bottom:1px solid #ffffff0b}.crv8-group:last-child{border-bottom:0}.crv8-group h4{margin:0 8px 8px;color:#66748d;font:800 8px Orbitron;letter-spacing:.14em;text-transform:uppercase}.crv8-link{display:flex;align-items:center;gap:9px;padding:9px 10px;color:#c6d1e2;text-decoration:none;border-radius:8px;font-size:10px}.crv8-link:hover,.crv8-link.active{background:#55e7ff0b;color:#fff}.crv8-status{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 10px;color:#78869d;font-size:9px}.crv8-dot{width:7px;height:7px;border-radius:50%;display:inline-block;background:#707b90}.crv8-dot.ok{background:#55e7ff;box-shadow:0 0 14px #55e7ff}.crv8-dot.bad{background:#ff4f7b;box-shadow:0 0 14px #ff4f7b}.crv8-mobile{display:none}.crv8-error{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:120000;display:none;max-width:min(680px,calc(100vw - 30px));padding:10px 14px;border:1px solid #ff4f7b55;border-radius:999px;background:#160b12f5;color:#ffdbe4;box-shadow:0 15px 50px #0009;font:700 10px Montserrat}.crv8-error.show{display:block}.crv8-search-modal{position:fixed;inset:0;z-index:130000;display:none;place-items:start center;padding-top:12vh;background:#0009;backdrop-filter:blur(8px)}.crv8-search-modal.open{display:grid}.crv8-search-box{width:min(760px,calc(100vw - 30px));padding:20px;border:1px solid var(--cr-line);border-radius:18px;background:#0a0e18;box-shadow:0 30px 100px #000b}.crv8-search-box strong{font:800 10px Orbitron;color:var(--cr-cyan);letter-spacing:.14em}.crv8-search-box input{width:100%;margin-top:12px;box-sizing:border-box;border:1px solid #ffffff18;border-radius:12px;background:#05070d;color:#fff;padding:15px;font:600 14px Montserrat;outline:none}.crv8-search-box input:focus{border-color:#55e7ff66;box-shadow:0 0 0 3px #55e7ff10}.crv8-search-box small{display:block;margin-top:9px;color:#66748d;font-size:9px}.crv8-skeleton{animation:crv8pulse 1.4s ease-in-out infinite;background:linear-gradient(90deg,#ffffff05,#ffffff0c,#ffffff05);background-size:200% 100%;border-radius:10px}@keyframes crv8pulse{50%{background-position:-100% 0}}@media(max-width:900px){.crv8-mainnav{display:none}.crv8-mobile{display:block;margin-left:auto}.crv8-menu-btn{display:none}}@media(min-width:901px){.crv8-mobile{display:none}}`;
    document.head.appendChild(s);
  }

  function toast(message){
    let el=document.getElementById('cr-v8-error');
    if(!el){el=document.createElement('div');el.id='cr-v8-error';el.className='crv8-error';document.body.appendChild(el)}
    el.textContent=String(message||'Something needs attention.');el.classList.add('show');
    clearTimeout(window.__CRV8_TOAST);window.__CRV8_TOAST=setTimeout(()=>el.classList.remove('show'),5200);
  }

  function ensureSearch(){
    if(document.getElementById('cr-v8-search-modal')) return;
    const m=document.createElement('div');m.id='cr-v8-search-modal';m.className='crv8-search-modal';m.innerHTML='<div class="crv8-search-box"><strong>CROWRULES PODCASTING SEARCH</strong><input id="cr-v8-search-input" autocomplete="off" placeholder="Search podcasts, episodes, creators, categories…"><small>Enter to search · Escape to close</small></div>';document.body.appendChild(m);
    const input=m.querySelector('input');m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')});input.addEventListener('keydown',e=>{if(e.key==='Escape')m.classList.remove('open');if(e.key==='Enter'){const q=input.value.trim();location.href=go('search.html',q?'q='+encodeURIComponent(q):'')}});
  }
  function openSearch(){ensureSearch();const m=document.getElementById('cr-v8-search-modal');m.classList.add('open');setTimeout(()=>document.getElementById('cr-v8-search-input')?.focus(),30)}

  async function createClient(){
    if(window.CROW_SUPABASE) return window.CROW_SUPABASE;
    if(!window.supabase?.createClient){
      const load=src=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)});
      try{await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm')}catch(_){
        try{await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')}catch(e){toast('Supabase library could not load.');throw e}
      }
    }
    if(window.supabase?.createClient){
      window.CROW_SUPABASE=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
      window.SUPABASE_URL=SUPABASE_URL;window.SUPABASE_ANON_KEY=SUPABASE_KEY;window.CROW_SUPABASE_KEY=SUPABASE_KEY;window.CROW_SUPABASE_CONNECTION='connected';
      return window.CROW_SUPABASE;
    }
    throw new Error('Supabase client is unavailable.');
  }

  async function getContext(sb){
    const fallback={user:null,member:null,creator:null,role:'listener'};
    try{
      const session=await sb.auth.getSession();const user=session.data?.session?.user||null;if(!user)return fallback;
      const mr=await sb.from('members').select('id,display_name,username,role,membership_type').eq('user_id',user.id).maybeSingle();
      const member=mr.error?null:mr.data;
      let creator=null;
      if(member?.id){const cr=await sb.from('creators').select('id,name,display_name,role,member_id').eq('member_id',member.id).limit(1);creator=cr.error?null:(cr.data?.[0]||null)}
      const role=String(member?.role||'').toLowerCase();const admin=['admin','administrator','superadmin'].includes(role);const isCreator=!!creator||['creator','podcaster','host','producer'].includes(role);
      return{user,member,creator,role:admin&&isCreator?'admin_creator':admin?'admin':isCreator?'creator':'member'};
    }catch(_){return fallback}
  }

  const groups=(ctx)=>{
    const explore=[['⌂','Home','home.html'],['◉','Podcasts','podcasts.html'],['✦','Discover','discover.html'],['▣','Episodes','episodes.html'],['⌕','Search','search.html']];
    const listen=[['♡','Following','library.html#following'],['★','Favorites','library.html#favorites'],['◷','History','library.html#history']];
    const account=[['◎','Library','library.html'],['♙','Profile','member-profile.html'],['◌','Notifications','notifications.html'],['◆','Membership','membership.html'],['⚙','Account','account.html']];
    const creator=[['▦','My Shows','podcasts.html'],['✚','Create Podcast','create-podcast.html'],['＋','Create Episode','create-episode.html'],['◈','Creator Center','creator-center.html'],['◈','Creator Dashboard','creator-dashboard.html'],['✓','Publishing','publishing-pipeline.html'],['▤','Release Calendar','release-calendar.html'],['⚡','Creator Actions','creator-actions.html'],['◎','Outcomes','creator-outcomes.html'],['◫','Learning','creator-learning.html'],['◇','Goals','creator-goals.html'],['⟳','Automation','creator-automation.html'],['◍','Activity','creator-activity.html'],['◈','Analytics','creator-analytics.html'],['♧','Audience','creator-audience.html'],['$','Monetization','creator-monetization.html'],['⇩','Payouts','creator-payouts.html'],['☷','Intelligence','creator-intelligence.html'],['⚙','Creator Settings','creator-settings.html']];
    const admin=[['⚙','Admin Center','admin.html'],['✓','Moderation','admin.html?view=moderation'],['⇧','Publishing Control','publishing-pipeline.html'],['♥','Platform Health','admin.html?view=health'],['◈','Platform Analytics','admin.html?view=analytics'],['▣','Member Management','members-podcaster.html']];
    const out=[['Explore',explore]];if(ctx.role==='member'||ctx.role==='listener')out.push(['Your Listening',listen]);if(['creator','admin_creator'].includes(ctx.role))out.push(['Creator Workspace',creator]);if(['admin','admin_creator'].includes(ctx.role))out.push(['Administration',admin]);out.push(['Account',account]);return out;
  };

  function renderNav(ctx){
    let host=document.querySelector('[data-nav]');if(!host){host=document.createElement('div');host.dataset.nav='';document.body.prepend(host)}
    host.innerHTML='';const wrap=document.createElement('div');wrap.className='crv8-shell';
    const current=page();
    const top=[['Home','home.html'],['Podcasts','podcasts.html'],['Discover','discover.html'],['Episodes','episodes.html']];
    wrap.innerHTML='<header class="crv8-bar"><a class="crv8-brand" href="'+BASE+'home.html"><span class="crv8-mark">CR</span><span class="crv8-brand-text">CROWRULES <b>PODCASTING</b></span></a><nav class="crv8-mainnav">'+top.map(x=>'<a href="'+x[1]+'" class="'+(current===x[1]?'active':'')+'">'+x[0]+'</a>').join('')+'</nav><div class="crv8-tools"><button class="crv8-search" type="button">⌕ Search</button><button class="crv8-menu-btn" type="button" aria-expanded="false">MENU</button><button class="crv8-mobile crv8-action" type="button" aria-expanded="false">☰</button></div><div class="crv8-drawer"></div></header>';
    const drawer=wrap.querySelector('.crv8-drawer');
    groups(ctx).forEach(([title,items])=>{const section=document.createElement('section');section.className='crv8-group';section.innerHTML='<h4>'+esc(title)+'</h4>'+items.map(x=>'<a class="crv8-link '+(current===x[2].split('#')[0].split('?')[0]?'active':'')+'" href="'+x[2]+'"><span>'+x[0]+'</span><span>'+esc(x[1])+'</span></a>').join('');drawer.appendChild(section)});
    const status=document.createElement('div');status.className='crv8-status';status.innerHTML='<span><i class="crv8-dot ok"></i> Supabase connected</span><span>'+esc(ctx.user?.email||'Guest')+'</span>';drawer.appendChild(status);
    wrap.querySelector('.crv8-search').onclick=openSearch;
    const menu=wrap.querySelector('.crv8-menu-btn');menu.onclick=()=>{const open=drawer.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))};
    const mobile=wrap.querySelector('.crv8-mobile');mobile.onclick=()=>{const open=drawer.classList.toggle('open');mobile.textContent=open?'✕':'☰';mobile.setAttribute('aria-expanded',String(open))};
    host.appendChild(wrap);host.dataset.navVersion=VERSION;
  }

  function normalizeLinks(){
    document.querySelectorAll('a[href]').forEach(a=>{
      const href=a.getAttribute('href');if(!href||href.startsWith('#')||/^(https?:|mailto:|tel:|javascript:)/i.test(href))return;
      if(href.includes('.html')&&href.startsWith('/'))a.setAttribute('href',href.slice(1));
    });
  }

  async function bootstrap(){
    ensureStyle();
    try{
      const sb=await createClient();window.CROW_SUPABASE=sb;
      const ctx=await getContext(sb);window.CROW_CONTEXT=ctx;
      renderNav(ctx);normalizeLinks();ensureSearch();
      if(!window.__CRV8_AUTH_SUB){const sub=sb.auth.onAuthStateChange(()=>{getContext(sb).then(next=>{window.CROW_CONTEXT=next;renderNav(next);window.dispatchEvent(new CustomEvent('crow:auth-changed',{detail:{context:next,supabase:sb}}))})});window.__CRV8_AUTH_SUB=sub.data?.subscription}
      if(!window.__CRV8_REALTIME){const channel=sb.channel('crowrules-podcasting-v8');channel.on('postgres_changes',{event:'*',schema:'public',table:'podcasts'},()=>window.dispatchEvent(new CustomEvent('crow:catalog-changed')));channel.on('postgres_changes',{event:'*',schema:'public',table:'podcast_episodes'},()=>window.dispatchEvent(new CustomEvent('crow:catalog-changed')));channel.on('postgres_changes',{event:'*',schema:'public',table:'podcast_follows'},()=>window.dispatchEvent(new CustomEvent('crow:catalog-changed')));channel.subscribe();window.__CRV8_REALTIME=channel}
      window.CROW_PODCASTING={version:VERSION,supabase:sb,context:ctx,refresh:()=>window.dispatchEvent(new CustomEvent('crow:catalog-changed')),go};
      window.dispatchEvent(new CustomEvent('crow:podcasting-ready',{detail:{supabase:sb,context:ctx,version:VERSION}}));
      return sb;
    }catch(error){window.CROW_SUPABASE_CONNECTION='error';window.CROW_SUPABASE_ERROR=error;console.error('[CrowRules Podcasting V8]',error);toast('Supabase connection is unavailable. The page is still usable in offline/read-only mode.');return null}
  }

  window.CROW_BOOTSTRAP=window.CROW_BOOTSTRAP||bootstrap;
  window.CROW_SUPABASE_READY=window.CROW_SUPABASE_READY||bootstrap();
  window.CROW_TOAST=toast;
  window.addEventListener('online',()=>window.CROW_BOOTSTRAP());
  window.addEventListener('offline',()=>toast('You are offline. Live updates will resume when the connection returns.'));
  window.addEventListener('error',e=>{if(e?.error)console.error('[CrowRules page error]',e.error)});
  window.addEventListener('unhandledrejection',e=>{if(e?.reason)console.error('[CrowRules async error]',e.reason)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>bootstrap(),{once:true});else bootstrap();
})();