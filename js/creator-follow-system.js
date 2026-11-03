(()=>{"use strict";
const C=window.CROW_CONFIG||{},SB=window.supabase;
if(!SB?.createClient||!C.supabaseUrl||!C.supabaseKey)return;
const db=SB.createClient(C.supabaseUrl,C.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
let user=null,followed=new Set(),counts=new Map(),busy=new Set(),observer=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function cards(){return [...document.querySelectorAll(".creator[data-creator-user-id]")];}
function addFollowControl(card){
 const id=card.dataset.creatorUserId;if(!id||card.dataset.followControl==="1")return;
 card.dataset.followControl="1";
 const actions=card.querySelector(".creator-actions");if(!actions)return;
 const count=counts.get(id)||0;card.dataset.followerCount=String(count);
 const stats=card.querySelector(".stats");
 if(stats){const stat=document.createElement("span");stat.className="creator-follower-count";stat.dataset.followerCountLabel="";stat.textContent=count.toLocaleString()+" follower"+(count===1?"":"s");stats.appendChild(stat);}
 const button=document.createElement("button");button.type="button";button.className="btn creator-follow-btn";button.dataset.followCreator=id;
 button.textContent=user?(followed.has(id)?"FOLLOWING ✓":"＋ FOLLOW"):"SIGN IN TO FOLLOW";
 button.disabled=!user||id===user.id;
 if(!user){button.title="Sign in to follow creators";button.addEventListener("click",()=>location.href="../login.html?next="+encodeURIComponent("listener/creators.html"));}
 else button.addEventListener("click",()=>toggleFollow(id,button));
 actions.appendChild(button);
}
function renderFollowState(){
 cards().forEach(card=>{
  const id=card.dataset.creatorUserId,button=card.querySelector("[data-follow-creator]");
  if(!button)return;
  button.textContent=user?(followed.has(id)?"FOLLOWING ✓":"＋ FOLLOW"):"SIGN IN TO FOLLOW";
  button.disabled=!user||id===user.id||busy.has(id);
  button.classList.toggle("primary",!!user&&followed.has(id));
 });
}
function renderCounts(){
 cards().forEach(card=>{
  const id=card.dataset.creatorUserId,count=counts.get(id)||0;
  card.dataset.followerCount=String(count);
  const label=card.querySelector("[data-follower-count-label]");
  if(label)label.textContent=count.toLocaleString()+" follower"+(count===1?"":"s");
 });
 sortByFollowers();
}
function sortByFollowers(){
 const select=$("sort");if(!select||select.value!=="followers")return;
 const grid=$("creators");if(!grid)return;
 cards().sort((a,b)=>(Number(b.dataset.followerCount)||0)-(Number(a.dataset.followerCount)||0)).forEach(card=>grid.appendChild(card));
}
async function loadCounts(){
 const {data,error}=await db.from("podcast_creator_follower_counts").select("creator_user_id,follower_count").limit(1000);
 if(error){console.warn("[Creator follows] Counts unavailable:",error.message);return;}
 counts=new Map((data||[]).map(x=>[String(x.creator_user_id),Number(x.follower_count)||0]));
 renderCounts();
}
async function loadFollowing(){
 const {data,error}=await db.from("podcast_creator_follows").select("creator_user_id").eq("follower_id",user.id).limit(1000);
 if(error){console.warn("[Creator follows] Following list unavailable:",error.message);return;}
 followed=new Set((data||[]).map(x=>String(x.creator_user_id)));renderFollowState();
}
async function toggleFollow(id,button){
 if(!user||busy.has(id)||id===user.id)return;
 busy.add(id);button.disabled=true;button.textContent="PLEASE WAIT…";
 try{
  if(followed.has(id)){
   const {error}=await db.from("podcast_creator_follows").delete().eq("follower_id",user.id).eq("creator_user_id",id);
   if(error)throw error;followed.delete(id);counts.set(id,Math.max(0,(counts.get(id)||0)-1));
  }else{
   const {error}=await db.from("podcast_creator_follows").insert({follower_id:user.id,creator_user_id:id});
   if(error)throw error;followed.add(id);counts.set(id,(counts.get(id)||0)+1);
  }
  renderFollowState();renderCounts();
 }catch(error){
  console.error("[Creator follows]",error);
  button.textContent="TRY AGAIN";
  button.title=error.message||"Could not update your follow.";
 }finally{busy.delete(id);renderFollowState();}
}
async function init(){
 try{const {data}=await db.auth.getUser();user=data?.user||null;}catch(_){}
 if(user){await loadFollowing();}
 await loadCounts();
 document.querySelectorAll(".creator[data-creator-user-id]").forEach(addFollowControl);
 renderFollowState();renderCounts();
 const grid=$("creators");
 if(grid&&"MutationObserver"in window){
  observer=new MutationObserver(()=>{grid.querySelectorAll(".creator[data-creator-user-id]").forEach(addFollowControl);renderFollowState();renderCounts();});
  observer.observe(grid,{childList:true,subtree:true});
 }
 const sort=$("sort");
 if(sort){const option=document.createElement("option");option.value="followers";option.textContent="Most followed";sort.appendChild(option);sort.addEventListener("change",sortByFollowers);}
 db.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;followed.clear();if(user)loadFollowing();else renderFollowState();renderFollowState();});
}
init();
})();