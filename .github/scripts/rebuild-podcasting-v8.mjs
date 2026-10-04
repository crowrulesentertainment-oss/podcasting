import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const files=fs.readdirSync(root).filter(name=>name.endsWith('.html')&&name!=='index.html'&&name!=='launch.html');
for(const name of files){
 const file=path.join(root,name);let html=fs.readFileSync(file,'utf8');const before=html;
 html=html.replace(/<script[^>]+(?:js\/config\.js|js\/app\.js|js\/podcasting-nav-v7\.js|js\/podcasting-nav-v2\.js|js\/site-repair-v1\.js|js\/podcasting-core-v8[^"']*\.js)[^>]*><\/script>\s*/gi,'');
 html=html.replace(/<div\s+data-nav(?:=[^>]*)?>\s*<\/div>/gi,'');
 html=html.replace(/<link[^>]+href=["']css\/podcasting\.css[^>]*>\s*/gi,'');
 html=html.replace(/<link[^>]+href=["']css\/podcasting-v9\.css[^>]*>\s*/gi,'');
 html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="css/podcasting-v9.css?v=20261004-9">\n</head>');
 const runtime='<script src="js/app.js?v=20261004-9" defer></script>\n<script src="js/site-repair-v1.js?v=20261004-9" defer></script>\n';
 html=html.replace(/<body([^>]*)>/i,(m,attrs)=>m+'\n'+runtime);
 if(html!==before)fs.writeFileSync(file,html);
}
console.log(`Podcasting V9 normalized ${files.length} HTML pages (index.html and launch.html preserved).`);
