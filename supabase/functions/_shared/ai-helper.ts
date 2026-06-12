// Shared AI helper: routes every AI call to the configured provider
// (Google Gemini by default, or Anthropic Claude if selected via the
// ai_settings table and ANTHROPIC_API_KEY is configured), normalizes the
// response to an OpenAI-compatible shape so callers don't need to care
// which provider answered, and logs every call to ai_usage_log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AICallOptions {
  service: string;
  model: string; // logical model id, e.g. "google/gemini-2.5-flash" or "google/gemini-2.5-pro"
  body: Record<string, any>; // OpenAI-style chat completion body (model will be overridden)
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
  "anthropic/claude-sonnet-4-6": { in: 3, out: 15 },
  "anthropic/claude-haiku-4-5": { in: 1, out: 5 },
};

// When the system is configured to use Anthropic, each logical Gemini
// model maps to the closest Claude model.
const CLAUDE_MODEL_MAP: Record<string, string> = {
  "google/gemini-2.5-pro": "claude-sonnet-4-6",
  "google/gemini-2.5-flash": "claude-haiku-4-5",
  "google/gemini-2.5-flash-lite": "claude-haiku-4-5",
};

const ANTHROPIC_VERSION = "2023-06-01";

async function resolveProvider(supa: ReturnType<typeof createClient>): Promise<"gemini" | "claude"> {
  try {
    const { data } = await supa.from("ai_settings").select("provider").limit(1).maybeSingle();
    return data?.provider === "claude" ? "claude" : "gemini";
  } catch {
    return "gemini";
  }
}

// ---- OpenAI chat-completions <-> Anthropic Messages API translation ----

function toAnthropicContent(content: any): any {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");
  return content.map((block) => {
    if (block?.type === "text") return { type: "text", text: block.text };
    if (block?.type === "image_url") {
      const url = block.image_url?.url || "";
      const m = /^data:([^;]+);base64,(.+)$/.exec(url);
      if (m) return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
      return { type: "image", source: { type: "url", url } };
    }
    return { type: "text", text: JSON.stringify(block) };
  });
}

function buildAnthropicRequest(model: string, body: Record<string, any>) {
  const systemParts: string[] = [];
  const messages: any[] = [];
  for (const m of body.messages || []) {
    if (m.role === "system") {
      systemParts.push(typeof m.content === "string" ? m.content : JSON.stringify(m.content));
    } else {
      messages.push({ role: m.role === "assistant" ? "assistant" : "user", content: toAnthropicContent(m.content) });
    }
  }
  if (body.response_format?.type === "json_object") {
    systemParts.push("Respond with ONLY a valid JSON object. No markdown, no code fences, no commentary.");
  }

  const req: Record<string, any> = {
    model,
    max_tokens: body.max_tokens || 8192,
    messages,
  };
  if (systemParts.length) req.system = systemParts.join("\n\n");

  if (Array.isArray(body.tools) && body.tools.length) {
    req.tools = body.tools.map((t: any) => ({
      name: t.function?.name,
      description: t.function?.description,
      input_schema: t.function?.parameters,
    }));
  }
  if (body.tool_choice?.type === "function" && body.tool_choice.function?.name) {
    req.tool_choice = { type: "tool", name: body.tool_choice.function.name };
  }
  return req;
}

// Normalizes an Anthropic Messages API response into the OpenAI
// chat-completion shape that every edge function already parses.
function fromAnthropicResponse(data: any) {
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
  const toolCalls = blocks
    .filter((b: any) => b.type === "tool_use")
    .map((b: any) => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));

  return {
    choices: [{
      message: {
        content: text || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: data?.stop_reason,
    }],
    usage: {
      prompt_tokens: Number(data?.usage?.input_tokens || 0),
      completion_tokens: Number(data?.usage?.output_tokens || 0),
    },
  };
}

async function callGemini(geminiKey: string, opts: AICallOptions) {
  const reqBody = { ...opts.body, model: opts.model.replace(/^google\//, "") };
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${geminiKey}` },
    body: JSON.stringify(reqBody),
  });
  const loggedModel = opts.model.startsWith("google/") ? opts.model : `google/${opts.model}`;
  return { res, loggedModel };
}

async function callClaude(anthropicKey: string, opts: AICallOptions) {
  const claudeModel = CLAUDE_MODEL_MAP[opts.model] || "claude-haiku-4-5";
  const reqBody = buildAnthropicRequest(claudeModel, opts.body);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(reqBody),
  });
  return { res, loggedModel: `anthropic/${claudeModel}` };
}

export async function callAI(opts: AICallOptions): Promise<AICallResult> {
  const t0 = Date.now();
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (!geminiKey && !anthropicKey) {
    return { ok: false, status: 500, errorText: "No AI key configured", promptTokens: 0, completionTokens: 0 };
  }

  // Pick the configured provider, falling back to whichever provider
  // actually has a key configured so the system keeps working even if
  // an admin selects a provider before adding its API key.
  let provider = await resolveProvider(supa);
  if (provider === "claude" && !anthropicKey) provider = "gemini";
  if (provider === "gemini" && !geminiKey) provider = "claude";

  let status = 0;
  let data: any = null;
  let errorText = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let loggedModel = opts.model;

  try {
    const { res, loggedModel: lm } = provider === "claude"
      ? await callClaude(anthropicKey!, opts)
      : await callGemini(geminiKey!, opts);
    loggedModel = lm;
    status = res.status;
    if (res.ok) {
      const raw = await res.json();
      data = provider === "claude" ? fromAnthropicResponse(raw) : raw;
      promptTokens = Number(data?.usage?.prompt_tokens || 0);
      completionTokens = Number(data?.usage?.completion_tokens || 0);
    } else {
      errorText = await res.text();
    }
  } catch (e) {
    errorText = e instanceof Error ? e.message : "AI request failed";
    status = 0;
  }

  // Log usage (best-effort)
  try {
    const p = PRICE[loggedModel] || { in: 1, out: 4 };
    const cost = (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
    let st = "success";
    let errCode: string | null = null;
    if (!data) {
      st = status === 402 ? "credits_exhausted" : status === 429 ? "rate_limited" : "error";
      errCode = String(status || "exception");
    }
    await supa.from("ai_usage_log").insert({
      service: opts.service,
      model: loggedModel,
      user_id: opts.userId || null,
      user_email: opts.userEmail || null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      estimated_cost_usd: cost,
      status: st,
      error_code: errCode,
      duration_ms: Date.now() - t0,
      metadata: { ...(opts.metadata || {}), provider },
    });
  } catch (e) {
    console.error("ai_usage_log insert failed:", e);
  }

  return { ok: !!data, status, data, errorText, promptTokens, completionTokens };
}
