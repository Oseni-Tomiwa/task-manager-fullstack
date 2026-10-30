# Phase 3.3 — cookie-based authentication

Verified locally on October 30, 2026. Backend implementation only. This is not a production-security or deployment-readiness claim: live MongoDB integration and actual Vercel/Render/browser behavior remain unverified.

## Checkpoint, architecture and scope

Before implementation, the tree was clean on main at `dac10c60ceac2f0288cb479ef6c76e030e54559d feat(database): add MongoDB connection and user model`. Local main, origin/main and a fresh read-only GitHub ls-remote result matched. The existing 47 backend tests passed before changes. The agent performed no staging, commits, pushes, destructive Git or history rewriting.

Reviewed Phase 1 architecture, authentication-decision.md, the Phase 3.2 report, server README/source/tests and hosting assumptions. Implemented the previously proposed HttpOnly-cookie JWT architecture; no bearer token is returned in JSON. The older Phase 1 token-in-JSON proposal is superseded by this contract.

Only four endpoints, focused auth middleware/helpers and configuration/tests were added. No task CRUD, production React, prototype changes, password reset, OAuth, MFA, email verification, refresh-token system, Redis, token blacklist or deployment was introduced. MongoDB methods are mocked in this milestone's auth verification; no production Atlas connection occurred.

## Endpoint contract

Success envelope: `{data:{user:{id,name,email,createdAt,updatedAt}}}`. Dates serialize as ISO strings. No password, hash, token, internal _id or __v is returned. Error envelope: `{error:{code,message,fields?}}`; validation fields contain messages, not submitted values.

| Method/path | Request | Result |
| --- | --- | --- |
| POST /api/auth/register | JSON name, email, password | 201 public user; sets session cookie |
| POST /api/auth/login | JSON email, password | 200 public user; sets session cookie |
| GET /api/auth/me | Session cookie | 200 public user; otherwise 401 |
| POST /api/auth/logout | JSON {} and CSRF headers; cookie optional | 204 empty body; expires session cookie |

Name is trimmed, required and limited to 80 characters. Email is trimmed/lowercased, validated and limited to 254 characters. Password is never trimmed or normalized: at least 12 Unicode code points, at most 72 UTF-8 bytes. The byte bound prevents bcrypt's silent input truncation. Unknown request fields and object-valued credentials are rejected. JSON bodies remain limited to 16 KiB.

Registration hashes asynchronously with bcrypt cost 12 and an automatically generated salt, then passes only name/email/passwordHash to User.create(). The existing unique MongoDB email index is authoritative; duplicate-key errors, including concurrent-registration races, map to 409 EMAIL_IN_USE. There is no race-prone check-then-insert dependency. Existing startup still awaits User.init() before listening. No duplicate insert against a live database was tested here.

Login explicitly selects +passwordHash for verification. Wrong passwords and missing users both produce the same 401 INVALID_CREDENTIALS body and no session cookie. A fixed public dummy bcrypt hash at the same cost is compared when the account is absent, reducing the most obvious timing difference; this is not a claim of perfectly constant request timing. Registration's explicit duplicate conflict reveals account existence by design. No email-verification guarantee is provided.

Other errors: 400 VALIDATION_ERROR or malformed JSON; 403 CSRF_REJECTED; 413 oversized body; 415 JSON_REQUIRED or unsupported encoding; 429 RATE_LIMITED with retry information; generic 500 for unexpected/database failures. The existing safe error middleware never logs arbitrary exception messages, request bodies or credentials. All auth responses, including parser errors, use Cache-Control: no-store.

## JWT and cookie lifecycle

Sessions last 1800 seconds (30 minutes), with no rolling refresh. Tokens contain a subject user ID, issuer taskflow-api, audience taskflow-web, issued/expiry times and a fresh random JWT ID; they contain no email, password or hash. HS256 is explicitly used for signing and verification. Verification enforces signature, algorithm, issuer, audience, maximum age, required expiry/issued-at claims, nonfuture issued-at and a valid ObjectId-shaped subject. Missing, malformed, tampered, expired, wrong-algorithm or wrong-context sessions are rejected before a user lookup.

requireAuth(config) reads only the session cookie, not an Authorization bearer header. It resolves the current user with a public-field projection, then exposes an explicit PublicUser identity as req.user to subsequent handlers. A deleted/missing user returns 401; database outages remain generic 500s rather than being misreported as invalid credentials. Invalid sessions clear the relevant cookie. Future protected task routes must explicitly use this middleware and ownership checks; no task route exists yet.

| Setting | Local development/test | Production |
| --- | --- | --- |
| Cookie name | taskflow_session | __Host-taskflow |
| HttpOnly | true | true |
| Secure | false | true |
| SameSite | Lax | Lax |
| Path | / | / |
| Domain | omitted, host-only | omitted, host-only |
| Lifetime | 30 minutes | 30 minutes |

Production requires NODE_ENV=production and an HTTPS CLIENT_ORIGIN. The __Host- prefix requires Secure, Path=/ and no Domain. Cookie settings come from validated server configuration, not spoofable forwarded-protocol headers. Plain HTTP development uses the separately named local cookie. Never copy development settings into a hosted production environment.

Successful login/registration replaces the browser cookie with a freshly signed session. On expiration, /me returns 401 and clears it; the future client should clear private state and show the sign-in screen. There is no localStorage/sessionStorage token storage and no token JSON response. The prototype remains independent and continues to simulate authentication.

Logout is idempotent and works even with an expired/missing cookie, after CSRF checks. It clears the same cookie name/path/security scope using Express clearCookie's expired Expires value. The client should clear local identity/task state only after successful logout, and offer retry on failure. Removing the browser cookie **does not cryptographically revoke a copied JWT**; a copied valid token can remain usable until its expiry. Secret rotation invalidates existing signatures, but per-session revocation, password-change revocation and multi-device session management are outside scope.

## CSRF, CORS and hosting assumptions

All state-changing requests under /api/auth require:

- Origin exactly equal to configured CLIENT_ORIGIN; absent, null, lookalike and untrusted values fail closed.
- X-TaskFlow-Request: 1 as an explicit custom header.
- Content-Type: application/json; logout should send {}.

GET/HEAD/OPTIONS do not mutate auth state and are exempt. This JSON API combines source-origin validation and a custom-header/content-type boundary with SameSite=Lax; the custom header is not a secret CSRF token. A browser's cross-origin custom-header request requires a preflight. No allow-origin or credentialed CORS response is enabled, so direct cross-origin browser access is intentionally unsupported. CORS is not authentication and nonbrowser HTTP clients can set Origin themselves; session verification still protects private reads.

Vercel documents external rewrites as reverse proxies, which makes the intended same-origin design plausible. That documentation does not prove TaskFlow cookie/header forwarding. The browser should eventually call relative /api paths on the frontend origin using credentials:'same-origin'. A fixed upstream rewrite must preserve /api and precede the SPA fallback. Render continues to host Express separately. Auth responses must not be CDN-cached. No proxy or deployment configuration was created in this milestone.

During local frontend development, a future production Vite client should proxy /api to localhost:3000 and use its own exact origin as CLIENT_ORIGIN. Do not wire the approved mock prototype into this API. Direct HTTP testing tools must explicitly supply the Origin, custom header and JSON content type; cross-origin browser fetch to port 3000 is not a supported substitute for the development proxy.

Before deployment acceptance, verify actual browser login, Set-Cookie on the frontend host, Cookie forwarding on /me, reload restoration, expiration, logout clearing, rejected untrusted Origins, preserved custom header/content type, API rewrite ordering and no cached private responses. If the proxy strips Origin, fail closed and fix forwarding; do not weaken the check. Direct Render and preview-origin requests must be tested too. No wildcard preview-origin allowlist is present. SameSite=None cross-site cookies are not the default fallback.

Primary sources reviewed before implementation: [Vercel external rewrites](https://vercel.com/docs/routing/rewrites), [Vercel reverse proxy guidance](https://vercel.com/kb/guide/vercel-reverse-proxy-rewrites-external), [OWASP custom-header and Origin CSRF controls](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [bcrypt byte-limit guidance](https://github.com/kelektiv/node.bcrypt.js/), [jsonwebtoken verification options](https://github.com/auth0/node-jsonwebtoken).

## Abuse prevention and proxy trust

Registration and login share one express-rate-limit instance: 10 requests per 15 minutes per network peer, including successful/invalid attempts. Standard rate-limit headers and Retry-After on 429 are emitted. Logout is not blocked by this login quota. The store is in memory, resets on restart and is not shared across workers. This is deliberately a single-instance assignment default, not distributed abuse protection.

Express trust proxy stays false. Client-supplied X-Forwarded-For is ignored for rate keys; its package warning is specifically disabled because ignoring it is intentional, not a reason to trust arbitrary headers. The package's IP key handling covers IPv6 subnet behavior. No general validation disabling or custom naive IP parser was introduced.

**Deployment gate:** behind Vercel and Render, req.ip may identify an ingress peer, causing many users to share the quota. Before production, verify every ingress path, trusted proxy addresses/hops and forwarded-IP overwrite/append behavior, then configure a narrowly scoped trusted chain if necessary. Do not set trust proxy=true or a guessed hop count to silence warnings. Rate-limit effectiveness and usability through the actual chain are unverified. Multiple-instance hosting would need a deliberately reviewed shared store; no Redis was added now.

## Environment and local setup

Existing NODE_ENV/HOST/PORT/MONGODB_URI configuration remains. Added:

| Variable | Requirement |
| --- | --- |
| JWT_SECRET | Required, 64 hex characters; privately generate 32 random bytes using openssl rand -hex 32 |
| CLIENT_ORIGIN | Required, one canonical origin with no trailing slash/path/query/credentials/wildcard; production HTTPS only |

Development accepts HTTP only for localhost/127.0.0.1/[::1], or an HTTPS origin. Example configuration uses http://127.0.0.1:5173. NODE_ENV=production always requires HTTPS. Config errors include field names only. The .env.example signing-key placeholder intentionally fails validation until replaced; it is not an usable/default secret.

```bash
cd server
pnpm install --frozen-lockfile
cp .env.example .env
# Generate a secret privately with openssl rand -hex 32 and set it only in ignored .env.
# Configure a local/authorized development MONGODB_URI and exact CLIENT_ORIGIN.
pnpm dev
```

Never paste generated keys into chat, docs, frontend environment values or logs. Production will require NODE_ENV=production, HOST=0.0.0.0, platform PORT, authorized database credentials, private JWT_SECRET and the verified frontend HTTPS origin in hosting environment settings. Do not provision or deploy as part of this document.

createApp(authConfig) mounts the auth router. createApp() without auth configuration remains a health/test-only factory for the existing tests; it exposes no auth endpoint. The actual entry point separately validates parseAuthEnv() and supplies it to createApp before starting the database lifecycle. Missing/invalid auth configuration cannot silently disable auth in production startup. User schema fields/validation/index/serialization are unchanged; only its TypeScript type was made explicit to support safe typed DTOs and hash verification.

## Verification evidence

Baseline before implementation: 47 tests passed, 7 files. Final checks ran from the repository with pnpm 10.15.1 and host Node 26.8.1; no separate Node 24 CI matrix was run.

| Check | Result |
| --- | --- |
| pnpm --dir server install --frozen-lockfile | Passed |
| pnpm --dir server typecheck | Passed |
| pnpm --dir server lint | Passed, no errors/warnings |
| pnpm --dir server format:check | Passed |
| pnpm --dir server test | **94 tests passed, 0 failed, 9 files passed** |
| pnpm --dir server build | Passed |

All original 47 tests and their source files are unchanged. New tests cover registration, input/Unicode byte limits, duplicate-key conflict, real bcrypt hashing/cost/comparison, login and missing-user generic failures, cookie attributes, protected profile, missing/bearer/invalid/expired/tampered/wrong-context JWTs, logout cookie-jar behavior, CSRF, JSON-only mutations, shared rate limits, spoofed forwarded IPs, no-store parser errors, sanitized database failures, safe public fields and production config requirements. Tests were first run against the absent router/stub config and failed for missing behavior; implementation was then added. A parser-error caching regression was reproduced and fixed by setting no-store before JSON parsing.

**Mocks versus integration:** Supertest uses real temporary HTTP sockets; bcrypt/JWT/cookie/rate-limit code is real. User.create/findOne/findById are mocked in auth tests. Existing in-memory model tests use real schemas. No live MongoDB index build, duplicate insert, query projection or persistence was verified, and no Atlas connection occurred. Supertest cookie/header checks are not browser cookie-policy or deployed proxy integration tests.

Compiled ESM smoke verification separately imported dist modules and exercised health, registration, real bcrypt login, cookie-protected /me, logout and public-field filtering over a temporary loopback listener, with process-local database mocks only. It passed and the process/listener were closed. Compiled production startup rejected a missing signing secret and an insecure production origin before database connection, exiting 1 without logging secret values; these checks bypassed .env loading and used controlled synthetic environment values.

pnpm reported the bcrypt install script was ignored; its packaged native prebuild worked in real hashing/comparison checks. No broad install-script approval was enabled. New direct packages are bcrypt, jsonwebtoken, cookie and express-rate-limit, plus bcrypt/JWT types for TypeScript. No production database/browser/hosting readiness is claimed. Remaining deployment/database gates, runtime performance under hosting load, shared-store needs and stateless-revocation limits are documented above.

## Exact file inventory and manual Git handoff

Modified:

```text
README.md
docs/authentication-decision.md
server/.env.example
server/README.md
server/package.json
server/pnpm-lock.yaml
server/src/app.ts
server/src/index.ts
server/src/models/user.ts
```

Added:

```text
docs/phase-3.3-authentication.md
server/src/auth/middleware.ts
server/src/auth/routes.ts
server/src/auth/session.ts
server/src/auth/validation.ts
server/src/config/auth.ts
server/tests/auth-config.test.ts
server/tests/auth.test.ts
```

No unexpected changes are intended. Prototype, database lifecycle, health contract and all existing tests remain preserved. Real .env files, dependencies, compiled output and logs are ignored. The only committed credential-like strings are deliberately synthetic test passwords, the invalid example placeholder and a public non-account dummy comparison hash. Test JWT signing keys are generated in memory. No real secret or credential was written to committed files. Source scanning is a focused known-pattern check, not a guarantee against every possible secret.

Run staging/review/commit/push yourself:

```bash
cd '/Users/mavery/Documents/Codex-workspace/AppRo8 Internship 1/week2/task-manager-fullstack'
git status --short --branch
git diff --check
git diff -- README.md docs/authentication-decision.md server/
git ls-files --others --exclude-standard
git add -- README.md docs/authentication-decision.md docs/phase-3.3-authentication.md server/
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached -- server/.env.example server/src server/tests
git commit -m "feat(auth): implement secure cookie-based authentication"
git status --short --branch
git push origin main
```

Review staged names/content before committing. The agent ran none of those staging/commit/push commands. Phase 3.4 remains unauthorized; stop for the user's review.
