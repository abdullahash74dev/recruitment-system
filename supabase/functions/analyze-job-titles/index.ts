import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-helper.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isHr } = await admin.rpc("is_admin_or_hr", { _user_id: u.user.id });
    if (!isHr) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { titles } = await req.json();
    if (!Array.isArray(titles) || titles.length === 0) {
      return new Response(JSON.stringify({ error: "titles array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY) throw new Error("No AI key configured");

    const systemPrompt = `أنت خبير موارد بشرية. ستستلم قائمة مسميات وظيفية مختلطة (عربي/إنجليزي، قد تحتوي أخطاء إملائية أو ترتيب فوضوي).
مهمتك:
1. تنظيف وتصحيح كل مسمى.
2. إنتاج النسختين العربية والإنجليزية الاحترافية لكل وظيفة.
3. تصنيفها في فئات منطقية (مثل: هندسة، مالية، موارد بشرية، تقنية، إدارية، خدمات...).
4. اقتراح ترتيب ذكي حسب الأهمية والفئة.

أعد النتيجة عبر استدعاء الأداة المتاحة فقط.`;

    const aiResult = await callAI({
      service: "analyze-job-titles",
      model: "google/gemini-2.5-flash",
      userId: u.user.id,
      userEmail: u.user.email,
      body: {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `حلّل وصنّف هذه المسميات:\n${titles.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_organized_jobs",
              description: "Return cleaned, translated, categorized jobs",
              parameters: {
                type: "object",
                properties: {
                  jobs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title_ar: { type: "string" },
                        title_en: { type: "string" },
                        category: { type: "string" },
                        priority: { type: "number", description: "1-10, higher = more important/senior" },
                      },
                      required: ["title_ar", "title_en", "category", "priority"],
                    },
                  },
                  suggested_categories: { type: "array", items: { type: "string" } },
                },
                required: ["jobs", "suggested_categories"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_organized_jobs" } },
      },
    });

    if (!aiResult.ok) {
      console.error("AI error:", aiResult.status, aiResult.errorText);
      if (aiResult.status === 429) return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول لاحقاً" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResult.status === 402) return new Response(JSON.stringify({ error: "نفدت أرصدة الذكاء الاصطناعي، يرجى التعبئة" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiResult.status}`);
    }

    const toolCall = aiResult.data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");
    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-job-titles error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
