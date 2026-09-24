// Supabase Edge Function: Stripe webhook receiver — Podcast monetization + Connect payouts
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!,{apiVersion:"2026-07-29.dahlia",httpClient:Stripe.createFetchHttpClient()});
const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});

Deno.serve(async(req)=>{
  let eventId:string|null=null;
  try{
    if(req.method!=="POST")return new Response("POST required",{status:405});
    const signature=req.headers.get("stripe-signature"); if(!signature)throw new Error("Missing Stripe signature");
    const raw=await req.text();
    const event=await stripe.webhooks.constructEventAsync(raw,signature,Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
    eventId=event.id;

    const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
    const payloadHash=Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
    const {data:inserted,error:ie}=await supabase.rpc("record_stripe_webhook_event",{p_event_id:event.id,p_event_type:event.type,p_payload_hash:payloadHash});
    if(ie)throw ie;
    if(inserted===false)return json({received:true,id:event.id,duplicate:true});

    const obj:any=event.data.object;
    let metadata:any=obj.metadata||{};

    if(!metadata.creator_id && obj.subscription){
      try{const sub:any=await stripe.subscriptions.retrieve(obj.subscription);metadata={...sub.metadata,...metadata};}catch(_e){}
    }
    if(!metadata.creator_id && obj.payment_intent){
      try{const pi:any=await stripe.paymentIntents.retrieve(obj.payment_intent);metadata={...pi.metadata,...metadata};}catch(_e){}
    }

    const creatorId=metadata.creator_id||null;
    const evaluateFinanceRules=async(eventType:string,eventRecordId:string,actualCents:number,currency:string)=>{
      if(!creatorId)return;
      const {data:rules,error}=await supabase.from("cr_podcast_finance_alert_rules").select("*").eq("creator_id",creatorId).eq("enabled",true).eq("currency",currency.toLowerCase());
      if(error){console.error("finance rules:",error.message);return;}
      for(const rule of (rules||[])){
        const matches=(rule.rule_type==="payment_milestone"&&eventType==="payment")||(rule.rule_type==="revenue_milestone"&&eventType==="revenue")||(rule.rule_type==="payout_milestone"&&eventType==="payout");
        if(!matches||actualCents<Number(rule.threshold_cents))continue;
        if(!rule.repeatable){
          const {data:existing}=await supabase.from("cr_podcast_finance_alert_rule_triggers").select("id").eq("rule_id",rule.id).limit(1);
          if(existing?.length)continue;
        }
        const {error:te}=await supabase.from("cr_podcast_finance_alert_rule_triggers").insert({rule_id:rule.id,creator_id:creatorId,event_type:eventType,event_record_id:eventRecordId,threshold_cents:rule.threshold_cents,actual_cents:actualCents,currency:currency.toLowerCase()});
        if(te && !te.message.includes("duplicate")) console.error("rule trigger:",te.message);
        if(!te){
          await supabase.from("cr_podcast_finance_alerts").insert({creator_id:creatorId,alert_type:"milestone",title:rule.rule_name,message:"Smart finance rule reached: "+rule.rule_name+".",threshold_cents:rule.threshold_cents,currency:currency.toLowerCase()});
          await supabase.from("cr_podcast_finance_alert_rules").update({last_triggered_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",rule.id);
        }
      }
    };
    const financeAlert=async(type:string,title:string,message:string,threshold:number|null=null,currency:string|null=null)=>{
      if(!creatorId)return;
      const {data:prefs}=await supabase.from("cr_podcast_finance_notification_preferences").select("*").eq("creator_id",creatorId).maybeSingle();
      const enabled=prefs ? prefs[type=== "milestone"?"milestones":type=== "payout"?"payouts":type=== "refund"?"refunds":type=== "dispute"?"disputes":type=== "account"?"account":"system"] !== false : true;
      if(!enabled)return;
      const {error}=await supabase.from("cr_podcast_finance_alerts").insert({creator_id:creatorId,alert_type:type,title,message,threshold_cents:threshold,currency});
      if(error) console.error("finance alert:",error.message);
    };
    // Record a transparent creator/platform split for completed checkout payments.
    if ((event.type==="checkout.session.completed" || event.type==="checkout.session.async_payment_succeeded") && creatorId && obj.id?.startsWith("cs_")) {
      const gross=Number(obj.amount_total||0);
      const {data:rule}=await supabase.from("cr_podcast_revenue_split_rules").select("platform_fee_bps").eq("creator_id",creatorId).eq("active",true).maybeSingle();
      const platformBps=Math.max(0,Math.min(2500,Number(rule?.platform_fee_bps||0)));
      const platformFee=Math.round(gross*platformBps/10000);
      const {error:splitError}=await supabase.from("cr_podcast_revenue_splits").upsert({
        creator_id:creatorId, stripe_checkout_session_id:obj.id, stripe_payment_intent_id:obj.payment_intent||null,
        gross_cents:gross, platform_fee_cents:platformFee, creator_net_cents:gross-platformFee,
        currency:obj.currency||"usd", status:"paid", updated_at:new Date().toISOString()
      },{onConflict:"stripe_checkout_session_id"});
      if(splitError) throw splitError;
      await financeAlert("milestone","Payment received","A podcast payment was successfully recorded in your creator finance ledger.",gross,obj.currency||"usd");
    }
    // Refunds and disputes reconcile against the original revenue split.
    if ((event.type==="charge.refunded" || event.type==="charge.dispute.created" || event.type==="charge.dispute.closed") && creatorId) {
      const paymentIntentId=String(obj.payment_intent||"");
      const {data:split}=await supabase.from("cr_podcast_revenue_splits").select("id,gross_cents,platform_fee_cents,creator_net_cents,refund_cents,dispute_cents").eq("creator_id",creatorId).eq("stripe_payment_intent_id",paymentIntentId).maybeSingle();
      if (split) {
        const refund=event.type==="charge.refunded"?Number(obj.amount_refunded||obj.amount||0):Number(split.refund_cents||0);
        const disputeStatus=event.type==="charge.dispute.created"?"disputed":event.type==="charge.dispute.closed"?(obj.status==="won"?"paid":"disputed"):null;
        const status=event.type==="charge.refunded"?"refunded":(disputeStatus||"disputed");
        const revisedNet=Math.max(0,Number(split.gross_cents||0)-Number(split.platform_fee_cents||0)-refund);
        const q=await supabase.from("cr_podcast_revenue_splits").update({
          refund_cents:refund, creator_net_cents:revisedNet, status, reconciled_at:new Date().toISOString(), updated_at:new Date().toISOString()
        }).eq("id",split.id);
        if(q.error)throw q.error;
        await financeAlert(event.type==="charge.refunded"?"refund":"dispute",
          event.type==="charge.refunded"?"Refund recorded":"Dispute activity recorded",
          event.type==="charge.refunded"?"A Stripe refund was recorded against a creator transaction.":"A Stripe dispute event was recorded against a creator transaction.",
          event.type==="charge.refunded"?refund:null,
          obj.currency||null);
      }
    }
    const productId=metadata.product_id||null;
    const userId=metadata.user_id||null;

    // Connected-account onboarding state.
    if(event.type==="account.updated"){
      const account:any=obj;
      const requirements=account.requirements||{};
      const status=account.payouts_enabled?"enabled":account.details_submitted?"submitted":"pending";
      const q=await supabase.from("cr_podcast_stripe_accounts").update({
        onboarding_status:status,
        charges_enabled:!!account.charges_enabled,
        payouts_enabled:!!account.payouts_enabled,
        details_submitted:!!account.details_submitted,
        country:account.country||null,
        default_currency:account.default_currency||null,
        requirements_due:requirements.eventually_due||[],
        requirements_currently_due:requirements.currently_due||[],
        disabled_reason:requirements.disabled_reason||null,
        updated_at:new Date().toISOString()
      }).eq("stripe_account_id",account.id);
      if(q.error)throw q.error;
    }

    // Stripe payout lifecycle. Stripe remains the source of truth for actual payout status.
    if(event.type.startsWith("payout.")){
      const payout:any=obj;
      const {data:connection,error:ce}=await supabase
        .from("cr_podcast_stripe_accounts")
        .select("creator_id")
        .eq("stripe_account_id",payout.destination||event.account||"")
        .maybeSingle();
      // For Connect webhook events, Stripe may provide the connected account in event.account.
      const creatorConnection=connection||(
        event.account
        ? (await supabase.from("cr_podcast_stripe_accounts").select("creator_id").eq("stripe_account_id",event.account).maybeSingle()).data
        : null
      );
      if(ce)throw ce;
      if(creatorConnection?.creator_id){
        const status=event.type==="payout.paid"?"paid":event.type==="payout.failed"?"failed":event.type==="payout.canceled"?"canceled":event.type==="payout.created"?"pending":"in_transit";
        const paidAt=status==="paid"?new Date(event.created*1000).toISOString():null;
        const q=await supabase.from("cr_podcast_payouts").upsert({
          creator_id:creatorConnection.creator_id,
          stripe_account_id:event.account||payout.destination,
          stripe_payout_id:payout.id,
          amount_cents:Number(payout.amount||0),
          currency:payout.currency||"usd",
          status,
          arrival_date:payout.arrival_date?new Date(payout.arrival_date*1000).toISOString():null,
          paid_at:paidAt,
          failure_code:payout.failure_code||null,
          failure_message:payout.failure_message||null,
          external_reference:payout.statement_descriptor||payout.id,
          updated_at:new Date().toISOString()
        },{onConflict:"stripe_payout_id"});
        if(q.error)throw q.error;
        await financeAlert("payout",status==="paid"?"Payout completed":"Payout status updated",
          await evaluateFinanceRules("payout",payout.id,Number(payout.amount_cents),payout.currency);
          "Stripe reported a payout lifecycle event for your creator account.",
          Number(payout.amount||0),payout.currency||"usd");
      }
    }

    let transactionId:string|null=null;
    const txIdentity=event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"
      ?{stripe_checkout_session_id:obj.id}
      :obj.payment_intent?{stripe_payment_intent_id:obj.payment_intent}
      :obj.subscription?{stripe_subscription_id:obj.subscription}:null;

    if(["checkout.session.completed","checkout.session.async_payment_succeeded","invoice.paid","charge.refunded"].includes(event.type)&&creatorId){
      const state=event.type==="charge.refunded"?"refunded":"paid";
      let existing:any=null;
      if(txIdentity?.stripe_checkout_session_id){
        const q=await supabase.from("cr_podcast_monetization_transactions").select("id").eq("stripe_checkout_session_id",txIdentity.stripe_checkout_session_id).eq("creator_id",creatorId).maybeSingle();
        if(q.error)throw q.error; existing=q.data;
      }else if(txIdentity?.stripe_payment_intent_id){
        const q=await supabase.from("cr_podcast_monetization_transactions").select("id").eq("stripe_payment_intent_id",txIdentity.stripe_payment_intent_id).eq("creator_id",creatorId).maybeSingle();
        if(q.error)throw q.error; existing=q.data;
      }else if(txIdentity?.stripe_subscription_id){
        const q=await supabase.from("cr_podcast_monetization_transactions").select("id").eq("stripe_subscription_id",txIdentity.stripe_subscription_id).eq("creator_id",creatorId).maybeSingle();
        if(q.error)throw q.error; existing=q.data;
      }
      const amount=Number(obj.amount_total??obj.amount_paid??obj.amount_refunded??obj.amount??0);
      const payload={
        creator_id:creatorId,
        product_id:productId||null,
        stripe_customer_id:obj.customer||null,
        stripe_checkout_session_id:obj.id?.startsWith("cs_")?obj.id:null,
        stripe_payment_intent_id:obj.payment_intent||null,
        stripe_subscription_id:obj.subscription||null,
        amount_cents:Math.max(0,amount),
        currency:obj.currency||"usd",
        state,
        source:"stripe",
        occurred_at:new Date(event.created*1000).toISOString()
      };
      const q=existing
        ? await supabase.from("cr_podcast_monetization_transactions").update(payload).eq("id",existing.id).select("id").single()
        : await supabase.from("cr_podcast_monetization_transactions").insert(payload).select("id").single();
      if(q.error)throw q.error;
      transactionId=q.data.id;
    }

    if(["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(event.type)&&creatorId&&userId&&productId){
      const status=event.type==="customer.subscription.deleted"?"canceled":obj.status==="past_due"?"past_due":"active";
      const q=await supabase.from("cr_podcast_entitlements").upsert({
        creator_id:creatorId,member_user_id:userId,product_id:productId,stripe_customer_id:obj.customer||null,stripe_subscription_id:obj.id,status,
        starts_at:obj.start_date?new Date(obj.start_date*1000).toISOString():null,
        ends_at:obj.cancel_at?new Date(obj.cancel_at*1000).toISOString():null
      },{onConflict:"stripe_subscription_id"});
      if(q.error)throw q.error;
    }

    const {error:ae}=await supabase.from("cr_podcast_financial_audit_events").insert({
      creator_id:creatorId,transaction_id:transactionId,webhook_event_id:null,stripe_event_id:event.id,
      action_type:event.type,details:{processed:true,metadata_present:!!creatorId,connected_account:event.account||null}
    });
    if(ae)throw ae;

    const {error:pe}=await supabase.from("cr_podcast_stripe_webhook_events").update({status:"processed",processed_at:new Date().toISOString(),error_message:null}).eq("stripe_event_id",event.id);
    if(pe)throw pe;

    return json({received:true,id:event.id});
  }catch(e){
    const message=e instanceof Error?e.message:"Webhook failed";
    if(eventId)await supabase.from("cr_podcast_stripe_webhook_events").update({status:"failed",error_message:message}).eq("stripe_event_id",eventId);
    return json({error:message,id:eventId},400);
  }
});
