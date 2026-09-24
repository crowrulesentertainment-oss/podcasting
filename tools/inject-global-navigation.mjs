import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const skip=new Set(["node_modules",".git",".github"]);
let changed=0,total=0;

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(skip.has(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...walk(full));
    else if(entry.isFile() && entry.name.toLowerCase().endsWith(".html")) out.push(full);
  }
  return out;
}

for(const file of walk(root)){
  total++;
  const html=fs.readFileSync(file,"utf8");
  let next=html;
  const rel=path.relative(path.dirname(file),root).split(path.sep).filter(Boolean);
  const prefix=rel.length ? rel.map(()=>"..").join("/")+"/" : "";
  const navCss=prefix+"css/global-navigation.css";
  const navJs=prefix+"js/global-navigation.js";

  // Remove legacy navigation assets so every page uses the same Global Navigation.
  next=next.replace(/<link\\b[^>]*href=["'][^"']*professional-experience\\.css(?:\\?[^"']*)?["'][^>]*>\\s*/gi,"");
  next=next.replace(/<script\\b[^>]*src=["'][^"']*professional-experience\\.js(?:\\?[^"']*)?["'][^>]*>\\s*<\\/script>\\s*/gi,"");

  const cssRe=/<link\b[^>]*href=["'][^"']*css\/global-navigation\.css(?:\?[^"']*)?["'][^>]*>\s*/gi;
  const jsRe=/<script\b[^>]*src=["'][^"']*js\/global-navigation\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>\s*/gi;

  let cssSeen=false;
  next=next.replace(cssRe,()=>cssSeen ? "" : (cssSeen=true, "<link rel=\"stylesheet\" href=\"" + navCss + "\">
"));

  let jsSeen=false;
  next=next.replace(jsRe,()=>jsSeen ? "" : (jsSeen=true, "<script src=\"" + navJs + "\" defer></script>
"));

  if(!cssSeen && /<\/head>/i.test(next)){
    next=next.replace(/<\/head>/i,"<link rel=\"stylesheet\" href=\"" + navCss + "\">
</head>");
  }
  if(!jsSeen && /<\/head>/i.test(next)){
    next=next.replace(/<\/head>/i,"<script src=\"" + navJs + "\" defer></script>
</head>");
  }

  if(next!==html){
    fs.writeFileSync(file,next);
    changed++;
  }
}

console.log("Global Navigation 9.2 sync: scanned " + total + " HTML pages; updated " + changed + ".");