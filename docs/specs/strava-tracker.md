# strava-tracker

## Purpose
strava-tracker is a web app for a small, invite-only group of friends (2–4 people) to track and compare workouts. Members connect their Strava accounts via OAuth so their activities sync automatically, and can also log workouts manually when Strava doesn't capture them. Anyone with the link can view a public activity feed and leaderboard; only allowlisted, logged-in members can connect Strava or add/edit their own manual entries. Success looks like: the group's workouts (from Strava and manual entry) show up reliably in a shared feed and leaderboard, sync keeps working unattended via webhooks and automatic token refresh, and the one failure mode that needs human attention — a disconnected Strava connection — is visible in the UI without any active alerting system.

## Tech Stack & Constraints
- **Language**: TypeScript throughout (schema, auth config, API routes, components).
- **Framework**: Next.js (React UI + API routes in one project).
- **Database**: PostgreSQL hosted on Neon (free tier).
- **ORM**: Prisma.
- **Auth**: NextAuth.js (Auth.js) with a Strava OAuth 2.0 provider, scope `activity:read_all`. No password-based or other account system.
- **Styling**: Tailwind CSS, implementing the dark-theme design system specified below.
- **Deployment**: Vercel (provides HTTPS required for Strava's webhook callback URL).
- **Local development**: ngrok required to expose a local HTTPS endpoint for Strava webhook callbacks during development.
- **Strava API tier**: Standard tier, requires an active paid Strava subscription on the app owner's Strava Developer account. Supports up to 10 connected athletes without formal review.
- **Hard constraints**:
  - No fitness platform integrations other than Strava.
  - No mobile app; web only.
  - No automated test suite (no Vitest/Jest, no CI test gating); QA is manual against this spec's Acceptance Criteria.
  - Distance is displayed in miles everywhere in the UI, regardless of source.
  - Leaderboard/dashboard aggregation logic must not branch on `source` (`strava` vs `manual`) except for cosmetic badges — Strava and manual activities are functionally identical once stored.

## Non-Goals
1. No password-based authentication or any account system separate from Strava OAuth.
2. No mobile app — web only.
3. No support for other fitness platforms (Garmin, Fitbit, etc.) — Strava only.
4. No active alerting (email/SMS) to the app owner or users on token failure/revocation — a visual "disconnected" badge is the only indicator.
5. No automated test suite — QA is manual against this spec's Acceptance Criteria.
6. No per-user timezone customization for leaderboard time windows — a single standardized timezone is used for all users.
7. No support for group sizes beyond Strava Standard tier's 10-connected-athlete limit without formal review.
8. No editing of other users' data — a logged-in user may only add/edit their own manual workouts.
9. No public sign-up flow and no self-service allowlist request/approval UI — the allowlist is maintained directly by the app owner outside the app.
10. No elevation gain, average pace, or other leaderboard metrics beyond total time, total distance, and activity count.
11. No delete function for manual workouts — only add and edit are in scope.
12. No admin UI for managing the allowlist — it is maintained by direct data edits (see Data Model).
13. No handling of Strava API rate-limit backoff/retry beyond default behavior — treated as an accepted risk at this group size, not a feature to build.

## Core Features

1. **Strava OAuth login.**
   User clicks "Login with Strava," which starts the OAuth 2.0 flow with scope `activity:read_all`. On callback, the returned Strava athlete ID is checked against the allowlist. If the ID is not on the allowlist, the login is rejected, no `User` record or session is created, and the user is returned to the public dashboard with a visible error message (e.g., "This Strava account is not authorized for this app."). If the ID is allowlisted, a `User` record (creating one on first login, reusing it on subsequent logins) and a session are created, and the user is redirected to the dashboard in a logged-in state. The allowlist check runs on every login attempt, not only the first, so removing an athlete ID from the allowlist blocks that person's future logins even if they previously had an account.

2. **Allowlist-based access control.**
   A maintained list of approved Strava athlete IDs gates who can complete login (see Data Model for storage). Public pages (dashboard, leaderboard) remain fully viewable by anyone, logged in or not, regardless of allowlist status — the allowlist only gates the ability to obtain a session and edit access.

3. **Token storage and automatic refresh.**
   Each user's Strava access token, refresh token, and token expiry timestamp are stored server-side. Before any Strava API call is made on a user's behalf (webhook-triggered activity fetch, backfill), the app checks whether the stored access token is expired or within 5 minutes of expiring; if so, it uses the stored refresh token to obtain a new access/refresh token pair from Strava and updates the stored values, with no user interaction required. This lazy, on-demand refresh (rather than a separate scheduled job) is the required refresh mechanism.

4. **Token failure / revocation handling.**
   If a token refresh attempt fails (Strava returns an auth error such as `invalid_grant`), or Strava sends a webhook deauthorization event (`object_type: "athlete"`, `updates.authorized: "false"`) for a user, that user's `connectionStatus` is set to `DISCONNECTED` and sync stops for that user going forward (no further automatic refresh attempts, no crash, no email/SMS alert). Any dashboard card or profile element for that user displays a "disconnected" pill badge (styled per the Badges spec below) so the group notices visually. A successful subsequent login/re-authorization by that user resets `connectionStatus` to `CONNECTED` and sync resumes.

5. **Strava webhook subscription.**
   A single app-level webhook subscription (not per-user) is created with Strava and receives POST events for activity create/update/delete and athlete deauthorization. On receipt:
   - The raw payload is persisted to the `WebhookEvent` table (see Feature 12).
   - For activity create/update events: the app uses `owner_id` to look up the corresponding `User`, refreshes their token if needed, fetches full activity details via the Strava API, and upserts the corresponding `Activity` row (matched by `stravaActivityId`) with `source = strava`.
   - For activity delete events: the app deletes the matching `Activity` row (matched by `stravaActivityId` and `userId`), if one exists.
   - For athlete deauthorization events: the app applies Feature 4's disconnected handling for that user.
   - The webhook endpoint also implements Strava's subscription validation handshake (GET request with `hub.challenge` echo) required to create/maintain the subscription.

6. **Historical backfill on first connect.**
   The first time a given Strava athlete ID successfully completes OAuth login, the app performs a one-time backfill: it fetches that user's historical activities from the Strava API (paginated as needed) and inserts them into `Activity` with `source = strava`. This backfill runs once per user, tracked via a `hasCompletedBackfill` flag on `User`; it does not repeat on subsequent logins by the same user.

7. **Manual workout entry.**
   A logged-in user can open an "Add" form (bottom-sheet modal, see Visual Design) to create a manual workout with fields: type (select from a fixed list: Run, Ride, Walk, Hike, Swim, Weight Training, Yoga, Other), distance in miles, moving time, elapsed time, start date, and title. On submit, a new `Activity` row is created with `source = manual`, owned by the current user. The same form, pre-filled, is used to edit an existing manual entry; a logged-in user can only edit manual entries they own — attempting to edit another user's entry, or a Strava-sourced entry, is rejected. Strava-sourced (`source = strava`) activities are never editable through this form.

8. **Public dashboard (activity feed).**
   A reverse-chronological feed of all `Activity` rows (both `source = strava` and `source = manual`) is viewable by anyone without login. The feed supports filtering by person via a multi-select control (any combination of users can be selected simultaneously; selecting none shows all). Each card shows the owning user's avatar, name, workout type/title, distance (miles), time, date, and a `source` badge; a user with `connectionStatus = DISCONNECTED` is marked with a "disconnected" badge wherever their identity appears on the feed.

9. **Public leaderboard.**
   Viewable by anyone without login. Ranks all users by a selected metric — total time, total distance, or activity count — computed from all `Activity` rows regardless of `source`. The metric is switchable (sortable) via a control. Results are additionally filterable by time window: 1 day, 1 week, 1 month, or all-time, restricted to activities with a `startDate` falling in that window. Manual and Strava-sourced workouts count equally toward every leaderboard total.

10. **Timezone standardization.**
    The 1 day / 1 week / 1 month leaderboard window boundaries are computed using one single, standardized timezone (the app owner's), configured as a single application-wide setting (e.g., an `APP_TIMEZONE` environment variable holding an IANA timezone string) — never the viewer's or activity-owner's local timezone. All users see identical leaderboard window boundaries regardless of where they are.

11. **Visual design system.**
    The app implements the dark, card-based visual system specified under Interface / API → Visual Design below (colors, typography, layout, badges, bottom action bar, bottom-sheet modals, avatars), adapted to strava-tracker's actual content (activities, leaderboard entries) rather than the reference app's content.

12. **Webhook event logging.**
    Every raw incoming webhook payload (both the validation handshake and event POSTs) is stored in a `WebhookEvent` table for debugging purposes, independent of whether processing that event succeeds. This table is written to but has no dedicated UI in this build.

## Data Model

**User**
- `id` — primary key
- `stravaAthleteId` — Strava athlete ID, unique, not null
- `firstName`, `lastName` — display name
- `profilePhotoUrl` — nullable; Strava profile photo URL if available
- `accessToken`, `refreshToken` — current Strava OAuth tokens (stored securely server-side, not exposed to the client)
- `tokenExpiresAt` — datetime the current access token expires
- `connectionStatus` — enum `CONNECTED` | `DISCONNECTED`, default `CONNECTED`
- `hasCompletedBackfill` — boolean, default `false`
- `createdAt`, `updatedAt`

**AllowlistedAthlete**
- `id` — primary key
- `stravaAthleteId` — unique, not null
- `note` — optional free-text label (e.g., the person's name) to make the list human-readable when edited directly
- `createdAt`
- Maintained by the app owner via direct database edits (e.g., a SQL client or Prisma Studio); no in-app admin UI exists to manage this table. Storing the allowlist as a DB table (rather than an env var) is the required approach, chosen because it can be updated without a redeploy.

**Activity**
- `id` — primary key
- `userId` — foreign key to `User`
- `source` — enum `strava` | `manual`, not null
- `stravaActivityId` — nullable; Strava's activity ID, unique when present; null for manual entries
- `type` — string. For `source = strava`, this stores Strava's own activity type/sport-type string as returned by the API. For `source = manual`, this is restricted to one of: `Run`, `Ride`, `Walk`, `Hike`, `Swim`, `Weight Training`, `Yoga`, `Other`.
- `title` — string
- `distanceMiles` — float; canonical unit is miles for all rows regardless of source (Strava's meters are converted to miles at ingestion time, not at display time)
- `movingTimeSeconds` — integer, canonical unit seconds regardless of source (manual entry form accepts a human-friendly time format and converts to seconds on submit)
- `elapsedTimeSeconds` — integer, canonical unit seconds
- `startDate` — datetime
- `createdAt`, `updatedAt`

**WebhookEvent**
- `id` — primary key
- `objectType`, `objectId`, `aspectType`, `ownerId`, `subscriptionId` — fields extracted from the Strava webhook payload
- `eventTime` — timestamp from the payload
- `rawPayload` — the full raw JSON payload as received
- `receivedAt` — server timestamp when the event was received
- Write-only log table for debugging; no in-app UI reads from it in this build.

**Auth session/account data**: NextAuth-managed tables (e.g., its standard Account/Session/VerificationToken models under the Prisma adapter) may be used for session management, but Strava OAuth tokens used for API calls (`accessToken`, `refreshToken`, `tokenExpiresAt`) must live on `User` as described above so they are the single source of truth token-refresh logic reads from and writes to.

## Interface / API

**Public pages (no login required)**
- `/` — Activity feed (Feature 8): reverse-chronological list of all activities, multi-select person filter, source and disconnected badges.
- `/leaderboard` — Leaderboard (Feature 9): metric selector (total time / total distance / activity count), time-window selector (1 day / 1 week / 1 month / all-time), ranked list of users.
- A "Login with Strava" control is present in the sticky header for logged-out visitors on both public pages.

**Authenticated behavior**
- Successful login redirects to `/` in a logged-in state.
- A fixed bottom action bar is shown only to logged-in users, displaying the current user's identity (avatar + name) and an "Add" action that opens the manual-entry bottom-sheet modal (Feature 7).
- On feed cards the current logged-in user owns, an "Edit" affordance opens the same bottom-sheet modal pre-filled, for `source = manual` cards only.

**API routes**
- `GET/POST /api/auth/[...nextauth]` — NextAuth handlers; the Strava provider's `signIn` callback performs the allowlist check from Feature 1/2, returning false (rejecting sign-in, creating no User/session) for non-allowlisted athlete IDs.
- `GET /api/webhook` — Strava subscription validation handshake: echoes back `hub.challenge` from the query string per Strava's webhook subscription protocol.
- `POST /api/webhook` — Receives activity/athlete event payloads; logs to `WebhookEvent`, then performs the processing described in Feature 5.
- `POST /api/activities` — Creates a manual `Activity` (`source = manual`) owned by the authenticated session user. Rejects unauthenticated requests.
- `PATCH /api/activities/:id` — Edits an existing manual `Activity`. Rejects the request (403) if the target activity's `userId` does not match the session user, or if the target activity's `source` is `strava`.

**Manual entry form fields** (used for both create and edit, in the bottom-sheet modal)
- Type — select, one of the 8 fixed values listed under Data Model.
- Distance — numeric input, miles.
- Moving time — human-friendly duration input (e.g., `HH:MM:SS` or `MM:SS`), converted to seconds on submit.
- Elapsed time — same format as moving time.
- Start date — date picker.
- Title — free text.

**Visual Design** (applies across all pages/components)
- **Color tokens**: background `#0A0C0F`; panel `#12161B` / `#171C23`; borders `#232A33` / `#2E3742`; primary text `#F2F4F7`; secondary text `#A3AEBB`; tertiary text `#6B7683`; accent "positive" green `#3DDC84`; accent "alert" red `#FF5C48`.
- **Typography**: bold/heavy display font, tight letter-spacing, uppercase, for headings (e.g. Archivo or equivalent). Body/sans font for general text (e.g. Space Grotesk or equivalent). Monospace, uppercase, letter-spaced, small-size font for labels/metadata/timestamps/badges (e.g. IBM Plex Mono or equivalent).
- **Layout**: single-column centered content, max-width ~900px. Activity feed renders as a card grid; cards have ~14px rounded corners, subtle borders, a hover lift effect, a colored top stripe/accent, and show avatar, name, and metadata.
- **Sticky header**: persistent top bar hosting filter/nav controls on the dashboard and leaderboard, and the "Login with Strava" control when logged out.
- **Badges**: small, uppercase, pill-shaped, colored monospace badges for: `source: strava` vs `source: manual` tags, and the "disconnected" indicator (using the alert red accent).
- **Bottom action bar**: fixed bottom bar, visible only to logged-in users, showing current user identity plus an "Add" action.
- **Modals**: manual workout add/edit forms use bottom-sheet modals — slide up from the bottom, rounded top corners, backdrop blur — not centered dialogs.
- **Avatars**: rounded-square (not circular), showing the Strava profile photo when available, otherwise initials on a colored background.

## Acceptance Criteria

- [ ] "Login with Strava" initiates OAuth 2.0 with scope `activity:read_all`.
- [ ] A successful OAuth callback for an athlete ID on the allowlist creates/reuses a `User` record and an active session, and redirects to the logged-in dashboard.
- [ ] A successful OAuth callback for an athlete ID NOT on the allowlist creates no `User` record and no session, and the visitor is returned to the public dashboard with a visible error message.
- [ ] Removing a previously-approved athlete ID from the allowlist causes that athlete's next login attempt to be rejected the same way, even though they previously had an account.
- [ ] The activity feed (`/`) and leaderboard (`/leaderboard`) are both fully viewable, with all data and filters functional, without logging in.
- [ ] Each `User`'s `accessToken`, `refreshToken`, and `tokenExpiresAt` are stored server-side and never exposed in any client-facing API response or page source.
- [ ] When a stored access token is expired or within 5 minutes of expiring, the app transparently refreshes it via the stored refresh token before making the dependent Strava API call, with no user-facing interaction.
- [ ] When a token refresh attempt fails (auth error from Strava), the affected user's `connectionStatus` becomes `DISCONNECTED`, no crash occurs, and no email/SMS alert is sent.
- [ ] When Strava sends an athlete deauthorization webhook event for a user, that user's `connectionStatus` becomes `DISCONNECTED`, no crash occurs, and no email/SMS alert is sent.
- [ ] Any dashboard element showing a `DISCONNECTED` user's identity displays a "disconnected" pill badge.
- [ ] A `DISCONNECTED` user who successfully re-authorizes via "Login with Strava" has `connectionStatus` reset to `CONNECTED` and sync resumes for them.
- [ ] A single app-level Strava webhook subscription (not per-user) is created and correctly responds to Strava's `hub.challenge` validation handshake on `GET /api/webhook`.
- [ ] A webhook activity-create/update event results in the correct user's activity being fetched from Strava and upserted into `Activity` with `source = strava`, matched by `stravaActivityId`.
- [ ] A webhook activity-delete event results in the matching `Activity` row being removed.
- [ ] Every incoming webhook request (validation and event POSTs) is persisted to `WebhookEvent`, including its raw payload.
- [ ] The first successful login for a given athlete ID triggers a one-time historical backfill of that user's Strava activities into `Activity` with `source = strava`.
- [ ] A second/subsequent login by the same athlete ID does not repeat the backfill.
- [ ] A logged-in user can create a manual workout via the Add form with type, distance (miles), moving time, elapsed time, start date, and title; the resulting `Activity` row has `source = manual` and is owned by that user.
- [ ] A logged-in user can edit a manual workout they own, and the changes are reflected in the feed/leaderboard.
- [ ] A logged-in user cannot edit another user's manual workout (request is rejected).
- [ ] A logged-in user cannot edit any `source = strava` activity through the manual-entry form (no edit affordance is shown, and the API rejects such a request).
- [ ] The activity feed shows both `source = strava` and `source = manual` activities together in a single reverse-chronological list.
- [ ] The activity feed's person filter is multi-select: any combination of users can be selected at once, and selecting none shows all users' activities.
- [ ] Each feed card displays a `source` badge indicating `strava` or `manual`.
- [ ] The leaderboard ranks users by total time, total distance, and activity count, each selectable, with results changing correctly when the metric is switched.
- [ ] The leaderboard's time-window filter (1 day / 1 week / 1 month / all-time) correctly restricts included activities by `startDate`, and toggling it changes the ranking/totals shown.
- [ ] Leaderboard totals for a given user include both `source = strava` and `source = manual` activities with no distinction in how they're weighted.
- [ ] Leaderboard 1-day/1-week/1-month window boundaries are computed from a single configured application-wide timezone, not the viewer's browser timezone or any activity-owner's timezone.
- [ ] Distance is displayed in miles on every page/component that shows distance, for both Strava-sourced and manual activities.
- [ ] The UI implements the specified dark color palette, typography roles (display/body/mono), card layout with rounded corners and hover lift, sticky header, pill badges, bottom action bar (logged-in only), bottom-sheet modals for the manual entry form, and rounded-square avatars with initials fallback.
- [ ] The bottom action bar is visible only when logged in and is absent for logged-out visitors.
- [ ] No email/SMS alerting mechanism exists anywhere in the app for token failure or revocation.
- [ ] No UI exists for self-service allowlist requests or approvals, and no password/non-Strava login path exists anywhere in the app.

## Open Questions Resolved
- The allowlist of approved Strava athlete IDs is stored as a DB table (`AllowlistedAthlete`), not an env var, so it can be updated without a redeploy. It is maintained by the app owner via direct data edits; no admin UI is built for it.
- The allowlist check runs on every login attempt (not just first-time), using NextAuth's `signIn` callback to reject non-allowlisted athlete IDs before any `User` or session record is created.
- Token refresh is lazy/on-demand: checked and performed immediately before any Strava API call is made on a user's behalf (webhook processing, backfill), not via a separate scheduled/cron job.
- "Disconnected" status is set by exactly two triggers: a failed token-refresh attempt (auth error from Strava), or a webhook athlete-deauthorization event. It is stored as a `connectionStatus` field (`CONNECTED` | `DISCONNECTED`) on `User`, checked at sync time — not via a background polling job.
- Distance is displayed in miles throughout the UI. Canonical storage is also miles (`distanceMiles`) for both Strava- and manual-sourced rows — unit conversion from Strava's meters happens at ingestion time, not at display time.
- Manual and Strava-sourced workouts are stored in the same `Activity` table with a `source` field (`strava` | `manual`), and count equally in all leaderboard calculations. Aggregation/dashboard logic must not branch on `source` except for the cosmetic `source` badge.
- Leaderboard time-window filters (1 day / 1 week / 1 month / all-time) are computed in one single, standardized timezone (the app owner's), configured as a single application-wide setting — never per-user or per-browser timezone.
- A `WebhookEvent` table logs every raw incoming webhook payload (validation and event POSTs alike), for debugging. It has no dedicated UI in this build.
- No automated test suite is required or expected. QA for this project is manual, performed against this spec's Acceptance Criteria.
- Manual workout entry supports create and edit only — no delete function is in scope for this build.
- The manual-entry "type" field is restricted to a fixed list (Run, Ride, Walk, Hike, Swim, Weight Training, Yoga, Other); Strava-sourced activities retain whatever type/sport-type string Strava's API returns, unrestricted by this list.
- Elevation gain, average pace, and any leaderboard metric beyond total time/total distance/activity count are out of scope and must not be added.
