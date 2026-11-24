import {sb} from "./client.js";
const $=id=>document.getElementById(id);
let room=null,localTracks=[],connected=false,sharingScreen=false;
const status=(text,bad=false)=>{$("roomStatus").textContent=text;$("roomStatus").classList.toggle("danger",bad)};
async function checkAuth(){const {data,error}=await sb.auth.getSession();if(error||!data.session){$("authStatus").textContent="Sign in to CrowRules Podcasting in this browser, then return to this page.";return false}$("authStatus").textContent="Signed in. Only the event owner or the account assigned to this scheduled appearance can connect.";return true}
function clearStage(){const stage=$("videoStage");stage.replaceChildren();const label=document.createElement("span");label.className="muted";label.textContent="Camera preview appears after you connect.";stage.append(label)}
async function connect(){
 if(connected)return;
 $("connect").disabled=true;status("Checking sign-in and schedule permissions…");
 try{
  const {data:sessionData}=await sb.auth.getSession();if(!sessionData.session)throw new Error("Sign in to CrowRules Podcasting first.");
  const scheduleId=$("scheduleId").value.trim();if(!scheduleId)throw new Error("Enter the scheduled appearance ID supplied by the producer.");
  const {data,error}=await sb.functions.invoke("livekit-token",{body:{schedule_id:scheduleId,display_name:$("displayName").value.trim()||undefined}});
  if(error)throw error;if(data?.error)throw new Error(data.error);
  const {Room,RoomEvent,Track,createLocalTracks}=await import("https://esm.sh/livekit-client@2.25.0");
  room=new Room({adaptiveStream:true,dynacast:true});
  room.on(RoomEvent.TrackSubscribed,(track)=>{const el=track.attach();if(track.kind==="video"){$("videoStage").replaceChildren(el)}else document.body.append(el)});
  room.on(RoomEvent.LocalTrackUnpublished,(publication)=>{if(publication.source===Track.Source.ScreenShare){sharingScreen=false;$("shareScreen").textContent="Share screen / PS5 gameplay"}});
  room.on(RoomEvent.Disconnected,()=>{connected=false;sharingScreen=false;$("connect").disabled=false;$("shareScreen").disabled=true;$("shareScreen").textContent="Share screen / PS5 gameplay";$("leave").disabled=true;status("Disconnected from the room.",true);localTracks=[];room=null;clearStage()});
  await room.connect(data.url,data.token);
  localTracks=await createLocalTracks({audio:true,video:true});
  for(const track of localTracks){await room.localParticipant.publishTrack(track);if(track.kind==="video"){$("videoStage").replaceChildren(track.attach())}}
  connected=true;$("leave").disabled=false;$("shareScreen").disabled=false;status("Connected to "+(data.program_title||"CrowRules Live")+" · waiting for producer.");
 }catch(error){try{for(const track of localTracks){track.stop();track.detach().forEach(node=>node.remove())}if(room)await room.disconnect()}catch{}room=null;localTracks=[];connected=false;status(error.message||"Could not connect to the LiveKit room.",true)}
 finally{$("connect").disabled=connected}
}
async function toggleScreenShare(){if(!room||!connected)return;try{await room.localParticipant.setScreenShareEnabled(!sharingScreen);sharingScreen=!sharingScreen;$("shareScreen").textContent=sharingScreen?"Stop gameplay sharing":"Share screen / PS5 gameplay";status(sharingScreen?"Gameplay screen is being shared.":"Gameplay screen sharing stopped.")}catch(error){status(error.message||"Could not share gameplay screen.",true)}}\nasync function leave(){try{for(const track of localTracks){track.stop();track.detach().forEach(node=>node.remove())}if(room)await room.disconnect()}catch(e){console.warn(e)}finally{room=null;localTracks=[];connected=false;sharingScreen=false;$("connect").disabled=false;$("shareScreen").disabled=true;$("shareScreen").textContent="Share screen / PS5 gameplay";$("leave").disabled=true;clearStage();status("You have left the room.")}}
$("connect").addEventListener("click",connect);$("shareScreen").addEventListener("click",toggleScreenShare);$("leave").addEventListener("click",leave);checkAuth();