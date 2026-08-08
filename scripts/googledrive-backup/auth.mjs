import "dotenv/config";
import { deviceLogin, CACHE_PATH } from "./lib/googleAuth.mjs";
import { getMyEmail } from "./lib/drive.mjs";

// One-time interactive login: prints a short code + URL, you open the URL
// from any browser, enter the code, and sign in with the Google account
// you want backups written to. The refresh token is then cached locally
// (.token-cache.json) and every future `npm run backup` reuses it silently.
async function main() {
  const result = await deviceLogin();
  const email = await getMyEmail(result.access_token);
  console.log(`Signed in as: ${email || "(unknown)"}`);
  console.log(`Session cached at: ${CACHE_PATH}`);
  console.log("You can now run: npm run backup");
}

main().catch((err) => {
  console.error("Sign-in failed:", err.message || err);
  process.exit(1);
});
