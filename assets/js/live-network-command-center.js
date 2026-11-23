const slug=s=>String(s||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g).slice(0,70)||"program";
const iso=v=>v?new Date(v).toISOString():null;
const pretty=v=>v?new Date(v).toLocaleString([],{dateStyle:"medium",timeStyle:"short"}):"Time TBD";
export async function initNetworkCommandCenter({sb,user,notify=()=>{}}={}){
 const mount=document.getElementById("studioLivePanel");
 if(!mount||!sb||!user?.id||document.getElementById("crLiveNetworkCommand"))return;
 const p=document.createElement("section");p.id="crLiveNetworkCommand";
 p.innerHTML=`
 <style>
 #crLiveNetworkCommand{margin:24px 0;padding:22px;border:1px solid rgba(212,174,97,.34);border-radius:20px;background:linear-gradient(145deg,#171a22,#090b10);color:#f6f6f7}
 #crLiveNetworkCommand *{box-sizing:border-box}#crLiveNetworkCommand h3,#crLiveNetworkCommand h4{color:#fff;margin:5px 0 8px}
 #crLiveNetworkCommand .k{font-size:11px;letter-spacing:.16em;font-weight:850;color:#d7b66f}#crLiveNetworkCommand .muted{color:#aeb5c2;font-size:13px;line-height:1.55}
 #crLiveNetworkCommand .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-top:16px}
 #crLiveNetworkCommand .card{min-width:0;padding:15px;border:1px solid #303745;border-radius:14px;background:#11151d}
 #crLiveNetworkCommand .full{grid-column:1/-1}#crLiveNetworkCommand label{display:block;margin:10px 0 5px;color:#c8ced8;font-size:12px;font-weight:750}
 #crLiveNetworkCommand input,#crLiveNetworkCommand select,#crLiveNetworkCommand textarea{width:100%;min-width:0;background:#090c12;color:#fff;border:1px solid #3c4554;border-radius:8px;padding:10px 11px;font:inherit;font-size:13px}
 #crLiveNetworkCommand textarea{min-height:70px;resize:vertical}#crLiveNetworkCommand .fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}
 #crLiveNetworkCommand button,#crLiveNetworkCommand a.action{display:inline-flex;align-items:center;justify-content:center;border:1px solid #b58d47;background:#c09a55;color:#11151c;border-radius:9px;padding:10px 13px;font-size:12px;font-weight:850;text-decoration:none;cursor:pointer}
 #crLiveNetworkCommand button.secondary{background:#202633;color:#f5f6f8;border-color:#465064}#crLiveNetworkCommand button.danger{background:#301c21;color:#ffb5b5;border-color:#75434b}
 #crLiveNetworkCommand button:disabled{opacity:.45;cursor:not-allowed}#crLiveNetworkCommand .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}
 #crLiveNetworkCommand .row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid #303745}
 #crLiveNetworkCommand .row:last-child{border:0}#crLiveNetworkCommand .row strong{display:block;color:#fff;font-size:13px}
 #crLiveNetworkCommand .row small{display:block;color:#aeb5c2;font-size:11px;line-height:1.5;margin-top:3px}
 #crLiveNetworkCommand .list{display:grid;gap:8px;margin-top:12px}#crLiveNetworkCommand .empty{padding:13px;border:1px dashed #3b4554;border-radius:10px;color:#aeb5c2;font-size:12px}
 #crLiveNetworkCommand .notice{border-left:3px solid #c7a15e;background:rgba(199,161,94,.09);padding:10px 12px;color:#d7dbe2;font-size:12px;line-height:1.55;margin-top:12px}
 #crLiveNetworkCommand .badge{display:inline-block;border:1px solid #66552f;border-radius:999px;padding:7px 10px;color:#e7c77f;font-size:11px;font-weight:850}
 #crLiveNetworkCommand .check{display:flex;align-items:center;gap:9px;margin-top:12px}#crLiveNetworkCommand .check input{width:auto}
 @media(max-width:700px){#crLiveNetworkCommand{padding:15px}#crLiveNetworkCommand .grid,#crLiveNetworkCommand .fields{grid-template-columns:1fr}#crLiveNetworkCommand .full{grid-column:auto}#crLiveNetworkCommand .row{align-items:flex-start;flex-wrap:wrap}}
 </style>
 <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><div class="k">CROWRULES LIVE · PERMANENT NETWORK INFRASTRUCTURE</div><h3>24/7 Network Command Center</h3><p class="muted">Start with a few scheduled shows and grow toward continuous programming. This dashboard manages the network plan; it does not start your encoder.</p></div><span class="badge">CONTINUOUS NETWORK</span></div>
 <div class="grid">
  <div class="card"><div class="muted">OPERATING MODEL</div><div style="font-size:32px;font-weight:900">24 / 7</div><div class="muted">A continuous network, built in stages.</div></div>
  <div class="card"><div class="muted">LIVEKIT CONNECTION</div><div style="font-size:23px;font-weight:900" id="lncLiveKit">NOT CONFIGURED</div><div class="muted">Secure server credentials are required before rooms can go live.</div><div class="actions"><a class="action" href="/podcasting/live/host.html" target="_blank" rel="noopener">Open host lounge ↗</a></div></div>
  <div class="card full"><h4>Public network identity</h4><div class="fields">
   <div><label>Network name</label><input id="lncName" value="CrowRules Live" maxlength="100"></div>
   <div><label>Timezone</label><select id="lncTz"><option value="America/Los_Angeles">Pacific Time</option><option value="America/Denver">Mountain Time</option><option value="America/Chicago">Central Time</option><option value="America/New_York">Eastern Time</option><option value="UTC">UTC</option></select></div>
   <div><label>YouTube live video ID</label><input id="lncVideo" maxlength="11" placeholder="11-character video ID"></div>
   <div><label>YouTube channel ID</label><input id="lncChannel" maxlength="40" placeholder="UC..."></div>
   <div><label>Current program</label><input id="lncCurrent" maxlength="160" placeholder="Currently on air"></div>
   <div><label>Current host</label><input id="lncHost" maxlength="120" placeholder="Presenter"></div>
   <div><label>Next program</label><input id="lncNext" maxlength="160" placeholder="Upcoming show"></div>
   <div><label>Next program start</label><input id="lncNextAt" type="datetime-local"></div>
  </div><label>Public description</label><textarea id="lncDesc" maxlength="1200" placeholder="What viewers can expect from CrowRules Live"></textarea>
  <div class="fields"><div><label>Public status</label><select id="lncStatus"><option value="offline">Offline / schedule</option><option value="live">Live now</option><option value="standby">Standby programming</option></select></div><div class="check"><input id="lncPublish" type="checkbox"><label for="lncPublish" style="margin:0">Publish on public live page</label></div></div>
  <div class="actions"><button id="lncSave">Save public settings</button><a class="action" href="/podcasting/live/" target="_blank" rel="noopener">Open public live page ↗</a></div><p class="muted" id="lncPublicMsg" role="status">Loading network settings…</p></div>
  <div class="card"><h4>Program library</h4><p class="muted">Create the shows that will make up your network schedule.</p>
   <label>Program title</label><input id="lncProgramTitle" maxlength="140" placeholder="Example: Tacoma Nights">
   <div class="fields"><div><label>Category</label><select id="lncCategory"><option value="conversation">Conversation</option><option value="community">Community</option><option value="gaming">Gaming</option><option value="sports">Sports</option><option value="interview">Interview</option><option value="music">Music</option><option value="news">News & updates</option><option value="special">Special event</option></select></div><div><label>Format</label><select id="lncFormat"><option value="live">Live show</option><option value="prerecorded">Prerecorded</option><option value="gaming">Gaming</option><option value="standby">Standby / filler</option><option value="special">Special event</option></select></div></div>
   <label>Default duration (minutes)</label><input id="lncDuration" type="number" min="5" max="1440" step="5" value="60">
   <label>Description</label><textarea id="lncProgramDesc" maxlength="800"></textarea><div class="actions"><button id="lncAddProgram">Add program</button></div>
   <div class="list" id="lncPrograms"><div class="empty">Loading programs…</div></div>
  </div>
  <div class="card"><h4>Programming rundown</h4><p class="muted">Schedule shows and host handoffs.</p>
   <label>Program</label><select id="lncScheduleProgram"><option value="">Create a program first</option></select>
   <div class="fields"><div><label>Start</label><input id="lncStart" type="datetime-local"></div><div><label>End</label><input id="lncEnd" type="datetime-local"></div><div><label>Host / presenter</label><input id="lncScheduleHost" maxlength="120"></div><div><label>Host account UUID (optional)</label><input id="lncScheduleHostUser" maxlength="36" placeholder="Assign an authenticated remote host"></div><div><label>Handoff</label><select id="lncHandoff"><option value="producer_approved">Producer-approved</option><option value="manual">Manual</option></select></div></div>
   <label>Producer notes</label><textarea id="lncNotes" maxlength="800"></textarea><div class="actions"><button id="lncAddSchedule">Add to rundown</button></div>
   <div class="list" id="lncSchedule"><div class="empty">Loading rundown…</div></div>
  </div>
  <div class="card full"><h4>Streamlabs Desktop remote control</h4>
   <p class="muted">Connect this browser to Streamlabs Desktop on your production computer. Enable Settings → Remote Control in Streamlabs and copy its local API token. The token is kept in memory for this page session only.</p>
   <div class="fields"><div><label>Local API port</label><input id="lncSlPort" type="number" min="1" max="65535" value="59650"></div><div><label>Streamlabs Remote Control token</label><input id="lncSlToken" type="password" autocomplete="off" placeholder="Paste local token (not saved)"></div></div>
   <div class="actions"><button id="lncSlConnect">Connect Streamlabs</button><button id="lncSlDisconnect" class="secondary" disabled>Disconnect</button></div>
   <p class="muted" id="lncSlStatus" role="status">Not connected to Streamlabs Desktop.</p>
   <div class="fields"><div><label>Available scenes</label><select id="lncSlScenes"><option value="">Connect to load scenes</option></select></div><div class="actions" style="align-items:end"><button id="lncSlSwitch" disabled>Switch Streamlabs scene</button></div></div>
  </div>
  <div class="card full"><h4>Production readiness</h4>
   <div class="notice"><b>Central production:</b> Streamlabs Desktop stays on your production computer. Remote scene control will require a separately installed local Production Bridge. Keep stream keys and software passwords out of browser storage and Supabase metadata.</div>
   <div class="notice"><b>LiveKit:</b> This first foundation prepares the schedule and access model. LiveKit rooms cannot be activated until API credentials are securely configured and the host connection portal is deployed.</div>
   <div class="notice"><b>24/7 reliability:</b> A real always-on network needs a tested backup encoder, power and internet contingency, operator coverage and a verified playout/recording workflow.</div>
  </div>
 </div>`;
 mount.insertBefore(p,mount.firstChild);
 const $=id=>p.querySelector("#"+id),state={programs:[],schedule:[]};
 const msg=(id,v)=>$(id).textContent=v;
 const loadPublic=async()=>{
  const {data,error}=await sb.from("live_network_public_state").select("*").eq("owner_id",user.id).maybeSingle();if(error)throw error;
  if(!data)return;
  $("lncName").value=data.network_name||"CrowRules Live";$("lncTz").value=data.timezone||"America/Los_Angeles";
  $("lncVideo").value=data.youtube_video_id||"";$("lncChannel").value=data.youtube_channel_id||"";
  $("lncCurrent").value=data.current_program_title||"";$("lncHost").value=data.current_host||"";
  $("lncNext").value=data.next_program_title||"";$("lncNextAt").value=data.next_program_starts_at?new Date(data.next_program_starts_at).toISOString().slice(0,16):"";
  $("lncDesc").value=data.description||"";$("lncStatus").value=data.public_status||"offline";$("lncPublish").checked=!!data.is_published;
 };
 const savePublic=async()=>{
  const video=$("lncVideo").value.trim(),channel=$("lncChannel").value.trim();
  if(video&&!/^[A-Za-z0-9_-]{11}$/.test(video))throw Error("YouTube video ID must be 11 characters.");
  if(channel&&!/^UC[A-Za-z0-9_-]{20,}$/.test(channel))throw Error("Check the YouTube channel ID.");
  const payload={owner_id:user.id,network_name:$("lncName").value.trim()||"CrowRules Live",timezone:$("lncTz").value,youtube_video_id:video||null,youtube_channel_id:channel||null,current_program_title:$("lncCurrent").value.trim()||null,current_host:$("lncHost").value.trim()||null,next_program_title:$("lncNext").value.trim()||null,next_program_starts_at:iso($("lncNextAt").value),description:$("lncDesc").value.trim()||null,public_status:$("lncStatus").value,is_published:$("lncPublish").checked,updated_at:new Date().toISOString()};
  const {error}=await sb.from("live_network_public_state").upsert(payload,{onConflict:"owner_id"});if(error)throw error;msg("lncPublicMsg","Public network settings saved.");notify("CrowRules Live settings saved.");
 };
 const loadPrograms=async()=>{
  const {data,error}=await sb.from("live_network_programs").select("*").eq("owner_id",user.id).order("title");if(error)throw error;state.programs=data||[];
  const list=$("lncPrograms"),select=$("lncScheduleProgram");list.replaceChildren();select.replaceChildren();select.add(new Option("Choose a program",""));
  if(!state.programs.length)list.innerHTML='<div class="empty">No programs yet. Add your first show above.</div>';
  state.programs.forEach(x=>{
   select.add(new Option(x.title,x.id));const row=document.createElement("div");row.className="row";const info=document.createElement("div"),title=document.createElement("strong"),detail=document.createElement("small");
   title.textContent=x.title;detail.textContent=x.category+" · "+x.format+" · "+x.default_duration_minutes+" min";info.append(title,detail);
   const del=document.createElement("button");del.className="danger";del.textContent="Remove";del.addEventListener("click",async()=>{if(!confirm("Remove this program and its scheduled entries?"))return;try{const {error}=await sb.from("live_network_programs").delete().eq("id",x.id).eq("owner_id",user.id);if(error)throw error;await loadPrograms();await loadSchedule()}catch(e){notify(e.message)}});row.append(info,del);list.append(row);
  });
 };
 const loadSchedule=async()=>{
  const {data,error}=await sb.from("live_network_schedule").select("id,program_id,starts_at,ends_at,host_name,status,handoff_mode,live_network_programs(title)").eq("owner_id",user.id).order("starts_at").limit(50);if(error)throw error;state.schedule=data||[];
  const list=$("lncSchedule");list.replaceChildren();if(!state.schedule.length){list.innerHTML='<div class="empty">No programming scheduled yet.</div>';return}
  state.schedule.forEach(x=>{
   const row=document.createElement("div");row.className="row";const info=document.createElement("div"),title=document.createElement("strong"),detail=document.createElement("small");
   title.textContent=x.live_network_programs?.title||"Program";detail.textContent=pretty(x.starts_at)+" → "+pretty(x.ends_at)+" · "+(x.host_name||"Host TBD")+" · "+x.status.replaceAll("_"," ")+" · ID "+x.id;info.append(title,detail);
   const actions=document.createElement("div");actions.className="actions";
   if(x.status==="scheduled"){const ready=document.createElement("button");ready.className="secondary";ready.textContent="Mark ready";ready.addEventListener("click",()=>updateSlot(x.id,{status:"ready"}));actions.append(ready)}
   const del=document.createElement("button");del.className="danger";del.textContent="Remove";del.addEventListener("click",()=>removeSlot(x.id));actions.append(del);row.append(info,actions);list.append(row);
  });
 };
 let slSocket=null,slId=0,slPending=new Map(),slConnected=false;
 const slStatus=text=>msg("lncSlStatus",text);
 const slLoadLibrary=()=>new Promise((resolve,reject)=>{
  if(window.SockJS){resolve(window.SockJS);return}
  const existing=document.querySelector('script[data-cr-sockjs]');
  if(existing){existing.addEventListener("load",()=>resolve(window.SockJS),{once:true});existing.addEventListener("error",()=>reject(Error("Could not load Streamlabs connection library.")),{once:true});return}
  const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/sockjs-client@1.6.1/dist/sockjs.min.js";script.async=true;script.dataset.crSockjs="true";
  script.onload=()=>window.SockJS?resolve(window.SockJS):reject(Error("Streamlabs connection library did not initialize."));
  script.onerror=()=>reject(Error("Could not load Streamlabs connection library."));document.head.append(script);
 });
 const slRequest=(resource,method,args=[])=>new Promise((resolve,reject)=>{
  if(!slSocket||slSocket.readyState!==1){reject(Error("Streamlabs is not connected."));return}
  const id=++slId,timer=setTimeout(()=>{slPending.delete(id);reject(Error("Streamlabs request timed out."))},9000);
  slPending.set(id,{resolve,reject,timer});
  slSocket.send(JSON.stringify({jsonrpc:"2.0",id,method,params:{resource,args}}));
 });
 const slDisconnect=()=>{
  slConnected=false;for(const [id,pending] of slPending){clearTimeout(pending.timer);pending.reject(Error("Streamlabs disconnected."));slPending.delete(id)}
  if(slSocket){try{slSocket.close()}catch{}slSocket=null}
  $("lncSlDisconnect").disabled=true;$("lncSlConnect").disabled=false;$("lncSlSwitch").disabled=true;
  $("lncSlScenes").replaceChildren(new Option("Connect to load scenes",""));slStatus("Disconnected from Streamlabs Desktop.");
 };
 const slConnect=async()=>{
  const port=Number($("lncSlPort").value),token=$("lncSlToken").value.trim();
  if(!Number.isInteger(port)||port<1||port>65535||!token){slStatus("Enter the local API port and Streamlabs Remote Control token.");return}
  $("lncSlConnect").disabled=true;slStatus("Loading Streamlabs connection…");
  try{
   const SockJS=await slLoadLibrary();if(slSocket)slDisconnect();
   slSocket=new SockJS("http://127.0.0.1:"+port+"/api");
   slSocket.onmessage=event=>{let packet;try{packet=JSON.parse(event.data)}catch{return}if(packet.id&&slPending.has(packet.id)){const pending=slPending.get(packet.id);slPending.delete(packet.id);clearTimeout(pending.timer);packet.error?pending.reject(Error(packet.error.message||"Streamlabs API error.")):pending.resolve(packet.result)}};
   slSocket.onclose=()=>{if(slConnected||slSocket){slConnected=false;$("lncSlDisconnect").disabled=true;$("lncSlConnect").disabled=false;$("lncSlSwitch").disabled=true;slStatus("Streamlabs connection closed. Check that Streamlabs Desktop is open.")}};
   await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error("Timed out connecting to Streamlabs on this computer.")),9000);slSocket.onopen=()=>{clearTimeout(timeout);resolve()};const prior=slSocket.onclose;slSocket.onclose=e=>{clearTimeout(timeout);prior?.(e);reject(Error("Could not connect. Enable Settings → Remote Control in Streamlabs Desktop."))}});
   await slRequest("TcpServerService","auth",[token]);
   const scenes=await slRequest("ScenesService","getScenes",[]);
   if(!Array.isArray(scenes))throw Error("Streamlabs did not return a scene list.");
   const select=$("lncSlScenes");select.replaceChildren(new Option("Choose a scene",""));
   scenes.forEach(scene=>select.add(new Option(scene.name,scene.id)));
   slConnected=true;$("lncSlDisconnect").disabled=false;$("lncSlSwitch").disabled=false;slStatus("Connected to Streamlabs · "+scenes.length+" scene(s) available. Token remains in memory only.");
  }catch(error){slDisconnect();slStatus(error.message||"Could not connect to Streamlabs.");}
 };
 $("lncSlConnect").addEventListener("click",slConnect);
 $("lncSlDisconnect").addEventListener("click",slDisconnect);
 $("lncSlSwitch").addEventListener("click",async()=>{const id=$("lncSlScenes").value;if(!slConnected||!id){slStatus("Choose a scene first.");return}try{await slRequest("ScenesService","makeSceneActive",[id]);slStatus("Streamlabs scene switched successfully.")}catch(e){slStatus(e.message||"Scene switch failed.")}});
 const updateSlot=async(id,patch)=>{try{const {error}=await sb.from("live_network_schedule").update({...patch,updated_at:new Date().toISOString()}).eq("id",id).eq("owner_id",user.id);if(error)throw error;await loadSchedule()}catch(e){notify(e.message)}};
 const removeSlot=async id=>{try{const {error}=await sb.from("live_network_schedule").delete().eq("id",id).eq("owner_id",user.id);if(error)throw error;await loadSchedule()}catch(e){notify(e.message)}};
 $("lncSave").addEventListener("click",async()=>{const b=$("lncSave");b.disabled=true;try{await savePublic()}catch(e){msg("lncPublicMsg",e.message);notify(e.message)}finally{b.disabled=false}});
 $("lncAddProgram").addEventListener("click",async()=>{const b=$("lncAddProgram"),title=$("lncProgramTitle").value.trim();if(!title){notify("Enter a program title.");return}b.disabled=true;try{const {error}=await sb.from("live_network_programs").insert({owner_id:user.id,title,slug:slug(title),description:$("lncProgramDesc").value.trim(),category:$("lncCategory").value,format:$("lncFormat").value,default_duration_minutes:Math.max(5,Math.min(1440,Number($("lncDuration").value)||60))});if(error)throw error;$("lncProgramTitle").value="";$("lncProgramDesc").value="";await loadPrograms();notify("Program added.")}catch(e){notify(e.message)}finally{b.disabled=false}});
 $("lncAddSchedule").addEventListener("click",async()=>{const b=$("lncAddSchedule"),program=state.programs.find(x=>x.id===$("lncScheduleProgram").value),start=$("lncStart").value,end=$("lncEnd").value;if(!program||!start||!end){notify("Choose a program and both schedule times.");return}if(new Date(end)<=new Date(start)){notify("End time must be after start time.");return}b.disabled=true;try{const {error}=await sb.from("live_network_schedule").insert({owner_id:user.id,program_id:program.id,starts_at:iso(start),ends_at:iso(end),host_name:$("lncScheduleHost").value.trim()||null,host_user_id:$("lncScheduleHostUser").value.trim()||null,handoff_mode:$("lncHandoff").value,notes:$("lncNotes").value.trim()});if(error)throw error;await loadSchedule();notify("Program added to the rundown.")}catch(e){notify(e.message)}finally{b.disabled=false}});
 try{await Promise.all([loadPublic(),loadPrograms(),loadSchedule()]);msg("lncPublicMsg","Network settings loaded. Save to publish the public channel state.")}catch(e){msg("lncPublicMsg","Could not load network data: "+e.message+". Verify the foundation migration and Data API permissions.")}
}