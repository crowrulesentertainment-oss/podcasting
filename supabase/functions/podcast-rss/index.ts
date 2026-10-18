import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const esc=(v:string)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const cdata=(v:string)=>String(v??"").replace(/]]>/g,"]]]]><![CDATA[>");
const iso=(v:string)=>v?new Date(v).toUTCString():"";
const duration=(n:number|null)=>{if(!n)return "";const s=Math.max(0,Math.round(n));return Math.floor(s/3600)+":"+String(Math.floor(s/60)%60).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};
function parseStorage(v:string){const s=String(v||"");if(!s.startsWith("storage://"))return null;const p=s.slice(10).split("/");return{bucket:p.shift()||"",path:p.join("/")};}
Deno.serve(async(req)=>{
 const u=new URL(req.url); if(req.method==="OPTIONS")return new Response("ok");
 const slug=u.searchParams.get("slug")?.trim(); if(!slug)return new Response("Missing podcast slug",{status:400});
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const {data:pod,error:pe}=await db.from("podcasts").select("id,title,slug,description,artwork_url,website_url,status,category,subcategory,author_name,author_email,language,copyright,explicit_content,trailer_url,social_links").eq("slug",slug).maybeSingle();
 if(pe||!pod||pod.status!=="published")return new Response("Podcast not found",{status:404});
 const {data:eps,error:ee}=await db.from("podcast_episodes").select("id,title,slug,description,episode_number,season_number,published_at,duration_seconds,audio_url,thumbnail_url,show_notes,is_explicit,access_level").eq("podcast_id",pod.id).eq("status","published").order("published_at",{ascending:false});
 if(ee)return new Response("Unable to load episodes",{status:500});
 const feedUrl=u.origin+"/functions/v1/podcast-rss?slug="+encodeURIComponent(pod.slug);
 const socials=pod.social_links&&typeof pod.social_links==="object"?Object.entries(pod.social_links).map(([k,v])=>'<itunes:owner><itunes:name>'+esc(k)+'</itunes:name><itunes:email>'+esc(v as string)+'</itunes:email></itunes:owner>').join(""):"";
 const audioMeta=async(url:string)=>{
  if(!/^https:\/\//i.test(url))return null;
  try{
   const r=await fetch(url,{method:"HEAD",redirect:"follow",signal:AbortSignal.timeout(8000)});
   if(!r.ok)return null;
   const u=new URL(url);
   const ext=u.pathname.toLowerCase().match(/\.(mp3|m4a|aac|ogg|opus|wav)$/)?.[1]||"";
   const headerType=(r.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
   const inferred:Record<string,string>={mp3:"audio/mpeg",m4a:"audio/mp4",aac:"audio/aac",ogg:"audio/ogg",opus:"audio/ogg",wav:"audio/wav"};
   const type=headerType.startsWith("audio/")?headerType:(inferred[ext]||"");
   const len=Number(r.headers.get("content-length")||"0");
   const range=r.headers.get("content-range")||"";
   const total=Number(range.match(/\/\s*(\d+)$/)?.[1]||"0");
   const length=len>0?len:total;
   if(!type||!Number.isFinite(length)||length<=0)return null;
   return {url,length,type};
  }catch{return null;}
 };
 const items=await Promise.all((eps||[]).map(async(ep:any)=>{
  if(ep.access_level==="premium")return "";
  const st=parseStorage(ep.audio_url);
  let audioUrl="";
  if(st)audioUrl=db.storage.from(st.bucket).getPublicUrl(st.path).data.publicUrl||"";
  else if(/^https:\/\//i.test(String(ep.audio_url||"")))audioUrl=String(ep.audio_url);
  if(!audioUrl)return "";
  const meta=await audioMeta(audioUrl);
  if(!meta)return "";
  const desc=ep.description||ep.show_notes||"";
  return '<item><title><![CDATA['+cdata(ep.title)+']]></title><description><![CDATA['+cdata(desc)+']]></description><guid isPermaLink="false">crowrules-podcast-'+esc(ep.id)+'</guid><link>'+esc(u.origin+"/podcasting/episode.html?id="+ep.id)+'</link>'+
  (ep.published_at?'<pubDate>'+esc(iso(ep.published_at))+'</pubDate>':"")+
  (ep.episode_number!=null?'<itunes:episode>'+esc(ep.episode_number)+'</itunes:episode>':"")+
  (ep.season_number!=null?'<itunes:season>'+esc(ep.season_number)+'</itunes:season>':"")+
  (ep.duration_seconds?'<itunes:duration>'+duration(ep.duration_seconds)+'</itunes:duration>':"")+
  '<itunes:explicit>'+(ep.is_explicit?"yes":"no")+'</itunes:explicit>'+
  (ep.thumbnail_url?'<itunes:image href="'+esc(ep.thumbnail_url)+'"/>':"")+
  '<enclosure url="'+esc(meta.url)+'" length="'+String(meta.length)+'" type="'+esc(meta.type)+'"/></item>';
 })).then(items=>items.filter(Boolean).join(""));
 const cat=pod.category?'<itunes:category text="'+esc(pod.category)+'">'+(pod.subcategory?'<itunes:category text="'+esc(pod.subcategory)+'"/>':"")+'</itunes:category>':"";
 const body='<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'+
 '<title><![CDATA['+cdata(pod.title)+']]></title><link>'+esc(pod.website_url||u.origin+"/podcasting/show.html?slug="+encodeURIComponent(pod.slug))+'</link><description><![CDATA['+cdata(pod.description||pod.title)+']]></description>'+
 '<language>'+esc(pod.language||"en-us")+'</language><copyright><![CDATA['+cdata(pod.copyright||"")+']]></copyright><generator>CrowRules Podcasting 4.7</generator>'+
 '<atom:link href="'+esc(feedUrl)+'" rel="self" type="application/rss+xml"/>'+cat+
 (pod.artwork_url?'<itunes:image href="'+esc(pod.artwork_url)+'"/>':"")+
 '<itunes:author>'+esc(pod.author_name||"CrowRules Creator")+'</itunes:author><itunes:explicit>'+(pod.explicit_content?"yes":"no")+'</itunes:explicit>'+
 (pod.trailer_url?'<itunes:new-feed-url>'+esc(feedUrl)+'</itunes:new-feed-url><itunes:link href="'+esc(pod.trailer_url)+'" rel="payment" type="text/html"/>':"")+
 '<itunes:owner><itunes:name>'+esc(pod.author_name||"CrowRules Creator")+'</itunes:name><itunes:email>'+esc(pod.author_email||"crowrulesentertainment@gmail.com")+'</itunes:email></itunes:owner>'+
 '<itunes:summary><![CDATA['+cdata(pod.description||pod.title)+']]></itunes:summary>'+socials+items+'</channel></rss>';
 return new Response(body,{headers:{"Content-Type":"application/rss+xml; charset=utf-8","Cache-Control":"public, max-age=300","Access-Control-Allow-Origin":"*"}});
});