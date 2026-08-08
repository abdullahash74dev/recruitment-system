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

// Same free-text columns client-search-applicants matches against, used here
// to narrow the ~100k pool down to a candidate shortlist BEFORE the AI call
// -- sending every applicant to the model would be slow and expensive.
const SEARCH_COLUMNS = [
  "full_name", "desired_position", "current_title", "major", "university",
  "nationality", "current_city", "preferred_city",
];

const CANDIDATE_POOL_LIMIT = 40;
const RESULT_LIMIT = 15;

// Columns fetched for the shortlist. phone/email are fetched so the results
// table can show masked teasers (same as client-search-applicants) but are
// deliberately EXCLUDED from the `compact` object sent to the AI below.
const CANDIDATE_COLUMNS = [
  "id", "full_name", "phone", "email", "desired_position", "job_type", "years_experience",
  "current_title", "current_tasks", "other_experience", "education_level",
  "major", "university", "nationality", "current_city", "preferred_city",
  "arabic_level", "english_level", "self_summary", "resume_url",
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "have", "will",
  "you", "your", "are", "our", "job", "role", "work", "years", "experience",
  "من", "في", "على", "إلى", "عن", "مع", "أو", "و", "هذا", "هذه", "التي",
  "الذي", "يكون", "لديه", "لديها", "المطلوب", "المطلوبة", "وظيفة", "خبرة",
  "سنوات", "سنة", "العمل", "لدينا", "نبحث", "يجب", "قادر", "قادرة",
]);

function sanitizeFilterValue(value: string): string {
  return String(value).replace(/[(),]/g, "").trim();
}

// Cheap JS keyword extraction -- deliberately NOT an LLM call, since that
// would double the cost/latency of every search for no real benefit.
function extractKeywords(text: string): string[] {
  const words = text
    .split(/[\s,.\/;:!?()\[\]{}"'،؛]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= 12) break;
  }
  return out;
}

// deno-lint-ignore no-explicit-any
function applyKeywordSearch(query: any, keywords: string[]) {
  if (keywords.length === 0) return query;
  const orExpr = keywords
    .flatMap((w) => SEARCH_COLUMNS.map((c) => `${c}.ilike.%${sanitizeFilterValue(w)}%`))
    .join(",");
  return query.or(orExpr);
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const s = String(phone);
  if (s.length <= 2) return s + "********";
  return s.slice(0, 2) + "********";
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const s = String(email);
  const atIdx = s.indexOf("@");
  if (atIdx <= 0) return "***";
  const first = s[0];
  const domain = s.slice(atIdx + 1);
  const parts = domain.split(".").filter(Boolean);
  const lastSeg = parts.length > 0 ? parts[parts.length - 1] : "";
  return `${first}***@***${lastSeg ? "." + lastSeg : ""}`;
}

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
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return { ok: false as const, status: res.status, errorText: await res.text() };
  const data = await res.json();
  return {
    ok: true as const,
    status: res.status,
    content: data?.choices?.[0]?.message?.content || "{}",
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
      max_tokens: 4096,
      system: systemPrompt + "\n\nRespond with ONLY a valid JSON object. No markdown, no code fences, no commentary.",
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
      .select("id, subscription_status, expires_at, credits_remaining")
      .eq("id", clientOrganizationId)
      .maybeSingle();
    if (orgError || !org) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }
    const isExpired = !!org.expires_at && new Date(org.expires_at) <= new Date();
    if (org.subscription_status !== "active" || isExpired) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }

    let body: { job_description?: unknown; lang?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const jobDescription = typeof body.job_description === "string" ? body.job_description.trim() : "";
    if (jobDescription.length < 10) {
      return json({ error: "job_description is required (min 10 characters)" }, 400);
    }
    const lang: "ar" | "en" = body.lang === "en" ? "en" : "ar";

    // 1. Narrow the pool with cheap keyword matching (no AI call).
    const keywords = extractKeywords(jobDescription);
    let poolQuery = supabaseAdmin
      .from("applicants")
      .select(CANDIDATE_COLUMNS.join(", "))
      .eq("is_archived", false);
    poolQuery = applyKeywordSearch(poolQuery, keywords);
    poolQuery = poolQuery.order("created_at", { ascending: false }).limit(CANDIDATE_POOL_LIMIT);
    const { data: pool, error: poolError } = await poolQuery;
    if (poolError) {
      return json({ error: poolError.message }, 400);
    }
    const candidates = (pool || []) as Record<string, unknown>[];
    if (candidates.length === 0) {
      return json({ results: [], candidates_scanned: 0 });
    }

    // 2. One AI call: rank the shortlist against the job description.
    const compact = candidates.map((c) => ({
      id: c.id,
      desired_position: c.desired_position,
      job_type: c.job_type,
      years_experience: c.years_experience,
      current_title: c.current_title,
      current_tasks: c.current_tasks,
      other_experience: c.other_experience,
      education_level: c.education_level,
      major: c.major,
      university: c.university,
      nationality: c.nationality,
      city: c.current_city || c.preferred_city,
      arabic_level: c.arabic_level,
      english_level: c.english_level,
      self_summary: c.self_summary,
    }));

    const systemPrompt = lang === "ar"
      ? 'أنت مساعد توظيف خبير. لديك وصف وظيفة وقائمة مرشحين. قيّم مدى ملاءمة كل مرشح للوظيفة من 0 إلى 100 مع سبب موجز بجملة واحدة. أعد JSON فقط بهذا الشكل: {"results":[{"id":"...","score":85,"reason":"..."}]}. رتب حسب الأنسب أولاً، ولا تدرج مرشحين غير مرتبطين إطلاقاً بالوظيفة (اجعل نتيجتهم أقل من 30 أو استبعدهم).'
      : 'You are an expert recruitment assistant. Given a job description and a list of candidates, score how well each candidate fits the job from 0 to 100 with a one-sentence reason. Reply with ONLY JSON in this shape: {"results":[{"id":"...","score":85,"reason":"..."}]}. Order by best fit first, and score clearly unrelated candidates below 30.';

    const userPrompt = lang === "ar"
      ? `وصف الوظيفة:\n${jobDescription}\n\nالمرشحون:\n${JSON.stringify(compact)}`
      : `Job description:\n${jobDescription}\n\nCandidates:\n${JSON.stringify(compact)}`;

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!geminiKey && !anthropicKey) {
      return json({ error: "AI not configured" }, 500);
    }
    let provider = await resolveProvider(supabaseAdmin);
    if (provider === "claude" && !anthropicKey) provider = "gemini";
    if (provider === "gemini" && !geminiKey) provider = "claude";

    const modelLogical = provider === "claude" ? "anthropic/claude-haiku-4-5" : "google/gemini-2.5-flash";
    const t0 = Date.now();
    const result = provider === "claude"
      ? await callClaude(anthropicKey!, "claude-haiku-4-5", systemPrompt, userPrompt)
      : await callGemini(geminiKey!, "gemini-2.5-flash", systemPrompt, userPrompt);

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
        service: "client-ai-job-match",
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
        metadata: { provider, client_organization_id: clientOrganizationId, candidates_scanned: candidates.length },
      });
    } catch (e) {
      console.error("ai_usage_log insert failed:", e);
    }

    if (!result.ok) {
      if (result.status === 429) return json({ error: "rate_limit" }, 429);
      return json({ error: "AI request failed" }, 502);
    }

    let parsed: { results?: { id: string; score: number; reason: string }[] };
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = { results: [] };
    }
    const scored = Array.isArray(parsed.results) ? parsed.results : [];
    const scoreById = new Map<string, { score: number; reason: string }>();
    for (const r of scored) {
      if (r && typeof r.id === "string") {
        scoreById.set(r.id, { score: Number(r.score) || 0, reason: String(r.reason || "") });
      }
    }

    // 3. Which of the scored candidates has this org already revealed --
    // same masking rule as everywhere else in the client portal.
    const scoredIds = candidates.map((c) => c.id as string).filter((id) => scoreById.has(id));
    const revealedSet = new Set<string>();
    if (scoredIds.length > 0) {
      const { data: reveals } = await supabaseAdmin
        .from("candidate_reveals")
        .select("applicant_id")
        .eq("client_organization_id", clientOrganizationId)
        .in("applicant_id", scoredIds);
      for (const r of reveals || []) revealedSet.add(r.applicant_id);
    }

    const results = candidates
      .filter((c) => scoreById.has(c.id as string))
      .map((c) => {
        const s = scoreById.get(c.id as string)!;
        const isRevealed = revealedSet.has(c.id as string);
        return {
          id: c.id,
          full_name: c.full_name,
          desired_position: c.desired_position,
          nationality: c.nationality,
          current_city: c.current_city,
          preferred_city: c.preferred_city,
          education_level: c.education_level,
          years_experience: c.years_experience,
          current_title: c.current_title,
          job_type: c.job_type,
          is_revealed: isRevealed,
          has_resume: !!c.resume_url,
          phone: isRevealed ? (c.phone as string | null) : maskPhone(c.phone as string | null),
          email: isRevealed ? (c.email as string | null) : maskEmail(c.email as string | null),
          score: s.score,
          reason: s.reason,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, RESULT_LIMIT);

    return json({ results, candidates_scanned: candidates.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
