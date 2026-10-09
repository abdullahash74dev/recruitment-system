// fetch() follows redirects by default, so validating only the first URL
// lets an attacker-controlled https host 302 to an internal address
// (e.g. cloud metadata at 169.254.169.254). Follow redirects by hand and
// re-run the caller's SSRF check on every hop.
export async function fetchWithSafeRedirects(
  url: string,
  isSafe: (parsed: URL) => Promise<boolean>,
  init: RequestInit = {},
  maxRedirects = 3,
): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const parsed = new URL(current);
    if (!(await isSafe(parsed))) throw new Error("Blocked host");
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get("location");
    if (!location) return res;
    current = new URL(location, current).href;
  }
  throw new Error("Too many redirects");
}
