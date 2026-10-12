/* CrowRules Podcasting — sitewide reliability and accessibility helpers */
(()=>{'use strict';
 if(window.CrowSitewide&&window.CrowSitewide.loaded)return;
 const api={loaded:true,version:'2026.10.12-sitewide-reliability'};
 const announce=(message,kind='info')=>{
  let node=document.getElementById('crow-sitewide-live');
  if(!node){node=document.createElement('div');node.id='crow-sitewide-live';node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.style.cssText='position:fixed;left:16px;bottom:16px;z-index:99999;max-width:min(420px,calc(100vw - 32px));padding:12px 16px;border:1px solid rgba(103,232,249,.35);border-radius:12px;background:#08111f;color:#eafaff;box-shadow:0 12px 36px #0008;font:500 13px/1.5 Montserrat,Arial,sans-serif;display:none';document.body.appendChild(node)}
  node.textContent=String(message||'');node.style.display=message?'block':'none';node.dataset.kind=kind;
  if(message){clearTimeout(api._noticeTimer);api._noticeTimer=setTimeout(()=>{node.style.display='none'},4200)}
 };
 const safeExternalLinks=()=>document.querySelectorAll('a[target="_blank"]').forEach(a=>{const rel=new Set((a.getAttribute('rel')||'').split(/\s+/).filter(Boolean));rel.add('noopener');rel.add('noreferrer');a.setAttribute('rel',[...rel].join(' '))});
 const improveImages=()=>document.querySelectorAll('img:not([loading])').forEach((img,i)=>{if(i>2)img.loading='lazy';if(!img.hasAttribute('decoding'))img.decoding='async'});
 const repairBrandLogos=()=>{
  const logo=window.CROW_CONFIG?.logoUrl;
  if(!logo)return;
  document.querySelectorAll('img#homeLogo,img#heroLogo,img#podcastLogo,.home-brand img,.brand img,.home-logo').forEach(img=>{
   const alt=(img.getAttribute('alt')||'').toLowerCase();
   if(img.id==='homeLogo'||img.id==='heroLogo'||img.id==='podcastLogo'||alt.includes('crowrules')||alt.includes('podcasting logo')){
    if(!img.getAttribute('src')||img.getAttribute('src')==='about:blank')img.src=logo;
    img.addEventListener('error',()=>{if(!img.dataset.crowLogoRetry){img.dataset.crowLogoRetry='1';img.src=logo}}, {once:true});
   }
  });
 };
 const normalizeForms=()=>document.querySelectorAll('form').forEach(form=>{if(!form.hasAttribute('novalidate'))form.querySelectorAll('input,select,textarea').forEach(el=>{if(el.required&&!el.getAttribute('aria-required'))el.setAttribute('aria-required','true')})});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const open=document.querySelector('dialog[open]');if(open&&typeof open.close==='function')open.close()}});
 document.addEventListener('error',e=>{const el=e.target;if(el&&el.tagName==='IMG'&&!el.dataset.crowFallback){el.dataset.crowFallback='1';el.style.background='#111827';el.style.objectFit='contain';el.setAttribute('aria-label',el.alt||'Image unavailable');const alt=(el.alt||'').toLowerCase();if(window.CROW_CONFIG?.logoUrl&&(el.id==='homeLogo'||el.id==='heroLogo'||el.id==='podcastLogo'||alt.includes('crowrules')||alt.includes('podcasting logo'))&&el.src!==window.CROW_CONFIG.logoUrl){el.dataset.crowLogoRetry='1';el.src=window.CROW_CONFIG.logoUrl}}},true);
 const ensureDonateLink=()=>{
  const path=window.location.pathname.toLowerCase();
  if(path.endsWith('/donate.html')||path.endsWith('/admin.html'))return;
  const ownScript=Array.from(document.scripts).find(s=>/\/js\/sitewide\.js(?:\?|$)/.test(s.src));
  // Resolve the site root from this shared script so nested pages link correctly.
  const root=ownScript?new URL('../',ownScript.src):new URL('./',window.location.href);
  const donateUrl=new URL('donate.html',root).href;
  const styleId='crow-sitewide-donate-style';
  if(!document.getElementById(styleId)){
   const style=document.createElement('style');style.id=styleId;
   style.textContent=`
    #crow-sitewide-donate{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 14px;border:1px solid rgba(103,232,249,.55);border-radius:999px;background:linear-gradient(110deg,rgba(8,20,34,.96),rgba(28,19,52,.96));color:#9df4ff!important;text-decoration:none!important;font:800 11px/1.2 Montserrat,Arial,sans-serif;letter-spacing:.06em;white-space:nowrap;box-shadow:0 4px 18px rgba(0,0,0,.18);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
    #crow-sitewide-donate:hover,#crow-sitewide-donate:focus-visible{border-color:#a78bfa;transform:translateY(-2px);box-shadow:0 7px 24px rgba(103,232,249,.16);outline-offset:3px}
    #crow-sitewide-support{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin:24px auto;padding:18px 20px;max-width:1100px;border:1px solid rgba(103,232,249,.22);border-radius:16px;background:linear-gradient(110deg,rgba(8,20,34,.88),rgba(28,19,52,.78));color:#eafaff;font:500 13px/1.6 Montserrat,Arial,sans-serif}
    #crow-sitewide-support strong{display:block;color:#9df4ff;font-size:14px;margin-bottom:2px}
    #crow-sitewide-support p{margin:0;color:#c4cee0}
    @media(max-width:560px){#crow-sitewide-support{margin:18px 12px;padding:15px;align-items:flex-start}#crow-sitewide-donate.crow-donate-floating{right:12px;bottom:12px;padding:12px 14px;font-size:10px}}
    @media(prefers-reduced-motion:reduce){#crow-sitewide-donate{transition:none}#crow-sitewide-donate:hover{transform:none}}
   `;
   (document.head||document.documentElement).appendChild(style);
  }
  const makeLink=(id,label)=>{const a=document.createElement('a');a.id=id;a.href=donateUrl;a.textContent=label;a.setAttribute('aria-label','Donate to support CrowRules Podcasting');a.title='Support CrowRules Podcasting';return a};
  let link=document.getElementById('crow-sitewide-donate');
  const nav=document.querySelector('header nav, nav[aria-label="Main navigation"], nav[aria-label="Primary navigation"], header .nav-links, header .nav, nav');
  if(!link){
   link=makeLink('crow-sitewide-donate','♥ Donate');
   if(nav){link.style.margin='6px';nav.appendChild(link)}
   else{link.textContent='♥  SUPPORT CROWRULES';link.classList.add('crow-donate-floating');link.style.cssText+=';position:fixed;right:18px;bottom:18px;z-index:9998;padding:12px 16px;box-shadow:0 8px 30px rgba(0,0,0,.4),0 0 22px rgba(103,232,249,.12);backdrop-filter:blur(12px)';document.body.appendChild(link)}
  }else if(link.href!==donateUrl){link.href=donateUrl}
  // Add a compact, consistent support message near the footer on content pages.
  if(!document.getElementById('crow-sitewide-support')){
   const footer=document.querySelector('body > footer, main + footer, footer');
   if(footer){
    const band=document.createElement('section');band.id='crow-sitewide-support';band.setAttribute('aria-label','Support CrowRules Podcasting');
    const copy=document.createElement('div');const heading=document.createElement('strong');heading.textContent='Help keep stories playing.';
    const description=document.createElement('p');description.textContent='Support the growth of CrowRules Podcasting and independent creators.';
    copy.append(heading,description);const cta=makeLink('crow-sitewide-donate-footer','♥ Support the platform');band.append(copy,cta);footer.parentNode.insertBefore(band,footer);
   }
  }
 };
 const start=()=>{safeExternalLinks();improveImages();normalizeForms();repairBrandLogos();ensureDonateLink();document.documentElement.dataset.crowSitewide='ready';ensurePodcastingSystems()};
 // Ensure every Podcasting page has the shared Supabase config, CrowPoints balance,
 // and audio player, including lightweight landing pages that do not declare them.
 async function ensurePodcastingSystems(){
  const ownScript=Array.from(document.scripts).find(s=>/\/js\/sitewide\.js(?:\?|$)/.test(s.src));
  if(!ownScript)return;
  const root=new URL('../',ownScript.src);
  const load=src=>new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=src;script.async=false;
   script.onload=resolve;script.onerror=()=>reject(new Error('Could not load '+src));
   document.head.appendChild(script);
  });
  try{
   if(!window.supabase||typeof window.supabase.createClient!=='function')
    await load('https://unpkg.com/@supabase/supabase-js@2');
   if(!window.CROW_CONFIG?.supabaseUrl||!window.CROW_CONFIG?.supabaseKey||!window.CROW_CONFIG?.logoUrl)
    await load(new URL('config.js?crowrules-config=20261012',root).href);
   repairBrandLogos();
   window.dispatchEvent(new Event('crowrules:config-ready'));
   if(!window.CrowPoints?.__loaded)
    await load(new URL('js/crowpoints.js?crowrules-sitewide=20261012-reliability',root).href);
   // Keep admin and donation checkout/confirmation pages focused: no floating audio player.
   const isFocusedFlowPage = new RegExp('(^|/)(admin|donate|donation-success|donation-cancel)\\.html$', 'i').test(window.location.pathname);
   // Keep checkout and operations flows uncluttered; they have dedicated primary actions.
   if(isFocusedFlowPage){
    document.getElementById('cr-global-audio')?.remove();
    document.getElementById('cr-global-audio-style')?.remove();
   }else if(!window.__CROW_GLOBAL_AUDIO__){
    await load(new URL('js/global-audio-player.js?crowrules-sitewide=20261012-reliability',root).href);
   }
  }catch(error){console.error('[CrowRules sitewide] Shared rewards/audio setup failed:',error?.message||error);announce('Shared player and rewards tools could not initialize. Refresh the page and try again.','error')}
 }

 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.CrowSitewide=api;
 window.CrowSitewide.announce=announce;
})();