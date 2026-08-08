import "dotenv/config";
import { createPca, GRAPH_SCOPES, CACHE_PATH } from "./lib/msalClient.mjs";

// One-time interactive login: prints a short code, you enter it at
// https://microsoft.com/devicelogin and sign in with the Microsoft/OneDrive
// account you want backups written to. After this succeeds, the refresh
// token is cached locally (.token-cache.json) and every future
// `npm run backup` reuses it silently -- no browser needed again unless the
// cache is deleted or the token is revoked.
async function main() {
  const pca = createPca();

  const deviceCodeRequest = {
    scopes: GRAPH_SCOPES,
    deviceCodeCallback: (response) => {
      console.log("\n" + response.message + "\n");
    },
  };

  const result = await pca.acquireTokenByDeviceCode(deviceCodeRequest);
  console.log(`Signed in as: ${result.account.username}`);
  console.log(`Session cached at: ${CACHE_PATH}`);
  console.log("You can now run: npm run backup");
}

main().catch((err) => {
  console.error("Sign-in failed:", err.message || err);
  process.exit(1);
});
