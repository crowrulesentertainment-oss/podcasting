const SUPABASE_URL="https://baiqacotatszeqmjiekr.supabase.co",SUPABASE_KEY="sb_publishable_d1HCg_kU7AtjvlTtcsfxnA_NM75pell";
let db,user,profile;
const $=id=>document.getElementById(id),msg=(id,t)=>$(id).textContent=t;
const ROLE_KEY="crowrules_podcasting_role";
function selectedRole(){return localStorage.getItem(ROLE_KEY)==="podcaster"?"podcaster":"listener";}
function setSelectedRole(role){localStorage.setItem(ROLE_KEY,role==="podcaster"?"podcaster":"listener");updateRoleButtons(role);}
function updateRoleButtons(role){
 document.querySelectorAll(".roleCard[data-role]").forEach(b=>b.classList.toggle("active",b.dataset.role===role));
 const note=$("roleNote"); if(note) note.textContent=role==="podcaster"?"Podcaster mode selected — you can change this later.":"Listener mode selected — you can change this later.";
}
async function ensureProfile(){
 const r=await db.from("podcasting_profiles").select("*").eq("id",user.id).maybeSingle(); if(r.error)throw r.error;
 if(!r.data){const x=await db.from("podcasting_profiles").insert({id:user.id,display_name:user.user_metadata?.display_name||user.email?.split("@")[0],account_type:selectedRole(),is_creator:selectedRole()==="podcaster"}).select().single();if(x.error)throw x.error;return x.data}
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
async function loadCollections(){
 const specs=[["followed_shows","followCount","followList","followLabel"],["saved_episodes","savedCount","savedList","savedLabel"],["listening_history","historyCount","historyList","historyLabel"]];
 for(const [table,count,list,label] of specs){
  const r=await db.from(table).select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(25);
  if(r.error){$(count).textContent="—";$(label).textContent="—";$(list).textContent="Network collection tables will appear here when connected.";continue}
  $(count).textContent=r.data.length;$(label).textContent=r.data.length;
  $(list).innerHTML=r.data.length?r.data.map(x=>`<div class="item"><b>${escapeHtml(x.title||x.show_name||x.episode_title||"Podcast item")}</b><small>${escapeHtml(x.subtitle||x.show_name||x.played_at||"Saved to your account")}</small></div>`).join(""):"Nothing here yet.";
 }
}
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
  if(profile.account_type!=="podcaster"&&profile.account_type!=="listener"){
   profile.account_type=selectedRole();
   await db.from("podcasting_profiles").update({account_type:profile.account_type,is_creator:profile.account_type==="podcaster"}).eq("id",user.id);
  }
  renderProfile(profile);await loadCollections();
 }catch(e){console.error(e);msg("profileMessage","PROFILE CONNECTION ERROR — "+e.message)}
}
document.addEventListener("DOMContentLoaded",async()=>{
 db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
 updateRoleButtons(selectedRole());
 document.querySelectorAll(".roleCard[data-role]").forEach(b=>b.addEventListener("click",()=>setSelectedRole(b.dataset.role)));
 $("loginForm").addEventListener("submit",async e=>{e.preventDefault();msg("message","SIGNING IN…");const r=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});msg("message",r.error?r.error.message:"CONNECTED.");if(!r.error)load();});
 $("create").addEventListener("click",async()=>{const role=selectedRole();msg("message","CREATING "+role.toUpperCase()+" ACCOUNT…");const r=await db.auth.signUp({email:$("email").value.trim(),password:$("password").value,options:{emailRedirectTo:location.href,data:{display_name:$("email").value.split("@")[0],account_type:role}}});if(r.error){msg("message",r.error.message);return}msg("message",r.data.session?"ACCOUNT CREATED — "+role.toUpperCase()+" MODE ACTIVE.":"CHECK YOUR EMAIL TO CONFIRM YOUR ACCOUNT. YOUR "+role.toUpperCase()+" CHOICE IS SAVED.");});
 $("signout").addEventListener("click",async()=>{await db.auth.signOut();load();});
 $("saveProfile").addEventListener("click",async()=>{const p={display_name:$("profileName").value.trim()||null,username:$("username").value.trim().toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,30)||null,avatar_url:$("avatarUrl").value.trim()||null,bio:$("bio").value.trim()||null,updated_at:new Date().toISOString()};const r=await db.from("podcasting_profiles").update(p).eq("id",user.id);msg("profileMessage",r.error?r.error.message:"PROFILE SAVED — YOUR PODCASTING IDENTITY IS UPDATED.");if(!r.error)renderProfile({...profile,...p});});
 $("listenerPath").addEventListener("click",()=>saveRole("listener"));$("podcasterPath").addEventListener("click",()=>saveRole("podcaster"));
 db.auth.onAuthStateChange(()=>setTimeout(load,0));load();
});