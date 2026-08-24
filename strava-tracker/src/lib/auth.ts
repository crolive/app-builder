// NextAuth (Auth.js) configuration. Uses the JWT session strategy with no
// database adapter: our own `User` table (see prisma/schema.prisma) is the
// single source of truth for both the app's notion of a member and the
// Strava OAuth tokens used for API calls, per spec. The allowlist check
// (Feature 1/2) runs in the `signIn` callback, before any User record is
// created, on every login attempt.

import https from "https";
import { TokenSet } from "openid-client";
import type { AuthOptions } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { prisma } from "@/lib/prisma";
import { runBackfill } from "@/lib/strava/backfill";

// On some networks, outbound HTTPS requests to Strava that carry an
// Authorization header get reset when Node picks an IPv6 route — observed
// consistently in testing, and not reliably fixed by dns.setDefaultResultOrder
// (Node's Happy Eyeballs socket racing doesn't consistently honor it). So the
// token exchange and profile fetch below bypass openid-client's default HTTP
// client entirely and force IPv4 directly on the socket.
function requestStravaJSON(
  options: https.RequestOptions,
  body?: string
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const req = https.request({ ...options, family: 4, timeout: 10000 }, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, json: raw ? JSON.parse(raw) : {} });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Strava request timed out")));
    if (body) req.write(body);
    req.end();
  });
}

interface StravaProfile {
  id: number;
  firstname: string;
  lastname: string;
  profile?: string;
  profile_medium?: string;
}

function StravaProvider(): OAuthConfig<StravaProfile> {
  return {
    id: "strava",
    name: "Strava",
    type: "oauth",
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    authorization: {
      url: "https://www.strava.com/oauth/authorize",
      params: {
        scope: "activity:read_all",
        approval_prompt: "auto",
        response_type: "code",
      },
    },
    token: {
      url: "https://www.strava.com/oauth/token",
      async request({ params, provider }) {
        const body = new URLSearchParams({
          client_id: provider.clientId ?? "",
          client_secret: provider.clientSecret ?? "",
          code: params.code ?? "",
          grant_type: "authorization_code",
        }).toString();
        const { status, json } = await requestStravaJSON(
          {
            hostname: "www.strava.com",
            path: "/oauth/token",
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": Buffer.byteLength(body),
            },
          },
          body
        );
        if (status !== 200) {
          throw new Error(`Strava token exchange failed (${status}): ${JSON.stringify(json)}`);
        }
        return { tokens: new TokenSet(json) };
      },
    },
    userinfo: {
      url: "https://www.strava.com/api/v3/athlete",
      async request({ tokens }) {
        const { status, json } = await requestStravaJSON({
          hostname: "www.strava.com",
          path: "/api/v3/athlete",
          method: "GET",
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (status !== 200) {
          throw new Error(`Strava profile fetch failed (${status}): ${JSON.stringify(json)}`);
        }
        return json;
      },
    },
    profile(profile) {
      return {
        id: String(profile.id),
        name: `${profile.firstname} ${profile.lastname}`.trim(),
        image: profile.profile ?? profile.profile_medium ?? null,
      };
    },
    checks: ["state"],
  };
}

export const authOptions: AuthOptions = {
  providers: [StravaProvider()],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    // Redirect both a rejected sign-in (AccessDenied, from the allowlist
    // check below) and any other auth error back to the public dashboard,
    // where the error is surfaced as a visible banner.
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (!account || !profile) return false;
      const stravaProfile = profile as unknown as StravaProfile;
      const stravaAthleteId = String(stravaProfile.id);

      const allowlisted = await prisma.allowlistedAthlete.findUnique({
        where: { stravaAthleteId },
      });
      if (!allowlisted) {
        // Rejects sign-in: NextAuth creates no User/session and redirects
        // to `pages.error` with ?error=AccessDenied.
        return false;
      }

      if (!account.access_token || !account.refresh_token) return false;

      const tokenExpiresAt = account.expires_at
        ? new Date(account.expires_at * 1000)
        : new Date(Date.now() + 6 * 60 * 60 * 1000);

      const user = await prisma.user.upsert({
        where: { stravaAthleteId },
        create: {
          stravaAthleteId,
          firstName: stravaProfile.firstname ?? "",
          lastName: stravaProfile.lastname ?? "",
          profilePhotoUrl: stravaProfile.profile ?? stravaProfile.profile_medium ?? null,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          tokenExpiresAt,
          connectionStatus: "CONNECTED",
        },
        update: {
          firstName: stravaProfile.firstname ?? undefined,
          lastName: stravaProfile.lastname ?? undefined,
          profilePhotoUrl: stravaProfile.profile ?? stravaProfile.profile_medium ?? undefined,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          tokenExpiresAt,
          // Re-authorizing resets a DISCONNECTED user back to CONNECTED
          // (Feature 4) and sync resumes for them.
          connectionStatus: "CONNECTED",
        },
      });

      if (!user.hasCompletedBackfill) {
        try {
          await runBackfill(user.id);
        } catch (err) {
          console.error(`Backfill failed for user ${user.id}:`, err);
        } finally {
          await prisma.user.update({
            where: { id: user.id },
            data: { hasCompletedBackfill: true },
          });
        }
      }

      return true;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const stravaProfile = profile as unknown as StravaProfile;
        const dbUser = await prisma.user.findUnique({
          where: { stravaAthleteId: String(stravaProfile.id) },
        });
        if (dbUser) token.userId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.userId } });
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.name = `${dbUser.firstName} ${dbUser.lastName}`.trim();
          session.user.image = dbUser.profilePhotoUrl ?? undefined;
          session.user.connectionStatus = dbUser.connectionStatus;
        }
      }
      return session;
    },
  },
};
