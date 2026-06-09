// Shared AI helper: tries Lovable AI first, falls back to direct Gemini if 402/429,
// and logs every call to ai_usage_log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AICallOptions {
  service: string;
  model: string; // e.g. "google/gemini-2.5-flash" or "google/gemini-2.5-pro"
  body: Record<string, any>; // chat completion body (model will be overridden)
  userId?: string | null;
  userEmail?: string | null;
  metadata?: Record<string, any>;
}

export interface AICallResult {
  ok: boolean;
  status: number;
  data?: any;
  errorText?: string;
  usedDirectGemini: boolean;
  promptTokens: number;
  completionTokens: number;
}

const PRICE: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-pro": { in: 1.25, out: 10 },
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "google/gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
};

export async function callAI(opts: AICallOptions): Promise<AICallResult> {
  const t0 = Date.now();
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  let usedDirectGemini = false;
  let status = 0;
  let data: any = null;
  let errorText = "";
  let promptTokens = 0;
  let completionTokens = 0;

  const reqBody = { ...opts.body, model: opts.model };

  try {
    if (apiKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(reqBody),
      });
      status = res.status;
      if (res.ok) {
        data = await res.json();
      } else {
        errorText = await res.text();
        // Fallback to direct Gemini on credits/rate-limit
        if ((status === 402 || status === 429) && geminiKey) {
          const geminiModel = opts.model.replace(/^google\//, "");
          const res2 = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${geminiKey}` },
            body: JSON.stringify({ ...reqBody, model: geminiModel }),
          });
          status = res2.status;
          if (res2.ok) {
            data = await res2.json();
            usedDirectGemini = true;
            errorText = "";
          } else {
            errorText = await res2.text();
          }
        }
      }
    } else if (geminiKey) {
      const geminiModel = opts.model.replace(/^google\//, "");
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${geminiKey}` },
        body: JSON.stringify({ ...reqBody, model: geminiModel }),
      });
      status = res.status;
      usedDirectGemini = true;
      if (res.ok) data = await res.json();
      else errorText = await res.text();
    } else {
      return { ok: false, status: 500, errorText: "No AI key configured", usedDirectGemini: false, promptTokens: 0, completionTokens: 0 };
    }

    if (data?.usage) {
      promptTokens = Number(data.usage.prompt_tokens || 0);
      completionTokens = Number(data.usage.completion_tokens || 0);
    }
  } catch (e) {
    errorText = e instanceof Error ? e.message : "AI request failed";
    status = 0;
  }

  // Log usage (best-effort)
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const p = PRICE[opts.model] || { in: 1, out: 4 };
    const cost = (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
    let st = "success";
    let errCode: string | null = null;
    if (!data) {
      st = status === 402 ? "credits_exhausted" : status === 429 ? "rate_limited" : "error";
      errCode = String(status || "exception");
    } else if (usedDirectGemini) {
      st = "success_via_gemini";
    }
    await supa.from("ai_usage_log").insert({
      service: opts.service,
      model: usedDirectGemini ? `${opts.model} (direct)` : opts.model,
      user_id: opts.userId || null,
      user_email: opts.userEmail || null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      estimated_cost_usd: cost,
      status: st,
      error_code: errCode,
      duration_ms: Date.now() - t0,
      metadata: { ...(opts.metadata || {}), used_direct_gemini: usedDirectGemini },
    });
  } catch (e) {
    console.error("ai_usage_log insert failed:", e);
  }

  return { ok: !!data, status, data, errorText, usedDirectGemini, promptTokens, completionTokens };
}
