const SHELL='/podcasting/js/crowrules-v14-universal.js?v=20261005-v14.11';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const r=event.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==self.location.origin||!u.pathname.startsWith('/podcasting/')||!u.pathname.endsWith('.html'))return;event.respondWith((async()=>{try{const res=await fetch(r,{cache:'no-store'});const type=res.headers.get('content-type')||'';if(!type.includes('text/html'))return res;let text=await res.text();
text=text
  .replace(/crow-podcasting-intelligence-v13\.js\?v=[^"' ]+/g,'crow-podcasting-intelligence-v13.js?v=20261005-v14.11')
  .replace(/crow-podcasting-player-v13-3\.js\?v=[^"' ]+/g,'crow-podcasting-player-v13-3.js?v=20261005-v14.11')
  .replace(/sitewide-v13\.js\?v=[^"' ]+/g,'sitewide-v13.js?v=20261005-v14.11')
  .replace(/site-repair-v1\.js\?v=[^"' ]+/g,'site-repair-v1.js?v=20261005-v14.11');
const tag='<script src="'+SHELL+'" defer></script>';if(/<script[^>]+crowrules-v14-universal\.js[^>]*><\/script>/i.test(text))text=text.replace(/<script[^>]+crowrules-v14-universal\.js[^>]*><\/script>/i,tag);else if(!text.includes('crowrules-v14-universal.js'))text=text.replace(/<\/head>/i,tag+'</head>');return new Response(text,{status:res.status,statusText:res.statusText,headers:res.headers})}catch(e){return fetch(r)}})())});
