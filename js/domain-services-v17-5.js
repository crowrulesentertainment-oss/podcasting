(()=>{"use strict";if(window.__CROW_PODCASTING_V17_5__)return;window.__CROW_PODCASTING_V17_5__=true;
const getBus=()=>window.CROW_PODCASTING_V17_3||window.CROW_PODCASTING_V17_2||window.CROW_DATA_BUS;
const db=async()=>{const b=getBus();if(b?.ready)return b.ready();if(window.CROW_DATA?.ready)return window.CROW_DATA.ready();return window.CROW_SUPABASE_READY};
const uid=()=>window.__CROW_USER?.id||null;
const cleanRows=r=>Array.isArray(r)?r:(r?.data||[]);
const services={
 version:"17.5.0",
 discovery:{
  async catalog({limit=100}={}){const b=getBus();if(b?.catalog?.())return b.catalog();const s=window.CROW_DATA?.snapshot?.()||{};return s.catalog||{podcasts:[],episodes:[],creators:[]}},
  async search(q,options={}){const b=getBus();if(b?.search)return b.search(q,options);return window.CROW_INTELLIGENCE?.search?.(q,options)||[]},
  async featured(limit=12){const c=await this.catalog({limit});return {podcasts:(c.podcasts||[]).filter(x=>x.is_featured!==false).slice(0,limit),episodes:(c.episodes||[]).slice(0,limit),creators:(c.creators||[]).slice(0,limit)}}
 },
 creator:{
  async me(){const id=uid();if(!id)return null;const d=await db();if(!d)return null;const r=await d.from("creators").select("*").eq("member_id",id).maybeSingle();if(r.error)throw r.error;return r.data},
  async profile(creatorIdOrSlug){const d=await db();if(!d)return null;let q=d.from("creators").select("*,creator_profiles(*)");q=creatorIdOrSlug?.includes?.("-")?q.eq("slug",creatorIdOrSlug):q.eq("id",creatorIdOrSlug);const r=await q.maybeSingle();if(r.error)throw r.error;return r.data},
  async podcasts(creatorId){const d=await db();if(!d||!creatorId)return[];const r=await d.from("podcasts").select("*").eq("creator_id",creatorId).order("created_at",{ascending:false});if(r.error)throw r.error;return r.data||[]},
  async pulse(creatorId){const d=await db();if(!d||!creatorId)return{snapshots:[],alerts:[]};const [a,b]=await Promise.all([d.from("creator_intelligence_snapshots").select("*").eq("creator_id",creatorId).order("created_at",{ascending:false}).limit(10),d.from("creator_realtime_alerts").select("*").eq("creator_id",creatorId).order("created_at",{ascending:false}).limit(20)]);if(a.error)throw a.error;if(b.error)throw b.error;return{snapshots:a.data||[],alerts:b.data||[]}},
  async subscriptionPlans(creatorId){const d=await db();if(!d||!creatorId)return[];const r=await d.from("creator_subscription_plans").select("*").eq("creator_id",creatorId).order("created_at",{ascending:false});if(r.error)throw r.error;return r.data||[]}
 },
 membership:{
  async plans(){const d=await db();if(!d)return[];const r=await d.from("membership_plans").select("*").eq("is_active",true).order("sort_order",{ascending:true});if(r.error)throw r.error;return r.data||[]},
  async entitlements(){const b=getBus();if(b?.membershipEntitlements)return b.membershipEntitlements(50);const d=await db(),id=uid();if(!d||!id)return[];const r=await d.from("membership_entitlements").select("*").eq("user_id",id).limit(50);if(r.error)throw r.error;return r.data||[]}
 },
 monetization:{
  async creatorPlans(creatorId){return services.creator.subscriptionPlans(creatorId)},
  async podcastSubscriptions(podcastId){const d=await db();if(!d||!podcastId)return[];const r=await d.from("podcast_subscriptions").select("*").eq("podcast_id",podcastId);if(r.error)throw r.error;return r.data||[]},
  async membershipPlans(){return services.membership.plans()}
 },
 analytics:{
  async episode(episodeId){const d=await db(),id=uid();if(!d||!episodeId)return{progress:null,listens:[]};const ps=d.from("podcast_episode_progress").select("*").eq("episode_id",episodeId).eq("user_id",id||"00000000-0000-0000-0000-000000000000").maybeSingle();const ls=d.from("podcast_listens").select("seconds_listened,completed,created_at").eq("episode_id",episodeId).eq("user_id",id||"00000000-0000-0000-0000-000000000000").order("created_at",{ascending:false}).limit(100);const [p,l]=await Promise.all([ps,ls]);if(p.error&&p.error.code!=="PGRST116")throw p.error;if(l.error)throw l.error;return{progress:p.data||null,listens:l.data||[]}},
  async creator(creatorId){const p=await services.creator.podcasts(creatorId);const d=await db();if(!d)return{podcasts:p,episodes:[]};const ids=p.map(x=>x.id).filter(Boolean);if(!ids.length)return{podcasts:p,episodes:[]};const r=await d.from("podcast_episodes").select("*").in("podcast_id",ids).order("published_at",{ascending:false});if(r.error)throw r.error;return{podcasts:p,episodes:r.data||[]}}
 },
 ready:db, user:uid
};
window.CROW_PODCASTING_V17_5=services;window.CROW_DOMAIN_SERVICES=services;
window.dispatchEvent(new CustomEvent("crow:v17:domain-services",{detail:{version:services.version}}));
})();