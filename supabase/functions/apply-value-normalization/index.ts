// Apply value_synonyms normalization to actual applicant data.
// Two modes:
//   - dryRun=true: returns counts of records that WOULD be changed per field/value
//   - dryRun=false: requires PIN; performs the update + audit log
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map synonym field_name -> actual applicants column(s)
const FIELD_TO_COLUMNS: Record<string, string[]> = {
  education_level: ["education_level"],
  nationality: ["nationality"],
  city: ["current_city"],
  preferred_city: ["preferred_city"],
  desired_position: ["desired_position"],
  current_title: ["current_title"],
  major: ["major"],
  university: ["university"],
  job_type: ["job_type"],
  gender: ["gender"],
  marital_status: ["marital_status"],
  arabic_level: ["arabic_level"],
  english_level: ["english_level"],
  hear_about: ["hear_about"],
  has_transport: ["has_transport"],
  currently_employed: ["currently_employed"],
  currently_studying: ["currently_studying"],
};

const normText = (s: string) =>
  String(s || "").trim().toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه")
    .replace(/['\u2019`"]/g, "")
    .replace(/[\s\-_،,.()\/]+/g, " ").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden - admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { field_names = [], dryRun = true, pin, signature } = await req.json();
    if (!Array.isArray(field_names) || field_names.length === 0) {
      return new Response(JSON.stringify({ error: "field_names required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!dryRun) {
      // Verify PIN
      if (!pin || !signature) {
        return new Response(JSON.stringify({ error: "PIN and signature required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: secret } = await admin.from("app_secrets").select("value").eq("key", "delete_pin_hash").maybeSingle();
      if (!secret?.value) {
        return new Response(JSON.stringify({ error: "No PIN configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const valid = await bcrypt.compare(String(pin), String(secret.value));
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid PIN" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Load synonyms for requested fields
    const { data: synRows } = await admin
      .from("value_synonyms")
      .select("field_name, canonical_ar, synonyms")
      .in("field_name", field_names);

    // Build lookup: per field, normalized synonym -> canonical
    const lookup = new Map<string, Map<string, string>>();
    (synRows || []).forEach((r: any) => {
      const m = lookup.get(r.field_name) || new Map<string, string>();
      const canon = String(r.canonical_ar || "").trim();
      if (!canon) return;
      [r.canonical_ar, ...(r.synonyms || [])].forEach((s: string) => {
        const n = normText(s);
        if (n) m.set(n, canon);
      });
      lookup.set(r.field_name, m);
    });

    const report: Record<string, { column: string; from: string; to: string; count: number }[]> = {};
    const totalsByField: Record<string, number> = {};
    let grandTotal = 0;
    const updatesToApply: { id: string; updates: Record<string, string> }[] = [];

    for (const field of field_names) {
      const cols = FIELD_TO_COLUMNS[field];
      if (!cols) continue;
      const fieldLookup = lookup.get(field);
      if (!fieldLookup || fieldLookup.size === 0) continue;

      // Fetch all applicants with at least one of the relevant columns set
      const selectCols = ["id", ...cols].join(",");
      const { data: apps } = await admin.from("applicants").select(selectCols).limit(10000);

      const counts = new Map<string, number>(); // "col|from->to" -> count
      (apps || []).forEach((a: any) => {
        const updates: Record<string, string> = {};
        for (const col of cols) {
          const v = a[col];
          if (!v) continue;
          const n = normText(String(v));
          const canon = fieldLookup.get(n);
          if (canon && canon !== String(v).trim()) {
            updates[col] = canon;
            const k = `${col}|${String(v).trim()}→${canon}`;
            counts.set(k, (counts.get(k) || 0) + 1);
          }
        }
        if (Object.keys(updates).length > 0) {
          updatesToApply.push({ id: a.id, updates });
        }
      });

      report[field] = Array.from(counts.entries()).map(([k, count]) => {
        const [col, rest] = k.split("|");
        const [from, to] = rest.split("→");
        return { column: col, from, to, count };
      }).sort((a, b) => b.count - a.count);
      const ft = Array.from(counts.values()).reduce((s, n) => s + n, 0);
      totalsByField[field] = ft;
      grandTotal += ft;
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        report,
        totals_by_field: totalsByField,
        grand_total: grandTotal,
        affected_applicants: new Set(updatesToApply.map(u => u.id)).size,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Apply updates — batched
    let applied = 0;
    const failures: string[] = [];
    for (const u of updatesToApply) {
      const { error } = await admin.from("applicants").update(u.updates).eq("id", u.id);
      if (error) failures.push(`${u.id}: ${error.message}`);
      else applied++;
    }

    // Audit log
    await admin.from("audit_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: "BULK_NORMALIZE",
      table_name: "applicants",
      record_id: "bulk",
      summary: `Normalized ${applied} applicants across fields: ${field_names.join(", ")}`,
      new_data: { field_names, report, signature, total_updates: applied, failures: failures.length },
    });

    return new Response(JSON.stringify({
      dryRun: false,
      applied,
      failures,
      report,
      grand_total: grandTotal,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("apply-value-normalization error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
