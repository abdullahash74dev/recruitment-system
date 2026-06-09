// Edge function: removes the background of a logo using Lovable AI (Gemini image edit)
// Returns the processed image as a public URL stored in the ad-assets bucket.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type OutputMode = "transparent" | "white-png" | "white-jpg";

const MODE_PROMPTS: Record<OutputMode, string> = {
  transparent:
    "Extract only the actual logo, lettering, symbols, and printed design elements from this image. Remove every non-logo area completely. Keep only the written/logo content with crisp edges on a TRANSPARENT background. Do not add shadows, glows, boxes, or extra shapes. Preserve original colors and proportions. Output a clean cutout logo as PNG with transparency.",
  "white-png":
    "Extract only the actual logo, lettering, symbols, and printed design elements from this image. Remove every non-logo area completely. Keep only the written/logo content with crisp edges, then place it on a PURE WHITE (#FFFFFF) background. Do not add shadows, glows, boxes, or extra shapes. Preserve original colors and proportions. Output as a clean PNG on white.",
  "white-jpg":
    "Extract only the actual logo, lettering, symbols, and printed design elements from this image. Remove every non-logo area completely. Keep only the written/logo content with crisp edges, then place it on a PURE WHITE (#FFFFFF) background suitable for JPG export. Do not add shadows, glows, boxes, or extra shapes. Preserve original colors and proportions.",
};

function isBlockedIp(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || host === "0" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
  const ipv4 = host.match(/(?:^|:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)?.[1] || host;
  const parts = ipv4.split(".").map((p) => Number(p));
  if (parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)) {
    const [a, b] = parts;
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  return false;
}

async function isSafeRemoteUrl(parsed: URL): Promise<boolean> {
  if (parsed.protocol !== "https:") return false;
  if (isBlockedIp(parsed.hostname)) return false;
  const [aRecords, aaaaRecords] = await Promise.all([
    Deno.resolveDns(parsed.hostname, "A").catch(() => []),
    Deno.resolveDns(parsed.hostname, "AAAA").catch(() => []),
  ]);
  const resolved = [...aRecords, ...aaaaRecords];
  return resolved.length > 0 && resolved.every((ip) => !isBlockedIp(ip));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth: must be admin/HR
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const adminCheck = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isHr } = await adminCheck.rpc("is_admin_or_hr", { _user_id: u.user.id });
    if (!isHr) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { imageUrl, outputMode = "transparent" } = await req.json();
    if (!imageUrl || typeof imageUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["transparent", "white-png", "white-jpg"].includes(outputMode)) {
      return new Response(JSON.stringify({ error: "Invalid outputMode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SSRF guard: only allow https + reject private/loopback hostnames
    let parsed: URL;
    try { parsed = new URL(imageUrl); } catch {
      return new Response(JSON.stringify({ error: "Invalid imageUrl" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (parsed.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "Only https URLs are allowed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!(await isSafeRemoteUrl(parsed))) {
      return new Response(JSON.stringify({ error: "Blocked host" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const srcResp = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    const srcLen = Number(srcResp.headers.get("content-length") || "0");
    if (srcLen && srcLen > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Source image too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!srcResp.ok) throw new Error(`Failed to fetch source image (${srcResp.status})`);
    const srcBuf = new Uint8Array(await srcResp.arrayBuffer());
    const srcMime = srcResp.headers.get("content-type") || "image/png";
    let bin = "";
    for (let i = 0; i < srcBuf.length; i++) bin += String.fromCharCode(srcBuf[i]);
    const srcDataUrl = `data:${srcMime};base64,${btoa(bin)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: MODE_PROMPTS[outputMode as OutputMode],
              },
              { type: "image_url", image_url: { url: srcDataUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error ${aiResp.status}: ${txt}`);
    }

    const data = await aiResp.json();
    const out: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!out || !out.startsWith("data:")) throw new Error("No image returned from AI");

    const [meta, b64] = out.split(",");
    const mimeMatch = /data:([^;]+);base64/.exec(meta);
    const mime = mimeMatch?.[1] || "image/png";
    const ext = mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpg" : "png";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const path = `logo/ai-${outputMode}-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("ad-assets").upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("ad-assets").getPublicUrl(path);

    return new Response(JSON.stringify({ url: pub.publicUrl, outputMode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("remove-logo-bg error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
