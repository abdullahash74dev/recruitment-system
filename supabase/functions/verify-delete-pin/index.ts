import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PBKDF2-SHA256 hashing helpers
async function hashPin(pin: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  const saltBytes = saltB64
    ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
  const saltOut = btoa(String.fromCharCode(...saltBytes));
  return { hash: hashB64, salt: saltOut };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin.from("profiles").select("is_active").eq("user_id", userData.user.id).maybeSingle();
    if (!profile?.is_active) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { pin, checkOnly, setPin } = body || {};

    const { data: secret } = await admin.from("app_secrets").select("value").eq("key", "delete_pin").maybeSingle();
    const stored = (secret as any)?.value as string | null | undefined;
    const configured = !!stored;

    // Set/update PIN — admin only
    if (typeof setPin === "string") {
      const { data: rolesRow } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
      const isAdmin = (rolesRow || []).some((r: any) => r.role === "admin");
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!/^\d{6,8}$/.test(setPin)) {
        return new Response(JSON.stringify({ error: "PIN must be 6-8 digits" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { hash, salt } = await hashPin(setPin);
      const value = `pbkdf2$${salt}$${hash}`;
      const { error: upErr } = await admin
        .from("app_secrets")
        .upsert({ key: "delete_pin", value, updated_by: userData.user.id, updated_at: new Date().toISOString() });
      if (upErr) throw upErr;
      return new Response(JSON.stringify({ success: true, configured: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (checkOnly) {
      return new Response(JSON.stringify({ configured }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof pin !== "string" || !pin) {
      return new Response(JSON.stringify({ valid: false, configured, reason: "missing_pin" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!configured) {
      return new Response(JSON.stringify({ valid: false, configured, reason: "not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let valid = false;
    if (stored && stored.startsWith("pbkdf2$")) {
      const [, salt, expected] = stored.split("$");
      const { hash } = await hashPin(pin, salt);
      valid = timingSafeEqual(hash, expected);
    } else {
      // Legacy plaintext PIN — accept once, then transparently rehash
      valid = pin === stored;
      if (valid) {
        const { hash, salt } = await hashPin(pin);
        await admin.from("app_secrets").upsert({
          key: "delete_pin",
          value: `pbkdf2$${salt}$${hash}`,
          updated_by: userData.user.id,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Audit every PIN attempt (success and failure) for enumeration detection
    const { data: prof2 } = await admin.from("profiles").select("email").eq("user_id", userData.user.id).maybeSingle();
    await admin.from("audit_log").insert({
      action: "CUSTOM",
      summary: valid ? "Delete PIN verified" : "Delete PIN attempt failed",
      user_id: userData.user.id,
      user_email: (prof2 as any)?.email ?? null,
      new_data: { event: "delete_pin_attempt", success: valid },
    });

    return new Response(JSON.stringify({ valid, configured }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-delete-pin error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
