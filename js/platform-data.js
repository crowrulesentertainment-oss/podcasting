/* CrowRules Podcasting — Unified Data/Application Layer 1.0 */
(function(){
"use strict";
if(window.CrowRulesData)return;
const CFG={url:window.CROWRULES_SUPABASE_URL||"https://cevylpnoexugwgygvtgu.supabase.co",key:window.CROWRULES_SUPABASE_PUBLISHABLE_KEY||"",refreshMs:120000};
let db=null,session=null,channel=null,readyPromise=null,timer=null;
const state={status:"booting",user:null,session:null,error:null,lastSync:null,realtime:"offline",permission:"guest"};
const authListeners=new Set();
const listeners=new Set();
function emit(){bindStates();const snapshot=structuredClone(state);listeners.forEach(fn=>{try{fn(snapshot)}catch(_){}});window.dispatchEvent(new CustomEvent("crowrules:data-state",{detail:snapshot}))}
function setStatus(status,error=null){state.status=status;state.error=error?String(error.message||error):null;state.permission=state.user?"authenticated":"guest";emit()}
async function waitForClient(){for(let i=0;i<60;i++){if(window.supabaseClient)return window.supabaseClient;if(window.supabase?.createClient&&CFG.key){db=window.supabase.createClient(CFG.url,CFG.key);return db}await new Promise(r=>setTimeout(r,100))}throw new Error("Supabase client unavailable")}
async function boot(){if(readyPromise)return readyPromise;readyPromise=(async()=>{try{setStatus("loading");db=await waitForClient();const r=await db.auth.getSession();session=r.data?.session||null;state.session=session;state.user=session?.user||null;if(!state.user){state.lastSync=new Date().toISOString();setStatus("guest");return state}await startRealtime();state.lastSync=new Date().toISOString();setStatus("ready");timer=setInterval(()=>refresh(),refreshMs);return state}catch(e){setStatus("error",e);return state}})();return readyPromise}
async function getUser(){await boot();return state.user||null}
async function getAccessToken(){await boot();return session?.access_token||null}
async function requireAuth(){const user=await getUser();if(!user){const e=new Error("Authentication required");e.code="AUTH_REQUIRED";throw e}return user}
async function query(table,options={}){const client=await getClientAsync();let q=client.from(table);if(options.select)q=q.select(options.select);if(options.eq)for(const [k,v] of Object.entries(options.eq))q=q.eq(k,v);if(options.order)q=q.order(options.order.column,{ascending:options.order.ascending!==false});if(options.limit)q=q.limit(options.limit);if(options.single)q=q.single();return q}
async function getClientAsync(){await boot();if(!db)throw new Error("Supabase client unavailable");return db}
function createStateElement(type,message){const el=document.createElement("div");el.className="cr-data-"+type;el.setAttribute("role",type==="error"?"alert":"status");el.textContent=message||({loading:"Loading…",error:"Something went wrong.",empty:"Nothing here yet.",auth:"Sign in to continue.",forbidden:"You do not have permission to view this area."}[type]||"");return el}
function renderState(container,type,message){if(!container)return null;container.querySelectorAll(":scope > .cr-data-loading,:scope > .cr-data-error,:scope > .cr-data-empty,:scope > .cr-data-auth,:scope > .cr-data-forbidden").forEach(e=>e.remove());const el=createStateElement(type,message);container.prepend(el);return el}
function bindStates(root=document){root.querySelectorAll("[data-cr-auth]").forEach(el=>{el.hidden=state.user?el.dataset.crAuth==="guest":el.dataset.crAuth==="required"})}
function subscribe(table,filter,handler){if(!db||!state.user)return()=>{};const name="crowrules-data-"+table+"-"+Date.now();const ch=db.channel(name).on("postgres_changes",{event:"*",schema:"public",table,filter},handler);ch.subscribe();return()=>{try{db.removeChannel(ch)}catch(_){}}}
async function refresh(){if(!db)return boot();try{const r=await db.auth.getSession();session=r.data?.session||null;state.session=session;state.user=session?.user||null;state.lastSync=new Date().toISOString();setStatus(state.user?"ready":"guest");if(state.user&&!channel)await startRealtime();if(state.user){if(!timer)timer=setInterval(()=>refresh(),refreshMs)}else if(timer){clearInterval(timer);timer=null}if(!state.user&&channel){try{await db.removeChannel(channel)}catch(_){}channel=null;state.realtime="offline"}emit();return state}catch(e){setStatus("error",e);return state}}
async function startRealtime(){if(!db||!state.user||channel)return;const id=state.user.id;channel=db.channel("crowrules-platform-data-"+id.slice(0,12));channel.on("postgres_changes",{event:"*",schema:"public",table:"podcast_notifications",filter:"user_id=eq."+id},()=>emit());channel.subscribe(s=>{state.realtime=s==="SUBSCRIBED"?"connected":(s==="CHANNEL_ERROR"||s==="TIMED_OUT"?"disconnected":state.realtime);emit()})}
async function signOut(){if(!db)return;await db.auth.signOut()}
window.CrowRulesData={ready:boot(),createStateElement,renderState,bindStates,getClient:()=>db,getClientAsync,getAccessToken,getState:()=>structuredClone(state),getUser,requireAuth,query,subscribe,refresh,signOut,on:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
window.CrowRulesData.ready.then(()=>{if(db?.auth)db.auth.onAuthStateChange(()=>refresh())}).catch(()=>{});
})();