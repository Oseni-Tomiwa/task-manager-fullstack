# Phase 4.2 — Full-stack integration

Verified locally November 1, 2026. No deployment or Phase 5 implementation.

## Checkpoint and approved approach

Phase 4.1 was committed and pushed at `30c5e48757399974eb2c0797da3ae6e37f3a8159`. Local main, origin/main and a fresh read-only GitHub main lookup matched; the working tree was clean. Existing backend **176/176** and frontend **22/22** tests passed before implementation. Sandbox filesystem/network failures were rerun with required permissions, not treated as application failures.

The user approved [the design](superpowers/specs/2026-10-31-fullstack-integration-design.md) and requested [an implementation plan](superpowers/plans/2026-10-31-fullstack-integration.md), followed by incremental execution. Work used an isolated file-only scratch copy, with only intended files copied back for final checks; no Git worktree/branch/staging/commit operation was performed. The prototype remains unchanged.

## Architecture and decisions

The existing React components and approved styles remain in place. `useSession` replaces preview authentication; `useTasks` replaces preview task storage. The small typed fetch helper is the only client HTTP boundary. No new dependencies, shared package, state library, repository/service backend layer, refresh-token infrastructure or production database configuration was introduced.

`GET /api/tasks/summary` returns `{data:{summary:{total,todo,in_progress,completed}}}` with numeric zero defaults. One aggregation matches the authenticated owner's explicitly cast ObjectId and groups by status. This avoids four extra independent list/count requests. The static route precedes ID validation, requires a valid session/current user, rejects all query parameters, uses no-store, and exposes only counts. No owner/filter input or sensitive fields are accepted/returned. Existing CRUD/query contracts remain unchanged.

Global summary counts are independent of search, filters and page. The task list uses server metadata, six rows per page, and server ordering (`createdAt` descending, then `_id` descending). Search is debounced approximately 300 ms; search/filter changes reset page. Obsolete reads are aborted, and late results are ignored even when a transport does not honor cancellation. Removing a final page row recovers to the last available page.

Writes are pessimistic and guarded against duplicate submission. Recoverable errors preserve form values or delete confirmation. A successful mutation invalidates list/summary reads without awaiting those refreshes: a refresh failure produces a separate retryable load state, never a false failed-write result. Summary failure is independent and never becomes fabricated zero totals. The New task control remains usable after an initial successful load, including later refreshes, to preserve modal focus restoration.

## Authentication lifecycle and security

The browser calls `/api/auth/me` before protected-route decisions. Missing sessions become anonymous; network/server restoration errors offer retry. Login/registration return only public user DTOs and establish the existing HttpOnly JWT cookie. No token enters JSON, localStorage or sessionStorage. Server field errors remain accessible, inputs remain after recoverable failures, and overlapping auth requests reject honestly instead of silently appearing successful.

Protected API 401s clear all private UI, tasks and dialogs, navigate to login and explain that the session expired. Session epochs prevent obsolete request failures from invalidating a newer session. Aborted list/summary responses cannot restore old data. Logout clears client state only after server success; a failed logout remains retryable. The existing 30-minute JWT and cookie lifetime have no silent refresh. Stateless logout cannot revoke a copied JWT before expiry.

The client sends same-origin credentials and no-store, JSON plus `X-TaskFlow-Request: 1` on mutations, and `{}` for logout/DELETE. The browser supplies Origin. Existing exact Origin/header/JSON CSRF checks and ownership enforcement remain enabled; no permissive CORS or trust-proxy change was added. User/task DTOs continue to exclude tokens, password hashes and internal ownership/model fields.

## Local environment and proxy

See [client setup](../client/README.md) and [server setup](../server/README.md). Backend: loopback port 3000, a private signing secret, authorized development `MONGODB_URI`, and exact `CLIENT_ORIGIN=http://127.0.0.1:5173`. Frontend: strict loopback port 5173 and public `VITE_API_BASE_URL=/api`. Do not run the prototype on the same port.

Vite forwards `/api` to fixed `http://127.0.0.1:3000` with `changeOrigin: false`, preserving browser Origin and cookie headers. Changing an origin/port requires changing the corresponding explicit server/client configuration; `localhost` and `127.0.0.1` are different origins. No secret belongs in `VITE_` variables. Real environment files remain ignored. The development proxy is not bundled into a static build; `pnpm preview` alone does not verify a production API proxy.

Live verification safely parsed only the existing dedicated integration configuration before connection. Its target exactly matched the authorized loopback host/port/database from Phase 3.5 (`127.0.0.1`, port `27018`, `taskflow_integration_test`), without credentials/options. No connection strings or credentials were logged. No Atlas access, cloud resource changes or production connection occurred. Verification used an ephemeral signing secret rather than writing a reusable secret into the repository.

## Automated verification

Final commands executed in the source repository (not only the scratch copy), using Node.js **26.8.1** and pnpm **10.15.1**. The declared Node.js 24.10+ floor was not separately run as a CI matrix:

| Application/check                    | Result                                              |
| ------------------------------------ | --------------------------------------------------- |
| Client `pnpm typecheck`              | Passed                                              |
| Client `pnpm lint`                   | Passed, no errors/warnings                          |
| Client `pnpm format:check`           | Passed                                              |
| Client `pnpm test`                   | **39 passed, 0 failed; 5 files**                    |
| Client `pnpm build`                  | Passed; JS 289.88 kB / 92.18 kB gzip                |
| Server `pnpm typecheck`              | Passed                                              |
| Server `pnpm lint`                   | Passed, no errors/warnings                          |
| Server `pnpm format:check`           | Passed                                              |
| Server `pnpm test`                   | **184 passed, 0 failed; 12 files**                  |
| Server `pnpm test:integration`       | **16 passed, 0 failed; 1 file; real local MongoDB** |
| Server `pnpm build`                  | Passed                                              |
| Git whitespace / intended-file audit | Passed; no staged files or prototype changes        |

The first final client formatting check flagged one API test file and stopped before test/build. Prettier corrected it; the complete client sequence was rerun and passed as reported above. Earlier expected test-first failures established the missing behaviors; those are not counted as passing tests. No dependency or lockfile change was necessary.

Backend routine tests mock persistence boundaries; real JWT, bcrypt, HTTP middleware and Mongoose schema validation remain exercised as documented in earlier phases. The separate integration suite uses actual MongoDB and HTTP, not database mocks. New summary tests cover empty/mixed counts, authentication, owner ObjectId casting, unsupported queries, safe errors, no-store and real owner isolation.

Frontend tests exercise the real HTTP helper with controlled fetch responses and jsdom: restoration/protection/retry, register/login/logout, retained inputs/field errors, network/server failures, protected-401 expiry, overlapping auth, CRUD/status transitions, duplicate writes, backend queries/pagination, global summary, empty states, stale/cancelled reads, successful-write/failed-refresh separation and keyboard focus recovery. Existing component and validation tests remain. Preview-specific assumptions were replaced with API-response fixtures confined to test files.

A separate ad hoc run imported the actual client helper and performed **15 assertion groups** through the running Vite proxy, Express app and real MongoDB: login/current user, cookie attributes/forwarding, public DTO fields, paginated totals versus summary, missing/hostile Origin and missing security header rejection without writes, malformed ID, guest denial and logout cookie clearing. These are HTTP assertion groups, not additional Vitest test cases; the temporary verification launcher is not a production feature.

## Actual browser walkthrough

The available in-app Chromium browser exercised the real frontend/backend/database at http://127.0.0.1:5173, with no mocked API responses:

- Registered a disposable account and saw the empty workspace; created tasks and reloaded to verify session restoration and persistence.
- Edited title/description/status; completed and reopened tasks, with accurate global status counts.
- Searched to an empty result and cleared filters; selected Completed with no matches while global counts remained unchanged.
- Created seven records, verified six-row page one and one-row page two in descending creation order; deleting the last page-two task returned to page one.
- Verified create/edit/delete dialogs, safe initial focus, keyboard Tab wrapping, native Escape cancellation and focus restoration.
- Verified the reviewed keyboard fix live: Enter on Next focuses the tasks heading after loading; Space on a completion control focuses its replacement after saving.
- Logged out and reloaded without a session; rejected an incorrect password, retained the form, then logged in successfully.
- Verified real protected-401 handling by removing only the disposable verification account during cleanup, then making a task search request: the workspace cleared and login displayed the session-expired message. This verifies the browser's 401 path; it is **not** a claim that the walkthrough waited 30 minutes for JWT expiry.

Responsive checks used explicit **360×800**, **768×1024** and **1440×1000** viewports. Dashboard and auth layouts were inspected; mobile/tablet/desktop dialogs fit and remained usable. Measured document/client widths matched (360px viewport with ordinary scrollbar: 345/345; modal: 360/360; tablet: 768/768; desktop: 1440/1440), showing no horizontal overflow in exercised states. Desktop edit and tablet create dialogs measured 520px wide; mobile confirmation measured 332px. Full-page dashboard captures and viewport dialog captures are included below. Viewport override was reset afterward.

Screenshots document real disposable test data, not prototype fixtures. They do not certify every combination of screen, content, browser and viewport.

## Screenshots

- [Mobile dashboard](screenshots/phase-4.2/mobile-dashboard.png)
- [Mobile registration](screenshots/phase-4.2/mobile-registration.png)
- [Mobile create dialog](screenshots/phase-4.2/mobile-create-dialog.png)
- [Mobile edit dialog](screenshots/phase-4.2/mobile-edit-dialog.png)
- [Mobile delete confirmation](screenshots/phase-4.2/mobile-delete-confirmation.png)
- [Mobile session rejection](screenshots/phase-4.2/mobile-session-expired.png)
- [Tablet dashboard](screenshots/phase-4.2/tablet-dashboard.png)
- [Tablet create dialog](screenshots/phase-4.2/tablet-create-dialog.png)
- [Tablet login](screenshots/phase-4.2/tablet-login.png)
- [Desktop dashboard](screenshots/phase-4.2/desktop-dashboard.png)
- [Desktop edit dialog](screenshots/phase-4.2/desktop-edit-dialog.png)
- [Desktop login](screenshots/phase-4.2/desktop-login.png)
- [Initial mobile empty workspace](screenshots/phase-4.2/mobile-dashboard-empty.png)

## Review, cleanup and limitations

An independent source review found two P2 issues: overlapping authentication silently returning success, and task reloads losing keyboard focus. Both received failing regression tests, corrections and follow-up review; no remaining important finding was reported. Focus recovery also has a regression ensuring a user who moved to Search keeps focus. A separate TypeScript test-fixture return annotation and React ref/lint issue were corrected without disabling rules. Final checks below are the final outcome; initial development failures are not omitted or counted as passing.

The real MongoDB suite cleans only UUID-tagged run users and their tasks. Browser verification cleaned its exact disposable email/name/ID and only owned `Phase42 `-prefixed tasks: seven remaining tasks and one account, then a recreated empty account used for the 401 check. Final matching users/tasks were zero. No databases/collections, indexes or unrelated user data were dropped or deleted.

No deployed Vercel/Render, Atlas, TLS browser, Safari/Firefox, full screen-reader, performance/load, replica failover or concurrent multi-tab certification was performed. Browser network/server write-failure recovery and duplicate submission are automated controlled-response checks, not claimed as manually forced live outages. The 30-minute timed browser expiry was not waited out. DTOs remain compile-time typed; unexpected successful JSON shape validation is not introduced in this milestone. A network disconnect after a server has written but before acknowledgment remains an uncertain outcome; no idempotency infrastructure is added speculatively.

List/count/summary reads are separate snapshots; offset pages can drift under concurrent writes. No polling or live collaboration is added. The existing in-memory authentication limiter and default proxy-IP behavior require deployment review. Verification servers used the dedicated test database and ephemeral secret and were stopped after the walkthrough; no local preview server is left running by this milestone. The tested address was http://127.0.0.1:5173. Their startup did not configure a persistent production environment.

## Phase 5 deployment gates — documentation only

1. Fix the backend upstream in Vercel configuration. Route `/api/:path*` to Render `/api/:path*` **before** the SPA fallback; unknown API routes must return JSON errors rather than index.html.
2. Set the exact allowed HTTPS frontend `CLIENT_ORIGIN`, production NODE_ENV, private signing key, authorized Atlas URI and Render bind HOST/PORT. Do not trust forwarded Host to choose an origin/upstream.
3. Verify Cookie/Set-Cookie, Origin and custom header forwarding end to end. Production cookie must be `__Host-taskflow`, HttpOnly, Secure, SameSite=Lax, Path=/ and no Domain. Personal API responses and errors must not be cached.
4. Verify deployed login, reload restoration, writes, hostile/missing/null Origin rejection, logout and expired sessions in a real browser. Local HTTP success does not establish production HTTPS/proxy behavior.
5. Inspect the actual Vercel/Render proxy chain before configuring narrowly scoped Express trust proxy and rate-limit client IP handling; do not blindly enable trust proxy. Default preview origins remain unauthorized until deliberately configured.

No deployment files or infrastructure changes are authorized by this checklist. Phase 4.2 stops for review.

## Changed files and manual Git handoff

**20 modified, 21 added (including 13 screenshots), 1 deleted: 42 paths total.** No unexpected changes.

Modified:

```text
README.md
client/.env.example
client/README.md
client/src/App.tsx
client/src/api/client.ts
client/src/api/contracts.ts
client/src/components/Modal.tsx
client/src/components/TaskForm.tsx
client/src/components/TaskList.tsx
client/src/components/TaskSummary.tsx
client/src/pages/AuthPage.tsx
client/src/pages/Dashboard.tsx
client/src/styles.css
client/src/tests/api.test.ts
client/src/tests/app.test.tsx
client/vite.config.ts
docs/authentication-decision.md
server/README.md
server/src/tasks/routes.ts
server/tests/integration/mongo.integration.ts
```

Added:

```text
client/src/auth/useSession.ts
client/src/tasks/useTasks.ts
client/src/tests/httpFixture.ts
client/src/tests/session.test.tsx
docs/phase-4.2-fullstack-integration.md
docs/screenshots/phase-4.2/desktop-dashboard.png
docs/screenshots/phase-4.2/desktop-edit-dialog.png
docs/screenshots/phase-4.2/desktop-login.png
docs/screenshots/phase-4.2/mobile-create-dialog.png
docs/screenshots/phase-4.2/mobile-dashboard-empty.png
docs/screenshots/phase-4.2/mobile-dashboard.png
docs/screenshots/phase-4.2/mobile-delete-confirmation.png
docs/screenshots/phase-4.2/mobile-edit-dialog.png
docs/screenshots/phase-4.2/mobile-registration.png
docs/screenshots/phase-4.2/mobile-session-expired.png
docs/screenshots/phase-4.2/tablet-create-dialog.png
docs/screenshots/phase-4.2/tablet-dashboard.png
docs/screenshots/phase-4.2/tablet-login.png
docs/superpowers/plans/2026-10-31-fullstack-integration.md
docs/superpowers/specs/2026-10-31-fullstack-integration-design.md
server/tests/summary.test.ts
```

Deleted:

```text
client/src/preview/workspace.ts
```

The intended-file audit found no private key, credential-bearing MongoDB URI, GitHub/AWS token or literal JWT patterns in changed text files. Synthetic credentials in tests are test inputs, not real accounts. No actual environment file, node_modules, dist, coverage, cache or verification launcher is included. Existing ignore rules cover real environment files and generated output. The compiled client was checked for the removed preview notice/credentials and server/integration secret names; none were found. The 13 screenshots total about 0.58 MB.

Only the user executes staging, commits and pushes. The following commands are provided for manual execution and were **not** executed by the agent:

```sh
cd '/Users/mavery/Documents/Codex-workspace/AppRo8 Internship 1/week2/task-manager-fullstack'
git status --short --branch
git diff --check
git diff --stat
git diff -- README.md client/ server/ docs/authentication-decision.md
git ls-files --others --exclude-standard
# Also review every untracked source/test/doc file and the screenshots listed above.
git add -- README.md client/ docs/authentication-decision.md docs/phase-4.2-fullstack-integration.md docs/screenshots/phase-4.2/ docs/superpowers/plans/2026-10-31-fullstack-integration.md docs/superpowers/specs/2026-10-31-fullstack-integration-design.md server/README.md server/src/tasks/routes.ts server/tests/summary.test.ts server/tests/integration/mongo.integration.ts
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached
# Confirm only the 42 intended paths, including the deleted preview module.
# No private .env, dependencies, build output, caches or real credentials should be staged.
git commit -m "feat(integration): connect TaskFlow client to backend"
git status --short --branch
git push origin main
```

The agent performed no staging, commits, pushes, destructive Git operations or history rewriting. Both milestone predecessors already have commits: Phase 3.5 `e356ab2`, Phase 4.1 `30c5e48`.
