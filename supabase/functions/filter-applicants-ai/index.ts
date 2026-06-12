// AI-powered applicant filter via direct Gemini API - Accurate & Structured
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Normalization dictionaries (Arabic <-> English) ----------
const NATIONALITY_MAP: Record<string, string> = {
  "سعودي": "saudi", "سعودية": "saudi", "السعوديه": "saudi", "السعودية": "saudi", "saudi": "saudi", "saudi arabian": "saudi", "ksa": "saudi",
  "مصري": "egyptian", "مصرية": "egyptian", "egyptian": "egyptian", "egypt": "egyptian",
  "يمني": "yemeni", "يمنية": "yemeni", "yemeni": "yemeni",
  "سوري": "syrian", "سورية": "syrian", "syrian": "syrian",
  "سوداني": "sudanese", "سودانية": "sudanese", "sudanese": "sudanese",
  "أردني": "jordanian", "اردني": "jordanian", "jordanian": "jordanian",
  "فلسطيني": "palestinian", "palestinian": "palestinian",
  "هندي": "indian", "indian": "indian", "india": "indian",
  "باكستاني": "pakistani", "pakistani": "pakistani",
  "بنغلاديشي": "bangladeshi", "bangladeshi": "bangladeshi",
  "فلبيني": "filipino", "filipino": "filipino", "philippine": "filipino",
  "نيبالي": "nepalese", "nepalese": "nepalese", "nepali": "nepalese",
};

const EDUCATION_MAP: Record<string, string> = {
  "بكالوريوس": "bachelor", "بكالوريس": "bachelor", "بكلوريوس": "bachelor", "bachelor": "bachelor", "bachelors": "bachelor", "bachelor s": "bachelor", "bachelor s degree": "bachelor", "degree": "bachelor", "bsc": "bachelor", "bs": "bachelor", "ba": "bachelor", "b.sc": "bachelor",
  "ماجستير": "master", "master": "master", "masters": "master", "master s": "master", "master s degree": "master", "msc": "master", "ms": "master", "ma": "master", "m.sc": "master",
  "دكتوراه": "phd", "phd": "phd", "doctorate": "phd", "ph.d": "phd",
  "دبلوم": "diploma", "diploma": "diploma",
  "ثانوي": "highschool", "ثانوية": "highschool", "ثانوية عامة": "highschool", "high school": "highschool", "highschool": "highschool", "secondary": "highschool",
  "متوسط": "intermediate", "intermediate": "intermediate",
  "ابتدائي": "primary", "primary": "primary",
};

const GENDER_MAP: Record<string, string> = {
  "ذكر": "male", "male": "male", "m": "male", "رجل": "male",
  "أنثى": "female", "انثى": "female", "female": "female", "f": "female", "امرأة": "female",
};

const DOMAIN_MAP: Record<string, string> = {
  "تبريد": "hvac", "تكييف": "hvac", "التبريد والتكييف": "hvac", "التكييف والتبريد": "hvac", "تبريد وتكييف": "hvac",
  "hvac": "hvac", "air conditioning": "hvac", "conditioning": "hvac", "refrigeration": "hvac", "mep": "hvac",
  "كهرباء": "electrical", "كهربائي": "electrical", "electrical": "electrical", "electrician": "electrical",
  "مدني": "civil", "civil": "civil", "quality": "quality", "جودة": "quality", "مشاريع": "project", "project": "project",
};

const CITY_ALIASES: Record<string, string[]> = {
  riyadh: ["الرياض", "الري", "riyadh", "alriyadh", "al riyadh", "riyadh saudi arabia"],
  jeddah: ["جده", "جدة", "jeddah"],
  makkah: ["مكه", "مكة", "mecca", "makkah"],
  dammam: ["الدمام", "dammam"],
  medina: ["المدينه", "المدينة", "المدينة المنورة", "medinah", "medina"],
  khobar: ["الخبر", "khobar", "al khobar"],
  taif: ["الطائف", "taif"],
  tabuk: ["تبوك", "tabuk"],
  abha: ["ابها", "abha"],
  ahsa: ["الاحساء", "الأحساء", "ahsa", "al ahsa"],
};

const AR_NUMBERS: Record<string, number> = {
  "صفر": 0, "واحد": 1, "سنه": 1, "سنة": 1, "سنتين": 2, "سنتان": 2, "اثنين": 2, "اثنان": 2,
  "ثلاث": 3, "ثلاثه": 3, "ثلاثة": 3, "اربع": 4, "اربعه": 4, "أربع": 4, "أربعة": 4,
  "خمس": 5, "خمسه": 5, "خمسة": 5, "ست": 6, "سته": 6, "ستة": 6, "سبع": 7, "سبعه": 7, "سبعة": 7,
  "ثمان": 8, "ثماني": 8, "ثمانيه": 8, "ثمانية": 8, "تسع": 9, "تسعه": 9, "تسعة": 9, "عشر": 10, "عشره": 10, "عشرة": 10,
};

function cleanText(v: any): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWith(map: Record<string, string>, v: any): string {
  if (v == null) return "";
  const s = cleanText(v);
  for (const [alias, canonical] of Object.entries(map).sort((a, b) => b[0].length - a[0].length)) {
    const a = cleanText(alias);
    if (s === a || (a.length >= 3 && s.includes(a))) return canonical;
  }
  return s;
}

function parseExperienceYears(v: any): number {
  const s = cleanText(v);
  const n = s.match(/\d{1,2}(?:\.\d+)?/);
  if (n) return Number(n[0]);
  for (const [word, val] of Object.entries(AR_NUMBERS)) {
    if (s.includes(cleanText(word))) return val;
  }
  return 0;
}

function numberTokenToValue(token: string | undefined): number | null {
  if (!token) return null;
  const t = cleanText(token);
  if (/^\d{1,2}$/.test(t)) return Number(t);
  return AR_NUMBERS[t] ?? null;
}

function normalizeCity(v: any): string {
  const s = cleanText(v);
  if (!s) return "";
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.map(cleanText).some((a) => s === a || s.includes(a))) return canonical;
  }
  return s;
}

function findCanonicalInPrompt(map: Record<string, string>, prompt: string): string | null {
  const p = cleanText(prompt);
  for (const [alias, canonical] of Object.entries(map).sort((a, b) => b[0].length - a[0].length)) {
    const a = cleanText(alias);
    if (a && (p === a || p.includes(a))) return canonical;
  }
  return null;
}

function parseYears(prompt: string): number | null {
  const p = cleanText(prompt);
  const m = p.match(/(?:خبره\s*)?(\d{1,2})\s*(?:\+|سنوات|سنه|years?|عام|اعوام)/i) || p.match(/(?:اكثر من|فوق|لا تقل عن|minimum)\s*(\d{1,2})/i);
  if (m) return Number(m[1]);
  for (const [word, val] of Object.entries(AR_NUMBERS)) {
    if (p.includes(cleanText(word)) && /خبره|سنوات|سنه|عام|اعوام/.test(p)) return val;
  }
  return null;
}

// Parse year range: "من 2 الى 3", "2-3 سنوات", "between 2 and 5"
function parseYearsRange(prompt: string): { min: number | null; max: number | null } {
  const p = cleanText(prompt);
  const numWord = "\\d{1,2}|سنتين|سنتان|اثنين|اثنان|ثلاث|ثلاثه|ثلاثة|اربع|اربعه|أربع|أربعة|خمس|خمسه|خمسة|ست|سته|ستة|سبع|سبعه|سبعة|ثمان|ثماني|ثمانيه|ثمانية|تسع|تسعه|تسعة|عشر|عشره|عشرة";
  let m = p.match(new RegExp(`(?:من|between)\\s*(${numWord})\\s*(?:الى|إلى|to|and|-)\\s*(${numWord})`, "i"))
       || p.match(new RegExp(`(${numWord})\\s*(?:الى|إلى|to|-)\\s*(${numWord})\\s*(?:سنوات|سنه|years?|عام|اعوام)`, "i"));
  if (m) return { min: numberTokenToValue(m[1]), max: numberTokenToValue(m[2]) };
  const max = p.match(/(?:اقل من|less than|under|حتى|up to)\s*(\d{1,2})/i);
  return { min: parseYears(p), max: max ? Number(max[1]) : null };
}

// Extract city from prompt
function findCity(prompt: string): string | null {
  const p = cleanText(prompt);
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.map(cleanText).some((a) => p.includes(a))) return canonical;
  }
  return null;
}

// Detect HSE / specialty keywords in prompt to build a domain match list
const SPECIALTY_KEYWORDS: Record<string, string[]> = {
  hse: ["صحه وسلامه","صحة وسلامة","سلامه مهنيه","سلامة مهنية","امن وسلامه","أمن وسلامة","health and safety","hse","safety","occupational"],
  hvac: ["تبريد","تكييف","hvac","refrigeration","air conditioning"],
  electrical: ["كهرباء","كهربائي","electrical","electrician"],
  civil: ["مدني","civil"],
  mechanical: ["ميكانيكي","mechanical"],
  it: ["تقنيه","تكنولوجيا","it","software","developer","مطور","برمج"],
  accounting: ["محاسب","accounting","accountant","finance","مالي"],
  hr: ["موارد بشريه","موارد بشرية","hr","human resources"],
};
const SPECIALTY_EXCLUDE: Record<string, string[]> = {
  hse: ["civil", "مدني", "electrical", "كهرب", "soft services", "خدمات", "project coordinator", "project management", "quality control", "qa qc", "qc"],
};
function findSpecialty(prompt: string): { key: string; aliases: string[] } | null {
  const p = cleanText(prompt);
  for (const [k, list] of Object.entries(SPECIALTY_KEYWORDS)) {
    if (list.some(x => p.includes(cleanText(x)))) return { key: k, aliases: list.map(cleanText) };
  }
  return null;
}

function localFilter(prompt: string, rows: any[], lang: string) {
  const q = cleanText(prompt);
  const nationality = findCanonicalInPrompt(NATIONALITY_MAP, q);
  const education = findCanonicalInPrompt(EDUCATION_MAP, q);
  const gender = findCanonicalInPrompt(GENDER_MAP, q);
  const domain = findCanonicalInPrompt(DOMAIN_MAP, q);
  const yearsRange = parseYearsRange(q);
  const city = findCity(q);
  const specialty = findSpecialty(q);
  const qTokens = q.split(" ").filter((t) => t.length >= 3 && !["اعطني", "ابغى", "ارغب", "لدي", "في", "من", "على", "with", "and", "the", "years"].includes(t));

  const found: { id: string; score: number; reason: string }[] = [];
  for (const a of rows) {
    const searchable = cleanText([
      a.full_name, a.desired_position, a.current_title, a.major, a.university,
      a.preferred_city, a.current_city, a.self_summary, a.current_tasks, a.other_experience,
      a.nationality, a.education_level, a.gender, a.job_type,
    ].filter(Boolean).join(" "));

    let required = 0, passed = 0, score = 35;
    const reasons: string[] = [];
    if (nationality) { required++; if (a._norm?.nationality === nationality) { passed++; score += 18; reasons.push(lang === "ar" ? "الجنسية مطابقة" : "Nationality matches"); } }
    if (education) { required++; if (a._norm?.education_level === education) { passed++; score += 14; reasons.push(lang === "ar" ? "المؤهل مطابق" : "Education matches"); } }
    if (gender) { required++; if (a._norm?.gender === gender) { passed++; score += 10; reasons.push(lang === "ar" ? "الجنس مطابق" : "Gender matches"); } }
    if (yearsRange.min != null) { required++; const years = parseExperienceYears(a.years_experience); if (years >= yearsRange.min && (yearsRange.max == null || years <= yearsRange.max)) { passed++; score += 18; reasons.push(lang === "ar" ? `خبرة ${years} سنوات` : `${years} years exp.`); } }
    if (city) { required++; if (normalizeCity(`${a.preferred_city || ""} ${a.current_city || ""}`) === city) { passed++; score += 16; reasons.push(lang === "ar" ? "المدينة مطابقة" : "City matches"); } }
    if (specialty) { required++; const excludes = (SPECIALTY_EXCLUDE[specialty.key] || []).map(cleanText); const hasExcluded = excludes.some((x) => searchable.includes(x)); const hit = specialty.aliases.some((x) => searchable.includes(x)); if (hit && !hasExcluded) { passed++; score += 22; reasons.push(lang === "ar" ? "التخصص مطابق" : "Specialty matches"); } }
    if (domain) { required++; const aliases = Object.entries(DOMAIN_MAP).filter(([, c]) => c === domain).map(([k]) => cleanText(k)); if (aliases.some((x) => searchable.includes(x))) { passed++; score += 18; reasons.push(lang === "ar" ? "المجال مطابق" : "Domain matches"); } }

    const tokenHits = qTokens.filter((t) => searchable.includes(t)).length;
    if (tokenHits) score += Math.min(15, tokenHits * 3);
    if (required > 0 && passed < required) continue;
    if (required === 0 && tokenHits === 0) continue;
    found.push({ id: a.id, score: Math.min(100, Math.round(score)), reason: reasons.slice(0, 3).join("، ") || (lang === "ar" ? "مطابقة واضحة لمعايير البحث" : "Clear match to search criteria") });
  }
  return found.sort((a, b) => b.score - a.score);
}

function normalizeRecord(a: any) {
  return {
    ...a,
    _norm: {
      nationality: normalizeWith(NATIONALITY_MAP, a.nationality),
      education_level: normalizeWith(EDUCATION_MAP, a.education_level),
      gender: normalizeWith(GENDER_MAP, a.gender),
      city: normalizeCity(`${a.preferred_city || ""} ${a.current_city || ""}`),
      years: parseExperienceYears(a.years_experience),
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const { prompt, applicants, lang = "ar" } = await req.json();
    if (!prompt || !Array.isArray(applicants)) {
      return new Response(JSON.stringify({ error: "prompt and applicants are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Normalize ahead of time
    const enriched = applicants.map(normalizeRecord);
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const fallbackMatches = () => {
      const local = localFilter(prompt, enriched, lang);
      const matchedRows = enriched.filter((a: any) => local.some((m) => m.id === a.id));
      const countBy = (key: string) => {
        const m: Record<string, number> = {};
        for (const r of matchedRows) {
          const v = r._norm?.[key] || String((r as any)[key] || "").trim() || "—";
          m[v] = (m[v] || 0) + 1;
        }
        return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ key: k, count: v }));
      };
      return new Response(JSON.stringify({
        matched: local,
        matched_ids: local.map((m) => m.id),
        total_scanned: applicants.length,
        total_matched: local.length,
        stats: {
          by_nationality: countBy("nationality"),
          by_education: countBy("education_level"),
          by_city: countBy("preferred_city"),
          by_position: countBy("desired_position"),
        },
        warnings: geminiKey ? ["ai_gateway_unavailable_local_filter_used"] : ["local_filter_used"],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    };
    if (!geminiKey) return fallbackMatches();

    const CHUNK = 80;
    const matched = new Map<string, { id: string; reason: string; score: number }>();
    const chunkErrors: string[] = [];

    // Parse hard criteria once for post-AI validation
    const hardCriteria = {
      nationality: findCanonicalInPrompt(NATIONALITY_MAP, prompt),
      education: findCanonicalInPrompt(EDUCATION_MAP, prompt),
      gender: findCanonicalInPrompt(GENDER_MAP, prompt),
      yearsRange: parseYearsRange(prompt),
      city: findCity(prompt),
      specialty: findSpecialty(prompt),
      multiEducation: /دبلوم.*بكالوريوس|بكالوريوس.*دبلوم|او\s*(?:دبلوم|بكالوريوس|ماجستير)/i.test(cleanText(prompt)),
    };

    const sys = lang === "ar"
      ? `أنت محلل توظيف صارم جداً. صفِّ المرشحين بدقة عالية وارفض أي مرشح لا يطابق جميع المعايير.
قواعد صارمة:
- لا تُرجِع أي مرشح إلا إذا طابق **كل** الشروط (الجنسية، المؤهل، نطاق الخبرة، المدينة، التخصص).
- التخصص هو الأهم: "صحة وسلامة مهنية / HSE" لا يشمل مهندس مدني أو كهربائي أو مدير خدمات.
- المرادفات متطابقة (بكالوريوس=Bachelor، سعودي=Saudi، الرياض=Riyadh). حقل _norm به القيم المُطبَّعة.
- نطاق "من 2 إلى 3 سنوات" = 2 ≤ years ≤ 3. ارفض ما خرج عن النطاق.
- الحقول الفارغة = غير مطابق إلا إذا كان المعيار غير مذكور.
- الحد الأدنى للدرجة 70.
استدعِ filter_results.`
      : `You are a strict recruitment analyst. Reject any candidate not matching ALL criteria.
- Return only if ALL criteria match (nationality, education, exp range, city, specialty).
- Specialty is critical: HSE excludes Civil/Electrical/Soft Services Managers.
- Synonyms equal (Bachelor=بكالوريوس). _norm has normalized values.
- "2 to 3 years" means 2 ≤ years ≤ 3.
- Empty field = not matching unless criterion not mentioned.
- Minimum score 70.
Call filter_results.`;

    const tools = [{
      type: "function",
      function: {
        name: "filter_results",
        description: "Return matched candidates with reason and score",
        parameters: {
          type: "object",
          properties: {
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  score: { type: "number", description: "0-100 match quality" },
                  reason: { type: "string", description: "Why matches, brief" },
                },
                required: ["id", "score", "reason"],
                additionalProperties: false,
              },
            },
          },
          required: ["matches"],
          additionalProperties: false,
        },
      },
    }];

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let usedFallback = false;
    const t0 = Date.now();

    const logUsage = async (extra: Record<string, any> = {}) => {
      try {
        const supa = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        // Approx pricing Gemini 2.5 Pro: $1.25/M input, $10/M output
        const cost = (totalPromptTokens * 1.25 + totalCompletionTokens * 10) / 1_000_000;
        await supa.from("ai_usage_log").insert({
          service: "filter-applicants-ai",
          model: "google/gemini-2.5-pro",
          prompt_tokens: totalPromptTokens,
          completion_tokens: totalCompletionTokens,
          total_tokens: totalPromptTokens + totalCompletionTokens,
          estimated_cost_usd: cost,
          status: extra.status || (chunkErrors.length ? "partial" : "success"),
          error_code: extra.error_code || null,
          duration_ms: Date.now() - t0,
          metadata: { chunk_errors: chunkErrors, lang, total_scanned: applicants.length },
        });
      } catch (e) { console.error("logUsage failed:", e); }
    };

    for (let i = 0; i < enriched.length; i += CHUNK) {
      const slice = enriched.slice(i, i + CHUNK);
      const userMsg = `Criterion / المعيار: ${prompt}\n\nCandidates (JSON):\n${JSON.stringify(slice)}`;

      try {
        const reqBody = {
          model: "gemini-2.5-pro",
          messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
          tools,
          tool_choice: { type: "function", function: { name: "filter_results" } },
        };
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${geminiKey}` },
          body: JSON.stringify(reqBody),
        });

        if (!res.ok) {
          if (res.status === 429 || res.status === 402) {
            usedFallback = true;
            await logUsage({ status: res.status === 402 ? "credits_exhausted" : "rate_limited", error_code: String(res.status) });
            return fallbackMatches();
          }
          const txt = await res.text();
          console.error(`Chunk ${i} AI error:`, res.status, txt);
          chunkErrors.push(`chunk@${i}: ${res.status}`);
          continue;
        }

        const data = await res.json();
        totalPromptTokens += Number(data.usage?.prompt_tokens || 0);
        totalCompletionTokens += Number(data.usage?.completion_tokens || 0);
        const call = data.choices?.[0]?.message?.tool_calls?.[0];
        const args = call?.function?.arguments;
        if (!args) continue;
        let parsed: any;
        try { parsed = typeof args === "string" ? JSON.parse(args) : args; } catch { continue; }
        const validIds = new Set(slice.map((a: any) => a.id));
        for (const m of parsed.matches || []) {
          if (m?.id && validIds.has(m.id)) {
            matched.set(m.id, { id: m.id, reason: String(m.reason || ""), score: Number(m.score) || 0 });
          }
        }
      } catch (e) {
        console.error(`Chunk ${i} exception:`, e);
        chunkErrors.push(`chunk@${i}: ${e instanceof Error ? e.message : "err"}`);
        continue;
      }
    }

    if (!usedFallback) await logUsage();

    // ===== HARD POST-AI VALIDATION: drop anything that doesn't truly match =====
    const rejected: { id: string; reason: string }[] = [];
    const passesHardFilter = (a: any): { ok: boolean; reason?: string } => {
      // Nationality
      if (hardCriteria.nationality && a._norm?.nationality !== hardCriteria.nationality) {
        return { ok: false, reason: "nationality_mismatch" };
      }
      // Education (allow if user said "or" any degree)
      if (hardCriteria.education && !hardCriteria.multiEducation && a._norm?.education_level !== hardCriteria.education) {
        return { ok: false, reason: "education_mismatch" };
      }
      // Gender
      if (hardCriteria.gender && a._norm?.gender !== hardCriteria.gender) {
        return { ok: false, reason: "gender_mismatch" };
      }
      // Years range
      const years = a._norm?.years ?? parseExperienceYears(a.years_experience);
      if (hardCriteria.yearsRange.min != null && years < hardCriteria.yearsRange.min) {
        return { ok: false, reason: "years_below_min" };
      }
      if (hardCriteria.yearsRange.max != null && years > hardCriteria.yearsRange.max) {
        return { ok: false, reason: "years_above_max" };
      }
      // City
      if (hardCriteria.city) {
        if (a._norm?.city !== hardCriteria.city) return { ok: false, reason: "city_mismatch" };
      }
      // Specialty / domain - check across job title, position, major, summary
      if (hardCriteria.specialty) {
        const text = cleanText([a.desired_position, a.current_title, a.major, a.self_summary, a.current_tasks, a.other_experience].filter(Boolean).join(" "));
        const excludes = (SPECIALTY_EXCLUDE[hardCriteria.specialty.key] || []).map(cleanText);
        if (excludes.some((x) => text.includes(x))) return { ok: false, reason: "specialty_excluded" };
        const hit = hardCriteria.specialty.aliases.some(x => text.includes(x));
        if (!hit) return { ok: false, reason: "specialty_mismatch" };
      }
      return { ok: true };
    };

    for (const [id, entry] of Array.from(matched.entries())) {
      const row = enriched.find((a: any) => a.id === id);
      if (!row) { matched.delete(id); continue; }
      const check = passesHardFilter(row);
      if (!check.ok) {
        rejected.push({ id, reason: check.reason || "mismatch" });
        matched.delete(id);
        continue;
      }
      if (entry.score < 70) {
        rejected.push({ id, reason: "score_below_70" });
        matched.delete(id);
      }
    }
    if (rejected.length) chunkErrors.push(`post_validation_dropped=${rejected.length}`);

    // Build aggregated stats from matched candidates
    const matchedRows = enriched.filter((a: any) => matched.has(a.id));
    const countBy = (key: string) => {
      const m: Record<string, number> = {};
      for (const r of matchedRows) {
        const v = r._norm?.[key] || String((r as any)[key] || "").trim() || "—";
        m[v] = (m[v] || 0) + 1;
      }
      return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ key: k, count: v }));
    };

    const stats = {
      by_nationality: countBy("nationality"),
      by_education: countBy("education_level"),
      by_city: countBy("preferred_city"),
      by_position: countBy("desired_position"),
    };

    return new Response(
      JSON.stringify({
        matched: Array.from(matched.values()).sort((a, b) => b.score - a.score),
        matched_ids: Array.from(matched.keys()),
        total_scanned: applicants.length,
        total_matched: matched.size,
        stats,
        warnings: chunkErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("filter-applicants-ai fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
