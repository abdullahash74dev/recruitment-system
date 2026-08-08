import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, "..", ".token-cache.json");

// drive.file: the app can only see/manage files *it* creates -- deliberately
// narrower than full Drive access, since all this tool ever needs is to
// create its own backup folder and write into it.
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const DEVICE_CODE_URL = "https://oauth2.googleapis.com/device/code";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function saveCache(data) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return null;
  return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
}

/**
 * One-time interactive sign-in via Google's device authorization grant --
 * prints a short code + URL, then polls until the operator finishes
 * signing in from any browser. Caches the refresh token locally so every
 * later run refreshes silently.
 */
export async function deviceLogin() {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

  const codeRes = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, scope: SCOPE }),
  });
  if (!codeRes.ok) throw new Error(`device/code request failed (${codeRes.status}): ${await codeRes.text()}`);
  const device = await codeRes.json();
  const verificationUrl = device.verification_url || device.verification_uri;
  console.log(`\nOpen ${verificationUrl} and enter this code: ${device.user_code}\n`);
  console.log("If Google shows an \"unverified app\" warning, that's expected -- this is your own private app in your own Google Cloud project. Click Advanced > Go to (app name).\n");

  let interval = (device.interval || 5) * 1000;
  const deadline = Date.now() + (device.expires_in || 1800) * 1000;

  while (Date.now() < deadline) {
    await sleep(interval);
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        device_code: device.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const body = await tokenRes.json();
    if (tokenRes.ok) {
      saveCache({ refresh_token: body.refresh_token });
      return body;
    }
    if (body.error === "authorization_pending") continue;
    if (body.error === "slow_down") {
      interval += 5000;
      continue;
    }
    throw new Error(`Sign-in failed: ${body.error_description || body.error}`);
  }
  throw new Error("Device code expired before sign-in completed. Run `npm run auth` again.");
}

/** Returns a fresh access token using the cached refresh token. */
export async function getAccessToken() {
  const cache = loadCache();
  if (!cache?.refresh_token) {
    throw new Error("No cached Google sign-in found. Run `npm run auth` first to sign in to Google Drive.");
  }
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: cache.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status}): ${await res.text()}. Try running \`npm run auth\` again.`);
  }
  const body = await res.json();
  return body.access_token;
}

export { CACHE_PATH };
