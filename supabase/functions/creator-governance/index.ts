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
      return json({ transaction: data });
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
