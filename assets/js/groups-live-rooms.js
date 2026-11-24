import { sb } from "../assets/js/client.js";
import { LIVEKIT_TOKEN_SERVICE_URL } from "../assets/js/config.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const invitationToken = new URLSearchParams(location.hash.slice(1)).get("invite") || "";
let session = null;
let room = null;
let localTracks = [];
let connected = false;

function status(message, bad = false) {
  $("roomStatus").textContent = message;
  $("roomStatus").classList.toggle("is-error", bad);
}
function apiBase() { return String(LIVEKIT_TOKEN_SERVICE_URL || "").trim().replace(/\/$/, ""); }
async function authSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error("Sign in to CrowRules Podcasting before joining a group live room.");
  return data.session;
}
async function api(path, body) {
  const auth = await authSession();
  const base = apiBase();
  if (!base) throw new Error("The LiveKit token-service URL has not been configured in assets/js/config.js. The room controls will activate after the backend is deployed and its HTTPS URL is added.");
  const response = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + auth.access_token },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The live-room request failed (" + response.status + ").");
  return data;
}
function setConnected(value) {
  connected = value;
  $("leaveRoom").disabled = !value;
  $("endRoom").disabled = !value || !session?.sessionId;
  $("startRoom").disabled = value;
  $("joinAudience").disabled = value;
  $("joinInvite").disabled = value || !invitationToken;
  $("createInvite").disabled = !value || !session?.sessionId;
}
function clearMedia() {
  $("videoStage").replaceChildren();
  $("audioStage").replaceChildren();
  const note = document.createElement("p");
  note.className = "glr-stage-note";
  note.textContent = "Live video and shared audio appear here when you connect.";
  $("videoStage").append(note);
}
async function connectToLiveKit(data) {
  const { Room, RoomEvent, Track, createLocalTracks } = await import("https://esm.sh/livekit-client@2.25.0");
  room = new Room({ adaptiveStream: true, dynacast: true });
  room.on(RoomEvent.TrackSubscribed, (track) => {
    const element = track.attach();
    if (track.kind === "video") $("videoStage").append(element);
    else $("audioStage").append(element);
  });
  room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => element.remove()));
  room.on(RoomEvent.Disconnected, () => {
    connected = false;
    localTracks = [];
    room = null;
    setConnected(false);
    clearMedia();
    status("You have disconnected from the group live room.");
  });
  await room.connect(data.serverUrl, data.participantToken || data.token);
  if (data.role === "group_host" || data.role === "guest") {
    localTracks = await createLocalTracks({
      audio: true,
      video: data.mode === "video"
    });
    for (const track of localTracks) {
      await room.localParticipant.publishTrack(track);
      if (track.kind === "video") $("videoStage").append(track.attach());
      else $("audioStage").append(track.attach());
    }
  }
  setConnected(true);
  status("Connected to " + (data.title || $("roomId").value || "the group live room") + " as " + data.role + ".");
}
async function startRoom() {
  if (connected) return;
  $("startRoom").disabled = true;
  status("Checking group permissions and starting the LiveKit session…");
  try {
    const roomId = $("roomId").value.trim();
    if (!roomId) throw new Error("Enter the group live-room ID first.");
    if (!session?.sessionId) {
      session = await api("/api/groups/sessions", { roomId, mode: $("roomMode").value });
    }
    const token = await api("/api/token", { groupSessionId: session.sessionId });
    await connectToLiveKit({ ...token, title: session.title });
  } catch (error) {
    $("startRoom").disabled = false;
    status(error.message || "Could not start the group live room.", true);
  }
}
async function joinAudience() {
  if (connected) return;
  $("joinAudience").disabled = true;
  status("Checking room visibility and membership…");
  try {
    const roomId = $("roomId").value.trim();
    if (!roomId) throw new Error("Enter the group live-room ID first.");
    const token = await api("/api/token", { groupRoomId: roomId });
    await connectToLiveKit({ ...token, title: roomId });
  } catch (error) {
    $("joinAudience").disabled = false;
    status(error.message || "Could not join this room.", true);
  }
}
async function joinInvitation() {
  if (connected) return;
  $("joinInvite").disabled = true;
  status("Validating your private group-room invitation…");
  try {
    const token = await api("/api/token", { groupInvitationToken: invitationToken });
    await connectToLiveKit({ ...token, title: $("roomId").value.trim() || "Private group room" });
  } catch (error) {
    $("joinInvite").disabled = false;
    status(error.message || "This invitation could not be used.", true);
  }
}
async function leaveRoom() {
  try {
    for (const track of localTracks) {
      track.stop();
      track.detach().forEach((element) => element.remove());
    }
    if (room) await room.disconnect();
  } catch (error) {
    console.warn("Group room disconnect:", error);
  } finally {
    room = null;
    localTracks = [];
    connected = false;
    setConnected(false);
    clearMedia();
    status("You have left the group live room.");
  }
}
async function endRoom() {
  if (!session?.sessionId) return;
  $("endRoom").disabled = true;
  status("Ending the group live session…");
  try {
    await api("/api/groups/sessions/end", { sessionId: session.sessionId });
    await leaveRoom();
    session = null;
    status("The group live room has ended.");
  } catch (error) {
    $("endRoom").disabled = false;
    status(error.message || "Could not end the group room.", true);
  }
}
async function createInvitation() {
  if (!session?.sessionId) return;
  $("createInvite").disabled = true;
  status("Creating a secure guest/listener invitation…");
  try {
    const payload = {
      sessionId: session.sessionId,
      role: $("inviteRole").value,
      expiresInMinutes: Number($("inviteExpiry").value) || 60,
      maxUses: 1
    };
    const email = $("inviteEmail").value.trim();
    if (email) payload.invitedEmail = email;
    const result = await api("/api/groups/invitations", payload);
    const url = new URL(location.href);
    url.searchParams.set("room", $("roomId").value.trim());
    url.hash = "invite=" + encodeURIComponent(result.invitationToken);
    $("inviteLink").value = url.toString();
    $("inviteResult").hidden = false;
    status("Invitation created. Share the link privately; it expires " + new Date(result.expiresAt).toLocaleString() + ".");
  } catch (error) {
    status(error.message || "Could not create an invitation.", true);
  } finally {
    $("createInvite").disabled = false;
  }
}
async function copyInvitation() {
  try {
    await navigator.clipboard.writeText($("inviteLink").value);
    status("Invitation link copied.");
  } catch {
    $("inviteLink").select();
    status("Select and copy the invitation link.");
  }
}
function init() {
  $("roomId").value = params.get("room") || "";
  $("joinInvite").hidden = !invitationToken;
  $("joinInvite").disabled = !invitationToken;
  $("startRoom").addEventListener("click", startRoom);
  $("joinAudience").addEventListener("click", joinAudience);
  $("joinInvite").addEventListener("click", joinInvitation);
  $("leaveRoom").addEventListener("click", leaveRoom);
  $("endRoom").addEventListener("click", endRoom);
  $("createInvite").addEventListener("click", createInvitation);
  $("copyInvite").addEventListener("click", copyInvitation);
  clearMedia();
  if (!apiBase()) status("The Groups live-room interface is ready, but the token-service HTTPS URL must be set in assets/js/config.js after the backend is deployed.");
  else status("Sign in, enter a room ID, then start or join according to your group permissions.");
  sb.auth.getUser().then(({ data }) => {
    $("authState").textContent = data.user ? "Signed in" : "Sign in required";
  }).catch(() => $("authState").textContent = "Sign in required");
}
init();
