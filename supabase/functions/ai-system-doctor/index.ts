// AI System Doctor — analyzes recent system errors and suggests fixes
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { lang = "ar", clientErrors = [] } = await req.json().catch(() => ({}));

    // Pull recent suspicious audit_log entries (failed logins, deletes, errors in summary)
    const { data: logs } = await admin.from("audit_log")
      .select("occurred_at, user_email, action, table_name, summary, new_data, old_data")
      .order("occurred_at", { ascending: false })
      .limit(200);

    const suspicious = (logs || []).filter((r: any) => {
      const s = (r.summary || "").toLowerCase();
      return r.action === "LOGIN_FAILED" || r.action === "DELETE" || s.includes("error") || s.includes("fail") || s.includes("خطأ") || s.includes("فشل");
    }).slice(0, 80);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey && !geminiKey) throw new Error("No AI key configured");

    const sys = lang === "ar"
      ? "أنت مهندس موثوقية أنظمة خبير. حلّل الأخطاء وقدّم تشخيصاً وحلولاً عملية واضحة. الرد JSON فقط."
      : "You are an expert site reliability engineer. Analyze errors and give clear, actionable fixes. Reply ONLY in JSON.";

    const userPrompt = lang === "ar"
      ? `حلّل بيانات النظام التالية وأعد JSON:
{
 "health_score": 0-100,
 "summary": "ملخص حالة النظام بجملتين",
 "issues": [{"title":"","severity":"low|medium|high|critical","root_cause":"","fix_steps":["خطوة 1","خطوة 2"],"auto_fixable":true|false}],
 "recommendations": ["توصيات وقائية"]
}

سجل النظام (آخر العمليات المشبوهة): ${JSON.stringify(suspicious)}
أخطاء الواجهة من المتصفح: ${JSON.stringify(clientErrors)}`
      : `Analyze and return JSON:
{
 "health_score": 0-100,
 "summary": "2-sentence system status",
 "issues": [{"title":"","severity":"low|medium|high|critical","root_cause":"","fix_steps":["step 1"],"auto_fixable":true|false}],
 "recommendations": ["preventive tips"]
}
Audit log: ${JSON.stringify(suspicious)}
Browser errors: ${JSON.stringify(clientErrors)}`;

    const aiResult = await callAI({
      service: "ai-system-doctor",
      model: "google/gemini-2.5-flash",
      userId: u.user.id,
      userEmail: u.user.email,
      body: {
        messages: [{ role: "system", content: sys }, { role: "user", content: userPrompt }],
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
    try { parsed = JSON.parse(content); } catch { parsed = { summary: content, issues: [], recommendations: [] }; }
    parsed.analyzed_count = suspicious.length;
    parsed.client_error_count = clientErrors.length;

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-system-doctor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
