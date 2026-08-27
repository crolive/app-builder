# strava-tracker

A shared activity feed and leaderboard for a small (2-4 person), invite-only
group of friends. Members connect Strava via OAuth; Strava activities sync
automatically via webhooks, and anyone can also log manual workouts. The
public feed and leaderboard are viewable by anyone with the link.

## Tech stack

Next.js (App Router) + TypeScript, PostgreSQL (Neon) via Prisma, NextAuth.js
with a custom Strava OAuth provider, Tailwind CSS. Deployed on Vercel.

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Postgres database** (e.g. a free [Neon](https://neon.tech)
   project) and copy its connection string.

3. **Create a Strava API application** at
   https://www.strava.com/settings/api. This requires an active paid Strava
   subscription on the owning account. Note the Client ID and Client Secret.
   Set the application's "Authorization Callback Domain" to your local/dev
   domain (see step 5 for ngrok) and later to your production domain.

4. **Copy `.env.example` to `.env`** and fill in:
   - `DATABASE_URL` — your Neon connection string.
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `NEXTAUTH_URL` — `http://localhost:3000` for local dev.
   - `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` — from step 3.
   - `STRAVA_WEBHOOK_VERIFY_TOKEN` — any random string you choose; it's a
     shared secret used only to validate the webhook handshake.
   - `APP_TIMEZONE` — an IANA timezone string (e.g. `America/New_York`) used
     for all leaderboard time-window boundaries.
   - `APP_CUTOFF_DATE` (optional) — an ISO 8601 date or date-time string. When
     set, activities dated before this instant are hidden from the feed and
     leaderboard. Leave unset to show full history.

5. **Run database migrations**

   ```bash
   npx prisma migrate dev --name init
   ```

6. **Add allowlisted athlete IDs.** The allowlist has no in-app admin UI by
   design (see spec). Add rows directly, e.g. via Prisma Studio:

   ```bash
   npx prisma studio
   ```

   Create `AllowlistedAthlete` rows with each group member's numeric Strava
   athlete ID (visible in their Strava profile URL) and an optional `note`
   (e.g. their name).

7. **Expose your local server over HTTPS with ngrok** (required for Strava's
   webhook callback and often for the OAuth callback too):

   ```bash
   ngrok http 3000
   ```

   Use the resulting `https://...ngrok-free.app` URL as:
   - The Strava app's "Authorization Callback Domain" (host only, no scheme).
   - The base URL passed to the webhook subscription script below.

8. **Start the dev server**

   ```bash
   npm run dev
   ```

9. **Create the Strava webhook subscription** (one-time per environment —
   there is exactly one app-level subscription, not one per user):

   ```bash
   node --env-file=.env scripts/create-webhook-subscription.mjs https://your-ngrok-url.ngrok-free.app
   ```

   If you need to point the subscription at a new URL later (e.g. a new
   ngrok session), delete the old one first:

   ```bash
   node --env-file=.env scripts/delete-webhook-subscription.mjs <subscription-id>
   ```

10. Visit `http://localhost:3000`, click "Login with Strava," and
    authorize. The first successful login for an allowlisted athlete ID
    triggers a one-time backfill of their Strava activity history.

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Set the same environment variables from `.env` in the Vercel project
   settings, with `NEXTAUTH_URL` set to your production URL.
3. Point the Strava app's "Authorization Callback Domain" at your production
   domain.
4. Run `npx prisma migrate deploy` against the production database (e.g. via
   a Vercel build step or manually).
5. Re-run `scripts/create-webhook-subscription.mjs` against the production
   URL (Strava allows only one active subscription per API application, so
   delete the dev one first if it's still pointed at ngrok).

## Notes on scope

- No automated test suite (per spec) — QA is manual against `spec.md`'s
  Acceptance Criteria. Unit-conversion, leaderboard aggregation, and
  timezone-window logic are implemented as pure functions
  (`src/lib/units.ts`, `src/lib/leaderboard.ts`, `src/lib/timezone.ts`) so
  they're easy to exercise directly if desired.
- The Strava API Standard tier used here supports up to 10 connected
  athletes without formal review, matching this app's small-group scope.
- There is no email/SMS alerting anywhere in this app. A disconnected
  Strava connection is surfaced only as a "disconnected" badge in the UI.
