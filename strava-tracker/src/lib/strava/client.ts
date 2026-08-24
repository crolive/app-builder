// Thin wrapper around the Strava REST API. No SDK dependency, per the
// project's tech stack constraints.
//
// Uses the classic `https` module with IPv4 forced on the socket, rather
// than `fetch`, because on some networks outbound requests to Strava that
// carry an Authorization header get reset when Node resolves the host over
// IPv6 — observed consistently in testing, and not reliably fixed by
// dns.setDefaultResultOrder for either the classic http client or fetch's
// underlying undici client. See src/lib/auth.ts for the same treatment of
// the OAuth token/profile exchange.
import https from "https";

interface StravaHttpResponse {
  status: number;
  json: any;
}

function requestStrava(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<StravaHttpResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = options.body
      ? { ...options.headers, "Content-Length": String(Buffer.byteLength(options.body)) }
      : options.headers;
    const req = https.request(
      {
        hostname: u.hostname,
        path: `${u.pathname}${u.search}`,
        method: options.method ?? "GET",
        headers,
        family: 4,
        timeout: 10000,
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
    if (options.body) req.write(options.body);
    req.end();
  });
}

const STRAVA_OAUTH_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  token_type?: string;
}

export class StravaAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StravaAuthError";
  }
}

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokenResponse> {
  const { status, json } = await requestStrava(STRAVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (status === 400 || status === 401) {
    throw new StravaAuthError(`Strava token refresh failed with status ${status}`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Strava token refresh failed with status ${status}`);
  }
  return json;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  start_date: string; // ISO 8601 UTC
}

export async function fetchAthleteActivities(
  accessToken: string,
  params: { page: number; perPage: number; after?: number }
): Promise<StravaActivity[]> {
  const search = new URLSearchParams({
    page: String(params.page),
    per_page: String(params.perPage),
  });
  if (params.after) search.set("after", String(params.after));

  const { status, json } = await requestStrava(
    `${STRAVA_API_BASE}/athlete/activities?${search.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (status === 401) {
    throw new StravaAuthError("Strava rejected the access token while listing activities");
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Failed to fetch Strava activities: ${status}`);
  }
  return json;
}

export async function fetchActivityById(
  accessToken: string,
  activityId: string | number
): Promise<StravaActivity> {
  const { status, json } = await requestStrava(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (status === 401) {
    throw new StravaAuthError("Strava rejected the access token while fetching an activity");
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Failed to fetch Strava activity ${activityId}: ${status}`);
  }
  return json;
}
