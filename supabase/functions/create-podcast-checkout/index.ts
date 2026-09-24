// Supabase Edge Function: create podcast checkout session with Stripe Connect destination transfer
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!,{apiVersion:"2026-07-29.dahlia",httpClient:Stripe.createFetchHttpClient()});
const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    if(req.method!=="POST")throw new Error("POST required");
    const auth=req.headers.get("Authorization"); if(!auth)throw new Error("Authentication required");
    const token=auth.replace(/^Bearer\s+/i,"");
    const {data:{user},error:ue}=await supabase.auth.getUser(token);
    if(ue||!user)throw new Error("Invalid session");

    const body=await req.json();
    const productId=String(body.product_id||"");
    if(!productId)throw new Error("product_id required");

    const {data:product,error:pe}=await supabase
      .from("cr_podcast_monetization_products")
      .select("id,creator_id,name,description,currency,amount_cents,interval,stripe_price_id,active")
      .eq("id",productId).single();
    if(pe||!product||!product.active)throw new Error("Product unavailable");
    if(!product.stripe_price_id)throw new Error("Stripe Price is not configured for this product");

    const {data:connection,error:ae}=await supabase
      .from("cr_podcast_stripe_accounts")
      .select("stripe_account_id,payouts_enabled")
      .eq("creator_id",product.creator_id)
      .maybeSingle();
    if(ae)throw ae;
    if(!connection?.stripe_account_id)throw new Error("Creator has not completed Stripe payout onboarding");
    if(!connection.payouts_enabled)throw new Error("Creator Stripe account is not payout-enabled yet");

    const feeBps=Math.max(0,Math.min(2500,Number(Deno.env.get("STRIPE_PLATFORM_FEE_BPS")||"0")));
    const recurring=product.interval==="month"||product.interval==="year";
    const destination=connection.stripe_account_id;
    const metadata={creator_id:product.creator_id,product_id:product.id,user_id:user.id};

    const session=await stripe.checkout.sessions.create({
      mode:recurring?"subscription":"payment",
      line_items:[{price:product.stripe_price_id,quantity:1}],
      client_reference_id:user.id,
      customer_email:user.email,
      metadata,
      ...(recurring?{
        subscription_data:{
          metadata,
          transfer_data:{destination},
          ...(feeBps?{application_fee_percent:feeBps/100}: {})
        }
      }:{
        payment_intent_data:{
          transfer_data:{destination},
          ...(feeBps?{application_fee_amount:Math.round(Number(product.amount_cents||0)*feeBps/10000)}:{})
        }
      }),
      success_url:body.success_url||"https://crowrulesentertainment-oss.github.io/podcasting/thank-you.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url:body.cancel_url||"https://crowrulesentertainment-oss.github.io/podcasting/support.html"
    });

    return json({url:session.url,id:session.id,connected_account:destination});
  }catch(e){
    return json({error:e instanceof Error?e.message:"Checkout failed"},400);
  }
});