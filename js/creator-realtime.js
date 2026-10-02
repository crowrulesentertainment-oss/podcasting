/* CrowRules Podcasting Creator Realtime Bridge */
(function(){
"use strict";
const state={channel:null,tableHandlers:{},statusHandlers:[]};
function sb(){return window.CROW_SUPABASE||null}
function status(s,d){state.statusHandlers.forEach(fn=>{try{fn(s,d)}catch(e){}});document.dispatchEvent(new CustomEvent("crow:creator-realtime",{detail:{status:s,detail:d}}))}
function onStatus(fn){if(typeof fn!=="function")return()=>{};state.statusHandlers.push(fn);return()=>{state.statusHandlers=state.statusHandlers.filter(x=>x!==fn)}}
function on(table,fn){if(!state.tableHandlers[table])state.tableHandlers[table]=[];state.tableHandlers[table].push(fn);return()=>{state.tableHandlers[table]=(state.tableHandlers[table]||[]).filter(x=>x!==fn)}}
function dispatch(table,payload){(state.tableHandlers[table]||[]).forEach(fn=>{try{fn(payload)}catch(e){console.error(e)}})}
async function start(options={}){
 stop();const client=sb();if(!client){status("error","Supabase client unavailable");return null}
 const channel=client.channel(options.channelName||("crowrules-creator-live-"+Math.random().toString(36).slice(2)));
 const tables=options.tables||["podcasts","podcast_episodes","podcast_follows","podcast_listens","podcast_subscriptions"];
 tables.forEach(table=>{const cfg={event:"*",schema:"public",table};if(options.filters&&options.filters[table])cfg.filter=options.filters[table];channel.on("postgres_changes",cfg,p=>dispatch(table,p))});
 channel.subscribe(s=>{if(s==="SUBSCRIBED")status("connected");else if(s==="CHANNEL_ERROR"||s==="TIMED_OUT")status("error",s);else if(s==="CLOSED")status("disconnected");else status("connecting",s)});
 state.channel=channel;return channel
}
function stop(){if(state.channel){try{sb()?.removeChannel(state.channel)}catch(e){}state.channel=null}}
function bindUI(options={}){
 const el=document.querySelector(options.selector||"[data-creator-realtime]");if(!el)return()=>{};
 const label=el.querySelector("[data-realtime-label]")||el;
 return onStatus(s=>{el.dataset.status=s;if(s==="connected"){label.textContent=options.connectedText||"LIVE SYNC CONNECTED";el.classList.add("connected");el.classList.remove("error","connecting")}else if(s==="error"){label.textContent="LIVE SYNC ERROR";el.classList.add("error");el.classList.remove("connected","connecting")}else if(s==="connecting"){label.textContent="LIVE SYNC CONNECTING…";el.classList.add("connecting");el.classList.remove("connected","error")}else{label.textContent="LIVE SYNC DISCONNECTED";el.classList.remove("connected","connecting")}})
}
function toast(message){const el=document.querySelector("[data-realtime-toast]");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(el.__timer);el.__timer=setTimeout(()=>el.classList.remove("show"),4200)}
window.CROW_CREATOR_REALTIME={start,stop,on,onStatus,bindUI,toast};
})();