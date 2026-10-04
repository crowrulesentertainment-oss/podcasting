import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const files=fs.readdirSync(root).filter(name=>name.endsWith('.html')&&name!=='launch.html');
const marker='data-crow-v8-runtime';

for(const name of files){
  const file=path.join(root,name);
  let html=fs.readFileSync(file,'utf8');
  const before=html;

  html=html.replace(/<script[^>]+(?:js\/config\.js|js\/app\.js|js\/podcasting-nav-v7\.js|js\/podcasting-nav-v2\.js|js\/site-repair-v1\.js)[^>]*><\/script>\s*/gi,'');
  html=html.replace(/<div\s+data-nav(?:=[^>]*)?>\s*<\/div>/gi,'');
  html=html.replace(/<link[^>]+href=["']css\/podcasting\.css[^>]*>\s*/gi,'');

  if(!html.includes(`css/podcasting.css?v=20261004-v8`)){
    html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="css/podcasting.css?v=20261004-v8">\n</head>');
  }

  const runtime=`<div data-nav ${marker}="8"></div>\n<script src="js/config.js?v=20261004-v8" defer></script>\n<script src="js/app.js?v=20261004-v8" defer></script>\n`;
  html=html.replace(/<body([^>]*)>/i,(m,attrs)=>m+'\n'+runtime);

  if(html!==before) fs.writeFileSync(file,html);
}

console.log(`Podcasting V8 normalized ${files.length} HTML pages (launch.html preserved).`);
