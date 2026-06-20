// Suggests synonym groupings for a given field by analyzing distinct values in DB using AI.
// Body: { field_name, source_table, source_column, lang? } -> { groups: [{ canonical_ar, canonical_en, synonyms: string[] }] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TABLES = new Set(["applicants", "recruitment_candidates", "job_postings"]);
const ALLOWED_COLUMNS = new Set([
  "education_level","nationality","current_city","preferred_city","desired_position",
  "current_title","major","university","job_type","department",
]);

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
    const { data: isAdmin, error: roleError } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (roleError) {
      console.error("has_role check failed:", roleError);
      return new Response(JSON.stringify({ error: "Role check failed", details: roleError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { field_name, source_table, source_column, autosave = false } = await req.json();
    if (!field_name || !ALLOWED_TABLES.has(source_table) || !ALLOWED_COLUMNS.has(source_column)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: rows } = await admin.from(source_table).select(source_column);
    const counts = new Map<string, number>();
    (rows || []).forEach((r: any) => {
      const v = (r[source_column] || "").toString().trim();
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    });
    // Most common values first, so if a field has more distinct values than fit in one
    // batch, the ones affecting the most records still get grouped in the first pass.
    const values = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([v]) => v);
    if (values.length === 0) {
      return new Response(JSON.stringify({ groups: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const system = `أنت خبير في توحيد البيانات ثنائية اللغة (عربي/إنجليزي). مهمتك تجميع القيم المتشابهة لنفس المفهوم تحت قيمة قانونية (canonical) بالعربية والإنجليزية. تجاهل الأخطاء الإملائية والاختلافات الطفيفة.`;

    const submitGroupsTool = {
      type: "function" as const,
      function: {
        name: "submit_groups",
        description: "Submit normalized synonym groups",
        parameters: {
          type: "object",
          properties: {
            groups: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  canonical_ar: { type: "string" },
                  canonical_en: { type: "string" },
                  synonyms: { type: "array", items: { type: "string" } },
                },
                required: ["canonical_ar", "canonical_en", "synonyms"],
                additionalProperties: false,
              },
            },
          },
          required: ["groups"],
          additionalProperties: false,
        },
      },
    };

    // Process in batches so a field with hundreds of distinct values (e.g. job titles
    // with lots of spelling variants) gets every value grouped, not just the first 400.
    const CHUNK_SIZE = 400;
    const groups: Array<{ canonical_ar: string; canonical_en: string; synonyms: string[] }> = [];
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);
      const prompt = `حقل: ${field_name}\nالقيم الخام:\n${chunk.map(v => `- ${v}`).join("\n")}\n\nأعد JSON فقط عبر استدعاء الأداة.`;
      const ai = await callAI({
        service: "ai-suggest-synonyms",
        model: "google/gemini-2.5-flash",
        userId: user.id, userEmail: user.email || null,
        body: {
          messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
          tools: [submitGroupsTool],
          tool_choice: { type: "function", function: { name: "submit_groups" } },
        },
      });
      if (!ai.ok) {
        if (groups.length > 0) break; // keep whatever batches already succeeded
        return new Response(JSON.stringify({ error: "AI failed", details: ai.errorText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const toolCall = ai.data?.choices?.[0]?.message?.tool_calls?.[0];
      const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : { groups: [] };
      groups.push(...(args.groups || []));
    }

    if (autosave && groups.length) {
      // Different batches can independently land on the same canonical_ar (e.g. a common
      // job title); merge those before upserting so a single statement never targets the
      // same (field_name, canonical_ar) conflict key twice.
      const byCanonical = new Map<string, { canonical_ar: string; canonical_en: string; synonyms: Set<string> }>();
      for (const g of groups) {
        const existing = byCanonical.get(g.canonical_ar);
        if (existing) {
          (g.synonyms || []).forEach(s => existing.synonyms.add(s));
        } else {
          byCanonical.set(g.canonical_ar, { canonical_ar: g.canonical_ar, canonical_en: g.canonical_en, synonyms: new Set(g.synonyms || []) });
        }
      }
      const rows = Array.from(byCanonical.values()).map(g => ({
        field_name,
        canonical_ar: g.canonical_ar,
        canonical_en: g.canonical_en,
        synonyms: Array.from(g.synonyms),
      }));
      await admin.from("value_synonyms").upsert(rows, { onConflict: "field_name,canonical_ar" });
    }

    return new Response(JSON.stringify({ groups, saved: autosave }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-suggest-synonyms error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
