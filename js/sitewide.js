/* CrowRules Podcasting — sitewide reliability and accessibility helpers */
(()=>{'use strict';
 if(window.CrowSitewide&&window.CrowSitewide.loaded)return;
 const api={loaded:true,version:'2026.10.11'};
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
  if(/(^|\\/)donate(?:\\.html)?$/i.test(window.location.pathname)||/(^|\\/)admin(?:\\.html)?$/i.test(window.location.pathname))return;
  if(document.getElementById('crow-sitewide-donate'))return;
  const ownScript=Array.from(document.scripts).find(s=>/\\/js\\/sitewide\\.js(?:\\?|$)/.test(s.src));
  const root=ownScript?new URL('../',ownScript.src):new URL('./',window.location.href);
  const link=document.createElement('a');link.id='crow-sitewide-donate';link.href=new URL('donate.html',root).href;link.textContent='♥  SUPPORT CROWRULES';link.setAttribute('aria-label','Donate to support CrowRules Podcasting');
  link.style.cssText='position:fixed;left:18px;bottom:18px;z-index:9998;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border:1px solid rgba(103,232,249,.55);border-radius:999px;background:linear-gradient(110deg,rgba(8,20,34,.97),rgba(28,19,52,.97));color:#9df4ff;text-decoration:none;font:800 10px/1.2 Montserrat,Arial,sans-serif;letter-spacing:.09em;box-shadow:0 8px 30px rgba(0,0,0,.4),0 0 22px rgba(103,232,249,.12);backdrop-filter:blur(12px)';
  link.addEventListener('mouseenter',()=>{link.style.borderColor='rgba(167,139,250,.9)';link.style.transform='translateY(-2px)'});link.addEventListener('mouseleave',()=>{link.style.borderColor='rgba(103,232,249,.55)';link.style.transform='translateY(0)'});
  document.body.appendChild(link);
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
    await load(new URL('config.js?crowrules-config=20261011',root).href);
   repairBrandLogos();
   window.dispatchEvent(new Event('crowrules:config-ready'));
   if(!window.CrowPoints?.__loaded)
    await load(new URL('js/crowpoints.js?crowrules-sitewide=20261010',root).href);
   // Admin is an operations-only screen: never inject the floating audio player there.
   const isAdminPage=/(^|\/)admin\.html$/i.test(window.location.pathname);
   if(isAdminPage){
    document.getElementById('cr-global-audio')?.remove();
    document.getElementById('cr-global-audio-style')?.remove();
   }else if(!window.__CROW_GLOBAL_AUDIO__){
    await load(new URL('js/global-audio-player.js?crowrules-sitewide=20261011',root).href);
   }
  }catch(error){console.error('[CrowRules sitewide] Shared rewards/audio setup failed:',error?.message||error);announce('CrowPoints could not initialize. Refresh the page and try again.','error')}
 }

 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.CrowSitewide=api;
 window.CrowSitewide.announce=announce;
})();