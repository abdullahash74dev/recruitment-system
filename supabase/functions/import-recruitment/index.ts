import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROJECT_COLS = ["code", "name_ar", "name_en", "notes"];
const JOB_COLS = ["project_code", "title_ar", "title_en", "target_headcount", "nationality_required", "location", "job_type", "salary_range", "requirements_ar", "requirements_en", "is_published_to_board"];
const CAND_COLS = ["project_code","job_title_ar","candidate_name","nationality","phone","email","status","rejected_reason","interview_date","hire_date","offer_sent_date","offer_signed_date","expected_start_date","actual_start_date","batch_label","cv_url","notes"];

const STATUS_MAP: Record<string,string> = {
  "new":"new","جديد":"new",
  "interviewed":"interviewed","تمت المقابلة":"interviewed","مقابلة":"interviewed",
  "selected":"selected","مختار":"selected","تم الاختيار":"selected","مقبول":"selected","مقبول مبدئياً":"selected","accepted":"selected",
  "offer_sent":"offer_sent","تم إرسال العرض":"offer_sent","ارسال عرض":"offer_sent","offer sent":"offer_sent",
  "offer_signed":"offer_signed","تم توقيع العرض":"offer_signed","offer signed":"offer_signed",
  "offer_accepted":"offer_accepted","قبل العرض":"offer_accepted","قبول عرض":"offer_accepted",
  "hired":"hired","تم التوظيف":"hired","موظف":"hired",
  "started":"started","باشر":"started","باشر العمل":"started","started":"started",
  "rejected":"rejected","مرفوض":"rejected",
};

function normDate(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 80000) {
      const d = new Date(Math.round((n - 25569) * 86400 * 1000));
      return d.toISOString().slice(0,10);
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  return null;
}

function parseBool(v: any, def = true): boolean {
  if (v === null || v === undefined || v === "") return def;
  const s = String(v).trim().toLowerCase();
  if (["true","1","yes","y","نعم","✓","x"].includes(s)) return true;
  if (["false","0","no","n","لا","-"].includes(s)) return false;
  return def;
}

function rowsFromSheet(sheet: { headers: string[]; rows: any[][] } | undefined) {
  if (!sheet) return [] as any[];
  const { headers, rows } = sheet;
  return rows
    .filter(r => Array.isArray(r) && r.some(v => v !== "" && v !== null && v !== undefined))
    .map(arr => {
      const obj: any = {};
      headers.forEach((h, i) => { obj[String(h).trim()] = arr[i] ?? ""; });
      return obj;
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: allowed } = await userClient.rpc("is_admin_or_hr", { _user_id: user.id });
    if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => null);
    if (!body) return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Modes:
    //  A) multi-sheet: { sheets: { Projects, JobTitles, Candidates }, filename, strict_existing }
    //  B) targeted (per job): { sheets: { Candidates }, target_project_id, target_job_title_id, filename }
    //     => candidate sheet may omit project_code/job_title_ar columns; they are auto-filled
    //  C) backward-compat: { headers, rows, filename } => Candidates only
    const filename = body.filename || null;
    const strictExisting = !!body.strict_existing;
    const targetProjectId: string | null = body.target_project_id || null;
    const targetJobTitleId: string | null = body.target_job_title_id || null;
    let projectsSheet: any, jobsSheet: any, candsSheet: any;

    if (body.sheets && typeof body.sheets === "object") {
      projectsSheet = body.sheets.Projects || body.sheets.projects;
      jobsSheet = body.sheets.JobTitles || body.sheets.job_titles || body.sheets.Jobs;
      candsSheet = body.sheets.Candidates || body.sheets.candidates;
    } else if (Array.isArray(body.headers) && Array.isArray(body.rows)) {
      candsSheet = { headers: body.headers, rows: body.rows.map((r: any) => Array.isArray(r) ? r : body.headers.map((h: string) => r[h])) };
    } else {
      return new Response(JSON.stringify({ error: "No sheets provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Targeted mode: resolve project + job title up-front and inject defaults into rows
    let targetedProj: any = null, targetedJob: any = null;
    if (targetProjectId && targetJobTitleId) {
      const { data: pj } = await admin.from("recruitment_projects").select("id,code,name_ar").eq("id", targetProjectId).maybeSingle();
      const { data: jt } = await admin.from("recruitment_job_titles").select("id,project_id,title_ar").eq("id", targetJobTitleId).maybeSingle();
      if (!pj || !jt || jt.project_id !== pj.id) {
        return new Response(JSON.stringify({ error: "Invalid target_project_id / target_job_title_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      targetedProj = pj; targetedJob = jt;
      if (candsSheet) {
        const headers = candsSheet.headers.slice();
        const hasProj = headers.findIndex((h: string) => String(h).trim() === "project_code");
        const hasJob = headers.findIndex((h: string) => String(h).trim() === "job_title_ar");
        if (hasProj === -1) headers.push("project_code");
        if (hasJob === -1) headers.push("job_title_ar");
        const projIdx = headers.indexOf("project_code");
        const jobIdx = headers.indexOf("job_title_ar");
        const rows = candsSheet.rows.map((r: any[]) => {
          const row = r.slice();
          while (row.length < headers.length) row.push("");
          if (!String(row[projIdx] || "").trim()) row[projIdx] = pj.code;
          if (!String(row[jobIdx] || "").trim()) row[jobIdx] = jt.title_ar;
          return row;
        });
        candsSheet = { headers, rows };
      }
    }

    const result: any = { projects: { inserted:0, updated:0, failed:0, errors:[] }, job_titles: { inserted:0, updated:0, failed:0, errors:[] }, candidates: { inserted:0, failed:0, errors:[] } };

    // ---------- 1) PROJECTS (upsert by code) ----------
    const projectRows = rowsFromSheet(projectsSheet);
    for (let i = 0; i < projectRows.length; i++) {
      const r = projectRows[i]; const rowNum = i + 2;
      const code = String(r.code || "").trim();
      const name_ar = String(r.name_ar || "").trim();
      if (!code || !name_ar) {
        result.projects.failed++;
        result.projects.errors.push({ row: rowNum, errors: ["code & name_ar required"] });
        continue;
      }
      const payload = {
        code, name_ar,
        name_en: String(r.name_en||"").trim() || null,
        notes: String(r.notes||"").trim() || null,
        is_active: true,
      };
      const { data: existing } = await admin.from("recruitment_projects").select("id").eq("code", code).maybeSingle();
      if (existing) {
        const { error } = await admin.from("recruitment_projects").update(payload).eq("id", existing.id);
        if (error) { result.projects.failed++; result.projects.errors.push({ row: rowNum, errors: [error.message] }); }
        else result.projects.updated++;
      } else {
        const { error } = await admin.from("recruitment_projects").insert(payload);
        if (error) { result.projects.failed++; result.projects.errors.push({ row: rowNum, errors: [error.message] }); }
        else result.projects.inserted++;
      }
    }

    // Reload projects after upsert
    const { data: projects } = await admin.from("recruitment_projects").select("id,code,name_ar");
    const projByCode = new Map((projects||[]).map(p => [String(p.code).trim().toLowerCase(), p]));

    // ---------- 2) JOB TITLES (upsert by project_code + title_ar) ----------
    const jobRows = rowsFromSheet(jobsSheet);
    for (let i = 0; i < jobRows.length; i++) {
      const r = jobRows[i]; const rowNum = i + 2;
      const projCode = String(r.project_code||"").trim();
      const title_ar = String(r.title_ar||"").trim();
      if (!projCode || !title_ar) {
        result.job_titles.failed++;
        result.job_titles.errors.push({ row: rowNum, errors: ["project_code & title_ar required"] });
        continue;
      }
      const proj = projByCode.get(projCode.toLowerCase());
      if (!proj) {
        result.job_titles.failed++;
        result.job_titles.errors.push({ row: rowNum, name: title_ar, errors: [`project not found: ${projCode}`] });
        continue;
      }
      const payload: any = {
        project_id: proj.id,
        title_ar,
        title_en: String(r.title_en||"").trim() || null,
        target_headcount: Math.max(parseInt(String(r.target_headcount||"1"), 10) || 1, 1),
        nationality_required: String(r.nationality_required||"").trim() || null,
        location: String(r.location||"").trim() || null,
        job_type: String(r.job_type||"").trim() || "دوام كامل",
        salary_range: String(r.salary_range||"").trim() || null,
        requirements_ar: String(r.requirements_ar||"").trim() || null,
        requirements_en: String(r.requirements_en||"").trim() || null,
        is_published_to_board: parseBool(r.is_published_to_board, true),
        is_active: true,
      };
      const { data: existing } = await admin.from("recruitment_job_titles")
        .select("id").eq("project_id", proj.id).eq("title_ar", title_ar).maybeSingle();
      if (existing) {
        const { error } = await admin.from("recruitment_job_titles").update(payload).eq("id", existing.id);
        if (error) { result.job_titles.failed++; result.job_titles.errors.push({ row: rowNum, name: title_ar, errors: [error.message] }); }
        else result.job_titles.updated++;
      } else {
        const { error } = await admin.from("recruitment_job_titles").insert(payload);
        if (error) { result.job_titles.failed++; result.job_titles.errors.push({ row: rowNum, name: title_ar, errors: [error.message] }); }
        else result.job_titles.inserted++;
      }
    }

    // ---------- 3) CANDIDATES ----------
    const candRows = rowsFromSheet(candsSheet);
    if (candRows.length) {
      // AUTO-CREATE missing projects from candidate rows (skipped in strict mode)
      if (!strictExisting) {
        const candProjCodes = new Set<string>();
        candRows.forEach((r: any) => {
          const c = String(r.project_code || "").trim();
          if (c && !projByCode.has(c.toLowerCase())) candProjCodes.add(c);
        });
        for (const code of candProjCodes) {
          const { data: created } = await admin.from("recruitment_projects")
            .insert({ code, name_ar: code, is_active: true }).select("id,code,name_ar").single();
          if (created) projByCode.set(code.toLowerCase(), created);
        }
      }

      // AUTO-CREATE missing job titles from candidate rows (skipped in strict mode)
      let { data: jobTitles } = await admin.from("recruitment_job_titles").select("id,project_id,title_ar");
      const titleKey = (pid: string, t: string) => `${pid}::${t.trim().toLowerCase()}`;
      const titleMap = new Map((jobTitles||[]).map(j => [titleKey(j.project_id, j.title_ar), j]));
      if (!strictExisting) {
        const newTitlesNeeded = new Map<string, { project_id: string; title_ar: string }>();
        candRows.forEach((r: any) => {
          const projCode = String(r.project_code || "").trim().toLowerCase();
          const titleAr = String(r.job_title_ar || "").trim();
          const proj = projByCode.get(projCode);
          if (proj && titleAr && !titleMap.has(titleKey(proj.id, titleAr))) {
            newTitlesNeeded.set(titleKey(proj.id, titleAr), { project_id: proj.id, title_ar: titleAr });
          }
        });
        for (const t of newTitlesNeeded.values()) {
          const { data: created } = await admin.from("recruitment_job_titles")
            .insert({ project_id: t.project_id, title_ar: t.title_ar, target_headcount: 1, job_type: "دوام كامل", is_active: true, is_published_to_board: false })
            .select("id,project_id,title_ar").single();
          if (created) titleMap.set(titleKey(created.project_id, created.title_ar), created);
        }
      }

      // AUTO-CREATE missing rejection reasons (skipped in strict mode)
      const { data: rejectionReasons } = await admin.from("rejection_reasons").select("id,reason_ar");
      const reasonByName = new Map((rejectionReasons||[]).map(r => [String(r.reason_ar).trim().toLowerCase(), r]));
      if (!strictExisting) {
        const newReasonsNeeded = new Set<string>();
        candRows.forEach((r: any) => {
          const status = STATUS_MAP[String(r.status || "new").trim().toLowerCase()] || "new";
          const reason = String(r.rejected_reason || "").trim();
          if (status === "rejected" && reason && !reasonByName.has(reason.toLowerCase())) {
            newReasonsNeeded.add(reason);
          }
        });
        for (const reason of newReasonsNeeded) {
          const { data: created } = await admin.from("rejection_reasons")
            .insert({ reason_ar: reason, is_active: true }).select("id,reason_ar").single();
          if (created) reasonByName.set(String(created.reason_ar).toLowerCase(), created);
        }
      }

      // Create batch
      const { data: batch } = await admin.from("recruitment_import_batches").insert({
        filename, total_rows: candRows.length, imported_by: user.id, imported_by_email: user.email,
      }).select().single();

      const toInsert: any[] = [];
      candRows.forEach((row: any, idx: number) => {
        const rowNum = idx + 2;
        const rowErr: string[] = [];
        const projCode = String(row.project_code || "").trim();
        const titleAr = String(row.job_title_ar || "").trim();
        const name = String(row.candidate_name || "").trim();

        if (!projCode) rowErr.push("project_code فارغ");
        if (!titleAr) rowErr.push("job_title_ar فارغ");
        if (!name) rowErr.push("candidate_name فارغ");

        const proj = projByCode.get(projCode.toLowerCase());
        if (projCode && !proj) rowErr.push(`المشروع غير موجود: ${projCode}`);

        let jt = null;
        if (proj && titleAr) {
          jt = titleMap.get(titleKey(proj.id, titleAr));
          if (!jt) rowErr.push(`الوظيفة غير موجودة لهذا المشروع: ${titleAr}`);
        }

        const rawStatus = String(row.status || "new").trim().toLowerCase();
        const status = STATUS_MAP[rawStatus] || "new";

        let rejectedReasonId: string | null = null;
        if (status === "rejected") {
          const r = String(row.rejected_reason || "").trim().toLowerCase();
          const found = reasonByName.get(r);
          if (!found) rowErr.push("rejected_reason مطلوب وغير موجود في القائمة");
          else rejectedReasonId = found.id;
        }

        if (rowErr.length) {
          result.candidates.errors.push({ row: rowNum, name, errors: rowErr });
          result.candidates.failed++;
          return;
        }

        toInsert.push({
          project_id: proj!.id, job_title_id: jt!.id, full_name: name,
          nationality: String(row.nationality||"").trim() || null,
          phone: String(row.phone||"").trim() || null,
          email: String(row.email||"").trim() || null,
          cv_url: String(row.cv_url||"").trim() || null,
          status, rejected_reason_id: rejectedReasonId,
          interview_date: normDate(row.interview_date),
          hire_date: normDate(row.hire_date),
          offer_sent_date: normDate(row.offer_sent_date),
          offer_signed_date: normDate(row.offer_signed_date),
          expected_start_date: normDate(row.expected_start_date),
          actual_start_date: normDate(row.actual_start_date),
          batch_label: String(row.batch_label||"").trim() || null,
          notes: String(row.notes||"").trim() || null,
          imported_batch_id: batch?.id || null,
        });
      });

      if (toInsert.length) {
        const { data: ins, error: insErr } = await admin.from("recruitment_candidates").insert(toInsert).select("id");
        if (insErr) {
          result.candidates.errors.push({ row: 0, errors: [insErr.message] });
          result.candidates.failed += toInsert.length;
        } else {
          result.candidates.inserted = ins?.length || 0;
        }
      }

      if (batch) {
        await admin.from("recruitment_import_batches").update({
          inserted_rows: result.candidates.inserted,
          failed_rows: result.candidates.failed,
          errors: result.candidates.errors,
        }).eq("id", batch.id);
      }
    }

    // Backward-compat top-level summary for old UI
    result.total = (result.candidates.inserted + result.candidates.failed);
    result.inserted = result.candidates.inserted;
    result.failed = result.candidates.failed;
    result.errors = result.candidates.errors;

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
