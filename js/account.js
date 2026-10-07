(()=>{"use strict";
const SUPABASE_URL="https://baiqacotatszeqmjiekr.supabase.co",SUPABASE_KEY="sb_publishable_d1HCg_kU7AtjvlTtcsfxnA_NM75pell";
const ROLE_KEY="crowrules_podcasting_role",PENDING_ROLE_KEY="crowrules_podcasting_pending_role";
let db,user,profile;
const $=id=>document.getElementById(id);
const msg=(id,t)=>{const e=$(id);if(e)e.textContent=t||""};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const http=v=>{try{const u=new URL(String(v||""));return /^https?:$/.test(u.protocol)?u.href:null}catch{return null}};
const date=v=>{if(!v)return"—";try{return new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(v))}catch{return String(v)}};
const dur=v=>{const s=Math.max(0,Math.round(Number(v)||0)),m=Math.floor(s/60),r=s%60;return m?m+"m "+String(r).padStart(2,"0")+"s":r+"s"};
const provider=p=>({google:"Google",discord:"Discord",twitch:"Twitch",spotify:"Spotify",email:"Email / Password"}[p]||String(p||"Unknown").replace(/_/g," "));
const role=()=>localStorage.getItem(ROLE_KEY)==="podcaster"?"podcaster":"listener";
const redirect=()=>location.origin+location.pathname;
function status(t,bad){const x=$("oauthStatus"),l=$("oauthStatusText");if(x&&l){l.textContent=t;x.classList.toggle("error",!!bad)}}
function roles(r){document.querySelectorAll(".roleCard[data-role]").forEach(b=>b.classList.toggle("active",b.dataset.role===r));if($("roleNote"))$("roleNote").textContent=r==="podcaster"?"Podcaster mode selected — you can change this later.":"Listener mode selected — you can change this later."}
function setRole(r){r=r==="podcaster"?"podcaster":"listener";localStorage.setItem(ROLE_KEY,r);roles(r)}
function params(){const u=new URL(location.href),p=new URLSearchParams(u.search);if(u.hash.length>1)new URLSearchParams(u.hash.slice(1)).forEach((v,k)=>{if(!p.has(k))p.set(k,v)});return{u,p}}
function clean(){const u=new URL(location.href);["code","error","error_code","error_description","error_uri","sb_flow_id"].forEach(k=>u.searchParams.delete(k));history.replaceState({},document.title,u.pathname+u.search)}
async function authCallback(){
 const q=params().p;
 if(q.has("error")||q.has("error_code")||q.has("error_description")){const d=q.get("error_description")||q.get("error")||"OAuth authentication failed.";status("SOCIAL LOGIN FAILED — "+d,true);msg("message",d);clean();return}
 if(q.has("code")){status("FINALIZING SOCIAL LOGIN…");const r=await db.auth.exchangeCodeForSession(q.get("code"));if(r.error){status("SESSION RESTORE FAILED — "+r.error.message,true);msg("message",r.error.message)}else status("SOCIAL LOGIN COMPLETE — SESSION RESTORED.");clean()}
}
async function recoveryCallback(){
 const {u}=params(),p=new URLSearchParams(u.hash.slice(1));if(p.get("type")!=="recovery")return;
 const a=p.get("access_token"),r=p.get("refresh_token");if(!a||!r)return;
 const x=await db.auth.setSession({access_token:a,refresh_token:r});if(x.error){msg("message","PASSWORD RECOVERY SESSION FAILED — "+x.error.message);return}
 history.replaceState({},document.title,u.pathname+u.search);msg("message","PASSWORD RESET SESSION READY — SET A NEW PASSWORD BELOW.")
}
async function ensureProfile(){
 const r=await db.from("podcasting_profiles").select("*").eq("id",user.id).maybeSingle();if(r.error)throw r.error;if(r.data)return r.data;
 const rr=role(),m=user.user_metadata||{},x=await db.from("podcasting_profiles").insert({id:user.id,display_name:m.display_name||m.full_name||m.name||user.email?.split("@")[0]||"Podcasting Member",avatar_url:m.avatar_url||m.picture||null,account_type:rr,is_creator:rr==="podcaster"}).select().single();if(x.error)throw x.error;return x.data
}
function render(p){
 profile=p||{};const r=p?.account_type==="podcaster"?"podcaster":"listener";
 $("displayName").textContent=p?.display_name||"Podcasting Member";$("memberEmail").textContent=user?.email||"";
 $("profileName").value=p?.display_name||"";$("username").value=p?.username||"";$("avatarUrl").value=p?.avatar_url||"";$("bio").value=p?.bio||"";
 $("avatar").textContent=(p?.display_name||"CR").slice(0,2).toUpperCase();$("creatorBadge").textContent=r==="podcaster"?"PODCASTER":"LISTENER";
 $("statusNote").textContent=r==="podcaster"?"Podcaster mode is active. Open Creator Studio to build your show.":"Listener mode is active. Discover shows and build your listening library.";
 $("listenerPath").classList.toggle("active",r==="listener");$("podcasterPath").classList.toggle("active",r==="podcaster");
 const image=http(p?.avatar_url);$("avatar").style.backgroundImage=image?"url("+JSON.stringify(image)+")":"";
}
async function security(){
 try{const x=await db.auth.getUser();if(x.error)throw x.error;const u=x.data.user;if(!u)return;
 $("emailStatus").textContent=u.email_confirmed_at?"VERIFIED":"UNVERIFIED";$("emailStatus").style.color=u.email_confirmed_at?"var(--cyan)":"var(--pink)";
 $("lastSignIn").textContent=date(u.last_sign_in_at);$("accountCreated").textContent=date(u.created_at);
 const c=new Set((u.identities||[]).map(i=>i.provider));if(u.email)c.add("email");$("providerCount").textContent=String(c.size);
 $("providerList").innerHTML=["email","google","discord","twitch","spotify"].map(p=>"<div class='providerItem "+(c.has(p)?"connected":"")+"'><b>"+provider(p)+"</b><small>"+(c.has(p)?"CONNECTED":"NOT CONNECTED")+"</small></div>").join("")
 }catch(e){console.error(e);msg("securityMessage","SECURITY STATUS ERROR — "+e.message)}
}
async function collections(){
 const f=await db.from("podcasting_show_follows").select("show_id,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
 if(f.error){$("followCount").textContent="—";$("followLabel").textContent="—";msg("followList","Unable to load followed shows.")}else{
  const ids=f.data.map(x=>x.show_id),s=ids.length?(await db.from("podcasting_shows").select("id,title,genre").in("id",ids)).data||[]:[];
  const map=new Map(s.map(x=>[x.id,x]));$("followCount").textContent=f.data.length;$("followLabel").textContent=f.data.length;
  $("followList").innerHTML=f.data.length?f.data.map(x=>{const a=map.get(x.show_id);return "<div class='item'><b>"+esc(a?.title||"Podcast show")+"</b><small>"+esc(a?.genre||"Followed show")+" · followed "+esc(date(x.created_at))+"</small></div>"}).join(""):"No followed shows yet."
 }
 const p=await db.from("podcasting_listening_progress").select("track_key,show_name,episode_title,position_seconds,duration_seconds,completed,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false}).limit(25);
 if(p.error){$("savedCount").textContent="—";$("savedLabel").textContent="—";msg("savedList","Unable to load listening progress.")}else{
  $("savedCount").textContent=p.data.length;$("savedLabel").textContent=p.data.length;
  $("savedList").innerHTML=p.data.length?p.data.map(x=>"<div class='item'><b>"+esc(x.episode_title||x.track_key)+"</b><small>"+esc(x.show_name||"CrowRules Podcasting")+" · "+(x.completed?"COMPLETED":dur(x.position_seconds)+" / "+dur(x.duration_seconds))+"</small></div>").join(""):"No saved progress yet."
 }
 const h=await db.from("podcasting_listening_events").select("episode_id,event_type,seconds_listened,occurred_at").eq("user_id",user.id).order("occurred_at",{ascending:false}).limit(50);
 if(h.error){$("historyCount").textContent="—";$("historyLabel").textContent="—";msg("historyList","Unable to load listening history.")}else{
  const ids=[...new Set(h.data.map(x=>x.episode_id))],e=ids.length?(await db.from("podcasting_episodes").select("id,title,show_id").in("id",ids)).data||[]:[];
  const sids=[...new Set(e.map(x=>x.show_id))],s=sids.length?(await db.from("podcasting_shows").select("id,title").in("id",sids)).data||[]:[];
  const em=new Map(e.map(x=>[x.id,x])),sm=new Map(s.map(x=>[x.id,x]));$("historyCount").textContent=h.data.length;$("historyLabel").textContent=h.data.length;
  $("historyList").innerHTML=h.data.length?h.data.slice(0,25).map(x=>{const ep=em.get(x.episode_id),sh=sm.get(ep?.show_id);return "<div class='item'><b>"+esc(ep?.title||"Podcast episode")+"</b><small>"+esc(sh?.title||"CrowRules Podcasting")+" · "+esc(String(x.event_type||"").toUpperCase())+" · "+dur(x.seconds_listened)+" · "+esc(date(x.occurred_at))+"</small></div>"}).join(""):"No listening events yet."
 }
}
function friendly(e){const s=String(e?.message||e||"Authentication failed.");if(/provider is not enabled/i.test(s))return"SOCIAL LOGIN IS NOT ENABLED FOR THIS PROVIDER IN SUPABASE.";if(/redirect/i.test(s))return"SOCIAL LOGIN REDIRECT IS NOT ALLOWED — CHECK SUPABASE AUTH REDIRECT URLS.";if(/invalid login credentials/i.test(s))return"EMAIL OR PASSWORD IS INCORRECT.";return s}
async function oauth(p){
 if(!["google","discord","twitch","spotify"].includes(p))return msg("message","UNSUPPORTED SOCIAL PROVIDER.");
 localStorage.setItem(PENDING_ROLE_KEY,role());status("CONNECTING TO "+p.toUpperCase()+"…");msg("message","CONNECTING TO "+p.toUpperCase()+"…");
 const o={redirectTo:redirect()};if(p==="google")o.queryParams={prompt:"select_account"};const r=await db.auth.signInWithOAuth({provider:p,options:o});
 if(r.error){localStorage.removeItem(PENDING_ROLE_KEY);status(p.toUpperCase()+" LOGIN FAILED — "+r.error.message,true);msg("message",friendly(r.error))}
}
async function saveRole(r){
 r=r==="podcaster"?"podcaster":"listener";const x=await db.from("podcasting_profiles").update({account_type:r,is_creator:r==="podcaster",updated_at:new Date().toISOString()}).eq("id",user.id);
 if(x.error)return msg("pathMessage","ROLE UPDATE FAILED — "+x.error.message);profile={...profile,account_type:r,is_creator:r==="podcaster"};setRole(r);render(profile);msg("pathMessage",r==="podcaster"?"PODCASTER MODE ENABLED — CREATOR STUDIO IS READY.":"LISTENER MODE ENABLED — YOU'RE SET UP TO LISTEN.")
}
async function load(){
 const s=await db.auth.getSession();user=s.data.session?.user||null;
 if(!user){$("loginBox").classList.remove("hidden");$("dashboard").classList.add("hidden");$("welcome").textContent="Sign in to your dedicated CrowRules Podcasting member account.";return}
 $("loginBox").classList.add("hidden");$("dashboard").classList.remove("hidden");$("welcome").textContent="Your Podcasting identity, activity and security controls — all in one place.";
 try{profile=await ensureProfile();const pending=localStorage.getItem(PENDING_ROLE_KEY);if(pending==="listener"||pending==="podcaster"){profile={...profile,account_type:pending,is_creator:pending==="podcaster"};await db.from("podcasting_profiles").update({account_type:pending,is_creator:pending==="podcaster",updated_at:new Date().toISOString()}).eq("id",user.id);localStorage.removeItem(PENDING_ROLE_KEY)}render(profile);await Promise.allSettled([collections(),security()])}catch(e){console.error(e);msg("profileMessage","PROFILE CONNECTION ERROR — "+e.message)}
}
document.addEventListener("DOMContentLoaded",async()=>{
 db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 setRole(role());document.querySelectorAll(".roleCard[data-role]").forEach(b=>b.addEventListener("click",()=>setRole(b.dataset.role)));document.querySelectorAll(".oauthBtn[data-provider]").forEach(b=>b.addEventListener("click",()=>oauth(b.dataset.provider)));
 $("loginForm").addEventListener("submit",async e=>{e.preventDefault();msg("message","SIGNING IN…");const x=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(x.error)return msg("message",friendly(x.error));msg("message","CONNECTED.");await load()});
 $("create").addEventListener("click",async()=>{const email=$("email").value.trim(),password=$("password").value;if(!email||!password)return msg("message","ENTER AN EMAIL AND PASSWORD FIRST.");if(password.length<8)return msg("message","PASSWORD MUST BE AT LEAST 8 CHARACTERS.");const r=role();localStorage.setItem(PENDING_ROLE_KEY,r);const x=await db.auth.signUp({email,password,options:{emailRedirectTo:redirect(),data:{display_name:email.split("@")[0],account_type:r}}});if(x.error){localStorage.removeItem(PENDING_ROLE_KEY);return msg("message",friendly(x.error))}msg("message",x.data.session?"ACCOUNT CREATED — "+r.toUpperCase()+" MODE ACTIVE.":"CHECK YOUR EMAIL TO CONFIRM YOUR ACCOUNT. YOUR "+r.toUpperCase()+" CHOICE IS SAVED.")});
 $("signout").addEventListener("click",async()=>{const x=await db.auth.signOut({scope:"local"});if(x.error)msg("message","SIGN-OUT FAILED — "+x.error.message);await load()});
 $("forgotPassword").addEventListener("click",()=>{const e=$("email").value.trim();document.querySelector(".recoveryPanel")?.scrollIntoView({behavior:"smooth",block:"center"});if(e)$("recoveryEmail").value=e;$("recoveryEmail").focus()});
 $("recoveryForm").addEventListener("submit",async e=>{e.preventDefault();const x=await db.auth.resetPasswordForEmail($("recoveryEmail").value.trim(),{redirectTo:redirect()});msg("recoveryMessage",x.error?"RESET FAILED — "+x.error.message:"RESET LINK SENT — CHECK YOUR EMAIL.")});
 $("changePassword").addEventListener("click",async()=>{const p=prompt("Enter your new Podcasting account password (8+ characters):");if(p===null)return;if(p.length<8)return msg("securityMessage","PASSWORD MUST BE AT LEAST 8 CHARACTERS.");const x=await db.auth.updateUser({password:p});msg("securityMessage",x.error?"PASSWORD UPDATE FAILED — "+x.error.message:"PASSWORD UPDATED — YOUR ACCOUNT IS SECURED.")});
 $("signOutAll").addEventListener("click",async()=>{if(!confirm("Sign out this CrowRules Podcasting account on all active sessions?"))return;const x=await db.auth.signOut({scope:"global"});msg("securityMessage",x.error?"GLOBAL SIGN-OUT FAILED — "+x.error.message:"SIGNED OUT EVERYWHERE.");await load()});
 $("saveProfile").addEventListener("click",async()=>{const p={display_name:$("profileName").value.trim()||null,username:$("username").value.trim().toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,30)||null,avatar_url:http($("avatarUrl").value.trim()),bio:$("bio").value.trim()||null,updated_at:new Date().toISOString()};const x=await db.from("podcasting_profiles").update(p).eq("id",user.id);msg("profileMessage",x.error?"PROFILE SAVE FAILED — "+x.error.message:"PROFILE SAVED — YOUR PODCASTING IDENTITY IS UPDATED.");if(!x.error)render({...profile,...p})});
 $("listenerPath").addEventListener("click",()=>saveRole("listener"));$("podcasterPath").addEventListener("click",()=>saveRole("podcaster"));
 db.auth.onAuthStateChange((ev)=>{if(ev==="SIGNED_IN")status("AUTHENTICATED — ACCOUNT CENTER CONNECTED.");if(ev==="SIGNED_OUT")status("AUTH SYSTEM READY.");if(ev==="SIGNED_IN"||ev==="INITIAL_SESSION"||ev==="TOKEN_REFRESHED")setTimeout(load,0)});
 try{await authCallback();await recoveryCallback()}catch(e){console.error(e);status("AUTH CALLBACK ERROR — "+e.message,true);msg("message",e.message)}await load()
});
})();