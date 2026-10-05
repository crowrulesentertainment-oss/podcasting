#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, "edge-functions.json");
const OUT_DIR = path.join(ROOT, "artifacts");
const LIVE_PATH = process.env.SUPABASE_FUNCTIONS_JSON || "";
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
const live = LIVE_PATH && fs.existsSync(LIVE_PATH) ? JSON.parse(fs.readFileSync(LIVE_PATH, "utf8")) : null;

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git","node_modules","artifacts"].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (/\.(html|js)$/i.test(ent.name)) out.push(p);
  }
  return out;
}
function lineAt(text, index) { return text.slice(0,index).split(/\n/).length; }
function add(refs, name, file, index, kind, sourceText) {
  if (!name) return;
  const key = name.trim();
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(key)) return;
  refs.push({ name:key, file:path.relative(ROOT,file).replaceAll("\\\\","/"), line:lineAt(sourceText,index), kind });
}

const files = walk(ROOT);
const refs = [];
const configValues = {};

for (const file of files) {
  const source = fs.readFileSync(file,"utf8");
  if (file.endsWith("js/config.js")) {
    for (const m of source.matchAll(/([A-Za-z0-9_]+)\s*:\s*["']([^"']+)["']/g)) configValues[m[1]]=m[2];
  }
}
for (const file of files) {
  const source = fs.readFileSync(file,"utf8");
  for (const m of source.matchAll(/supabase\.functions\.invoke\(\s*["']([^"']+)["']/g)) add(refs,m[1],file,m.index,"invoke-literal",source);
  for (const m of source.matchAll(/supabase\.functions\.invoke\(\s*CROW_CONFIG\.([A-Za-z0-9_]+)/g)) {
    const key=m[1];
    if (configValues[key]) add(refs,configValues[key],file,m.index,"invoke-config:"+key,source);
  }
  for (const m of source.matchAll(/\/functions\/v1\/([a-z0-9][a-z0-9-]*)/gi)) add(refs,m[1],file,m.index,"functions-url",source);
  for (const m of source.matchAll(/\$\{[^}]*\|\|\s*["']([a-z0-9][a-z0-9-]*)["']\s*\}/gi)) add(refs,m[1],file,m.index,"template-fallback",source);
}

const unique = [...new Map(refs.map(r=>[r.name+"|"+r.file+"|"+r.line+"|"+r.kind,r])).values()];
const referenced = [...new Set(unique.map(r=>r.name))].sort();
const regNames = new Set(Object.keys(registry.functions||{}));
const deprecated = registry.deprecated || {};
const liveList = live ? (Array.isArray(live) ? live : live.functions || []) : [];
const liveMap = live ? new Map(liveList.map(x=>[x.slug,x])) : null;

const missingLive = liveMap ? referenced.filter(n=>!liveMap.has(n)) : [];
const nonActive = liveMap ? referenced.filter(n=>liveMap.get(n)?.status && liveMap.get(n).status !== "ACTIVE") : [];
const deprecatedRefs = referenced.filter(n=>deprecated[n]);
const unregisteredLive = liveMap ? [...liveMap.keys()].filter(n=>!regNames.has(n)).sort() : [];
const registryMissingEntries = referenced.filter(n=>!regNames.has(n));

const report = {
  generated_at:new Date().toISOString(),
  scanned_files:files.length,
  references:unique,
  referenced_functions:referenced,
  registry_count:regNames.size,
  live_function_count:liveMap?.size ?? null,
  missing_live:missingLive,
  non_active:nonActive,
  deprecated_references:deprecatedRefs,
  registry_missing_entries:registryMissingEntries,
  live_unregistered:unregisteredLive
};

fs.mkdirSync(OUT_DIR,{recursive:true});
fs.writeFileSync(path.join(OUT_DIR,"edge-function-audit.json"),JSON.stringify(report,null,2)+"\n");

const md = [
"# CrowRules Podcasting Edge Function Audit",
"",
"Generated: "+report.generated_at,
"",
"| Metric | Value |",
"|---|---:|",
"| HTML/JS files scanned | "+report.scanned_files+" |",
"| Referenced functions | "+referenced.length+" |",
"| Registry functions | "+report.registry_count+" |",
"| Live functions | "+(report.live_function_count ?? "not supplied")+" |",
"| Missing live functions | "+missingLive.length+" |",
"| Non-active references | "+nonActive.length+" |",
"| Deprecated references | "+deprecatedRefs.length+" |",
"| Referenced but absent from registry | "+registryMissingEntries.length+" |",
"| Live but absent from registry | "+unregisteredLive.length+" |",
"",
"## Findings",
...missingLive.map(n=>"- MISSING LIVE FUNCTION: "+n),
...nonActive.map(n=>"- NON-ACTIVE FUNCTION: "+n),
...deprecatedRefs.map(n=>"- DEPRECATED FUNCTION: "+n),
...registryMissingEntries.map(n=>"- REFERENCED BUT NOT REGISTERED: "+n),
...unregisteredLive.map(n=>"- LIVE BUT NOT REGISTERED: "+n),
"",
"## References",
...unique.sort((a,b)=>a.name.localeCompare(b.name)||a.file.localeCompare(b.file)).map(r=>"- "+r.name+" — "+r.file+":"+r.line+" — "+r.kind)
].join("\n")+"\n";
fs.writeFileSync(path.join(OUT_DIR,"edge-function-audit.md"),md);
console.log(md);
if (missingLive.length || nonActive.length || deprecatedRefs.length) process.exit(1);
