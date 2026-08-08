import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

// Service-role client -- bypasses RLS by design, since this tool needs to
// read every applicant's résumé regardless of who owns/reveals it. Only
// ever run this from a trusted machine with the .env file kept out of git.
export function createSupabaseAdmin() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}
