// AI Insights — on-demand AI summary of the recruitment pipeline:
// applicant trends, status breakdown, demand for open positions, and
// actionable recommendations for admins. Stateless (no history persisted).
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type ApplicantRow = { status: string | null; desired_position: string | null; created_at: string; is_archived: boolean | null };
type JobRow = { title_ar: string; title_en: string | null; is_active: boolean };

function buildStats(applicants: ApplicantRow[], jobs: JobRow[]) {
  const active = applicants.filter((a) => a.is_archived !== true);

  // Counts grouped by status
  const statusCounts: Record<string, number> = {};
  for (const a of active) {
    const s = a.status || "unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  // Top 5 most common desired positions
  const positionCounts: Record<string, number> = {};
  for (const a of active) {
    const p = (a.desired_position || "").trim();
    if (!p) continue;
    positionCounts[p] = (positionCounts[p] || 0) + 1;
  }
  const topPositions = Object.entries(positionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([position, count]) => ({ position, count }));

  // Created in last 7 days vs previous 7 days
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const last7Start = now - 7 * day;
  const prev7Start = now - 14 * day;
  let last7 = 0;
  let prev7 = 0;
  for (const a of active) {
    const t = new Date(a.created_at).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= last7Start) last7++;
    else if (t >= prev7Start && t < last7Start) prev7++;
  }

  // Job postings: active vs total, and which active postings have the
  // fewest matching applicants (rough match on desired_position).
  const totalJobs = jobs.length;
  const activeJobs = jobs.filter((j) => j.is_active === true);

  const normalize = (s: string | null | undefined) => (s || "").trim().toLowerCase();
  const jobDemand = activeJobs.map((j) => {
    const titleAr = j.title_ar || "";
    const titleEn = j.title_en || "";
    const tAr = normalize(titleAr);
    const tEn = normalize(titleEn);
    const matching = active.filter((a) => {
      const p = normalize(a.desired_position);
      if (!p) return false;
      return (tAr && (p.includes(tAr) || tAr.includes(p))) || (tEn && (p.includes(tEn) || tEn.includes(p)));
    }).length;
    return { title_ar: titleAr, title_en: titleEn, matching_applicants: matching };
  }).sort((a, b) => a.matching_applicants - b.matching_applicants).slice(0, 5);

  return {
    total_active_applicants: active.length,
    status_counts: statusCounts,
    top_desired_positions: topPositions,
    new_applicants_last_7_days: last7,
    new_applicants_previous_7_days: prev7,
    total_job_postings: totalJobs,
    active_job_postings: activeJobs.length,
    active_jobs_with_low_demand: jobDemand,
  };
}

type InsightsResult = { parsed: any } | { error: string; status: number };

async function generateInsights(lang: string, stats: any, userId: string | null, userEmail: string | null): Promise<InsightsResult> {
  const sys = lang === "ar"
    ? "أنت محلل توظيف خبير. حلّل إحصائيات نظام التوظيف التالية وقدّم رؤى مفيدة وموجزة. الرد JSON فقط."
    : "You are an expert recruitment analyst. Analyze the following recruitment system statistics and provide useful, concise insights. Reply ONLY in JSON.";

  const userPrompt = lang === "ar"
    ? `حلّل إحصائيات نظام التوظيف التالية وأعد JSON بهذا الشكل فقط:
{
 "summary": "ملخص عام بـ 2-3 جمل عن صحة خط التوظيف",
 "highlights": ["نقطة مختصرة 1", "نقطة مختصرة 2"],
 "applicant_insights": ["رؤى عن اتجاهات المتقدمين والوظائف المطلوبة"],
 "job_insights": ["رؤى عن الوظائف الشاغرة مقارنة بالطلب"],
 "recommendations": ["توصية عملية قابلة للتنفيذ"]
}

الإحصائيات: ${JSON.stringify(stats)}`
    : `Analyze the following recruitment system statistics and return ONLY JSON in this shape:
{
 "summary": "2-3 sentence overall summary of recruitment pipeline health",
 "highlights": ["short bullet 1", "short bullet 2"],
 "applicant_insights": ["insight about applicant trends/positions"],
 "job_insights": ["insight about job postings vs demand"],
 "recommendations": ["actionable recommendation"]
}

Statistics: ${JSON.stringify(stats)}`;

  const aiResult = await callAI({
    service: "ai-insights",
    model: "google/gemini-2.5-flash",
    userId,
    userEmail,
    body: {
      messages: [{ role: "system", content: sys }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
    },
  });

  if (!aiResult.ok) {
    if (aiResult.status === 429) return { error: "rate_limit", status: 429 };
    if (aiResult.status === 402) return { error: "credits_exhausted", status: 402 };
    throw new Error(`AI error: ${aiResult.errorText}`);
  }

  const content = aiResult.data?.choices?.[0]?.message?.content || "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { summary: content, highlights: [], applicant_insights: [], job_insights: [], recommendations: [] };
  }
  return { parsed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Manual trigger only: caller must be an authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const lang: string = body?.lang === "ar" ? "ar" : "en";

    const [{ data: applicants }, { data: jobs }] = await Promise.all([
      admin.from("applicants").select("status, desired_position, created_at, is_archived").limit(2000),
      admin.from("job_postings").select("title_ar, title_en, is_active"),
    ]);

    const stats = buildStats((applicants as ApplicantRow[]) || [], (jobs as JobRow[]) || []);

    const result = await generateInsights(lang, stats, u.user.id, u.user.email ?? null);
    if ("error" in result) {
      return new Response(JSON.stringify(result), { status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ...result.parsed,
      stats,
      generated_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
