import{readdirSync,existsSync,readFileSync}from"node:fs";
import{join}from"node:path";
const root=process.cwd();
const pages=readdirSync(root).filter(f=>f.endsWith(".html"));
if(!pages.length)throw Error("No HTML pages found");
const js=readFileSync(join(root,"assets/js/app.js"),"utf8");
const missing=[];
for(const page of pages){
 const html=readFileSync(join(root,page),"utf8");
 const refs=[...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(x=>x[1]).filter(x=>!/^https?:\/\//i.test(x));
 for(const ref of refs){const path=join(root,ref.split("?")[0]);if(!existsSync(path))missing.push(page+" -> "+ref)}
 const match=html.match(/data-page="([^"]+)"/);
 if(match){const key=match[1];const handled=key==="home"||key==="login"||key==="signup"||js.includes('page==="'+key+'"');if(!handled)missing.push(page+" -> no app handler for data-page="+key)}
}
if(missing.length)throw Error("Site checks failed:\n"+missing.join("\n"));
const publicFiles=["assets/js","assets/css"];
const secretPattern=/(sb_secret_[A-Za-z0-9_-]{12,}|service_role\s*[:=]|sk_live_[A-Za-z0-9]{12,}|whsec_[A-Za-z0-9]{12,}|re_[A-Za-z0-9]{20,})/i;
for(const dir of publicFiles)for(const f of readdirSync(join(root,dir))){const path=join(root,dir,f);if(!existsSync(path))continue;const content=readFileSync(path,"utf8");if(secretPattern.test(content))throw Error("Possible server secret found in "+path)}
console.log("PASS: "+pages.length+" HTML pages; all local assets resolve; page handlers exist; no obvious server secrets in public JS/CSS.");
