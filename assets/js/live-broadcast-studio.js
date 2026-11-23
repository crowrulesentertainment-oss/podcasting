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
  try { const u = new URL(String(value || "").trim()); return ["rtmp:", "rtmps:", "https:"].includes(u.protocol) ? u.href : ""; }
  catch { return ""; }
};
export function initLiveBroadcastStudio({ sb, user, shows = [], notify = () => {} } = {}) {
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
  const state = { broadcast: null, timer: null, refresh: null, realtime: null, destinationCount: 0, keys: new Map() };
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
    if(error)throw error;state.broadcast=data;renderStatus();
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
    byId("crBnEnd").disabled=!b||!["live","preparing","scheduled"].includes(status);
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
      if(error)throw error;state.broadcast=updated;
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
  return () => { clearInterval(state.timer);clearInterval(state.refresh);if(state.realtime)sb.removeChannel(state.realtime);state.keys.clear(); };
}
