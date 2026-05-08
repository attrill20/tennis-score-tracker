# QPTC Score Tracker — Claude.md

## Project Overview

A web app for Queen's Park Tennis Club (QPTC) to manage singles leagues, track scores, and handle promotion/relegation. Built mobile-first but fully responsive. Everything is behind a login.

**Repo name:** `qptc-score-tracker`
**Deployment:** Vercel
**Database:** Supabase (PostgreSQL + Auth)

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR, API routes, works natively with Vercel |
| Language | TypeScript | User expanding from JS/React |
| Styling | Tailwind CSS | Mobile-first utility classes, fast to build with |
| Auth | Supabase Auth | Handles hashed passwords, JWTs, sessions |
| Database | Supabase (PostgreSQL) | Auth + DB in one platform |
| Deployment | Vercel | One-click from GitHub |

> Note on React Native: Business logic kept in custom hooks and utility functions so a future React Native port is feasible. Components kept thin.

---

## Database Schema

### `profiles` (extends Supabase auth.users)
- `id` (uuid, FK → auth.users)
- `full_name` (text)
- `role` (enum: `super_admin` | `admin` | `member`)
- `strength_rating` (numeric, nullable — stretch feature)
- `created_at` (timestamptz)

### `leagues`
- `id` (uuid)
- `name` (text)
- `season_start` (date)
- `season_end` (date)
- `status` (enum: `upcoming` | `active` | `completed`)
- `created_by` (uuid, FK → profiles)
- `created_at` (timestamptz)

### `league_players`
- `id` (uuid)
- `league_id` (uuid, FK → leagues)
- `player_id` (uuid, FK → profiles)
- `final_position` (int, nullable — set at end of season)

### `matches`
- `id` (uuid)
- `league_id` (uuid, FK → leagues)
- `player1_id` (uuid, FK → profiles)
- `player2_id` (uuid, FK → profiles)
- `submitted_by` (uuid, FK → profiles)
- `score_player1` (int) — sets won by player1
- `score_player2` (int) — sets won by player2
- `status` (enum: `confirmed` | `disputed` | `overridden`)
- `played_at` (date)
- `submitted_at` (timestamptz)

### `disputes`
- `id` (uuid)
- `match_id` (uuid, FK → matches)
- `raised_by` (uuid, FK → profiles)
- `reason` (text)
- `resolved_by` (uuid, FK → profiles, nullable)
- `resolved_at` (timestamptz, nullable)
- `status` (enum: `open` | `resolved`)

---

## Role System

| Role | Capabilities |
|---|---|
| `super_admin` | Everything — only James. Can promote/demote others to `admin` |
| `admin` | Create/edit leagues, assign players, override scores, handle disputes, trigger promotion/relegation |
| `member` | Submit scores, dispute scores, view tables |

---

## League Rules

- 6–8 players per league
- Each player plays each other once per season
- Scoring: sets won (e.g. 2-1, 2-0)
- League table ranked by: wins → sets won → head-to-head
- End of season: top 2 promoted, bottom 2 relegated (auto), admin can override

---

## Score Flow

1. Either player submits the result (sets won each)
2. Score is **immediately live** in the table
3. The opposing player can click "Dispute" — raises a dispute record
4. Admin reviews and can overwrite the score at any time
5. Admin marks dispute as resolved

---

## Pages / Routes

```
/                      → redirect to /dashboard (if logged in) or /login
/login                 → Supabase Auth login
/register              → New member registration
/dashboard             → Overview: active leagues, recent results
/leagues               → List of all leagues
/leagues/[id]          → League detail: table + fixtures + results
/leagues/[id]/submit   → Submit a score for a match
/admin                 → Admin panel (admin/super_admin only)
/admin/leagues         → Create/edit leagues, assign players
/admin/disputes        → Review and resolve disputes
/admin/users           → super_admin only: manage roles
/profile/[id]          → Player profile (future: strength rating, H2H)
```

---

## MVP Feature Checklist

### Phase 1 — Foundation
- [ ] Next.js + TypeScript project scaffold
- [ ] Tailwind CSS setup
- [ ] Supabase project created and connected
- [ ] Environment variables configured (.env.local)
- [ ] Database schema created in Supabase
- [ ] Row Level Security (RLS) policies set up
- [ ] GitHub repo created and connected

### Phase 2 — Auth
- [ ] Login page (Supabase Auth)
- [ ] Register page (creates profile row on signup)
- [ ] Route protection (redirect to /login if not authenticated)
- [ ] Session handling via Supabase SSR helpers

### Phase 3 — Core League Features
- [ ] League list page
- [ ] League detail page with table and fixtures
- [ ] Score submission form
- [ ] Score dispute button (for opposing player)
- [ ] League table calculation logic (wins, sets, H2H)

### Phase 4 — Admin Panel
- [ ] Create and edit leagues
- [ ] Assign players to leagues
- [ ] Override scores
- [ ] Resolve disputes
- [ ] Trigger / confirm promotion & relegation
- [ ] User role management (super_admin only)

---

## Stretch Features (post-MVP)
- [ ] Profile pictures (upload photo; default to first-letter avatar in a circle)
- [ ] Honours on profile page (league winner / runner-up badges by season/year)
- [ ] In-app messaging between members
- [ ] Matchmaking: players post availability for friendly games
- [ ] Strength rating per player based on H2H results
- [ ] Doubles league support
- [ ] Push notifications (score submitted, dispute raised)
- [ ] Public stats page (optional, currently everything behind login)

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # server-side only, never expose to client
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

### Existing tests (all passing)
| File | Tests |
|---|---|
| `__tests__/components/login.test.tsx` | Renders fields, calls signIn, redirects on success, shows error on failure, disables button while loading |
| `__tests__/components/create-league.test.tsx` | Renders fields, submits correct data to API, shows error on API failure, refreshes page on success |

### Rules
- **Run `npm test` before every commit** and confirm all tests pass before proceeding.
- **When a new feature is built**, prompt James to write tests covering it before moving on. Suggest specific test cases based on the feature's behaviour.
- Labels in forms **must** have `htmlFor` matching the input's `id` — required for both accessibility and `getByLabelText` in tests.

---

## Notes

- All auth flows use Supabase's built-in email/password provider
- RLS policies enforce that members can only see/submit their own match data — admins bypass via service role where needed
- Score disputes do NOT block the score from counting - they flag it for review
- Promotion/relegation is calculated at season end but admins can override before it's finalised
- Never use em dashes (—) or en dashes (–) anywhere in the UI — always use regular hyphens (-)
