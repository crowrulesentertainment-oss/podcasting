(()=>{"use strict";if(window.__CROW_PODCASTING_V17_5__)return;window.__CROW_PODCASTING_V17_5__=true;
const getBus=()=>window.CROW_PODCASTING_V17_3||window.CROW_PODCASTING_V17_2||window.CROW_DATA_BUS;
const db=async()=>{const b=getBus();if(b?.ready)return b.ready();if(window.CROW_DATA?.ready)return window.CROW_DATA.ready();return window.CROW_SUPABASE_READY};
const uid=()=>window.__CROW_USER?.id||null;
const cleanRows=r=>Array.isArray(r)?r:(r?.data||[]);
const services={
 version:"17.5.2",
 discovery:{
  async catalog({limit=100}={}){const b=getBus();if(b?.catalog?.())return b.catalog();const s=window.CROW_DATA?.snapshot?.()||{};return s.catalog||{podcasts:[],episodes:[],creators:[]}},
  async search(q,options={}){const b=getBus();if(b?.search)return b.search(q,options);return window.CROW_INTELLIGENCE?.search?.(q,options)||[]},
  async signals(){const d=await db(),id=uid();if(!d||!id)return null;const r=await d.from("podcast_discover_user_signals").select("*").eq("user_id",id).maybeSingle();if(r.error&&r.error.code!=="PGRST116")throw r.error;return r.data||null},
  async recommendations(limit=30){const d=await db(),id=uid();if(!d||!id)return[];const r=await d.from("podcast_discover_recommendations").select("*").eq("user_id",id).order("rank",{ascending:true}).limit(limit);if(r.error)throw r.error;return r.data||[]},
  async preferences(){const d=await db(),id=uid();if(!d||!id)return null;const r=await d.from("podcast_discover_preferences").select("*").eq("user_id",id).maybeSingle();if(r.error&&r.error.code!=="PGRST116")throw r.error;return r.data||null},
  async savePreferences(data){const d=await db(),id=uid();if(!d||!id)return null;const r=await d.from("podcast_discover_preferences").upsert({...data,user_id:id,updated_at:new Date().toISOString()},{onConflict:"user_id"}).select().maybeSingle();if(r.error)throw r.error;return r.data},
  async track(type,extra={}){const d=await db(),id=uid();if(!d||!id)return null;const r=await d.from("podcast_discover_events").insert({user_id:id,event_type:type,podcast_id:extra.podcast_id||null,episode_id:extra.episode_id||null,creator_id:extra.creator_id||null,query:extra.query||null,category:extra.category||null,metadata:extra.metadata||{}});if(r.error)throw r.error;return r.data},
  async saveSearch(query,data={}){const d=await db(),id=uid();if(!d||!id)return null;const r=await d.from("podcast_discover_saved_searches").upsert({user_id:id,query,label:data.label||query,category:data.category||null,content_filter:data.content_filter||null},{onConflict:"user_id,query"});if(r.error)throw r.error;return r.data},
  async featured(limit=12){const c=await this.catalog({limit});return {podcasts:(c.podcasts||[]).filter(x=>x.is_featured!==false).slice(0,limit),episodes:(c.episodes||[]).slice(0,limit),creators:(c.creators||[]).slice(0,limit)}}
 },
 creator:{
  async me(){const id=uid();if(!id)return null;const d=await db();if(!d)return null;const rpc=await d.rpc("get_my_podcast_creator_id");if(!rpc.error&&rpc.data){const r=await d.from("creators").select("*").eq("id",rpc.data).maybeSingle();if(r.error)throw r.error;return r.data}const r=await d.from("creators").select("*").eq("member_id",id).maybeSingle();if(r.error)throw r.error;return r.data},
 async dashboard(creatorId,userId=uid()){const d=await db();if(!d||!creatorId)return null;const p=await services.creator.podcasts(creatorId);const ids=p.map(x=>x.id).filter(Boolean);const [follows,listens,revenue,stripe,alerts]=await Promise.all([
  ids.length?d.from("podcast_follows").select("id",{count:"exact",head:true}).in("podcast_id",ids):Promise.resolve({count:0,error:null}),
  ids.length?d.from("podcast_episodes").select("id").in("podcast_id",ids):Promise.resolve({data:[],error:null}),
  userId?d.from("cr_creator_revenue_transactions").select("creator_amount,status,currency").eq("user_id",userId).limit(500):Promise.resolve({data:[],error:null}),
  d.from("cr_podcast_stripe_accounts").select("onboarding_status,charges_enabled,payouts_enabled,details_submitted,requirements_due,requirements_currently_due,disabled_reason,updated_at").eq("creator_id",creatorId).maybeSingle(),
  userId?d.from("creator_realtime_alerts").select("id,title,message,severity,is_read,created_at,action_url").eq("user_id",userId).order("created_at",{ascending:false}).limit(8):Promise.resolve({data:[],error:null}),
  ids.length?d.from("cr_podcast_subscriptions_65").select("id").in("podcast_id",ids):Promise.resolve({data:[],error:null}),
  userId?d.from("creator_payouts").select("amount,status,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(200):Promise.resolve({data:[],error:null})
 ]);
 if(follows.error)throw follows.error;if(listens.error)throw listens.error;if(revenue.error)throw revenue.error;if(stripe.error&&stripe.error.code!=="PGRST116")throw stripe.error;if(alerts.error)throw alerts.error;if(subscriptions.error)throw subscriptions.error;if(payouts.error)throw payouts.error;
 const episodeIds=(listens.data||[]).map(x=>x.id).filter(Boolean);
 let listenRows=[];
 if(episodeIds.length){const lr=await d.from("podcast_listens").select("seconds_listened,completed").in("episode_id",episodeIds).limit(1000);if(lr.error)throw lr.error;listenRows=lr.data||[]}
 const earnings=(revenue.data||[]).filter(x=>String(x.status||"").toLowerCase()!=="void");
 return {podcasts:p,followers:Number(follows.count||0),subscribers:(subscriptions.data||[]).length,episodes:episodeIds.length,listens:listenRows,revenue:earnings,payouts:payouts.data||[],stripe:stripe.data||null,alerts:alerts.data||[]};
 },
  async profile(creatorIdOrSlug){const d=await db();if(!d)return null;let q=d.from("creators").select("*,creator_profiles(*)");q=creatorIdOrSlug?.includes?.("-")?q.eq("slug",creatorIdOrSlug):q.eq("id",creatorIdOrSlug);const r=await q.maybeSingle();if(r.error)throw r.error;return r.data},
  async podcasts(creatorId){const d=await db();if(!d||!creatorId)return[];const r=await d.from("podcasts").select("*").eq("creator_id",creatorId).order("created_at",{ascending:false});if(r.error)throw r.error;return r.data||[]},
  async follows(creatorId){const d=await db(),id=uid();if(!d||!creatorId)return[];const r=await d.from("creator_follows").select("*").eq("creator_id",creatorId);if(r.error)throw r.error;return r.data||[]},
  async isFollowing(creatorId){const d=await db(),id=uid();if(!d||!id||!creatorId)return false;const r=await d.from("creator_follows").select("id").eq("creator_id",creatorId).eq("user_id",id).maybeSingle();if(r.error&&r.error.code!=="PGRST116")throw r.error;return !!r.data},
  async follow(creatorId){const d=await db(),id=uid();if(!d||!id||!creatorId)throw Error("Sign in required.");const r=await d.from("creator_follows").upsert({creator_id:creatorId,user_id:id},{onConflict:"creator_id,user_id"});if(r.error)throw r.error;return true},
  async unfollow(creatorId){const d=await db(),id=uid();if(!d||!id||!creatorId)throw Error("Sign in required.");const r=await d.from("creator_follows").delete().eq("creator_id",creatorId).eq("user_id",id);if(r.error)throw r.error;return true},
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
  async creatorDashboard(creatorId){const p=await services.creator.podcasts(creatorId);const a=await services.analytics.creator(creatorId);const pulse=await services.creator.pulse(creatorId);return{...a,pulse,podcasts:p}},
  async episode(episodeId){const d=await db(),id=uid();if(!d||!episodeId)return{progress:null,listens:[]};const ps=d.from("podcast_episode_progress").select("*").eq("episode_id",episodeId).eq("user_id",id||"00000000-0000-0000-0000-000000000000").maybeSingle();const ls=d.from("podcast_listens").select("seconds_listened,completed,created_at").eq("episode_id",episodeId).eq("user_id",id||"00000000-0000-0000-0000-000000000000").order("created_at",{ascending:false}).limit(100);const [p,l]=await Promise.all([ps,ls]);if(p.error&&p.error.code!=="PGRST116")throw p.error;if(l.error)throw l.error;return{progress:p.data||null,listens:l.data||[]}},
  async creator(creatorId){const p=await services.creator.podcasts(creatorId);const d=await db();if(!d)return{podcasts:p,episodes:[]};const ids=p.map(x=>x.id).filter(Boolean);if(!ids.length)return{podcasts:p,episodes:[]};const r=await d.from("podcast_episodes").select("*").in("podcast_id",ids).order("published_at",{ascending:false});if(r.error)throw r.error;return{podcasts:p,episodes:r.data||[]}}
 },
 ready:db, user:uid
};
window.CROW_PODCASTING_V17_5=services;window.CROW_DOMAIN_SERVICES=services;
window.dispatchEvent(new CustomEvent("crow:v17:domain-services",{detail:{version:services.version}}));
})();