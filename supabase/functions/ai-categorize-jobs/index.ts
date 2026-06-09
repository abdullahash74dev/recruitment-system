// AI-powered: categorize job titles into predefined categories.
// Input: { titles: string[], categories: [{id, name_ar, name_en}] }
// Output: { assignments: [{ title, category_id, category_name, confidence }] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { titles = [], categories = [] } = await req.json();
    if (!Array.isArray(titles) || titles.length === 0 || !Array.isArray(categories) || categories.length === 0) {
      return new Response(JSON.stringify({ error: "titles[] and categories[] required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Process in chunks of 50 titles
    const CHUNK = 50;
    const allAssignments: any[] = [];

    const categoryIds = categories.map((c: any) => c.id);
    const catLines = categories.map((c: any) => `${c.id} = ${c.name_ar}${c.name_en ? ` (${c.name_en})` : ""}`).join("\n");

    const system = `أنت خبير في تصنيف المسميات الوظيفية. صنّف كل مسمى وظيفي تحت أحد الفئات المعطاة باستخدام معرّف الفئة (id) فقط.
- اختر الفئة الأنسب لكل مسمى.
- إذا كان المسمى غامضاً أو لا يطابق، استخدم آخر فئة (أخرى).
- استدعِ assign_categories فقط.`;

    for (let i = 0; i < titles.length; i += CHUNK) {
      const slice = titles.slice(i, i + CHUNK);
      const userMsg = `الفئات المتاحة:\n${catLines}\n\nالمسميات:\n${slice.map((t: string, idx: number) => `${idx + 1}. ${t}`).join("\n")}`;

      const ai = await callAI({
        service: "ai-categorize-jobs",
        model: "google/gemini-2.5-flash",
        userId: user.id, userEmail: user.email || null,
        body: {
          messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
          tools: [{
            type: "function",
            function: {
              name: "assign_categories",
              description: "Assign each title to a category id",
              parameters: {
                type: "object",
                properties: {
                  assignments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        category_id: { type: "string", enum: categoryIds },
                        confidence: { type: "number" },
                      },
                      required: ["title", "category_id"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["assignments"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "assign_categories" } },
        },
      });

      if (ai.ok) {
        const toolCall = ai.data?.choices?.[0]?.message?.tool_calls?.[0];
        const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : { assignments: [] };
        if (Array.isArray(args.assignments)) allAssignments.push(...args.assignments);
      }
    }

    // Enrich with category names
    const catMap = new Map(categories.map((c: any) => [c.id, c]));
    const enriched = allAssignments.map((a: any) => {
      const c: any = catMap.get(a.category_id);
      return { ...a, category_name: c?.name_ar || "—" };
    });

    return new Response(JSON.stringify({ assignments: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-categorize-jobs error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
