/* CrowRules Podcasting — Unified Data/Application Layer 1.0 */
(function(){
"use strict";
if(window.CrowRulesData)return;
const CFG={url:window.CROWRULES_SUPABASE_URL||"https://cevylpnoexugwgygvtgu.supabase.co",key:window.CROWRULES_SUPABASE_PUBLISHABLE_KEY||"",refreshMs:120000};
let db=null,session=null,channel=null,readyPromise=null,timer=null;
const state={status:"booting",user:null,session:null,error:null,lastSync:null,realtime:"offline"};
const listeners=new Set();
function emit(){const snapshot=structuredClone(state);listeners.forEach(fn=>{try{fn(snapshot)}catch(_){}});window.dispatchEvent(new CustomEvent("crowrules:data-state",{detail:snapshot}))}
function setStatus(status,error=null){state.status=status;state.error=error?String(error.message||error):null;emit()}
async function waitForClient(){for(let i=0;i<60;i++){if(window.supabaseClient)return window.supabaseClient;if(window.supabase?.createClient&&CFG.key){db=window.supabase.createClient(CFG.url,CFG.key);return db}await new Promise(r=>setTimeout(r,100))}throw new Error("Supabase client unavailable")}
async function boot(){if(readyPromise)return readyPromise;readyPromise=(async()=>{try{setStatus("loading");db=await waitForClient();const r=await db.auth.getSession();session=r.data?.session||null;state.session=session;state.user=session?.user||null;if(!state.user){state.lastSync=new Date().toISOString();setStatus("guest");return state}await startRealtime();state.lastSync=new Date().toISOString();setStatus("ready");timer=setInterval(()=>refresh(),refreshMs);return state}catch(e){setStatus("error",e);return state}})();return readyPromise}
async function refresh(){if(!db)return boot();try{const r=await db.auth.getSession();session=r.data?.session||null;state.session=session;state.user=session?.user||null;state.lastSync=new Date().toISOString();setStatus(state.user?"ready":"guest");if(state.user&&!channel)await startRealtime();if(!state.user&&channel){try{await db.removeChannel(channel)}catch(_){}channel=null;state.realtime="offline"}emit();return state}catch(e){setStatus("error",e);return state}}
async function startRealtime(){if(!db||!state.user||channel)return;const id=state.user.id;channel=db.channel("crowrules-platform-data-"+id.slice(0,12));channel.on("postgres_changes",{event:"*",schema:"public",table:"podcast_notifications",filter:"user_id=eq."+id},()=>emit());channel.subscribe(s=>{state.realtime=s==="SUBSCRIBED"?"connected":(s==="CHANNEL_ERROR"||s==="TIMED_OUT"?"disconnected":state.realtime);emit()})}
async function signOut(){if(!db)return;await db.auth.signOut()}
window.CrowRulesData={ready:boot(),getClient:()=>db,getState:()=>structuredClone(state),refresh,signOut,on:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
window.CrowRulesData.ready.then(()=>{if(db?.auth)db.auth.onAuthStateChange(()=>refresh())}).catch(()=>{});
})();