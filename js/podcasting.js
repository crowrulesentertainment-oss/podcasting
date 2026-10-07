const SUPABASE_URL='https://cevylpnoexugwgygvtgu.supabase.co';
const SUPABASE_KEY='sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-';
const supabase=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);
const EDGE_BASE=SUPABASE_URL+'/functions/v1';
const toast=(m)=>{const e=document.getElementById('toast');if(!e)return;e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3500)};
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
async function session(){return (await supabase.auth.getSession()).data.session}
async function edge(path,body={}){const s=await session();if(!s)throw new Error('Please sign in first.');const r=await fetch(EDGE_BASE+'/'+path,{method:'POST',headers:{Authorization:'Bearer '+s.access_token,'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed.');return j}
async function loadPodcasts(){
 const grid=document.getElementById('podcastGrid');if(!grid||!supabase)return;
 grid.innerHTML='<div class="loading-card">Connecting to the CrowRules Podcasting universe…</div>';
 try{
  const [{data:rows,error:showError},{data:categories,error:categoryError}]=await Promise.all([
   supabase.from('podcasts').select('id,title,slug,category,description,artwork_url,author_name,status,is_featured,is_live,created_at').in('status',['published','active']).order('created_at',{ascending:false}).limit(50),
   supabase.from('podcast_categories').select('id,name,slug').eq('is_active',true).order('sort_order',{ascending:true})
  ]);
  if(showError)throw showError;
  if(categoryError)console.warn('CrowRules Podcasting categories unavailable:',categoryError);
  const items=rows||[];
  const cats=categories||[];
  const sel=document.getElementById('category');
  if(sel)sel.innerHTML='<option value="">All categories</option>'+cats.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');
  const render=()=>{
   const q=(document.getElementById('search')?.value||'').trim().toLowerCase();
   const cat=sel?.value||'';
   const filtered=items.filter(p=>{
    const hay=[p.title,p.category,p.description,p.author_name].filter(Boolean).join(' ').toLowerCase();
    return (!cat||p.category_id===cat)&&(!q||hay.includes(q));
   });
   grid.innerHTML=filtered.length?filtered.map(p=>{
    const art=p.artwork_url?'<img src="'+esc(p.artwork_url)+'" alt="" loading="lazy" decoding="async">':'<span>CR</span>';
    return '<article class="podcast-card"><div class="art">'+art+'</div><div class="podcast-body"><span class="meta">'+esc(p.category||'Podcast')+'</span><h3>'+esc(p.title||'Untitled Podcast')+'</h3><p>'+esc(p.description||'Independent voices from CrowRules Podcasting.')+'</p><span class="fine-print">'+esc(p.author_name||'CrowRules Creator')+'</span><br><a class="card-link" href="podcast.html?id='+encodeURIComponent(p.id)+'">Open Podcast →</a></div></article>';
   }).join(''):'<div class="loading-card">No published podcasts are available yet.</div>';
  };
  render();
  const search=document.getElementById('search');
  if(search&&!search.dataset.discoveryBound){search.addEventListener('input',render);search.dataset.discoveryBound='1'}
  if(sel&&!sel.dataset.discoveryBound){sel.addEventListener('change',render);sel.dataset.discoveryBound='1'}
  const count=document.getElementById('podcastCount');if(count)count.textContent=items.length;
 }catch(error){
  console.error('CrowRules Podcasting discovery error:',error);
  grid.innerHTML='<div class="loading-card">Podcast discovery is temporarily unavailable. Please refresh the page.</div>';
  const count=document.getElementById('podcastCount');if(count)count.textContent='0';
 }
}
async function updateNav(){const s=await session();document.querySelectorAll('.nav-account').forEach(a=>{if(s){a.textContent='My Account';a.href='account.html'}else{a.textContent='Sign In';a.href='auth.html'}})}
async function checkout(plan){try{const s=await session();if(!s){location.href='auth.html?mode=signup&next='+encodeURIComponent('./#membership');return}const j=await edge('membership-checkout',{plan_key:plan,checkout_mode:'hosted',origin:location.origin+location.pathname.replace(/[^/]*$/,'')});if(j.mode==='checkout'&&j.url){location.href=j.url}else if(j.mode==='upgrade'){toast('Membership upgraded.');setTimeout(()=>location.href='account.html',700)}else{throw new Error('Stripe checkout is not available.')}}catch(e){toast(e.message)}}
async function initAuth(){
 const form=document.getElementById('authForm');if(!form)return;let mode=new URLSearchParams(location.search).get('mode')==='signup';
 const loginTab=document.getElementById('loginTab'),signupTab=document.getElementById('signupTab'),title=document.getElementById('authTitle'),sub=document.getElementById('authSubtitle'),submit=document.getElementById('authSubmit'),confirm=document.getElementById('confirmWrap'),msg=document.getElementById('authMessage');
 const setMode=m=>{mode=m;loginTab.classList.toggle('active',!m);signupTab.classList.toggle('active',m);confirm.classList.toggle('hidden',!m);title.textContent=m?'Create your CrowRules account.':'Welcome back.';sub.textContent=m?'One account connects you to the CrowRules universe.':'Sign in to continue to CrowRules Podcasting.';submit.textContent=m?'Create Account':'Sign In'};
 loginTab.onclick=()=>setMode(false);signupTab.onclick=()=>setMode(true);
 form.onsubmit=async e=>{e.preventDefault();msg.textContent='';const email=document.getElementById('email').value.trim(),password=document.getElementById('password').value;if(mode&&password!==document.getElementById('confirmPassword').value){msg.textContent='Passwords do not match.';return}submit.disabled=true;try{if(mode){const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname.replace(/auth\.html$/,'account.html')}});if(error)throw error;if(data.session){location.href='account.html'}else{msg.textContent='Account created. Check your email to confirm your address.'}}else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;location.href=new URLSearchParams(location.search).get('next')||'account.html'}}catch(e){msg.textContent=e.message||'Authentication failed.'}finally{submit.disabled=false}};
 const social=async provider=>{const next=new URLSearchParams(location.search).get('next')||'account.html';const redirect=location.origin+location.pathname.replace(/auth\\.html$/,'')+next.replace(/^\.\\//,'');const {error}=await supabase.auth.signInWithOAuth({provider,options:{redirectTo:redirect}});if(error)msg.textContent=error.message};
 document.getElementById('googleBtn')?.addEventListener('click',()=>social('google'));
 document.getElementById('discordBtn')?.addEventListener('click',()=>social('discord'));
 document.getElementById('twitchBtn')?.addEventListener('click',()=>social('twitch'));
 document.getElementById('resetBtn').onclick=async()=>{const email=document.getElementById('email').value.trim();if(!email){msg.textContent='Enter your email first.';return}const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});msg.textContent=error?error.message:'Password reset email sent.'};
 const s=await session();if(s)location.href='account.html';
}
async function initAccount(){
 const name=document.getElementById('accountName');if(!name)return;const s=await session();if(!s){location.href='auth.html?mode=login&next=account.html';return}name.textContent=s.user.user_metadata?.display_name||s.user.email?.split('@')[0]||'CrowRules Member';document.getElementById('accountEmail').textContent=s.user.email||'';
 document.getElementById('signOut').onclick=async()=>{await supabase.auth.signOut();location.href='auth.html'};
 try{const {data,error}=await supabase.from('membership_subscriptions').select('status,cancel_at_period_end,current_period_end,plan_id').eq('user_id',s.user.id).order('updated_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;const box=document.getElementById('membershipState');if(!data){box.innerHTML='<strong>CROW</strong><br><span class="fine-print">Free membership. Upgrade whenever you are ready.</span>';return}const p=await supabase.from('membership_plans').select('name,price_cents').eq('id',data.plan_id).maybeSingle();box.innerHTML='<strong>'+esc(p.data?.name||'MEMBER')+'</strong><br><span class="fine-print">'+esc(data.status)+(data.current_period_end?' • renews '+new Date(data.current_period_end).toLocaleDateString():'')+(data.cancel_at_period_end?' • cancellation scheduled':'')+'</span>'}catch(e){document.getElementById('membershipState').textContent='Membership status unavailable.'}
 document.getElementById('manageMembership').onclick=async()=>{try{const j=await edge('membership-portal',{});if(j.url)location.href=j.url;else toast(j.error||'No billing portal is available.')}catch(e){toast(e.message)}};
}
document.addEventListener('DOMContentLoaded',()=>{loadPodcasts();updateNav();initAuth();initAccount();document.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',()=>checkout(b.dataset.plan)));document.getElementById('refreshPodcasts')?.addEventListener('click',loadPodcasts);document.getElementById('menuBtn')?.addEventListener('click',()=>document.querySelector('.site-header nav')?.classList.toggle('open'))});