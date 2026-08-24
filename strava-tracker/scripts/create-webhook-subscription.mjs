// One-time setup script: creates the single, app-level Strava webhook
// subscription (Feature 5). Run once per environment (e.g. once against
// your ngrok URL for local dev, once against your Vercel URL for prod).
//
// Usage (Node 20+, which supports --env-file):
//   node --env-file=.env scripts/create-webhook-subscription.mjs https://your-public-url.example.com
//
// Or export STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_WEBHOOK_VERIFY_TOKEN
// in your shell first, then run without --env-file.
//
// Uses the classic `https` module with IPv4 forced on the socket, not
// `fetch` — on some networks, outbound requests to Strava get reset when
// Node resolves the host over IPv6. See src/lib/strava/client.ts for the
// same treatment inside the app itself.
import https from "https";

const callbackBase = process.argv[2];

if (!callbackBase) {
  console.error("Usage: node scripts/create-webhook-subscription.mjs <public-base-url>");
  process.exit(1);
}

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN } = process.env;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_WEBHOOK_VERIFY_TOKEN) {
  console.error(
    "Missing STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, or STRAVA_WEBHOOK_VERIFY_TOKEN in the environment."
  );
  process.exit(1);
}

const body = JSON.stringify({
  client_id: STRAVA_CLIENT_ID,
  client_secret: STRAVA_CLIENT_SECRET,
  callback_url: `${callbackBase.replace(/\/$/, "")}/api/webhook`,
  verify_token: STRAVA_WEBHOOK_VERIFY_TOKEN,
});

const { status, json } = await new Promise((resolve, reject) => {
  const req = https.request(
    {
      hostname: "www.strava.com",
      path: "/api/v3/push_subscriptions",
      method: "POST",
      family: 4,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, json: raw ? JSON.parse(raw) : {} });
        } catch (err) {
          reject(err);
        }
      });
    }
  );
  req.on("error", reject);
  req.on("timeout", () => req.destroy(new Error("Strava request timed out")));
  req.write(body);
  req.end();
});

console.log(`Status: ${status}`);
console.log(JSON.stringify(json, null, 2));

if (status < 200 || status >= 300) process.exit(1);
