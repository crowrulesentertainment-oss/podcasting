/* CrowRules Podcasting — Recommendation Learning Loop 8.0 */
(function(){
  "use strict";
  const db=window.supabase.createClient(window.CROWRULES_SUPABASE_URL,window.CROWRULES_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const api={
    db,user:null,events:[],profile:{categories:[],creators:[],signals:[]},weights:{},
    decay(date){const days=Math.max(0,(Date.now()-new Date(date).getTime())/86400000);return Math.max(.08,Math.exp(-days/30));},
    async load(){
      const {data:{user}}=await db.auth.getUser();this.user=user;if(!user)return this;
      const {data,error}=await db.from("analytics_events").select("event_name,content_id,content_type,metadata,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1000);
      if(error)throw error;this.events=data||[];
      const weights={recommendation_click:8,podcast_play:12,podcast_completion:24,podcast_save:18,podcast_follow:22,podcast_member_follow:15,repeat_listen:20,recommendation_skip:-8,podcast_skip:-7,discovery_impression:.5};
      const cat=new Map(), creator=new Map(), signals=new Map();const creatorNames=new Map();const cr=await db.from("creators").select("id,name").eq("is_active",true).limit(500);(cr.data||[]).forEach(x=>creatorNames.set(x.id,x.name));
      this.events.forEach(e=>{
        const d=this.decay(e.created_at), base=weights[e.event_name]??0, v=base*d;
        if(base){const key=e.content_id||e.event_name;signals.set(key,(signals.get(key)||0)+v);}
        const c=e.metadata?.category;if(c&&base){const k=String(c).trim();cat.set(k,(cat.get(k)||0)+v);}
        const cr=e.metadata?.creator_id;if(cr&&base)creator.set(cr,(creator.get(cr)||0)+v);
      });
      this.weights=weights;
      this.profile.categories=[...cat.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,score])=>({name,score:Math.round(score*10)/10}));
      this.profile.creators=[...creator.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,score])=>({id,name:creatorNames.get(id)||"Creator",score:Math.round(score*10)/10}));
      this.profile.signals=[...signals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([id,score])=>({id,score:Math.round(score*10)/10}));
      return this;
    },
    score(id){return this.profile.signals.find(x=>x.id===id)?.score||0;},
    categoryScore(name){return this.profile.categories.find(x=>String(x.name).toLowerCase()===String(name||"").toLowerCase())?.score||0;},
    explanation(p){
      const reasons=[];if(this.categoryScore(p.category)>0)reasons.push("matches your recent interests");
      if(this.score(p.id)>0)reasons.push("responds to your recent activity");
      if(p.is_live)reasons.push("live now");if(p.is_featured)reasons.push("featured by CrowRules");
      return reasons.slice(0,2).join(" · ")||"exploring something new";
    }
  };
  window.CrowRulesRecommendationLearning=api;
})();