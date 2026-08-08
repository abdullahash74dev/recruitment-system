import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PublicClientApplication } from "@azure/msal-node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, "..", ".token-cache.json");

const GRAPH_SCOPES = ["Files.ReadWrite", "offline_access", "User.Read"];

// Persists the MSAL token cache (which holds the refresh token) to a local
// file with owner-only permissions, so `node auth.mjs` only has to run
// once -- every later `node backup.mjs` run reuses/refreshes it silently.
const cachePlugin = {
  beforeCacheAccess: async (context) => {
    if (fs.existsSync(CACHE_PATH)) {
      context.tokenCache.deserialize(fs.readFileSync(CACHE_PATH, "utf-8"));
    }
  },
  afterCacheAccess: async (context) => {
    if (context.cacheHasChanged) {
      fs.writeFileSync(CACHE_PATH, context.tokenCache.serialize(), { mode: 0o600 });
    }
  },
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export function createPca() {
  const clientId = requireEnv("ONEDRIVE_CLIENT_ID");
  const tenant = process.env.ONEDRIVE_TENANT || "consumers";
  return new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenant}`,
    },
    cache: { cachePlugin },
  });
}

export { GRAPH_SCOPES, CACHE_PATH };

/**
 * Returns a valid access token, refreshing silently from the cached
 * account if possible. Throws a clear error telling the operator to run
 * `node auth.mjs` first if there's no usable cached session yet.
 */
export async function getAccessToken() {
  const pca = createPca();
  const cache = pca.getTokenCache();
  const accounts = await cache.getAllAccounts();
  if (accounts.length === 0) {
    throw new Error("No cached Microsoft sign-in found. Run `npm run auth` first to sign in to OneDrive.");
  }
  const result = await pca.acquireTokenSilent({ account: accounts[0], scopes: GRAPH_SCOPES });
  return result.accessToken;
}
