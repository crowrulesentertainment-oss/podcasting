// CrowRules V7.55 Recovery Compliance Certificate
const V755_CERTIFICATE_RPC='issue_recovery_compliance_certificate_v755';
const V755_HISTORY_RPC='get_recovery_compliance_certificates_v755';
const esc755=v=>String(v??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const client755=()=>{const c=window.CROW_CONFIG||{};return window.supabase.createClient(c.supabaseUrl,c.supabaseKey)};
const download755=(type,body,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
async function issueV755(){const b=document.getElementById('v755Cert');if(!b)return;b.textContent='Issuing V7.55 certificate…';const r=await client755().rpc(V755_CERTIFICATE_RPC);if(r.error){b.textContent='Certificate not issued: '+r.error.message;return}const p=JSON.stringify(r.data,null,2);b.innerHTML='<h3>'+esc755(r.data.certificate_id)+'</h3><p><b>READY — 100/100</b></p><pre>'+esc755(p)+'</pre>';download755('application/json',p,'CrowRules_V7_55_Recovery_Certificate.json');historyV755()}
async function historyV755(){const b=document.getElementById('v755History');if(!b)return;const r=await client755().rpc(V755_HISTORY_RPC,{p_limit:25});b.textContent=r.error?r.error.message:JSON.stringify(r.data,null,2)}
window.CrowV755={issue:issueV755,history:historyV755,download:download755};