// Deletes the app's existing Strava webhook subscription. Useful when
// re-pointing the callback URL (e.g. a new ngrok URL each dev session).
//
// Usage:
//   node --env-file=.env scripts/delete-webhook-subscription.mjs <subscription-id>
//
// Uses the classic `https` module with IPv4 forced on the socket, not
// `fetch` — see create-webhook-subscription.mjs for why.
import https from "https";

const subscriptionId = process.argv[2];

if (!subscriptionId) {
  console.error("Usage: node scripts/delete-webhook-subscription.mjs <subscription-id>");
  process.exit(1);
}

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
  console.error("Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET in the environment.");
  process.exit(1);
}

const params = new URLSearchParams({
  client_id: STRAVA_CLIENT_ID,
  client_secret: STRAVA_CLIENT_SECRET,
});

const { status, text } = await new Promise((resolve, reject) => {
  const req = https.request(
    {
      hostname: "www.strava.com",
      path: `/api/v3/push_subscriptions/${subscriptionId}?${params}`,
      method: "DELETE",
      family: 4,
      timeout: 10000,
    },
    (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: raw }));
    }
  );
  req.on("error", reject);
  req.on("timeout", () => req.destroy(new Error("Strava request timed out")));
  req.end();
});

console.log(`Status: ${status}`);
if (status !== 204) {
  console.log(text);
}
