import{sb}from"./client.js";

const STYLE_ID="crp-page-analytics-style";
const SECTION_ID="crp-page-analytics";
let refreshTimer=null,observer=null,busy=false;

function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function number(value){return Number(value||0).toLocaleString()}
function formatDate(value){if(!value)return"—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":date.toLocaleString()}
function ensureStyle(){
 if(document.getElementById(STYLE_ID))return;
 const style=document.createElement("style");style.id=STYLE_ID;
 style.textContent=`
 #${SECTION_ID}{margin:22px 0;padding:22px;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:linear-gradient(145deg,rgba(20,24,33,.98),rgba(10,12,18,.98));color:#f5f7fb}
 #${SECTION_ID} .crp-pa-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
 #${SECTION_ID} h3{margin:4px 0 7px;font-size:21px}
 #${SECTION_ID} p{margin:0;color:#aab4c3;line-height:1.55}
 #${SECTION_ID} .crp-pa-kicker{font-size:10px;font-weight:850;letter-spacing:.16em;color:#e2b85d}
 #${SECTION_ID} .crp-pa-controls{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
 #${SECTION_ID} select{min-height:38px;padding:8px 12px;border:1px solid rgba(255,255,255,.2);border-radius:9px;background:#121824;color:#fff}
 #${SECTION_ID} .crp-pa-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:11px;margin-bottom:18px}
 #${SECTION_ID} .crp-pa-stat{padding:15px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.035)}
 #${SECTION_ID} .crp-pa-stat span{display:block;color:#aab4c3;font-size:11px}
 #${SECTION_ID} .crp-pa-stat strong{display:block;margin-top:7px;font-size:27px;font-variant-numeric:tabular-nums}
 #${SECTION_ID} .crp-pa-table{overflow:auto;border:1px solid rgba(255,255,255,.1);border-radius:12px}
 #${SECTION_ID} table{width:100%;min-width:620px;border-collapse:collapse}
 #${SECTION_ID} th,#${SECTION_ID} td{padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;font-size:12px}
 #${SECTION_ID} th{color:#aab4c3;font-size:10px;letter-spacing:.1em;text-transform:uppercase}
 #${SECTION_ID} td strong{color:#fff}
 #${SECTION_ID} .crp-pa-rank{color:#e2b85d;font-weight:850}
 #${SECTION_ID} .crp-pa-status{color:#9ca9ba;font-size:11px;margin-top:12px}
 @media(max-width:640px){#${SECTION_ID}{padding:15px}#${SECTION_ID} .crp-pa-head{display:block}#${SECTION_ID} .crp-pa-controls{margin-top:12px}}
 `;
 document.head.appendChild(style);
}
function ensureSection(){
 const anchor=document.getElementById("adminLiveActivityModule");
 if(!anchor)return null;
 let section=document.getElementById(SECTION_ID);
 if(!section){
  section=document.createElement("section");section.id=SECTION_ID;section.className="admin-module";
  section.innerHTML='<div class="crp-pa-head"><div><span class="crp-pa-kicker">PERMANENT PAGE-VIEW HISTORY</span><h3>Most-visited pages</h3><p>Saved page views across the entire Podcasting site, including owner and administrator visits. Counts are retained in Supabase.</p></div><div class="crp-pa-controls"><label for="crp-pa-period">Reporting period</label><select id="crp-pa-period"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 365 days</option><option value="0">All time</option></select></div></div><div class="crp-pa-stats"><div class="crp-pa-stat"><span>Page views</span><strong id="crp-pa-total-views">—</strong></div><div class="crp-pa-stat"><span>Unique visitors / day</span><strong id="crp-pa-total-visitors">—</strong></div><div class="crp-pa-stat"><span>Sessions</span><strong id="crp-pa-total-sessions">—</strong></div></div><div id="crp-pa-pages" class="crp-pa-table"><p style="padding:16px">Loading saved page rankings…</p></div><div id="crp-pa-status" class="crp-pa-status" aria-live="polite">Connecting to saved analytics…</div>';
  anchor.insertAdjacentElement("afterend",section);
  section.querySelector("#crp-pa-period").addEventListener("change",refresh);
 }
 return section;
}
async function refresh(){
 if(busy)return;const section=ensureSection();if(!section)return;busy=true;
 const status=section.querySelector("#crp-pa-status"),days=Number(section.querySelector("#crp-pa-period").value);
 if(status)status.textContent="Refreshing saved analytics…";
 try{
  const{data,error}=await sb.rpc("podcasting_admin_top_pages",{p_days:days,p_limit:30});
  if(error)throw error;
  const totals=data?.totals||{},pages=Array.isArray(data?.pages)?data.pages:[];
  section.querySelector("#crp-pa-total-views").textContent=number(totals.page_views);
  section.querySelector("#crp-pa-total-visitors").textContent=number(totals.unique_visitors);
  section.querySelector("#crp-pa-total-sessions").textContent=number(totals.sessions);
  section.querySelector("#crp-pa-pages").innerHTML=pages.length?'<table><thead><tr><th>Rank</th><th>Page</th><th>Page views</th><th>Unique visitors</th><th>Sessions</th><th>Last viewed</th></tr></thead><tbody>'+pages.map((row,index)=>'<tr><td class="crp-pa-rank">#'+(index+1)+'</td><td><strong>'+escapeHTML(row.page_title||row.page_path)+'</strong><br><span style="color:#9ca9ba">'+escapeHTML(row.page_path)+'</span></td><td><strong>'+number(row.page_views)+'</strong></td><td>'+number(row.unique_visitors)+'</td><td>'+number(row.sessions)+'</td><td>'+escapeHTML(formatDate(row.last_viewed_at))+'</td></tr>').join("")+'</tbody></table>':'<p style="padding:16px">No saved page views for this period yet.</p>';
  if(status)status.textContent="Saved in Supabase · "+(days===0?"All-time history":"Last "+days+" days")+" · Updated "+formatDate(data?.generated_at)+".";
 }catch(error){if(status)status.textContent="Page analytics could not load: "+(error?.message||String(error));console.warn("Podcasting page analytics:",error)}
 finally{busy=false}
}
function mount(){
 const section=ensureSection();if(!section)return;
 ensureStyle();refresh();
 if(refreshTimer)clearInterval(refreshTimer);
 refreshTimer=setInterval(()=>{if(!document.hidden&&document.getElementById(SECTION_ID))refresh()},30000);
}
function start(){
 if(document.body?.dataset?.page!=="admin")return;
 mount();
 observer=new MutationObserver(()=>{if(!document.getElementById(SECTION_ID))mount()});
 observer.observe(document.getElementById("app")||document.body,{childList:true,subtree:true});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
