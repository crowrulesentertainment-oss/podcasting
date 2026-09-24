/* CrowRules Podcasting — Discovery Domain Service 1.0 */
(()=>{"use strict";if(window.CrowRulesDiscovery)return;
const api=()=>window.CrowRulesData.getClientAsync();
async function publicCatalog(){const db=await api();return Promise.all([
 db.from("podcasts").select("id,creator_id,title,slug,category,description,artwork_url,status,is_featured,is_live,listener_count,total_plays,created_at,updated_at").in("status",["active","published","live"]).limit(300),
 db.from("podcast_episodes").select("id,podcast_id,title,episode_number,published_at,thumbnail_url,status").in("status",["published","public","live"]).order("published_at",{ascending:false}).limit(60),
 db.from("creators").select("id,name,slug,role,discipline,bio,avatar_url,is_active,is_featured,member_id,created_at,updated_at").eq("is_active",true).limit(150)
])}
async function personal(){const u=await window.CrowRulesData.getUser();if(!u)return null;const db=await api();return Promise.all([
 db.from("podcast_follows").select("podcast_id").eq("user_id",u.id).limit(500),
 db.from("podcast_saved_episodes").select("episode_id").eq("user_id",u.id).limit(500),
 db.from("podcast_listens").select("episode_id,seconds_listened,completed,created_at").eq("user_id",u.id).order("created_at",{ascending:false}).limit(500),
 db.from("podcast_episode_progress").select("episode_id,percent_complete,completed,last_played_at").eq("user_id",u.id).order("last_played_at",{ascending:false}).limit(500),
 db.from("podcast_member_follows").select("followed_user_id").eq("follower_user_id",u.id).limit(500),
 db.from("analytics_events").select("event_name,content_id,content_type,metadata,created_at").eq("user_id",u.id).order("created_at",{ascending:false}).limit(500)
])}
async function episodes(ids){if(!ids.length)return [];const db=await api(),r=await db.from("podcast_episodes").select("id,podcast_id").in("id",ids.slice(0,500));if(r.error)throw r.error;return r.data||[]}
async function podcasts(ids){if(!ids.length)return [];const db=await api(),r=await db.from("podcasts").select("id,category,creator_id").in("id",[...new Set(ids)].slice(0,500));if(r.error)throw r.error;return r.data||[]}
async function track(event_name,property="all",content_id=null,content_type=null,metadata={}){const db=await api();const u=await window.CrowRulesData.getUser();const r=await db.from("analytics_events").insert({user_id:u?.id||null,event_name,property,page_url:location.href,content_id,content_type,metadata:{...(window.CrowRulesRecommendationRuntime?.context()||{}),...metadata}});if(r.error)throw r.error}
const contract=fn=>async(...args)=>window.CrowRulesData.execute(()=>fn(...args));
window.CrowRulesDiscovery={version:"2.0",publicCatalog:contract(publicCatalog),personal:contract(personal),episodes:contract(episodes),podcasts:contract(podcasts),track:contract(track)};
})();