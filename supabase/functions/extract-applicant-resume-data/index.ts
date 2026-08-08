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

// Only fields that make sense to auto-fill from a résumé -- never
// full_name/phone/email (the applicant typed those directly in the form;
// letting AI silently rewrite identity/contact fields is a real-world
// integrity risk, not a convenience) and never internal fields
// (status/notes/source/is_archived/submission_token_hash/file paths).
const TARGET_FIELDS = [
  "gender", "nationality", "birth_date", "marital_status", "current_city", "preferred_city",
  "has_transport", "linkedin",
  "education_level", "major", "university", "graduation_year", "gpa",
  "desired_position", "job_type", "years_experience", "currently_employed", "current_title",
  "current_salary", "expected_salary", "available_date", "current_tasks", "other_experience",
  "facility_management_exp", "arabic_level", "english_level", "other_language", "self_summary",
] as const;

const FIELD_HINTS_AR: Record<(typeof TARGET_FIELDS)[number], string> = {
  gender: "الجنس (ذكر/أنثى)",
  nationality: "الجنسية",
  birth_date: "تاريخ الميلاد (YYYY-MM-DD إن أمكن)",
  marital_status: "الحالة الاجتماعية",
  current_city: "المدينة الحالية للمرشح",
  preferred_city: "المدينة المفضلة للعمل",
  has_transport: "هل يملك وسيلة نقل (نعم/لا)",
  linkedin: "رابط حساب لينكدإن إن وُجد",
  education_level: "المؤهل العلمي (بكالوريوس/دبلوم/ماجستير...)",
  major: "التخصص الدراسي",
  university: "اسم الجامعة أو الكلية",
  graduation_year: "سنة التخرج",
  gpa: "المعدل التراكمي",
  desired_position: "المسمى الوظيفي الذي يبحث عنه المرشح",
  job_type: "نوع الوظيفة المطلوبة (دوام كامل/جزئي/عن بعد...)",
  years_experience: "إجمالي سنوات الخبرة العملية",
  currently_employed: "هل هو موظف حالياً (نعم/لا)",
  current_title: "المسمى الوظيفي الحالي أو الأخير",
  current_salary: "الراتب الحالي أو الأخير إن ذُكر",
  expected_salary: "الراتب المتوقع إن ذُكر",
  available_date: "تاريخ التوفر للعمل إن ذُكر",
  current_tasks: "ملخص موجز للمهام الوظيفية الحالية أو الأخيرة",
  other_experience: "ملخص موجز لخبرات عملية أخرى سابقة",
  facility_management_exp: "خبرة في إدارة المرافق إن وُجدت",
  arabic_level: "مستوى إتقان اللغة العربية",
  english_level: "مستوى إتقان اللغة الإنجليزية",
  other_language: "أي لغة أخرى يتقنها المرشح",
  self_summary: "نبذة مختصرة (٢-٣ جمل) عن المرشح مبنية فعلياً على محتوى السيرة الذاتية",
};

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function guessMime(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return null; // doc/docx: no reliable direct-document extraction path, skip
}

// Deno's stack-safe base64 encoder for potentially-large files -- avoids
// String.fromCharCode(...bytes) blowing the call stack on big résumés.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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

function buildPrompt(): string {
  const fieldList = TARGET_FIELDS.map((f) => `"${f}": ${FIELD_HINTS_AR[f]}`).join("\n");
  return `أنت مساعد استخراج بيانات من ملف سيرة ذاتية (CV) لمرشح توظيف. اقرأ الملف المرفق كاملاً واستخرج المعلومات التالية إن وُجدت فعلياً في الملف، وأعدها بصيغة JSON فقط بالمفاتيح التالية بالضبط (لا تضف أي مفتاح آخر، ولا تكتب أي نص خارج الـJSON):

${fieldList}

قواعد مهمة:
- إذا لم تجد معلومة معينة في الملف، اجعل قيمتها null -- لا تخمّن ولا تخترع أي معلومة غير موجودة فعلياً.
- اكتب القيم بنفس اللغة الظاهرة في الملف (عربي أو إنجليزي).
- كل القيم يجب أن تكون نصوص (string) أو null، ما عدا ذلك مرفوض.`;
}

async function callGeminiExtract(geminiKey: string, mimeType: string, base64: string) {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "أنت مساعد دقيق لاستخراج بيانات هيكلية من الوثائق. لا تخترع معلومات." }] },
        contents: [{ role: "user", parts: [{ text: buildPrompt() }, { inlineData: { mimeType, data: base64 } }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) return { ok: false as const, status: res.status, errorText: await res.text() };
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return {
    ok: true as const,
    status: res.status,
    content: text,
    promptTokens: Number(data?.usageMetadata?.promptTokenCount || 0),
    completionTokens: Number(data?.usageMetadata?.candidatesTokenCount || 0),
  };
}

async function callClaudeExtract(anthropicKey: string, mimeType: string, base64: string) {
  const isPdf = mimeType === "application/pdf";
  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: "أنت مساعد دقيق لاستخراج بيانات هيكلية من الوثائق. لا تخترع معلومات. أعد JSON فقط بدون أي نص إضافي أو أسوار كود.",
      messages: [{ role: "user", content: [contentBlock, { type: "text", text: buildPrompt() }] }],
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
    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    // Callable two ways: internally by upload-file (service-role bearer,
    // fire-and-forget right after a résumé upload), or later by an
    // admin-triggered manual re-extraction action (admin user JWT). No
    // client-portal or public access either way.
    let isAuthorized = token === serviceRoleKey;
    if (!isAuthorized) {
      const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData } = await anonClient.auth.getClaims(token);
      if (claimsData?.claims?.sub) {
        const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
          _user_id: claimsData.claims.sub,
          _role: "admin",
        });
        isAuthorized = !!isAdmin;
      }
    }
    if (!isAuthorized) {
      return json({ error: "Unauthorized" }, 403);
    }

    let body: { applicant_id?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const applicantId = body.applicant_id;
    if (typeof applicantId !== "string" || applicantId.trim().length === 0) {
      return json({ error: "applicant_id is required" }, 400);
    }

    const { data: settings } = await supabaseAdmin
      .from("resume_extraction_settings")
      .select("enabled")
      .eq("id", true)
      .maybeSingle();
    if (settings?.enabled === false) {
      return json({ skipped: true, reason: "disabled" });
    }

    const { data: applicant, error: applicantError } = await supabaseAdmin
      .from("applicants")
      .select(["id", "resume_url", ...TARGET_FIELDS].join(", "))
      .eq("id", applicantId)
      .maybeSingle();
    if (applicantError || !applicant) {
      return json({ error: "Applicant not found" }, 404);
    }
    const a = applicant as Record<string, unknown>;
    const resumePath = a.resume_url as string | null;
    if (!resumePath) {
      return json({ skipped: true, reason: "no_resume" });
    }
    const mimeType = guessMime(resumePath);
    if (!mimeType) {
      return json({ skipped: true, reason: "unsupported_file_type" });
    }

    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage.from("resumes").download(resumePath);
    if (downloadError || !fileBlob) {
      return json({ error: "Failed to download résumé file" }, 500);
    }
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const base64 = bytesToBase64(bytes);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!geminiKey && !anthropicKey) {
      return json({ error: "AI not configured" }, 500);
    }
    let provider = await resolveProvider(supabaseAdmin);
    if (provider === "claude" && !anthropicKey) provider = "gemini";
    if (provider === "gemini" && !geminiKey) provider = "claude";

    const modelLogical = provider === "claude" ? "anthropic/claude-sonnet-4-6" : "google/gemini-2.5-flash";
    const t0 = Date.now();
    const result = provider === "claude"
      ? await callClaudeExtract(anthropicKey!, mimeType, base64)
      : await callGeminiExtract(geminiKey!, mimeType, base64);

    try {
      const PRICE: Record<string, { in: number; out: number }> = {
        "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
        "anthropic/claude-sonnet-4-6": { in: 3, out: 15 },
      };
      const p = PRICE[modelLogical] || { in: 1, out: 4 };
      const promptTokens = result.ok ? result.promptTokens : 0;
      const completionTokens = result.ok ? result.completionTokens : 0;
      const cost = (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
      await supabaseAdmin.from("ai_usage_log").insert({
        service: "extract-applicant-resume-data",
        model: modelLogical,
        user_id: null,
        user_email: null,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        estimated_cost_usd: cost,
        status: result.ok ? "success" : (result.status === 429 ? "rate_limited" : "error"),
        error_code: result.ok ? null : String(result.status || "exception"),
        duration_ms: Date.now() - t0,
        metadata: { provider, applicant_id: applicantId },
      });
    } catch (e) {
      console.error("ai_usage_log insert failed:", e);
    }

    if (!result.ok) {
      await supabaseAdmin.from("applicant_resume_extractions").upsert(
        { applicant_id: applicantId, status: "error", error_message: `AI request failed (${result.status})`, model: modelLogical, extracted_at: new Date().toISOString() },
        { onConflict: "applicant_id" }
      );
      if (result.status === 429) return json({ error: "rate_limit" }, 429);
      return json({ error: "AI request failed" }, 502);
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(result.content);
    } catch {
      extracted = {};
    }

    // Fill ONLY currently-blank fields -- never overwrite anything the
    // applicant actually typed into the form themselves.
    const applyObj: Record<string, string> = {};
    for (const field of TARGET_FIELDS) {
      const extractedValue = extracted[field];
      if (typeof extractedValue !== "string" || extractedValue.trim().length === 0) continue;
      if (isBlank(a[field])) {
        applyObj[field] = extractedValue.trim();
      }
    }

    if (Object.keys(applyObj).length > 0) {
      const { error: updateError } = await supabaseAdmin.from("applicants").update(applyObj).eq("id", applicantId);
      if (updateError) {
        console.error("Failed to apply extracted fields:", updateError);
      }
    }

    await supabaseAdmin.from("applicant_resume_extractions").upsert(
      {
        applicant_id: applicantId,
        extracted_data: extracted,
        applied_fields: Object.keys(applyObj),
        model: modelLogical,
        status: "success",
        error_message: null,
        extracted_at: new Date().toISOString(),
      },
      { onConflict: "applicant_id" }
    );

    return json({ extracted, applied_fields: Object.keys(applyObj) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
