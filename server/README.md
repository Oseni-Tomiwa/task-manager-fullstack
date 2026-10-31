# TaskFlow server — Phase 4.2

Express/TypeScript backend with MongoDB lifecycle, a typed User model and cookie-based JWT authentication. Authenticated owner-scoped task CRUD, search, status filters and pagination are implemented.

## Run locally

Use Node.js 24.10+ (Node 24 LTS recommended) and pnpm 10.15.1. From the repository root:

```bash
cd server
pnpm install --frozen-lockfile
cp .env.example .env
# Set a private JWT_SECRET using openssl rand -hex 32; keep it in .env.
# Confirm CLIENT_ORIGIN, then start your own local MongoDB or authorized dev database.
pnpm dev
```

`GET http://127.0.0.1:3000/api/health` returns HTTP 200 with exactly `{"status":"ok"}`. No authentication is required. This is a process liveness check, not database readiness. Startup connects to MongoDB and waits for User index initialization before opening the HTTP listener. The health endpoint itself remains independent of database status.

## Commands

| Command             | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `pnpm dev`          | Run TypeScript with Node watch mode and tsx |
| `pnpm build`        | Compile only src/ to dist/                  |
| `pnpm start`        | Run compiled dist/index.js                  |
| `pnpm typecheck`    | Check source and tests without emission     |
| `pnpm lint`         | ESLint source, tests and configuration      |
| `pnpm format`       | Format package files                        |
| `pnpm format:check` | Check formatting without modifications      |
| `pnpm test`         | Run Vitest once                             |
| `pnpm test:watch`   | Watch tests                                 |

Build before using start. dev/start load an optional `.env` using Node's built-in `--env-file-if-exists`; exported environment variables take precedence. No dotenv dependency is needed. Tests do not load real .env files or contact Atlas. Existing HTTP tests use the independent app factory; new lifecycle tests mock database operations and use temporary local HTTP ports. User validation runs against real Mongoose schemas in memory.

## Configuration

| Variable    | Default             | Validation                                                           |
| ----------- | ------------------- | -------------------------------------------------------------------- |
| NODE_ENV    | development         | development, test or production                                      |
| HOST        | 127.0.0.1           | Nonempty trimmed string; invalid/unresolvable addresses fail startup |
| PORT        | 3000                | Digits only, integer 1–65535                                         |
| MONGODB_URI | Required at startup | MongoDB URI syntax, mongodb:// or mongodb+srv://                     |

Validation errors show field names, never values. Real `.env` and `.env.*` files are ignored; `.env.example` contains only non-secret defaults. MONGODB_URI is optional in parseEnv() so standalone configuration and health tests remain independent; parseStartupEnv() requires it. Invalid supplied URIs are rejected even in parseEnv(). URI validation constructs a driver client to parse syntax only; it opens no connection or DNS request. The entry point separately requires a validated JWT_SECRET and CLIENT_ORIGIN through parseAuthEnv().

For a later hosting milestone, explicitly set HOST=0.0.0.0 and NODE_ENV=production and use the platform-supplied PORT. The local default deliberately binds loopback. No hosting configuration or deployment is provided here.

## Structure and behavior

- src/app.ts: side-effect-free createApp() factory, Helmet security headers, 16 KiB JSON parser, health route, 404 and error middleware.
- src/config/env.ts: pure environment parser and inferred Env type; no config reads during import.
- src/middleware/errors.ts: stable JSON error responses; no request bodies, stack traces or arbitrary exception messages returned/logged.
- src/index.ts: startup configuration, generic failure reporting and ready log.
- src/start.ts: connect database, await User.init(), then listen. SIGINT/SIGTERM drain HTTP before database cleanup; a shared shutdown promise handles repeat calls and shutdown during initialization. A 10-second deadline force-closes HTTP connections and exits 1 if cleanup cannot finish. Listener errors clean up the database.
- src/database/connection.ts: one default Mongoose connection, shared in-flight connect/close promises, cleanup on failed connection, sanitized errors. Server selection/connect timeout 10 seconds, socket inactivity timeout 45 seconds, pool maximum 10; no custom retry loop. Commands do not buffer while disconnected.
- src/models/user.ts: inferred UserRecord, required trimmed name (1–80), required normalized email (up to 254, validated with Zod), required passwordHash (1–255), timestamps and unique email index. Unknown fields, including plaintext password, are rejected. Hash is excluded from ordinary queries and removed from JSON serialization.
- tests/: HTTP contracts, body parsing, error sanitization and environment validation.

Error envelope: `{error:{code,message}}`. Unknown routes return 404 NOT_FOUND; malformed JSON 400 INVALID_JSON; oversized JSON 413 PAYLOAD_TOO_LARGE; unsupported encoding 415 UNSUPPORTED_ENCODING; unexpected failures 500 INTERNAL_ERROR. JSON parsing occurs before route resolution. Non-JSON bodies are not consumed as JSON; future route-level content-type validation is deferred until mutation endpoints exist. Trust proxy remains Express's default false. No CORS middleware or allow-origin response headers are enabled.

## Anticipated proxy/authentication architecture

A later Vercel client will call relative `/api` paths, proxied to Render while keeping browser requests same-origin. See ../docs/authentication-decision.md for the proposed HttpOnly/Secure/SameSite cookie JWT strategy, exact Origin and custom-header CSRF controls, expiration/logout behavior and required deployment checks. Cookie authentication, exact-Origin/custom-header CSRF controls and auth routes are now implemented. The same-origin proxy and hosting configuration remain unimplemented and unverified. No permissive CORS middleware is enabled. Do not treat the absence of CORS as authentication or access control. Client integration and mutation-route security must be added in their authorized milestones.

No repository/service layers, refresh-token infrastructure, deployment manifests or production frontend were added. The approved prototype is independent and unchanged.

## Database use and limitations

Use a local MongoDB or a dedicated, explicitly authorized development Atlas database. The .env.example URI contains no credentials. Atlas instructions, lifecycle details and verification evidence are in [Phase 3.2 documentation](../docs/phase-3.2-database.md).

The User model declares a unique email index; MongoDB's built index enforces uniqueness. Startup awaits User.init() (automatic index creation enabled for this small project). Existing duplicate records or inadequate index permissions can prevent readiness; fix those deliberately, never automatically drop data. Mongoose unique is not a validator. Authentication will later catch duplicate-key errors and return a safe application response. Registration now hashes passwords with bcrypt cost 12; login explicitly selects +passwordHash to compare. Never put plaintext into passwordHash or expose hashes through public API responses.

The default connection is owned by this process and uses one configured URI. Subsequent calls reuse a connected pool; change databases by shutting down and restarting, not by hot-swapping the URI. The driver handles post-connect recovery; /api/health remains liveness and does not reflect later connection loss. If deployment needs dependency readiness later, propose a separate endpoint then. No additional endpoint is added now.

No live MongoDB integration test or Atlas connection is part of this milestone's verification. Tests check index definition and selection defaults, not real duplicate-write rejection or actual database query projection. Those integration checks remain necessary before claiming production readiness.

## Authentication

See [Phase 3.3 authentication](../docs/phase-3.3-authentication.md) for endpoints, response contracts, cookie/CSRF rules, testing evidence and deployment limitations.

- POST /api/auth/register → 201 public user + HttpOnly cookie.
- POST /api/auth/login → 200 public user + HttpOnly cookie.
- GET /api/auth/me → 200 public user or 401.
- POST /api/auth/logout → 204 and expired session cookie.

All POSTs require exact Origin=CLIENT_ORIGIN, X-TaskFlow-Request: 1 and Content-Type: application/json (send {} on logout). The 30-minute JWT is never returned in JSON. Login and registration share a 10-attempt/15-minute per-network-peer limiter; proxy trust remains false until the actual ingress chain is verified.

JWT_SECRET must be 64 hexadecimal characters generated privately using openssl rand -hex 32. The .env.example placeholder is intentionally invalid. CLIENT_ORIGIN is one exact HTTP loopback origin for development or an HTTPS origin; production requires HTTPS. No trailing slash, path, credentials or wildcard. NODE_ENV=production enables the Secure, host-only __Host-taskflow cookie; local development uses taskflow_session without Secure. Both use HttpOnly, SameSite=Lax, Path=/ and a 30-minute lifetime.

createApp(authConfig) mounts auth routes. createApp() without auth config remains a health/test-only factory; the production entry point always validates auth config and passes it before any database connection, so missing settings cannot silently disable production authentication. requireAuth() resolves a safe public user to req.user for protected handlers; database outages return a generic 500 rather than pretending the session is invalid.

Logout clears the browser cookie but does not revoke a copied JWT before expiry. No refresh tokens, persistent browser token storage, session blacklist, OAuth or password-reset infrastructure is present. Supertest tests use real bcrypt/JWT operations with mocked database methods; no real browser/proxy or Atlas integration has been verified.

## Task API

See [Phase 3.4 task API](../docs/phase-3.4-task-api.md) for examples, responses, validation and verification evidence. All /api/tasks routes require the existing session cookie; POST/PATCH/DELETE additionally require the exact Origin, X-TaskFlow-Request: 1 and application/json. Send {} on DELETE. All task responses are no-store.

- POST /api/tasks → 201 {data:{task}}.
- GET /api/tasks → 200 {data:{tasks},meta:{page,limit,total,totalPages}}.
- GET /api/tasks/:id → 200 {data:{task}}.
- PATCH /api/tasks/:id → 200 {data:{task}}.
- DELETE /api/tasks/:id → 204 empty body.

Production status values are exactly todo, in_progress and completed, with todo as default. PATCH {status:"completed"} completes a task; PATCH {status:"todo"} marks it incomplete. The approved prototype remains unchanged: its pending maps to todo and in-progress maps to in_progress when the production frontend is built. No production alias or data migration is needed for isolated mock data.

Title is required, trimmed and 1–120 characters. Description is trimmed, at most 2000 characters and defaults to empty. Owner is a required immutable User reference assigned only from req.user.id; no populated user data or owner field is returned. Timestamps are maintained by Mongoose. A compound owner/createdAt/_id index supports owned-list queries. Unknown fields, client-supplied owner/IDs/timestamps/operators and empty PATCH bodies are rejected. Updates use an explicit $set and runValidators with returnDocument:after.

List query: q (literal case-insensitive title substring, max 120), optional status, page (1–10000, default 1), limit (1–100, default 20). Unknown/repeated/operator-shaped query parameters are rejected. Sorting is createdAt descending then _id descending. Empty results use totalPages=0; an out-of-range page stays empty rather than silently changing page. Counts and lists are separate queries and may drift under concurrent writes. There is no search service or transaction snapshot. Phase 4.2 adds the separate unfiltered summary endpoint below.

Every task query includes the authenticated owner, including counts, updates and deletes. A malformed ObjectId returns 400; valid missing and foreign-owned IDs both return the same 404 TASK_NOT_FOUND. Unexpected database failures use the existing generic 500 handler. Authentication and CSRF behavior remains unchanged. Successful task persistence and actual index behavior still require isolated MongoDB integration verification; routine tests use mocks and real in-memory model validation.

## Phase 4.2 summary and same-origin development

`GET /api/tasks/summary` requires the same cookie/current-user authentication as all task routes. It returns HTTP 200 with `{data:{summary:{total,todo,in_progress,completed}}}`; all four counts are numeric and default to zero. Query parameters are rejected with 400. The static route precedes task-ID validation. One aggregation explicitly casts the authenticated owner to ObjectId, matches only that owner and groups by status; no client owner/filter is accepted. No task contents, owner IDs or user secrets are returned. Responses use existing no-store and generic error handling.

The client uses this global summary independently of filtered/paginated lists. No new dependency, database collection, model or index is required. Counts and lists are separate read snapshots; offset pagination can shift under concurrent changes. Existing five task endpoints retain their contracts.

For local integration, start the backend on `127.0.0.1:3000` with exact `CLIENT_ORIGIN=http://127.0.0.1:5173`, then start `client/` with `pnpm dev`. Vite's fixed `/api` proxy preserves the original browser Origin and cookies. Keep production CORS disabled; never weaken exact-origin/header/JSON CSRF checks. Auth/logout and task writes must still carry `X-TaskFlow-Request: 1`; logout/DELETE use JSON `{}`. See [the client guide](../client/README.md) for setup and [Phase 4.2 verification](../docs/phase-4.2-fullstack-integration.md) for evidence.

Routine tests use mocked persistence boundaries. `pnpm test:integration` explicitly selects the real local MongoDB suite (see [Phase 3.5](../docs/phase-3.5-integration.md)); missing/unsafe dedicated configuration fails rather than skipping. No Atlas access is required or authorized by the verification command.

Vercel/Render API rewriting, TLS cookie behavior and trusted proxy/IP configuration remain deployment gates, not locally verified production behavior. Stateless JWT logout clears the browser cookie but cannot revoke a previously copied JWT before its 30-minute expiry.
