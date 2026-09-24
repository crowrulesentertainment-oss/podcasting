/* CrowRules Podcasting — Member Action Domain Service 3.0 */
(()=>{"use strict";if(window.CrowRulesMember)return;
const api=()=>window.CrowRulesData.getClientAsync();
const member=()=>window.CrowRulesData.guard("member");
const RPC={
 followPodcast:"follow_my_podcast", unfollowPodcast:"unfollow_my_podcast",
 saveItem:"save_my_podcast_item", removeItem:"remove_my_podcast_item",
 library:"get_my_podcast_library", following:"get_my_podcast_following"
};
async function call(key,args={}){const name=RPC[key];if(!name)throw new Error("Unsupported member operation.");await member();const db=await api(),r=await db.rpc(name,args);if(r.error)throw r.error;return r.data}
async function followPodcast(id){return call("followPodcast",{p_podcast_id:id})}
async function unfollowPodcast(id){return call("unfollowPodcast",{p_podcast_id:id})}
async function saveEpisode(id){return call("saveItem",{p_item_type:"episode",p_item_id:id})}
async function unsaveEpisode(id){return call("removeItem",{p_item_type:"episode",p_item_id:id})}
async function favoriteEpisode(id){return call("saveItem",{p_item_type:"favorite",p_item_id:id})}
async function unfavoriteEpisode(id){return call("removeItem",{p_item_type:"favorite",p_item_id:id})}
async function followMember(id){const u=await member(),db=await api();const r=await db.from("podcast_member_follows").insert({follower_user_id:u.id,followed_user_id:id});if(r.error)throw r.error;return r.data}
async function unfollowMember(id){const u=await member(),db=await api();const r=await db.from("podcast_member_follows").delete().eq("follower_user_id",u.id).eq("followed_user_id",id);if(r.error)throw r.error;return r.data}
async function markNotificationRead(id){const u=await member(),db=await api();const r=await db.from("podcast_notifications").update({is_read:true}).eq("id",id).eq("user_id",u.id);if(r.error)throw r.error;return r.data}
async function library(){return call("library")}
async function following(){return call("following")}
async function memberFollowing(ids=[]){const u=await member();if(!ids.length)return [];const db=await api(),r=await db.from("podcast_member_follows").select("followed_user_id").eq("follower_user_id",u.id).in("followed_user_id",ids);if(r.error)throw r.error;return r.data||[]}
const contract=fn=>async(...args)=>window.CrowRulesData.execute(()=>fn(...args));
window.CrowRulesMember={version:"3.0",followPodcast:contract(followPodcast),unfollowPodcast:contract(unfollowPodcast),saveEpisode:contract(saveEpisode),unsaveEpisode:contract(unsaveEpisode),favoriteEpisode:contract(favoriteEpisode),unfavoriteEpisode:contract(unfavoriteEpisode),followMember:contract(followMember),unfollowMember:contract(unfollowMember),markNotificationRead:contract(markNotificationRead),library:contract(library),following:contract(following),memberFollowing:contract(memberFollowing)};
})();