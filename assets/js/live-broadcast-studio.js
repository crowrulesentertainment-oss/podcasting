const PLATFORMS = [
  ["youtube", "YouTube Live"], ["twitch", "Twitch"], ["facebook", "Facebook Live"],
  ["kick", "Kick"], ["custom", "Custom RTMP"]
];
const $ = selector => section.querySelector(selector);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = seconds => {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  return [Math.floor(n / 3600), Math.floor(n % 3600 / 60), n % 60].map(x => String(x).padStart(2, "0")).join(":");
};
const safeUrl = value => {
  try { const u = new URL(String(value || "").trim()); return ["rtmp:", "rtmps:"].includes(u.protocol) ? u.href : ""; }
  catch { return ""; }
};
export async function initLiveBroadcastStudio({ sb, user, shows = [], notify = () => {}, createRemoteHostInvite, getConnectedHosts, onRemoteHandoff, onTakeBack } = {}) {
  const livePanel = document.getElementById("studioLivePanel");
  if (!livePanel || !sb || !user?.id || document.getElementById("crBroadcastNetwork")) return;
  const section = document.createElement("section");
  section.id = "crBroadcastNetwork";
  section.className = "cr-broadcast-network";
  section.innerHTML = `
    <style>
      #crBroadcastNetwork{margin:0 0 26px;padding:22px;border:1px solid rgba(210,172,91,.3);border-radius:18px;background:linear-gradient(145deg,rgba(22,24,31,.98),rgba(10,12,17,.98));color:#f5f5f6}
      #crBroadcastNetwork *{box-sizing:border-box}
      #crBroadcastNetwork .cr-bn-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap}
      #crBroadcastNetwork .cr-bn-kicker{font-size:11px;letter-spacing:.16em;color:#d9b66e;font-weight:800}
      #crBroadcastNetwork h3,#crBroadcastNetwork h4{margin:5px 0 8px;color:#fff}
      #crBroadcastNetwork .cr-bn-muted{color:#aeb3bf;font-size:13px;line-height:1.55}
      #crBroadcastNetwork .cr-bn-pill{border:1px solid rgba(217,182,110,.45);border-radius:999px;padding:7px 11px;color:#e7c77f;font-size:11px;font-weight:800;white-space:nowrap}
      #crBroadcastNetwork .cr-bn-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-top:18px}
      #crBroadcastNetwork .cr-bn-card{background:#141720;border:1px solid #303541;border-radius:13px;padding:15px;min-width:0}
      #crBroadcastNetwork .cr-bn-card.full{grid-column:1/-1}
      #crBroadcastNetwork label{display:block;font-size:12px;color:#c7cbd3;font-weight:700;margin:0 0 6px}
      #crBroadcastNetwork input,#crBroadcastNetwork select,#crBroadcastNetwork textarea{width:100%;min-width:0;background:#090c12;color:#fff;border:1px solid #3b4250;border-radius:8px;padding:10px 11px;font:inherit;font-size:13px}
      #crBroadcastNetwork textarea{min-height:72px;resize:vertical}
      #crBroadcastNetwork .cr-bn-field{margin:10px 0}
      #crBroadcastNetwork .cr-bn-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
      #crBroadcastNetwork button{border:1px solid #b78e45;background:#b78e45;color:#11131a;border-radius:8px;padding:10px 13px;font-weight:800;font-size:12px;cursor:pointer}
      #crBroadcastNetwork button.secondary{background:#202530;color:#f1f2f4;border-color:#414958}
      #crBroadcastNetwork button:disabled{opacity:.45;cursor:not-allowed}
      #crBroadcastNetwork .cr-bn-stat{font-size:clamp(25px,4vw,36px);font-variant-numeric:tabular-nums;font-weight:850;letter-spacing:.04em}
      #crBroadcastNetwork .cr-bn-status{font-size:11px;font-weight:900;letter-spacing:.12em;color:#9da5b4}
      #crBroadcastNetwork .cr-bn-status.live{color:#ff7777}
      #crBroadcastNetwork .cr-bn-destination{border:1px solid #343b48;border-radius:10px;padding:12px;margin-top:10px;background:#0d1119}
      #crBroadcastNetwork .cr-bn-destination-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      #crBroadcastNetwork .cr-bn-destination-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #crBroadcastNetwork .cr-bn-list{display:grid;gap:8px}
      #crBroadcastNetwork .cr-bn-history{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #303541}
      #crBroadcastNetwork .cr-bn-history:last-child{border:0}
      #crBroadcastNetwork .cr-bn-warning{border-left:3px solid #d9b66e;padding:9px 12px;background:rgba(217,182,110,.08);font-size:12px;color:#d9dce2;line-height:1.55}
      #crBroadcastNetwork .cr-bn-ok{color:#8fdaa8}
      #crBroadcastNetwork .cr-bn-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}
      #crBroadcastNetwork .cr-bn-small{font-size:11px;color:#aeb3bf;line-height:1.5}
      @media(max-width:700px){#crBroadcastNetwork{padding:15px}#crBroadcastNetwork .cr-bn-grid,#crBroadcastNetwork .cr-bn-destination-grid{grid-template-columns:1fr}#crBroadcastNetwork .cr-bn-card.full{grid-column:auto}}
    </style>
    <div class="cr-bn-head">
      <div><div class="cr-bn-kicker">CROWRULES BROADCAST NETWORK · 24-HOUR LIVE</div><h3>Broadcast control room</h3>
      <p class="cr-bn-muted">Use OBS Studio or Streamlabs to encode your show, then send it to one or more destinations. Manage the CrowRules broadcast record and monitor its planned 24-hour run here.</p></div>
      <span class="cr-bn-pill">OBS + STREAMLABS</span>
    </div>
    <div class="cr-bn-grid">
      <div class="cr-bn-card">
        <div class="cr-bn-status" id="crBnStatus">STANDBY</div>
        <div class="cr-bn-stat" id="crBnTimer">24:00:00</div>
        <div class="cr-bn-muted" id="crBnTimerLabel">24-hour target · waiting for broadcast</div>
      </div>
      <div class="cr-bn-card">
        <h4>Encoder & schedule</h4>
        <div class="cr-bn-field"><label for="crBnEncoder">Broadcast software</label><select id="crBnEncoder"><option value="obs">OBS Studio</option><option value="streamlabs">Streamlabs Desktop</option></select></div>
        <div class="cr-bn-field"><label for="crBnStartAt">Schedule start (optional)</label><input id="crBnStartAt" type="datetime-local"></div>
        <div class="cr-bn-muted">The 24-hour target is a production timer, not an automatic shutdown. Keep the encoder running on the broadcasting computer.</div>
      </div>
      <div class="cr-bn-card full">
        <h4>Broadcast details</h4>
        <div class="cr-bn-grid" style="margin-top:0">
          <div class="cr-bn-field"><label for="crBnShow">Show / podcast</label><select id="crBnShow"><option value="">Select a show (optional)</option></select></div>
          <div class="cr-bn-field"><label for="crBnTitle">Broadcast title</label><input id="crBnTitle" maxlength="200" placeholder="CrowRules Podcasting — 24-Hour Live"></div>
        </div>
        <div class="cr-bn-field"><label for="crBnDescription">Description</label><textarea id="crBnDescription" maxlength="1200" placeholder="What will viewers hear and see?"></textarea></div>
      </div>
      <div class="cr-bn-card full">
        <div class="cr-bn-row" style="justify-content:space-between"><div><h4>Streaming destinations</h4><div class="cr-bn-muted">Add each platform's RTMP server and stream key. Keys are used only in this page session and are never saved to Supabase.</div></div><button id="crBnAddDestination" class="secondary" type="button">＋ Add destination</button></div>
        <div id="crBnDestinations"></div>
        <div class="cr-bn-warning" style="margin-top:12px">Multiple destinations require multi-output support in your encoder. In OBS, use a supported Multiple RTMP Outputs plugin; in Streamlabs, configure its multistream feature. CrowRules does not relay or duplicate the video feed itself.</div>
      </div>
      <div class="cr-bn-card full">
        <h4>Broadcast actions</h4>
        <div class="cr-bn-actions">
          <button id="crBnPrepare" type="button">Create / schedule broadcast</button>
          <button id="crBnMarkLive" type="button" disabled>Confirm encoder is LIVE</button>
          <button id="crBnEnd" class="secondary" type="button" disabled>End broadcast record</button>
          <button id="crBnRefresh" class="secondary" type="button">Refresh status</button>
        </div>
        <p class="cr-bn-muted" id="crBnMessage" role="status" aria-live="polite">Create a broadcast record, configure the destinations in OBS or Streamlabs, then confirm when the encoder is actually live.</p>
      </div>
      <div class="cr-bn-card full">
        <div class="cr-bn-row" style="justify-content:space-between"><div><h4>OBS remote controls</h4><div class="cr-bn-muted">Optional local control for OBS Studio. Streamlabs creators use the Streamlabs desktop controls.</div></div><span class="cr-bn-pill" id="crBnObsState">NOT CONNECTED</span></div>
        <div class="cr-bn-destination-grid">
          <div class="cr-bn-field"><label for="crBnObsAddress">OBS WebSocket address</label><input id="crBnObsAddress" value="ws://127.0.0.1:4455" autocomplete="off"></div>
          <div class="cr-bn-field"><label for="crBnObsPassword">OBS WebSocket password</label><input id="crBnObsPassword" type="password" autocomplete="off" placeholder="Set in OBS → Tools → WebSocket Server Settings"></div>
        </div>
        <div class="cr-bn-actions"><button id="crBnObsConnect" class="secondary" type="button">Connect to OBS</button><button id="crBnObsStart" type="button" disabled>Start OBS stream</button><button id="crBnObsStop" class="secondary" type="button" disabled>Stop OBS stream</button><button id="crBnObsCheck" class="secondary" type="button" disabled>Check stream status</button></div>
        <p class="cr-bn-muted" id="crBnObsMessage" role="status">Enable the OBS WebSocket server in OBS Studio. The password is used only for this connection and is not saved.</p>
      </div>
      <div class="cr-bn-card full" id="crBnHostHandoff">
        <div class="cr-bn-row" style="justify-content:space-between"><div><h4>Remote host handoff & break schedule</h4><div class="cr-bn-muted">Invite a remote presenter into your LiveKit studio, schedule their shift, then mute your own mic/camera while the show continues.</div></div><span class="cr-bn-pill" id="crBnHostState">YOUR SHIFT</span></div>
        <div class="cr-bn-warning">For a break, keep this Creator Studio room open on the broadcasting computer and keep OBS / Streamlabs running. If OBS captures this studio window, keep it visible in the captured scene. Do not shut down or sleep the computer.</div>
        <div class="cr-bn-destination-grid">
          <div class="cr-bn-field"><label for="crBnHostName">Remote host name</label><input id="crBnHostName" maxlength="100" placeholder="Host display name"></div>
          <div class="cr-bn-field"><label for="crBnHostStart">Shift starts</label><input id="crBnHostStart" type="datetime-local"></div>
          <div class="cr-bn-field"><label for="crBnHostEnd">Shift ends</label><input id="crBnHostEnd" type="datetime-local"></div>
          <div class="cr-bn-field"><label for="crBnHostNotes">Show / handoff notes</label><input id="crBnHostNotes" maxlength="240" placeholder="Topics, links, segment notes"></div>
        </div>
        <div class="cr-bn-actions"><button id="crBnAddHostShift" type="button">Add host shift</button><button id="crBnInviteHost" class="secondary" type="button">Create remote host invite</button></div>
        <div id="crBnHostShifts" class="cr-bn-list cr-bn-muted">Create a broadcast record to schedule remote host shifts.</div>
        <div class="cr-bn-destination-grid" style="margin-top:12px">
          <div class="cr-bn-field"><label for="crBnConnectedHost">Connected remote presenter</label><select id="crBnConnectedHost"><option value="">No connected presenters detected</option></select></div>
          <div class="cr-bn-field"><label>Live handoff</label><div class="cr-bn-actions" style="margin-top:0"><button id="crBnHandoff" type="button" disabled>Hand off to host</button><button id="crBnTakeBack" class="secondary" type="button" disabled>Take back host</button></div></div>
        </div>
        <p id="crBnHostMessage" class="cr-bn-muted" role="status" aria-live="polite">Create or join the LiveKit room in the Live Studio panel, then invite your remote presenter.</p>
      </div>
      <div class="cr-bn-card full">
        <h4>Encoder setup checklist</h4>
        <div class="cr-bn-list cr-bn-small">
          <label><input type="checkbox" data-cr-bn-check="1" style="width:auto;margin-right:7px">Set the primary destination in OBS / Streamlabs</label>
          <label><input type="checkbox" data-cr-bn-check="2" style="width:auto;margin-right:7px">Add every additional destination using multi-output support</label>
          <label><input type="checkbox" data-cr-bn-check="3" style="width:auto;margin-right:7px">Enable automatic reconnect and test audio/video</label>
          <label><input type="checkbox" data-cr-bn-check="4" style="width:auto;margin-right:7px">Enable local recording and confirm available disk space</label>
          <label><input type="checkbox" data-cr-bn-check="5" style="width:auto;margin-right:7px">Disable computer sleep and arrange broadcast monitoring</label>
        </div>
        <div class="cr-bn-actions"><button id="crBnCopyGuide" class="secondary" type="button">Copy encoder setup guide</button><button id="crBnCopyOutputs" class="secondary" type="button">Copy destination settings</button></div>
      </div>
      <div class="cr-bn-card full">
        <div class="cr-bn-row" style="justify-content:space-between"><h4>Recent broadcasts</h4><span class="cr-bn-small">Your latest 8 sessions</span></div>
        <div id="crBnHistory" class="cr-bn-list cr-bn-muted">Loading broadcast history…</div>
      </div>
    </div>`;
  livePanel.insertBefore(section, livePanel.firstChild);
  const byId = id => document.getElementById(id);
  const state = { broadcast: null, timer: null, refresh: null, realtime: null, destinationCount: 0, keys: new Map(), shifts: [], activeHost: null };
  const hostMessage = text => { byId("crBnHostMessage").textContent=text; };
  const getConnectedHostsSafe = () => { try { return getConnectedHosts ? (getConnectedHosts()||[]) : []; } catch { return []; } };
  const refreshConnectedHosts = () => {
    const select=byId("crBnConnectedHost"),previous=select.value,hosts=getConnectedHostsSafe();
    select.replaceChildren();
    if(!hosts.length){const o=document.createElement("option");o.value="";o.textContent="No connected presenters detected";select.append(o)}
    else hosts.forEach(host=>{const o=document.createElement("option");o.value=host.identity;o.textContent=host.name||host.identity;select.append(o)});
    if(hosts.some(h=>h.identity===previous))select.value=previous;
    byId("crBnHandoff").disabled=!hosts.length||!!state.activeHost;
  };
  const renderHostShifts = () => {
    const list=byId("crBnHostShifts");list.replaceChildren();
    if(!state.shifts.length){list.textContent="No remote host shifts scheduled yet.";return}
    state.shifts.forEach((shift,index)=>{
      const item=document.createElement("div");item.className="cr-bn-history";
      const left=document.createElement("div"),name=document.createElement("b"),detail=document.createElement("div");
      name.textContent=shift.name||"Remote host";
      detail.className="cr-bn-small";
      detail.textContent=(shift.start_at?new Date(shift.start_at).toLocaleString():"Start time TBD")+" → "+(shift.end_at?new Date(shift.end_at).toLocaleString():"End time TBD")+(shift.notes?" · "+shift.notes:"");
      left.append(name,detail);
      const remove=document.createElement("button");remove.className="secondary";remove.type="button";remove.textContent="Remove";
      remove.addEventListener("click",()=>saveHostShifts(state.shifts.filter((_,i)=>i!==index)).catch(e=>hostMessage(e.message)));
      item.append(left,remove);list.append(item);
    });
  };
  const saveHostShifts = async shifts => {
    if(!state.broadcast?.id)throw new Error("Create a broadcast record before scheduling host shifts.");
    const metadata={...(state.broadcast.metadata||{}),remote_host_shifts:shifts};
    const {data,error}=await sb.from("podcast_live_broadcasts").update({metadata}).eq("id",state.broadcast.id).eq("user_id",user.id).select("*").single();
    if(error)throw error;
    state.broadcast=data;state.shifts=shifts;renderHostShifts();hostMessage("Remote host schedule saved to this broadcast.");
  };
  const refreshHostHandoff = () => {
    refreshConnectedHosts();
    const active=state.broadcast?.metadata?.active_remote_host||null;
    state.activeHost=active;
    byId("crBnHostState").textContent=active?"REMOTE HOST: "+(active.name||"ON AIR"):"YOUR SHIFT";
    byId("crBnTakeBack").disabled=!active;
    byId("crBnHandoff").disabled=!!active||!getConnectedHostsSafe().length;
    if(active){
      const connected=getConnectedHostsSafe().some(h=>h.identity===active.identity);
      byId("crBnHostState").textContent=connected?"REMOTE HOST ON AIR":"HOST DISCONNECTED";
      hostMessage(connected?(active.name||"Remote host")+" is presenting. Your microphone and camera are muted.":"Your remote host disconnected. The stream may still be live, but no presenter is connected. Take back the host role or invite a backup.");
    }
  };
  byId("crBnAddHostShift").addEventListener("click",async()=>{
    const name=byId("crBnHostName").value.trim(),start=byId("crBnHostStart").value,end=byId("crBnHostEnd").value;
    if(!name||!start||!end){hostMessage("Enter the host name and both shift times.");return}
    if(new Date(end)<=new Date(start)){hostMessage("The shift end must be later than its start.");return}
    try{await saveHostShifts([...state.shifts,{id:crypto.randomUUID(),name,start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString(),notes:byId("crBnHostNotes").value.trim()}]);byId("crBnHostName").value="";byId("crBnHostNotes").value=""}
    catch(error){hostMessage(error.message||"Could not save this host shift.")}
  });
  byId("crBnInviteHost").addEventListener("click",async()=>{
    try{
      if(!createRemoteHostInvite)throw new Error("Remote host invitations are not connected to this LiveKit room.");
      const url=await createRemoteHostInvite();
      await navigator.clipboard.writeText(url);
      hostMessage("Secure remote host invitation copied. Send it privately to the presenter; the link expires after 60 minutes.");
    }catch(error){hostMessage(error.message||"Could not create a remote host invitation.")}
  });
  byId("crBnHandoff").addEventListener("click",async()=>{
    const identity=byId("crBnConnectedHost").value,host=getConnectedHostsSafe().find(h=>h.identity===identity);
    if(!host){hostMessage("The selected remote host is no longer connected. Refresh the presenter list.");return}
    if(!state.broadcast?.id){hostMessage("Create a broadcast record first.");return}
    try{
      if(!onRemoteHandoff)throw new Error("Remote presenter controls are unavailable.");
      await onRemoteHandoff(host);
      const active={name:host.name||host.identity,identity:host.identity,started_at:new Date().toISOString()};
      const metadata={...(state.broadcast.metadata||{}),active_remote_host:active};
      const {data,error}=await sb.from("podcast_live_broadcasts").update({metadata}).eq("id",state.broadcast.id).eq("user_id",user.id).select("*").single();
      if(error)throw error;state.broadcast=data;state.activeHost=active;refreshHostHandoff();
      hostMessage("Handoff complete. "+active.name+" is presenting; your microphone and camera are muted. Leave the studio and encoder running.");
    }catch(error){hostMessage(error.message||"Could not hand off to the remote host.")}
  });
  byId("crBnTakeBack").addEventListener("click",async()=>{
    try{
      if(onTakeBack)await onTakeBack();
      if(state.broadcast?.id){
        const metadata={...(state.broadcast.metadata||{})};delete metadata.active_remote_host;
        const {data,error}=await sb.from("podcast_live_broadcasts").update({metadata}).eq("id",state.broadcast.id).eq("user_id",user.id).select("*").single();
        if(error)throw error;state.broadcast=data;
      }
      state.activeHost=null;refreshHostHandoff();hostMessage("You have taken back the presenter role. Your microphone and camera are enabled.");
    }catch(error){hostMessage(error.message||"Could not take back the host role.")}
  });
  byId("crBnConnectedHost").addEventListener("focus",refreshConnectedHosts);
  const hostPresenceTimer=setInterval(refreshHostHandoff,5000);
  const message = text => { byId("crBnMessage").textContent = text; };
  const setBusy = busy => { ["crBnPrepare","crBnMarkLive","crBnEnd","crBnRefresh","crBnAddDestination"].forEach(id => { const el=byId(id); if(el)el.disabled=busy; }); };
  const addDestination = (platform="youtube", values={}) => {
    const id = "cr-bn-dest-" + (++state.destinationCount);
    const card = document.createElement("div"); card.className = "cr-bn-destination"; card.dataset.destinationId=id;
    card.innerHTML = `<div class="cr-bn-destination-head"><b>Destination ${state.destinationCount}</b><button class="secondary" type="button" data-remove-destination>Remove</button></div>
      <div class="cr-bn-destination-grid">
        <div class="cr-bn-field"><label>Platform</label><select data-platform>${PLATFORMS.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join("")}</select></div>
        <div class="cr-bn-field"><label>RTMP server / ingest URL</label><input data-server type="url" placeholder="rtmps://…"></div>
        <div class="cr-bn-field"><label>Stream key (never saved)</label><input data-key type="password" autocomplete="off" placeholder="Paste from your platform"></div>
        <div class="cr-bn-field"><label>Quick action</label><button class="secondary" type="button" data-copy>Copy server + key</button></div>
      </div><p class="cr-bn-small" data-destination-status>Credentials stay in this open page only. Add the destination directly to your encoder.</p>`;
    card.querySelector("[data-platform]").value=platform;
    card.querySelector("[data-server]").value=values.server||"";
    card.querySelector("[data-key]").value=values.key||"";
    card.querySelector("[data-remove-destination]").addEventListener("click",()=>{state.keys.delete(id);card.remove()});
    card.querySelector("[data-copy]").addEventListener("click",async()=>{
      const server=card.querySelector("[data-server]").value.trim(),key=card.querySelector("[data-key]").value;
      if(!safeUrl(server)||!key.trim()){message("Enter a valid RTMP server and stream key first.");return}
      try{await navigator.clipboard.writeText("Server: "+server+"\nStream key: "+key);card.querySelector("[data-destination-status]").textContent="Copied. Paste these values into the selected destination in your encoder.";notify("Destination settings copied.")}catch{message("Clipboard access was blocked. Copy the fields manually.")}
    });
    $("#crBnDestinations").append(card);
  };
  const showOptions = () => {
    const select=byId("crBnShow");
    (shows||[]).forEach(show=>{if(!show?.id)return;const option=document.createElement("option");option.value=show.id;option.textContent=show.title||"Untitled show";select.append(option)});
  };
  showOptions(); addDestination("youtube");
  const invoke = async body => {
    const {data,error}=await sb.functions.invoke("podcast-live-broadcast",{body});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    return data;
  };
  const loadHistory = async () => {
    const {data,error}=await sb.from("podcast_live_broadcasts").select("id,title,status,provider,started_at,ended_at,duration_seconds,created_at,metadata").eq("user_id",user.id).order("created_at",{ascending:false}).limit(8);
    if(error)throw error;
    const list=byId("crBnHistory");list.replaceChildren();
    if(!data?.length){list.textContent="No broadcasts yet. Your first session will appear here.";return}
    data.forEach(row=>{
      const item=document.createElement("div");item.className="cr-bn-history";
      const left=document.createElement("div"),title=document.createElement("b"),detail=document.createElement("div");
      title.textContent=row.title||"Untitled broadcast";detail.className="cr-bn-small";
      detail.textContent=(row.provider||"encoder")+" · "+(row.started_at?new Date(row.started_at).toLocaleString():"Not started")+" · "+row.status;
      left.append(title,detail);const btn=document.createElement("button");btn.className="secondary";btn.type="button";btn.textContent="Load";btn.addEventListener("click",()=>loadBroadcast(row.id));item.append(left,btn);list.append(item);
    });
  };
  const loadBroadcast = async id => {
    const {data,error}=await sb.from("podcast_live_broadcasts").select("*").eq("id",id).eq("user_id",user.id).single();
    if(error)throw error;state.broadcast=data;state.shifts=Array.isArray(data.metadata?.remote_host_shifts)?data.metadata.remote_host_shifts:[];renderHostShifts();refreshHostHandoff();renderStatus();
    byId("crBnTitle").value=data.title||"";
    byId("crBnDescription").value=data.description||"";
    if(data.podcast_id)byId("crBnShow").value=data.podcast_id;
    if(data.metadata?.planned_start_at)byId("crBnStartAt").value=data.metadata.planned_start_at.slice(0,16);
    byId("crBnEncoder").value=data.metadata?.encoder==="streamlabs"?"streamlabs":"obs";
    message("Loaded “"+(data.title||"broadcast")+"”. Resume the encoder in OBS / Streamlabs if it is still running.");
  };
  const renderStatus = () => {
    const b=state.broadcast,status=b?.status||"scheduled",live=status==="live";
    byId("crBnStatus").textContent=live?"ON AIR":status.toUpperCase();
    byId("crBnStatus").classList.toggle("live",live);
    byId("crBnMarkLive").disabled=!b||!["scheduled","preparing"].includes(status);
    byId("crBnEnd").disabled=!b||status!=="live";
    if(live&&b.started_at){
      const elapsed=Math.max(0,Math.floor((Date.now()-new Date(b.started_at).getTime())/1000));
      byId("crBnTimer").textContent=fmt(Math.max(0,86400-elapsed));
      byId("crBnTimerLabel").textContent=elapsed>=86400?"24-hour target reached · stop the encoder in OBS / Streamlabs":"Time remaining in 24-hour target";
    }else if(b?.metadata?.planned_start_at){
      byId("crBnTimer").textContent="24:00:00";byId("crBnTimerLabel").textContent="Scheduled for "+new Date(b.metadata.planned_start_at).toLocaleString();
    }else{byId("crBnTimer").textContent="24:00:00";byId("crBnTimerLabel").textContent="24-hour target · waiting for broadcast"}
    byId("crBnPrepare").disabled=!!b&&["preparing","live"].includes(status);
  };
  const prepare = async () => {
    const title=byId("crBnTitle").value.trim(),showId=byId("crBnShow").value||null;
    if(!title){message("Enter a broadcast title first.");byId("crBnTitle").focus();return}
    const encoder=byId("crBnEncoder").value,planned=byId("crBnStartAt").value;
    const destinations=[...byId("crBnDestinations").querySelectorAll(".cr-bn-destination")].map(card=>({
      platform:card.querySelector("[data-platform]").value,
      server:safeUrl(card.querySelector("[data-server]").value)
    })).filter(x=>x.server);
    if(!destinations.length){message("Add at least one valid RTMP server URL. Stream keys are entered into the encoder, not stored here.");return}
    setBusy(true);
    try{
      const metadata={encoder,planned_start_at:planned?new Date(planned).toISOString():null,target_duration_seconds:86400,destinations,control_mode:"external_encoder",stream_keys_stored:false};
      const created=await invoke({action:"create",title,description:byId("crBnDescription").value.trim(),podcast_id:showId,metadata});
      if(!created.broadcast?.id)throw new Error("The broadcast record was not returned.");
      const {data:updated,error}=await sb.from("podcast_live_broadcasts").update({provider:encoder,metadata}).eq("id",created.broadcast.id).eq("user_id",user.id).select("*").single();
      if(error)throw error;state.broadcast=updated;state.shifts=Array.isArray(updated.metadata?.remote_host_shifts)?updated.metadata.remote_host_shifts:[];renderHostShifts();refreshHostHandoff();
      if(!planned||new Date(planned)<=new Date()){
        const prepared=await invoke({action:"start",broadcast_id:updated.id});state.broadcast=prepared.broadcast||state.broadcast;
      }
      renderStatus();await loadHistory();
      message(planned&&new Date(planned)>new Date()?"Broadcast scheduled in CrowRules. The encoder still needs to be started manually at the scheduled time.":"Broadcast record prepared. Configure your encoder outputs, start streaming in OBS / Streamlabs, then confirm ON AIR here.");
      notify("CrowRules broadcast created.");
    }catch(error){message(error.message||"Could not create the broadcast.");notify(error.message||"Broadcast creation failed.");}
    finally{setBusy(false);renderStatus()}
  };
  const markLive = async () => {
    if(!state.broadcast?.id)return;
    setBusy(true);
    try{const result=await invoke({action:"live",broadcast_id:state.broadcast.id});state.broadcast=result.broadcast;renderStatus();await loadHistory();message("CrowRules now marks this session ON AIR. Confirm the stream is actually live at each destination in your encoder and platform dashboards.");notify("Broadcast marked ON AIR.");}
    catch(error){message(error.message||"Could not update broadcast status.");}
    finally{setBusy(false);renderStatus()}
  };
  const endBroadcast = async () => {
    if(!state.broadcast?.id)return;
    if(!confirm("First stop streaming in OBS / Streamlabs. End this CrowRules broadcast record now?"))return;
    setBusy(true);
    try{const result=await invoke({action:"end",broadcast_id:state.broadcast.id});state.broadcast=result.broadcast;renderStatus();await loadHistory();message("Broadcast record ended. Replay processing status: "+(result.replay?.processing_status||"queued")+".");notify("Broadcast record ended.");}
    catch(error){message(error.message||"Could not end the broadcast record.");}
    finally{setBusy(false);renderStatus()}
  };
  const refresh = async () => {
    if(state.broadcast?.id)await loadBroadcast(state.broadcast.id);
    await loadHistory();
  };
  byId("crBnAddDestination").addEventListener("click",()=>addDestination("custom"));
  byId("crBnPrepare").addEventListener("click",prepare);
  byId("crBnMarkLive").addEventListener("click",markLive);
  byId("crBnEnd").addEventListener("click",endBroadcast);
  byId("crBnRefresh").addEventListener("click",()=>refresh().catch(e=>message(e.message)));
  byId("crBnCopyGuide").addEventListener("click",async()=>{
    const text="CROWRULES 24-HOUR BROADCAST CHECKLIST\n1. Open OBS Studio or Streamlabs Desktop.\n2. Configure your primary platform under Stream settings.\n3. Add extra destinations using OBS Multiple RTMP Outputs or Streamlabs multistream.\n4. Add each platform's RTMP server and private stream key. Never share your stream key.\n5. Enable automatic reconnect and local recording.\n6. Disable computer sleep; use wired internet and a backup connection if available.\n7. Start the encoder, verify every destination, then click Confirm encoder is LIVE in CrowRules.\n8. To finish, stop the encoder first, then end the CrowRules broadcast record.\nImportant: YouTube may not archive streams longer than 12 hours; keep local recordings and split long recordings into segments.";
    try{await navigator.clipboard.writeText(text);notify("Encoder checklist copied.")}catch{message(text)}
  });
  byId("crBnCopyOutputs").addEventListener("click",async()=>{
    const lines=[...byId("crBnDestinations").querySelectorAll(".cr-bn-destination")].map((card,i)=>{
      const platform=card.querySelector("[data-platform]").selectedOptions[0].textContent,server=card.querySelector("[data-server]").value.trim(),key=card.querySelector("[data-key]").value;
      return "Destination "+(i+1)+" — "+platform+"\nServer: "+server+"\nStream key: "+(key||"[enter in encoder]");
    });
    try{await navigator.clipboard.writeText(lines.join("\n\n"));notify("Destination settings copied. Keep the clipboard private.")}catch{message("Clipboard access was blocked.")}
  });
  const obs = { socket:null, connected:false, pending:new Map(), timer:null };
  const obsMessage = text => { byId("crBnObsMessage").textContent=text; };
  const obsState = text => { byId("crBnObsState").textContent=text; };
  const obsButtons = connected => {
    byId("crBnObsStart").disabled=!connected;
    byId("crBnObsStop").disabled=!connected;
    byId("crBnObsCheck").disabled=!connected;
    byId("crBnObsConnect").textContent=connected?"Reconnect OBS":"Connect to OBS";
  };
  const obsRequest = (requestType,requestData={}) => new Promise((resolve,reject)=>{
    if(!obs.connected||!obs.socket||obs.socket.readyState!==WebSocket.OPEN)return reject(new Error("OBS is not connected."));
    const requestId=crypto.randomUUID();
    const timeout=setTimeout(()=>{obs.pending.delete(requestId);reject(new Error("OBS request timed out."))},8000);
    obs.pending.set(requestId,{resolve,reject,timeout,requestType});
    obs.socket.send(JSON.stringify({op:6,d:{requestType,requestId,requestData}}));
  });
  const hashBase64 = async value => {
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
    return btoa(String.fromCharCode(...new Uint8Array(digest)));
  };
  const connectObs = async () => {
    const address=byId("crBnObsAddress").value.trim(),password=byId("crBnObsPassword").value;
    if(!/^wss?:\/\//i.test(address))throw new Error("Enter a valid ws:// or wss:// OBS WebSocket address.");
    if(obs.socket)try{obs.socket.close()}catch{}
    obs.connected=false;obsButtons(false);obsState("CONNECTING");obsMessage("Connecting to OBS on this computer…");
    return new Promise((resolve,reject)=>{
      let settled=false;
      const fail=error=>{if(settled)return;settled=true;obs.connected=false;obsButtons(false);obsState("NOT CONNECTED");obsMessage(error.message||"Could not connect to OBS.");reject(error)};
      try{obs.socket=new WebSocket(address)}catch(error){fail(error);return}
      const timeout=setTimeout(()=>fail(new Error("OBS connection timed out. Confirm OBS is open and its WebSocket server is enabled.")),9000);
      obs.socket.onmessage=async event=>{
        let packet;try{packet=JSON.parse(event.data)}catch{return}
        if(packet.op===0){
          try{
            const auth=packet.d?.authentication;
            const identify={rpcVersion:packet.d?.rpcVersion||1,eventSubscriptions:0};
            if(auth){
              if(!password)throw new Error("Enter your OBS WebSocket password.");
              identify.authentication=await hashBase64(await hashBase64(password+auth.salt)+auth.challenge);
            }
            obs.socket.send(JSON.stringify({op:1,d:identify}));
          }catch(error){clearTimeout(timeout);fail(error)}
          return;
        }
        if(packet.op===2){
          clearTimeout(timeout);obs.connected=true;obsButtons(true);obsState("CONNECTED");obsMessage("OBS connected. Start/stop controls and stream-status checks are available.");if(!settled){settled=true;resolve(true)}
          try{await refreshObsStatus()}catch{}
          return;
        }
        if(packet.op===7){
          const request=obs.pending.get(packet.d?.requestId);if(!request)return;
          clearTimeout(request.timeout);obs.pending.delete(packet.d.requestId);
          if(packet.d?.requestStatus?.result)request.resolve(packet.d.responseData||{});
          else request.reject(new Error(packet.d?.requestStatus?.comment||"OBS rejected "+request.requestType+"."));
        }
      };
      obs.socket.onerror=()=>{if(!settled)fail(new Error("Browser could not reach OBS WebSocket. Check the address, port 4455 and local-network permissions."))};
      obs.socket.onclose=()=>{obs.connected=false;obsButtons(false);obsState("DISCONNECTED");if(!settled)fail(new Error("OBS WebSocket closed before authentication completed."));for(const p of obs.pending.values()){clearTimeout(p.timeout);p.reject(new Error("OBS disconnected."))}obs.pending.clear()};
    });
  };
  const refreshObsStatus = async () => {
    const status=await obsRequest("GetStreamStatus");
    const active=!!status.outputActive;
    obsMessage(active?"OBS reports that streaming is active. Verify each destination in the platform dashboards.":"OBS is connected but the stream is not active.");
    byId("crBnObsStart").disabled=active;
    byId("crBnObsStop").disabled=!active;
    return active;
  };
  byId("crBnObsConnect").addEventListener("click",()=>connectObs().catch(error=>obsMessage(error.message)));
  byId("crBnObsCheck").addEventListener("click",()=>refreshObsStatus().catch(error=>obsMessage(error.message)));
  byId("crBnObsStart").addEventListener("click",async()=>{
    try{
      await obsRequest("StartStream");
      const active=await refreshObsStatus();
      if(active){if(state.broadcast&&["preparing","scheduled"].includes(state.broadcast.status))await markLive();obsMessage("OBS streaming is active. Confirm all configured destinations are receiving the feed.")}
    }catch(error){obsMessage(error.message)}
  });
  byId("crBnObsStop").addEventListener("click",async()=>{
    try{await obsRequest("StopStream");await refreshObsStatus();obsMessage("OBS stream stopped. Check that every extra output has also stopped, then use End broadcast record.");}
    catch(error){obsMessage(error.message)}
  });
  obs.timer=setInterval(()=>{if(obs.connected)refreshObsStatus().catch(()=>{})},15000);
  const tick=()=>renderStatus();
  state.timer=setInterval(tick,1000);
  state.refresh=setInterval(()=>refresh().catch(()=>{}),20000);
  try{
    state.realtime=sb.channel("cr-broadcasts-"+user.id).on("postgres_changes",{event:"*",schema:"public",table:"podcast_live_broadcasts",filter:"user_id=eq."+user.id},()=>refresh().catch(()=>{})).subscribe();
    await loadHistory();
    const {data}=await sb.from("podcast_live_broadcasts").select("id,status,started_at,created_at").eq("user_id",user.id).in("status",["live","preparing"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(data)await loadBroadcast(data.id);
  }catch(error){message("Broadcast history is not available yet: "+(error.message||"Check your connection."))}
  renderStatus();
  const cleanup = () => {
    clearInterval(state.timer);clearInterval(state.refresh);clearInterval(obs.timer);clearInterval(hostPresenceTimer);
    if(state.realtime)sb.removeChannel(state.realtime);
    if(obs.socket)try{obs.socket.close()}catch{}
    for(const pending of obs.pending.values()){clearTimeout(pending.timeout);pending.reject(new Error("Studio closed."))}
    obs.pending.clear();state.keys.clear();window.removeEventListener("cr:page-changed",onPageChanged);
  };
  const onPageChanged = () => { if(!document.getElementById("crBroadcastNetwork"))cleanup(); };
  window.addEventListener("cr:page-changed",onPageChanged);
  return cleanup;
}
