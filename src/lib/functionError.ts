import { FunctionsHttpError } from "@supabase/supabase-js";

// supabase-js's FunctionsHttpError.message is always the generic
// "Edge Function returned a non-2xx status code" - the real reason
// (e.g. "Role check failed", "Forbidden", rate limits) is only in the
// response body, reachable via error.context.
export async function getFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.clone().json();
      if (body?.details) return `${body.error || fallback}: ${body.details}`;
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // body wasn't JSON
    }
  }
  return error instanceof Error ? error.message : fallback;
}
