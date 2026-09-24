/* CrowRules Podcasting — Finance Domain Service 1.0 */
(()=>{"use strict";if(window.CrowRulesFinance)return;
const api=()=>window.CrowRulesData.getClientAsync();
async function rpc(name,args={}){const db=await api(),r=await db.rpc(name,args);if(r.error)throw r.error;return r.data}
async function query(table,select="*"){const u=await window.CrowRulesData.requireAuth(),db=await api();return db.from(table).select(select).eq("user_id",u.id).order("created_at",{ascending:false})}
window.CrowRulesFinance={version:"1.0",rpc,query};
})();