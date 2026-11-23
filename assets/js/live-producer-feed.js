const $=id=>document.getElementById(id),params=new URLSearchParams(location.hash.slice(1));
const server=params.get("server"),token=params.get("token");
let room=null;
function status(text){$("status").textContent=text}
function attach(track,participant){
 const element=track.attach();
 if(track.kind==="video"){element.autoplay=true;element.playsInline=true;element.muted=true;element.dataset.participant=participant.identity;$("stage").append(element);$("empty").style.display="none"}
 else{element.autoplay=true;element.dataset.participant=participant.identity;document.body.append(element)}
}
async function start(){
 if(!server||!token){status("MISSING SHORT-LIVED VIEWER TOKEN");$("empty").textContent="Generate a fresh Streamlabs feed URL from Creator Studio.";return}
 try{
  const {Room,RoomEvent}=await import("https://esm.sh/livekit-client@2.25.0");
  room=new Room({adaptiveStream:true,dynacast:true});
  room.on(RoomEvent.TrackSubscribed,(track,publication,participant)=>attach(track,participant));
  room.on(RoomEvent.TrackUnsubscribed,(track)=>{track.detach().forEach(node=>node.remove())});
  room.on(RoomEvent.ParticipantConnected,()=>status("HOST CONNECTED · STREAMLABS FEED READY"));
  room.on(RoomEvent.ParticipantDisconnected,()=>status("HOST DISCONNECTED · WAITING FOR NEXT CONNECTION"));
  room.on(RoomEvent.Disconnected,()=>status("LIVEKIT DISCONNECTED"));
  await room.connect(server,token);
  status("CONNECTED · WAITING FOR HOST");
 }catch(error){status("FEED ERROR · "+(error.message||"Connection failed").slice(0,90));console.error(error)}
}
start();