import { supabase } from "@/integrations/supabase/client";

export type ErrorSeverity = "debug" | "info" | "warning" | "error" | "critical";
export type ErrorSource = "client" | "query" | "mutation" | "edge_function";

interface LogClientErrorInput {
  severity?: ErrorSeverity;
  source: ErrorSource;
  message: string;
  stack?: string | null;
  context?: Record<string, unknown> | null;
}

const recentlyLogged = new Map<string, number>();
const DEDUPE_WINDOW_MS = 30_000;

function shouldSkip(key: string): boolean {
  const now = Date.now();
  const last = recentlyLogged.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) return true;
  recentlyLogged.set(key, now);
  if (recentlyLogged.size > 200) {
    const cutoff = now - DEDUPE_WINDOW_MS;
    for (const [k, t] of recentlyLogged) {
      if (t < cutoff) recentlyLogged.delete(k);
    }
  }
  return false;
}

/**
 * Fire-and-forget client-side error logger. Never throws - a logging
 * failure must never compound the original error. De-duped per
 * message+source so a render loop or retry storm can't flood the table.
 */
export function logClientError(input: LogClientErrorInput): void {
  const dedupeKey = `${input.source}:${input.message}`;
  if (shouldSkip(dedupeKey)) return;

  try {
    let userId: string | null = null;
    let userEmail: string | null = null;
    void supabase.auth.getSession().then(({ data }) => {
      userId = data.session?.user?.id ?? null;
      userEmail = data.session?.user?.email ?? null;
      return supabase.from("error_log").insert({
        severity: input.severity ?? "error",
        source: input.source,
        message: input.message.slice(0, 2000),
        stack: input.stack ? input.stack.slice(0, 8000) : null,
        context: input.context ?? null,
        url: typeof window !== "undefined" ? window.location.href : null,
        user_id: userId,
        user_email: userEmail,
      });
    });
  } catch {
    // swallow - logging must never throw
  }
}
