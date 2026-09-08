// Shared CORS origin for every edge function. Restricts responses to the
// site's production domain instead of "*" once ALLOWED_ORIGIN is set (see
// DEPLOYMENT.md) -- a single origin, e.g. "https://your-app.vercel.app".
// Every sensitive function already requires a valid Bearer token before
// doing anything with the request, so this is defense-in-depth on top of
// that, not the primary access control -- and it defaults to "*" (today's
// behavior) so leaving it unset changes nothing.
export const ALLOW_ORIGIN = (Deno.env.get("ALLOWED_ORIGIN") || "").trim() || "*";
