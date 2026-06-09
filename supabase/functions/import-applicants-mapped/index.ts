// Flexible bulk import: accepts a source->target column mapping and rows.
// Lets the client choose which fields to import (enable/disable per column).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEXT_FIELDS = new Set([
  "full_name","gender","nationality","marital_status","phone","email","current_city","has_transport",
  "desired_position","job_type","preferred_city","hear_about","education_level","major","university",
  "graduation_year","gpa","currently_studying","current_study","years_experience","currently_employed",
  "current_title","current_tasks","self_summary","other_experience","arabic_level","english_level",
  "other_language","linkedin","facility_management_exp","current_salary","expected_salary",
  "available_date","notes","resume_url","degree_url","experience_cert_url","training_certs_url","other_docs_url",
]);
const ALL_FIELDS = new Set([...TEXT_FIELDS, "birth_date", "created_at", "dependents", "status"]);
const ALLOWED_STATUSES = new Set(["new","reviewing","phone_interview","in_person_interview","accepted","hired","rejected","withdrawn"]);

function normIdentity(v: any): string {
  return String(v ?? "").trim().toLowerCase();
}

function normPhone(v: any): string {
  return String(v ?? "").replace(/\D/g, "");
}

function trimStringValues(rec: any): any {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(rec)) {
    if (value === "" || value == null) cleaned[key] = null;
    else cleaned[key] = typeof value === "string" ? value.trim() : value;
  }
  return cleaned;
}

function sanitizeRecord(src: any): any {
  const rec: any = {};
  for (const [key, value] of Object.entries(src || {})) {
    if (!ALL_FIELDS.has(key)) continue;
    if (key === "dependents") {
      const n = parseInt(String(value || "0"), 10);
      rec.dependents = isNaN(n) ? 0 : n;
    } else if (key === "status") {
      const s = String(value || "new").trim();
      rec.status = ALLOWED_STATUSES.has(s) ? s : "new";
    } else if (key === "birth_date") {
      if (value == null || value === "") {
        rec.birth_date = null;
      } else {
        const nd = normDate(value);
        rec.birth_date = nd;
        if (!nd) (rec as any).__birth_date_invalid = true;
      }
    } else if (key === "created_at") {
      const ts = normTimestamp(value);
      if (ts) rec.created_at = ts;
    } else {
      rec[key] = value;
    }
  }
  if (!rec.status) rec.status = "new";
  if (rec.dependents == null) rec.dependents = 0;
  return trimStringValues(rec);
}

function identityKeys(row: any): string[] {
  const email = normIdentity(row.email);
  const phone = normPhone(row.phone);
  const name = normIdentity(row.full_name);
  const keys: string[] = [];
  if (name && email) keys.push(`name_email:${name}|${email}`);
  if (name && phone) keys.push(`name_phone:${name}|${phone}`);
  return keys;
}

function normSalary(v: any): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const rng = s.match(/(\d[\d,\.]*)\s*(?:-|–|to|إلى|الى|حتى)\s*(\d[\d,\.]*)/i);
  if (rng) {
    const a = parseFloat(rng[1].replace(/,/g, ""));
    const b = parseFloat(rng[2].replace(/,/g, ""));
    if (!isNaN(a) && !isNaN(b)) return String(Math.round((a + b) / 2));
  }
  const num = s.replace(/[^\d.]/g, "");
  if (!num) return s;
  const n = parseFloat(num.replace(/,/g, ""));
  return isNaN(n) ? s : String(Math.round(n));
}

function normYesNo(v: any): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  if (["نعم","yes","y","true","1"].includes(s)) return "نعم";
  if (["لا","no","n","false","0"].includes(s)) return "لا";
  return String(v).trim();
}

function toLatinDigits(v: any): string {
  return String(v ?? "")
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .trim();
}

function buildDate(y: number, mo: number, d: number): string | null {
  if (y < 1900 || y > 2100) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  const now = new Date();
  const oldestAllowed = new Date(Date.UTC(now.getUTCFullYear() - 100, now.getUTCMonth(), now.getUTCDate()));
  if (dt.getTime() > now.getTime()) return null;
  if (dt.getTime() < oldestAllowed.getTime()) return null;
  return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function normDate(v: any): string | null {
  if (!v) return null;
  if (typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v).trim())) {
    const n = Number(v);
    if (n > 0 && n < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30 + Math.floor(n)));
      return buildDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }
  const s = toLatinDigits(v);
  if (!s) return null;
  // dd/mm/yyyy or mm/dd/yyyy — prefer dd/mm
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let [, a, b, c] = m;
    let y = parseInt(c, 10);
    if (c.length === 2) y += y < 50 ? 2000 : 1900;
    const A = parseInt(a, 10), B = parseInt(b, 10);
    // try dd/mm first
    let out = buildDate(y, B, A);
    if (out) return out;
    // try mm/dd
    out = buildDate(y, A, B);
    if (out) return out;
    return null;
  }
  // yyyy-?-? : could be yyyy-mm-dd or yyyy-dd-mm
  const iso = s.match(/^(\d{4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})$/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const A = parseInt(iso[2], 10);
    const B = parseInt(iso[3], 10);
    // standard yyyy-mm-dd
    let out = buildDate(y, A, B);
    if (out) return out;
    // swapped yyyy-dd-mm
    out = buildDate(y, B, A);
    if (out) return out;
    return null;
  }
  return null;
}

function normTimestamp(v: any): string | null {
  if (!v) return null;
  if (typeof v === "number" || /^\d+(\.\d+)?$/.test(String(v).trim())) {
    const n = Number(v);
    if (n > 0 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString();
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdminHr } = await userClient.rpc("is_admin_or_hr", { _user_id: u.user.id });
    if (!isAdminHr) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(url, svc);
    const body = await req.json();
    const directRecords: Record<string, any>[] | null = Array.isArray(body.records) ? body.records : null;
    const mapping: Record<string, string | null> = body.mapping || {}; // target -> sourceHeader (or null = skip)
    const rows: Record<string, any>[] = directRecords || body.rows || [];
    const defaultStatus: string = body.defaultStatus || "new";
    const skipDuplicates: boolean = false;

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "لا توجد صفوف" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (directRecords) {
      const valid: any[] = [];
      const errors: any[] = [];
      for (let i = 0; i < directRecords.length; i++) {
        const rec: any = sanitizeRecord(directRecords[i]);
        if (!rec.full_name || String(rec.full_name).trim().length < 2) {
          errors.push({ row: i + 2, name: rec.full_name, errors: ["الاسم الكامل مفقود"] });
          continue;
        }
        if (rec.__birth_date_invalid) {
          errors.push({ row: i + 2, name: rec.full_name, errors: ["تاريخ ميلاد غير منطقي (تم رفض السجل: عمر > 100 أو تاريخ غير صالح)"] });
          continue;
        }
        delete rec.__birth_date_invalid;
        valid.push(rec);
      }
      let inserted = 0;
      for (let i = 0; i < valid.length; i += 200) {
        const chunk = valid.slice(i, i + 200);
        const { error } = await admin.from("applicants").insert(chunk);
        if (error) {
          for (let j = 0; j < chunk.length; j++) {
            const { error: rowError } = await admin.from("applicants").insert(chunk[j]);
            if (rowError) errors.push({ row: i + j + 2, name: chunk[j].full_name, errors: [rowError.message] });
            else inserted += 1;
          }
        } else inserted += chunk.length;
      }
      return new Response(JSON.stringify({ success: true, total: directRecords.length, inserted, failed: errors.length, errors: errors.slice(0, 200) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate mapping keys
    for (const k of Object.keys(mapping)) {
      if (mapping[k] && !ALL_FIELDS.has(k)) {
        return new Response(JSON.stringify({ error: `حقل غير معروف: ${k}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const fullNameSrc = mapping["full_name"];
    if (!fullNameSrc) {
      return new Response(JSON.stringify({ error: "يجب تعيين حقل الاسم الكامل (full_name)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load existing for dup check, paginated because the table can exceed the default 1000-row read limit.
    const existing: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error: existingError } = await admin
        .from("applicants")
        .select("email,phone,full_name")
        .range(from, from + 999);
      if (existingError) throw existingError;
      existing.push(...(page || []));
      if (!page || page.length < 1000) break;
    }
    const existingKeys = new Set<string>();
    for (const e of existing) identityKeys(e).forEach(k => existingKeys.add(k));

    const valid: any[] = [];
    const errors: any[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const src = rows[i];
      const rec: any = {};
      const errs: string[] = [];

      for (const [target, sourceHeader] of Object.entries(mapping)) {
        if (!sourceHeader) continue;
        let v = src[sourceHeader];
        if (v == null) v = "";
        if (typeof v === "string") v = v.trim();

        if (target === "dependents") {
          const n = parseInt(String(v || "0"), 10);
          rec.dependents = isNaN(n) ? 0 : n;
        } else if (target === "birth_date") {
          if (v === "" || v == null) rec.birth_date = null;
          else {
            const nd = normDate(v);
            rec.birth_date = nd;
            if (!nd) errs.push("تاريخ ميلاد غير منطقي");
          }
        } else if (target === "created_at") {
          const ts = normTimestamp(v);
          if (ts) rec.created_at = ts;
        } else if (target === "current_salary" || target === "expected_salary") {
          rec[target] = normSalary(v);
        } else if (target === "has_transport" || target === "currently_studying" || target === "currently_employed") {
          rec[target] = normYesNo(v);
        } else if (target === "status") {
          const s = String(v || "").toLowerCase();
          rec.status = ALLOWED_STATUSES.has(s) ? s : defaultStatus;
        } else {
          rec[target] = v === "" ? null : String(v);
        }
      }

      if (!rec.status) rec.status = defaultStatus;
      if (rec.dependents == null) rec.dependents = 0;

      if (!rec.full_name || String(rec.full_name).trim().length < 2) {
        errs.push("الاسم الكامل مفقود");
      }
      if (rec.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(rec.email))) {
        // don't reject, just blank it
        errs.push("بريد غير صالح (تم تجاهله)");
        rec.email = null;
      }

      const keys = identityKeys(rec);
      const isExistingDuplicate = keys.some(k => existingKeys.has(k));
      const isFileDuplicate = keys.length > 0 && keys.some(k => seen.has(k));
      if (skipDuplicates && isExistingDuplicate) {
        errors.push({ row: i + 2, name: rec.full_name, errors: ["مكرر مع متقدم موجود"] });
        continue;
      }
      if (skipDuplicates && isFileDuplicate) {
        errors.push({ row: i + 2, name: rec.full_name, errors: ["مكرر داخل الملف"] });
        continue;
      }
      keys.forEach(k => seen.add(k));

      if (errs.includes("الاسم الكامل مفقود") || errs.includes("تاريخ ميلاد غير منطقي")) {
        errors.push({ row: i + 2, name: rec.full_name, errors: errs });
        continue;
      }

      valid.push(trimStringValues(rec));
    }

    let inserted = 0;
    if (valid.length > 0) {
      for (let i = 0; i < valid.length; i += 200) {
        const chunk = valid.slice(i, i + 200);
        const { error } = await admin.from("applicants").insert(chunk);
        if (error) {
          console.error("bulk insert failed, retrying row-by-row:", error.message);
          for (let j = 0; j < chunk.length; j++) {
            const { error: rowError } = await admin.from("applicants").insert(chunk[j]);
            if (rowError) {
              console.error("row insert failed:", rowError.message, chunk[j]);
              errors.push({ row: i + j + 2, name: chunk[j].full_name, errors: [rowError.message] });
            } else inserted += 1;
          }
        } else inserted += chunk.length;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: rows.length,
      inserted,
      failed: errors.length,
      errors: errors.slice(0, 200),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("import-applicants-mapped error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
