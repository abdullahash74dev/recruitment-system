import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Deliberately excludes: notes, status, submission_token_hash, is_archived,
// archived_at, extra_fields, source, source_company -- internal-only /
// competitive-intel fields that must never reach an external client org, no
// matter how many credits they've spent. Mirrors the admin detail dialog
// (DashboardPage.tsx) minus that internal set.
//
// Everything here is viewable WITHOUT a reveal -- this endpoint is the
// Bayt.com-style "browse the full CV" surface. Only phone, email, and the
// résumé PDF are credit-gated (masked/withheld below until a reveal exists),
// same as client-search-applicants' masking. The other four supporting
// documents (degree/experience/training/other) are NOT gated -- the client
// explicitly asked for "everything except the number, email, and the
// original résumé PDF" to be free to browse.
const PROFILE_COLUMNS = [
  "id", "full_name", "phone", "email", "gender", "nationality", "birth_date",
  "marital_status", "current_city", "preferred_city", "has_transport", "linkedin",
  "education_level", "major", "university", "graduation_year", "gpa",
  "desired_position", "job_type", "years_experience", "currently_employed",
  "current_title", "current_salary", "expected_salary", "available_date",
  "current_tasks", "other_experience", "facility_management_exp",
  "arabic_level", "english_level", "other_language",
  "self_summary",
  "resume_url", "degree_url", "experience_cert_url", "training_certs_url", "other_docs_url",
].join(", ");

const OPEN_DOC_FIELDS = ["degree_url", "experience_cert_url", "training_certs_url", "other_docs_url"] as const;

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const s = String(phone);
  if (s.length <= 2) return s + "********";
  return s.slice(0, 2) + "********";
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const s = String(email);
  const atIdx = s.indexOf("@");
  if (atIdx <= 0) return "***";
  const first = s[0];
  const domain = s.slice(atIdx + 1);
  const parts = domain.split(".").filter(Boolean);
  const lastSeg = parts.length > 0 ? parts[parts.length - 1] : "";
  return `${first}***@***${lastSeg ? "." + lastSeg : ""}`;
}

async function signIfNeeded(supabaseAdmin: ReturnType<typeof createClient>, path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const { data } = await supabaseAdmin.storage.from("resumes").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const callerUserId = claimsData.claims.sub;

    const { data: clientUser, error: clientUserError } = await supabaseAdmin
      .from("client_users")
      .select("id, client_organization_id, is_active")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (clientUserError || !clientUser || !clientUser.is_active) {
      return json({ error: "Not an active client user" }, 403);
    }
    const clientOrganizationId = clientUser.client_organization_id;

    const { data: org, error: orgError } = await supabaseAdmin
      .from("client_organizations")
      .select("id, subscription_status, expires_at")
      .eq("id", clientOrganizationId)
      .maybeSingle();
    if (orgError || !org) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }
    const isExpired = !!org.expires_at && new Date(org.expires_at) <= new Date();
    if (org.subscription_status !== "active" || isExpired) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }

    let body: { applicant_id?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const applicantId = body.applicant_id;
    if (typeof applicantId !== "string" || applicantId.trim().length === 0) {
      return json({ error: "applicant_id is required" }, 400);
    }

    const { data: applicant, error: applicantError } = await supabaseAdmin
      .from("applicants")
      .select(PROFILE_COLUMNS)
      .eq("id", applicantId)
      .maybeSingle();
    if (applicantError || !applicant) {
      return json({ error: "Applicant not found" }, 404);
    }

    const { data: reveal } = await supabaseAdmin
      .from("candidate_reveals")
      .select("id")
      .eq("client_organization_id", clientOrganizationId)
      .eq("applicant_id", applicantId)
      .maybeSingle();
    const isRevealed = !!reveal;

    const a = applicant as Record<string, unknown>;

    // The 4 non-résumé supporting documents are always signed/open.
    const docs: Record<string, string | null> = {};
    for (const field of OPEN_DOC_FIELDS) {
      docs[field] = await signIfNeeded(supabaseAdmin, a[field] as string | null);
    }

    // Phone, email, and the résumé PDF itself are the only credit-gated
    // fields -- withheld/masked until this org has revealed this applicant.
    const rawResumePath = a.resume_url as string | null;
    const resumeUrl = isRevealed ? await signIfNeeded(supabaseAdmin, rawResumePath) : null;

    return json({
      ...a,
      phone: isRevealed ? a.phone : maskPhone(a.phone as string | null),
      email: isRevealed ? a.email : maskEmail(a.email as string | null),
      resume_url: resumeUrl,
      has_resume: !!rawResumePath,
      ...docs,
      is_revealed: isRevealed,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
