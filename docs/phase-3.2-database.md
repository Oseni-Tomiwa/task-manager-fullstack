# Phase 3.2 — MongoDB foundation

Verified locally on October 30, 2026. Authentication, task CRUD, production frontend and deployment remain outside this milestone.

## Git checkpoint and architecture

Before modifications, the working tree was clean on main. Phase 3.1 was committed as `f53395b8837aa72c936259996541129f5bbd2631 chore(server): initialize Express TypeScript backend`. Local HEAD, origin/main and a fresh read-only `git ls-remote origin refs/heads/main` result all matched that SHA. No fetch, staging, commit, push or history modification was performed by the agent.

Reviewed the project README, Phase 1 architecture, authentication decision, Phase 3.1 report, server README, source, tests and dependencies. The existing standalone server package and app factory remain. The approved prototype, app.ts and all 16 original tests are unchanged. Mongoose 9.11.4 is the only new direct dependency; its exact resolution and transitive dependencies are in server/pnpm-lock.yaml. pnpm also sorted package.json dependency keys without changing existing dependency ranges.

## Configuration and local development

Node.js 24.10+ and pnpm 10.15.1 are required; Node 24 LTS is recommended. In the repository:

```bash
cd server
pnpm install --frozen-lockfile
cp .env.example .env
# Start your own local MongoDB instance, then:
pnpm dev
```

The template includes the non-secret local URI `mongodb://127.0.0.1:27017/taskflow`. No real .env file was created or read during verification. Start a local MongoDB service yourself, or configure an explicitly authorized development Atlas database before running the application. Do not point a local developer instance at production data.

| Variable | Behavior |
| --- | --- |
| MONGODB_URI | Required for startup; accepts mongodb:// and mongodb+srv:// URI syntax; no runtime default |
| NODE_ENV | development/test/production, default development |
| HOST | Default 127.0.0.1; configure 0.0.0.0 later if hosting is authorized |
| PORT | Integer 1–65535, default 3000 |

The existing Zod config now validates a supplied URI using the MongoDB driver's parser through Mongoose. Constructing the client for syntax validation does not connect or perform DNS resolution. Parser failures are converted to a field-name-only config error. `parseEnv()` permits omission for independent app/config tests; `parseStartupEnv()` requires the URI and returns a type with MONGODB_URI guaranteed. No test needs an Atlas secret. Existing Node dev/start scripts still load an optional .env, while exported environment variables take precedence.

## MongoDB Atlas setup — manual, not executed

When you explicitly authorize a development database connection:

1. In your Atlas account, choose/create a project and a development cluster using the available service options; review any cost before provisioning.
2. Create a dedicated **database user**, separate from your Atlas account, with readWrite access limited to TaskFlow's development database. Keep credentials in your password manager/environment configuration.
3. Add only the development machine's public IP to the project's network access list. For later hosting, review the hosting service's outbound addresses and add the needed range deliberately. Avoid a permanent 0.0.0.0/0 entry.
4. In Connect → Drivers, copy the Node.js/Mongoose-compatible connection string. Set the explicit development database name, substitute your database user credentials, and percent-encode reserved characters in the username/password. Keep the provider's TLS settings; do not disable certificate checks to solve connectivity errors.
5. Put the URI only in ignored server/.env or the hosting secret store during an authorized deployment milestone. Never in VITE variables, browser code, README, screenshots, logs or Git.
6. Confirm URI, database permissions, DNS/network access and index-creation permissions on this development database. Starting the server connects and initializes the users collection/index. This milestone does not authorize doing those steps against the user's actual Atlas deployment.

Primary documentation: [Atlas connection prerequisites](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/), [Atlas connection troubleshooting and URI encoding](https://www.mongodb.com/docs/atlas/troubleshoot-connection/).

## Connection and application lifecycle

- src/database/connection.ts owns the default Mongoose connection. An in-flight promise coalesces concurrent connect calls; a connected pool is reused. Shared cleanup waits for pending initialization, then disconnects. Use one configured URI per process; shut down/restart to switch databases rather than hot-swapping the singleton.
- Options: server selection timeout 10 seconds, connection timeout 10 seconds, socket inactivity timeout 45 seconds, maximum pool size 10, buffering disabled, automatic index creation enabled. These are small-app defaults, not a general connection framework. Ten-second selection favors startup feedback; a longer replica-set failover may still produce transient operation errors. No custom retry loop is added.
- Initial connection failure attempts cleanup and throws only `Database connection failed.`; cleanup failures use `Database cleanup failed.`. Raw driver exceptions/URIs/credentials are not propagated to logs or clients.
- src/start.ts connects, then awaits User.init(), then opens the HTTP listener. Initialization of the unique email index is part of readiness for future writes. Index initialization failure and HTTP bind failure both release the database and cause generic startup failure.
- SIGINT/SIGTERM share an idempotent shutdown promise. HTTP drains before database disconnect; database cleanup also runs if HTTP close reports an error. Shutdown during initialization does not subsequently open a listener. Signal handlers are removed after cleanup. A 10-second total shutdown deadline force-closes HTTP connections and exits 1 if cleanup cannot finish.
- src/index.ts validates startup configuration, logs readiness only after startServer resolves, and exits nonzero on failure. Generic error text does not expose URI or driver diagnostics.

`GET /api/health` retains its exact unauthenticated HTTP 200 `{"status":"ok"}` process-liveness contract and no-store header. No readiness endpoint was added. After a later database outage this health route still reports liveness; the MongoDB driver handles recovery. If dependency readiness is needed for deployment routing, propose a separate readiness endpoint in that milestone instead of silently changing health.

Reference: [Mongoose connections and timeout behavior](https://mongoosejs.com/docs/connections.html).

## Typed User model

src/models/user.ts defines an inferred UserRecord and reuses an existing compiled model to avoid recompilation errors. It stores only name, email, passwordHash, Mongoose's ID/version metadata and createdAt/updatedAt timestamps.

- Name: required, trimmed, 1–80 characters.
- Email: required, trimmed, lowercased, at most 254 characters, validated with Zod's email syntax rules.
- Password hash: required, 1–255 characters, excluded from ordinary queries with select:false. JSON serialization removes it even if explicitly loaded. No password field exists; strict:'throw' rejects unknown fields such as a plaintext password.
- Timestamps are maintained by Mongoose on persistence. The model does not hash or check passwords. Never put plaintext into passwordHash; authentication will supply real hashes in a later milestone.

The schema declares a unique `{email:1}` index. **MongoDB's built unique index enforces uniqueness; Mongoose unique is not a validator.** Startup awaits index initialization. Existing duplicates or missing index permissions cause startup failure rather than unsafe writes. Do not automatically drop data or indexes to resolve this. Later authentication must catch duplicate-key errors (including concurrent registration races) and return a safe duplicate-email response. Validation alone cannot prove uniqueness.

No production registration, login, password hashing, JWT/cookies or task model/route was added. This model's JSON protection is defense in depth; future API DTOs must still whitelist fields. The existing [authentication architecture proposal](authentication-decision.md) and anticipated same-origin API proxy remain unimplemented.

Reference: [Mongoose validation and unique-index caveat](https://mongoosejs.com/docs/validation).

## Verification results

Executed from the target repository using pnpm 10.15.1 and host Node 26.8.1. Node 24 was not separately run as a CI matrix in this milestone.

| Check | Actual result |
| --- | --- |
| pnpm --dir server install --frozen-lockfile | Passed |
| pnpm --dir server typecheck | Passed |
| pnpm --dir server lint | Passed, no errors/warnings |
| pnpm --dir server format:check | Passed |
| pnpm --dir server test | **47 passed, 0 failed, 7 test files passed** |
| pnpm --dir server build | Passed |

All original 16 tests and their files remain unchanged. The 31 added cases cover URI parsing/startup requirements, real in-memory model validation, normalization, required/invalid fields, index/selection definitions, JSON hash removal, concurrent connection initialization, failure sanitization/retry, cleanup coordination, startup/index ordering, startup failures, HTTP bind failure, HTTP-cleanup failure, signal-handler cleanup and interrupted initialization.

Database calls in connection/startup tests are mocked. Startup tests exercise real temporary loopback HTTP listeners with mocked DB/index initialization. User tests use real Mongoose schemas on unsaved documents without a database. **No successful live MongoDB connection, actual index build, duplicate insert, query projection or database-backed timestamp write was tested.** Those isolated integration tests remain necessary before authentication delivery. No Atlas deployment was contacted.

Compiled startup failure checks (separate from Vitest): missing URI and malformed URI each exited 1 with a sanitized config error and no ready log. An unused, reserved loopback port produced a real Mongoose connection failure after approximately 10.1 seconds; the process exited 1 without logging the URI or raw driver error and without reporting HTTP readiness. The check invoked compiled dist/index.js directly with controlled environment values, not a real .env file.

Compiled checks exposed a CommonJS/ESM named-import incompatibility that the Vitest transform did not detect. Switching the User model to Mongoose's default import resolved it; the full suite/build and compiled failure checks were rerun successfully. A cleanup-ordering test also caught and verified the fix ensuring database disconnect runs after HTTP-close errors.

The 10-second forced-exit branch and actual MongoDB drain/reconnection under load were not exercised. pnpm's existing ignored-esbuild-script notice remained; the installed platform binary supported all executed tooling without broad script approval. No deployment occurred.

## Changed files and manual Git handoff

Modified:

```text
README.md
server/.env.example
server/README.md
server/package.json
server/pnpm-lock.yaml
server/src/config/env.ts
server/src/index.ts
```

Added:

```text
docs/phase-3.2-database.md
server/src/database/connection.ts
server/src/models/user.ts
server/src/start.ts
server/tests/database-env.test.ts
server/tests/database.test.ts
server/tests/start.test.ts
server/tests/user.test.ts
```

No unexpected changes are intended. Prototype, app.ts, middleware and existing tests are preserved. Existing ignore rules exclude actual environment files, node_modules, dist, coverage and logs; .env.example is intentionally included. Source/documentation scanning found no known secret patterns. This check is not a guarantee against every possible secret; review staged content yourself.

Run these commands yourself, from the repository root:

```bash
cd '/Users/mavery/Documents/Codex-workspace/AppRo8 Internship 1/week2/task-manager-fullstack'
git status --short --branch
git diff --check
git diff -- README.md server/
git ls-files --others --exclude-standard
git add -- README.md docs/phase-3.2-database.md server/
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached -- server/.env.example server/src server/tests
git commit -m "feat(database): add MongoDB connection and user model"
git status --short --branch
git push origin main
```

Inspect the staged name list and content before committing. The commands use the verified main branch and no force push. Only the user runs staging, commit and push commands; the agent executed none. Wait for explicit authorization before Phase 3.3.
