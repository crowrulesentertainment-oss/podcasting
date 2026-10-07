const SUPABASE_URL="https://baiqacotatszeqmjiekr.supabase.co",SUPABASE_KEY="sb_publishable_d1HCg_kU7AtjvlTtcsfxnA_NM75pell";
let db,user,profile;
const $=id=>document.getElementById(id),msg=(id,t)=>$(id).textContent=t;
const ROLE_KEY="crowrules_podcasting_role",PENDING_ROLE_KEY="crowrules_podcasting_pending_role";
function selectedRole(){return localStorage.getItem(ROLE_KEY)==="podcaster"?"podcaster":"listener";}
function cleanRedirectUrl(){return location.origin+location.pathname;}function formatDate(v){if(!v)return "—";try{return new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(v));}catch{return String(v)}}function providerName(p){return ({google:"Google",discord:"Discord",twitch:"Twitch",spotify:"Spotify",email:"Email / Password"}[p]||String(p||"Unknown").replace(/_/g," "));}
function setOAuthStatus(text,error=false){const box=$("oauthStatus"),label=$("oauthStatusText");if(!box||!label)return;label.textContent=text;box.classList.toggle("error",!!error);}
function providerLabel(provider){return String(provider||"").toUpperCase();}
function callbackParams(){const url=new URL(location.href),params=new URLSearchParams(url.search);if(url.hash.startsWith("#"))new URLSearchParams(url.hash.slice(1)).forEach((v,k)=>{if(!params.has(k))params.set(k,v)});return {url,params};}
function cleanCallbackUrl(){const {url,params}=callbackParams();const keys=["code","error","error_code","error_description","error_uri","sb_flow_id"];let changed=false;for(const key of keys){if(params.has(key)){url.searchParams.delete(key);changed=true}if(url.hash.includes(key+"=")){changed=true}}if(changed){url.hash="";history.replaceState({},document.title,url.pathname+url.search)}}
async function handleAuthCallback(){
 const {params}=callbackParams();
 const hasCode=params.has("code"),hasError=params.has("error")||params.has("error_code")||params.has("error_description");
 if(hasError){const detail=params.get("error_description")||params.get("error")||"OAuth authentication failed.";setOAuthStatus("SOCIAL LOGIN FAILED — "+detail,true);msg("message",friendlyAuthError({message:detail}));cleanCallbackUrl();return false;}
 if(hasCode){setOAuthStatus("FINALIZING SOCIAL LOGIN…");const code=params.get("code");const flowId=params.get("sb_flow_id")||undefined;const result=await db.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);if(result.error){setOAuthStatus("SESSION RESTORE FAILED — "+result.error.message,true);msg("message",friendlyAuthError(result.error));cleanCallbackUrl();return false}if(result.data.session){setOAuthStatus("SOCIAL LOGIN COMPLETE — SESSION RESTORED.");cleanCallbackUrl();return true}setOAuthStatus("SOCIAL LOGIN CALLBACK RECEIVED — NO SESSION RETURNED.",true);cleanCallbackUrl();return false;}
 return true;
}
function setSelectedRole(role){localStorage.setItem(ROLE_KEY,role==="podcaster"?"podcaster":"listener");updateRoleButtons(role);}
function updateRoleButtons(role){
 document.querySelectorAll(".roleCard[data-role]").forEach(b=>b.classList.toggle("active",b.dataset.role===role));
 const note=$("roleNote"); if(note) note.textContent=role==="podcaster"?"Podcaster mode selected — you can change this later.":"Listener mode selected — you can change this later.";
}
async function ensureProfile(){
 const r=await db.from("podcasting_profiles").select("*").eq("id",user.id).maybeSingle(); if(r.error)throw r.error;
 if(!r.data){const role=localStorage.getItem(PENDING_ROLE_KEY)==="podcaster"?"podcaster":"listener";const meta=user.user_metadata||{};const x=await db.from("podcasting_profiles").insert({id:user.id,display_name:meta.display_name||meta.full_name||meta.name||user.email?.split("@")[0],avatar_url:meta.avatar_url||meta.picture||null,account_type:role,is_creator:role==="podcaster"}).select().single();if(x.error)throw x.error;return x.data}
 return r.data;
}
function renderProfile(p){
 profile=p;
 $("displayName").textContent=p.display_name||"Podcasting Member";$("memberEmail").textContent=user.email||"";
 $("profileName").value=p.display_name||"";$("username").value=p.username||"";$("avatarUrl").value=p.avatar_url||"";$("bio").value=p.bio||"";
 $("avatar").textContent=(p.display_name||"CR").slice(0,2).toUpperCase();
 const role=p.account_type==="podcaster"?"podcaster":"listener";
 $("creatorBadge").textContent=role==="podcaster"?"PODCASTER":"LISTENER";
 $("statusNote").textContent=role==="podcaster"?"Podcaster mode is active. Your next step is building your show.":"Listener mode is active. Discover shows and build your listening library.";
 $("listenerPath").classList.toggle("active",role==="listener");$("podcasterPath").classList.toggle("active",role==="podcaster");
 if(p.avatar_url)$("avatar").style.backgroundImage=`url('${p.avatar_url.replace(/'/g,"%27")}')`;else $("avatar").style.backgroundImage="";
}
async function loadSecurity(){try{const u=await db.auth.getUser(),current=u.data.user;if(!current)return;const es=$("emailStatus");es.textContent=current.email_confirmed_at?"VERIFIED":"UNVERIFIED";es.style.color=current.email_confirmed_at?"var(--cyan)":"var(--pink)";$("lastSignIn").textContent=formatDate(current.last_sign_in_at);$("accountCreated").textContent=formatDate(current.created_at);const identities=current.identities||[],connected=new Set(identities.map(x=>x.provider));if(current.email)connected.add("email");$("providerCount").textContent=connected.size;$("providerList").innerHTML=["email","google","discord","twitch","spotify"].map(p=>`<div class="providerItem ${connected.has(p)?"connected":""}"><b>${providerName(p)}</b><small>${connected.has(p)?"CONNECTED":"NOT CONNECTED"}</small></div>`).join("");}catch(e){console.error(e);if($("securityMessage"))$("securityMessage").textContent="SECURITY STATUS ERROR — "+e.message;}}
async function loadCollections(){
 const specs=[["followed_shows","followCount","followList","followLabel"],["saved_episodes","savedCount","savedList","savedLabel"],["listening_history","historyCount","historyList","historyLabel"]];
 for(const [table,count,list,label] of specs){
  const r=await db.from(table).select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(25);
  if(r.error){$(count).textContent="—";$(label).textContent="—";$(list).textContent="Network collection tables will appear here when connected.";continue}
  $(count).textContent=r.data.length;$(label).textContent=r.data.length;
  $(list).innerHTML=r.data.length?r.data.map(x=>`<div class="item"><b>${escapeHtml(x.title||x.show_name||x.episode_title||"Podcast item")}</b><small>${escapeHtml(x.subtitle||x.show_name||x.played_at||"Saved to your account")}</small></div>`).join(""):"Nothing here yet.";
 }
}
async function signInWithProvider(provider){
  const allowed=["google","discord","twitch","spotify"];
  if(!allowed.includes(provider)){msg("message","UNSUPPORTED SOCIAL PROVIDER.");return;}
  const role=selectedRole();
  localStorage.setItem(PENDING_ROLE_KEY,role);
  msg("message","CONNECTING TO "+providerLabel(provider)+"…");
  setOAuthStatus("CONNECTING TO "+providerLabel(provider)+"…");
  const {error}=await db.auth.signInWithOAuth({provider,options:{redirectTo:cleanRedirectUrl(),queryParams:provider==="google"?{prompt:"select_account"}:undefined}});
  if(error){localStorage.removeItem(PENDING_ROLE_KEY);setOAuthStatus(providerLabel(provider)+" LOGIN FAILED — "+error.message,true);msg("message",friendlyAuthError(error));}
}
function friendlyAuthError(error){const raw=String(error?.message||error||"Authentication failed.");if(/provider is not enabled/i.test(raw))return "SOCIAL LOGIN IS NOT ENABLED YET FOR THIS PROVIDER IN SUPABASE.";if(/redirect/i.test(raw))return "SOCIAL LOGIN REDIRECT IS NOT ALLOWED — ADD THE PODCASTING ACCOUNT URL TO SUPABASE AUTH REDIRECT URLS.";return raw;}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
async function saveRole(role){
 const r=await db.from("podcasting_profiles").update({account_type:role,is_creator:role==="podcaster",updated_at:new Date().toISOString()}).eq("id",user.id);
 if(r.error){msg("pathMessage",r.error.message);return}
 setSelectedRole(role);profile={...profile,account_type:role,is_creator:role==="podcaster"};renderProfile(profile);
 msg("pathMessage",role==="podcaster"?"PODCASTER MODE ENABLED — YOUR PODCASTING IDENTITY IS READY TO BUILD.":"LISTENER MODE ENABLED — YOU'RE SET UP TO DISCOVER AND LISTEN.");
}
async function load(){
 const s=await db.auth.getSession();user=s.data.session?.user;
 if(!user){$("loginBox").classList.remove("hidden");$("dashboard").classList.add("hidden");$("welcome").textContent="Sign in to your dedicated CrowRules Podcasting member account.";return}
 $("loginBox").classList.add("hidden");$("dashboard").classList.remove("hidden");
 $("welcome").textContent="Your Podcasting identity, community activity and member type — all in one place.";
 try{
  profile=await ensureProfile();
  const pending=localStorage.getItem(PENDING_ROLE_KEY);
  if(!profile?.account_type && (pending==="podcaster"||pending==="listener")){
   const rr=await db.from("podcasting_profiles").update({account_type:pending,is_creator:pending==="podcaster",updated_at:new Date().toISOString()}).eq("id",user.id);
   if(!rr.error) profile={...profile,account_type:pending,is_creator:pending==="podcaster"};
  }
  localStorage.removeItem(PENDING_ROLE_KEY);
  
  if(profile.account_type!=="podcaster"&&profile.account_type!=="listener"){
   profile.account_type=selectedRole();
   await db.from("podcasting_profiles").update({account_type:profile.account_type,is_creator:profile.account_type==="podcaster"}).eq("id",user.id);
  }
  renderProfile(profile);await loadCollections();await loadSecurity();
 }catch(e){console.error(e);msg("profileMessage","PROFILE CONNECTION ERROR — "+e.message)}
}
document.addEventListener("DOMContentLoaded",async()=>{
 db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 updateRoleButtons(selectedRole());
 document.querySelectorAll(".roleCard[data-role]").forEach(b=>b.addEventListener("click",()=>setSelectedRole(b.dataset.role)));
 document.querySelectorAll(".oauthBtn[data-provider]").forEach(b=>b.addEventListener("click",()=>signInWithProvider(b.dataset.provider)));
 $("loginForm").addEventListener("submit",async e=>{e.preventDefault();msg("message","SIGNING IN…");const r=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});msg("message",r.error?r.error.message:"CONNECTED.");if(!r.error)load();});
 $("create").addEventListener("click",async()=>{const role=selectedRole();localStorage.setItem(PENDING_ROLE_KEY,role);msg("message","CREATING "+role.toUpperCase()+" ACCOUNT…");const r=await db.auth.signUp({email:$("email").value.trim(),password:$("password").value,options:{emailRedirectTo:location.href,data:{display_name:$("email").value.split("@")[0],account_type:role}}});if(r.error){localStorage.removeItem(PENDING_ROLE_KEY);msg("message",r.error.message);return}msg("message",r.data.session?"ACCOUNT CREATED — "+role.toUpperCase()+" MODE ACTIVE.":"CHECK YOUR EMAIL TO CONFIRM YOUR ACCOUNT. YOUR "+role.toUpperCase()+" CHOICE IS SAVED.");});
 $("signout").addEventListener("click",async()=>{await db.auth.signOut({scope:"local"});load();});
 $("forgotPassword").addEventListener("click",()=>{const email=$("email").value.trim();$("recoveryPanel").scrollIntoView({behavior:"smooth",block:"center"});if(email)$("recoveryEmail").value=email;$("recoveryEmail").focus();});$("recoveryForm").addEventListener("submit",async e=>{e.preventDefault();const r=await db.auth.resetPasswordForEmail($("recoveryEmail").value.trim(),{redirectTo:cleanRedirectUrl()});$("recoveryMessage").textContent=r.error?r.error.message:"RESET LINK SENT — CHECK YOUR EMAIL.";});$("changePassword").addEventListener("click",async()=>{const next=prompt("Enter your new Podcasting account password (8+ characters):");if(next===null)return;if(next.length<8){$("securityMessage").textContent="PASSWORD MUST BE AT LEAST 8 CHARACTERS.";return}const r=await db.auth.updateUser({password:next});$("securityMessage").textContent=r.error?"PASSWORD UPDATE FAILED — "+r.error.message:"PASSWORD UPDATED — YOUR ACCOUNT IS SECURED.";});$("signOutAll").addEventListener("click",async()=>{if(!confirm("Sign out this CrowRules Podcasting account on all active sessions?"))return;const r=await db.auth.signOut({scope:"global"});$("securityMessage").textContent=r.error?"GLOBAL SIGN-OUT FAILED — "+r.error.message:"SIGNED OUT EVERYWHERE — SIGN IN AGAIN TO CONTINUE.";load();});$("saveProfile").addEventListener("click",async()=>{const p={display_name:$("profileName").value.trim()||null,username:$("username").value.trim().toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,30)||null,avatar_url:$("avatarUrl").value.trim()||null,bio:$("bio").value.trim()||null,updated_at:new Date().toISOString()};const r=await db.from("podcasting_profiles").update(p).eq("id",user.id);msg("profileMessage",r.error?r.error.message:"PROFILE SAVED — YOUR PODCASTING IDENTITY IS UPDATED.");if(!r.error)renderProfile({...profile,...p});});
 $("listenerPath").addEventListener("click",()=>saveRole("listener"));$("podcasterPath").addEventListener("click",()=>saveRole("podcaster"));
 db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_IN"&&session)setOAuthStatus("SOCIAL LOGIN COMPLETE — SESSION RESTORED.");if(event==="SIGNED_OUT")setOAuthStatus("SOCIAL LOGIN READY — SIGN IN TO CONTINUE.");if(event==="SIGNED_IN"||event==="INITIAL_SESSION"||event==="TOKEN_REFRESHED")setTimeout(load,0);});handleAuthCallback().then(()=>load()).catch(e=>{console.error(e);setOAuthStatus("AUTH CALLBACK ERROR — "+e.message,true);msg("message",e.message);load();});
});