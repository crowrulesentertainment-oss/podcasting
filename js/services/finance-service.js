/* CrowRules Podcasting — Finance Domain Service 1.0 */
(()=>{"use strict";if(window.CrowRulesFinance)return;
const api=()=>window.CrowRulesData.getClientAsync();
async function rpc(name,args={}){const db=await api(),r=await db.rpc(name,args);if(r.error)throw r.error;return r.data}
async function query(table,select="*"){const u=await window.CrowRulesData.guard("payouts"),db=await api();return db.from(table).select(select).eq("user_id",u.id).order("created_at",{ascending:false})}
async function run(task){return window.CrowRulesData.run(task)}
const contract=fn=>async(...args)=>window.CrowRulesData.execute(()=>fn(...args));
window.CrowRulesFinance={version:"2.0",rpc:contract(rpc),query:contract(query)};
})();