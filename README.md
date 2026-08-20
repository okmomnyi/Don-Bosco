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
- `/funds-finance` — Funds overview. Live figures from the `fund_position`
  view: total raised against `settings.funds_goal` as a percentage, plus
  raised, spent and balance. The itemised expenditure list is deliberately
  **not** published here — see "The ledger" below.
- `/events` — The recurring event types.
- `/privacy`, `/terms` — Privacy policy and terms of use (linked in the footer).

Members (signed in):

- `/portal` — Sign in with phone number + password.
- `/portal/dashboard` — Your running total + your contribution history.
- `/portal/change-password` — Required on first sign-in (temporary password).

Admins (signed in, `role = admin`):

- `/admin/login` — Admin sign-in (members are rejected here).
- `/admin/dashboard` — % of goal, balance, total spent, member count, and
  this month's money in and out.
- `/admin/members` — List / add / edit / deactivate members.
- `/admin/contributions` — Record contributions; void them with a reason.
- `/admin/expenditures` — Record payments out, against the available balance.
- `/admin/statement` — Both directions interleaved with a running balance.
- `/admin/audit` — Who changed what, when, and what it was before.

Members are added, edited, deactivated and issued a fresh temporary password
from `/admin/members`. There is no self-service password reset: the group holds
no email addresses, so a member who is locked out asks an admin, who issues a
new temporary password and reads it to them.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable       | What it is                                                        |
| -------------- | ----------------------------------------------------------------- |
| `POSTGRES_URL` | Vercel Postgres / Neon connection string.                         |
| `JWT_SECRET`   | Session signing secret. **At least 32 characters**, and it must not contain `change-me`. The app refuses to sign or verify a session otherwise, rather than running on a guessable secret. |
| `FUNDS_GOAL`   | (Optional) Target amount in Ksh, used only to seed `funds_goal`.  |
| `NEXT_PUBLIC_SITE_URL` | (Optional) Canonical public URL, used for `metadataBase`, the sitemap and robots. Defaults to the current Vercel deployment; set it once the group has its own domain, or link previews and the sitemap will point at the old address. |
| `CI`           | (Optional) Set to `true` only in automation, to let `create-admin` take the password as an argument instead of prompting. |
| `NEXT_PUBLIC_SITE_URL` | (Optional) The site's canonical public URL, used for canonical links, the sitemap, robots.txt and the OG image. Defaults to the current Vercel deployment. **Set this the moment the group moves onto a real domain** (e.g. a `stmaryschangamwe.org` subdomain) — a canonical pointing at an address that no longer serves the site removes it from search results. |

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

# 1. Create the base tables and seed funds_goal.
npm run db:init

# 2. Apply the migrations, in this order. 003 depends on 002 having run.
npm run db:migrate -- sql/002_auth_hardening.sql
npm run db:migrate -- sql/003_ledger.sql
npm run db:migrate -- sql/004_void_constraint.sql

# 3. Create the first admin (bootstrap — afterwards add admins from the panel).
#    The password is prompted for, not passed as an argument.
npm run create-admin -- "Your Name" "0712345678"

# 4. Run it.
npm run dev          # http://localhost:3000
```

Every one of these is safe to re-run: `db:init` uses `IF NOT EXISTS` /
`ON CONFLICT DO NOTHING`, and both migrations are idempotent — `003` skips its
backfill entirely once `contributions` has been renamed. They all read
`POSTGRES_URL` from `.env.local`.

### Migration order

| File | What it does |
| ---- | ------------ |
| `sql/002_auth_hardening.sql` | Adds `users.token_version` (session revocation) and `users.temp_password_expires_at`, and creates `login_attempts` for rate limiting. Additive only. |
| `sql/003_ledger.sql` | Creates `ledger_entries` and its views, copies every `contributions` row across, then renames `contributions` to `contributions_legacy`. |
| `sql/004_void_constraint.sql` | Corrects a CHECK from 003 that made any user who had voided an entry impossible to delete. |

**`003` is a breaking change for any code still reading `contributions`.** Run
it as part of the same cutover that deploys the ledger-aware code, not hours
ahead of it, or the money pages will error in between.

`contributions_legacy` is left in place untouched as the rollback path. **Drop
it by hand after about a week of clean running**, once the ledger figures have
been checked against it and nobody has needed to look back:

```sql
-- only after a week of the ledger running correctly
DROP TABLE contributions_legacy;
```

## Search and sharing

Public pages carry their own title, description and canonical URL; everything
behind a sign-in sends `robots: noindex` **and** redirects unauthenticated
visitors, so members' names and figures cannot be indexed.

`lib/site.ts` holds the facts about the group and the parish in one place, and
builds the schema.org JSON-LD from them: the group is an `Organization` whose
`parentOrganization` is `St. Mary's Catholic Church Changamwe`, whose parent in
turn is the `Roman Catholic Archdiocese of Mombasa`. That chain is what lets a
search engine connect this site to the parish rather than to any other
St. Mary's.

The parish details (address, coordinates, the archdiocese) were taken from
stmaryschangamwe.org, the parish's own site. **Nothing in that file is
invented** — structured data is presented to users as fact, so a guessed
address or phone number is worse than none. The parish's phone and email are
deliberately not duplicated here: the parish site is the authority for them.

Update `CONTENT_LAST_UPDATED` in `app/sitemap.ts` when page copy actually
changes.

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
- `lib/auth.ts` — re-exports the above plus `getCurrentUser` / `checkAdmin` /
  `requireAdmin` (Node runtime; reads the cookie and the DB).
- `lib/rate-limit.ts` — login attempt counting (Node runtime; DB access, so it
  must never be imported from middleware).
- `lib/ledger.ts` — **all** money logic: validation, the transactional writes,
  and audit logging. Route handlers parse and authorise; they do not do
  arithmetic and do not touch `ledger_entries` directly.
- API routes live under `app/api/auth/*` and `app/api/admin/*`. Admin routes
  call `checkAdmin()` themselves (middleware only matches pages, not
  `/api/admin/*`).

Sessions carry a `tokenVersion` claim that is checked against
`users.token_version` in `getCurrentUser`. Changing a password, a role, or
deactivating someone increments the column, which invalidates every token
already issued for them. `middleware.ts` cannot make that check — it has no
database access on the Edge runtime — so middleware stays a cheap first pass and
`getCurrentUser` is the real gate. That split is deliberate; don't move the
check into middleware.

Everything is request/serverless-friendly — no cron jobs or background workers,
so it deploys to Vercel as-is.

## The ledger

Money used to be a one-directional list: a `contributions` table, summed
independently in six different places. That works right up until money flows
back out, at which point every one of those six figures is a gross inflow total
being presented as though it were a balance.

`ledger_entries` replaces it. A contribution and a payment are the same shape of
row, told apart by `kind`. `amount` is always positive and the direction lives
in a generated column:

```sql
signed_amount NUMERIC(12,2) GENERATED ALWAYS AS
  (CASE WHEN kind = 'contribution' THEN amount ELSE -amount END) STORED
```

so the balance is `SUM(signed_amount)` and no application code can get the sign
wrong. Two CHECK constraints keep the kinds structurally distinct: a
contribution must name a member and must not name a payee, an expenditure the
reverse. That makes it impossible to record spending against a member's
`user_id`, which would otherwise quietly reduce their contribution total and
read as though they had taken money back.

Nothing is ever deleted. `user_id` and `project_id` are `ON DELETE RESTRICT`, so
the database refuses to remove a member or a project that has money against it,
and there is **no DELETE handler on any ledger route**. Corrections are made by
voiding the wrong entry with a mandatory reason and recording the right one.

Reports read the views, never the base table:

| View | What it gives you |
| ---- | ----------------- |
| `ledger_live` | Every non-voided entry. Everything else builds on this, so "forgot to exclude voided rows" can't happen. |
| `fund_position` | One row: `total_raised`, `total_spent`, `balance`. |
| `project_totals` | `raised` / `spent` / `net` per project. |
| `member_totals` | Per-member contribution totals — contributions only, so group spending can never reduce someone's figure. |

`audit_log` records actor, action, entity and before/after JSON, written in the
same transaction as the change itself, and is readable at `/admin/audit`.

Money is `NUMERIC` in the database and stays a **string** in JavaScript. It is
summed and compared in SQL, never parsed into a float — a cent of drift across a
few hundred rows would make a member's total disagree with the admin's, which in
this system matters far more than its size suggests.

## Database schema

```sql
users(id, name, phone UNIQUE, password_hash, role['member'|'admin'],
      must_change_password, active, created_at,
      token_version, temp_password_expires_at)

ledger_entries(id, kind['contribution'|'expenditure'], amount, signed_amount,
      user_id→users ON DELETE RESTRICT,     -- contributions only
      payee, category,                       -- expenditures only
      project_id→projects ON DELETE RESTRICT,
      method['cash'|'mpesa'|'bank'|'other'], reference, date, notes,
      recorded_by→users ON DELETE SET NULL, approved_by→users ON DELETE SET NULL,
      idempotency_key UNIQUE WHERE NOT NULL,
      voided_at, voided_by→users, void_reason, created_at)

projects(id, name UNIQUE, target_amount, active, created_at)
expense_categories(id, name UNIQUE, active, created_at)
audit_log(id, actor_id→users, action, entity, entity_id, before, after, at)
login_attempts(id, phone, ip, successful, at)
settings(key PRIMARY KEY, value)   -- seeded: ('funds_goal', '<amount>')

contributions_legacy(...)   -- the pre-ledger table, kept for rollback only
```

Time zone: the group is in **Africa/Nairobi (UTC+3)** and Vercel runs in UTC.
Anything asking "today" or "this month" says so explicitly — `todayInNairobi()`
in `lib/ledger.ts`, and `date_trunc('month', (now() AT TIME ZONE
'Africa/Nairobi')::date)` in SQL. A bare `CURRENT_DATE` or `toISOString()` is
wrong for the first three hours of every Nairobi day.

## Migration from the old spreadsheet

A one-time import of the existing Excel/Sheet export into `users` +
`contributions` is **planned but not yet built** (the spreadsheet's exact column
layout needs confirming first). Once done, the spreadsheet is retired and the
admin panel becomes the only ongoing write path.

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel (Next.js auto-detected).
2. Attach a Postgres store and add the `JWT_SECRET` env var.
3. Run `npm run db:init`, then the migrations in order, then
   `npm run create-admin` against the production database (locally with
   `POSTGRES_URL` pointed at production), then deploy. Run `003_ledger.sql` and
   the deploy together — see "Migration order" above.
