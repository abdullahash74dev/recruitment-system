import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OUTPUT_COLS = [
  "project_code","job_title_ar","candidate_name","nationality","phone","email",
  "status","rejected_reason","interview_date","hire_date",
  "offer_sent_date","offer_signed_date","expected_start_date","actual_start_date",
  "batch_label","cv_url","notes",
];

const ALLOWED_STATUSES = ["new","interviewed","selected","offer_sent","offer_signed","offer_accepted","hired","started","rejected"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return new Response(JSON.stringify({ error: "No AI key configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: ok } = await userClient.rpc("is_admin_or_hr", { _user_id: user.id });
    if (!ok) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(url, svc);
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.headers) || !Array.isArray(body.rows)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const headers: string[] = body.headers.map((h: any) => String(h ?? "").trim());
    const rawRows: any[][] = body.rows.filter((r: any[]) => Array.isArray(r) && r.some(v => v !== "" && v != null));
    if (rawRows.length === 0) return new Response(JSON.stringify({ error: "No rows" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const [{ data: projects }, { data: jobs }, { data: reasons }] = await Promise.all([
      admin.from("recruitment_projects").select("id,code,name_ar,name_en").eq("is_active", true),
      admin.from("recruitment_job_titles").select("id,project_id,title_ar,title_en").eq("is_active", true),
      admin.from("rejection_reasons").select("id,reason_ar,reason_en").eq("is_active", true),
    ]);

    const projectList = (projects || []).map(p => ({ code: p.code, name_ar: p.name_ar, name_en: p.name_en }));
    const jobList = (jobs || []).map(j => {
      const p = (projects || []).find(pp => pp.id === j.project_id);
      return { project_code: p?.code || "", title_ar: j.title_ar, title_en: j.title_en };
    });
    const reasonList = (reasons || []).map(r => ({ reason_ar: r.reason_ar, reason_en: r.reason_en }));

    // Convert rows to objects for the AI
    const rowsObj = rawRows.map((arr, idx) => {
      const o: any = { _row: idx + 2 };
      headers.forEach((h, i) => { if (h) o[h] = arr[i] ?? ""; });
      return o;
    });

    const sys = `You map messy bilingual (Arabic/English) recruitment spreadsheet rows to a strict schema.
For each input row, return one output object with these keys: ${OUTPUT_COLS.join(", ")}, plus "_row" (original row number) and "_warnings" (string array).
Rules:
- Match project_code against EXISTING projects list (by code, name_ar, name_en). If you cannot match, set project_code = "" and add a warning.
- Match job_title_ar against EXISTING job_titles list scoped to the matched project. Always output the existing title_ar (Arabic) string verbatim. If no match, set "" and warn.
- status MUST be one of: ${ALLOWED_STATUSES.join("|")}. Map Arabic synonyms: "جديد"->new, "تمت المقابلة"/"مقابلة"->interviewed, "مقبول"/"مقبول مبدئياً"->selected, "تم إرسال العرض"->offer_sent, "تم توقيع العرض"->offer_signed, "قبل العرض"->offer_accepted, "تم التوظيف"/"موظف"->hired, "باشر"->started, "مرفوض"->rejected. Default "new".
- If status=rejected, rejected_reason MUST match an EXISTING reason_ar verbatim or be empty (warn).
- Dates: convert to YYYY-MM-DD; empty if unknown.
- Phone: digits only, keep leading 0 or +.
- Email: lowercase, validate basic format; empty if invalid.
- candidate_name is required; if missing, leave empty and warn.
- Do not invent data. Use empty string when unknown.`;

    const userMsg = `EXISTING_PROJECTS (${projectList.length}):\n${JSON.stringify(projectList).slice(0, 8000)}
EXISTING_JOB_TITLES (${jobList.length}):\n${JSON.stringify(jobList).slice(0, 12000)}
EXISTING_REJECTION_REASONS:\n${JSON.stringify(reasonList).slice(0, 4000)}
INPUT_HEADERS: ${JSON.stringify(headers)}
INPUT_ROWS (${rowsObj.length}):\n${JSON.stringify(rowsObj).slice(0, 60000)}`;

    const aiResult = await callAI({
      service: "ai-import-recruitment",
      model: "google/gemini-2.5-flash",
      userId: user.id,
      userEmail: user.email,
      metadata: { row_count: rowsObj.length },
      body: {
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_normalized",
            description: "Return normalized candidate rows.",
            parameters: {
              type: "object",
              properties: {
                rows: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: Object.fromEntries([
                      ...OUTPUT_COLS.map(k => [k, { type: "string" }]),
                      ["_row", { type: "number" }],
                      ["_warnings", { type: "array", items: { type: "string" } }],
                    ]),
                    required: [...OUTPUT_COLS, "_row", "_warnings"],
                  },
                },
                column_mapping: { type: "object", description: "Detected input header -> canonical field name" },
                summary: { type: "string" },
              },
              required: ["rows"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_normalized" } },
      },
    });

    if (!aiResult.ok) {
      if (aiResult.status === 429) return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول لاحقاً" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResult.status === 402) return new Response(JSON.stringify({ error: "نفدت أرصدة الذكاء الاصطناعي" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: `AI error: ${aiResult.status} ${aiResult.errorText.slice(0,200)}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const call = aiResult.data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return new Response(JSON.stringify({ error: "AI returned no tool call" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const parsed = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify({
      rows: parsed.rows || [],
      column_mapping: parsed.column_mapping || {},
      summary: parsed.summary || "",
      existing: { projects: projectList.length, job_titles: jobList.length, reasons: reasonList.length },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
