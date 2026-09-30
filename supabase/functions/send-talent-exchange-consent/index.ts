import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ALLOW_ORIGIN } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Generates a long random token and emails the employee a link to review
// and confirm (or decline) sharing their anonymized listing -- the
// releasing company's own say-so is never treated as consent by itself.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await anonClient.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: clientUser } = await admin
      .from("client_users")
      .select("client_organization_id, is_active")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (!clientUser?.is_active) return json({ error: "Not an active client user" }, 403);

    const { listingId, origin } = await req.json();
    if (!listingId || typeof listingId !== "string") return json({ error: "listingId is required" }, 400);
    if (!origin || typeof origin !== "string" || !origin.startsWith("https://")) {
      return json({ error: "A valid https origin is required" }, 400);
    }

    const { data: listing, error: listingError } = await admin
      .from("talent_exchange_listings")
      .select("id, client_organization_id, employee_full_name, employee_contact_email, position_title, status")
      .eq("id", listingId)
      .eq("client_organization_id", clientUser.client_organization_id)
      .maybeSingle();
    if (listingError) return json({ error: listingError.message }, 500);
    if (!listing) return json({ error: "Listing not found" }, 404);
    if (listing.status !== "draft" && listing.status !== "pending_consent") {
      return json({ error: "Only a draft or pending listing can have its consent link (re)sent" }, 400);
    }

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await admin
      .from("talent_exchange_listings")
      .update({
        consent_token: token,
        consent_token_expires_at: expiresAt,
        consent_status: "pending",
        status: "pending_consent",
      })
      .eq("id", listingId);
    if (updateError) return json({ error: updateError.message }, 500);

    const link = `${origin}/talent-exchange/consent/${token}`;
    const subject = "طلب موافقتك على مشاركة بياناتك (مجهولة الهوية) لفرصة عمل بديلة";
    const text =
      `مرحباً ${listing.employee_full_name}،\n\n` +
      `تود جهة عمل مشاركة بيانات وظيفية عنك (بدون اسمك -- فقط المسمى الوظيفي، الرتبة، الراتب، وموقع العمل) ` +
      `مع شركات أخرى قد تكون لديها فرصة عمل مناسبة لك، بخصوص وظيفتك "${listing.position_title}".\n\n` +
      `لن يظهر اسمك أو بيانات التواصل الخاصة بك لأي شركة إلا بعد موافقتك الصريحة هنا.\n\n` +
      `راجع التفاصيل ووافق أو اعتذر من هذا الرابط:\n${link}\n\n` +
      `الرابط صالح لمدة 7 أيام.`;

    const result = await sendEmail({ to: listing.employee_contact_email, subject, text });
    if (!result.ok) {
      return json({ error: `Failed to send consent email: ${result.error}` }, 502);
    }

    return json({ success: true });
  } catch (error) {
    console.error("send-talent-exchange-consent error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
