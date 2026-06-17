# St. Mary's Senior Youth — Website & Member Portal

The website for the Don Bosco Senior Youth group, Changamwe Parish. Built with
**Next.js 14 (App Router)** + **Tailwind CSS**, deployed on **Vercel** with
**Vercel Postgres (Neon)**.

Members sign in to see **only their own** contribution history; a small admin
panel manages members and records contributions. This replaces the old workflow
where anyone could look up anyone's record from a shared spreadsheet.

## Design

- **Palette**: paper `#F2F5F4`, ink `#1E3434`, deep `#16242A`, coral `#FF8552`,
  gold `#FFD56B`, sage `#6E8C7C` — a "dawn / horizon" theme.
- **Type**: Fraunces (display), Inter (body), IBM Plex Mono (labels, schedules,
  money/ledger figures).
- **Signature element**: the horizon line / sun mark (`components/Horizon.tsx`).
- **Light / dark mode**: a toggle in the navbar (`components/ThemeToggle.tsx`).
  `paper` (surfaces) and `ink` (text) are CSS variables in `app/globals.css`
  that flip on a `.dark` class; brand tokens (`deep`, `coral`, `gold`, `sage`)
  stay fixed, and `cream` is the always-light text/buttons that sit on dark
  surfaces. The choice persists in `localStorage` and an inline script in the
  layout applies it before paint (no flash). Defaults to the OS preference.

## Pages

Public:

- `/` — Home: motto, mission, vision.
- `/values-membership` — Membership requirements, rights, values, termination.
- `/funds-finance` — Funds overview. The progress figure is now **live**:
  `SUM(contributions.amount) / settings.funds_goal × 100`.
- `/events` — The recurring event types.
- `/privacy`, `/terms` — Privacy policy and terms of use (linked in the footer).

Members (signed in):

- `/portal` — Sign in with phone number + password.
- `/portal/dashboard` — Your running total + your contribution history.
- `/portal/change-password` — Required on first sign-in (temporary password).

Admins (signed in, `role = admin`):

- `/admin/login` — Admin sign-in (members are rejected here).
- `/admin/dashboard` — Member count, contributions this month, % of goal.
- `/admin/members` — List / add / edit / deactivate members.
- `/admin/contributions` — Record, edit and delete contributions.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable       | What it is                                                        |
| -------------- | ----------------------------------------------------------------- |
| `POSTGRES_URL` | Vercel Postgres / Neon connection string.                         |
| `JWT_SECRET`   | Long random string used to sign session cookies.                  |
| `FUNDS_GOAL`   | (Optional) Target amount in Ksh, used only to seed `funds_goal`.  |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

On Vercel, attach a Postgres store (it sets `POSTGRES_URL` for you) and add
`JWT_SECRET` in the project's Environment Variables. Locally, after linking the
project you can run `vercel env pull .env.local`.

## First-time setup

```bash
npm install

# 1. Create the tables (users, contributions, settings) and seed funds_goal.
npm run db:init

# 2. Create the first admin (bootstrap — afterwards add admins from the panel).
npm run create-admin -- "Your Name" "0712345678" "choose-a-password"

# 3. Run it.
npm run dev          # http://localhost:3000
```

`db:init` is safe to re-run (every statement uses `IF NOT EXISTS` /
`ON CONFLICT DO NOTHING`). Both scripts read `POSTGRES_URL` from `.env.local`.

## How sign-in works

- **Phone numbers are the login identifier** and are normalised to
  `+254XXXXXXXXX` everywhere (`lib/crypto.ts → normalizePhone`), so
  `0712345678`, `712345678`, `254712345678` and `+254 712 345 678` all match the
  same account.
- Passwords are bcrypt-hashed (`bcryptjs`). A session is a JWT (`jose`) stored in
  an httpOnly, secure cookie. `middleware.ts` gates `/portal/dashboard*`,
  `/portal/change-password` (any signed-in user) and `/admin*` (admins only).

### Members

1. An admin adds the member, which generates a **temporary password** shown once.
2. The admin shares the phone number + temp password with the member.
3. The member signs in at `/portal`, is sent to `/portal/change-password`, sets
   their own password, then lands on their dashboard.

### Admins

Sign in at `/admin/login`. Member accounts are rejected there with a message
pointing them to the Member Portal.

## Architecture notes

- `lib/db.ts` — `@vercel/postgres` wrapper + row types.
- `lib/session.ts` — Edge-safe JWT sign/verify (imported by `middleware.ts`; no
  DB or bcrypt, so it runs on the Edge runtime).
- `lib/crypto.ts` — bcrypt + phone normalisation (pure; safe for scripts).
- `lib/auth.ts` — re-exports the above plus `getCurrentUser` / `requireAdmin`
  (Node runtime; reads the cookie and the DB).
- API routes live under `app/api/auth/*` and `app/api/admin/*`. Admin routes
  call `requireAdmin()` themselves (middleware only matches pages, not
  `/api/admin/*`).

Everything is request/serverless-friendly — no cron jobs or background workers,
so it deploys to Vercel as-is.

## Database schema

```sql
users(id, name, phone UNIQUE, password_hash, role['member'|'admin'],
      must_change_password, active, created_at)
contributions(id, user_id→users, amount, type['subscription'|'dominica'|
      'project'|'other'], date, recorded_by→users, notes, created_at)
settings(key PRIMARY KEY, value)   -- seeded: ('funds_goal', '<amount>')
```

## Migration from the old spreadsheet

A one-time import of the existing Excel/Sheet export into `users` +
`contributions` is **planned but not yet built** (the spreadsheet's exact column
layout needs confirming first). Once done, the spreadsheet is retired and the
admin panel becomes the only ongoing write path.

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel (Next.js auto-detected).
2. Attach a Postgres store and add the `JWT_SECRET` env var.
3. Run `npm run db:init` and `npm run create-admin` against the production
   database (locally with `POSTGRES_URL` pointed at production, or via a Vercel
   shell), then deploy.
