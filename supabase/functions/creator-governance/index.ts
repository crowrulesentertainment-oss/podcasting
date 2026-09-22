import { withSupabase } from "npm:@supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERMISSIONS: Record<string, string[]> = {
  creator: ["view", "create"],
  admin: ["view", "create", "review", "approve", "execute", "rollback", "govern"],
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonicalChanges(changes: any[]) {
  return changes.map((c, i) => ({
    ordinal: i,
    collection_id: String(c.collection_id ?? c.collectionId ?? ""),
    task_key: String(c.task_key ?? c.key ?? ""),
    task_name: String(c.task_name ?? c.name ?? ""),
    before_owner: c.before_owner ?? c.before ?? null,
    after_owner: c.after_owner ?? c.after ?? null,
  }));
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const userId = ctx.userClaims?.sub;
    const email = ctx.userClaims?.email ?? null;
    if (!userId) return json({ error: "AUTH_REQUIRED" }, 401);

    const { data: roleRow, error: roleError } = await ctx.supabaseAdmin
      .from("creator_governance_roles")
      .select("role,is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError) return json({ error: roleError.message }, 500);

    const role = roleRow?.is_active ? roleRow.role : null;
    const permissions = role ? (PERMISSIONS[role] ?? []) : [];
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = String(body.action ?? "context");

    if (action === "context") {
      return json({
        verified: true,
        userId,
        email,
        role,
        permissions,
        serverAuthorized: !!role,
      });
    }

    if (!role) return json({ error: "GOVERNANCE_ROLE_REQUIRED" }, 403);

    if (action === "list") {
      const client = role === "admin" ? ctx.supabaseAdmin : ctx.supabase;
      const { data: transactions, error } = await client
        .from("creator_governance_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return json({ error: error.message }, 500);

      const ids = (transactions ?? []).map((t: any) => t.id);
      let changes: any[] = [];
      if (ids.length) {
        const { data, error: changeError } = await client
          .from("creator_governance_transaction_changes")
          .select("*")
          .in("transaction_id", ids)
          .order("ordinal", { ascending: true });
        if (changeError) return json({ error: changeError.message }, 500);
        changes = data ?? [];
      }

      const { data: audit, error: auditError } = await client
        .from("creator_governance_audit_ledger")
        .select("*")
        .order("sequence", { ascending: false })
        .limit(100);
      if (auditError) return json({ error: auditError.message }, 500);

      return json({ transactions: transactions ?? [], changes, audit: audit ?? [] });
    }

    if (action === "assignments") {
      const client = role === "admin" ? ctx.supabaseAdmin : ctx.supabase;
      const { data, error } = await client
        .from("creator_governance_assignments")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) return json({ error: error.message }, 500);
      return json({ assignments: data ?? [] });
    }

    if (action === "create") {
      if (!permissions.includes("create")) return json({ error: "CREATE_FORBIDDEN" }, 403);
      const scenarioId = body.scenario_id ? String(body.scenario_id).slice(0, 200) : null;
      const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
      const changes = canonicalChanges(Array.isArray(body.changes) ? body.changes : []);

      if (!changes.length || changes.length > 100) {
        return json({ error: "INVALID_CHANGE_COUNT" }, 400);
      }
      if (changes.some((c) => !c.collection_id || !c.task_key || c.after_owner === undefined)) {
        return json({ error: "INVALID_CHANGE" }, 400);
      }

      const manifestHash = await sha256(JSON.stringify(changes));
      const { data: transaction, error } = await ctx.supabaseAdmin
        .from("creator_governance_transactions")
        .insert({
          scenario_id: scenarioId,
          actor_user_id: userId,
          status: "PENDING",
          manifest_hash: manifestHash,
          metadata,
          preflight: { valid: true, checkedAt: new Date().toISOString(), server: true },
        })
        .select("*")
        .single();

      if (error) return json({ error: error.message }, 500);

      const rows = changes.map((c, ordinal) => ({
        transaction_id: transaction.id,
        ordinal,
        collection_id: c.collection_id,
        task_key: c.task_key,
        task_name: c.task_name,
        before_owner: c.before_owner,
        after_owner: c.after_owner,
      }));

      const { error: changeError } = await ctx.supabaseAdmin
        .from("creator_governance_transaction_changes")
        .insert(rows);

      if (changeError) return json({ error: changeError.message }, 500);

      await ctx.supabaseAdmin.rpc("creator_governance_audit_append", {
        p_transaction_id: transaction.id,
        p_actor_user_id: userId,
        p_action: "transaction.create",
        p_payload: { scenario_id: scenarioId, change_count: changes.length, manifest_hash: manifestHash },
      });

      return json({ transaction, changes });
    }

    if (action === "transition") {
      const target = String(body.status ?? "");
      const id = String(body.transaction_id ?? "");
      if (!id || !target) return json({ error: "TRANSACTION_AND_STATUS_REQUIRED" }, 400);

      if (target === "REVIEW" && !permissions.includes("review")) {
        if (!permissions.includes("create")) return json({ error: "REVIEW_FORBIDDEN" }, 403);
      }
      if (target === "APPROVED" && !permissions.includes("approve")) return json({ error: "APPROVAL_FORBIDDEN" }, 403);
      if (target === "ARCHIVED" && !permissions.includes("govern")) return json({ error: "GOVERNANCE_FORBIDDEN" }, 403);

      const { data, error } = await ctx.supabaseAdmin.rpc("creator_governance_transition", {
        p_transaction_id: id,
        p_actor_user_id: userId,
        p_target_status: target,
      });
      if (error) return json({ error: error.message }, 403);
      return json({ transaction: data });
    }

    if (action === "execute") {
      if (!permissions.includes("execute")) return json({ error: "EXECUTE_FORBIDDEN" }, 403);
      const id = String(body.transaction_id ?? "");
      if (!id) return json({ error: "TRANSACTION_REQUIRED" }, 400);
      const { data, error } = await ctx.supabaseAdmin.rpc("creator_governance_execute", {
        p_transaction_id: id,
        p_actor_user_id: userId,
      });
      if (error) return json({ error: error.message }, 403);
      const { data: executedChanges } = await ctx.supabaseAdmin
        .from("creator_governance_transaction_changes").select("*").eq("transaction_id",id).order("ordinal",{ascending:true});
      const uuidLike=(v:any)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v??""));
      const recipients=new Map<string,any>();
      for(const ch of (executedChanges??[])){
        for(const owner of [ch.after_owner,ch.before_owner]){
          if(uuidLike(owner)&&owner!==userId)recipients.set(String(owner),ch);
        }
      }
      for(const [recipient,ch] of recipients){
        const {data:p}=await ctx.supabaseAdmin.from("creator_governance_notification_preferences").select("*").eq("user_id",recipient).maybeSingle();
        if(p?.enabled===false||p?.assignments===false)continue;
        await ctx.supabaseAdmin.from("creator_governance_notifications").insert({
          recipient_user_id:recipient,actor_user_id:userId,type:"assignment",priority:"NORMAL",action_required:true,title:"Assignment Changed",
          message:`The assignment for ${ch.task_name||ch.task_key} changed.`,collection_id:ch.collection_id,task_key:ch.task_key,
          task_name:ch.task_name,transaction_id:id,payload:{before_owner:ch.before_owner,after_owner:ch.after_owner}
        });
      }
      return json({ transaction: data, changes: executedChanges??[] });
    }

    if (action === "rollback") {
      if (!permissions.includes("rollback")) return json({ error: "ROLLBACK_FORBIDDEN" }, 403);
      const id = String(body.transaction_id ?? "");
      if (!id) return json({ error: "TRANSACTION_REQUIRED" }, 400);
      const { data, error } = await ctx.supabaseAdmin.rpc("creator_governance_rollback", {
        p_transaction_id: id,
        p_actor_user_id: userId,
      });
      if (error) return json({ error: error.message }, 403);
      return json({ transaction: data });
    }

    if (action === "locks") {
      const { data, error } = await ctx.supabaseAdmin
        .from("creator_governance_task_locks")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("heartbeat_at", { ascending: false })
        .limit(1000);
      if (error) return json({ error: error.message }, 500);
      return json({ locks: data ?? [] });
    }

    if (action === "lock") {
      if (!permissions.includes("create")) return json({ error: "LOCK_FORBIDDEN" }, 403);
      const collectionId = String(body.collection_id ?? "");
      const taskKey = String(body.task_key ?? "");
      const taskName = String(body.task_name ?? taskKey).slice(0, 300);
      if (!collectionId || !taskKey) return json({ error: "TASK_REQUIRED" }, 400);
      const { data, error } = await ctx.supabaseAdmin.rpc("creator_governance_claim_task_lock", {
        p_collection_id: collectionId,
        p_task_key: taskKey,
        p_owner_user_id: userId,
        p_owner_name: email,
        p_lease_seconds: 45,
      });
      if (error) return json({ error: error.message }, 409);
      return json({ lock: data, task_name: taskName });
    }

    if (action === "heartbeat") {
      if (!permissions.includes("create")) return json({ error: "LOCK_FORBIDDEN" }, 403);
      const collectionId = String(body.collection_id ?? "");
      const taskKey = String(body.task_key ?? "");
      if (!collectionId || !taskKey) return json({ error: "TASK_REQUIRED" }, 400);
      const { data, error } = await ctx.supabaseAdmin.rpc("creator_governance_heartbeat_task_lock", {
        p_collection_id: collectionId,
        p_task_key: taskKey,
        p_owner_user_id: userId,
        p_lease_seconds: 45,
      });
      if (error) return json({ error: error.message }, 409);
      return json({ lock: data });
    }

    if (action === "unlock") {
      if (!permissions.includes("create")) return json({ error: "LOCK_FORBIDDEN" }, 403);
      const collectionId = String(body.collection_id ?? "");
      const taskKey = String(body.task_key ?? "");
      if (!collectionId || !taskKey) return json({ error: "TASK_REQUIRED" }, 400);
      const { data, error } = await ctx.supabaseAdmin.rpc("creator_governance_release_task_lock", {
        p_collection_id: collectionId,
        p_task_key: taskKey,
        p_owner_user_id: userId,
      });
      if (error) return json({ error: error.message }, 409);
      return json({ released: data });
    }

    if (action === "notification-route") {
      if(!permissions.includes("create"))return json({error:"NOTIFICATION_ROUTING_FORBIDDEN"},403);
      const recipient=String(body.recipient_user_id??""); const type=String(body.type??"system");
      if(!recipient)return json({error:"RECIPIENT_REQUIRED"},400);
      const priority=["CRITICAL","HIGH","NORMAL","LOW"].includes(String(body.priority))?String(body.priority):"NORMAL";
      const actionRequired=body.action_required!==false;
      const dedupeKey=body.dedupe_key?String(body.dedupe_key).slice(0,300):null;
      const {data:p}=await ctx.supabaseAdmin.from("creator_governance_notification_preferences").select("*").eq("user_id",recipient).maybeSingle();
      const prefKey=type==="handoff"?"handoffs":type==="assignment"?"assignments":type==="lock"?"locks":"system";
      if(p?.enabled===false||p?.[prefKey]===false||(p?.action_required_only===true&&!actionRequired))return json({routed:false,reason:"PREFERENCE_FILTER"});
      const now=new Date(); const quiet=p?.quiet_hours_enabled===true&&p.quiet_start&&p.quiet_end;
      if(quiet&&priority!=="CRITICAL"&&priority!=="HIGH"){
        const hm=now.toTimeString().slice(0,5),start=String(p.quiet_start).slice(0,5),end=String(p.quiet_end).slice(0,5);
        const inside=start<=end?(hm>=start&&hm<end):(hm>=start||hm<end); if(inside)return json({routed:false,reason:"QUIET_HOURS"});
      }
      if(dedupeKey){const {data:existing}=await ctx.supabaseAdmin.from("creator_governance_notifications").select("id").eq("recipient_user_id",recipient).eq("dedupe_key",dedupeKey).maybeSingle();if(existing)return json({routed:false,reason:"DEDUPED",notification_id:existing.id});}
      const {data:n,error}=await ctx.supabaseAdmin.from("creator_governance_notifications").insert({
        recipient_user_id:recipient,actor_user_id:userId,type,priority,action_required,dedupe_key:dedupeKey,group_key:body.group_key?String(body.group_key).slice(0,300):type,
        title:String(body.title??"Production Notification").slice(0,200),message:String(body.message??"").slice(0,1000),
        collection_id:body.collection_id??null,task_key:body.task_key??null,task_name:body.task_name??null,transaction_id:body.transaction_id??null,
        expires_at:body.expires_at??null,payload:body.payload??{}
      }).select("*").single();
      if(error)return json({error:error.message},500);
      await ctx.supabaseAdmin.from("creator_governance_notification_audit").insert({notification_id:n.id,actor_user_id:userId,action:"routed",payload:{priority,action_required}});
      return json({routed:true,notification:n});
    }
    if (action === "escalate") {
      if(!permissions.includes("govern"))return json({error:"ESCALATION_FORBIDDEN"},403);
      const {data:candidates,error:ce}=await ctx.supabaseAdmin.rpc("creator_governance_escalation_candidates");
      if(ce)return json({error:ce.message},500);
      const results=[];
      const roles=await ctx.supabaseAdmin.from("creator_governance_roles").select("user_id,role").eq("is_active",true).in("role",["admin","team_lead"]);
      for(const h of (candidates??[])){
        const targets=(roles.data??[]).filter((r:any)=>r.user_id!==h.from_user_id&&r.user_id!==h.to_user_id);
        const target=targets[0]; if(!target)continue;
        const {data:e}=await ctx.supabaseAdmin.from("creator_governance_escalations").upsert({handoff_id:h.id,collection_id:h.collection_id,task_key:h.task_key,reason:"HANDOFF_UNANSWERED",level:1,target_user_id:target.user_id},{onConflict:"handoff_id,level,target_user_id"}).select("*").maybeSingle();
        const {data:p}=await ctx.supabaseAdmin.from("creator_governance_notification_preferences").select("*").eq("user_id",target.user_id).maybeSingle();
        if(e&&p?.enabled!==false)await ctx.supabaseAdmin.from("creator_governance_notifications").upsert({recipient_user_id:target.user_id,actor_user_id:userId,type:"system",priority:"CRITICAL",action_required:true,dedupe_key:"escalation:"+h.id,title:"Handoff Escalated",message:`Handoff for ${h.task_name||h.task_key} was escalated because it was not answered.`,collection_id:h.collection_id,task_key:h.task_key,handoff_id:h.id,payload:{escalation_id:e.id}},{onConflict:"recipient_user_id,dedupe_key"});
        await ctx.supabaseAdmin.from("creator_governance_handoffs").update({escalated_at:new Date().toISOString()}).eq("id",h.id);
        results.push(e);
      }
      return json({escalated:results});
    }
    if (action === "health") {
      if(!permissions.includes("view"))return json({error:"HEALTH_FORBIDDEN"},403);
      const [tasks,health,reports]=await Promise.all([
        ctx.supabaseAdmin.from("creator_governance_tasks").select("*").order("target_date",{ascending:true,nullsLast:true}),
        ctx.supabaseAdmin.from("creator_governance_task_health").select("*").order("health_score",{ascending:true}),
        ctx.supabaseAdmin.from("creator_governance_health_reports").select("*").order("report_date",{ascending:false}).limit(14)
      ]);
      return json({tasks:tasks.data??[],health:health.data??[],reports:reports.data??[]});
    }
    if (action === "notifications") {
      const { data, error } = await ctx.supabaseAdmin.from("creator_governance_notifications").select("*")
        .eq("recipient_user_id", userId).order("created_at",{ascending:false}).limit(100);
      if(error)return json({error:error.message},500);
      return json({notifications:data??[]});
    }
    if (action === "notification-read") {
      const id=String(body.notification_id??""); if(!id)return json({error:"NOTIFICATION_REQUIRED"},400);
      const {data,error}=await ctx.supabaseAdmin.from("creator_governance_notifications").update({read_at:new Date().toISOString()})
        .eq("id",id).eq("recipient_user_id",userId).select("*").maybeSingle();
      if(error)return json({error:error.message},500); if(!data)return json({error:"NOTIFICATION_NOT_FOUND"},404);
      await ctx.supabaseAdmin.from("creator_governance_notification_audit").insert({notification_id:id,actor_user_id:userId,action:"read"});
      return json({notification:data});
    }
    if (action === "preferences") {
      if(req.method==="GET"){
        const {data,error}=await ctx.supabaseAdmin.from("creator_governance_notification_preferences").select("*").eq("user_id",userId).maybeSingle();
        if(error)return json({error:error.message},500);
        return json({preferences:data??{user_id:userId,enabled:true,handoffs:true,assignments:true,locks:true,system:true}});
      }
      const allowed=["enabled","handoffs","assignments","locks","system"]; const patch:any={user_id:userId,updated_at:new Date().toISOString()};
      for(const k of allowed)if(typeof body[k]==="boolean")patch[k]=body[k];
      const {data,error}=await ctx.supabaseAdmin.from("creator_governance_notification_preferences").upsert(patch).select("*").single();
      if(error)return json({error:error.message},500); return json({preferences:data});
    }
    if (action === "handoffs") {
      const {data,error}=await ctx.supabaseAdmin.from("creator_governance_handoffs").select("*")
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`).order("created_at",{ascending:false}).limit(100);
      if(error)return json({error:error.message},500); return json({handoffs:data??[]});
    }
    if (action === "handoff") {
      if(!permissions.includes("create"))return json({error:"HANDOFF_FORBIDDEN"},403);
      const collectionId=String(body.collection_id??""),taskKey=String(body.task_key??""),toUserId=String(body.to_user_id??"");
      if(!collectionId||!taskKey||!toUserId)return json({error:"HANDOFF_FIELDS_REQUIRED"},400);
      const {data:h,error:he}=await ctx.supabaseAdmin.from("creator_governance_handoffs").insert({
        collection_id:collectionId,task_key:taskKey,task_name:String(body.task_name??taskKey).slice(0,300),
        from_user_id:userId,to_user_id:toUserId,note:String(body.note??"").slice(0,1000)
      }).select("*").single();
      if(he)return json({error:he.message},500);
      const {data:p}=await ctx.supabaseAdmin.from("creator_governance_notification_preferences").select("*").eq("user_id",toUserId).maybeSingle();
      if(p?.enabled!==false&&p?.handoffs!==false)await ctx.supabaseAdmin.from("creator_governance_notifications").insert({
        recipient_user_id:toUserId,actor_user_id:userId,type:"handoff",priority:"HIGH",action_required:true,title:"Incoming Handoff",
        message:`A creator requested a handoff for ${String(body.task_name??taskKey)}.`,collection_id:collectionId,task_key:taskKey,
        task_name:String(body.task_name??taskKey),handoff_id:h.id,payload:{note:String(body.note??"")}
      });
      return json({handoff:h});
    }
    if (action === "handoff-response") {
      if(!permissions.includes("create"))return json({error:"HANDOFF_FORBIDDEN"},403);
      const id=String(body.handoff_id??""),status=String(body.status??"");
      if(!id||!["ACCEPTED","DECLINED"].includes(status))return json({error:"HANDOFF_RESPONSE_INVALID"},400);
      const {data:h,error:he}=await ctx.supabaseAdmin.from("creator_governance_handoffs").update({status,responded_at:new Date().toISOString()})
        .eq("id",id).eq("to_user_id",userId).eq("status","PENDING").select("*").maybeSingle();
      if(he)return json({error:he.message},500); if(!h)return json({error:"HANDOFF_NOT_FOUND_OR_ALREADY_RESPONDED"},409);
      const {data:p}=await ctx.supabaseAdmin.from("creator_governance_notification_preferences").select("*").eq("user_id",h.from_user_id).maybeSingle();
      if(p?.enabled!==false&&p?.handoffs!==false)await ctx.supabaseAdmin.from("creator_governance_notifications").insert({
        recipient_user_id:h.from_user_id,actor_user_id:userId,type:"handoff",priority:"HIGH",action_required:true,title:`Handoff ${status==="ACCEPTED"?"Accepted":"Declined"}`,
        message:`Your handoff request for ${h.task_name||h.task_key} was ${status.toLowerCase()}.`,collection_id:h.collection_id,task_key:h.task_key,
        task_name:h.task_name,handoff_id:h.id,payload:{status}
      });
      return json({handoff:h});
    }
    if (action === "audit") {
      if (!permissions.includes("govern")) return json({ error: "GOVERNANCE_FORBIDDEN" }, 403);
      const id = body.transaction_id ? String(body.transaction_id) : null;
      const auditAction = String(body.audit_action ?? "governance.action").slice(0, 120);
      const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
      const { data, error } = await ctx.supabaseAdmin.rpc("creator_governance_audit_append", {
        p_transaction_id: id,
        p_actor_user_id: userId,
        p_action: auditAction,
        p_payload: payload,
      });
      if (error) return json({ error: error.message }, 403);
      return json({ audit: data });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  }),
};
