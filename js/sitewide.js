/* CrowRules Podcasting — sitewide reliability and accessibility helpers */
(()=>{'use strict';
 if(window.CrowSitewide&&window.CrowSitewide.loaded)return;
 const api={loaded:true,version:'2026.10.10'};
 const announce=(message,kind='info')=>{
  let node=document.getElementById('crow-sitewide-live');
  if(!node){node=document.createElement('div');node.id='crow-sitewide-live';node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.style.cssText='position:fixed;left:16px;bottom:16px;z-index:99999;max-width:min(420px,calc(100vw - 32px));padding:12px 16px;border:1px solid rgba(103,232,249,.35);border-radius:12px;background:#08111f;color:#eafaff;box-shadow:0 12px 36px #0008;font:500 13px/1.5 Montserrat,Arial,sans-serif;display:none';document.body.appendChild(node)}
  node.textContent=String(message||'');node.style.display=message?'block':'none';node.dataset.kind=kind;
  if(message){clearTimeout(api._noticeTimer);api._noticeTimer=setTimeout(()=>{node.style.display='none'},4200)}
 };
 const safeExternalLinks=()=>document.querySelectorAll('a[target="_blank"]').forEach(a=>{const rel=new Set((a.getAttribute('rel')||'').split(/\s+/).filter(Boolean));rel.add('noopener');rel.add('noreferrer');a.setAttribute('rel',[...rel].join(' '))});
 const improveImages=()=>document.querySelectorAll('img:not([loading])').forEach((img,i)=>{if(i>2)img.loading='lazy';if(!img.hasAttribute('decoding'))img.decoding='async'});
 const normalizeForms=()=>document.querySelectorAll('form').forEach(form=>{if(!form.hasAttribute('novalidate'))form.querySelectorAll('input,select,textarea').forEach(el=>{if(el.required&&!el.getAttribute('aria-required'))el.setAttribute('aria-required','true')})});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const open=document.querySelector('dialog[open]');if(open&&typeof open.close==='function')open.close()}});
 document.addEventListener('error',e=>{const el=e.target;if(el&&el.tagName==='IMG'&&!el.dataset.crowFallback){el.dataset.crowFallback='1';el.style.background='#111827';el.style.objectFit='contain';el.setAttribute('aria-label',el.alt||'Image unavailable')}},true);
 const start=()=>{safeExternalLinks();improveImages();normalizeForms();document.documentElement.dataset.crowSitewide='ready'};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.CrowSitewide=api;
 window.CrowSitewide.announce=announce;
})();