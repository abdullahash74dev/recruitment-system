// AI-powered: convert natural language description → structured advanced filters
// Input: { description, lang?, distinct_values: Record<field, string[]> }
// Output: { filters: [{ field, value, reason }] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_FIELDS = [
  "nationality","desired_position","preferred_city","current_city","gender","marital_status",
  "education_level","major","university","job_type","years_experience","current_title",
  "currently_employed","has_transport","arabic_level","english_level","hear_about","source","source_company",
];

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
    const { data: isHr } = await admin.rpc("is_admin_or_hr", { _user_id: user.id });
    if (!isHr) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { description, lang = "ar", distinct_values = {} } = await req.json();
    if (!description || typeof description !== "string") {
      return new Response(JSON.stringify({ error: "description required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build a compact catalog of available values per field
    const catalog: Record<string, string[]> = {};
    for (const f of ALLOWED_FIELDS) {
      const vs = Array.isArray(distinct_values[f]) ? distinct_values[f].slice(0, 80) : [];
      if (vs.length) catalog[f] = vs;
    }

    const system = lang === "ar"
      ? `أنت مساعد توظيف خبير. مهمتك تحويل وصف نصي طبيعي إلى مجموعة فلاتر منظمة على بيانات المتقدمين.
- استخدم فقط القيم الفعلية الموجودة في القوائم المعطاة (catalog). لا تخترع قيماً جديدة.
- إذا كان الوصف يشمل "سعودي" أو "saudi"، اختر كل القيم الموجودة في nationality التي تطابق (سعودي، السعودية، Saudi، ksa...). اختر متعدد عند اللزوم.
- نفس المنطق للمدن والمؤهلات والوظائف.
- لكل فلتر اذكر سبب اختياره باختصار.
- استخدم الدالة build_filters فقط.`
      : `You are a recruiting assistant. Convert a natural-language description into structured filters over applicant data.
- ONLY use values that actually exist in the provided catalog. Never invent values.
- If user mentions a concept (e.g. "Saudi"), include ALL matching values from nationality (سعودي, Saudi, KSA, ...).
- Same logic for cities, education, positions.
- For each filter, include a short reason.
- Call build_filters only.`;

    const userMsg = `Description: ${description}\n\nAvailable catalog (field -> existing values):\n${JSON.stringify(catalog, null, 2)}`;

    const ai = await callAI({
      service: "ai-build-filters",
      model: "google/gemini-2.5-flash",
      userId: user.id, userEmail: user.email || null,
      body: {
        messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
        tools: [{
          type: "function",
          function: {
            name: "build_filters",
            description: "Submit a list of structured filters",
            parameters: {
              type: "object",
              properties: {
                filters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string", enum: ALLOWED_FIELDS },
                      value: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["field", "value", "reason"],
                    additionalProperties: false,
                  },
                },
                summary: { type: "string" },
              },
              required: ["filters"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "build_filters" } },
      },
    });

    if (!ai.ok) {
      return new Response(JSON.stringify({ error: "AI failed", details: ai.errorText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const toolCall = ai.data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : { filters: [] };
    const rawFilters: Array<{ field: string; value: string; reason: string }> = Array.isArray(args.filters) ? args.filters : [];

    // Validate each filter against the catalog (case-insensitive)
    const normalized: typeof rawFilters = [];
    for (const f of rawFilters) {
      if (!ALLOWED_FIELDS.includes(f.field)) continue;
      const vals = catalog[f.field] || [];
      const match = vals.find(v => v.trim().toLowerCase() === String(f.value).trim().toLowerCase());
      if (match) normalized.push({ field: f.field, value: match, reason: f.reason });
    }

    return new Response(JSON.stringify({ filters: normalized, summary: args.summary || "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-build-filters error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
