import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { ALLOW_ORIGIN } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Anti-abuse: only send confirmation for emails that match a freshly-submitted applicant (last 5 min).
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("applicants")
      .select("id, full_name, desired_position")
      .ilike("email", normalizedEmail)
      .gte("created_at", fiveMinAgo)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!recent || recent.length === 0) {
      // Silent no-op: avoid leaking whether a specific email recently submitted an application.
      return new Response(JSON.stringify({ success: true, message: "Confirmation email queued" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const applicant = recent[0];
    const position = applicant.desired_position || "الوظيفة المطلوبة";
    const subject = "تم استلام طلبك بنجاح";
    const text =
      `الأستاذ/ة ${applicant.full_name}،\n\n` +
      `نشكر تقدمك لشاغر "${position}".\n` +
      `تم استلام طلبك بنجاح وسيقوم فريق التوظيف بمراجعته، وسنتواصل معك في حال وجود أي مستجدات.\n\n` +
      `مع التقدير،\nفريق التوظيف`;

    const result = await sendEmail({ to: normalizedEmail, subject, text });

    await admin.from("applicant_emails").insert({
      applicant_id: applicant.id,
      template_key: "application_received",
      status_at_send: "new",
      recipient_email: normalizedEmail,
      language: "ar",
      subject,
      body_preview: text,
      send_status: result.ok ? "sent" : "failed",
      error_message: result.ok ? null : result.error,
    });

    if (!result.ok) {
      console.error(`Confirmation email failed for applicant ${applicant.id}: ${result.error}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: result.ok ? "Confirmation email sent" : "Confirmation email failed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-confirmation-email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process confirmation email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
