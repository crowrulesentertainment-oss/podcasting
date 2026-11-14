import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@22.6.2";
import { createClient } from "npm:@supabase/supabase-js@2";
const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")||"",{apiVersion:"2026-08-26.dahlia",httpClient:Stripe.createFetchHttpClient()});
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors={"Access-Control-Allow-Origin":"https://crowrulesentertainment-oss.github.io","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type, x-retry-count, traceparent, tracestate, baggage","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin","Content-Type":"application/json"};
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:cors});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"POST required"},405);
 try{
  const auth=req.headers.get("Authorization"); if(!auth?.startsWith("Bearer "))return json({error:"Authentication required"},401);
  const {data:{user},error:ae}=await db.auth.getUser(auth.slice(7)); if(ae||!user)return json({error:"Invalid session"},401);
  const b=await req.json(),name=String(b.name||"").trim(),type=String(b.product_type||"listener_support");
  const allowed=["membership","listener_support","sponsorship","advertising","affiliate","digital_product"];
  if(!allowed.includes(type))throw new Error("Invalid product type");
  if(!name||name.length>120)throw new Error("Product name is required");
  const amount=Math.round(Number(b.amount_cents||0)); if(!Number.isInteger(amount)||amount<1)throw new Error("Invalid amount");
  const interval=b.interval==="month"||b.interval==="year"?b.interval:null;
  if(type==="membership"&&!interval)throw new Error("Memberships require monthly or yearly billing");
  const {data:member,error:me}=await db.from("members").select("id").eq("user_id",user.id).maybeSingle(); if(me)throw me;
  if(!member)throw new Error("Universal membership profile not found");
  const {data:creator,error:ce}=await db.from("creators").select("id").eq("member_id",member.id).maybeSingle(); if(ce)throw ce;
  if(!creator)throw new Error("Creator profile not found");
  const podcastId=String(b.podcast_id||"").trim();
  if(podcastId){
   const {data:podcast,error:podcastError}=await db.from("podcasts").select("id,creator_id").eq("id",podcastId).maybeSingle();
   if(podcastError)throw podcastError;
   if(!podcast||podcast.creator_id!==creator.id) return json({error:"You can only create monetization products for your own podcast."},403);
  }
  const {data:ca,error:cae}=await db.from("cr_podcast_stripe_accounts").select("stripe_account_id").eq("creator_id",creator.id).maybeSingle(); if(cae)throw cae;
  const connected=ca?.stripe_account_id; if(!connected)throw new Error("Creator Stripe account is not connected.");
  const account=await stripe.accounts.retrieve(connected);
  const rawCard=account.capabilities?.card_payments??null;
  const cardPaymentsActive=rawCard===null?!!account.charges_enabled:rawCard==="active";
  if(!account.charges_enabled||!account.payouts_enabled||!cardPaymentsActive||account.capabilities?.transfers!=="active")throw new Error("Creator Stripe account is not ready for monetization.");
  const product=await stripe.products.create({name,description:String(b.description||"").slice(0,500),metadata:{crowrules_creator_id:creator.id,crowrules_product_type:type,crowrules_charge_model:"destination"}});
  const price=await stripe.prices.create({product:product.id,currency:"usd",unit_amount:amount,...(interval?{recurring:{interval}}:{})});
  const {data:row,error:de}=await db.from("cr_podcast_monetization_products").insert({creator_id:creator.id,podcast_id:podcastId||null,product_type:type,name,description:String(b.description||"").slice(0,500),currency:"usd",stripe_product_id:product.id,stripe_price_id:price.id,amount_cents:amount,interval,active:true}).select("id,name,product_type,podcast_id,amount_cents,interval,stripe_product_id,stripe_price_id,active").single();
  if(de){await stripe.products.update(product.id,{active:false});throw de}
  return json({product:row,charge_model:"destination"});
 }catch(e){return json({error:e instanceof Error?e.message:"Product creation failed"},400)}
});