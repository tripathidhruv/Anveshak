# Officer login (email+OTP) + external VASP wallet-sharing portal — design

Status: decided per explicit user directive, 2026-09-27. Two related but distinct features,
covering both in one spec since the second depends on the first's login system for its
internal (KAIZEN-only) view.

## Feature 1: Officer login via the existing Lighthouse Auth API (`E:/API`)

### What already exists, reused as-is where possible
`E:/API` ("Lighthouse Auth API") is a real, separately-built, already-tested FastAPI service:
email+OTP login (6-digit code, 5-min expiry, SHA-256-hashed, 60s cooldown, 5-attempt cap,
anti-enumeration generic responses), JWT issuance (`create_access_token`/`decode_access_token`
in `app/core/security.py`, HS256, shared-secret verification — any service that knows
`JWT_SECRET` can verify a token without calling back to the auth service), a multi-tenant
SQLAlchemy schema (`tenant_lh`/`app_user_lh`/`user_auth_lh`/`otp_code_lh`/... — read
`app/models/models.py` for the full ERD), real SMTP mail sending. It runs as its own FastAPI
process (`uvicorn app.main:app`), independent of KAIZEN's backend.

### One real gap to close before this is usable for KAIZEN
`app/core/config.py`'s `Settings.database_url` is a hardcoded `@property` that always builds a
`mysql+pymysql://...` URL from `mysql_host`/`mysql_user`/etc. — there is no way to point it at
SQLite today outside of tests (which bypass `Settings` entirely via a separate in-memory
engine fixture). Requiring a real MySQL server contradicts KAIZEN's own "fully offline-
capable" architecture stance (SQLite everywhere else). **Fix, minimal and additive**: change
`database_url` to read an optional `DATABASE_URL` env var first, falling back to the existing
MySQL-URL construction only if that's unset — a real MySQL deployment still works unchanged,
but `DATABASE_URL=sqlite:///./auth.db` becomes possible for this project's actual use. This is
a small patch to a repo outside `E:\kaizen` — make it there directly (it's the implementer's
own separate git repo, not KAIZEN's, but editing it is the correct fix, not a fork-and-copy).

### Seeding officers (login only works for pre-registered emails, by design —
`sendOtp` never auto-creates a user; anti-enumeration means it can't).
New script `E:/API/scripts/seed_kaizen_tenant.py`: creates one `Tenant` (slug=`"kaizen"`,
`TenantLoginConfig.email_otp_enabled=True`), and one `AppUser` + `UserAuth`
(`login_method="email_otp"`) row per officer email passed as a CLI arg or a small
comma-separated env var — re-runnable, skips emails already seeded (no duplicate-row error on
a second run).

### KAIZEN backend: verify the JWT, don't re-implement login
New `backend/app/auth/jwt.py`: a `get_current_officer` FastAPI dependency that reads the
`Authorization: Bearer <token>` header, decodes it with `jwt.decode(token, settings.auth_jwt_secret,
algorithms=["HS256"])` (same shape `E:/API`'s own `decode_access_token` produces — no network
call to the auth service needed, just shared-secret verification), and raises 401 on a
missing/invalid/expired token. `Settings` gains `auth_jwt_secret: str | None = None`
(`KAIZEN_AUTH_JWT_SECRET`) — **must be set to the exact same value as `E:/API`'s own
`JWT_SECRET`** (documented loudly in both `.env.example` files, since a mismatch silently
breaks every login).

**Scope of what gets gated, stated honestly:** this pass does NOT retrofit auth onto every
pre-existing KAIZEN endpoint (a large, separate undertaking, and every existing test currently
assumes no auth — breaking all of them is not this task's job). It protects exactly the new
"VASP replies, KAIZEN-only view" endpoint from Feature 2 below, plus the frontend's own route
guard (redirect to `/login` when there's no valid token, applied at the app-shell level, not
per-API-call). This is a real, disclosed scope limit — recorded in `docs/TASKS.md`, not hidden.

### Frontend: login page + route guard
New `frontend/src/pages/Login.tsx` — a two-step flow (email → "check your inbox" OTP entry →
success), calling `E:/API`'s `sendOtp`/`verifyOtp` directly (new `VITE_AUTH_API_URL` env var,
separate base URL from KAIZEN's own backend). On success, store the JWT (localStorage — this
is a per-viewer convenience token, not something Claude or another viewer needs to read back,
so localStorage is the right place per this project's own storage conventions). Wrap the
existing app shell in a route guard that redirects to `/login` when no token is present, and
attaches `Authorization: Bearer <token>` to the one new authenticated endpoint from Feature 2.

**"Extremely attractive," per explicit ask:** check Animate UI (per this user's own global
CLAUDE.md instruction) for the OTP-input/transition components before hand-rolling; reuse this
project's existing design tokens (Outfit/Inter fonts, indigo/violet accents, the aurora
background already used elsewhere in the app) so it reads as part of KAIZEN, not a bolted-on
generic login screen.

## Feature 2: External VASP wallet-sharing portal with a private reply channel

### The access model — two different audiences, two different mechanisms
- **KAIZEN officers** (internal): the login system above (email+OTP+JWT).
- **External exchanges** (external, not KAIZEN staff): a **per-subscriber opaque access
  token embedded in a shareable link** — no login flow for them at all, matching the user's
  own description ("a link to send to the exchange"). This reuses and extends the *already-
  shipped* `VaspSubscriber` model (Task H2) rather than building parallel infrastructure.

### Data model additions
- `VaspSubscriber` (existing, `app/models.py`) gains `access_token: str` (a real random
  token, generated at subscriber-creation time, unique, indexed — this is what makes the
  shareable link work: `https://.../vasp-portal/{access_token}`).
- New `VaspWalletReply` table: `id, subscriber_id (FK), flagged_wallet_id (FK to
  FlaggedWallet), message (Text), replied_at`. One exchange's reply is never visible to any
  OTHER exchange — enforced by the portal only ever showing a subscriber their OWN token's
  scope, and the internal view showing all replies to officers only.

### External-facing endpoints (no officer auth — the token itself IS the auth)
- `GET /api/v1/vasp-feed/portal/{access_token}` → validates the token resolves to a real,
  active subscriber, returns ONLY flagged-wallet fields relevant to that subscriber
  (`address`, `chain`, `riskScore`, `flaggedAt`) — explicitly never case details, victim PII,
  complainant info, or other subscribers' data. An invalid/unknown token is a 404, not a
  200-with-empty-list (never confirm/deny a guessed token's validity beyond that).
- `POST /api/v1/vasp-feed/portal/{access_token}/reply` → `{flaggedWalletId, message}`,
  writes a `VaspWalletReply` row. Rate-limit-conscious but simple for this scope (no auth
  beyond the token itself, matching the "just a link" ask) — validate the wallet actually
  belongs to that subscriber's own visible set before accepting a reply (a token holder must
  not be able to reply about a wallet outside their own scope, even by guessing an ID).

### Internal (KAIZEN-only) endpoint — gated behind Feature 1's login
- `GET /api/v1/vasp-feed/replies` (requires `get_current_officer`) → every `VaspWalletReply`
  across all subscribers, for officers to review. This is the one endpoint Feature 1's JWT
  gate actually protects in this pass.

### Frontend
- New public page `frontend/src/pages/VaspPortal.tsx` at route `/vasp-portal/:token` — no
  app-shell/login wrapper (it's for an external visitor who was never asked to log in), reads
  the token from the URL, shows the wallet list + a reply form per wallet.
- New internal page/tab (behind the login guard) showing all replies — a new screen or a
  new tab on the existing Exchanges screen, implementer's call given existing IA, document
  which was chosen and why.

## Testing/acceptance
- `E:/API`: existing test suite must still pass after the `database_url` env-var change
  (additive, defaults preserve current MySQL behavior when `DATABASE_URL` is unset). Add one
  test confirming `DATABASE_URL` override works.
- KAIZEN backend: `get_current_officer` unit tests (valid token, expired token, wrong
  secret, missing header). Portal endpoint tests (valid token scoped correctly, unknown token
  404, reply rejected for a wallet outside the token's scope, reply accepted and visible only
  via the internal `/replies` endpoint, never via another subscriber's own portal token).
- Frontend: `npm run build` clean; manual dev-server check of the login flow and the portal
  page (a portal link can be constructed manually from a test subscriber's token during
  verification, no real email/SMTP round-trip required for this check).
- No test makes a real SMTP call or a real cross-service HTTP call between the two backends
  (JWT verification is local/shared-secret, exactly to avoid this dependency).

## Sequencing note
Both `backend/app/main.py` router registration and `frontend` route wiring are touched by
this work. Given this session's own history of git-index collisions when multiple agents
touch `main.py` concurrently, build Feature 1 (auth wiring) and Feature 2 (portal) as two
SEQUENTIAL tasks, not parallel ones.
