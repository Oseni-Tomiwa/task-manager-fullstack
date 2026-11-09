# TaskFlow server

Express/TypeScript backend with MongoDB lifecycle, a typed User model and cookie-based JWT authentication. Authenticated owner-scoped task CRUD, search, status filters and pagination are implemented.

## Run locally

Use Node.js 24 LTS (24.10+ within 24.x) and pnpm 10.15.1. `server/.node-version` selects verified 24.22.1 when this directory is Render’s project root. From the repository root:

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

The local default binds to loopback. For the production host, follow the [deployment settings](#render-deployment).

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

## Same-origin proxy and authentication

The Vercel frontend calls relative `/api` paths. The active rewrite in [client/vercel.json](../client/vercel.json) forwards those requests to Render while keeping browser requests same-origin. See the [client deployment guide](../client/README.md) and the [authentication decision](../docs/authentication-decision.md) for the rewrite, cookie settings, session expiry, and exact-Origin, custom-header, and JSON checks on mutations. The API uses no CORS middleware.

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

Stateless JWT logout clears the browser cookie. A previously copied JWT remains valid until its 30-minute expiry.

## Render deployment

The production backend uses a Render Node Web Service with root directory `server`. Use the [repository deployment settings](../README.md#deployment-configuration-and-reliability) for the build and start commands, runtime, and health check. The [deployment preparation guide](../docs/phase-5.2a-deployment-preparation.md) covers Atlas access, secret handling, and the rollout sequence.

Set `NODE_ENV=production`, `HOST=0.0.0.0`, and the exact canonical HTTPS `CLIENT_ORIGIN`. Use Render's supplied `PORT`. Store `MONGODB_URI` and the 64-hex `JWT_SECRET` privately in Render.

Express still trusts no proxy. Behind Render and Vercel, the shared 10-attempt/15-minute authentication limiter can group users by ingress peer. See the [release hardening report](../docs/phase-5.3.1-release-hardening.md) for the open client-identity and spoof-resistance checks.

## Temporary startup diagnostics

Diagnostics are disabled by default. Only the exact value `STARTUP_DIAGNOSTICS=1`
adds JSON events for `app`, `database_connect`, `database_selection`, `user_init`,
`user_collection`, `user_email_index`, and `http_bind`.
No environment file or deployment configuration enables this flag. Local approval
covers implementation/testing only; production activation, deployment, and Atlas
connections require separate authorization. Starting the application still performs
its existing database connection and collection/index initialization operations.

Operation events contain only a fixed event name, stage, result (`started`, `ok`,
or `failed`), and (on failure) a predefined category and optional allowlisted code.
The `database_selection` event instead contains only the fixed event/stage fields
and `database_matches_expected`, a boolean comparing the selected database with
`taskflow` after connection succeeds. It never includes either database name or a
connection string. It reports a mismatch without changing the selected database
or failing startup. Errors, messages, stacks, hostnames,
credentials, and operation results are never serialized by diagnostics. Existing
ordinary startup/shutdown messages remain unchanged. Classification uses error
names/codes, `cause`, and `reason.servers` entry errors, with limits of six nesting
levels, 32 inspected nodes, and eight server entries per map. Cycles and throwing
property getters are handled; logging failures do not change operation results.

`database_connect` distinguishes recognized configuration, DNS, network, TLS,
authentication, and authorization signals. Unrecognized selection failures remain
`server_selection_unknown`; other unrecognized failures remain `unknown`. No message
text is inspected. Code `8000` reports `atlas_rejection_unknown`, which does not
establish authentication, authorization, or a tier limitation. Code `48`, when it
reaches classification, reports `existing_collection` without changing error handling.

User collection middleware is installed before model compilation. Index listeners
are attached once per model from the schema's `init` event, before automatic index
initialization. `user_collection` and `user_email_index` emit `started` followed by
`ok` or `failed`; payloads such as collection/index names and options are ignored.
Mongoose handles a normal `MongoServerError` code `48` internally, so that existing
collection outcome reports collection `ok` without a code. An `ok` event means the
initialization step succeeded, not necessarily that a new object was created.
The schema currently declares exactly one index, the unique email index; review
this fixed event label if more User indexes are added. `user_init` remains the
overall boundary. Task initialization is not separately instrumented. Collection
and index events may precede the connection success/database-match events because
Mongoose automatically initializes models; only collection-before-index order is
guaranteed for User initialization. Errors beyond inspection limits can remain unknown, and when several
server errors exist the first recognized code is reported. `http_bind` failures
always use `http_binding`, optionally with a recognized bind code. Imports and
configuration validation happen before these diagnostic boundaries.

Tests use synthetic errors and mocked database calls; no production connection is
needed. Initialization tests run the actual schema and Mongoose pipeline with
in-memory database substitutes, without sending database commands. To remove
temporary diagnostics later, remove the helper, call-site wrappers, database-match
check, and User middleware/listeners along with their dedicated tests. Never disable TLS validation, weaken
network restrictions, broaden database privileges, or drop indexes/data merely to
make startup succeed.
