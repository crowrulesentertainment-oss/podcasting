import fs from 'node:fs';
import path from 'node:path';
const protectedTokens=['cr_podcast_population_evidence_v77','cr_podcast_evidence_audit_v712','cr_podcast_evidence_determinism_v717','cr_podcast_evidence_replays_v715','cr_podcast_evidence_provenance_v713','cr_podcast_evidence_dataset_ledger_v716'];
const gatePatterns=['evidenceReleaseGate','cr_podcast_evidence_release_gate_v721','get_evidence_release_v721'];
const files=process.argv.includes('--all')?[]:(process.env.CROW_CHANGED_FILES||'').split(/\r?\n/).filter(Boolean);
function scan(file){const c=fs.readFileSync(file,'utf8');const matched=protectedTokens.filter(t=>c.includes(t));const gate=gatePatterns.some(t=>c.includes(t));const direct=matched.length>0;let status='SAFE',reason='No protected evidence access detected.';if(direct&&!gate){status='BLOCKED';reason='Protected evidence access introduced without the V7.22 release gate.'}else if(direct&&gate){status='WARNING';reason='Protected evidence access and release-gate access coexist; review before merge.'}return {path:file,risk_status:status,gate_reference:gate,direct_evidence_reference:direct,matched_tokens:matched,risk_reason:reason};}
const all=process.argv.includes('--all')?(()=>{const out=[];function walk(d){for(const n of fs.readdirSync(d)){if(['.git','node_modules','vendor','dist','build','.next','.cache','.evidence-compliance'].includes(n))continue;const p=path.join(d,n),st=fs.statSync(p);if(st.isDirectory())walk(p);else if(/\.(html|js)$/.test(n))out.push(p)}}walk('.');return out})():files;
const findings=all.filter(f=>fs.existsSync(f)).map(scan);fs.mkdirSync('.evidence-compliance',{recursive:true});
const report={version:'V7.32',commit:process.env.GITHUB_SHA||'local',checked_at:new Date().toISOString(),summary:{safe:findings.filter(x=>x.risk_status==='SAFE').length,warning:findings.filter(x=>x.risk_status==='WARNING').length,blocked:findings.filter(x=>x.risk_status==='BLOCKED').length},findings};
fs.writeFileSync('.evidence-compliance/change-guard.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
process.exit(report.summary.blocked?1:0);
