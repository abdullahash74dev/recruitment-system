// AI-powered analytics insights via Lovable AI Gateway (with Gemini fallback)
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: must be admin/HR
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isHr } = await admin.rpc("is_admin_or_hr", { _user_id: u.user.id });
    if (!isHr) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { stats, lang = "ar" } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey && !geminiKey) throw new Error("No AI key configured");

    const sysPrompt = lang === "ar"
      ? "أنت محلل بيانات توظيف خبير. تعطي رؤى دقيقة وعملية. الرد JSON فقط بدون أي شرح."
      : "You are an expert recruitment data analyst. Provide concise, actionable insights. Reply ONLY in JSON without any prose.";

    const userPrompt = lang === "ar"
      ? `حلل بيانات التوظيف التالية وأرجع JSON فيه:
{
 "summary": "ملخص تنفيذي بجملتين",
 "highlights": ["3-5 نقاط بارزة"],
 "risks": ["2-3 مخاطر أو فجوات"],
 "recommendations": ["3-5 توصيات عملية للإدارة"],
 "predictions": ["2-3 توقعات للأشهر القادمة"]
}
البيانات: ${JSON.stringify(stats)}`
      : `Analyze this recruitment data and return JSON:
{
 "summary": "2-sentence executive summary",
 "highlights": ["3-5 key highlights"],
 "risks": ["2-3 risks or gaps"],
 "recommendations": ["3-5 actionable recommendations"],
 "predictions": ["2-3 predictions for coming months"]
}
Data: ${JSON.stringify(stats)}`;

    const aiResult = await callAI({
      service: "analyze-applicants",
      model: "google/gemini-2.5-flash",
      userId: u.user.id,
      userEmail: u.user.email,
      body: {
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      },
    });

    if (!aiResult.ok) {
      if (aiResult.status === 429) return new Response(JSON.stringify({ error: "rate_limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResult.status === 402) return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiResult.errorText}`);
    }

    const content = aiResult.data?.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = { summary: content }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-applicants error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
