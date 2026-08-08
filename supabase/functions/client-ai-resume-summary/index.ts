import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Only non-PII fields client-applicant-profile already shows for free --
// never phone/email. This is a *summary of the free profile*, not a new
// data surface, so it deliberately does not require (or consume) a reveal.
const SUMMARY_SOURCE_COLUMNS = [
  "id", "full_name", "gender", "nationality", "current_city", "preferred_city",
  "education_level", "major", "university", "graduation_year", "gpa",
  "desired_position", "job_type", "years_experience", "currently_employed",
  "current_title", "current_tasks", "other_experience", "facility_management_exp",
  "arabic_level", "english_level", "other_language", "self_summary",
].join(", ");

// deno-lint-ignore no-explicit-any
async function resolveProvider(supa: any): Promise<"gemini" | "claude"> {
  try {
    const { data } = await supa.from("ai_settings").select("provider").limit(1).maybeSingle();
    return data?.provider === "claude" ? "claude" : "gemini";
  } catch {
    return "gemini";
  }
}

async function callGemini(geminiKey: string, model: string, systemPrompt: string, userPrompt: string) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${geminiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) return { ok: false as const, status: res.status, errorText: await res.text() };
  const data = await res.json();
  return {
    ok: true as const,
    status: res.status,
    content: data?.choices?.[0]?.message?.content || "",
    promptTokens: Number(data?.usage?.prompt_tokens || 0),
    completionTokens: Number(data?.usage?.completion_tokens || 0),
  };
}

async function callClaude(anthropicKey: string, model: string, systemPrompt: string, userPrompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) return { ok: false as const, status: res.status, errorText: await res.text() };
  const data = await res.json();
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
  return {
    ok: true as const,
    status: res.status,
    content: text,
    promptTokens: Number(data?.usage?.input_tokens || 0),
    completionTokens: Number(data?.usage?.output_tokens || 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerUserId = claimsData.claims.sub;
    const callerEmail = (claimsData.claims as { email?: string }).email ?? null;

    const { data: clientUser, error: clientUserError } = await supabaseAdmin
      .from("client_users")
      .select("id, client_organization_id, is_active")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (clientUserError || !clientUser || !clientUser.is_active) {
      return json({ error: "Not an active client user" }, 403);
    }
    const clientOrganizationId = clientUser.client_organization_id;

    const { data: org, error: orgError } = await supabaseAdmin
      .from("client_organizations")
      .select("id, subscription_status, expires_at")
      .eq("id", clientOrganizationId)
      .maybeSingle();
    if (orgError || !org) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }
    const isExpired = !!org.expires_at && new Date(org.expires_at) <= new Date();
    if (org.subscription_status !== "active" || isExpired) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }

    let body: { applicant_id?: unknown; lang?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const applicantId = body.applicant_id;
    if (typeof applicantId !== "string" || applicantId.trim().length === 0) {
      return json({ error: "applicant_id is required" }, 400);
    }
    const lang: "ar" | "en" = body.lang === "en" ? "en" : "ar";
    const summaryColumn = lang === "ar" ? "summary_ar" : "summary_en";

    // 1. Cache check -- generated once ever, reused by every org from then on.
    const { data: cached } = await supabaseAdmin
      .from("applicant_ai_summaries")
      .select("summary_ar, summary_en, generated_at")
      .eq("applicant_id", applicantId)
      .maybeSingle();
    const cachedValue = cached ? (cached as Record<string, unknown>)[summaryColumn] : null;
    if (typeof cachedValue === "string" && cachedValue.trim().length > 0) {
      return json({ summary: cachedValue, cached: true, generated_at: cached!.generated_at });
    }

    // 2. Fetch the same non-PII fields the free profile view already shows.
    const { data: applicant, error: applicantError } = await supabaseAdmin
      .from("applicants")
      .select(SUMMARY_SOURCE_COLUMNS)
      .eq("id", applicantId)
      .maybeSingle();
    if (applicantError || !applicant) {
      return json({ error: "Applicant not found" }, 404);
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!geminiKey && !anthropicKey) {
      return json({ error: "AI not configured" }, 500);
    }
    let provider = await resolveProvider(supabaseAdmin);
    if (provider === "claude" && !anthropicKey) provider = "gemini";
    if (provider === "gemini" && !geminiKey) provider = "claude";

    const systemPrompt = lang === "ar"
      ? "أنت مساعد توظيف خبير. اكتب ملخصاً احترافياً موجزاً (٣-٥ جمل) لملف مرشح للوظائف، يبرز مؤهلاته وخبرته وأبرز نقاط قوته لمسؤول التوظيف. لا تخترع معلومات غير موجودة في البيانات. اكتب نص عادي بدون تنسيق JSON أو Markdown."
      : "You are an expert recruitment assistant. Write a concise professional summary (3-5 sentences) of a job candidate's profile, highlighting their qualifications, experience, and key strengths for a recruiter. Do not invent information not present in the data. Reply with plain text, no JSON or Markdown.";

    const userPrompt = lang === "ar"
      ? `بيانات المرشح:\n${JSON.stringify(applicant)}`
      : `Candidate data:\n${JSON.stringify(applicant)}`;

    const modelLogical = provider === "claude" ? "anthropic/claude-haiku-4-5" : "google/gemini-2.5-flash";
    const t0 = Date.now();
    const result = provider === "claude"
      ? await callClaude(anthropicKey!, "claude-haiku-4-5", systemPrompt, userPrompt)
      : await callGemini(geminiKey!, "gemini-2.5-flash", systemPrompt, userPrompt);

    // Best-effort usage log -- mirrors _shared/ai-helper.ts's schema so this
    // shows up in the same admin AI-usage dashboard as every other AI call.
    try {
      const PRICE: Record<string, { in: number; out: number }> = {
        "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
        "anthropic/claude-haiku-4-5": { in: 1, out: 5 },
      };
      const p = PRICE[modelLogical] || { in: 1, out: 4 };
      const promptTokens = result.ok ? result.promptTokens : 0;
      const completionTokens = result.ok ? result.completionTokens : 0;
      const cost = (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
      await supabaseAdmin.from("ai_usage_log").insert({
        service: "client-ai-resume-summary",
        model: modelLogical,
        user_id: callerUserId,
        user_email: callerEmail,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        estimated_cost_usd: cost,
        status: result.ok ? "success" : (result.status === 429 ? "rate_limited" : "error"),
        error_code: result.ok ? null : String(result.status || "exception"),
        duration_ms: Date.now() - t0,
        metadata: { provider, client_organization_id: clientOrganizationId, applicant_id: applicantId, lang },
      });
    } catch (e) {
      console.error("ai_usage_log insert failed:", e);
    }

    if (!result.ok) {
      if (result.status === 429) return json({ error: "rate_limit" }, 429);
      return json({ error: "AI request failed" }, 502);
    }

    const summary = result.content.trim();
    if (!summary) {
      return json({ error: "AI returned an empty summary" }, 502);
    }

    // 3. Cache the result (upsert touches only this lang's column).
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from("applicant_ai_summaries").upsert(
      { applicant_id: applicantId, [summaryColumn]: summary, generated_at: nowIso },
      { onConflict: "applicant_id" }
    );

    return json({ summary, cached: false, generated_at: nowIso });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
