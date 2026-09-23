// Supabase Edge Function: Stripe webhook receiver
// Configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET as Edge Function secrets.
// Stripe signature verification happens before any financial database mutation.
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!,{apiVersion:"2026-07-29.dahlia",httpClient:Stripe.createFetchHttpClient()});
const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async(req)=>{
 try{
  if(req.method!=="POST")return new Response("POST required",{status:405});
  const signature=req.headers.get("stripe-signature");
  if(!signature)throw new Error("Missing Stripe signature");
  const raw=await req.text();
  const event=await stripe.webhooks.constructEventAsync(raw,signature,Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  const obj=event.data.object as any;
  const metadata=obj.metadata||{};
  const creatorId=metadata.creator_id;
  const productId=metadata.product_id;
  const userId=metadata.user_id;
  const amount=Number(obj.amount_total??obj.amount_paid??obj.amount??0);

  if(["checkout.session.completed","checkout.session.async_payment_succeeded","invoice.paid","charge.refunded"].includes(event.type)){
    const state=event.type==="charge.refunded"?"refunded":(event.type==="invoice.paid"||event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"?"paid":"pending");
    if(creatorId){
      await supabase.from("cr_podcast_monetization_transactions").upsert({
        creator_id:creatorId,product_id:productId||null,stripe_customer_id:obj.customer||null,
        stripe_checkout_session_id:obj.id?.startsWith("cs_")?obj.id:(obj.checkout_session||null),
        stripe_payment_intent_id:obj.payment_intent||null,stripe_subscription_id:obj.subscription||null,
        amount_cents:Math.max(0,amount),currency:obj.currency||"usd",state,source:"stripe",
        occurred_at:new Date(event.created*1000).toISOString()
      },{onConflict:"stripe_checkout_session_id"});
    }
  }

  if(event.type==="customer.subscription.created"||event.type==="customer.subscription.updated"||event.type==="customer.subscription.deleted"){
    if(creatorId&&userId&&productId){
      const status=event.type==="customer.subscription.deleted"?"canceled":(obj.status==="past_due"?"past_due":"active");
      await supabase.from("cr_podcast_entitlements").upsert({
        creator_id:creatorId,member_user_id:userId,product_id:productId,
        stripe_customer_id:obj.customer||null,stripe_subscription_id:obj.id,status,
        starts_at:obj.start_date?new Date(obj.start_date*1000).toISOString():null,
        ends_at:obj.cancel_at?new Date(obj.cancel_at*1000).toISOString():null
      },{onConflict:"stripe_subscription_id"});
    }
  }
  return new Response(JSON.stringify({received:true,id:event.id}),{headers:{"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Webhook failed"}),{status:400,headers:{"Content-Type":"application/json"}});}
});