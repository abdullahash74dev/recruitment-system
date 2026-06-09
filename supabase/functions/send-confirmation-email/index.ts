import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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
    console.log(`Confirmation email queued for applicant ${applicant.id}: ${normalizedEmail}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Confirmation email queued",
        note: "Email sending will activate once email domain is configured",
      }),
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
