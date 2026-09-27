# Unified role-based portal (officer / exchange / citizen) + backlog cleanup

**Date:** 2026-09-27
**Status:** approved by user, ready for implementation plan

## Why this exists

The user wants KAIZEN to operate on real wallet addresses in production, and to unify three
audiences behind one login: police officers, exchange (VASP) compliance contacts, and citizens
filing a complaint — plus a guest path for citizens with no account. Today these are three
disconnected surfaces: officer login (JWT via a separate auth microservice), a public
token-link VASP portal (no login at all), and no citizen-facing surface whatsoever. This spec
also folds in 5 previously-flagged backlog items that touch the same code paths.

## What's being fixed/built, in one list

1. **Real-address compliance fix**: `seed_labels.py`'s placeholder entry uses the actual USDT-TRC20
   token contract address, not a fake one — replace with a clearly-synthetic placeholder address.
2. **Inverted Deposit Index Task B**: wire `lookup_indexed_deposit()` into the live trace path.
3. **Docker Compose live smoke test**: run `docker compose up --build` against a real engine —
   deferred to whenever Docker Desktop is running; not blocking the rest of this work.
4. **Notice-drafting UI**: a real frontend page/flow for `POST /api/v1/legal/notices`, gated by
   the innocence check that already exists server-side.
5. **6 minor whole-branch-review items**: `tracer.py`'s stale `since`-not-passed comment/bug,
   `unreportedVictims: []` ambiguity, and the others listed in `docs/TASKS.md` P1.6.
6. **Root cause of "cntcitachi@gmail.com not getting an OTP code"**: that email was never seeded
   into the Lighthouse Auth API's `kaizen` tenant — VASP/exchange access has only ever used the
   separate, login-free `access_token` portal link. There is nothing broken in the mailer; the
   email simply has no `UserAuth` row, so `request_otp` silently no-ops (anti-enumeration design).
   Fixing this *is* the unification work below, not a bug patch.
7. **The unified role-based portal** (the bulk of the work) — detailed below.

## Architecture decisions

### Identity vs. role: two different services, on purpose

`E:/API` ("Lighthouse Auth API") is a **shared** microservice used by other tenants besides
KAIZEN. It already does exactly one job well: prove "this email received and entered a code we
just sent it," and mint a JWT with `{user_id, tenant_id, email, exp}` — no role. We will **not**
add a KAIZEN-specific role column to its shared schema. Instead:

- **E:/API stays identity-only.** We reuse its existing, working `seed_kaizen_tenant.py` script
  to seed the *additional* emails this feature needs (`cntcitachi@gmail.com`,
  `tripathidhruv2704@gmail.com`) into the `kaizen` tenant, exactly the same mechanism already
  used for `dhruv@carvelle.in`. No code changes to `E:/API` are needed for this — it's a seeding
  operation, run once.
- **KAIZEN's own backend owns authorization.** A new small table, `UserRole` (email, role,
  linked_subscriber_id nullable, created_at), maps an authenticated email to exactly one KAIZEN
  role: `officer | exchange | citizen`. After JWT verification, KAIZEN looks up the verified
  email in `UserRole` to decide what the user can see and do. This is the single new concept the
  rest of the plan hangs off of.
- Seed data: `dhruv@carvelle.in` → `officer`; `cntcitachi@gmail.com` → `exchange` (linked to the
  existing `VaspSubscriber` row for "Demo Exchange"); `tripathidhruv2704@gmail.com` → `citizen`.
- A `UserRole` row is auto-created as `citizen` the first time an email with no existing row logs
  in successfully — nobody with a valid KAIZEN-tenant login is ever refused a role; officer/exchange
  are allowlisted explicitly, everyone else defaults to citizen. This matches "give
  tripathidhruv2704@gmail.com as user" (explicit) while not hard-coding every future citizen email.

### The existing public VASP token-link portal is kept, not replaced

`/vasp-portal/:token` (no login) continues to work exactly as today — it's a genuinely useful,
friction-free channel for an exchange compliance team that doesn't want to manage a login. The
new login-based `exchange` role view is an **additional** way to reach the same data (full
detail, persistent account), not a replacement. Nothing about the existing route changes.

### Guest citizens: token-based ticket tracking, no account

A guest clicks "Continue as guest" on the login page — no OTP, no `UserRole` row, no JWT. The
frontend sets a local `role=guest` flag and routes straight to the complaint-filing form. On
submit, the backend generates an opaque `guest_ticket_token` (same random-token generator already
used for `VaspSubscriber.access_token`) and returns it; the citizen bookmarks
`/my-ticket/{guest_ticket_token}` to check status and read replies later — exactly the same
UX pattern as the VASP portal, reused rather than reinvented. A logged-in citizen
(`tripathidhruv2704@gmail.com`) instead gets a "My Complaints" list keyed off their verified JWT
email — no token needed, since they have a real account.

### A "ticket" is a `Case`, not a new parallel entity

Rather than invent a separate Ticket/Complaint table that duplicates tracing, `Case` gains:
- `status: str` (`'new' | 'in_progress' | 'handled'`), persisted for the first time — closes a
  real, previously-flagged gap (the frontend currently hardcodes every case's status to `'New'`
  because the backend has never persisted one).
- `filed_by_role: str` (`'officer' | 'citizen' | 'guest'`)
- `complainant_email: str | None` (set for a logged-in citizen's case)
- `guest_ticket_token: str | None`, unique + indexed (set for a guest-filed case)

A citizen-or-guest-filed case runs through the **exact same** tracer/attribution/innocence
pipeline an officer-filed one does — no second code path, no lesser version. This is the whole
point of reusing `Case` instead of a bespoke lightweight ticket model.

### Replies and the AI auto-reply-on-resolve

New table `CaseReply` (`case_id`, `message`, `authored_by: 'officer' | 'ai'`, `created_at`).
Officers can post a manual reply to any case at any time. When an officer transitions a case's
status to `'handled'` (new `PATCH /api/v1/cases/{id}/status` endpoint), the backend automatically
calls the existing narrative-summary generator (already built, OpenAI-backed, already
disclosed-and-honest-on-failure) and stores its output as a `CaseReply` with
`authored_by='ai'` — visible to the citizen/guest in their complaint view immediately. If
narrative generation fails or the key isn't set, the transition still succeeds (status changes)
but no AI reply is added — never a fabricated reply, matching the project's existing honesty
rule for this feature.

### Officer sees flagged wallets directly, not only via replies

New endpoint `GET /api/v1/vasp-feed/flagged-wallets` (officer-gated), returning every
`FlaggedWallet` system-wide (not scoped to one subscriber) with full, untruncated address, chain,
risk score, related case IDs, and flagged timestamp — the data already exists on the model, it
was just never exposed to officers directly (only via the portal, to exchanges, or embedded in
a reply record).

### VASP reply detail — "open each reply to see everything about it"

`VaspWalletReply` today carries only `{subscriber_id, flagged_wallet_id, message, replied_at}` —
no case reference. The richest available context is on the reply's own `FlaggedWallet`
(`caseIds`, `riskScore`, `chain`, full `address`) plus the subscriber's identity — already
returned by `GET /api/v1/vasp-feed/replies` in full. The frontend fix is a detail dialog per
reply (reusing the existing `Dialog` primitive) showing all of it at once, plus removing
`truncateAddress()` from both `VaspPortal.tsx` and `VaspReplies.tsx` so the full address is
always visible to both the exchange and the officer.

## Frontend shape

One login page (`/login`), one flow: OTP as today, plus a "Continue as guest" button. On success,
call a new KAIZEN-side `GET /api/v1/me` (not E:/API's `/me` — that has no role) returning
`{email, role}`; store it (new tiny `authStore.ts`, replacing the current pattern of reading
`localStorage` ad hoc from two different pages). `App.tsx`'s route tree branches on `role`:

- `officer` → everything that exists today, **plus** a new "Flagged Wallets" page and a new
  "Tickets" page (Cases.tsx gains real status tabs — New / In Progress / Handled — backed by the
  now-real `status` field, a reply box, and status-transition buttons).
- `exchange` → a login-based equivalent of the existing portal content, scoped to the logged-in
  subscriber's own flagged wallets and replies (reuses the portal's components).
- `citizen` (including guest) → a complaint-filing form (adapted from `NewCase.tsx`'s fields,
  citizen-facing copy) and a "My Complaints"/"My Ticket" view showing status + replies.

## Non-goals for this pass

- Not modifying `E:/API`'s code or schema.
- Not building a notification/email-on-reply system for citizens — they check their ticket page.
- Not retrofitting officer-only auth onto every existing KAIZEN endpoint (case creation stays
  open at the backend, same disclosed scope limit as today — the frontend route gating is what
  actually separates officer/citizen/guest UI, consistent with the existing pattern).
