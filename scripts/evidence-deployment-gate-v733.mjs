import fs from 'node:fs';
const report=fs.existsSync('.evidence-compliance/change-guard.json')?JSON.parse(fs.readFileSync('.evidence-compliance/change-guard.json','utf8')):{summary:{blocked:0,warning:0}};
const blocked=Number(report.summary?.blocked||0), warnings=Number(report.summary?.warning||0);
const decision=blocked?'DEPLOYMENT_BLOCKED':warnings?'REVIEW_REQUIRED':'SAFE_TO_DEPLOY';
const reason=blocked?'V7.32 Change Guard detected a blocked evidence-consumer change.':warnings?'V7.32 detected mixed protected evidence access; deployment requires review.':'No V7.32 preventive compliance blockers were detected.';
const out={version:'V7.33',commit_sha:process.env.GITHUB_SHA||report.commit||'local',decision,guard_blocked:blocked,guard_warnings:warnings,reason,evaluated_at:new Date().toISOString()};
fs.mkdirSync('.evidence-compliance',{recursive:true});fs.writeFileSync('.evidence-compliance/deployment-gate.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(blocked)process.exit(1);
