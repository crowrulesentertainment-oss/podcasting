import { sb } from "./client.js";
import { SITE_BASE } from "./config.js";

const $ = (s, root=document) => root.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const params = new URLSearchParams(location.search);
const categories = ["Podcasting & Creators","Business & Entrepreneurship","Sports & Entertainment","Local Communities","Hobbies & Lifestyle","Social & General"];
const categoryForDatabase = value => ({ "Podcasting & Creators":"Creators", "Business & Entrepreneurship":"Other", "Sports & Entertainment":"Entertainment", "Local Communities":"Local & PNW", "Hobbies & Lifestyle":"General", "Social & General":"General" }[value] || (["General","Entertainment","Sports","Storytelling","Local & PNW","Music","Film & TV","Creators","Technology","Other"].includes(value) ? value : "Other"));
const covers = {
 "Podcasting & Creators":"photo-1598488035139-bdbb2231ce04",
 "Business & Entrepreneurship":"photo-1521737711867-e3b97375f902",
 "Sports & Entertainment":"photo-1461896836934-ffe607ba8211",
 "Local Communities":"photo-1500530855697-b586d89ba3ee",
 "Hobbies & Lifestyle":"photo-1470252649378-9c29740c9fa8",
 "Social & General":"photo-1529156069898-49953e39b3ac"
};
const cover = g => g.cover_image_url || "https://images.unsplash.com/"+(covers[g.category]||covers["Social & General"])+"?auto=format&fit=crop&w=1100&q=85";
const signIn = () => location.href = SITE_BASE + "login.html";
async function currentUser(){const {data,error}=await sb.auth.getUser();if(error)throw error;return data.user||null}
async function loadGroups(){const order=q=>q.order("is_featured",{ascending:false}).order("created_at",{ascending:false}).limit(100);const rich=await order(sb.from("podcast_community_circles").select("id,owner_id,name,description,category,is_public,is_featured,created_at,visibility,slug,cover_image_url,community_rules,group_chat_enabled"));if(!rich.error)return rich.data||[];const base="id,owner_id,name,description,category,is_public,is_featured,created_at";const pub=await order(sb.from("podcast_community_circles").select(base).eq("is_public",true));if(pub.error)throw pub.error;let own=[];const user=await currentUser().catch(()=>null);if(user){const mine=await order(sb.from("podcast_community_circles").select(base).eq("owner_id",user.id));if(!mine.error)own=mine.data||[]}const map=new Map();[...(pub.data||[]),...own].forEach(g=>map.set(g.id,{...g,visibility:g.is_public?"public":"hidden"}));return [...map.values()].sort((a,b)=>Number(!!b.is_featured)-Number(!!a.is_featured)||new Date(b.created_at)-new Date(a.created_at))}
function groupUrl(id){return "community.html?group="+encodeURIComponent(id)+"&preview=1"}
function card(g,action="Open group"){return '<article class="gp-card"><div class="gp-card-cover" style="background-image:url(&quot;'+esc(cover(g))+'&quot;)"></div><div class="gp-card-content"><small>'+esc(g.category||"COMMUNITY")+' · '+esc((g.visibility|| (g.is_public?"public":"hidden")).toUpperCase())+'</small><h3>'+esc(g.name)+'</h3><p>'+esc(g.description||"A place to connect and build together.")+'</p><div class="gp-card-actions"><a class="gp-button" href="'+groupUrl(g.id)+'">'+esc(action)+'</a></div></div></article>'}
function renderCards(root,groups,action){root.innerHTML=groups.length?groups.map(g=>card(g,action)).join(""):'<div class="gp-notice">No groups to show yet. Explore public communities or create the first one.</div>'}
async function discover(){const root=$("#gp-results"),status=$("#gp-status");let groups=[];try{groups=await loadGroups();groups=groups.filter(g=>(g.visibility||(g.is_public?"public":"hidden"))!=="hidden")}catch(e){status.textContent="Groups could not load: "+e.message;return}const search=$("#gp-search"),category=$("#gp-category"),sort=$("#gp-sort");if(params.get("category"))category.value=params.get("category");const draw=()=>{const q=search.value.trim().toLowerCase(),list=groups.filter(g=>(!category.value||g.category===category.value)&&[g.name,g.description,g.category].join(" ").toLowerCase().includes(q));list.sort((a,b)=>{if(sort.value==="alphabetical")return String(a.name||"").localeCompare(String(b.name||""));if(sort.value==="newest")return new Date(b.created_at||0)-new Date(a.created_at||0);return Number(!!b.is_featured)-Number(!!a.is_featured)||new Date(b.created_at||0)-new Date(a.created_at||0)});renderCards(root,list,"View group");status.textContent=list.length+" public group(s) found."};search.addEventListener("input",draw);category.addEventListener("change",draw);sort.addEventListener("change",draw);draw()}
async function mine(){const root=$("#gp-results"),status=$("#gp-status");const user=await currentUser().catch(()=>null);if(!user){status.textContent="Sign in with your CrowRules Podcasting account to see your groups.";root.innerHTML='<a class="gp-button" href="'+SITE_BASE+'login.html">Sign in to continue</a>';return}const {data:members,error}=await sb.from("podcast_community_circle_members").select("circle_id,role").eq("member_id",user.id);if(error){status.textContent=error.message;return}const roles=new Map((members||[]).map(x=>[x.circle_id,x.role||"member"])),ids=[...roles.keys()];if(!ids.length){status.textContent="You’re not a member of any groups yet.";root.innerHTML='<div class="gp-notice">You haven’t joined a group yet. <a class="gp-link" href="discover.html">Discover communities →</a></div>';return}const {data:groups,error:groupError}=await sb.from("podcast_community_circles").select("id,owner_id,name,description,category,is_public,is_featured,created_at").in("id",ids);if(groupError){status.textContent=groupError.message;return}const search=$("#gp-mine-search"),filter=$("#gp-mine-role"),sort=$("#gp-mine-sort");const draw=()=>{const q=search.value.trim().toLowerCase();let list=(groups||[]).filter(g=>{const role=roles.get(g.id)||"member",lead=["owner","moderator"].includes(role);return(!q||[g.name,g.description,g.category].join(" ").toLowerCase().includes(q))&&(!filter.value||(filter.value==="leadership"?lead:!lead))});list.sort((a,b)=>sort.value==="alphabetical"?String(a.name||"").localeCompare(String(b.name||"")):sort.value==="oldest"?new Date(a.created_at||0)-new Date(b.created_at||0):new Date(b.created_at||0)-new Date(a.created_at||0));root.innerHTML=list.length?list.map(g=>card(g,"Open group").replace("<div class=\"gp-card-actions\">",'<p class="gp-mine-role">Your role: <strong>'+esc(roles.get(g.id)||"member")+"</strong></p><div class=\"gp-card-actions\">")).join(""):'<div class="gp-notice">No groups match those filters. Try changing your search or role filter.</div>';status.textContent=(groups||[]).length+" groups · "+(groups||[]).filter(g=>["owner","moderator"].includes(roles.get(g.id))).length+" managed by you · "+list.length+" shown"};[search,filter,sort].forEach(el=>el.addEventListener("input",draw));[filter,sort].forEach(el=>el.addEventListener("change",draw));draw()}
async function feed(){const root=$("#gp-feed"),status=$("#gp-status"),user=await currentUser().catch(()=>null);if(!user){status.textContent="Sign in to see posts from your groups.";root.innerHTML='<a class="gp-button" href="'+SITE_BASE+'login.html">Sign in to continue</a>';return}const {data:members,error:mError}=await sb.from("podcast_community_circle_members").select("circle_id").eq("member_id",user.id);if(mError){status.textContent=mError.message;return}const ids=(members||[]).map(x=>x.circle_id);if(!ids.length){root.innerHTML='<div class="gp-notice">Join a community to build your personal Groups Feed. <a class="gp-link" href="discover.html">Discover groups →</a></div>';return}const {data:posts,error}=await sb.from("podcast_community_circle_posts").select("id,circle_id,author_id,body,created_at").in("circle_id",ids).order("created_at",{ascending:false}).limit(60);if(error){status.textContent=error.message;return}const groupMap=new Map((await sb.from("podcast_community_circles").select("id,name").in("id",ids)).data?.map(g=>[g.id,g.name])||[]);root.innerHTML=(posts||[]).length?(posts||[]).map(p=>'<article class="gp-post"><div class="gp-post-head"><b>'+esc(groupMap.get(p.circle_id)||"Community")+'</b><time>'+new Date(p.created_at).toLocaleString()+'</time></div><p>'+esc(p.body)+'</p><a href="'+groupUrl(p.circle_id)+'">Open conversation →</a></article>').join(""):'<div class="gp-notice">Your groups haven’t posted anything yet. Start a conversation inside one of your communities.</div>'}

async function activityPage(){
 const root=$("#gp-activity"),status=$("#gp-status"),user=await currentUser().catch(()=>null);
 if(!user){status.textContent="Sign in to view activity from your groups.";root.innerHTML='<div class="gp-notice"><a class="gp-link" href="'+SITE_BASE+'login.html">Sign in</a> to see your community activity.</div>';return}
 const {data:members,error:mError}=await sb.from("podcast_community_circle_members").select("circle_id").eq("member_id",user.id);
 if(mError){status.textContent="Your group memberships could not be loaded: "+mError.message;return}
 const ids=[...new Set((members||[]).map(x=>x.circle_id))];
 if(!ids.length){root.innerHTML='<div class="gp-notice">Join a group to see its activity here. <a class="gp-link" href="discover.html">Discover groups →</a></div>';return}
 const {data:groups,error:gError}=await sb.from("podcast_community_circles").select("id,name").in("id",ids).order("name",{ascending:true});
 if(gError){status.textContent="Your groups could not be loaded: "+gError.message;return}
 const groupMap=new Map((groups||[]).map(g=>[g.id,g.name]));
 const {data:items,error}=await sb.from("podcast_community_circle_activity").select("id,circle_id,activity_type,target_id,summary,created_at").in("circle_id",ids).order("created_at",{ascending:false}).limit(100);
 if(error){status.textContent="Group activity could not be loaded: "+error.message;return}
 const typeLabels={discussion_created:"New discussion",reply_created:"New reply",event_created:"Event created",event_updated:"Event updated",event_cancelled:"Event cancelled",member_joined:"New member"};
 const typeIcons={discussion_created:"💬",reply_created:"↩",event_created:"📅",event_updated:"🗓",event_cancelled:"⚠",member_joined:"👋"};
 root.innerHTML='<div class="gp-activity-toolbar"><label for="gp-activity-group">Filter by group</label><select id="gp-activity-group"><option value="">All my groups</option>'+(groups||[]).map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select><span class="gp-muted">'+items.length+' recent updates</span></div><div id="gp-activity-list"></div>';
 const select=$("#gp-activity-group"),list=$("#gp-activity-list");
 const draw=()=>{const visible=(items||[]).filter(item=>!select.value||item.circle_id===select.value);list.innerHTML=visible.length?visible.map(item=>'<article class="gp-activity-card"><div class="gp-activity-icon" aria-hidden="true">'+(typeIcons[item.activity_type]||"•")+'</div><div class="gp-activity-content"><div class="gp-activity-heading"><span>'+esc(typeLabels[item.activity_type]||"Group update")+'</span><time datetime="'+esc(item.created_at)+'">'+esc(new Date(item.created_at).toLocaleString())+'</time></div><p>'+esc(item.summary)+'</p><div class="gp-activity-footer"><span>'+esc(groupMap.get(item.circle_id)||"Your group")+'</span><a href="community.html?group='+encodeURIComponent(item.circle_id)+'">Open group →</a></div></div></article>').join(""):'<div class="gp-notice">No activity is available for this group yet.</div>'};
 select.addEventListener("change",draw);draw();
 status.textContent="Recent activity from groups you belong to. Activity is read-only in this view.";
}



async function dashboard(){
 const root=$("#gp-dashboard"),status=$("#gp-status"),user=await currentUser().catch(()=>null);
 if(!user){status.textContent="Sign in to see your Groups dashboard.";root.innerHTML='<div class="gp-notice"><a class="gp-link" href="'+SITE_BASE+'login.html">Sign in</a> to continue.</div>';return}
 status.textContent="Loading your communities…";
 const {data:members,error:mError}=await sb.from("podcast_community_circle_members").select("circle_id,role").eq("member_id",user.id);
 if(mError){status.textContent="Your memberships could not be loaded: "+mError.message;return}
 const roles=new Map((members||[]).map(x=>[x.circle_id,x.role||"member"])),ids=[...roles.keys()];
 if(!ids.length){status.textContent="Your community dashboard is ready when you join a group.";root.innerHTML='<div class="gp-notice">You have not joined a group yet. <a class="gp-link" href="discover.html">Discover groups →</a></div>';return}
 const [{data:groups,error:gError},{data:activity,error:aError}]=await Promise.all([
  sb.from("podcast_community_circles").select("id,name,description,category,created_at").in("id",ids).order("name",{ascending:true}),
  sb.from("podcast_community_circle_activity").select("id,circle_id,activity_type,summary,created_at").in("circle_id",ids).order("created_at",{ascending:false}).limit(12)
 ]);
 if(gError){status.textContent="Your groups could not be loaded: "+gError.message;return}
 if(aError){status.textContent="Your groups loaded, but recent activity could not be retrieved: "+aError.message}
 const groupMap=new Map((groups||[]).map(g=>[g.id,g]));
 const managed=ids.filter(id=>["owner","moderator"].includes(roles.get(id))).length;
 const labels={discussion_created:"New discussion",reply_created:"New reply",event_created:"Event created",event_updated:"Event updated",event_cancelled:"Event cancelled",member_joined:"New member"};
 const recent=(activity||[]).filter(x=>groupMap.has(x.circle_id));
 root.innerHTML='<section class="gp-dashboard-stats"><article><strong>'+ids.length+'</strong><span>Groups you belong to</span></article><article><strong>'+managed+'</strong><span>Groups you help manage</span></article><article><strong>'+recent.length+'</strong><span>Recent group updates</span></article></section><div class="gp-dashboard-columns"><section class="gp-dashboard-panel"><div class="gp-dashboard-heading"><div><span class="gp-kicker">YOUR COMMUNITIES</span><h2>My groups</h2></div><a class="gp-link" href="my-groups.html">Manage list →</a></div><div class="gp-dashboard-groups">'+(groups||[]).map(g=>'<a class="gp-dashboard-group" href="'+groupUrl(g.id)+'"><span><strong>'+esc(g.name)+'</strong><small>'+esc(g.category||"Community")+'</small></span><em>'+esc(roles.get(g.id)||"member")+'</em></a>').join("")+'</div></section><section class="gp-dashboard-panel"><div class="gp-dashboard-heading"><div><span class="gp-kicker">THE LATEST</span><h2>Recent activity</h2></div><a class="gp-link" href="activity.html">Full activity →</a></div><div class="gp-dashboard-activity">'+(recent.length?recent.map(item=>'<article><span>'+esc(labels[item.activity_type]||"Group update")+'</span><p>'+esc(item.summary||"There is a new update in your group.")+'</p><small>'+esc(groupMap.get(item.circle_id)?.name||"Your group")+' · '+esc(new Date(item.created_at).toLocaleString())+'</small></article>').join(""):'<div class="gp-notice">No recent activity is available yet. Start a conversation in one of your groups.</div>')+'</div></section></div><nav class="gp-dashboard-quicklinks" aria-label="Groups shortcuts"><a href="discover.html">Discover groups</a><a href="feed.html">Community feed</a><a href="events.html">Events</a><a href="collaborations.html">Collaborations & polls</a><a href="invitations.html">Invitations</a><a href="notifications.html">Notification preferences</a></nav>';
 status.textContent="Your Groups dashboard · activity is shown only for groups you belong to.";
}


async function recognitionsPage(){
 const root=$("#gp-recognitions"),status=$("#gp-status"),user=await currentUser().catch(()=>null),selected=params.get("group");
 if(!user){status.textContent="Sign in to recognize members of your groups.";root.innerHTML='<div class="gp-notice"><a class="gp-link" href="'+SITE_BASE+'login.html">Sign in</a> to continue.</div>';return}
 const {data:members,error}=await sb.from("podcast_community_circle_members").select("circle_id,member_id,role").eq("member_id",user.id);
 if(error){status.textContent="Your memberships could not be loaded: "+error.message;return}
 const memberships=members||[],ids=memberships.map(m=>m.circle_id);
 if(!ids.length){root.innerHTML='<div class="gp-notice">Join a group to celebrate its members. <a class="gp-link" href="discover.html">Discover groups →</a></div>';return}
 const {data:groups,error:gError}=await sb.from("podcast_community_circles").select("id,name").in("id",ids).order("name");
 if(gError){status.textContent=gError.message;return}
 const groupMap=new Map((groups||[]).map(g=>[g.id,g.name]));
 const initial=selected&&ids.includes(selected)?selected:ids[0];
 root.innerHTML='<div class="gp-recognition-controls"><label for="gp-recognition-group">Choose a group</label><select id="gp-recognition-group">'+(groups||[]).map(g=>'<option value="'+esc(g.id)+'" '+(g.id===initial?'selected':'')+'>'+esc(g.name)+'</option>').join("")+'</select></div><section class="gp-recognition-compose" id="gp-recognition-compose"></section><section class="gp-recognition-wall"><div class="gp-section-title"><div><span class="gp-kicker">COMMUNITY APPRECIATION</span><h2>Recognition wall</h2><p class="gp-muted">Celebrate the people who make this group welcoming and active.</p></div></div><div id="gp-recognition-list"></div></section>';
 const select=$("#gp-recognition-group"),compose=$("#gp-recognition-compose"),list=$("#gp-recognition-list");
 async function draw(){
  const circle=select.value,role=memberships.find(m=>m.circle_id===circle)?.role,canAward=["owner","moderator"].includes(role);
  const [{data:roster,error:rError},{data:items,error:iError}]=await Promise.all([
   sb.from("podcast_community_circle_members").select("member_id,role").eq("circle_id",circle).limit(150),
   sb.from("podcast_community_circle_recognitions").select("id,giver_id,recipient_id,recognition_type,message,period_start,created_at").eq("circle_id",circle).order("created_at",{ascending:false}).limit(100)
  ]);
  if(rError||iError){status.textContent=(rError||iError).message;return}
  const people=[...(roster||[])].filter(m=>m.member_id!==user.id);
  const profileIds=[...new Set((roster||[]).map(m=>m.member_id))];
  const {data:profiles}=await sb.from("crowrules_public_profiles").select("user_id,display_name,username,avatar_url").in("user_id",profileIds);
  const names=new Map((profiles||[]).map(p=>[p.user_id,p.display_name||p.username||"CrowRules member"]));
  const monthStart=new Date();monthStart.setDate(1);monthStart.setHours(0,0,0,0);
  const monthItems=(items||[]).filter(x=>new Date(x.period_start+"T00:00:00")>=monthStart);
  const awardExists=monthItems.some(x=>x.recognition_type==="member_of_month");
  compose.innerHTML='<div class="gp-recognition-form-head"><div><span class="gp-kicker">GIVE SOMEONE THEIR FLOWERS</span><h2>Recognize a member</h2><p class="gp-muted">Send a short appreciation note to another member of this group.</p></div></div>'+ (people.length?'<form id="gp-recognition-form" class="gp-form"><label>Member<select name="recipient_id" required>'+people.map(m=>'<option value="'+esc(m.member_id)+'">'+esc(names.get(m.member_id)||"CrowRules member")+'</option>').join("")+'</select></label><label>Your message<textarea name="message" maxlength="240" placeholder="What would you like to appreciate about them?"></textarea></label><button class="gp-button" type="submit">Send appreciation</button></form>':'<p class="gp-muted">You need another member in this group before you can send appreciation.</p>')+(canAward?'<div class="gp-award-panel"><h3>Member of the month</h3><p class="gp-muted">'+(awardExists?'This group has already recorded its member of the month for the current month.':'Owners and moderators can recognize one member of the month.')+'</p>'+(awardExists||!people.length?'':'<form id="gp-award-form" class="gp-form"><label>Choose a member<select name="recipient_id">'+people.map(m=>'<option value="'+esc(m.member_id)+'">'+esc(names.get(m.member_id)||"CrowRules member")+'</option>').join("")+'</select></label><label>Why they stood out<textarea name="message" maxlength="240" placeholder="Share why this member deserves recognition."></textarea></label><button class="gp-button ghost" type="submit">Award member of the month</button></form>')+'</div>':'');
  const card=x=>'<article class="gp-recognition-card"><div class="gp-recognition-symbol">'+(x.recognition_type==="member_of_month"?'🏆':'💛')+'</div><div><div class="gp-recognition-title">'+(x.recognition_type==="member_of_month"?'Member of the month':'Appreciation')+'</div><p><b>'+esc(names.get(x.recipient_id)||"Group member")+'</b>'+(x.message?' — '+esc(x.message):'')+'</p><small>From '+esc(names.get(x.giver_id)||"A group member")+' · '+esc(new Date(x.created_at).toLocaleDateString())+'</small></div></article>';
  list.innerHTML=monthItems.length?monthItems.map(card).join(""):'<div class="gp-notice">No recognition has been shared this month. Be the first to celebrate someone.</div>';
  const send=async(form,type)=>{form.addEventListener("submit",async e=>{e.preventDefault();const d=new FormData(form),recipient=String(d.get("recipient_id")||""),message=String(d.get("message")||"").trim(),button=form.querySelector("button");if(!recipient||recipient===user.id)return;button.disabled=true;status.textContent="Saving recognition…";try{const {error}=await sb.from("podcast_community_circle_recognitions").insert({circle_id:circle,giver_id:user.id,recipient_id:recipient,recognition_type:type,message});if(error)throw error;status.textContent=type==="appreciation"?"Appreciation shared.":"Member of the month recorded.";await draw()}catch(err){status.textContent=err.message||"Recognition could not be saved."}finally{button.disabled=false}})};
  const appreciation=$("#gp-recognition-form"),award=$("#gp-award-form");if(appreciation)send(appreciation,"appreciation");if(award)send(award,"member_of_month");
  status.textContent="Showing this month’s recognition for "+(groupMap.get(circle)||"your group")+".";
 }
 select.addEventListener("change",draw);await draw();
}

async function create(){const form=$("#gp-create-form"),status=$("#gp-status");form.addEventListener("submit",async e=>{e.preventDefault();const user=await currentUser().catch(()=>null);if(!user){signIn();return}const d=new FormData(form),name=String(d.get("name")||"").trim(),visibility=String(d.get("visibility")||"public"),baseSlug=name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"community";const schema=await sb.from("podcast_community_circles").select("visibility,slug,cover_image_url").limit(1);const rich=!schema.error;if(!rich&&visibility!=="public"){status.textContent="Private and hidden groups unlock after the Phase 1 database upgrade. Choose Public for now.";return}const payload={owner_id:user.id,name,description:String(d.get("description")||"").trim(),category:categoryForDatabase(String(d.get("category"))),is_public:visibility==="public",community_rules:"Be respectful. Keep conversations constructive. Follow CrowRules community standards."};if(rich){payload.visibility=visibility;payload.cover_image_url=String(d.get("cover_image_url")||"").trim()||null;payload.slug=baseSlug+"-"+crypto.randomUUID().slice(0,8)}const btn=form.querySelector("button[type=submit]");btn.disabled=true;status.textContent="Creating your group…";try{const {data,error}=await sb.from("podcast_community_circles").insert(payload).select("id").single();if(error)throw error;const {error:memberError}=await sb.from("podcast_community_circle_members").insert({circle_id:data.id,member_id:user.id,role:"owner"});if(memberError)throw memberError;location.href=groupUrl(data.id)}catch(error){status.textContent=error.message||"Your group could not be created."}finally{btn.disabled=false}})}
async function community(){const root=$("#gp-community"),id=params.get("group");if(!id){root.innerHTML='<div class="gp-notice">No group was selected. <a class="gp-link" href="discover.html">Browse groups</a>.</div>';return}let result=await sb.from("podcast_community_circles").select("id,owner_id,name,description,category,is_public,is_featured,community_rules,visibility,slug,cover_image_url,group_chat_enabled").eq("id",id).maybeSingle();if(result.error)result=await sb.from("podcast_community_circles").select("id,owner_id,name,description,category,is_public,is_featured,community_rules,pinned_post_id,branch_key").eq("id",id).maybeSingle();const g=result.data,error=result.error;if(error||!g){root.innerHTML='<div class="gp-notice">This group could not be found or you do not have permission to view it.</div>';return}const user=await currentUser().catch(()=>null);let member=null;if(user){const m=await sb.from("podcast_community_circle_members").select("role").eq("circle_id",id).eq("member_id",user.id).maybeSingle();member=m.data||null}const vis=g.visibility||(g.is_public?"public":"hidden"),canManage=!!user&&(g.owner_id===user.id||["owner","moderator"].includes(member?.role));root.innerHTML='<section class="gp-community-cover" style="background-image:linear-gradient(90deg,#050505e8,#05050535),url(&quot;'+esc(cover(g))+'&quot;)"><span class="gp-kicker">'+esc(g.category||"COMMUNITY")+' · '+esc(vis.toUpperCase())+'</span><h1>'+esc(g.name)+'</h1><p>'+esc(g.description||"A place to connect and build together.")+'</p><div class="gp-actions">'+(member?'<span class="gp-button">Member · '+esc(member.role)+'</span>':!user?'<a class="gp-button" href="'+SITE_BASE+'login.html">Sign in to join</a>':vis==="public"?'<button class="gp-button" id="gp-join">Join group</button>':vis==="private"?'<button class="gp-button" id="gp-request">Request to join</button>':'<span class="gp-button ghost">Invitation only</span>')+'<a class="gp-button ghost" href="members.html?group='+encodeURIComponent(id)+(params.get("preview")==="1"?"&preview=1":"")+'">Members</a>'+(canManage?'<a class="gp-button ghost" href="settings.html?group='+encodeURIComponent(id)+(params.get("preview")==="1"?"&preview=1":"")+'">Group settings</a>':"")+'</div></section><div class="gp-detail-layout"><section class="gp-panel"><h2>Group discussion</h2>'+(member?'<form id="gp-post-form" class="gp-form"><label>Start a conversation<textarea name="body" maxlength="5000" required placeholder="What would you like to share?"></textarea></label><button class="gp-button" type="submit">Publish post</button></form>':'<p class="gp-muted">Join this group to publish posts and participate.</p>')+'<div id="gp-posts"></div></section><aside class="gp-panel"><h3>About this group</h3><p>'+esc(g.community_rules||"Be respectful and help make this a welcoming community.")+'</p></aside></div>';const posts=$("#gp-posts");const {data:list,error:postError}=await sb.from("podcast_community_circle_posts").select("id,author_id,body,created_at").eq("circle_id",id).order("created_at",{ascending:false}).limit(50);posts.innerHTML=postError?'<p class="gp-muted">Posts are unavailable right now.</p>':(list||[]).map(p=>'<article class="gp-post"><div class="gp-post-head"><b>Community member</b><time>'+new Date(p.created_at).toLocaleString()+'</time></div><p>'+esc(p.body)+'</p></article>').join("")||'<p class="gp-muted">No posts yet. Start the first conversation.</p>';$("#gp-join")?.addEventListener("click",async e=>{e.currentTarget.disabled=true;const {error}=await sb.from("podcast_community_circle_members").insert({circle_id:id,member_id:user.id,role:"member"});if(error&&error.code!=="23505"){alert(error.message);e.currentTarget.disabled=false}else location.reload()});$("#gp-request")?.addEventListener("click",async e=>{e.currentTarget.disabled=true;const {error}=await sb.from("podcast_community_circle_join_requests").insert({circle_id:id,user_id:user.id,status:"pending"});if(error){alert(error.message);e.currentTarget.disabled=false}else e.currentTarget.textContent="Request sent"});$("#gp-post-form")?.addEventListener("submit",async e=>{e.preventDefault();const body=String(new FormData(e.currentTarget).get("body")||"").trim();if(!body)return;const {error}=await sb.from("podcast_community_circle_posts").insert({circle_id:id,author_id:user.id,body});if(error)alert(error.message);else location.reload()})}
async function settings(){const id=params.get("group"),form=$("#gp-settings-form"),status=$("#gp-status");if(!id){status.textContent="Select a group before opening settings.";return}const user=await currentUser().catch(()=>null);if(!user){status.textContent="Sign in with your CrowRules account to manage a group.";return}let result=await sb.from("podcast_community_circles").select("id,owner_id,name,description,category,community_rules,visibility,cover_image_url,group_chat_enabled").eq("id",id).maybeSingle();let rich=!result.error;if(result.error)result=await sb.from("podcast_community_circles").select("id,owner_id,name,description,category,community_rules,is_public").eq("id",id).maybeSingle();const g=result.data;if(result.error||!g){status.textContent="Group not found or access denied.";return}const {data:membership}=await sb.from("podcast_community_circle_members").select("role").eq("circle_id",id).eq("member_id",user.id).maybeSingle();const allowed=g.owner_id===user.id||["owner","moderator"].includes(membership?.role);if(!allowed){status.textContent="Only this group's owner or an authorized moderator can manage settings.";return}form.hidden=false;form.elements.name.value=g.name||"";form.elements.category.value=g.category||categories[0];form.elements.description.value=g.description||"";form.elements.community_rules.value=g.community_rules||"";form.elements.visibility.value=g.visibility||(g.is_public?"public":"hidden");form.elements.cover_image_url.value=g.cover_image_url||"";form.elements.group_chat_enabled.checked=!!g.group_chat_enabled;if(!rich){form.elements.visibility.disabled=true;form.elements.cover_image_url.disabled=true;form.elements.group_chat_enabled.disabled=true;status.textContent="Legacy schema detected. Basic group details can be edited; advanced privacy and media settings unlock after the reviewed Phase 1 migration."}form.addEventListener("submit",async e=>{e.preventDefault();const d=new FormData(form),patch={name:String(d.get("name")||"").trim(),category:String(d.get("category")||""),description:String(d.get("description")||"").trim(),community_rules:String(d.get("community_rules")||"").trim()};if(rich){patch.visibility=String(d.get("visibility")||"public");patch.cover_image_url=String(d.get("cover_image_url")||"").trim()||null;patch.group_chat_enabled=form.elements.group_chat_enabled.checked}const button=form.querySelector("button[type=submit]");button.disabled=true;status.textContent="Saving group settings…";try{const {error}=await sb.from("podcast_community_circles").update(patch).eq("id",id);if(error)throw error;status.textContent="Group settings saved."; }catch(error){status.textContent=error.message||"Settings could not be saved."}finally{button.disabled=false}})}
async function members(){
 const id=params.get("group"),root=$("#gp-results"),status=$("#gp-status");
 if(!id){status.textContent="Choose a group to view its member directory.";return}
 const user=await currentUser().catch(()=>null);
 if(!user){status.innerHTML='<a class="gp-link" href="'+SITE_BASE+'login.html">Sign in</a> to continue.';return}
 const {data:mine,error:mineError}=await sb.from("podcast_community_circle_members").select("circle_id,role").eq("circle_id",id).eq("member_id",user.id).maybeSingle();
 if(mineError){status.textContent="Your group access could not be checked: "+mineError.message;return}
 if(!mine){status.textContent="Join this group to access its member directory.";return}
 if(!["owner","moderator"].includes(mine.role)){
  status.textContent="The full member roster is available to group owners and moderators. Your membership is confirmed, but the existing privacy rules do not allow member-wide roster access.";
  root.innerHTML='<div class="gp-notice">You can still participate in the group community, discussions, events and collaborations.</div>';
  return;
 }
 const {data,error}=await sb.from("podcast_community_circle_members").select("member_id,role,joined_at").eq("circle_id",id).order("joined_at",{ascending:true}).limit(100);
 if(error){status.textContent="The member roster could not be loaded: "+error.message;return}
 const ids=(data||[]).map(x=>x.member_id);
 let profiles=[],profileError=null;
 if(ids.length){const result=await sb.from("crowrules_public_profiles").select("user_id,display_name,username,avatar_url").in("user_id",ids);profiles=result.data||[];profileError=result.error}
 if(profileError){status.textContent="Roster loaded, but public profile details are unavailable: "+profileError.message}
 const map=new Map(profiles.map(p=>[p.user_id,p]));
 const cards=(data||[]).map(m=>{const p=map.get(m.member_id)||{};const name=p.display_name||p.username||"Private member";const safeAvatar=/^https:\/\//i.test(String(p.avatar_url||""))?p.avatar_url:"";const avatar=safeAvatar?'<img src="'+esc(safeAvatar)+'" alt="" loading="lazy">':'<span class="gp-member-avatar-fallback" aria-hidden="true">'+esc(name.slice(0,1).toUpperCase())+'</span>';return '<article class="gp-member"><div class="gp-member-avatar">'+avatar+'</div><div class="gp-member-details"><b>'+esc(name)+'</b>'+(p.username?'<small>@'+esc(p.username)+'</small>':'')+'<small>'+esc(m.role||"member")+' · Joined '+esc(m.joined_at?new Date(m.joined_at).toLocaleDateString():"date unavailable")+'</small></div></article>'}).join("");
 root.innerHTML='<div class="gp-member-directory-note">Roster access is limited to this group’s owners and moderators. Private or unavailable profiles are not exposed.</div>'+(cards?'<div class="gp-member-directory-grid">'+cards+'</div>':'<div class="gp-notice">No members to display.</div>');
 status.textContent="Showing up to 100 members. Member roles and profile visibility follow existing database policies.";
}
function pacificToday(){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));return v.year+"-"+v.month+"-"+v.day}
function launchGate(page){if(page==="home"||pacificToday()>="2026-12-01"||params.get("preview")==="1")return false;const main=document.querySelector("main");if(main)main.innerHTML="<section class='gp-launch'><span class='gp-kicker'>A NEW WAY TO CONNECT</span><h1>Find your people.<br><em>Build together.</em></h1><p>CrowRules Groups opens December 1, 2026 (Pacific). Public visitors will be able to explore public communities; a CrowRules Podcasting account will be required to join and participate.</p><div class='gp-launch-date'>PUBLIC LAUNCH · DECEMBER 1, 2026</div></section>";return true}
function mountCountdown(){const root=$("#gp-countdown");if(!root)return;const target=Date.parse(root.dataset.target);const fields={days:root.querySelector("[data-days]"),hours:root.querySelector("[data-hours]"),minutes:root.querySelector("[data-minutes]"),seconds:root.querySelector("[data-seconds]")};const note=$("#gp-countdown-note");const tick=()=>{const left=Math.max(0,target-Date.now()),total=Math.floor(left/1000);fields.days.textContent=String(Math.floor(total/86400)).padStart(2,"0");fields.hours.textContent=String(Math.floor(total%86400/3600)).padStart(2,"0");fields.minutes.textContent=String(Math.floor(total%3600/60)).padStart(2,"0");fields.seconds.textContent=String(total%60).padStart(2,"0");if(left===0){note.textContent="Groups 2.0 is now open. Explore communities and join the conversation.";root.setAttribute("aria-label","Groups 2.0 is now live");}};tick();setInterval(tick,1000)}
function decoratePreviewLinks(){if(params.get("preview")!=="1")return;document.querySelectorAll("a[href]").forEach(a=>{try{const u=new URL(a.href,location.href);if(u.origin===location.origin&&u.pathname.includes("/groups/")&&!u.searchParams.has("preview")){u.searchParams.set("preview","1");a.href=u.pathname+u.search+u.hash}}catch{}})}

function eventDate(value, options={}){return value?new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short",...options}).format(new Date(value)):"Time to be announced"}
function safeEventUrl(value){const s=String(value||"").trim();return /^https:\/\/[^\s]+$/i.test(s)?s:""}
function eventTypeLabel(value){return ({meetup:"Meetup",listening_party:"Listening party",ama:"Ask me anything",livestream:"Livestream",other:"Community event"})[value]||"Community event"}
async function eventsPage(){
 const root=$("#gp-events"),status=$("#gp-status"),createRoot=$("#gp-event-create");
 const archiveView=params.get("view")==="past";
 const searchTerm=(params.get("q")||"").trim().slice(0,80),requestedType=params.get("type")||"";
 const allowedTypes=["meetup","listening_party","ama","livestream","other"],typeFilter=allowedTypes.includes(requestedType)?requestedType:"";
 const viewUrl=view=>{const q=new URLSearchParams();if(selectedGroup)q.set("group",selectedGroup);if(view==="past")q.set("view","past");return "events.html"+(q.toString()?"?"+q.toString():"")};
 const viewNav=()=>'<nav class="gp-event-view-switch" aria-label="Event views"><a href="'+esc(viewUrl("upcoming"))+'" '+(!archiveView?'aria-current="page"':'')+'>Upcoming events</a><a href="'+esc(viewUrl("past"))+'" '+(archiveView?'aria-current="page"':'')+'>Past events</a></nav><form class="gp-event-filters" method="get" action="events.html">'+(selectedGroup?'<input type="hidden" name="group" value="'+esc(selectedGroup)+'">':'')+(archiveView?'<input type="hidden" name="view" value="past">':'')+'<label class="gp-event-search-label">Search events<input type="search" name="q" maxlength="80" value="'+esc(searchTerm)+'" placeholder="Search titles and descriptions"></label><label>Event type<select name="type"><option value="">All event types</option><option value="meetup" '+(typeFilter==="meetup"?"selected":"")+'>Meetups</option><option value="listening_party" '+(typeFilter==="listening_party"?"selected":"")+'>Listening parties</option><option value="ama" '+(typeFilter==="ama"?"selected":"")+'>Ask me anything</option><option value="livestream" '+(typeFilter==="livestream"?"selected":"")+'>Livestreams</option><option value="other" '+(typeFilter==="other"?"selected":"")+'>Other</option></select></label><button class="gp-button ghost" type="submit">Filter events</button>'+(searchTerm||typeFilter?'<a class="gp-link" href="'+esc(viewUrl(archiveView?"past":"upcoming"))+'">Clear filters</a>':'')+'</form>';
 const sectionTitle=$(".gp-events-section h2");if(sectionTitle)sectionTitle.textContent=archiveView?"Past events":"Upcoming events";
 const sectionDescription=$(".gp-events-section .gp-muted");if(sectionDescription)sectionDescription.textContent=archiveView?"A look back at meetups, listening parties, livestreams and conversations from your communities.":"Events from groups you can access appear here. Cancelled events remain visible for clarity.";
 if(!root)return;
 const user=await currentUser().catch(()=>null),selectedGroup=params.get("group");
 let managed=[];
 if(user){
  const {data:members}=await sb.from("podcast_community_circle_members").select("circle_id,role").eq("member_id",user.id).in("role",["owner","moderator"]);
  const memberships=members||[];
  if(memberships.length){
   const {data:groups}=await sb.from("podcast_community_circles").select("id,name").in("id",memberships.map(x=>x.circle_id));
   const names=new Map((groups||[]).map(g=>[g.id,g.name]));
   managed=memberships.map(m=>({id:m.circle_id,name:names.get(m.circle_id)||"Your group"})).filter(g=>names.has(g.id));
  }
 }
 if(createRoot){
  if(!user){createRoot.innerHTML='<div class="gp-notice">Sign in to create events for a group you manage. <a class="gp-link" href="'+SITE_BASE+'login.html">Sign in</a></div>'}
  else if(!managed.length){createRoot.innerHTML='<p class="gp-muted">Event creation is available to group owners and moderators. Join or create a group, or ask a group moderator to add an event.</p>'}
  else{
   createRoot.innerHTML='<form id="gp-event-form" class="gp-form gp-event-form"><label>Group<select name="circle_id" required>'+managed.map(g=>'<option value="'+esc(g.id)+'" '+(selectedGroup===g.id?'selected':'')+'>'+esc(g.name)+'</option>').join("")+'</select></label><label>Event title<input name="title" required minlength="3" maxlength="120" placeholder="Give your event a name"></label><label>Event type<select name="event_type"><option value="meetup">Meetup</option><option value="listening_party">Listening party</option><option value="ama">Ask me anything</option><option value="livestream">Livestream</option><option value="other">Other</option></select></label><label>Description<textarea name="description" maxlength="3000" placeholder="What should members know?"></textarea></label><div class="gp-event-two"><label>Starts<input name="starts_at" type="datetime-local" required></label><label>Ends (optional)<input name="ends_at" type="datetime-local"></label></div><label>Location type<select name="location_type"><option value="online">Online</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option></select></label><label>Location or venue<input name="location_text" maxlength="300" placeholder="Meeting room, venue, or online"></label><label>Meeting link (optional)<input name="meeting_url" type="url" maxlength="1000" placeholder="https://…"></label><label>Related episode link (optional)<input name="episode_url" type="url" maxlength="1000" placeholder="https://…"></label><button class="gp-button" type="submit">Create group event</button><p class="gp-help">Only owners and moderators can create events. Events are visible according to the group’s existing visibility and membership rules.</p></form>';
   $("#gp-event-form")?.addEventListener("submit",async e=>{
    e.preventDefault();const form=e.currentTarget,d=new FormData(form),startValue=String(d.get("starts_at")||""),endValue=String(d.get("ends_at")||"");
    const starts=new Date(startValue),ends=endValue?new Date(endValue):null;
    if(!Number.isFinite(starts.getTime())||(ends&&(!Number.isFinite(ends.getTime())||ends<=starts))){status.textContent="Please check the event dates. The end must be after the start.";return}
    const meeting=String(d.get("meeting_url")||"").trim(),episode=String(d.get("episode_url")||"").trim();
    if((meeting&&!safeEventUrl(meeting))||(episode&&!safeEventUrl(episode))){status.textContent="Links must use https://";return}
    const button=form.querySelector('button[type="submit"]');button.disabled=true;status.textContent="Creating event…";
    try{
     const {error}=await sb.from("podcast_community_circle_events").insert({circle_id:String(d.get("circle_id")),creator_id:user.id,title:String(d.get("title")||"").trim(),description:String(d.get("description")||"").trim(),event_type:String(d.get("event_type")||"meetup"),starts_at:starts.toISOString(),ends_at:ends?ends.toISOString():null,location_type:String(d.get("location_type")||"online"),location_text:String(d.get("location_text")||"").trim(),meeting_url:meeting,episode_url:episode,status:"scheduled",branch_key:"community"});
     if(error)throw error;status.textContent="Event created.";form.reset();await drawEvents();
    }catch(error){status.textContent=error.message||"The event could not be created."}
    finally{button.disabled=false}
   });
  }
 }
 async function drawEvents(){
  root.innerHTML='<p class="gp-muted">Loading group events…</p>';
  let query=sb.from("podcast_community_circle_events").select("id,circle_id,creator_id,title,description,event_type,starts_at,ends_at,location_type,location_text,meeting_url,episode_url,status,created_at,branch_key");
  query=archiveView?query.lt("starts_at",new Date().toISOString()).order("starts_at",{ascending:false}).limit(100):query.gte("starts_at",new Date().toISOString()).order("starts_at",{ascending:true}).limit(100);
  if(selectedGroup)query=query.eq("circle_id",selectedGroup);
  const {data:allEvents,error}=await query;
  if(error){root.innerHTML='<div class="gp-notice">Events could not be loaded: '+esc(error.message)+'</div>';return}
  const needle=searchTerm.toLocaleLowerCase();
  const events=(allEvents||[]).filter(ev=>(!typeFilter||ev.event_type===typeFilter)&&(!needle||((ev.title||"")+" "+(ev.description||"")).toLocaleLowerCase().includes(needle)));
  if(!events.length){root.innerHTML=viewNav()+'<div class="gp-event-empty"><span class="gp-event-empty-icon">◷</span><h2>'+(searchTerm||typeFilter?"No matching events":"No group events scheduled yet")+'</h2><p>'+(searchTerm||typeFilter?"Try changing your search or event type filter.":archiveView?"Completed community events will appear here after your groups have hosted them.":"When a group owner or moderator schedules a meetup, listening party, livestream or community event, it will appear here.")+'</p>'+(searchTerm||typeFilter?'<a class="gp-button ghost" href="'+esc(viewUrl(archiveView?"past":"upcoming"))+'">Clear filters</a>':'<a class="gp-button ghost" href="discover.html">Explore groups</a>')+'</div>';return}
  const circleIds=[...new Set(events.map(e=>e.circle_id))];
  const [{data:groups},{data:members}]=await Promise.all([
   sb.from("podcast_community_circles").select("id,name").in("id",circleIds),
   user?sb.from("podcast_community_circle_members").select("circle_id,role").eq("member_id",user.id).in("circle_id",circleIds):Promise.resolve({data:[]})
  ]);
  const groupNames=new Map((groups||[]).map(g=>[g.id,g.name])),roles=new Map((members||[]).map(m=>[m.circle_id,m.role]));
  let rsvps=[];
  if(user){const result=await sb.from("podcast_community_circle_event_rsvps").select("event_id,user_id,response").in("event_id",events.map(e=>e.id));if(!result.error)rsvps=result.data||[]}
  const counts=new Map(),mine=new Map();
  rsvps.forEach(r=>{const c=counts.get(r.event_id)||{going:0,interested:0};if(r.response==="going"||r.response==="interested")c[r.response]++;counts.set(r.event_id,c);if(r.user_id===user?.id)mine.set(r.event_id,r.response)});
  root.innerHTML=viewNav()+events.map(ev=>{
   const role=roles.get(ev.circle_id),canManage=["owner","moderator"].includes(role),response=mine.get(ev.id),count=counts.get(ev.id)||{going:0,interested:0},meeting=safeEventUrl(ev.meeting_url),episode=safeEventUrl(ev.episode_url),cancelled=ev.status==="cancelled",isPast=new Date(ev.starts_at)<new Date();
   return '<article class="gp-event-card '+(cancelled?'is-cancelled':'')+'"><div class="gp-event-date"><b>'+esc(new Intl.DateTimeFormat(undefined,{month:"short",day:"2-digit"}).format(new Date(ev.starts_at)))+'</b><small>'+esc(new Intl.DateTimeFormat(undefined,{weekday:"short"}).format(new Date(ev.starts_at)))+'</small></div><div class="gp-event-body"><div class="gp-event-meta"><span>'+esc(eventTypeLabel(ev.event_type))+'</span><span>'+esc(groupNames.get(ev.circle_id)||"Group event")+'</span><span class="gp-event-status">'+(cancelled?"Cancelled":isPast?"Completed":"Scheduled")+'</span></div><h2>'+esc(ev.title)+'</h2><p class="gp-event-description">'+esc(ev.description||"Join your group for this community event.")+'</p><div class="gp-event-facts"><span>◷ '+esc(eventDate(ev.starts_at))+(ev.ends_at?' – '+esc(eventDate(ev.ends_at,{dateStyle:"short"})):"")+'</span><span>⌖ '+esc(ev.location_type==="online"?"Online":ev.location_type==="hybrid"?"Hybrid · "+(ev.location_text||"Details to follow"):ev.location_text||"In person")+'</span></div>'+(meeting?'<a class="gp-link gp-event-link" href="'+esc(meeting)+'" target="_blank" rel="noopener noreferrer">Open meeting link ↗</a>':"")+(episode?'<a class="gp-link gp-event-link" href="'+esc(episode)+'" target="_blank" rel="noopener noreferrer">Related episode ↗</a>':"")+'<div class="gp-event-actions">'+(cancelled?'<span class="gp-muted">This event has been cancelled.</span>':isPast?'<span class="gp-muted">This event has ended. RSVPs are closed.</span>':!user?'<a class="gp-button ghost" href="'+SITE_BASE+'login.html">Sign in to RSVP</a>':!role?'<span class="gp-muted">Join this group to RSVP.</span>':'<button class="gp-button '+(response==="going"?"":"ghost")+'" data-rsvp="going" data-event="'+esc(ev.id)+'">'+(response==="going"?"✓ Going":"Going")+'</button><button class="gp-button '+(response==="interested"?"":"ghost")+'" data-rsvp="interested" data-event="'+esc(ev.id)+'">'+(response==="interested"?"✓ Interested":"Interested")+'</button><button class="gp-button ghost" data-rsvp="declined" data-event="'+esc(ev.id)+'">'+(response==="declined"?"✓ Not attending":"Can’t attend")+'</button>')+(role?'<span class="gp-event-counts">'+count.going+' going · '+count.interested+' interested</span>':"")+(canManage&&!cancelled&&!isPast?'<button class="gp-button ghost gp-event-cancel" data-cancel="'+esc(ev.id)+'">Cancel event</button>':"")+'</div></div></article>';
  }).join("");
  root.querySelectorAll("[data-rsvp]").forEach(button=>button.addEventListener("click",async()=>{
   if(!user){signIn();return}const eventId=button.dataset.event,response=button.dataset.rsvp;button.disabled=true;
   try{const {error}=await sb.from("podcast_community_circle_event_rsvps").upsert({event_id:eventId,user_id:user.id,response},{onConflict:"event_id,user_id"});if(error)throw error;status.textContent=response==="declined"?"Your RSVP was updated.":"Your RSVP is saved.";await drawEvents()}catch(error){status.textContent=error.message||"Your RSVP could not be saved.";button.disabled=false}
  }));
  root.querySelectorAll("[data-cancel]").forEach(button=>button.addEventListener("click",async()=>{
   if(!confirm("Cancel this group event? Existing RSVPs will be retained."))return;button.disabled=true;
   try{const {error}=await sb.from("podcast_community_circle_events").update({status:"cancelled"}).eq("id",button.dataset.cancel);if(error)throw error;status.textContent="Event cancelled. Existing RSVPs were retained.";await drawEvents()}catch(error){status.textContent=error.message||"The event could not be cancelled.";button.disabled=false}
  }));
 }
 await drawEvents();
}


async function notifications(){
 const root=$("#gp-notification-settings"),status=$("#gp-status");
 if(!root)return;
 const user=await currentUser().catch(()=>null);
 if(!user){status.textContent="Sign in to manage your group notification preferences.";root.innerHTML='<a class="gp-button" href="'+SITE_BASE+'login.html">Sign in to continue</a>';return}
 status.textContent="Loading your notification preferences…";
 const fields=["invitation_alerts","discussion_alerts","reply_alerts","moderation_alerts"];
 const labels={invitation_alerts:["Group invitations","When someone invites you to join a group."],discussion_alerts:["Group discussions","Updates about new discussions in your groups."],reply_alerts:["Replies and conversations","When someone replies to your posts or conversations."],moderation_alerts:["Moderation updates","Updates about moderation activity in groups you manage."]};
 let result=await sb.from("podcast_community_circle_notification_preferences").select("user_id,invitation_alerts,discussion_alerts,reply_alerts,moderation_alerts").eq("user_id",user.id).maybeSingle();
 if(result.error){status.textContent="Notification preferences are unavailable: "+result.error.message;return}
 const values=Object.fromEntries(fields.map(key=>[key,result.data?!!result.data[key]:true]));
 root.innerHTML='<form id="gp-notification-form" class="gp-panel gp-form"><h2>Choose your group updates</h2><p class="gp-muted">These settings control your group notification preferences. They do not create an in-app notification inbox or change email marketing subscriptions.</p>'+fields.map(key=>'<label class="gp-notification-option"><span><b>'+labels[key][0]+'</b><small>'+labels[key][1]+'</small></span><input type="checkbox" name="'+key+'" '+(values[key]?"checked":"")+'></label>').join("")+'<button class="gp-button" type="submit">Save preferences</button><p class="gp-help" id="gp-notification-save" role="status" aria-live="polite"></p></form>';
 const form=$("#gp-notification-form");
 form.addEventListener("submit",async event=>{
  event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;const patch=Object.fromEntries(fields.map(key=>[key,form.elements[key].checked]));patch.user_id=user.id;patch.updated_at=new Date().toISOString();
  try{
   const write=result.data
    ? await sb.from("podcast_community_circle_notification_preferences").update(patch).eq("user_id",user.id)
    : await sb.from("podcast_community_circle_notification_preferences").insert(patch);
   if(write.error)throw write.error;
   result.data={...patch};$("#gp-notification-save").textContent="Your preferences have been saved.";status.textContent="Preferences updated.";
  }catch(error){$("#gp-notification-save").textContent=error.message||"Preferences could not be saved."}
  finally{button.disabled=false}
 });
 status.textContent="Manage the group updates you want to receive.";
}


async function imageModerationPage(){
 const root=$("#gp-image-moderation"),status=$("#gp-status");
 if(!root)return;
 const user=await currentUser().catch(()=>null);
 if(!user){status.textContent="Sign in to review group image suggestions.";root.innerHTML='<a class="gp-button" href="'+SITE_BASE+'login.html">Sign in to continue</a>';return}
 const {data:members,error:mError}=await sb.from("podcast_community_circle_members").select("circle_id,role").eq("member_id",user.id).in("role",["owner","moderator"]);
 if(mError){status.textContent="Your moderation access could not be checked: "+mError.message;return}
 const ids=(members||[]).map(x=>x.circle_id);
 if(!ids.length){status.textContent="No groups with moderator or owner access were found.";root.innerHTML='<div class="gp-notice">Image suggestions can be reviewed by group owners and moderators.</div>';return}
 const [{data:groups,error:gError},{data:suggestions,error:sError}]=await Promise.all([
  sb.from("podcast_community_circles").select("id,name").in("id",ids).order("name"),
  sb.from("podcast_community_circle_image_suggestions").select("id,circle_id,submitted_by,image_kind,object_path,status,created_at,reviewed_at").in("circle_id",ids).order("created_at",{ascending:false}).limit(100)
 ]);
 if(gError){status.textContent="Groups could not be loaded: "+gError.message;return}
 if(sError){status.textContent="Image suggestions could not be loaded: "+sError.message;return}
 const groupMap=new Map((groups||[]).map(g=>[g.id,g]));
 const requested=params.get("group"),initial=ids.includes(requested)?requested:"all";
 root.innerHTML='<div class="gp-image-mod-toolbar"><label>Group<select id="gp-image-group"><option value="all">All groups</option>'+(groups||[]).map(g=>'<option value="'+esc(g.id)+'" '+(g.id===initial?'selected':'')+'>'+esc(g.name)+'</option>').join("")+'</select></label><label>Status<select id="gp-image-status"><option value="pending">Pending review</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option><option value="all">All suggestions</option></select></label></div><div id="gp-image-list" class="gp-image-list"></div>';
 const groupSelect=$("#gp-image-group"),statusSelect=$("#gp-image-status"),list=$("#gp-image-list");
 const draw=async()=>{
  const groupId=groupSelect.value,filter=statusSelect.value;
  const rows=(suggestions||[]).filter(x=>(groupId==="all"||x.circle_id===groupId)&&(filter==="all"||x.status===filter));
  if(!rows.length){list.innerHTML='<div class="gp-notice">No image suggestions match this filter.</div>';return}
  list.innerHTML="";
  for(const item of rows){
   const card=document.createElement("article");card.className="gp-image-suggestion";
   const title=document.createElement("div");title.className="gp-image-suggestion-heading";
   const heading=document.createElement("strong");heading.textContent=(item.image_kind==="avatar"?"Group avatar":"Group banner")+" · "+(groupMap.get(item.circle_id)?.name||"Group");
   const state=document.createElement("span");state.className="gp-image-state";state.textContent=item.status;
   title.append(heading,state);card.append(title);
   const meta=document.createElement("p");meta.className="gp-image-meta";meta.textContent="Submitted "+new Date(item.created_at).toLocaleString();card.append(meta);
   if(typeof item.object_path==="string"&&item.object_path.startsWith(item.circle_id+"/"+item.submitted_by+"/")){
    const {data:signed,error:signedError}=await sb.storage.from("podcast-group-media").createSignedUrl(item.object_path,300);
    if(!signedError&&signed?.signedUrl){const img=document.createElement("img");img.className="gp-image-preview";img.src=signed.signedUrl;img.alt=item.image_kind==="avatar"?"Suggested group avatar":"Suggested group banner";img.loading="lazy";card.append(img)}
    else{const note=document.createElement("p");note.className="gp-image-meta";note.textContent="Preview is unavailable under the current storage access rules.";card.append(note)}
   }else{const note=document.createElement("p");note.className="gp-image-meta";note.textContent="The stored image path did not match the expected group/member path; preview withheld.";card.append(note)}
   if(item.status==="pending"){
    const actions=document.createElement("div");actions.className="gp-image-actions";
    const reject=document.createElement("button");reject.type="button";reject.className="gp-button danger";reject.textContent="Reject suggestion";
    reject.addEventListener("click",async()=>{reject.disabled=true;status.textContent="Recording moderation decision…";const {error}=await sb.from("podcast_community_circle_image_suggestions").update({status:"rejected",reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",item.id).eq("status","pending");if(error){status.textContent="The suggestion could not be rejected: "+error.message;reject.disabled=false;return}item.status="rejected";item.reviewed_by=user.id;item.reviewed_at=new Date().toISOString();status.textContent="Suggestion marked rejected. The current group image was not changed.";await draw()});
    actions.append(reject);card.append(actions);
   }
   list.append(card);
  }
 };
 groupSelect.addEventListener("change",draw);statusSelect.addEventListener("change",draw);
 await draw();
 status.textContent="Reviewing image suggestions for groups you moderate. Rejection is supported; approval and applying images are not available under the current database policies.";
}

async function reportsPage(){
 const root=$("#gp-reports"),status=$("#gp-status");
 if(!root)return;
 const user=await currentUser().catch(()=>null);
 if(!user){status.textContent="Sign in to review group reports.";root.innerHTML='<a class="gp-button" href="'+SITE_BASE+'login.html">Sign in to continue</a>';return}
 const {data:members,error:mError}=await sb.from("podcast_community_circle_members").select("circle_id,role").eq("member_id",user.id).in("role",["owner","moderator"]);
 if(mError){status.textContent="Your moderation access could not be checked: "+mError.message;return}
 const memberships=members||[],ids=memberships.map(x=>x.circle_id);
 if(!ids.length){status.textContent="No groups with moderator or owner access were found for this account.";root.innerHTML='<div class="gp-notice">Group report queues are available to group owners and moderators.</div>';return}
 const {data:groups,error:gError}=await sb.from("podcast_community_circles").select("id,name").in("id",ids).order("name");
 if(gError){status.textContent=gError.message;return}
 const list=groups||[],requested=params.get("group"),initial=ids.includes(requested)?requested:(list[0]?.id||"");
 root.innerHTML='<div class="gp-report-toolbar"><label>Moderate group<select id="gp-report-group">'+list.map(g=>'<option value="'+esc(g.id)+'" '+(g.id===initial?'selected':'')+'>'+esc(g.name)+'</option>').join("")+'</select></label><label>Queue<select id="gp-report-status"><option value="open">Open reports</option><option value="closed">Closed reports</option><option value="all">All reports</option></select></label></div><div id="gp-report-list" class="gp-report-list"></div>';
 const groupSelect=$("#gp-report-group"),filter=$("#gp-report-status"),listRoot=$("#gp-report-list");
 if(requested&&requested===initial)filter.value=params.get("status")==="closed"?"closed":params.get("status")==="all"?"all":"open";
 async function draw(){
  const circleId=groupSelect.value,queue=filter.value;status.textContent="Loading report queue…";listRoot.innerHTML="";
  let query=sb.from("podcast_community_circle_reports").select("id,circle_id,post_id,reported_by,reason,status,created_at,reviewed_by,reviewed_at").eq("circle_id",circleId).order("created_at",{ascending:false}).limit(100);
  if(queue!=="all")query=query.eq("status",queue);
  const {data:reports,error}=await query;
  if(error){status.textContent="Reports could not be loaded: "+error.message;return}
  const rows=reports||[],postIds=[...new Set(rows.map(x=>x.post_id).filter(Boolean))],profileIds=[...new Set(rows.map(x=>x.reported_by).filter(Boolean))];
  const [{data:posts},{data:profiles}]=await Promise.all([
   postIds.length?sb.from("podcast_community_circle_posts").select("id,body,post_type,deleted_at,created_at").in("id",postIds):Promise.resolve({data:[]}),
   profileIds.length?sb.from("crowrules_public_profiles").select("user_id,display_name,username").in("user_id",profileIds):Promise.resolve({data:[]})
  ]);
  const postMap=new Map((posts||[]).map(x=>[x.id,x])),profileMap=new Map((profiles||[]).map(x=>[x.user_id,x]));
  listRoot.innerHTML=rows.map(report=>{
   const post=postMap.get(report.post_id),person=profileMap.get(report.reported_by)||{},reporter=person.display_name||person.username||"Member";
   const postText=!report.post_id?"The reported post is no longer available.":!post||post.deleted_at?"The reported post has been deleted or is unavailable.":post.body;
   return '<article class="gp-report-card"><div class="gp-report-head"><span class="gp-kicker">REPORTED '+esc(new Date(report.created_at).toLocaleString())+'</span><span class="gp-report-state state-'+esc(report.status)+'">'+esc(report.status)+'</span></div><p class="gp-report-reason">'+esc(report.reason)+'</p><div class="gp-report-post"><b>Reported content</b><p>'+esc(postText||"No post text was available.")+'</p></div><p class="gp-muted">Reported by '+esc(reporter)+'</p>'+(report.status==="open"?'<button class="gp-button gp-report-close" type="button" data-id="'+esc(report.id)+'">Close report</button>':'<p class="gp-muted">Reviewed '+(report.reviewed_at?esc(new Date(report.reviewed_at).toLocaleString()):"")+'</p>')+'</article>';
  }).join("")||'<div class="gp-notice">No '+(queue==="all"?"":queue+" ")+'reports in this group.</div>';
  status.textContent=rows.length+" report(s) in this queue.";
  listRoot.querySelectorAll(".gp-report-close").forEach(button=>button.addEventListener("click",async()=>{
   if(!confirm("Close this report? This records the moderation review; it does not delete or edit the reported post."))return;
   button.disabled=true;status.textContent="Closing report…";
   const {error}=await sb.from("podcast_community_circle_reports").update({status:"closed",reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",button.dataset.id).eq("circle_id",circleId).eq("status","open");
   if(error){status.textContent="The report could not be closed: "+error.message;button.disabled=false;return}
   status.textContent="Report closed.";await draw();
  }));
 }
 groupSelect.addEventListener("change",draw);filter.addEventListener("change",draw);await draw();
}


async function invitationsPage(){
 const root=$("#gp-invitations"),status=$("#gp-status");
 if(!root)return;
 const user=await currentUser().catch(()=>null);
 if(!user){status.textContent="Sign in to manage group invitations.";root.innerHTML='<div class="gp-notice"><a class="gp-link" href="'+SITE_BASE+'login.html">Sign in</a> to view invitations sent to you or by you.</div>';return}
 status.textContent="Loading your invitations…";
 const {data:rows,error}=await sb.from("podcast_community_circle_invites").select("id,circle_id,inviter_id,invitee_id,status,created_at,responded_at").or("invitee_id.eq."+user.id+",inviter_id.eq."+user.id).order("created_at",{ascending:false}).limit(100);
 if(error){status.textContent="Invitations could not be loaded: "+error.message;return}
 const invites=rows||[],groupIds=[...new Set(invites.map(x=>x.circle_id))],profileIds=[...new Set(invites.flatMap(x=>[x.inviter_id,x.invitee_id]))];
 const [{data:groups},{data:profiles}]=await Promise.all([
  groupIds.length?sb.from("podcast_community_circles").select("id,name").in("id",groupIds):Promise.resolve({data:[]}),
  profileIds.length?sb.from("crowrules_public_profiles").select("user_id,display_name,username,avatar_url").in("user_id",profileIds):Promise.resolve({data:[]})
 ]);
 const groupNames=new Map((groups||[]).map(x=>[x.id,x.name])),profileMap=new Map((profiles||[]).map(x=>[x.user_id,x]));
 const person=id=>{const p=profileMap.get(id)||{};return p.display_name||p.username||"CrowRules member"};
 const renderSection=(title,items,kind)=>'<section class="gp-invite-section"><h2>'+title+'</h2>'+(!items.length?'<p class="gp-muted">Nothing here right now.</p>':items.map(inv=>{const incoming=kind==="incoming",pending=inv.status==="pending",other=incoming?inv.inviter_id:inv.invitee_id;return '<article class="gp-invite-card"><div><span class="gp-kicker">'+(incoming?"Invited by ":"Sent to ")+esc(person(other))+'</span><h3>'+esc(groupNames.get(inv.circle_id)||"Group invitation")+'</h3><p class="gp-muted">'+esc(new Date(inv.created_at).toLocaleString())+'</p></div><span class="gp-invite-status status-'+esc(inv.status)+'">'+esc(inv.status)+'</span>'+(pending&&incoming?'<div class="gp-invite-actions"><button type="button" class="gp-button gp-invite-respond" data-id="'+esc(inv.id)+'" data-response="accepted">Accept invitation</button><button type="button" class="gp-button ghost gp-invite-respond" data-id="'+esc(inv.id)+'" data-response="declined">Decline</button></div>':pending&&!incoming?'<div class="gp-invite-actions"><button type="button" class="gp-button ghost gp-invite-cancel" data-id="'+esc(inv.id)+'">Cancel invitation</button></div>':"")+'</article>'}).join(""))+'</section>';
 root.innerHTML=renderSection("Invitations to you",invites.filter(x=>x.invitee_id===user.id),"incoming")+renderSection("Invitations you sent",invites.filter(x=>x.inviter_id===user.id),"outgoing");
 root.querySelectorAll(".gp-invite-respond").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;status.textContent="Updating invitation…";const {error}=await sb.from("podcast_community_circle_invites").update({status:button.dataset.response,responded_at:new Date().toISOString()}).eq("id",button.dataset.id).eq("invitee_id",user.id).eq("status","pending");if(error){status.textContent=error.message||"Your response could not be saved.";button.disabled=false;return}status.textContent=button.dataset.response==="accepted"?"Your acceptance was recorded. Group membership access is managed separately.":"Invitation declined.";await invitationsPage()}));
 root.querySelectorAll(".gp-invite-cancel").forEach(button=>button.addEventListener("click",async()=>{if(!confirm("Cancel this invitation?"))return;button.disabled=true;const {error}=await sb.from("podcast_community_circle_invites").delete().eq("id",button.dataset.id).eq("inviter_id",user.id).eq("status","pending");if(error){status.textContent=error.message||"The invitation could not be cancelled.";button.disabled=false;return}status.textContent="Invitation cancelled.";await invitationsPage()}));
 status.textContent=invites.length?invites.length+" invitation record(s) loaded.":"No group invitations yet.";
}


async function collaborationsPage(){
 const root=$("#gp-collaborations"),status=$("#gp-status"),formRoot=$("#gp-collaboration-create");
 const user=await currentUser().catch(()=>null);
 if(!user){status.textContent="Sign in to take part in group collaborations.";root.innerHTML='<div class="gp-notice"><a class="gp-link" href="'+SITE_BASE+'login.html">Sign in</a> to view your group collaboration workspace.</div>';formRoot.innerHTML="";return}
 const {data:members,error:mError}=await sb.from("podcast_community_circle_members").select("circle_id,role").eq("member_id",user.id);
 if(mError){status.textContent=mError.message;return}
 const memberships=members||[],ids=memberships.map(m=>m.circle_id);
 if(!ids.length){root.innerHTML='<div class="gp-notice">Join a group to suggest topics, guests, questions, feedback, and polls. <a class="gp-link" href="discover.html">Discover groups →</a></div>';formRoot.innerHTML="";return}
 const {data:groups,error:gError}=await sb.from("podcast_community_circles").select("id,name").in("id",ids).order("name",{ascending:true});
 if(gError){status.textContent=gError.message;return}
 const groupList=groups||[],roleMap=new Map(memberships.map(m=>[m.circle_id,m.role]));
 const requested=params.get("group"),initial=ids.includes(requested)?requested:(groupList[0]?.id||"");
 if(!initial){root.innerHTML='<div class="gp-notice">Your group list is unavailable.</div>';return}
 formRoot.innerHTML='<form id="gp-collaboration-form" class="gp-form gp-collaboration-form"><label>Group<select name="circle_id" required>'+groupList.map(g=>'<option value="'+esc(g.id)+'" '+(g.id===initial?'selected':'')+'>'+esc(g.name)+'</option>').join("")+'</select></label><label>Submission type<select name="content_type"><option value="topic">Episode or discussion topic</option><option value="guest">Guest suggestion</option><option value="question">Question for the creator</option><option value="feedback">Show or group feedback</option><option value="poll">Community poll</option></select></label><label>Title<input name="title" minlength="4" maxlength="140" required placeholder="Give your idea a clear title"></label><label>Details<textarea name="body" minlength="4" maxlength="3000" required placeholder="Share the idea and why it would matter to the group…"></textarea></label><label id="gp-poll-options-wrap" hidden>Poll choices<textarea name="poll_options" maxlength="1200" placeholder="One choice per line (2–8 choices)"></textarea><small class="gp-help">Each choice can be up to 140 characters.</small></label><button class="gp-button" type="submit">Submit to group</button><p class="gp-help">Submissions are visible to members of the selected group. Owners and moderators can review them.</p></form>';
 const createForm=$("#gp-collaboration-form"),typeSelect=createForm.elements.content_type,optionsWrap=$("#gp-poll-options-wrap");
 const syncOptions=()=>{optionsWrap.hidden=typeSelect.value!=="poll";createForm.elements.poll_options.required=typeSelect.value==="poll"};
 typeSelect.addEventListener("change",syncOptions);syncOptions();
 const draw=async()=>{
  const circleId=createForm.elements.circle_id.value;
  root.innerHTML='<p class="gp-muted">Loading collaboration ideas…</p>';
  const {data:items,error}=await sb.from("podcast_community_circle_collaborations").select("id,circle_id,author_id,content_type,title,body,poll_options,status,creator_response,responded_by,responded_at,episode_id,created_at,updated_at").eq("circle_id",circleId).order("created_at",{ascending:false}).limit(60);
  if(error){root.innerHTML='<div class="gp-notice">Collaborations could not be loaded: '+esc(error.message)+'</div>';return}
  if(!items?.length){root.innerHTML='<div class="gp-notice">No collaboration ideas yet. Be the first to suggest something.</div>';return}
  const itemIds=items.map(x=>x.id);
  const {data:votes,error:vError}=await sb.from("podcast_community_circle_collaboration_votes").select("collaboration_id,voter_id,choice").in("collaboration_id",itemIds);
  const voteRows=votes||[],voteMap=new Map(),mine=new Map();
  voteRows.forEach(v=>{if(!voteMap.has(v.collaboration_id))voteMap.set(v.collaboration_id,[]);voteMap.get(v.collaboration_id).push(v);if(v.voter_id===user.id)mine.set(v.collaboration_id,v.choice)});
  const role=roleMap.get(circleId),canModerate=["owner","moderator"].includes(role);
  const labels={topic:"Topic idea",guest:"Guest suggestion",question:"Creator question",feedback:"Feedback",poll:"Community poll"};
  const statuses={submitted:"Submitted",under_review:"Under review",approved:"Approved",in_production:"In production",published:"Published",declined:"Declined"};
  root.innerHTML=items.map(item=>{
   const own=item.author_id===user.id,rows=voteMap.get(item.id)||[],myChoice=mine.get(item.id),opts=Array.isArray(item.poll_options)?item.poll_options:[];
   const choices=item.content_type==="poll"?opts:["support"];
   const choiceMarkup=(!own&&!myChoice)?'<div class="gp-collaboration-vote-actions">'+choices.map(choice=>'<button type="button" class="gp-button ghost gp-collaboration-vote" data-id="'+esc(item.id)+'" data-choice="'+esc(choice)+'">'+(item.content_type==="poll"?"Vote: ":"Support") +esc(choice==="support"?"this idea":choice)+'</button>').join("")+'</div>':(myChoice?'<p class="gp-help">Your vote: '+esc(myChoice==="support"?"Supported":myChoice)+'</p>':"");
   const tally=choices.map(choice=>{const count=rows.filter(v=>v.choice===choice).length;return '<div class="gp-collaboration-tally"><span>'+esc(choice==="support"?"Support":choice)+'</span><b>'+count+'</b></div>'}).join("");
   const review=canModerate?'<form class="gp-collaboration-review" data-id="'+esc(item.id)+'"><label>Status<select name="status">'+Object.entries(statuses).map(([v,l])=>'<option value="'+v+'" '+(item.status===v?'selected':'')+'>'+l+'</option>').join("")+'</select></label><label>Response<textarea name="creator_response" maxlength="2000" placeholder="Optional response to the member">'+esc(item.creator_response||"")+'</textarea></label><button class="gp-button ghost" type="submit">Save review</button></form>':"";
   return '<article class="gp-collaboration-card"><div class="gp-collaboration-card-head"><span class="gp-kicker">'+esc(labels[item.content_type]||"Collaboration")+'</span><span class="gp-collaboration-status">'+esc(statuses[item.status]||item.status)+'</span></div><h3>'+esc(item.title)+'</h3><p class="gp-collaboration-body">'+esc(item.body)+'</p><div class="gp-collaboration-meta"><span>'+esc(new Date(item.created_at).toLocaleString())+'</span><span>'+rows.length+' '+(rows.length===1?"vote":"votes")+'</span></div>'+(item.content_type==="poll"||rows.length?'<div class="gp-collaboration-tallies">'+tally+'</div>':"")+choiceMarkup+(item.creator_response?'<div class="gp-collaboration-response"><b>Creator / moderator response</b><p>'+esc(item.creator_response)+'</p></div>':"")+review+'</article>';
  }).join("");
  if(vError)status.textContent="Ideas loaded, but vote totals are unavailable: "+vError.message;
  root.querySelectorAll(".gp-collaboration-vote").forEach(button=>button.addEventListener("click",async()=>{
   button.disabled=true;status.textContent="Recording your vote…";
   const {error}=await sb.from("podcast_community_circle_collaboration_votes").insert({collaboration_id:button.dataset.id,circle_id:circleId,voter_id:user.id,choice:button.dataset.choice});
   if(error){status.textContent=error.code==="23505"?"You have already voted on this idea.":(error.message||"Your vote could not be recorded.");button.disabled=false;return}
   status.textContent="Your vote was recorded.";await draw();
  }));
  root.querySelectorAll(".gp-collaboration-review").forEach(reviewForm=>reviewForm.addEventListener("submit",async event=>{
   event.preventDefault();const d=new FormData(reviewForm),button=reviewForm.querySelector("button");button.disabled=true;status.textContent="Saving the review…";
   const {error}=await sb.from("podcast_community_circle_collaborations").update({status:String(d.get("status")),creator_response:String(d.get("creator_response")||"").trim(),responded_by:user.id,responded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",reviewForm.dataset.id).eq("circle_id",circleId);
   if(error){status.textContent=error.message||"The review could not be saved.";button.disabled=false;return}
   status.textContent="Review saved.";await draw();
  }));
 };
 createForm.addEventListener("submit",async event=>{
  event.preventDefault();const d=new FormData(createForm),title=String(d.get("title")||"").trim(),body=String(d.get("body")||"").trim(),contentType=String(d.get("content_type")),circleId=String(d.get("circle_id"));
  const pollOptions=String(d.get("poll_options")||"").split("\n").map(x=>x.trim()).filter(Boolean);
  if(title.length<4||title.length>140||body.length<4||body.length>3000){status.textContent="Please check the title and details lengths.";return}
  if(contentType==="poll"&&(pollOptions.length<2||pollOptions.length>8||pollOptions.some(x=>x.length>140))){status.textContent="A poll needs 2–8 choices, each no longer than 140 characters.";return}
  const button=createForm.querySelector("button[type=submit]");button.disabled=true;status.textContent="Submitting your idea…";
  const {error}=await sb.from("podcast_community_circle_collaborations").insert({circle_id:circleId,author_id:user.id,content_type:contentType,title,body,poll_options:contentType==="poll"?pollOptions:[],status:"submitted",creator_response:"",responded_by:null});
  if(error){status.textContent=error.message||"Your submission could not be saved.";button.disabled=false;return}
  createForm.elements.title.value="";createForm.elements.body.value="";createForm.elements.poll_options.value="";status.textContent="Your idea was submitted.";button.disabled=false;await draw();
 });
 createForm.elements.circle_id.addEventListener("change",draw);
 await draw();
}
async function start(){const page=document.body.dataset.groupsPage;if(!page)return;decoratePreviewLinks();if(launchGate(page))return;try{if(page==="home"){mountCountdown();const root=$("#gp-featured"),all=await loadGroups(),user=await currentUser().catch(()=>null),visible=all.filter(g=>(g.visibility||(g.is_public?"public":"hidden"))!=="hidden"||g.owner_id===user?.id);renderCards(root,visible.slice(0,9),"Preview group");if(!visible.length)root.innerHTML='<div class="gp-notice">No groups have been created yet. Sign in and start the first community, then return here to preview it.</div>'}else if(page==="discover")await discover();else if(page==="mine")await mine();else if(page==="dashboard")await dashboard();else if(page==="feed")await feed();else if(page==="activity")await activityPage();else if(page==="recognitions")await recognitionsPage();else if(page==="create")await create();else if(page==="community")await community();else if(page==="members")await members();else if(page==="settings")await settings();else if(page==="events")await eventsPage();else if(page==="notifications")await notifications();else if(page==="invitations")await invitationsPage();else if(page==="reports")await reportsPage();else if(page==="image-moderation")await imageModerationPage();else if(page==="collaborations")await collaborationsPage()}catch(error){const status=$("#gp-status");if(status)status.textContent=error.message||"Groups could not load."}}
start();
