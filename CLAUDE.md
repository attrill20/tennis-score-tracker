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

### `tournaments`
The container for a league competition. `id`, `name`, `format` (`'single'` | `'multi'`), `status`, `num_divisions`, `num_promoted`, `num_relegated`, `num_rounds`, `round_dates` (array), `final_end`, `is_public`, `color`, `description`, `created_by`, `created_at`.

- A **single**-format tournament has one round and one division — this is the original "one league, one season" concept.
- A **multi**-format tournament has multiple rounds; each round runs its own division(s), and `generateNextRound()` (`src/lib/tournament.ts`) computes standings per division, applies promotion/relegation (`computePromotionMoves`), and generates the next round's `leagues` rows.
- Single-format tournaments are auto-activated/completed by the `cron/complete-leagues` job.

### `leagues`
One division within one round of a tournament. `id`, `name`, `tournament_id`, `round_number`, `division_order`, `season_start`, `season_end`, `status` (`upcoming` | `active` | `completed`), `max_players`, `scoring_method`, `points_config` (jsonb, for points-based scoring), `tiebreaker`, `num_promoted`, `num_relegated`, `join_type`, `league_type`, `gender_category`, `is_public`, `description`, `color`, `created_by`, `created_at`.

### `league_players`
`id`, `league_id`, `player_id`, `partner_id` (doubles pairing), `final_position` (nullable, set at end of round), `started_seen`, `ended_seen`, `user_archived`.

### `matches`
Supports singles and doubles, plus a two-track correction flow (disputes and suggested edits). `id`, `league_id`, `player1_id`, `player2_id`, `player3_id`/`player4_id` (doubles partners, nullable), `match_type` (singles/doubles, plus `'retirement'`/`'unfinished'`), `submitted_by`, `score_player1`/`score_player2` (sets won), `set_scores`/`tiebreak_scores` (jsonb), `winner_id`, `status` (`confirmed` | `disputed` | `overridden`), `played_at`, `submitted_at`, `opponent_seen`/`partner_seen`/`opponent2_seen`.

Suggested-edit fields (a second, lighter-weight correction path alongside disputes): `pending_score_player1`/`2`, `pending_set_scores`, `pending_tiebreak_scores`, `pending_match_type`, `pending_winner_id`, `pending_edit_by`.

### `disputes`
`id`, `match_id`, `raised_by`, `reason`, `requested_score_player1`/`2`, `requested_set_scores`, `requested_tiebreak_scores`, `acknowledged_by_player1`/`2`, `resolved_by` (nullable), `resolved_at` (nullable), `status` (`open` | `resolved`).

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
/profile                              → own profile (avatar, details, password)
/players/[id]                         → view another player's profile
/my-match-history, /my-tournament-history
/contact                              → contact form (Nodemailer)
/admin/tournaments (+ /new, /[id])    → create/edit tournaments and their leagues
/admin/tournaments/multi/[tid]        → manage a multi-round tournament, trigger next round
/admin/disputes                       → review and resolve disputes
/admin/users, /admin/users/[id]       → user management (roles, reset password, send reset email)
```

API routes largely mirror this (`/api/register`, `/api/verify-email`, `/api/profile`, `/api/upload-avatar`, `/api/leagues/[id]/*`, `/api/matches`, `/api/matches/[matchId]`, `/api/disputes*`, `/api/admin/*`) plus:
```
/api/cron/complete-leagues     → auto-activate/complete single-format tournaments
/api/cron/cleanup-unverified   → remind/warn/soft-delete unverified accounts
/api/cron/sync-dev-db          → weekly: reset the dev DB branch from prod and anonymize it (see below)
```

---

## Local Dev Database

A separate Neon **branch** (`dev`, id in `NEON_DEV_BRANCH_ID`) exists alongside prod purely for local development, so real member data never needs to be used for testing. It is refreshed and anonymized by `/api/cron/sync-dev-db` (Vercel Cron, weekly, guarded by `CRON_SECRET`):

1. `src/lib/neonApi.ts` calls Neon's Management API to restore the `dev` branch from the `prod` branch's current head — an instant copy-on-write reset, not a row-by-row copy. Refuses to run if `NEON_DEV_BRANCH_ID`/`NEON_PROD_BRANCH_ID` are missing or identical.
2. `src/lib/anonymizeDevDb.ts` then connects (via `DEV_DATABASE_URL`) and scrubs `profiles`: emails become `player{N}@example.test`, names become `Test Player {N}`, all password hashes become the single known dev password (`devpassword123`, exported as `DEV_DATABASE_PASSWORD`), and phone/avatar/verification/reset-token fields are cleared. Refuses to run if `DEV_DATABASE_URL` is unset or equals `DATABASE_URL`, to guard against a misconfigured env var ever anonymizing prod.

To develop locally against this data, point your local `.env.local`'s `DATABASE_URL` (not `DEV_DATABASE_URL`) at the `dev` branch's connection string — `DEV_DATABASE_URL` is only used by the sync job itself. Vercel's production `DATABASE_URL` stays pointed at prod.

**Backups:** Neon's built-in point-in-time restore is currently the only backup for prod data, and the project's History Window is capped at a few hours on the free plan. There is no independent off-database backup (e.g. scheduled `pg_dump` export) yet — treat this as a real gap if/when addressed.

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

### Existing tests (all passing — 38 tests, 7 suites)
| File | Covers |
|---|---|
| `__tests__/components/login.test.tsx` | Login form fields, calls signIn, redirects on success, shows error on failure, disables button while loading |
| `__tests__/components/create-league.test.tsx` | Create-league form: fields, submits correct data to API, shows error on API failure, refreshes page on success |
| `__tests__/components/assign-players.test.tsx` | Assigning players to a league/division |
| `__tests__/api/promotion.test.ts` | `computePromotionMoves` — promotion/relegation math across divisions |
| `__tests__/api/anonymize-dev-db.test.ts` | Dev-DB anonymization: refuses on missing/matching `DEV_DATABASE_URL`, scrubs profiles otherwise |
| `__tests__/api/neon-api.test.ts` | Dev branch reset: refuses on missing/matching branch ids, restores + polls operations to completion, surfaces failed operations |
| `__tests__/api/sync-dev-db-cron.test.ts` | `GET /api/cron/sync-dev-db` — 401 without/wrong `CRON_SECRET`, 200 + correct body on success |

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

## Stretch Features (still not built)
- [ ] Honours on profile page (league winner / runner-up badges by season/year)
- [ ] In-app messaging between members
- [ ] Matchmaking: players post availability for friendly games
- [ ] Strength rating actively computed from H2H results (column exists, nothing populates it yet)
- [ ] Push notifications (score submitted, dispute raised)
- [ ] Public stats page (optional, currently everything behind login)
- [ ] Independent off-database backups for prod (see "Local Dev Database" → Backups above)

---

## Notes

- Auth is fully custom: NextAuth v5 (beta) Credentials provider + JWT sessions, bcryptjs password hashing (`src/auth.ts`). No Supabase, no RLS — access control is enforced in API route handlers (role checks against the session), not database policies.
- Score disputes do NOT block the score from counting - they flag it for review
- Promotion/relegation is calculated at round end but admins can override before it's finalised
- Email uniqueness is enforced case-insensitively at the database level
- Never use em dashes (—) or en dashes (–) anywhere in the UI — always use regular hyphens (-)
