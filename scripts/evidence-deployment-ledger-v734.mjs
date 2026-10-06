import fs from 'node:fs';
const guard=fs.existsSync('.evidence-compliance/change-guard.json')?JSON.parse(fs.readFileSync('.evidence-compliance/change-guard.json','utf8')):null;
const gate=fs.existsSync('.evidence-compliance/deployment-gate.json')?JSON.parse(fs.readFileSync('.evidence-compliance/deployment-gate.json','utf8')):null;
const files=(process.env.CROW_CHANGED_FILES||'').split(/\r?\n/).filter(Boolean);
const gateDecision=gate?.decision||'UNKNOWN';
const outcome=gateDecision==='SAFE_TO_DEPLOY'?'ALLOWED':gateDecision==='REVIEW_REQUIRED'?'REVIEW_REQUIRED':gateDecision==='DEPLOYMENT_BLOCKED'?'BLOCKED':'UNKNOWN';
const row={version:'V7.34',commit_sha:process.env.GITHUB_SHA||gate?.commit_sha||guard?.commit||'local',actor:process.env.GITHUB_ACTOR||'unknown',changed_files:files,guard_result:guard?.summary||null,gate_result:gateDecision,incident_state:process.env.CROW_INCIDENT_STATE||'UNKNOWN',deployment_outcome:outcome,decision_reason:gate?.reason||'No deployment decision was available.',workflow_run:process.env.GITHUB_RUN_ID||'local',recorded_at:new Date().toISOString()};
fs.mkdirSync('.evidence-compliance',{recursive:true});fs.writeFileSync('.evidence-compliance/deployment-ledger.json',JSON.stringify(row,null,2));console.log(JSON.stringify(row,null,2));