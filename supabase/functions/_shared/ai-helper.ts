// Shared AI helper: calls Gemini directly via Google's Generative Language API
// (OpenAI-compatible endpoint), and logs every call to ai_usage_log.
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
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  let status = 0;
  let data: any = null;
  let errorText = "";
  let promptTokens = 0;
  let completionTokens = 0;

  if (!geminiKey) {
    return { ok: false, status: 500, errorText: "No AI key configured", promptTokens: 0, completionTokens: 0 };
  }

  const reqBody = { ...opts.body, model: opts.model.replace(/^google\//, "") };

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${geminiKey}` },
      body: JSON.stringify(reqBody),
    });
    status = res.status;
    if (res.ok) {
      data = await res.json();
    } else {
      errorText = await res.text();
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
    }
    await supa.from("ai_usage_log").insert({
      service: opts.service,
      model: opts.model,
      user_id: opts.userId || null,
      user_email: opts.userEmail || null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      estimated_cost_usd: cost,
      status: st,
      error_code: errCode,
      duration_ms: Date.now() - t0,
      metadata: { ...(opts.metadata || {}) },
    });
  } catch (e) {
    console.error("ai_usage_log insert failed:", e);
  }

  return { ok: !!data, status, data, errorText, promptTokens, completionTokens };
}
