/* CrowRules Universal Member Layer V2 — uses the canonical Podcasting Supabase client. */
(()=>{"use strict";
window.CrowRulesMember=window.CrowRulesMember||{};
window.CrowRulesMember.ready=(async()=>{
  const db=window.CROW_SUPABASE||(window.CROW_BOOTSTRAP?await window.CROW_BOOTSTRAP():null);
  if(!db)throw new Error("Supabase client unavailable.");
  window.CrowRulesMember.client=db;
  let session=(await db.auth.getSession()).data?.session||null;
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const render=async()=>{
    const host=document.querySelector("[data-crowrules-member]")||document.body;
    let box=document.getElementById("crowrules-member-panel");
    if(!box){box=document.createElement("div");box.id="crowrules-member-panel";box.setAttribute("aria-live","polite");host.prepend(box)}
    if(!session){box.innerHTML='<div class="cr-member-guest"><span>One Account. One Universe.</span><a href="/crowspace/login.html">Log In</a><a href="/crowspace/signup.html">Create Account</a></div>';return}
    const u=session.user||{},meta=u.user_metadata||{};
    let member=null,profile=null;
    try{const r=await db.from("members").select("id,display_name,membership_level,membership_type,crowpoints,crow_points,role").eq("user_id",u.id).maybeSingle();if(!r.error)member=r.data||null}catch(_){}
    try{const r=await db.from("member_profiles").select("*").eq("user_id",u.id).maybeSingle();if(!r.error)profile=r.data||null}catch(_){}
    const name=profile?.display_name||profile?.full_name||member?.display_name||meta.full_name||meta.name||u.email?.split("@")[0]||"CrowRules Member";
    const avatar=profile?.avatar_url||profile?.photo_url||meta.avatar_url||meta.picture||"";
    const points=member?.crowpoints??member?.crow_points??profile?.crowpoints??profile?.crow_points??0;
    const level=member?.membership_level||member?.membership_type||"Free Member";
    box.innerHTML='<div class="cr-member-card">'+(avatar?'<img class="cr-avatar" src="'+esc(avatar)+'" alt="">':'<div class="cr-avatar cr-avatar-fallback">CR</div>')+'<div class="cr-member-main"><strong>'+esc(name)+'</strong><span>'+esc(level)+'</span><span>♣ '+esc(String(points))+' CrowPoints</span></div><div class="cr-member-actions"><a href="/crowspace/profile.html">Profile</a><a href="/crowspace/account.html">Account</a><button id="cr-member-signout">Sign Out</button></div></div>';
    document.getElementById("cr-member-signout")?.addEventListener("click",async()=>{await db.auth.signOut();location.reload()});
  };
  db.auth.onAuthStateChange((_e,s)=>{session=s||null;render()});
  await render();
  return db;
})().catch(e=>{console.warn("CrowRules Member:",e?.message||e)});
const css=document.createElement("style");css.textContent="#crowrules-member-panel{position:fixed;right:18px;top:76px;z-index:9998;font:14px system-ui,sans-serif}.cr-member-card,.cr-member-guest{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #ffffff22;border-radius:14px;background:#0b0d14ee;color:#fff;box-shadow:0 10px 35px #0008}.cr-avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#181c2b}.cr-avatar-fallback{display:grid;place-items:center;font-weight:800}.cr-member-main{display:grid;gap:2px;min-width:135px}.cr-member-main span{font-size:12px;opacity:.72}.cr-member-actions{display:flex;gap:7px;align-items:center}.cr-member-actions a,.cr-member-actions button,.cr-member-guest a{color:#fff;text-decoration:none;border:1px solid #ffffff22;border-radius:9px;background:#ffffff0b;padding:7px 9px;cursor:pointer}.cr-member-actions button{font:inherit}@media(max-width:720px){#crowrules-member-panel{left:10px;right:10px;top:68px}.cr-member-actions a:nth-child(2){display:none}.cr-member-card{flex-wrap:wrap}}";document.head.appendChild(css);
})();