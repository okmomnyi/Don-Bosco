# Security, correctness and ledger work

Every finding from `docs/SECURITY-AUDIT.md`, and where it was addressed. The
work ran in six gated phases, then a follow-up round for the deferred items and
the production-readiness gaps — see "Follow-up round" near the end.

Verification: `npx tsc --noEmit` clean, `npm run build` succeeds, and
`npm audit --production` reports 2 high, both of which need a Next.js major
bump (see C1).

---

## Critical

| ID | Finding | Where |
| -- | ------- | ----- |
| **C1** | Next.js 14.2.5 vulnerable to middleware auth bypass (CVE-2025-29927) | `package.json` — upgraded to `next@14.2.35` + `eslint-config-next@14.2.35`, pinned exactly. CVE-2025-29927 (fixed 14.2.25) and CVE-2024-51479 (fixed 14.2.15) are both closed. |
| **C2** | Temporary passwords predictable and never expire | `lib/crypto.ts` — `generateTempPassword()` now uses `randomBytes(10)` over a 32-symbol unambiguous alphabet (no `l`/`1`/`o`/`0`), a 32^10 keyspace instead of 9,000, from a CSPRNG instead of `Math.random()`. 32 divides 256 evenly so `byte % 32` is unbiased. Expiry: `sql/002_auth_hardening.sql` adds `temp_password_expires_at`, `app/api/admin/members/route.ts` sets it 7 days out on issue, and `app/api/auth/login/route.ts` refuses an expired one — **after** verifying the password, so the expiry state isn't discoverable by an outsider. |
| **C3** | Deleting a member destroys their financial history | `sql/003_ledger.sql` — `ledger_entries.user_id` is `ON DELETE RESTRICT`, so the database itself refuses. `app/api/admin/members/[id]/route.ts` catches `23503` and returns a 409 telling the admin to deactivate instead. There is no DELETE handler anywhere on the ledger. Verified: `DELETE users` on a member with entries is refused by `ledger_entries_user_id_fkey`. |

## High

| ID | Finding | Where |
| -- | ------- | ----- |
| **H1** | No rate limiting on authentication | `lib/rate-limit.ts` + `login_attempts` in `sql/002_auth_hardening.sql`. 8 failures per phone / 30 per IP in a 15-minute window, 429 with a message identical either way so it doesn't reveal which limit tripped. Applied to `app/api/auth/login/route.ts` and `app/api/auth/change-password/route.ts`. Verified: nine wrong passwords → the ninth returns 429. |
| **H2** | User enumeration by response timing | `app/api/auth/login/route.ts` — a module-level dummy hash, generated at import from `randomBytes(32)` at the same cost factor, is compared against when the phone isn't registered, so both paths pay the same bcrypt cost. 401 body unchanged. The residual signal from legacy cost-10 hashes (an old account verifying in ~90ms against ~370ms for a new or non-existent one) is closed by the re-hash-on-login in L4. |
| **H3** | Password change needs no current password and revokes nothing | `app/api/auth/change-password/route.ts` — `currentPassword` is required and verified, skipped only when `must_change_password` is true (the temp password was presented at login moments earlier). `token_version` is incremented on change and embedded in the JWT; `lib/auth.ts → getCurrentUser` compares the two. Verified across two browsers: changing the password in one signs the other out on its next request. |
| **H4** | `JWT_SECRET` unchecked, no issuer/audience | `lib/session.ts` — rejects a secret that is missing, under 32 characters, or contains `change-me`, with `init-db.ts`-style messages. Tokens are signed and verified with issuer `don-bosco` and audience `don-bosco-app`. |
| **H5** | Last-admin lockout; self-demotion guard bypassable | `app/api/admin/members/[id]/route.ts` — role validated against an explicit `["admin","member"]` allowlist (closing the `{"role":"x"}` bypass), and any demotion or deactivation is refused if it would leave zero active admins, not just when it is self-inflicted. |
| **H6** | No audit trail on financial or destructive actions | `sql/003_ledger.sql` creates `audit_log`; `lib/ledger.ts` writes actor, action, entity, before/after **inside the same transaction** as the mutation. `app/admin/audit/page.tsx` renders it as a field-level diff, most recent first. |
| **H7** | No security headers | `next.config.mjs` — `poweredByHeader: false` plus `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and a CSP with `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`. |

## Medium

| ID | Finding | Where |
| -- | ------- | ----- |
| **M1** | Multi-statement PATCH not transactional | `app/api/admin/contributions/[id]/route.ts` **deleted** — corrections are void + re-record, and every ledger write is a single transaction in `lib/ledger.ts`. `app/api/admin/members/[id]/route.ts` PATCH is now one transaction around a single `UPDATE … SET` with `COALESCE`, with `SELECT … FOR UPDATE` first and an `audit_log` row written inside it. Verified: a name+role+active change applies together, and a call that hits the phone unique constraint rolls back leaving the row untouched. |
| **M2** | `date` never validated | `lib/ledger.ts → parseDate` — strict `YYYY-MM-DD`, round-tripped through `Date` to catch `2026-02-31`, floored at 2015-01-01, and rejected if in the future. Applied to writes and to the `from`/`to` filters. |
| **M3** | Amount bounds unenforced | `lib/ledger.ts → parseAmount` — validates the **textual** form with `/^\d{1,10}(\.\d{1,2})?$/`, which rejects `"1e7"`, negatives and third decimal places that a post-`Number()` check cannot catch. Backed by a `CHECK (amount > 0 AND amount <= 99999999.99)` in the schema. |
| **M4** | Money summed in JavaScript floats | `app/portal/dashboard/page.tsx` reads the total from `member_totals` as a string. More broadly, `parseAmount` returns a string and both balance checks compare in SQL against `NUMERIC` — money is never an IEEE-754 float anywhere in the write path. |
| **M5** | ILIKE wildcards unescaped | `lib/ledger.ts → escapeLike` + `ESCAPE '\'` in the contributions, expenditures and ledger routes. Verified: searching `%` returns 0 rows, not all 158. |
| **M6** | `must_change_password` not enforced server-side | `lib/auth.ts → checkAdmin` refuses such an account and returns a distinct reason; API routes answer 403 with `code: "PASSWORD_CHANGE_REQUIRED"` and a `redirectTo`, admin pages redirect to `/portal/change-password`. Verified. |
| **M7** | Deleting a project silently orphans its money | `project_id` is `ON DELETE RESTRICT`; `app/api/admin/projects/[id]/route.ts` catches `23503` → 409 "This project has money recorded against it. Hide it instead of deleting." |
| **M8** | `recorded_by` has no `ON DELETE` action | `sql/003_ledger.sql` — `recorded_by`, `approved_by` and `voided_by` are all `ON DELETE SET NULL`. |
| **M9** | 6-character password minimum | Raised to 10 in `app/api/auth/change-password/route.ts`, `components/ChangePasswordForm.tsx` and `scripts/create-admin.ts`. A new password equal to the current one is rejected. The 72-byte bcrypt truncation is noted in `lib/crypto.ts`. |
| **M10** | Sessions fixed-lifetime with no revocation | Same mechanism as H3. A demotion or deactivation now takes effect on the user's next request rather than in up to two hours. |
| **M11** | Cookie hardening (`sameSite: "strict"`, `__Host-` prefix) | `lib/session.ts` — one `SESSION_COOKIE_OPTIONS` shared by login, logout and change-password so they cannot drift. `sameSite: "strict"`, and the cookie is named `__Host-session` in production. The prefix requires Secure, which plain-http local development does not have, so the name falls back to `session` when `NODE_ENV !== "production"`. Verified against a real production build: `__Host-session=…; Path=/; Secure; HttpOnly; SameSite=strict`, no Domain. |
| **M12** | No idempotency on contribution recording | `idempotency_key` with a unique partial index in `sql/003_ledger.sql`; both `ContributionsManager` and `ExpendituresManager` generate a `crypto.randomUUID()` per entry and regenerate after each success. Verified: a repeat POST with the same key returns 409. |

## Low

| ID | Finding | Where |
| -- | ------- | ----- |
| **L1** | Password on `argv` lands in shell history | `scripts/create-admin.ts` prompts on a raw-mode TTY with echo disabled (handling backspace, Ctrl-C, Ctrl-D), reads one line when stdin is a pipe, and **refuses** an argv password unless `CI=true`. |
| **L2** | No pagination | **Not done** — explicitly out of scope. Partly mitigated: every list endpoint returns `shown` alongside `count`, so the UI states when it is truncating. |
| **L3** | Missing indexes on `contributions(date)` | `sql/003_ledger.sql` — partial indexes on `(user_id, date)`, `(project_id, date)`, `(date, id)` and `(kind)`, each `WHERE voided_at IS NULL` to match how the views read. |
| **L4** | bcrypt cost 10 | `lib/crypto.ts` — `SALT_ROUNDS = 12` (measured ~370ms per hash), plus `needsRehash()`. `app/api/auth/login/route.ts` re-hashes on a successful sign-in when the stored cost is lower, which is the only moment the plaintext is available. Failure there is logged and swallowed so it can never block a valid login. Verified: a cost-10 account signs in, the stored hash becomes cost 12, and the same password still works. |
| **L5** | `/funds-finance` is public; confirm before publishing spending | Decided deliberately: the public page shows raised, spent and balance as three totals and per-project progress. It does **not** publish the itemised expenditure list — naming payees and amounts exposes suppliers and invites outsiders to second-guess individual purchases. The itemised statement is behind `/admin/statement`. |
| **L6** | Errors re-thrown raw with no structured logging | `lib/ledger.ts → errorResponse` maps `23503` / `23505` / `23514` to messages a treasurer can act on, and logs anything else server-side while returning a generic message to the client. |

## Functional bugs

| ID | Finding | Where |
| -- | ------- | ----- |
| **B1** | Admin contributions list permanently empty | `app/api/admin/contributions/route.ts` — the optional `projectId` filter now guards on the raw string being truthy and requires `> 0`, instead of `Number(null) === 0` applying `project_id = 0` to every request. Centralised afterwards as `parseOptionalId` in `lib/ledger.ts`. Verified end to end: 158 entries, Ksh 17,419.98, 100 rows listed. |
| **B2** | "Today" computed in UTC, not Nairobi | `lib/ledger.ts → todayInNairobi()` for the date picker default; `date_trunc('month', (now() AT TIME ZONE 'Africa/Nairobi')::date)` for the dashboard's month. |
| **B3** | Clearing a project during an edit silently ignored | **Superseded.** The edit flow no longer exists — corrections are void + re-record, per the ledger design — so there is no PATCH in which a cleared project can be dropped. |
| **B4** | Legacy `type` labels render `undefined` | `app/portal/dashboard/page.tsx` and `components/ContributionsManager.tsx` — `project_name ?? category ?? "Other"`. |
| **B5** | Deactivated members disappear from the form permanently | `components/ContributionsManager.tsx` keeps inactive members in the picker, sorted below active ones and tagged `inactive`, so a contribution recorded against a since-deactivated member can still be corrected. |
| **B6** | `type` required by the schema but treated as vestigial | Retired. `ledger_entries` has no `type`; the legacy values were carried across into `category` by the backfill, and new contributions are categorised by project. |
| **B7** | Totals cover the full match set, list stops at 100 | Every list endpoint returns `shown` next to `count`; the UI appends "· showing 100" when they differ. |

---

## Deliberately not done

**M11 — cookie hardening.** Not in the six-phase scope. `sameSite: "lax"` →
`"strict"` is a one-line change with no downside here (there is no cross-site
entry flow). The `__Host-` prefix requires renaming the cookie, which signs
everyone out on deploy — worth pairing with a release where that is acceptable.

**L2 — pagination.** Explicitly out of scope.

**CSP nonce migration.** Explicitly out of scope. `script-src` still needs
`'unsafe-inline'` for the theme script in `app/layout.tsx`; there is a
`TODO(csp-nonce)` in `next.config.mjs` naming the follow-up. Not an XSS vector
today — the script is a static literal with no interpolation.

**Dropping `contributions_legacy`.** Explicitly out of scope, and it is the
rollback path. Drop it by hand after about a week of clean running.

**Automated tests.** Explicitly out of scope. Every gate in this work was
verified by hand against the live database instead; the results are in the
phase reports.

## Known gaps

**The contributions form doesn't collect `method` or `reference`.** The ledger
stores both and the API accepts both, and the expenditures form collects them —
so a treasurer can record an M-Pesa code for money out but not for money in, and
every contribution is stored as `cash`. About fifteen lines in
`ContributionsManager` to fix.

**One audit row has a shifted date.** `RETURNING date` handed back a driver
`Date` object rather than a string, so the audit entry for ledger entry #169
records `2026-08-18T21:00:00.000Z` for an entry dated 2026-08-19. Fixed in
`lib/ledger.ts` (all `RETURNING`/`SELECT` clauses now use `date::text`); the one
row already written still carries the shifted value. It belongs to a voided test
entry, so nothing real depends on it.

**Password trimming is asymmetric.** `change-password` trims the new password
before hashing; `login` does not trim on the way in. Set a password with a
trailing space and you cannot sign in with what you typed. Pre-existing, not in
scope, unchanged.

## Follow-up round

After the six phases, a second pass covered the deferred items and the
production-readiness gaps:

- **Temporary-password reset** — `PATCH /api/admin/members/[id]` accepts
  `resetPassword: true`, issuing a CSPRNG temporary password with a 7-day
  expiry, bumping `token_version` so existing sessions die, and returning the
  password exactly once. "Reset password" sits beside the existing row actions
  in `MembersManager`. An admin cannot reset their own password this way — that
  would sign them out and hand them a password meant for somebody else. This is
  what makes rotating the members still on `youth-NNNN` passwords possible.
- **Re-hash on login (L4)** and **cookie hardening (M11)** — see the tables above.
- **`sql/004_void_constraint.sql`** — fixes a contradiction shipped in 003.
  `voided_by` is `ON DELETE SET NULL` while the CHECK was a biconditional
  `(voided_at IS NULL) = (voided_by IS NULL)`, so deleting any user who had ever
  voided an entry failed with a 23514 and the account became undeletable. The
  constraint now enforces the direction that matters — no void metadata on an
  entry that is not voided — and tolerates the voider's identity being lost when
  an account is removed. `void_reason` and the `audit_log` row still stand.
- **Audit coverage extended to member changes** — `user.update` and
  `user.reset_password` rows are written inside the same transaction, with the
  password hash never included in the before/after payloads.
- **Production polish** — `app/icon.svg` (the group's own sun-over-horizon mark,
  in the brand gradient), `app/opengraph-image.tsx` via `next/og` (no new
  dependency), `app/not-found.tsx` in the site's design, `app/robots.ts`
  disallowing the portal and admin areas, `app/sitemap.ts` for the public pages,
  and `metadataBase` + OpenGraph/Twitter metadata in the layout. The OG route
  runs on the edge runtime because the Node build of `@vercel/og` resolves its
  bundled font through `fileURLToPath`, which throws on a Windows path
  containing spaces or brackets.
- **Dependencies** — `next` 14.2.35, `postcss` 8.5.26, `autoprefixer` 10.5.4,
  and `npm audit fix` for `nanoid`. Production advisories: 3 high → 2 high, both
  requiring a Next.js major bump.
- **Data cleanup** — placeholder admin #1 "Your Name" and the gate test account
  #53 deleted; `docs/` added to `.gitignore`.

## Test residue in production

Gate verification was run against the live database with the owner's approval
and a snapshot in place. What it left behind:

- **Ledger entry #169** — a Ksh 1,250.75 test expenditure, voided with the
  reason "Gate 5 verification". Excluded from every total. Deliberately left:
  deleting rows from the ledger is the one thing this design exists to prevent,
  and making an exception for "my own test data" is how that guarantee starts to
  erode. Its `recorded_by` and `voided_by` are NULL now, since the account that
  made it was deleted.
- **2 `audit_log` rows** — that entry's creation and its void, with `actor_id`
  NULL for the same reason.
- **`login_attempts` rows** — from the rate-limit tests, against phone numbers
  that belong to nobody.

The test accounts themselves (#53, and the throwaways used for the follow-up
round) have all been deleted.

Financial data was untouched throughout: 158 contributions totalling
Ksh 17,419.98 before the work, and the same after.
