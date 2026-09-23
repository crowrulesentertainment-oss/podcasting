import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!,{apiVersion:"2026-07-29.dahlia",httpClient:Stripe.createFetchHttpClient()});
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,content-type"};
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  if(req.method!=="POST")throw new Error("POST required");
  const auth=req.headers.get("Authorization");if(!auth)throw new Error("Authentication required");
  const {data:{user},error:ae}=await db.auth.getUser(auth.replace(/^Bearer\s+/i,""));if(ae||!user)throw new Error("Invalid session");
  const b=await req.json(),name=String(b.name||"").trim(),type=String(b.product_type||"listener_support");
  if(!["membership","listener_support","sponsorship","advertising","affiliate","digital_product"].includes(type))throw new Error("Invalid product type");
  if(!name||name.length>120)throw new Error("Product name is required");
  const amount=Math.round(Number(b.amount_cents||0));if(!Number.isInteger(amount)||amount<0)throw new Error("Invalid amount");
  const interval=b.interval==="month"||b.interval==="year"?b.interval:null;
  if(type==="membership"&&!interval)throw new Error("Memberships require monthly or yearly billing");
  if(!interval&&amount===0)throw new Error("Free products are not checkout products");
  const {data:member,error:me}=await db.from("members").select("id").eq("user_id",user.id).maybeSingle();if(me)throw new Error(me.message);if(!member)throw new Error("Universal membership profile not found");
  const {data:creator,error:ce}=await db.from("creators").select("id").eq("member_id",member.id).maybeSingle();if(ce)throw new Error(ce.message);if(!creator)throw new Error("Creator profile not found");
  const sp=await stripe.products.create({name,description:String(b.description||"").slice(0,500),metadata:{crowrules_creator_id:creator.id,crowrules_product_type:type}});
  const price=await stripe.prices.create({product:sp.id,currency:"usd",unit_amount:amount,...(interval?{recurring:{interval}}:{})});
  const {data:row,error:de}=await db.from("cr_podcast_monetization_products").insert({creator_id:creator.id,podcast_id:b.podcast_id||null,product_type:type,name,description:String(b.description||"").slice(0,500),currency:"usd",stripe_product_id:sp.id,stripe_price_id:price.id,amount_cents:amount,interval,active:true}).select("id,name,product_type,podcast_id,amount_cents,interval,stripe_product_id,stripe_price_id,active").single();
  if(de){await stripe.products.update(sp.id,{active:false});throw new Error(de.message);}
  return new Response(JSON.stringify({product:row}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Product creation failed"}),{status:400,headers:{...cors,"Content-Type":"application/json"}});}
});