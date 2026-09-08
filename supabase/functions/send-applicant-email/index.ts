import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ALLOW_ORIGIN } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sends a status-update email to an applicant (reviewing/interview/offer/
// rejection...) and records the outcome in applicant_emails in one atomic
// server-side step, using the service-role client -- so the HR-facing
// ApplicantEmailDialog no longer just logs a fake "queued_pending_domain"
// row, it actually goes out via Resend.
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

    const body = await req.json();
    const {
      applicantId,
      templateKey,
      statusAtSend,
      recipientEmail,
      language,
      subject,
      emailBody,
      rejectionReasonId,
      rejectionNote,
    } = body || {};

    if (!applicantId || !recipientEmail || !subject || !emailBody) {
      return new Response(JSON.stringify({ error: "applicantId, recipientEmail, subject and emailBody are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof recipientEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: "Invalid recipientEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin.from("profiles").select("email").eq("user_id", u.user.id).maybeSingle();
    const sentByEmail = profile?.email ?? u.user.email ?? null;

    const result = await sendEmail({ to: recipientEmail, subject, text: emailBody });

    const { error: insertError } = await admin.from("applicant_emails").insert({
      applicant_id: applicantId,
      template_key: templateKey || "custom",
      status_at_send: statusAtSend || templateKey || "custom",
      recipient_email: recipientEmail,
      language: language || "ar",
      subject,
      body_preview: emailBody,
      rejection_reason_id: rejectionReasonId || null,
      rejection_note: rejectionNote || null,
      send_status: result.ok ? "sent" : "failed",
      error_message: result.ok ? null : result.error,
      sent_by: u.user.id,
      sent_by_email: sentByEmail,
    });
    if (insertError) {
      console.error("Failed to log applicant_emails row:", insertError);
    }

    if (!result.ok) {
      return new Response(JSON.stringify({ success: false, error: result.error }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-applicant-email:", error);
    return new Response(JSON.stringify({ error: "Failed to send applicant email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
