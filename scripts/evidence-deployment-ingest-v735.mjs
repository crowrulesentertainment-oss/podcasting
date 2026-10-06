import fs from 'node:fs';
const file='.evidence-compliance/deployment-ledger.json';
if(!fs.existsSync(file)){console.log('No V7.34 ledger artifact; skipping ingestion.');process.exit(0)}
const url=process.env.CROW_SUPABASE_URL;
const key=process.env.CROW_SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.log('V7.35 ingestion skipped: GitHub Supabase ingestion secrets are not configured.');process.exit(0)}
const row=JSON.parse(fs.readFileSync(file,'utf8'));
const res=await fetch(url+'/rest/v1/cr_podcast_evidence_deployment_ledger_v734',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});
if(!res.ok){console.error('V7.35 ingestion failed',res.status,await res.text());process.exit(1)}
console.log('V7.35 deployment ledger ingested for commit '+row.commit_sha);