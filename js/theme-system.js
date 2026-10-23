/* CrowRules Podcasting — shared Theme Studio bridge.
 * Reads only a public theme preference from this browser; does not touch Supabase data or auth.
 */
(()=>{'use strict';
if(window.CrowRulesThemeSystem)return;
const KEY='crowrules-global-theme-v1';
const DEFAULTS={id:'cyberwave',name:'Cyberwave',c1:'#00e5ff',c2:'#9c5cff',image:'',cat:'Originals'};
const validHex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
function read(){try{const t=JSON.parse(localStorage.getItem(KEY)||'null');if(t&&validHex(t.c1)&&validHex(t.c2))return {...DEFAULTS,...t};}catch{}return DEFAULTS}
function css(){
 if(document.getElementById('cr-global-theme-css'))return;
 const s=document.createElement('style');s.id='cr-global-theme-css';
 s.textContent=`
 :root{--cr-theme-a:var(--cyan,var(--cr-cyan,#67e8f9));--cr-theme-b:var(--purple,var(--cr-purple,#a78bfa))}
 body.cr-theme-enabled{--cyan:var(--cr-theme-a);--purple:var(--cr-theme-b);--cr-cyan:var(--cr-theme-a);--cr-purple:var(--cr-theme-b)}
 .cr-theme-backdrop{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.25;background-position:center;background-size:cover;background-repeat:no-repeat;transition:opacity .25s ease}
 body.cr-theme-enabled .btn.primary,body.cr-theme-enabled button.primary{border-color:transparent}
 body.cr-theme-enabled .cr-theme-indicator{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid color-mix(in srgb,var(--cr-theme-a) 40%,transparent);border-radius:999px;color:var(--cr-theme-a);font-size:10px}
 @media(prefers-reduced-motion:reduce){.cr-theme-backdrop{transition:none}}
 `;
 document.head.appendChild(s)
}
function apply(t=read()){
 css();document.documentElement.style.setProperty('--cr-theme-a',t.c1);document.documentElement.style.setProperty('--cr-theme-b',t.c2);
 document.documentElement.style.setProperty('--cyan',t.c1);document.documentElement.style.setProperty('--purple',t.c2);document.documentElement.style.setProperty('--cr-cyan',t.c1);document.documentElement.style.setProperty('--cr-purple',t.c2);
 document.body.classList.add('cr-theme-enabled');
 let back=document.querySelector('.cr-theme-backdrop');if(!back){back=document.createElement('div');back.className='cr-theme-backdrop';back.setAttribute('aria-hidden','true');document.body.prepend(back)}
 const image=typeof t.image==='string'&&/^https?:\/\//i.test(t.image)?t.image:'';
 back.style.backgroundImage=image?'linear-gradient(180deg,rgba(5,7,13,.80),rgba(5,7,13,.91)),url("'+image.replace(/["\\]/g,'')+'")':'radial-gradient(ellipse at 12% 0%, '+t.c1+'24, transparent 38%),radial-gradient(ellipse at 90% 10%, '+t.c2+'24, transparent 40%)';
 back.style.opacity=image?'.20':'.6';
 document.documentElement.dataset.crowrulesTheme=t.id||'cyberwave';
 document.documentElement.style.colorScheme='dark';
}
function addStudioLink(){document.querySelectorAll('.links,.nav-links,.listener-links').forEach(nav=>{if(nav.querySelector('a[href*="theme-studio.html"]'))return;const a=document.createElement('a');a.href=location.pathname.includes('/listener/')||location.pathname.includes('/creator/')||location.pathname.includes('/studio/')||location.pathname.includes('/admin/')?'../theme-studio.html':'theme-studio.html';a.textContent='Theme Studio';a.setAttribute('aria-label','Open CrowRules Theme Studio');nav.appendChild(a)})}
const api={key:KEY,read,apply,save(t){if(!t||!validHex(t.c1)||!validHex(t.c2))return;try{localStorage.setItem(KEY,JSON.stringify({...DEFAULTS,...t}));apply(t)}catch{apply(t)}}};
window.CrowRulesThemeSystem=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();addStudioLink()},{once:true});else{apply();addStudioLink()}
window.addEventListener('storage',e=>{if(e.key===KEY)apply(read())});
})();