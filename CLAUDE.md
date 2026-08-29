# QPTC Score Tracker — Claude.md

## Project Overview

A web app for Queen's Park Tennis Club (QPTC) to manage singles and doubles leagues (organised into tournaments of one or more rounds/divisions), track scores, and handle promotion/relegation. Built mobile-first but fully responsive. Everything is behind a login.

**Repo name:** `qptc-score-tracker`
**Deployment:** Vercel
**Database:** Neon (PostgreSQL via `@neondatabase/serverless`, connected through `DATABASE_URL`) — no Supabase anywhere in this project.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) | SSR, API routes, works natively with Vercel |
| Language | TypeScript | User expanding from JS/React |
| Styling | Tailwind CSS | Mobile-first utility classes, fast to build with |
| Auth | Custom (bcryptjs + NextAuth v5 beta, Credentials provider, JWT sessions) | Handles hashed passwords, JWTs, sessions |
| Database | Neon (PostgreSQL) | Serverless Postgres, connected via Vercel integration; also branched for the anonymized local-dev database (see below) |
| File storage | Vercel Blob | Avatar uploads |
| Email | Nodemailer | Verification, password reset, dispute/contact notifications |
| Deployment | Vercel | One-click from GitHub, includes Vercel Cron for scheduled jobs |

> Note on React Native: Business logic kept in custom hooks and utility functions so a future React Native port is feasible. Components kept thin.

---

## Database Schema

Schema lives only in the live Neon database — there are no migration/schema files in the repo. This reflects the actual current schema (re-verify with `information_schema.columns` if it may have drifted since this was last updated).

### `profiles`
Core columns: `id` (uuid), `email`, `full_name`, `first_name`, `last_name`, `title`, `password_hash`, `role` (enum, see Role System), `strength_rating` (numeric, nullable — not yet actively computed anywhere), `created_at`.

Account/auth state: `email_verified`, `verification_token` (+ `_expires`), `reset_token` (+ `_expires`), `is_active`, `deleted_at` (soft delete), `last_login_at`, `welcome_seen`.

Profile detail: `phone`, `gender`, `member_number`, `is_injured`, `avatar_url` (Vercel Blob URL, uploaded via `/api/upload-avatar`).

Placeholder players (see Placeholder Players below): `is_placeholder` (boolean), `placeholder_alias` (nullable, the anonymized display label), `placeholder_anonymized` (boolean).

### `tournaments`
The container for a league competition. `id`, `name`, `format` (`'single'` | `'multi'`), `status`, `num_divisions`, `num_promoted`, `num_relegated`, `num_rounds`, `round_dates` (array), `final_end`, `is_public`, `color`, `description`, `created_by`, `created_at`, `has_registration_form` (boolean, see Tournament Registration below), `max_registrations` (nullable, multi-format only - caps total registrations), `registration_questions` (jsonb, nullable - the admin-configured custom question list for the registration form, see Tournament Registration below), `scoring_method`/`points_config` (multi-format only - see below).

- A **single**-format tournament has one round and one division — this is the original "one league, one season" concept.
- A **multi**-format tournament has multiple rounds; each round runs its own division(s), and `generateNextRound()` (`src/lib/tournament.ts`) computes standings per division, applies promotion/relegation (`computePromotionMoves`), and generates the next round's `leagues` rows.
- Single-format tournaments are auto-activated/completed, and multi-format tournaments have their next round auto-generated, by the `cron/complete-leagues` job - there is no manual "generate next round now" option in the admin UI, only changing a round's start date in tournament settings.
- For multi-format tournaments, `scoring_method`/`points_config` live on the tournament (set once in "Manage tournament settings") and are cascaded onto every division in every round on save, and applied to newly-generated rounds by `generateNextRound()` - they are not editable per-division, since divisions of the same tournament must score consistently. `leagues.scoring_method`/`points_config` are still the columns actually read by standings calculations (`calculateStandings`) - the tournament-level columns are the single source of truth admins edit, kept in sync onto every division. Single-format tournaments have no tournament-level equivalent; their one division's `leagues.scoring_method`/`points_config` are edited directly, same as before.

### `leagues`
One division within one round of a tournament. `id`, `name`, `tournament_id`, `round_number`, `division_order`, `season_start`, `season_end`, `status` (`upcoming` | `active` | `completed`), `max_players`, `scoring_method`, `points_config` (jsonb, for points-based scoring), `tiebreaker`, `num_promoted`, `num_relegated`, `join_type`, `league_type`, `gender_category`, `is_public`, `description`, `color`, `created_by`, `created_at`.

### `league_players`
`id`, `league_id`, `player_id`, `partner_id` (doubles pairing), `final_position` (nullable, set at end of round), `started_seen`, `ended_seen`, `user_archived`.

### `matches`
Supports singles and doubles, plus a two-track correction flow (disputes and suggested edits). `id`, `league_id`, `player1_id`, `player2_id`, `player3_id`/`player4_id` (doubles partners, nullable), `match_type` (singles/doubles, plus `'retirement'`/`'unfinished'`), `submitted_by`, `score_player1`/`score_player2` (sets won), `set_scores`/`tiebreak_scores` (jsonb), `winner_id`, `status` (`confirmed` | `disputed` | `overridden`), `played_at`, `submitted_at`, `opponent_seen`/`partner_seen`/`opponent2_seen`.

Suggested-edit fields (a second, lighter-weight correction path alongside disputes): `pending_score_player1`/`2`, `pending_set_scores`, `pending_tiebreak_scores`, `pending_match_type`, `pending_winner_id`, `pending_edit_by`.

### `disputes`
`id`, `match_id`, `raised_by`, `reason`, `requested_score_player1`/`2`, `requested_set_scores`, `requested_tiebreak_scores`, `acknowledged_by_player1`/`2`, `resolved_by` (nullable), `resolved_at` (nullable), `status` (`open` | `resolved`).

### `tournament_registrations`
One row per player expressing interest in a tournament (see Tournament Registration below). `id`, `tournament_id`, `player_id`, `ability_level` (`'beginner'` | `'improver'` | `'intermediate'` | `'parks_tuesdays'` | `'parks_wednesdays'` | `'parks_thursdays'` - always asked, fixed), `answers` (jsonb, keyed by the tournament's `registration_questions` question ids - everything besides ability level), `assigned_league_id` (nullable - set only once a placement actually goes live, see Assign Divisions below), `created_at`, `updated_at`. Unique on `(tournament_id, player_id)`.

### `league_player_drafts`
A staging mirror of `league_players` for a round that hasn't started yet (see Assign Divisions below). `id`, `league_id`, `player_id`, `partner_id` (doubles pairing, nullable), `confirmed` (boolean, admin-only UX marker - doesn't block further edits), `created_at`. Unique on `(league_id, player_id)`, same as the constraint `league_players` relies on. Rows here are never visible to members and get copied into real `league_players` rows (then deleted) the moment their league activates.

---

## Role System

| Role | Capabilities |
|---|---|
| `super_admin` | Everything — only James. Can promote/demote others to `admin` |
| `admin` | Create/edit tournaments and leagues, assign players, override scores, handle disputes, trigger promotion/relegation |
| `member` | Submit scores, dispute scores, suggest edits, view tables |
| `unverified` | Assigned at registration; cannot log in until email is verified. Auto soft-deleted (`deleted_at` set) after 7 days unverified, with reminder/final-warning emails sent along the way — see `cron/cleanup-unverified` |

Login also checks `is_active` (deactivated accounts are blocked with a typed `AccountDeactivatedError`) and `deleted_at IS NULL`.

---

## League & Tournament Rules

- A tournament is split into one or more divisions (`leagues`) per round; `max_players`, `num_promoted`, `num_relegated`, `scoring_method`, and `tiebreaker` are configurable per league, not fixed.
- Each player plays each other once per round within their division. Doubles pairs (`partner_id`) play as a team.
- Scoring: sets won (e.g. 2-1, 2-0), or points-based via `points_config` depending on `scoring_method`.
- League table ranked by: wins → sets won → head-to-head (see `src/lib/league.ts` / `src/lib/promotion.ts`).
- End of round: top N promoted, bottom N relegated between adjacent divisions (`computePromotionMoves` in `src/lib/promotion.ts`), admin can override before the next round is generated.

---

## Score Flow

1. Either player (or either pair, in doubles) submits the result
2. Score is **immediately live** in the table
3. The opposing player can either:
   - Click **Dispute** — raises a `disputes` record with a requested correction and a reason
   - Suggest an edit directly on the match (`pending_*` fields) — a lighter-weight correction the other side/an admin can accept, without going through the dispute/reason flow
4. Admin reviews and can overwrite the score at any time
5. Admin marks disputes as resolved

---

## Tournament Registration

An optional per-tournament "registration form" (toggled on at tournament creation, `tournaments.has_registration_form`) that lets members express interest in an upcoming tournament and give an admin the info needed to place them fairly, without joining a league directly:

1. When ticking "Add a registration form" on tournament creation (`CreateLeagueForm.tsx`), the admin gets an inline question builder (`RegistrationQuestionsBuilder`) pre-filled with sensible defaults (`DEFAULT_REGISTRATION_QUESTIONS` in `src/lib/registration.ts`: previous Winter League division, 3x "similar player" free text, notes). The admin can edit labels, add/remove/reorder questions, change a question's type (multiple choice / short answer / long answer), edit multiple-choice options, and mark questions required. This question set is fixed once the tournament is created - there's no later editing UI. Ability level (Beginner / Improver / Intermediate / Parks League Tuesdays / Parks League Wednesdays / Parks League Thursdays) is NOT part of this builder - it's always asked on every registration form and is the one thing used to suggest a division.
2. Any member (new or existing) sees a "Register" button on the tournament card/page while it's `upcoming` and hasn't already been placed in a division. This links to `/tournaments/register/[tournamentId]`, which renders the fixed ability-level toggle plus the tournament's `registration_questions` dynamically, alongside a read-only name/contact block pulled from their profile.
3. Submitting does **not** join a league - it upserts a `tournament_registrations` row (`ability_level` + an `answers` jsonb keyed by question id, validated server-side against the question definitions via `validateAnswers()`). The player can keep editing it until an admin assigns them.
4. Admins review pending registrations (ones with no `assigned_league_id`) on the tournament's admin page, alongside the existing assign-players panel, with each question's answer shown by its configured label. For multi-format tournaments, `computeSuggestedDivisions()` (`src/lib/registration.ts`) sorts pending registrants by ability level alone and suggests a division as a hint - the admin still assigns manually.
5. Assigning a registrant via the existing `POST /api/admin/leagues/[id]/players` also sets `assigned_league_id`, which locks their registration and drops them off the pending list; removing them via `DELETE` clears it back to unassigned.
6. Multi-format tournaments can optionally cap total registrations (`tournaments.max_registrations`, defaults to `numDivisions * maxPlayers` at creation but editable). Once hit, new registrations are rejected with "Registration is full" - no waitlist. Single-format tournaments have no cap.

---

## Placeholder Players

For club members who want to play but don't want to use the app themselves. A placeholder is a `profiles` row (`is_placeholder = true`) with no real login: an internal-only generated email/password hash (never shown anywhere) so it satisfies the `NOT NULL`/unique constraints on those columns, `member_number = NULL`, and an explicit guard in `src/auth.ts` rejecting login for any `is_placeholder` row as defense-in-depth. They accrue wins/losses/match history exactly like a real player since `matches`/`league_players` just reference their profile id like any other.

1. Admins manage a persistent, club-wide roster at `/admin/placeholder-players` (linked from `/admin/users`, not mixed into that page's own user list) - create (full name + an admin-typed alias + an anonymize toggle), edit, or retire. There's also a "+ Add placeholder player" inline shortcut in each league's assign-players panel (`AssignPlayersPanel.tsx`) to create one and have it show up in that same picker immediately.
2. **Anonymize** (`placeholder_anonymized` + `placeholder_alias`) is a single global choice per placeholder, not per-viewer: when on, the alias replaces the full name everywhere a name is displayed to anyone, admins included - league tables, fixtures/results, match detail/edit pages, dashboard notifications, disputes. The one exception is admin-management pickers (the assign-players member picker, the roster page itself) where the admin always sees the real full name (tagged "Placeholder") since they need the true identity to manage them correctly.
3. Placeholders are never clickable - no `/players/[id]` link, no contact info anywhere (they have none to begin with) - name renders as plain text wherever a real player's name would otherwise link out.
4. **Retiring** a placeholder is a soft delete only (`deleted_at`, same convention as real profiles) - never hard-deleted, since their historical matches must keep resolving correctly forever, including from their opponents' side.
5. **"Attribute to real account"** (from the roster page) is a merge, not an in-place account upgrade: admin picks an existing real member, and every `matches`/`league_players` row referencing the placeholder gets re-pointed to that member's id (`mergePlaceholderIntoAccount()` in `src/lib/placeholders.ts`, wrapped in a transaction), then the placeholder is retired. Refuses with a conflict error if the target member already has their own row in one of the same leagues as the placeholder.

---

## Assign Divisions

A tournament-level tool for admins to place every registered player into the current round's divisions before it starts, with the guarantee that **no member can see who's in which division until that round actually goes active** - there is no visibility check anywhere to bolt this onto (any logged-in member who has a division's URL can see its full named roster with no gating at all), so instead nothing real ever gets written until the round starts.

1. Whenever a league's `status` is `'upcoming'`, every assignment mechanism - the new bulk "Assign divisions" panel (`AssignDivisionsPanel.tsx`, shown as a section on `/admin/tournaments/multi/[tid]`), the existing per-division assign-players panel, and the existing per-registrant "Assign" button on `RegistrationsPanel` - writes to `league_player_drafts` instead of `league_players` (`POST`/`DELETE /api/admin/leagues/[id]/players` branches on the league's current status). Nothing here ever touches `tournament_registrations.assigned_league_id` - that column is read directly by the member-facing `/tournaments/register/[tournamentId]` page ("You've been placed in X"), so it's only ever set at materialization (see below), never at draft time.
2. **"Auto-suggest allocation"** (`POST .../assign-divisions/suggest`) runs `computeSuggestedDivisions()` (`src/lib/registration.ts`) over every registrant, replacing the current draft arrangement for the round entirely (a destructive, confirmed action) - it returns the pre-allocation snapshot, which powers an **"Undo auto-allocate"** button (`POST .../assign-divisions/restore`, replaces the current arrangement wholesale with a given snapshot) shown until any further manual move/pair happens. The algorithm suggests each registrant's division independently, purely on their own merits, regardless of how many other people have registered or how full divisions currently are - a lightly-subscribed round still places a beginner near the bottom and a strong player at the top, leaving gaps in between for admins to fill in manually, rather than clustering everyone into whichever divisions happen to have registrants. When present, the `previous_division` answer (the default "which division did you finish in last season" question, id fixed regardless of label edits) is used directly as their target division, clamped into range - a far more precise signal than the coarse 6-level `ability_level`, which is used as a fallback, scaled proportionally across however many divisions this tournament has. It never checks division capacity, so multiple registrants can land on the same division - the admin resolves that by hand same as any other adjustment. Admins then drag players between division columns (native HTML5 drag-and-drop, no dependency; each card also has a plain `<select>` fallback for admins on mobile/touch) - each move (`POST .../assign-divisions/move`) is saved immediately, same as everywhere else in this app. Doubles pairing within a division is a small picker per unpaired card (`POST .../assign-divisions/pair`), not drag-to-pair.
3. Each division column also has a **"+ Add player"** search picker listing every club member and placeholder (not just this tournament's registrants) - picking a registrant who's unassigned or in a different division moves them here (same `move` endpoint, since it operates on a bare player id with no registration-specific logic); picking someone who never registered, or a placeholder, just drafts them in directly with no registration involved. The GET response's `players` list (all non-unverified, non-deleted profiles + placeholders, same query as `AssignPlayersPanel`) is what makes this possible - it's also what lets the board render a card correctly for a drafted player who has no registration row (no ability-level badge, just their name).
4. **"Confirm choices"** (`POST .../assign-divisions/confirm`) just flips a `confirmed` flag on the round's draft rows - a UX marker for the admin ("I'm happy with this"), not a lock; everything stays fully movable until the round actually starts.
5. **Materialization** happens the instant `cron/complete-leagues` flips a league's status from `upcoming` to `active` (both of the two places that can do that): `materializeDraftsForLeagues()` (`src/lib/divisionDrafts.ts`) copies that league's drafts into real `league_players` rows, sets `assigned_league_id` for each one, then clears the drafts. `generateNextRound()` (promotion/relegation into round 2+) writes to the same drafts table instead of `league_players` whenever it computes the new round's status as still `upcoming` - in normal operation this is rare (a round is generated only once its start date has already arrived, so it's almost always created already-active), but it's the same safety net if an admin needs to tweak an early-generated round before it goes live.

---

## Pages / Routes

```
/                                     → redirect to /dashboard (if logged in) or /login
/login, /register                     → auth
/forgot-password, /reset-password     → password reset flow
/dashboard                            → overview
/tournaments                          → list of tournaments
/tournaments/[id]                     → tournament/division detail: table + fixtures + results
/tournaments/[id]/submit              → submit a score
/tournaments/[id]/matches/[matchId]   → match detail (+ /edit, /suggest-edit)
/tournaments/multi/[tid]              → multi-round tournament overview across rounds
/tournaments/register/[tournamentId]  → registration form for an upcoming tournament (see Tournament Registration)
/profile                              → own profile (avatar, details, password)
/players/[id]                         → view another player's profile
/my-match-history, /my-tournament-history
/contact                              → contact form (Nodemailer)
/admin/tournaments (+ /new, /[id])    → create/edit tournaments and their leagues
/admin/tournaments/multi/[tid]        → manage a multi-round tournament (next round always generates automatically via cron/complete-leagues - no manual trigger)
/admin/disputes                       → review and resolve disputes
/admin/users, /admin/users/[id]       → user management (roles, reset password, send reset email)
/admin/placeholder-players            → manage the placeholder-player roster (see Placeholder Players)
```

API routes largely mirror this (`/api/register`, `/api/verify-email`, `/api/profile`, `/api/upload-avatar`, `/api/leagues/[id]/*`, `/api/matches`, `/api/matches/[matchId]`, `/api/disputes*`, `/api/admin/*`, `/api/tournaments/[tournamentId]/register`) plus:
```
/api/cron/complete-leagues     → auto-activate/complete single-format tournaments, and auto-generate the next round for multi-format ones
/api/cron/cleanup-unverified   → remind/warn/soft-delete unverified accounts
/api/cron/sync-dev-db          → weekly: reset the dev DB branch from prod and anonymize it (see below)
/api/cron/backup-prod-db       → nightly: dump all prod tables to a private Vercel Blob (see below)
```

---

## Local Dev Database

A separate Neon **branch** (`dev`, id in `NEON_DEV_BRANCH_ID`) exists alongside prod purely for local development, so real member data never needs to be used for testing. It is refreshed and anonymized by `/api/cron/sync-dev-db` (Vercel Cron, weekly, guarded by `CRON_SECRET`):

1. `src/lib/neonApi.ts` calls Neon's Management API to restore the `dev` branch from the `prod` branch's current head — an instant copy-on-write reset, not a row-by-row copy. Refuses to run if `NEON_DEV_BRANCH_ID`/`NEON_PROD_BRANCH_ID` are missing or identical.
2. `src/lib/anonymizeDevDb.ts` then connects (via `DEV_DATABASE_URL`) and scrubs `profiles`: emails become `player{N}@example.test`, names become `Test Player {N}`, all password hashes become the single known dev password (`devpassword123`, exported as `DEV_DATABASE_PASSWORD`), and phone/avatar/verification/reset-token fields are cleared. Refuses to run if `DEV_DATABASE_URL` is unset or equals `DATABASE_URL`, to guard against a misconfigured env var ever anonymizing prod.

To develop locally against this data, point your local `.env.local`'s `DATABASE_URL` (not `DEV_DATABASE_URL`) at the `dev` branch's connection string — `DEV_DATABASE_URL` is only used by the sync job itself. Vercel's production `DATABASE_URL` stays pointed at prod.

**Backups:** Neon's built-in point-in-time restore covers the last few hours (the project's History Window is capped on the free plan). Beyond that, `/api/cron/backup-prod-db` (nightly, `src/lib/backupProdDb.ts`) does an application-level dump of every table (there's no `pg_dump` binary available in Vercel's serverless runtime, so this is a `SELECT * FROM <table>` per table, serialized to JSON) and uploads it to Vercel Blob at `backups/prod/<timestamp>.json` with `access: 'private'` — unlike avatar uploads, these contain password hashes and PII so they must not be public. It keeps the newest 14 backups and prunes older ones after each successful upload. This job only ever reads from prod and writes to Blob; it never writes to the database.

---

## Environment Variables

```
DATABASE_URL=                # Neon prod connection string (or the dev branch's, for local dev)
AUTH_SECRET=
AUTH_URL=
BLOB_READ_WRITE_TOKEN=       # Vercel Blob, for avatar uploads
CONTACT_EMAIL=
CONTACT_EMAIL_PASSWORD=
CRON_SECRET=                 # shared secret checked by every /api/cron/* route

# Local dev database sync (see "Local Dev Database" above)
DEV_DATABASE_URL=            # the `dev` Neon branch's connection string
NEON_API_KEY=                # Neon Management API key (Account/Org settings -> API keys)
NEON_PROJECT_ID=
NEON_PROD_BRANCH_ID=
NEON_DEV_BRANCH_ID=
```

---

## Development

```bash
npm run dev        # localhost:3000
npm run build      # production build
npm run lint       # ESLint
npm test           # run all tests
npm run test:watch # run tests in watch mode
```

---

## Testing

### Setup
- **Framework:** Jest 29 + React Testing Library
- **Config:** `jest.config.js` (CommonJS, async function) — uses `next/jest` base config spread into a `projects` array
- **Setup file:** `jest.setup.js` — loads `@testing-library/jest-dom`
- **Two test environments:**
  - `components` project → `jsdom`, matches `**/__tests__/components/**/*.test.tsx`
  - `api` project → `node`, matches `**/__tests__/api/**/*.test.ts`
- **Note:** Must use Jest 29, not 30 — Jest 30 is incompatible with `next/jest`

### Existing tests (all passing — 72 tests, 13 suites)
| File | Covers |
|---|---|
| `__tests__/components/login.test.tsx` | Login form fields, calls signIn, redirects on success, shows error on failure, disables button while loading |
| `__tests__/components/create-league.test.tsx` | Create-league form: fields, submits correct data to API, shows error on API failure, refreshes page on success |
| `__tests__/components/assign-players.test.tsx` | Assigning players to a league/division |
| `__tests__/components/tournament-registration-form.test.tsx` | Registration form: renders fields, requires ability level, submits correct payload, pre-fills from an existing registration, shows API errors |
| `__tests__/api/promotion.test.ts` | `computePromotionMoves` — promotion/relegation math across divisions |
| `__tests__/api/registration-ranking.test.ts` | `computeSuggestedDivisions` — ability-level ordering, even bucket split across divisions |
| `__tests__/api/registration-questions.test.ts` | `validateRegistrationQuestions`/`validateAnswers` — question-builder validation and per-answer validation against question definitions |
| `__tests__/api/tournament-registration.test.ts` | `POST /api/tournaments/[id]/register` — rejects when the form is disabled/closed, invalid ability level, unanswered required question, capacity reached, editing once assigned; allows editing an unassigned registration |
| `__tests__/api/anonymize-dev-db.test.ts` | Dev-DB anonymization: refuses on missing/matching `DEV_DATABASE_URL`, scrubs profiles otherwise |
| `__tests__/api/neon-api.test.ts` | Dev branch reset: refuses on missing/matching branch ids, restores + polls operations to completion, surfaces failed operations |
| `__tests__/api/sync-dev-db-cron.test.ts` | `GET /api/cron/sync-dev-db` — 401 without/wrong `CRON_SECRET`, 200 + correct body on success |
| `__tests__/api/backup-prod-db.test.ts` | Prod backup: dumps every table, uploads as a private blob, prunes backups beyond the retention count |
| `__tests__/api/backup-prod-db-cron.test.ts` | `GET /api/cron/backup-prod-db` — 401 without/wrong `CRON_SECRET`, 200 + correct body on success |

### Rules
- **Run `npm test` before every commit** and confirm all tests pass before proceeding.
- **When a new feature is built**, prompt James to write tests covering it before moving on. Suggest specific test cases based on the feature's behaviour.
- Labels in forms **must** have `htmlFor` matching the input's `id` — required for both accessibility and `getByLabelText` in tests.

---

## Shipped beyond original MVP scope

These were originally listed as stretch/future items but are now built and live:
- **Doubles**: `player3_id`/`player4_id` + `match_type` on `matches`, `partner_id` on `league_players`; standings computed as team1/team2 in `src/lib/league.ts`.
- **Multi-round tournaments with promotion/relegation**: `src/lib/tournament.ts`'s `generateNextRound()`.
- **Profile pictures**: `avatar_url` + `/api/upload-avatar` (Vercel Blob).
- **Player profile pages**: `/players/[id]`, linked from tables/results.
- **Points-based scoring**: `scoring_method` + `points_config` per league, as an alternative to pure win/loss.
- **Gender categories** for leagues/divisions.
- **Suggested-edit flow** for match results, alongside disputes (see Score Flow above).
- **Tournament registration form**: `tournament_registrations` table, optional per-tournament, with an admin-configurable custom question builder and admin-facing suggested-division ranking for multi-format tournaments (see Tournament Registration above).
- **Placeholder players**: `profiles.is_placeholder`/`placeholder_alias`/`placeholder_anonymized`, for members who want to play without using the app themselves - no login, optional anonymized display, merge-into-a-real-account support (see Placeholder Players above).

## Stretch Features (still not built)
- [ ] Honours on profile page (league winner / runner-up badges by season/year)
- [ ] In-app messaging between members
- [ ] Matchmaking: players post availability for friendly games
- [ ] Strength rating actively computed from H2H results (column exists, nothing populates it yet)
- [ ] Push notifications (score submitted, dispute raised)
- [ ] Public stats page (optional, currently everything behind login)

---

## UI Styling Conventions

This app is used primarily as a mobile app - always design and check the mobile layout first (narrow width, touch-sized targets), then adapt up to desktop with `sm:` classes, not the other way round. Patterns established across the app that new/changed UI should follow by default:

- **Card/row headers (a title plus badges/actions)**: stack vertically on mobile, side-by-side on desktop - `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2`. Keep the primary identifier (name) and core action links/buttons visible on both; secondary/decorative badges (status pills, type tags like "Multi-league") can be hidden on mobile with `hidden sm:inline-block` if space is tight - see `LeagueCard`/`MultiTournamentCard` in `src/app/(app)/tournaments/page.tsx` and the row in `src/app/(app)/admin/tournaments/page.tsx`.
- **Within a stacked row's second line**, if it holds both info (stats) and actions (links/buttons), split them apart with `justify-between` on mobile so stats sit left and actions sit right, then collapse back to grouped-right with `sm:justify-end` on desktop (two inner `div`s, not one flat list) - see the stats/View/Manage row in `src/app/(app)/admin/tournaments/page.tsx`.
- **Page headers (H1 + subtitle + a primary action button)**: keep the title and subtitle each on one line (`whitespace-nowrap`) rather than letting them wrap; stack the button below on mobile, right-aligned (`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3` on the container, `self-end sm:self-auto` on the button), returning to a single row with the button on the right on desktop - see the header in `src/app/(app)/admin/tournaments/page.tsx`.
- **Equal-width option/button groups that must never wrap onto extra rows** (e.g. the ability-level toggle): use a CSS grid sized to the exact option count (`grid-cols-N`, or an inline `style={{ gridTemplateColumns: 'repeat(N, minmax(0, 1fr))' }}` when N is dynamic) rather than `flex-wrap`. Let text wrap *within* a button instead (`break-words break-keep`, `flex items-center justify-center text-center` to center both axes, `min-h-[44px]` for a consistent touch target) rather than the row wrapping or text overflowing the button - see `RegistrationForm.tsx`.
- **Text sizing**: default to the smaller mobile size and bump up with `sm:` (e.g. `text-xs sm:text-sm`, `text-sm sm:text-base`) - never the reverse.
- **Collapsible sections**: use the shared `CollapsibleSection` component (`src/components/CollapsibleSection.tsx`) for admin panels that don't need to be visible at a glance (settings forms, danger zones, long lists) - collapsed by default, a chevron that flips on open, and an optional `meta` node next to the title (e.g. "12 registered", "4 divisions").
- **Labeled stats**: short stat displays use a `Label: value` format (e.g. `Players: 4`, `Played: 12`, `Registered: 17`), not free-form phrasing (`4 players`) - keep this consistent wherever a row/card shows counts.
- **No trailing full stops** on short UI status/notice/empty-state messages ("Registration saved", "No players assigned yet") - reserve normal sentence punctuation for longer explanatory or legal-style paragraphs (e.g. the delete-account warning, multi-sentence form hints).

---

## Notes

- Auth is fully custom: NextAuth v5 (beta) Credentials provider + JWT sessions, bcryptjs password hashing (`src/auth.ts`). No Supabase, no RLS — access control is enforced in API route handlers (role checks against the session), not database policies.
- Score disputes do NOT block the score from counting - they flag it for review
- Promotion/relegation is calculated at round end but admins can override before it's finalised
- Email uniqueness is enforced case-insensitively at the database level
- Never use em dashes (—) or en dashes (–) anywhere in the UI — always use regular hyphens (-)
- This app is used primarily as a mobile app - see "UI Styling Conventions" below for the specific patterns this implies.
