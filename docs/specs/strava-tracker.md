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

## Feature: Delete Manual Workouts (added 2026-08-26)

## Purpose
Logged-in users of strava-tracker currently have no way to remove a manual workout entry once created — a typo, duplicate, or accidental add is permanent. This feature adds a "Delete" action to the existing manual-entry edit modal so a user can permanently remove a manual workout they own, without leaving the modal or introducing any new screen. Success looks like: a user can delete a bad manual entry in two clicks from the edit modal, the deletion is immediate and permanent, and no other user's data or Strava-sourced data can ever be deleted through this path.

## Fits Into Existing System
This feature extends two existing pieces of the strava-tracker codebase and touches no others:
- `src/app/api/activities/[id]/route.ts`, which today exports only `PATCH` (edit a manual activity). This feature adds a `DELETE` export to the same file, reusing the exact session-check and ownership/source-check pattern `PATCH` already uses.
- `src/components/ManualEntryModal.tsx`, the single bottom-sheet modal component that already handles both add and edit of manual entries via its `editingActivity: PublicActivity | null` prop. This feature adds a Delete affordance to that modal's existing footer, active only in edit mode.

It follows existing conventions throughout: NextAuth session checks via `getServerSession(authOptions)`, Prisma access via the existing `src/lib/prisma.ts` client, the existing ownership/source rule (`source !== "manual" || userId !== session.user.id` → 403), the existing JSON-response convention (not `204 No Content`), and the existing dark-theme bottom-sheet modal / pill-button design system (`rounded-full`, `font-mono text-xs uppercase tracking-widest`, `text-accent-alert` as the destructive color token). No other component, route, or schema is modified.

## Tech Stack & Constraints
- TypeScript, Next.js App Router API routes — same as the existing `POST`/`PATCH` handlers.
- Auth via `getServerSession(authOptions)` from `next-auth`, matching the exact pattern already used in `POST`/`PATCH`.
- Database access via `prisma.activity.delete({ where: { id } })` using the existing Prisma client — no schema or migration change.
- UI implemented with plain React state in `ManualEntryModal.tsx` — no new npm dependency (no toast/dialog/confirm library), no native `window.confirm()`.
- Hard constraints:
  - Must not change the existing `POST /api/activities` or `PATCH /api/activities/:id` contract or behavior.
  - Must not add any Prisma schema or migration change (no `deletedAt`, no soft delete).
  - Must not add a new prop or callback to `ManualEntryModal` — post-delete notification reuses the existing `onSaved` callback.
  - Must not add a delete affordance anywhere outside `ManualEntryModal`'s edit mode (specifically, not on `ActivityCard`).
  - Must not allow deletion of `source = strava` activities, or of another user's manual activities.
  - Must remain backward-compatible with the existing manual-entry add/edit flow.

## Non-Goals
1. No soft delete, `deletedAt` column, or any Prisma schema/migration change.
2. No undo, trash, or recovery mechanism after a delete is confirmed.
3. No delete-history or audit log of deleted activities.
4. No bulk delete — one activity per delete operation only.
5. No ability for a user to delete another user's entries, and no admin override.
6. No delete affordance on `ActivityCard` or anywhere in the feed outside of `ManualEntryModal` in edit mode.
7. No changes to `POST /api/activities` (create) or the existing `PATCH` (edit) behavior/contract.
8. No delete support for `source = strava` activities — no UI affordance, and the API rejects any such request with 403.
9. No new npm dependencies (no toast/dialog/confirm library).
10. No new `onDeleted` callback or other new prop on `ManualEntryModal` — the existing `onSaved` callback is reused.
11. No automated tests added — project has no test suite; QA is manual against this spec's Acceptance Criteria.

## Core Behavior
1. **Delete button visibility.** When `ManualEntryModal` is open in edit mode (`editingActivity` is non-null), its footer shows a "Delete" button styled with `text-accent-alert`, alongside the existing Cancel and Save buttons. When the modal is open in add mode (`editingActivity` is null), no Delete button is rendered.
2. **Arming the confirmation.** Clicking "Delete" swaps that button in place, with no layout shift, for a "Confirm Delete" button — same `text-accent-alert` destructive tone, styled more emphatically (e.g., filled instead of outline) to signal the armed/irreversible state. No network request is made by this click.
3. **Backing out of the armed state.** While armed ("Confirm Delete" showing), any of the following resets the button back to the normal unarmed "Delete" label, with no delete request made:
   - Clicking the modal's existing "Cancel" button (which also closes the modal, per existing behavior).
   - Clicking outside the modal panel, on the existing backdrop (which also closes the modal via the existing `onClick={onClose}`, per existing behavior).
   - Pressing Escape (which also closes the modal, matching backdrop-click behavior).
4. **Confirming the delete.** Clicking "Confirm Delete" (the second click) sends a `DELETE /api/activities/${editingActivity.id}` request.
5. **Successful delete.** On a successful response (`res.ok`), the modal calls the existing `onSaved()` callback followed by `onClose()` — the same two calls `handleSubmit` already makes after a successful save. This triggers the feed's existing refresh mechanism and closes the modal. No new callback is introduced.
6. **Failed delete.** On a failed response (network error, or any non-2xx status including 403/404) the modal does not close, does not lose the in-progress form data, and shows the error using the existing `error` state / `text-accent-alert` `<p>` pattern already used for failed saves. The button resets to the unarmed "Delete" state — it must never remain stuck on "Confirm Delete" after a failure.
7. **API authorization — no session.** `DELETE /api/activities/:id` returns 401 if there is no authenticated session (`getServerSession(authOptions)` returns null).
8. **API authorization — not found.** `DELETE /api/activities/:id` returns 404 if no `Activity` row matches `id`.
9. **API authorization — ownership/source.** `DELETE /api/activities/:id` returns 403 if the matched activity's `source !== "manual"` or its `userId !== session.user.id` — the identical rule already enforced by `PATCH`. This covers both `source = strava` activities and manual activities owned by a different user.
10. **API success.** When all checks pass, the handler performs `prisma.activity.delete({ where: { id } })` and returns `200` with JSON body `{ success: true }`.
11. **Concurrent/already-deleted row.** If `prisma.activity.delete` fails because the row no longer exists (e.g., it was already deleted in another tab, or deleted between the `findUnique` ownership check and the delete call), the handler treats this as a 404, not an unhandled 500.

## Data Model
N/A — no schema, column, or migration changes. Deletion is a hard `prisma.activity.delete` against the existing `Activity` table; no `deletedAt` or other soft-delete field is added.

## Interface / API

**New API route**
- `DELETE /api/activities/:id` (added to `src/app/api/activities/[id]/route.ts`, alongside the existing `PATCH` export)
  - Auth: `getServerSession(authOptions)`; no session → `401`.
  - Lookup: `prisma.activity.findUnique({ where: { id } })`; no match → `404`.
  - Authorization: if `existing.source !== "manual" || existing.userId !== session.user.id` → `403`.
  - On pass: `prisma.activity.delete({ where: { id } })`, catching a "record not found" failure from this call and returning `404` instead of a raw 500.
  - Success response: `200` with JSON body `{ success: true }`.

**`ManualEntryModal.tsx` changes**
- New local boolean state (e.g. `confirmingDelete`) tracking whether the delete confirmation is armed. Reset to `false` on Cancel click, backdrop click, Escape keypress, and after a failed delete request.
- Footer button, edit mode only: unarmed → button labeled "Delete" (`text-accent-alert`, outline/existing pill style); armed → same button slot now labeled "Confirm Delete" (`text-accent-alert`, filled/more emphatic pill style). No change to the Cancel or Save/Add buttons.
- New handler (e.g. `handleDelete`) invoked by the "Confirm Delete" click: sends `fetch("DELETE", /api/activities/${editingActivity.id})` (or equivalent `fetch(url, { method: "DELETE" })` call), mirroring the existing `fetch` pattern in `handleSubmit`.
  - On `res.ok`: call `onSaved()` then `onClose()`.
  - On failure: set the existing `error` state (rendered via the existing `<p className="mt-4 font-body text-sm text-accent-alert">` pattern) and reset `confirmingDelete` to `false`; modal stays open, form data is preserved.
- No new props are added to `ManualEntryModal` (`open`, `editingActivity`, `onClose`, `onSaved` remain unchanged).

**No changes** to `src/app/api/activities/route.ts` (`POST`), `DashboardClient.tsx`, `ActivityCard.tsx`, `src/lib/serialize.ts`, or `prisma/schema.prisma`.

## Acceptance Criteria
- [ ] Opening `ManualEntryModal` in edit mode (via "Edit" on an owned manual activity) shows a "Delete" button in the footer alongside Cancel and Save.
- [ ] Opening `ManualEntryModal` in add mode shows no Delete button.
- [ ] Clicking "Delete" once swaps the button in place for "Confirm Delete" with no layout shift, and sends no network request.
- [ ] With "Confirm Delete" armed, clicking the modal's Cancel button resets the button to "Delete" and closes the modal, without sending a delete request.
- [ ] With "Confirm Delete" armed, clicking the backdrop outside the modal panel resets the button to "Delete" and closes the modal, without sending a delete request.
- [ ] With "Confirm Delete" armed, pressing Escape resets the button to "Delete" and closes the modal, without sending a delete request.
- [ ] Clicking "Confirm Delete" sends a `DELETE /api/activities/:id` request for the activity being edited.
- [ ] On a successful delete response, the modal closes and the feed reflects the activity's removal (via the existing `onSaved`-triggered refresh).
- [ ] On a failed delete response (network error or non-2xx), the modal remains open, the in-progress form data is unchanged, and an error message is shown via the existing `text-accent-alert` error pattern.
- [ ] After a failed delete response, the Delete button is reset to its unarmed "Delete" label, not left on "Confirm Delete".
- [ ] `DELETE /api/activities/:id` returns 401 when called without an authenticated session.
- [ ] `DELETE /api/activities/:id` returns 404 when `id` does not match any existing `Activity` row.
- [ ] `DELETE /api/activities/:id` returns 403 when called against a `source = strava` activity.
- [ ] `DELETE /api/activities/:id` returns 403 when called against a manual activity owned by a different user than the session user.
- [ ] `DELETE /api/activities/:id` returns 200 with JSON body `{ success: true }` when called against a manual activity owned by the session user, and the row is removed from the database (hard delete, not soft delete).
- [ ] After a successful delete, the deleted activity no longer appears in the activity feed or leaderboard totals.
- [ ] No delete affordance appears anywhere on `ActivityCard` or elsewhere in the feed outside of `ManualEntryModal`'s edit-mode footer.

## Regression Safety
- [ ] `POST /api/activities` (create manual activity) continues to work exactly as before, unaffected by the new `DELETE` export in the sibling route file.
- [ ] `PATCH /api/activities/:id` (edit manual activity) continues to work exactly as before — same success/401/403/404 behavior, same response shape.
- [ ] Adding a new manual workout via `ManualEntryModal` in add mode is unaffected — no Delete button appears, and Save/Cancel behave as before.
- [ ] Editing an existing manual workout via `ManualEntryModal` and clicking "Save Changes" still saves correctly and closes the modal, unaffected by the new Delete/Confirm Delete state.
- [ ] Clicking Cancel in edit mode when the delete confirmation is NOT armed still closes the modal with no changes, exactly as before.
- [ ] Clicking the backdrop or pressing Escape when the delete confirmation is NOT armed still closes the modal exactly as before, with no unexpected side effects.
- [ ] `DashboardClient.tsx`'s `canEdit` gating and `openEdit`/`openAdd` flow are unchanged — Edit is still only offered for manual activities owned by the current user.
- [ ] `ActivityCard.tsx` rendering and its "Edit" button behavior are unchanged.
- [ ] `source = strava` activities remain fully non-editable and non-deletable through the UI, exactly as before.

## Open Questions Resolved
- The Delete button is placed inside `ManualEntryModal`'s existing footer, alongside Cancel and Save — not in a separate header/footer area, and not as a new dialog/screen.
- The confirmation pattern is an in-place button swap (Delete → Confirm Delete) using local component state — no `window.confirm()`, no new dialog library, no new dependency.
- Both the unarmed "Delete" and armed "Confirm Delete" buttons use `text-accent-alert`, the project's existing destructive-tone color token; the armed state is visually more emphatic (e.g., filled vs. outline) but introduces no new color.
- Backing out of the armed "Confirm Delete" state is possible via Cancel, backdrop click, or Escape — all three reset to the unarmed "Delete" label; Cancel and backdrop/Escape additionally close the modal, matching their existing behavior.
- A failed delete request leaves the modal open, preserves form data, shows the error inline via the existing `error` state, and resets the button to the unarmed "Delete" state rather than leaving it stuck armed.
- `DELETE /api/activities/:id` returns `200` with JSON body `{ success: true }` on success, matching the existing `POST`/`PATCH` JSON-response convention rather than `204 No Content`.
- On successful delete, `ManualEntryModal` calls the existing `onSaved()` callback followed by `onClose()` — the same two calls used after a successful save. No new `onDeleted` callback is introduced, and no new prop is added to `ManualEntryModal`.
- The new `DELETE` handler reuses the exact ownership/source rejection logic already used by `PATCH` in `src/app/api/activities/[id]/route.ts`, so the two operations cannot drift apart in behavior.
- `source = strava` activities receive no delete affordance in the UI and are rejected with 403 if a delete is attempted against them directly via the API.
- No Prisma schema or migration changes are made; deletion is a plain, permanent `prisma.activity.delete` hard delete with no soft-delete field, no undo, and no audit trail.
- A `prisma.activity.delete` call that fails because the target row was already removed (e.g., a race with another tab/request) is treated by the handler as a 404, not surfaced as a raw 500.

## Feature: Average Pace on Feed Cards (added 2026-08-26)

## Purpose
strava-tracker's public activity feed currently shows distance and moving time on each activity card, but users must do mental math to know how fast a run was. This feature adds a display-only average pace (`M:SS /mi`) to Run-type feed cards, computed at render time from data already stored on the activity. It is for the app's small existing user group (2–4 friends) who want an at-a-glance pace figure. Success is a correctly formatted, correctly gated pace string appearing on eligible Run cards with no changes to stored data, leaderboard behavior, or non-run cards.

## Fits Into Existing System
This feature touches exactly two existing files:
- `src/lib/units.ts` — the project's designated home for pure unit-conversion/formatting helpers (already contains `formatMiles`, `formatSecondsToDuration`, `formatSecondsToHours`, `parseDurationToSeconds`). This feature adds a pace-computation helper, a pace-formatting helper, and a `STRAVA_RUN_TYPES` allow-list constant here, following the file's existing pure-function, no-side-effect convention.
- `src/components/ActivityCard.tsx` — the sole rendering integration point. It already imports `formatMiles` and `formatSecondsToDuration` from `@/lib/units` and renders `activity.distanceMiles` and `activity.movingTimeSeconds` as `<span>` elements inside the metadata row at lines 47–51 (`<div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-text-secondary">`). This feature adds one more conditionally-rendered `<span>` to that same row, following the same import and inline-computation style already used for distance/time.

Read-only dependencies (not modified):
- `src/lib/serialize.ts` / `PublicActivity` — supplies the exact inputs this feature needs: `type: string`, `source: "strava" | "manual"`, `distanceMiles: number`, `movingTimeSeconds: number`.
- `src/lib/constants.ts` (`MANUAL_ACTIVITY_TYPES`, `isManualActivityType`) — confirms that for `source = "manual"`, `type` is always exactly one of a fixed set including the literal `"Run"`.
- `src/lib/strava/backfill.ts` and `src/lib/strava/webhook.ts` — confirm that for `source = "strava"`, `type` is Strava's raw, unnormalized `sport_type ?? type` string (e.g. `"Run"`, `"TrailRun"`, `"VirtualRun"`, `"Ride"`, etc.), stored as-is with no mapping layer anywhere in the codebase.

No other files are touched. `src/lib/leaderboard.ts`, `src/app/api/**`, `prisma/schema.prisma`, and `src/components/ManualEntryModal.tsx` are explicitly out of scope and must not be modified.

## Tech Stack & Constraints
- TypeScript, Next.js (React function components) — matches existing stack, no change.
- No new npm dependency of any kind; pace math is plain arithmetic.
- No Prisma schema or migration change; pace is never persisted, only computed at render time.
- No change to `PublicActivity`'s shape or to `src/lib/serialize.ts`.
- No change to any API route contract under `src/app/api/**`.
- No change to `ManualEntryModal.tsx` or the manual-entry form.
- New pace helpers and the `STRAVA_RUN_TYPES` constant must live in `src/lib/units.ts` — no new file, no new shared taxonomy module.
- Must not throw on any input; degenerate inputs must fail silently (omit pace) rather than surface an error to the user.
- Must remain backward-compatible: existing card rendering for distance, time, date, badges, and edit button must be visually and behaviorally unchanged for all cards, and non-Run cards must render exactly as before.

## Non-Goals
1. No new leaderboard metric; no change to `src/lib/leaderboard.ts`, `LeaderboardClient.tsx`, or any leaderboard UI/aggregation logic.
2. No pace display, computation, or formatting for any non-run-family activity type, including but not limited to `"Ride"`, `"Walk"`, `"Hike"`, `"Swim"`, `"Weight Training"`, `"Yoga"`, `"Other"`, or any Strava-raw type string not on the run-family allow-list.
3. No change to `ManualEntryModal.tsx` or the manual-entry form (no pace input field is added).
4. No Prisma schema or migration change; pace is never stored in the database.
5. No change to any API route contract; `src/app/api/**` is untouched.
6. No new npm dependency.
7. No personal dashboard, per-user detailed statistics page, or any new route/page.
8. No configurable or user-selectable pace unit — miles-based `M:SS /mi` only, no km option.
9. No change to card layout/styling conventions beyond one additional inline `<span>` in the existing metadata row.
10. No normalization, mapping, or taxonomy system for Strava sport types beyond the small local allow-list used for this feature's eligibility check.
11. No batching, caching, memoization, or persistence of computed pace values — computed independently per card on every render.

## Core Behavior
1. **Eligible Strava Run card displays pace.** For an activity with `source === "strava"` and `type` exactly matching one of `"Run"`, `"TrailRun"`, or `"VirtualRun"` (case-sensitive, exact string match, no substring/prefix/regex matching), and with `movingTimeSeconds > 0` and `distanceMiles > 0`, the card's metadata row displays a pace string formatted as `M:SS /mi` (e.g. `7:42 /mi`), computed as `movingTimeSeconds / distanceMiles` converted to minutes:seconds.
2. **Eligible manual Run card displays pace.** For an activity with `source === "manual"` and `type === "Run"` (exact, case-sensitive), and with `movingTimeSeconds > 0` and `distanceMiles > 0`, the card displays pace using the same computation and format as above.
3. **Non-run activity types never display pace.** For any activity (either `source`) whose `type` does not qualify under the eligibility rule above — e.g. `"Ride"`, `"Walk"`, `"Hike"`, `"Swim"`, `"Weight Training"`, `"Yoga"`, `"Other"`, or any other Strava-raw string not on the allow-list — the card renders exactly as before, with no pace `<span>` present in the DOM.
4. **Zero or negative time/distance omits pace without error.** For an otherwise-eligible Run activity where `movingTimeSeconds <= 0` or `distanceMiles <= 0`, the card omits the pace display entirely (no pace `<span>` rendered) and does not throw an error or render `0:00 /mi`, `NaN /mi`, or `Infinity /mi`.
5. **Non-finite computed pace omits pace without error.** If the computed pace value is not a finite number for any other reason, the card omits the pace display entirely, with no error thrown or surfaced.
6. **Large pace values print raw minute count.** If computed pace minutes exceed 59 (e.g. an unusually slow activity), the format still prints the raw minute count with no hour component and no wraparound (e.g. `62:00 /mi`), consistent with the fixed `M:SS /mi` format (no `H:MM:SS` fallback).
7. **Pace is computed per-card at render time.** No pace value is stored, cached, or batched; each card independently computes its own pace from its own `distanceMiles` and `movingTimeSeconds` on every render.

## Data Model
N/A — no schema, type, or file format changes. `PublicActivity` in `src/lib/serialize.ts` is unchanged; the feature reads its existing `type`, `source`, `distanceMiles`, and `movingTimeSeconds` fields.

## Interface / API
Two new exported functions and one new exported constant are added to `src/lib/units.ts`, colocated with the existing formatters:

```ts
// Allow-list of Strava's raw sport_type/type strings that qualify as "Run" family.
// Exact, case-sensitive membership match only — no substring/prefix/regex matching.
export const STRAVA_RUN_TYPES = ["Run", "TrailRun", "VirtualRun"] as const;

// Pure computation. Returns null when pace should not be shown rather than throwing:
// - movingTimeSeconds <= 0
// - distanceMiles <= 0
// - the computed result is not a finite number
export function computeAveragePaceSecondsPerMile(
  distanceMiles: number,
  movingTimeSeconds: number
): number | null;

// Formats a pace-in-seconds-per-mile value as "M:SS /mi" (e.g. "7:42 /mi").
// No hours component, ever. Minutes may exceed 59 and print as the raw
// integer minute count (e.g. "62:00 /mi"). Caller is responsible for only
// calling this with a valid (non-null, finite, non-negative) pace value —
// this function does not itself guard against invalid input.
export function formatPace(paceSecondsPerMile: number): string;
```

Eligibility check (either inlined in `ActivityCard.tsx` or as an optional exported helper `isPaceEligible` next to the pace helpers in `units.ts` — developer's discretion, no new shared taxonomy module either way):
- `source === "manual"`: eligible when `type === "Run"` (exact, case-sensitive).
- `source === "strava"`: eligible when `STRAVA_RUN_TYPES.includes(type)` (exact, case-sensitive membership).

`ActivityCard.tsx` changes:
- Import `computeAveragePaceSecondsPerMile`, `formatPace`, and `STRAVA_RUN_TYPES` (and `isPaceEligible` if the developer chooses to add it) from `@/lib/units`, added to the existing import at line 3 alongside `formatMiles` and `formatSecondsToDuration`.
- Inside the component body, determine eligibility per the rule above, then call `computeAveragePaceSecondsPerMile(activity.distanceMiles, activity.movingTimeSeconds)`.
- When eligible and the computed value is non-null, render one additional `<span>{formatPace(pace)}</span>` inside the existing metadata row (`<div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-text-secondary">` at lines 47–51), alongside the existing distance/time/date `<span>` elements. When not eligible or the computed value is null, no additional `<span>` is rendered — the row is unchanged from its current three children.
- No new props, no new component, no change to `ActivityCard`'s existing prop signature (`activity`, `canEdit`, `onEdit`).

No CLI flags, endpoints, or new UI flows are introduced.

## Acceptance Criteria
- [ ] A `source = "strava"` activity with `type = "Run"`, `distanceMiles > 0`, and `movingTimeSeconds > 0` displays a pace string formatted as `M:SS /mi` in the card's metadata row.
- [ ] A `source = "strava"` activity with `type = "TrailRun"`, `distanceMiles > 0`, and `movingTimeSeconds > 0` displays a correctly formatted pace string.
- [ ] A `source = "strava"` activity with `type = "VirtualRun"`, `distanceMiles > 0`, and `movingTimeSeconds > 0` displays a correctly formatted pace string.
- [ ] A `source = "manual"` activity with `type = "Run"`, `distanceMiles > 0`, and `movingTimeSeconds > 0` displays a correctly formatted pace string.
- [ ] The displayed pace value equals `movingTimeSeconds / distanceMiles` converted to `M:SS` (minutes floored or computed consistently, seconds zero-padded to two digits), e.g. 400 seconds over 1.0 miles displays as `6:40 /mi`.
- [ ] A `source = "strava"` activity with `type = "Ride"`, `"Walk"`, `"Hike"`, `"Swim"`, `"Weight Training"`, `"Yoga"`, or `"Other"` never displays a pace span, regardless of `distanceMiles`/`movingTimeSeconds` values.
- [ ] A `source = "strava"` activity with a lowercase or differently-cased variant of a run type (e.g. `"run"` or `"trailrun"`) does NOT display pace (match is case-sensitive and exact).
- [ ] A `source = "manual"` activity with any `type` other than the exact literal `"Run"` (e.g. `"Ride"`, `"Walk"`, `"Hike"`, `"Swim"`, `"Weight Training"`, `"Yoga"`, `"Other"`) never displays a pace span.
- [ ] An otherwise-eligible Run activity with `movingTimeSeconds = 0` omits the pace span entirely (no `0:00 /mi` rendered).
- [ ] An otherwise-eligible Run activity with `movingTimeSeconds` negative omits the pace span entirely.
- [ ] An otherwise-eligible Run activity with `distanceMiles = 0` omits the pace span entirely (no `Infinity /mi` or `NaN /mi` rendered).
- [ ] An otherwise-eligible Run activity with `distanceMiles` negative omits the pace span entirely.
- [ ] No error is thrown, logged as an uncaught exception, or surfaced to the user for any degenerate input (zero/negative distance or time) on an eligible Run activity.
- [ ] `computeAveragePaceSecondsPerMile` returns `null` (not `NaN`, not `Infinity`, not a thrown error) for `distanceMiles <= 0`, `movingTimeSeconds <= 0`, or any input producing a non-finite result.
- [ ] `formatPace` produces output with no hours component under any input, including pace values whose minute count exceeds 59 (e.g. a pace of 3720 seconds/mile formats as `62:00 /mi`, not `1:02:00 /mi`).
- [ ] `STRAVA_RUN_TYPES`, `computeAveragePaceSecondsPerMile`, and `formatPace` are all defined and exported from `src/lib/units.ts` (not from a new file, not from `src/lib/constants.ts`).
- [ ] Rendering two different eligible Run cards with different `distanceMiles`/`movingTimeSeconds` values produces two independently correct pace values (no shared/stale/cached state between cards).
- [ ] No new npm package appears in `package.json` as a result of this feature.
- [ ] No Prisma schema file or migration is added or modified as a result of this feature.

## Regression Safety
- [ ] Existing distance display (`{formatMiles(activity.distanceMiles)} mi`) renders unchanged on every card, Run and non-Run alike.
- [ ] Existing moving-time display (`{formatSecondsToDuration(activity.movingTimeSeconds)}`) renders unchanged on every card, Run and non-Run alike.
- [ ] Existing date display in the metadata row renders unchanged on every card.
- [ ] The raw `activity.type` label above the metadata row (line 44) continues to render unnormalized and unchanged for all activities, including Run-family ones.
- [ ] The `source` badge (`strava`/`manual`) and `stripeColor` styling continue to render unchanged.
- [ ] The `DISCONNECTED` user badge and edit button behavior (`canEdit`/`onEdit`) are unaffected by this feature.
- [ ] Non-Run cards (`"Ride"`, `"Walk"`, `"Hike"`, `"Swim"`, `"Weight Training"`, `"Yoga"`, `"Other"`, or unrecognized Strava types) render with exactly the same DOM structure and content as before this feature was added, with no extra `<span>` in the metadata row.
- [ ] `src/lib/leaderboard.ts` output and behavior are unchanged (not touched by this feature).
- [ ] `LeaderboardClient.tsx` and leaderboard UI are unchanged (not touched by this feature).
- [ ] `ManualEntryModal.tsx` and the manual-entry form's fields and validation are unchanged (not touched by this feature).
- [ ] No API route under `src/app/api/**` changes response shape or behavior.
- [ ] `prisma/schema.prisma` is byte-for-byte unchanged; no migration files are added.
- [ ] `PublicActivity`'s shape in `src/lib/serialize.ts` and the behavior of `toPublicActivity()` are unchanged.

## Open Questions Resolved
- Pace eligibility is `source`-dependent: for `source = "manual"`, require the exact literal `type === "Run"`; for `source = "strava"`, require membership in the fixed allow-list `["Run", "TrailRun", "VirtualRun"]`. Do not add, remove, or generalize this allow-list, and do not implement substring/prefix/regex matching — exact, case-sensitive equality only.
- The zero/negative-value guard applies uniformly regardless of `source`: any Run-eligible activity with `movingTimeSeconds <= 0` or `distanceMiles <= 0` omits pace. Do not introduce a different or higher minimum threshold (e.g. omitting only under 60 seconds) — the cutoff is exactly `<= 0`.
- Pace format is fixed at `M:SS /mi` with no hours component under any circumstance, including minute counts exceeding 59 (print the raw minute count, e.g. `62:00 /mi`, never `H:MM:SS`). Do not reuse or extend `formatSecondsToDuration` for this — write a distinct `formatPace` function.
- The new pace-computation helper, pace-formatting helper, and `STRAVA_RUN_TYPES` constant belong in `src/lib/units.ts`. Do not create a new file and do not place `STRAVA_RUN_TYPES` in `src/lib/constants.ts` — it is a separate, unrelated constant from `MANUAL_ACTIVITY_TYPES`.
- `ManualEntryModal.tsx` and the manual-entry form are not touched in any way by this feature — no pace field, no validation change.
- No leaderboard file, API route, or Prisma schema/migration is touched by this feature.
- Pace is never persisted; it is computed independently per card on every render with no caching or batching layer.

## Feature: Filter Feed by Activity Type (added 2026-08-26)

## Purpose
Today the public activity feed at `/` can only be narrowed by who did an activity (the existing `PersonFilter`). This feature adds a second, independent filter that narrows the feed by what kind of activity it was — e.g. "only Runs," or combined with the person filter, "only this person's Rides." It is for strava-tracker's full audience (the small group of 2-4 friends, logged in or not, viewing the public feed). Because Strava-sourced activities store whatever raw `sport_type`/`type` string Strava's API returned (e.g. `TrailRun`, `VirtualRide`, `WeightTraining`) while manually-entered activities are restricted to a fixed 8-category list, this feature also introduces a small pure normalization function that groups any raw Strava type string into its closest matching one of the 8 manual categories, so the filter's selectable options are always exactly those 8 categories rather than a long, messy list of raw Strava strings. Success looks like: a viewer can open a dropdown, check one or more of the 8 categories, and the feed narrows to matching activities (Strava or manual) combined with any active person filter via AND logic, with zero changes to stored data or other pages.

## Fits Into Existing System
This feature is additive to the existing feed and touches only client-side filtering logic and one new component:

- `src/app/page.tsx` — server component that fetches `activities` and `users` via Prisma and passes them to `DashboardClient`. **Not modified.** No new query params, no server-side filtering.
- `src/components/DashboardClient.tsx` — the feed's client component. Currently holds `selectedUserIds` state and a `visibleActivities` `useMemo` filtering by person only, and renders `PersonFilter` in the header row `<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">` next to the "Activity Feed" heading. Gains new `selectedTypes` state, renders the new `TypeFilter` alongside `PersonFilter` in that same header row, and updates `visibleActivities` to AND-combine person-match and type-match.
- `src/components/PersonFilter.tsx` — read-only interaction-pattern precedent (multi-select via array of selected ids/types, empty-selection-means-show-all, toggle-on-click, "Clear" button shown only when active). **Not modified in any way.**
- `src/lib/constants.ts` — already defines `MANUAL_ACTIVITY_TYPES` (fixed 8-category tuple), `ManualActivityType` (derived union type), and `isManualActivityType()` (type guard). Extended with a new lookup table `STRAVA_TYPE_TO_MANUAL_CATEGORY` and a new pure function `normalizeActivityType`, both colocated here (not in `src/lib/units.ts`, not a new file) because this is a type-taxonomy concern that builds directly on `MANUAL_ACTIVITY_TYPES`/`ManualActivityType`/`isManualActivityType`, not a unit-conversion concern.
- `src/lib/serialize.ts` — read-only; `PublicActivity.type: string` and `PublicActivity.source: "strava" | "manual"` are the inputs the new mapping function consumes. **Not modified.**
- New file `src/components/TypeFilter.tsx` — a new dropdown multi-select component, sibling to `PersonFilter.tsx`, following the project's existing dark-theme design system conventions (`font-mono` labels, `uppercase tracking-widest`, `accent-positive` active-state color token, `border`/`text-tertiary`/`text-primary` tokens already used by `PersonFilter`).
- `src/lib/strava/backfill.ts` and `src/lib/strava/webhook.ts` — read-only; confirmed these already store Strava's raw `sport_type ?? type` string verbatim as `Activity.type`, which is exactly the input shape `normalizeActivityType` must handle. **Not modified.**

## Tech Stack & Constraints
- TypeScript, Next.js App Router, React function components, Tailwind CSS — unchanged, matches the existing stack.
- No new npm dependency of any kind. The dropdown is built from scratch with plain React state, a ref, and a `useEffect` document click listener — no headless-UI/Radix/dropdown library.
- No Prisma schema or migration changes.
- No change to any existing API route contract (`POST /api/activities`, `PATCH /api/activities/:id`, `DELETE /api/activities/:id`, webhook routes, auth routes) — filtering is entirely client-side against already-fetched data.
- `Activity.type` as stored in the database is never rewritten, migrated, or backfilled — normalization happens only at filter-evaluation/render time in the client.
- No changes to `PersonFilter.tsx`'s component, styling, or behavior.
- No changes to `ActivityCard.tsx`'s rendering or the raw (unnormalized) `activity.type` label it displays.
- No changes to `src/lib/units.ts`'s `STRAVA_RUN_TYPES` constant or the Average Pace feature's pace logic.
- Must remain backward-compatible: existing person-filter behavior and feed rendering must work unchanged when no type filter is applied.

## Non-Goals
- No changes to the leaderboard (`/leaderboard`, `LeaderboardClient.tsx`, `src/lib/leaderboard.ts`) — this filter is feed-only.
- No persistence of the selected type filter across page reloads/sessions — no URL query param, no localStorage, no cookie. Matches `PersonFilter`'s existing reset-on-reload behavior.
- No changes to how activities are categorized or stored in the database.
- No Prisma schema or migration changes.
- No changes to any existing API route contract or webhook/auth routes.
- No new npm dependency.
- No changes to `PersonFilter.tsx`.
- No changes to `ActivityCard.tsx`'s rendering, its raw `activity.type` label, or `units.ts`'s `STRAVA_RUN_TYPES`/pace logic.
- No new activity-type categories beyond the 8 already fixed in `MANUAL_ACTIVITY_TYPES` — everything not exactly matching one of the 8 or a known Strava raw type falls into `"Other"`, not a 9th category.
- No server-side filtering, no new query params on `page.tsx`, no changes to the Prisma queries in `src/app/page.tsx`.
- No accessibility-framework additions (no Radix/Headless UI) — plain HTML/hand-authored ARIA attributes only if used.
- No automated test suite is introduced by this feature (none exists in this project today).

## Core Behavior
1. **Normalizing a raw activity type.** Given any activity's raw `type` string (manual category string like `"Run"`, or a raw Strava string like `TrailRun`, `VirtualRide`, `WeightTraining`, or something entirely unrecognized like `AlpineSki`), `normalizeActivityType` returns exactly one of the 8 `ManualActivityType` values. If the input already exactly matches one of the 8 manual categories, that category is returned as-is. If it matches a known key in `STRAVA_TYPE_TO_MANUAL_CATEGORY`, the mapped category is returned. Otherwise, `"Other"` is returned. The function never throws and always returns a value.
2. **Viewer opens the type filter dropdown.** Clicking the `TypeFilter` trigger button toggles open a panel listing all 8 `MANUAL_ACTIVITY_TYPES` as checkable options. Clicking the trigger again (while open) closes it.
3. **Viewer selects one or more types.** Clicking an unselected option in the open panel adds it to `selectedTypes`; the panel remains open (no auto-close on selection) so multiple types can be checked in sequence. Clicking an already-selected option removes it from `selectedTypes`.
4. **No selection means show all types.** When `selectedTypes` is empty, every activity passes the type-filter condition regardless of its normalized type — same convention as `PersonFilter`'s empty-selection-shows-all behavior.
5. **Combining with the person filter.** The feed's `visibleActivities` shows only activities that satisfy both the person-filter condition AND the type-filter condition simultaneously (logical AND, not OR). Each condition independently defaults to "show all" when its respective selection is empty.
6. **Clearing the type filter.** When `selectedTypes.length > 0`, a "Clear" action is visible in the `TypeFilter` panel; clicking it resets `selectedTypes` to `[]` (equivalent to "show all types") without closing the dropdown itself.
7. **Active-filter visual indication.** When `selectedTypes.length > 0`, the `TypeFilter` trigger button visually indicates an active filter (using the existing `accent-positive` color token), consistent with how `PersonFilter`'s active pills are styled.
8. **Outside click closes the dropdown.** While the panel is open, clicking anywhere outside the `TypeFilter` component (trigger + panel) closes the panel without changing `selectedTypes`.
9. **Placement.** The `TypeFilter` dropdown renders in `DashboardClient`'s existing header row, alongside `PersonFilter`, without altering the "Activity Feed" heading or `PersonFilter`'s own rendering/behavior.
10. **Strava vs. manual activities are treated uniformly.** The type filter applies the same normalization to every activity regardless of `source` ("strava" or "manual") — the caller never branches on `source` to filter by type.

## Data Model
N/A — no new or changed database schema, Prisma model, or persisted file format. `PublicActivity` and `Activity.type` are read-only inputs to this feature and are not altered in shape or value.

## Interface / API

**`src/lib/constants.ts`** — new exports, added alongside the existing `MANUAL_ACTIVITY_TYPES`/`ManualActivityType`/`isManualActivityType`:

```ts
// Maps Strava's raw sport_type/type strings to their closest matching
// manual category. Best-effort grouping based on Strava's sport_type
// taxonomy; unmapped keys are not listed here and fall through to "Other".
export const STRAVA_TYPE_TO_MANUAL_CATEGORY: Record<string, ManualActivityType> = {
  // Run family
  Run: "Run",
  TrailRun: "Run",
  VirtualRun: "Run",
  // Ride family
  Ride: "Ride",
  MountainBikeRide: "Ride",
  GravelRide: "Ride",
  EBikeRide: "Ride",
  EMountainBikeRide: "Ride",
  VirtualRide: "Ride",
  Handcycle: "Ride",
  Velomobile: "Ride",
  // Walk
  Walk: "Walk",
  // Hike
  Hike: "Hike",
  // Swim
  Swim: "Swim",
  // Weight Training family
  WeightTraining: "Weight Training",
  Workout: "Weight Training",
  Crossfit: "Weight Training",
  HighIntensityIntervalTraining: "Weight Training",
  // Yoga
  Yoga: "Yoga",
  Pilates: "Yoga",
};

// Pure function. Normalizes any activity type string — whether it's
// already an exact manual category (source = "manual") or a raw Strava
// sport_type/type string (source = "strava") — into one of the 8 fixed
// ManualActivityType categories. Never throws; unrecognized input maps
// to "Other".
export function normalizeActivityType(rawType: string): ManualActivityType {
  if (isManualActivityType(rawType)) return rawType;
  return STRAVA_TYPE_TO_MANUAL_CATEGORY[rawType] ?? "Other";
}
```

This exact mapping table (including the low-confidence `Workout`/`Crossfit`/`HighIntensityIntervalTraining` → `"Weight Training"` and `Pilates` → `"Yoga"` groupings) is approved as-is and must be implemented verbatim — do not add, remove, or reassign entries.

**`src/components/TypeFilter.tsx`** (new file):

```ts
export default function TypeFilter({
  selectedTypes,
  onChange,
}: {
  selectedTypes: ManualActivityType[];
  onChange: (types: ManualActivityType[]) => void;
}): JSX.Element
```

- Renders a single trigger button (label e.g. "Type") using the `font-mono text-xs uppercase tracking-widest` convention already used for labels in `PersonFilter`.
- Local boolean state (e.g. `open`) controls whether the dropdown panel is shown; toggled by clicking the trigger.
- The panel lists all 8 values from `MANUAL_ACTIVITY_TYPES` as checkbox-style options in a fixed, stable order (the order they appear in `MANUAL_ACTIVITY_TYPES`).
- Clicking an option toggles its membership in `selectedTypes` via the same toggle-array pattern as `PersonFilter.toggle` (add if absent, remove if present), calling `onChange` with the new array; the panel does not close on option click.
- A "Clear" element, shown only when `selectedTypes.length > 0`, calls `onChange([])` when clicked.
- The trigger button applies `accent-positive`-based styling (e.g. border/background/text treatment consistent with `PersonFilter`'s active-pill styling) whenever `selectedTypes.length > 0`, and default/inactive styling otherwise.
- A ref on the component's root element plus a `document` `mousedown` (or `click`) listener registered via `useEffect` while `open` is true closes the panel when a click target is outside the ref'd element; the listener is removed on close/unmount.
- Uses only Tailwind classes and color tokens already present in the codebase (e.g. `border-accent-positive/50`, `bg-accent-positive/10`, `text-text-primary`, `border-border`, `text-text-tertiary`) — no new colors.

**`src/components/DashboardClient.tsx`** — changes:

- New import: `TypeFilter` from `./TypeFilter`, and `normalizeActivityType`, `ManualActivityType` from `@/lib/constants`.
- New state: `const [selectedTypes, setSelectedTypes] = useState<ManualActivityType[]>([]);`
- `visibleActivities` becomes:
  ```ts
  const visibleActivities = useMemo(() => {
    return activities.filter((a) => {
      const personMatch = selectedUserIds.length === 0 || selectedUserIds.includes(a.userId);
      const typeMatch =
        selectedTypes.length === 0 || selectedTypes.includes(normalizeActivityType(a.type));
      return personMatch && typeMatch;
    });
  }, [activities, selectedUserIds, selectedTypes]);
  ```
- In the header row (`<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">`), `TypeFilter` is rendered alongside the existing `<PersonFilter users={users} selectedIds={selectedUserIds} onChange={setSelectedUserIds} />`, e.g.:
  ```tsx
  <div className="flex flex-wrap items-center gap-3">
    <PersonFilter users={users} selectedIds={selectedUserIds} onChange={setSelectedUserIds} />
    <TypeFilter selectedTypes={selectedTypes} onChange={setSelectedTypes} />
  </div>
  ```
  (Exact wrapper markup is an implementation detail; the requirement is that the row's existing heading and responsive layout — stacked on mobile, `justify-between` row on `sm:`+ — remain intact and `PersonFilter`'s own JSX/props are unchanged.)

`src/app/page.tsx` — no interface changes; still passes only `activities` and `users` to `DashboardClient`.

## Acceptance Criteria
- [ ] `normalizeActivityType("Run")` returns `"Run"`; `normalizeActivityType("TrailRun")` returns `"Run"`; `normalizeActivityType("VirtualRun")` returns `"Run"`.
- [ ] `normalizeActivityType("Ride")`, `"MountainBikeRide"`, `"GravelRide"`, `"EBikeRide"`, `"EMountainBikeRide"`, `"VirtualRide"`, `"Handcycle"`, and `"Velomobile"` all return `"Ride"`.
- [ ] `normalizeActivityType("Walk")` returns `"Walk"`; `normalizeActivityType("Hike")` returns `"Hike"`; `normalizeActivityType("Swim")` returns `"Swim"`.
- [ ] `normalizeActivityType("WeightTraining")`, `"Workout"`, `"Crossfit"`, and `"HighIntensityIntervalTraining"` all return `"Weight Training"`.
- [ ] `normalizeActivityType("Yoga")` and `normalizeActivityType("Pilates")` both return `"Yoga"`.
- [ ] `normalizeActivityType` called with an unrecognized string (e.g. `"AlpineSki"`, `"Rowing"`, `"Golf"`) returns `"Other"`.
- [ ] `normalizeActivityType` called with any of the 8 exact `ManualActivityType` strings (e.g. `"Other"`, `"Weight Training"`) returns that same string unchanged.
- [ ] `STRAVA_TYPE_TO_MANUAL_CATEGORY` and `normalizeActivityType` are exported from `src/lib/constants.ts` (not `src/lib/units.ts`, not a new file).
- [ ] `src/components/TypeFilter.tsx` exists as a new file exporting a default React component accepting `selectedTypes: ManualActivityType[]` and `onChange: (types: ManualActivityType[]) => void` props.
- [ ] Clicking the `TypeFilter` trigger button when the panel is closed opens the panel; clicking it again while open closes it.
- [ ] The open panel lists all 8 values from `MANUAL_ACTIVITY_TYPES`, each independently checkable.
- [ ] Clicking an unchecked type option adds it to the selection (invokes `onChange` with the previous array plus that type) and the panel remains open.
- [ ] Clicking an already-checked type option removes it from the selection (invokes `onChange` with that type filtered out) and the panel remains open.
- [ ] With `selectedTypes` empty, the feed shows activities of every type (subject to the person filter).
- [ ] With one or more types selected, the feed shows only activities whose `normalizeActivityType(activity.type)` is included in `selectedTypes`.
- [ ] With both a person filter and a type filter active, the feed shows only activities matching both conditions simultaneously (AND, not OR).
- [ ] A "Clear" action is visible in/on the `TypeFilter` UI only when `selectedTypes.length > 0`, and clicking it resets the selection to empty (feed reverts to showing all types, subject to the person filter).
- [ ] When `selectedTypes.length > 0`, the `TypeFilter` trigger button is visually styled with the active-state (`accent-positive`-based) treatment; when empty, it is not.
- [ ] With the panel open, clicking an element outside the `TypeFilter` component's trigger and panel closes the panel and leaves `selectedTypes` unchanged.
- [ ] With the panel open, clicking inside the panel (e.g. on an option) does not close the panel.
- [ ] `TypeFilter` renders in `DashboardClient`'s existing header row alongside `PersonFilter`, and the "Activity Feed" heading is still present and unchanged.
- [ ] Manually-entered activities and Strava-sourced activities are both correctly included/excluded by the type filter using the same `normalizeActivityType` logic (no branching on `activity.source` for type-filter purposes).
- [ ] No network request, URL change, or query-string change occurs as a result of interacting with `TypeFilter` (filtering is client-side only).
- [ ] Reloading the page resets `selectedTypes` to empty (no persistence via URL, localStorage, or cookie).

## Regression Safety
- [ ] `PersonFilter`'s rendering, pill styling, toggle behavior, and "Clear" button continue to work exactly as before, unaffected by the presence of `TypeFilter`.
- [ ] With `selectedTypes` empty (the default/initial state), the feed's visible activities are identical to what they were before this feature (i.e., determined by `selectedUserIds` alone).
- [ ] `Activity.type` values in the database are unchanged by any interaction with the new filter — normalization is never written back to storage.
- [ ] `ActivityCard`'s displayed type label continues to show the raw, unnormalized `activity.type` value, not the normalized category.
- [ ] The leaderboard page (`/leaderboard`) and its data (`src/lib/leaderboard.ts`, `LeaderboardClient.tsx`) are unaffected by this feature.
- [ ] `src/app/page.tsx`'s Prisma queries and props passed to `DashboardClient` (`activities`, `users`) are unchanged.
- [ ] Existing API routes (`POST /api/activities`, `PATCH /api/activities/:id`, `DELETE /api/activities/:id`, webhook routes, auth routes) behave identically to before this feature.
- [ ] The header row's existing responsive layout (stacked column on narrow viewports, row with space-between on `sm:` and above) is preserved with both `PersonFilter` and `TypeFilter` present.
- [ ] The Average Pace feature's `STRAVA_RUN_TYPES` constant and pace computation/formatting logic in `src/lib/units.ts` are unchanged and unaffected.

## Open Questions Resolved
- The type filter is implemented as a dropdown multi-select (trigger button + panel), not a pill row — this is non-negotiable and distinct from `PersonFilter`'s style. Do not restyle it as a pill row for visual consistency.
- `PersonFilter.tsx` is not modified in any way by this feature — treat it as read-only precedent only.
- "No selection = show all" applies to the type filter exactly as it does for the person filter. The person filter and type filter combine with AND logic, never OR.
- The Strava-to-manual-category mapping table (`STRAVA_TYPE_TO_MANUAL_CATEGORY`) and the `normalizeActivityType` function live in `src/lib/constants.ts` — not `src/lib/units.ts`, and not a new file. This deliberately deviates from the `STRAVA_RUN_TYPES`-in-`units.ts` precedent from the Average Pace feature; do not move it to `units.ts` or split it into a new module.
- The mapping table's exact contents (including `Workout`/`Crossfit`/`HighIntensityIntervalTraining` → `"Weight Training"` and `Pilates` → `"Yoga"`) are approved as-is despite being lower-confidence groupings. Implement the table exactly as specified in Interface / API — do not add categories, remove entries, or reassign the questionable ones to `"Other"` on your own judgment.
- Any raw Strava type string not present in `STRAVA_TYPE_TO_MANUAL_CATEGORY` and not exactly matching one of the 8 manual categories defaults to `"Other"`. This is intentional and not to be treated as a missing-entry bug.
- No new npm dependency is used for the dropdown; it is built with plain React state, a ref, and a `useEffect`-based outside-click listener.
- `src/app/page.tsx` requires no changes — all filtering, including the new type filter, happens client-side in `DashboardClient` over data already fetched server-side. Do not add query params or server-side filtering.
- No persistence (URL, localStorage, cookie) of `selectedTypes` across reloads — it resets to empty on every page load, matching `selectedUserIds`'s existing behavior.
- Exact visual details beyond what's specified here (precise panel positioning/width, checkbox iconography, spacing) are left to the developer's discretion within the existing dark-theme design system and existing color tokens — no new colors or design-system additions.
