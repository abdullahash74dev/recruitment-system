import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Published storage quotas per Supabase plan tier (bytes). Supabase doesn't
// return a fixed byte limit via the Management API, so the actual usage
// (queried live from Postgres/Storage below, always accurate) is paired with
// the plan name resolved from the Management API to compute this limit.
// Enterprise plans are custom-negotiated, so no fixed limit is shown for them.
const PLAN_QUOTAS: Record<string, { db: number; storage: number }> = {
  free: { db: 500 * 1024 * 1024, storage: 1 * 1024 * 1024 * 1024 },
  pro: { db: 8 * 1024 * 1024 * 1024, storage: 100 * 1024 * 1024 * 1024 },
  team: { db: 8 * 1024 * 1024 * 1024, storage: 100 * 1024 * 1024 * 1024 },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolvePlanQuota(supabaseUrl: string) {
  const mgmtToken = Deno.env.get("SUPABASE_MGMT_TOKEN");
  if (!mgmtToken) return { plan: null, quota: null };

  try {
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    const projectRes = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
      headers: { Authorization: `Bearer ${mgmtToken}` },
    });
    if (!projectRes.ok) return { plan: null, quota: null };
    const project = await projectRes.json();
    const orgId = project.organization_id;
    if (!orgId) return { plan: null, quota: null };

    const orgRes = await fetch(`https://api.supabase.com/v1/organizations/${orgId}`, {
      headers: { Authorization: `Bearer ${mgmtToken}` },
    });
    if (!orgRes.ok) return { plan: null, quota: null };
    const org = await orgRes.json();

    const rawPlan = org.plan?.id ?? org.plan ?? org.tier ?? null;
    const plan = typeof rawPlan === "string" ? rawPlan.toLowerCase() : null;
    return { plan, quota: plan ? PLAN_QUOTAS[plan] ?? null : null };
  } catch (err) {
    console.error("system-health: management API lookup failed:", err);
    return { plan: null, quota: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const callerUserId = claimsData.claims.sub;

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return jsonResponse({ error: "Forbidden: admin only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "get_usage") {
      const [dbSizeRes, storageRes, tableSizesRes, planRes] = await Promise.all([
        (supabaseAdmin as any).rpc("get_db_size"),
        (supabaseAdmin as any).rpc("get_storage_usage"),
        (supabaseAdmin as any).rpc("get_table_sizes"),
        resolvePlanQuota(supabaseUrl),
      ]);

      if (dbSizeRes.error) throw dbSizeRes.error;
      if (storageRes.error) throw storageRes.error;
      if (tableSizesRes.error) throw tableSizesRes.error;

      const buckets = (storageRes.data ?? []) as { bucket_id: string; object_count: number; total_bytes: number }[];
      const storageUsedBytes = buckets.reduce((sum, b) => sum + Number(b.total_bytes), 0);

      return jsonResponse({
        plan: planRes.plan,
        db: { used_bytes: Number(dbSizeRes.data), limit_bytes: planRes.quota?.db ?? null },
        storage: {
          used_bytes: storageUsedBytes,
          limit_bytes: planRes.quota?.storage ?? null,
          buckets,
        },
        biggest_tables: tableSizesRes.data ?? [],
        fetched_at: new Date().toISOString(),
      });
    }

    if (action === "get_errors") {
      const { severity, source, limit = 100, offset = 0 } = body;
      const cappedLimit = Math.min(Number(limit) || 100, 500);

      let query = supabaseAdmin
        .from("error_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + cappedLimit - 1);

      if (severity) query = query.eq("severity", severity);
      if (source) query = query.eq("source", source);

      const { data, error, count } = await query;
      if (error) throw error;

      return jsonResponse({ rows: data ?? [], total: count ?? 0 });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("system-health error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
