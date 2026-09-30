/* CrowRules Universal Member Layer V1
   Shared identity UI: profile, membership, CrowPoints, notifications, messages, activity.
   Requires Supabase JS v2 and the shared session key used by CrowRules Universal Shell.
*/
(()=>{const S='https://cevylpnoexugwgygvtgu.supabase.co',K='crowrules-universal-session-v1',KEY=window.CROW_SUPABASE_KEY||window.SUPABASE_ANON_KEY;
if(!KEY)return;
const load=()=>window.supabase?Promise.resolve():new Promise(r=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=r;document.head.appendChild(s)});
window.CrowRulesMember=window.CrowRulesMember||{};
window.CrowRulesMember.ready=load().then(async()=>{const db=window.supabase.createClient(S,KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce',storageKey:K,storage:window.localStorage}});
window.CrowRulesMember.client=db;let session=(await db.auth.getSession()).data.session;
const render=async()=>{const host=document.querySelector('[data-crowrules-member]')||document.body;let box=document.getElementById('crowrules-member-panel');if(!box){box=document.createElement('div');box.id='crowrules-member-panel';box.setAttribute('aria-live','polite');host.prepend(box)}
if(!session){box.innerHTML='<div class="cr-member-guest"><span>One Account. One Universe.</span><a href="/crowspace/login.html">Log In</a><a href="/crowspace/signup.html">Create Account</a></div>';return}
const u=session.user||{};const meta=u.user_metadata||{};let profile=null,member=null,notes=[],messages=[],activity=[];
for(const t of ['profiles','member_profiles','members']){try{const q=await db.from(t).select('*').eq('id',u.id).maybeSingle();if(q.data){if(t==='profiles'||t==='member_profiles')profile=q.data;else member=q.data;break}}catch(e){}}
if(!member){try{const q=await db.from('members').select('*').eq('user_id',u.id).maybeSingle();if(q.data)member=q.data}catch(e){}}
const name=profile?.display_name||profile?.full_name||member?.display_name||meta.full_name||meta.name||u.email?.split('@')[0]||'CrowRules Member';
const avatar=profile?.avatar_url||profile?.photo_url||meta.avatar_url||meta.picture||'';
const points=member?.crowpoints ?? member?.crow_points ?? profile?.crowpoints ?? profile?.crow_points ?? 0;
const level=member?.membership_level||member?.membership_type||profile?.membership_level||'Free Member';
box.innerHTML='<div class="cr-member-card">'+(avatar?'<img class="cr-avatar" src="'+String(avatar).replace(/"/g,'&quot;')+'" alt="">':'<div class="cr-avatar cr-avatar-fallback">CR</div>')+'<div class="cr-member-main"><strong>'+esc(name)+'</strong><span>'+esc(level)+'</span><span>♣ '+esc(String(points))+' CrowPoints</span></div><div class="cr-member-actions"><a href="/crowspace/profile.html">Profile</a><a href="/crowspace/account.html">Account</a><button id="cr-member-signout">Sign Out</button></div></div>';
document.getElementById('cr-member-signout')?.addEventListener('click',async()=>{await db.auth.signOut();location.reload()})};
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));db.auth.onAuthStateChange((_e,s)=>{session=s;render()});await render();return db});
const css=document.createElement('style');css.textContent='#crowrules-member-panel{position:fixed;right:18px;top:76px;z-index:9998;font:14px system-ui,sans-serif}.cr-member-card,.cr-member-guest{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #ffffff22;border-radius:14px;background:#0b0d14ee;color:#fff;box-shadow:0 10px 35px #0008}.cr-avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#181c2b}.cr-avatar-fallback{display:grid;place-items:center;font-weight:800}.cr-member-main{display:grid;gap:2px;min-width:135px}.cr-member-main span{font-size:12px;opacity:.72}.cr-member-actions{display:flex;gap:7px;align-items:center}.cr-member-actions a,.cr-member-actions button,.cr-member-guest a{color:#fff;text-decoration:none;border:1px solid #ffffff22;border-radius:9px;background:#ffffff0b;padding:7px 9px;cursor:pointer}.cr-member-actions button{font:inherit}@media(max-width:720px){#crowrules-member-panel{left:10px;right:10px;top:68px}.cr-member-actions a:nth-child(2){display:none}.cr-member-card{flex-wrap:wrap}}';document.head.appendChild(css)})()