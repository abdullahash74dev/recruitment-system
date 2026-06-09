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
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { field_name, source_table, source_column, autosave = false } = await req.json();
    if (!field_name || !ALLOWED_TABLES.has(source_table) || !ALLOWED_COLUMNS.has(source_column)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: rows } = await admin.from(source_table).select(source_column);
    const values = Array.from(new Set((rows || []).map((r: any) => (r[source_column] || "").toString().trim()).filter(Boolean)));
    if (values.length === 0) {
      return new Response(JSON.stringify({ groups: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const system = `أنت خبير في توحيد البيانات ثنائية اللغة (عربي/إنجليزي). مهمتك تجميع القيم المتشابهة لنفس المفهوم تحت قيمة قانونية (canonical) بالعربية والإنجليزية. تجاهل الأخطاء الإملائية والاختلافات الطفيفة.`;
    const prompt = `حقل: ${field_name}\nالقيم الخام:\n${values.slice(0, 400).map(v => `- ${v}`).join("\n")}\n\nأعد JSON فقط عبر استدعاء الأداة.`;

    const ai = await callAI({
      service: "ai-suggest-synonyms",
      model: "google/gemini-2.5-flash",
      userId: user.id, userEmail: user.email || null,
      body: {
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        tools: [{
          type: "function",
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
        }],
        tool_choice: { type: "function", function: { name: "submit_groups" } },
      },
    });

    if (!ai.ok) {
      return new Response(JSON.stringify({ error: "AI failed", details: ai.errorText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const toolCall = ai.data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : { groups: [] };
    const groups: Array<{ canonical_ar: string; canonical_en: string; synonyms: string[] }> = args.groups || [];

    if (autosave && groups.length) {
      const rows = groups.map(g => ({
        field_name,
        canonical_ar: g.canonical_ar,
        canonical_en: g.canonical_en,
        synonyms: g.synonyms || [],
      }));
      await admin.from("value_synonyms").upsert(rows, { onConflict: "field_name,canonical_ar" });
    }

    return new Response(JSON.stringify({ groups, saved: autosave }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-suggest-synonyms error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
