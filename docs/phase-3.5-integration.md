# Phase 3.5 — Real MongoDB integration testing

Verified on 2026-10-31. Scope is backend persistence and HTTP integration only.

## Safety prerequisites

- Existing `taskflow-test-mongo` container was running; MongoDB ping returned `{ ok: 1 }`.
- `server/.env.integration` existed, was Git-ignored and untracked.
- Its `INTEGRATION_MONGODB_URI` selected host `127.0.0.1`, port `27018`, database `taskflow_integration_test`. No credentials or complete connection strings were printed.
- Starting working tree was clean on `main`, with zero commits ahead/behind `origin/main`. An online `git fetch --dry-run origin` succeeded without reporting remote changes.
- No staging, commits, pushes, history rewriting, collection/database drops, frontend changes, prototype changes, or deployment were performed.

## Implementation and execution

Added an explicitly selected Vitest integration configuration, `test:integration` script, and `tests/integration/mongo.integration.ts`. The existing default suite remains independent of MongoDB. No dependencies or production source files changed.

The suite reads only the dedicated integration environment file and refuses to connect unless its target is exactly the local test database above. Credentials, URI options, alternate hosts, and alternate database names are rejected before connection. Authentication uses an ephemeral random signing key.

The suite starts the actual Express app on an ephemeral loopback port and uses Supertest HTTP requests with real Mongoose models and MongoDB queries; database operations are not mocked. Each run uses UUID-tagged email addresses and task titles. Teardown finds only that run's exact email addresses, deletes tasks belonging to those users, deletes those users, verifies zero remaining matching records, closes HTTP, and disconnects Mongoose. Missing indexes are initialized through the application's normal model initialization; existing indexes are never dropped or reconciled.

## Verified results

| Check                                           | Result                   |
| ----------------------------------------------- | ------------------------ |
| Existing isolated/mocked backend suite          | **176 passed**, 11 files |
| Real MongoDB + HTTP integration suite           | **15 passed**, 1 file    |
| TypeScript (`tsc --noEmit`)                     | Passed                   |
| ESLint (`eslint .`)                             | Passed                   |
| Formatting (`prettier --check .`)               | Passed                   |
| Production build (`tsc -p tsconfig.build.json`) | Passed                   |
| Git whitespace check                            | Passed                   |

Real-database coverage:

- Connection, MongoDB ping, disconnect/reconnect with persisted records, final pool shutdown.
- Actual unique email index metadata and duplicate insert error `11000`; duplicate registration returns `409` after email normalization.
- User creation/update timestamps; bcrypt cost 12 and password comparison; password hash excluded from ordinary queries, serialized documents, and authentication responses.
- Registration for two users, successful login, incorrect and unknown credentials, `/me`, and logout cookie expiration.
- HttpOnly, SameSite, path, and lifetime cookie attributes; missing/wrong origins, missing custom CSRF header, and unsupported mutation content types rejected without writes.
- Task creation, retrieval, partial update, timestamps, deletion, and subsequent missing-record responses.
- Case-insensitive literal title search including regex characters; combined status filtering, counts, pagination metadata, empty pages, and repeated stable descending `_id` sorting with deliberately tied creation timestamps.
- Both users own tasks; lists and search stay owner-scoped, and cross-user reads/updates/deletes return `404` without changing the victim's record.
- Invalid registration/task input, ownership injection, invalid IDs/status/query parameters, missing and malformed sessions, and unauthenticated task mutations.

## Defects and execution limitations

No backend defects were uncovered; no product fixes or unrelated refactoring were needed. An ESLint issue in the new test helper was corrected before final verification.

The initial sandboxed test attempts could not open HTTP/MongoDB sockets. Both suites passed when rerun with local socket access. The `pnpm` launcher also failed to fetch/verify the project's pinned package-manager version in the restricted environment. Verification therefore invoked existing `server/node_modules/.bin` executables directly, using the same commands configured in package scripts. No dependency installation, lockfile change, or signature-check bypass was used.

This verifies local single-node MongoDB and loopback HTTP, not TLS, browser cookie behavior, a deployed service, replica-set failover, load/performance, or OS-signal shutdown of a separate production process. Logout expires the browser cookie; existing stateless JWTs are not server-revoked. Forced process termination can prevent teardown; UUID-tagged fixtures make such leftovers identifiable, but the suite does not perform broad cleanup of previous runs. Normal teardown assertions passed on each successful integration run. A separate read-only MongoDB check after the final run returned ping `1`, zero remaining Phase 3.5 users, and zero remaining Phase 3.5 tasks.

## Reproduce

With the existing container running and the ignored integration file configured, from `server/`:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:integration
pnpm build
```

When the package-manager launcher is unavailable, the exact local equivalents are:

```sh
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
./node_modules/.bin/prettier --check .
./node_modules/.bin/vitest run
./node_modules/.bin/vitest run --config vitest.integration.config.ts
./node_modules/.bin/tsc -p tsconfig.build.json
```

Both test commands require permission to open local sockets. The integration file is never loaded by the ordinary test command.

## User-owned Git handoff

Run from the repository root after review. These commands were not executed by the agent:

```sh
git status --short
git diff --check
git diff -- server/package.json
cat server/vitest.integration.config.ts
cat server/tests/integration/mongo.integration.ts
cat docs/phase-3.5-integration.md
git add -- server/package.json server/vitest.integration.config.ts server/tests/integration/mongo.integration.ts docs/phase-3.5-integration.md
git diff --cached --check
git diff --cached
git commit -m "test: verify backend against real local MongoDB"
git push origin main
```

Phase 3.5 stops here for review.
