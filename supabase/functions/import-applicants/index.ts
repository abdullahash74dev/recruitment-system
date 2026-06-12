// Bulk import applicants with AI-assisted validation, salary normalization,
// duplicate detection, and remote attachment download to internal storage.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Strict ordered columns — must match template exactly
const REQUIRED_COLUMNS = [
  "full_name","gender","nationality","birth_date","marital_status","dependents",
  "phone","email","current_city","has_transport",
  "desired_position","job_type","preferred_city","hear_about",
  "education_level","major","university","graduation_year","gpa","currently_studying",
  "years_experience","currently_employed","current_title","current_tasks","self_summary","other_experience",
  "arabic_level","english_level","other_language","linkedin",
  "facility_management_exp","current_salary","expected_salary","available_date",
  "resume_url","degree_url","experience_cert_url","training_certs_url","other_docs_url",
  "notes","status",
];

function normalizeSalary(v: any): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  // already plain number
  const num = s.replace(/[^\d.]/g, "");
  if (!num) return s;
  // detect range "4000 - 5000" / "4000 إلى 5000" / "4,000 to 4,999"
  const rng = s.match(/(\d[\d,\.]*)\s*(?:-|–|to|إلى|الى|حتى)\s*(\d[\d,\.]*)/i);
  if (rng) {
    const a = parseFloat(rng[1].replace(/,/g, ""));
    const b = parseFloat(rng[2].replace(/,/g, ""));
    if (!isNaN(a) && !isNaN(b)) return String(Math.round((a + b) / 2));
  }
  const above = s.match(/(?:>|أعلى من|اكثر من|أكثر من|more than|above)\s*(\d[\d,\.]*)/i);
  if (above) return String(parseFloat(above[1].replace(/,/g, "")));
  const single = parseFloat(num.replace(/,/g, ""));
  return isNaN(single) ? s : String(Math.round(single));
}

function toLatinDigits(v: any): string {
  return String(v ?? "")
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .trim();
}

function buildBirthDate(y: number, mo: number, d: number): string | null {
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const oldestAllowed = new Date(Date.UTC(now.getUTCFullYear() - 100, now.getUTCMonth(), now.getUTCDate()));
  if (dt > today || dt < oldestAllowed) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalizeBirthDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v).trim())) {
    const n = Number(v);
    if (n > 0 && n < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30 + Math.floor(n)));
      return buildBirthDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }
  const s = toLatinDigits(v);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (m[3].length === 2) y += y < 50 ? 2000 : 1900;
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    return buildBirthDate(y, b, a) || buildBirthDate(y, a, b);
  }
  const iso = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (iso) return buildBirthDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) || buildBirthDate(Number(iso[1]), Number(iso[3]), Number(iso[2]));
  return null;
}

function normalizeCreatedAt(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v).trim())) {
    const n = Number(v);
    if (n > 0 && n < 80000) {
      const base = new Date(Date.UTC(1899, 11, 30));
      return new Date(base.getTime() + n * 86400000).toISOString();
    }
  }
  const s = toLatinDigits(v).replace(/[،,]/g, " ").replace(/\s+/g, " ");
  const ampm = /(pm|مساء|\bم\b)/i.test(s) ? "pm" : /(am|صباح|\bص\b)/i.test(s) ? "am" : "";
  const clean = s.replace(/(am|pm|صباحاً|صباحا|صباح|مساءً|مساء|\b[صم]\b\.?)/gi, "").trim();
  const make = (y: number, mo: number, d: number, h = 0, mi = 0, sec = 0) => {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h < 0 || h > 23 || mi < 0 || mi > 59 || sec < 0 || sec > 59) return null;
    const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, sec));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString() : null;
  };
  const iso = clean.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/);
  if (iso) {
    let h = Number(iso[4] || 0);
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    return make(Number(iso[1]), Number(iso[2]), Number(iso[3]), h, Number(iso[5] || 0), Number(iso[6] || 0))
      || make(Number(iso[1]), Number(iso[3]), Number(iso[2]), h, Number(iso[5] || 0), Number(iso[6] || 0));
  }
  const m = clean.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/);
  if (!m) return null;
  let y = parseInt(m[3], 10);
  if (m[3].length === 2) y += y < 50 ? 2000 : 1900;
  let h = Number(m[4] || 0);
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return make(y, Number(m[2]), Number(m[1]), h, Number(m[5] || 0), Number(m[6] || 0))
    || make(y, Number(m[1]), Number(m[2]), h, Number(m[5] || 0), Number(m[6] || 0));
}

function validateRow(row: any): string[] {
  const errs: string[] = [];
  if (!row.full_name || String(row.full_name).trim().length < 2) errs.push("full_name مفقود");
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email).trim())) errs.push("email غير صالح");
  if (row.phone && String(row.phone).replace(/\D/g, "").length < 7) errs.push("phone قصير");
  if (row.birth_date && !normalizeBirthDate(row.birth_date)) errs.push("تاريخ ميلاد غير منطقي");
  return errs;
}

function isBlockedIp(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || host === "0" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
  const ipv4 = host.match(/(?:^|:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)?.[1] || host;
  const parts = ipv4.split(".").map((p) => Number(p));
  if (parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)) {
    const [a, b] = parts;
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  return false;
}

async function isSafeRemoteUrl(parsed: URL): Promise<boolean> {
  if (parsed.protocol !== "https:") return false;
  if (isBlockedIp(parsed.hostname)) return false;
  try {
    const [aRecords, aaaaRecords] = await Promise.all([
      Deno.resolveDns(parsed.hostname, "A").catch(() => []),
      Deno.resolveDns(parsed.hostname, "AAAA").catch(() => []),
    ]);
    const resolved = [...aRecords, ...aaaaRecords];
    return resolved.length > 0 && resolved.every((ip) => !isBlockedIp(ip));
  } catch {
    return false;
  }
}

async function downloadAttachment(supabase: any, url: string, applicantSlug: string, kind: string): Promise<string | null> {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed; // keep as-is if not a URL
  // SSRF guard
  let parsed: URL;
  try { parsed = new URL(trimmed); } catch { return trimmed; }
  if (!(await isSafeRemoteUrl(parsed))) return trimmed;
  try {
    const r = await fetch(trimmed, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return trimmed;
    const ct = r.headers.get("content-type") || "application/octet-stream";
    const cl = Number(r.headers.get("content-length") || "0");
    if (cl && cl > 15 * 1024 * 1024) return trimmed;
    const ext = ct.includes("pdf") ? "pdf" : ct.includes("png") ? "png" : ct.includes("jpeg") ? "jpg" : ct.includes("word") ? "docx" : "bin";
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return trimmed;
    // Store in PRIVATE resumes bucket — HR-only access via signed URLs / RLS
    const path = `imported/${applicantSlug}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("resumes").upload(path, buf, { contentType: ct, upsert: true });
    if (error) return trimmed;
    return path; // store storage path, not public URL
  } catch {
    return trimmed;
  }
}

async function aiAnalyze(rows: any[]): Promise<{ insights: string; flags: Record<number, string[]> }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return { insights: "", flags: {} };
  const sample = rows.slice(0, 50).map((r, i) => ({ i, full_name: r.full_name, email: r.email, phone: r.phone, current_salary: r.current_salary, expected_salary: r.expected_salary, education_level: r.education_level }));
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a recruitment data validator. Check rows for: invalid emails, suspicious salaries (zero/negative/extreme), placeholder names. Return JSON {flags: {rowIndex: [reasons]}, summary: \"...\"}. Reasons in Arabic." },
          { role: "user", content: JSON.stringify(sample) },
        ],
      }),
    });
    if (!r.ok) return { insights: "", flags: {} };
    const j = await r.json();
    const txt = j.choices?.[0]?.message?.content || "{}";
    const m = txt.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : {};
    return { insights: parsed.summary || "", flags: parsed.flags || {} };
  } catch { return { insights: "", flags: {} }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdminHr } = await supabase.rpc("is_admin_or_hr", { _user_id: u.user.id });
    if (!isAdminHr) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { headers, rows, useAi = true, downloadAttachments = true } = await req.json();

    // Strict order check
    if (!Array.isArray(headers) || headers.length !== REQUIRED_COLUMNS.length || headers.some((h: string, i: number) => h !== REQUIRED_COLUMNS[i])) {
      return new Response(JSON.stringify({
        error: "ترتيب الأعمدة لا يطابق القالب الرسمي. يرجى استخدام القالب المحمّل من النظام.",
        expected: REQUIRED_COLUMNS,
        received: headers,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "لا توجد بيانات" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // AI flags
    const ai = useAi ? await aiAnalyze(rows) : { insights: "", flags: {} };

    // Pre-load existing for dup check
    const { data: existing } = await supabase.from("applicants").select("email,phone,full_name");
    const existingKeys = new Set((existing || []).map((e: any) =>
      `${(e.email || "").toLowerCase().trim()}|${(e.phone || "").replace(/\D/g, "")}|${(e.full_name || "").toLowerCase().trim()}`
    ));

    const valid: any[] = [];
    const errors: any[] = [];
    const seenInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const r = { ...rows[i] };
      const errs = validateRow(r);
      const aiFlags = ai.flags[i] || ai.flags[String(i)] || [];
      if (aiFlags.length) errs.push(...aiFlags.map((f: string) => `AI: ${f}`));

      // Normalize salaries
      r.current_salary = normalizeSalary(r.current_salary);
      r.expected_salary = normalizeSalary(r.expected_salary);

      // Dup key
      const key = `${(r.email || "").toLowerCase().trim()}|${String(r.phone || "").replace(/\D/g, "")}|${(r.full_name || "").toLowerCase().trim()}`;
      if (existingKeys.has(key)) errs.push("مكرر مع متقدم موجود");
      if (seenInBatch.has(key)) errs.push("مكرر داخل نفس الملف");
      seenInBatch.add(key);

      // Date normalization
      if (r.birth_date) {
        r.birth_date = normalizeBirthDate(r.birth_date);
      }
      if (r.created_at) {
        const createdAt = normalizeCreatedAt(r.created_at);
        if (createdAt) r.created_at = createdAt;
        else delete r.created_at;
      }
      // dependents to int
      if (r.dependents !== "" && r.dependents != null) {
        const n = parseInt(String(r.dependents), 10);
        r.dependents = isNaN(n) ? 0 : n;
      } else r.dependents = 0;

      // Default status
      if (!r.status) r.status = "new";

      if (errs.length) { errors.push({ row: i + 2, name: r.full_name, errors: errs }); continue; }

      // Download attachments
      if (downloadAttachments) {
        const slug = (r.full_name || `row${i}`).toString().replace(/\s+/g, "_").slice(0, 40);
        r.resume_url = await downloadAttachment(supabase, r.resume_url, slug, "resume");
        r.degree_url = await downloadAttachment(supabase, r.degree_url, slug, "degree");
        r.experience_cert_url = await downloadAttachment(supabase, r.experience_cert_url, slug, "exp");
        r.training_certs_url = await downloadAttachment(supabase, r.training_certs_url, slug, "training");
        r.other_docs_url = await downloadAttachment(supabase, r.other_docs_url, slug, "other");
      }

      valid.push(r);
    }

    let inserted = 0;
    if (valid.length > 0) {
      // Insert in chunks of 200
      for (let i = 0; i < valid.length; i += 200) {
        const chunk = valid.slice(i, i + 200);
        const { error } = await supabase.from("applicants").insert(chunk);
        if (error) {
          errors.push({ row: i + 2, name: "(chunk)", errors: [error.message] });
        } else inserted += chunk.length;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: rows.length,
      inserted,
      failed: errors.length,
      errors,
      aiInsights: ai.insights,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("import-applicants error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
