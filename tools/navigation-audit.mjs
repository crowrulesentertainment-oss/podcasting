import fs from "node:fs";
import path from "node:path";

const root=process.cwd(), htmlFiles=[], issues=[];
const skip=new Set([".git","node_modules"]);
function walk(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    if(skip.has(e.name)) continue;
    const full=path.join(dir,e.name);
    if(e.isDirectory()) walk(full);
    else if(e.isFile()&&e.name.toLowerCase().endsWith(".html")) htmlFiles.push(full);
  }
}
walk(root);
const fileSet=new Set(htmlFiles.map(f=>path.relative(root,f).replaceAll(path.sep,"/")));
const inbound=new Map([...fileSet].map(f=>[f,[]]));
const external=/^(?:https?:|mailto:|tel:|javascript:|data:|#|\/\/)/i;
const localAssetExt=/\.(?:css|js|png|jpe?g|gif|webp|svg|ico|json|webmanifest|woff2?|ttf)$/i;

for(const file of htmlFiles){
  const rel=path.relative(root,file).replaceAll(path.sep,"/");
  const html=fs.readFileSync(file,"utf8");
  const refs=[...html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);
  const seenScripts=new Map(),seenStyles=new Map();
  for(const raw of refs){
    if(external.test(raw)) continue;
    const clean=raw.split("#")[0].split("?")[0];
    if(!clean) continue;
    const target=path.normalize(path.join(path.dirname(rel),clean)).replaceAll(path.sep,"/");
    if(/\.html$/i.test(clean)){
      if(!fileSet.has(target)) issues.push(`BROKEN_HTML|${rel}|${raw}`);
      else inbound.get(target)?.push(rel);
    }else if(localAssetExt.test(clean)&&!fs.existsSync(path.join(root,target))){
      issues.push(`BROKEN_ASSET|${rel}|${raw}`);
    }
    if(/\.js$/i.test(clean)) seenScripts.set(clean,(seenScripts.get(clean)||0)+1);
    if(/\.css$/i.test(clean)) seenStyles.set(clean,(seenStyles.get(clean)||0)+1);
  }
  for(const [src,n] of seenScripts) if(n>1) issues.push(`DUPLICATE_SCRIPT|${rel}|${src} x${n}`);
  for(const [src,n] of seenStyles) if(n>1) issues.push(`DUPLICATE_STYLE|${rel}|${src} x${n}`);
  if(/service_role|SUPABASE_SERVICE_ROLE|sk_live_|sk_test_|-----BEGIN (?:RSA|EC|OPENSSH) PRIVATE KEY-----/i.test(html)) issues.push(`SECRET_PATTERN|${rel}|potential credential/private key`);
  if(/<script[^>]+src=["'][^"']*global-navigation\.js["'][^>]*>.*<script[^>]+src=["'][^"']*global-navigation\.js["']/is.test(html)) issues.push(`DUPLICATE_GLOBAL_NAV|${rel}|global-navigation loaded more than once`);
}

const required=["index.html","home.html","navigation.html","podcasts.html","creators.html","create-podcast.html","creator-studio.html","profile.html","membership.html","account.html","support.html","site-map.html"];
for(const p of required) if(!fileSet.has(p)) issues.push(`MISSING_REQUIRED||${p}`);
const orphan=[...inbound.entries()].filter(([f,from])=>!from.length&&!required.includes(f)&&f!=="404.html").map(([f])=>f).sort();

console.log("CrowRules Podcasting — Repository Health Audit 3.0");
console.log(`HTML pages: ${fileSet.size}`);
console.log(`Issues: ${issues.length}`);
console.log(`Orphan HTML pages: ${orphan.length}`);
if(issues.length){console.log("\nISSUES");for(const i of issues)console.log("- "+i)}
if(orphan.length){console.log("\nORPHAN HTML PAGES");for(const o of orphan)console.log("- "+o)}
if(issues.length) process.exit(1);
