import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ALLOW_ORIGIN } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same allow-list spirit as _shared/clientApplicantFilters.ts's
// QUERYABLE_FIELDS -- a campaign's target_filter can only touch these
// applicant columns, never an arbitrary one.
const TARGETABLE_FIELDS = new Set(["status", "desired_position", "nationality", "preferred_city", "current_city", "job_type"]);
const MAX_RECIPIENTS = 300;
const PLACEHOLDERS = ["{{name}}", "{{position}}", "{{date}}", "{{company}}"];

// "field=value,field2=value2" -> [{field, value}], dropping anything not in
// TARGETABLE_FIELDS or malformed. No target_filter (or one that resolves to
// zero conditions) matches every non-archived applicant with an email.
function parseTargetFilter(raw: string | null): { field: string; value: string }[] {
  if (!raw) return [];
  const out: { field: string; value: string }[] = [];
  for (const part of raw.split(",")) {
    const [field, value] = part.split("=").map((s) => s.trim());
    if (field && value && TARGETABLE_FIELDS.has(field)) out.push({ field, value });
  }
  return out;
}

function renderTemplate(text: string, values: Record<string, string>): string {
  let out = text;
  for (const token of PLACEHOLDERS) {
    const key = token.slice(2, -2); // "{{name}}" -> "name"
    out = out.split(token).join(values[key] ?? "");
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isHr, error: roleError } = await admin.rpc("is_admin_or_hr", { _user_id: u.user.id });
    if (roleError) {
      return new Response(JSON.stringify({ error: "Role check failed", details: roleError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!isHr) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { campaignId } = await req.json();
    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaignId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: campaign, error: campaignError } = await admin
      .from("email_campaigns")
      .select("id, name, template_id, target_filter, status")
      .eq("id", campaignId)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (campaign.status === "completed" || campaign.status === "sending") {
      return new Response(JSON.stringify({ error: "Campaign already sent or in progress" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!campaign.template_id) {
      return new Response(JSON.stringify({ error: "Campaign has no template" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: template, error: templateError } = await admin
      .from("email_templates")
      .select("subject_ar, subject_en, body_ar, body_en, use_count")
      .eq("id", campaign.template_id)
      .maybeSingle();
    if (templateError) throw templateError;
    if (!template) {
      return new Response(JSON.stringify({ error: "Template not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const subjectTemplate = template.subject_ar || template.subject_en || campaign.name;
    const bodyTemplate = template.body_ar || template.body_en || "";
    if (!bodyTemplate.trim()) {
      return new Response(JSON.stringify({ error: "Template has no body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: siteSettings } = await admin.from("site_settings").select("site_name_ar, site_name_en").limit(1).maybeSingle();
    const companyName = siteSettings?.site_name_ar || siteSettings?.site_name_en || campaign.name;
    const todayAr = new Date().toLocaleDateString("ar-SA");

    const conditions = parseTargetFilter(campaign.target_filter);
    let recipientsQuery = admin
      .from("applicants")
      .select("id, full_name, email, desired_position")
      .eq("is_archived", false)
      .not("email", "is", null)
      .order("created_at", { ascending: false })
      .limit(MAX_RECIPIENTS);
    for (const { field, value } of conditions) {
      recipientsQuery = recipientsQuery.ilike(field, `%${value}%`);
    }
    const { data: recipients, error: recipientsError } = await recipientsQuery;
    if (recipientsError) throw recipientsError;

    await admin.from("email_campaigns").update({ status: "sending", recipient_count: (recipients || []).length }).eq("id", campaignId);

    let sent = 0;
    let failed = 0;
    for (const recipient of recipients || []) {
      const values = {
        name: recipient.full_name || "",
        position: recipient.desired_position || "",
        company: companyName,
        date: todayAr,
      };
      const subject = renderTemplate(subjectTemplate, values);
      const text = renderTemplate(bodyTemplate, values);
      const result = await sendEmail({ to: recipient.email as string, subject, text });
      if (result.ok) sent += 1;
      else {
        failed += 1;
        console.error(`Campaign ${campaignId} send to ${recipient.email} failed:`, result.error);
      }
    }

    await admin
      .from("email_campaigns")
      .update({ status: "completed", sent_count: sent, failed_count: failed, completed_at: new Date().toISOString() })
      .eq("id", campaignId);
    await admin.from("email_templates").update({ use_count: (template.use_count ?? 0) + 1 }).eq("id", campaign.template_id);

    return new Response(JSON.stringify({ success: true, recipients: (recipients || []).length, sent, failed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-email-campaign:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
