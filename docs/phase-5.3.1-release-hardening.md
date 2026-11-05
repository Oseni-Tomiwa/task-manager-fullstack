# TaskFlow — Phase 5.3.1 release hardening

Date: November 5, 2026 (Africa/Lagos). Local implementation/verification only. Baseline commit: `590a5a178c7c6a991ac1d53cc1566a2ad54b0069`.

## Scope, Git checkpoint and current decision

Local `main`, `origin/main` and actual GitHub `main` matched the baseline above (`0/0` ahead/behind) before edits. The prior untracked `docs/phase-5.3-production-qa.md` was preserved and updated as requested; the unrelated `.pnpm-store/` was left untouched. No staging, commits, pushes, history operations, deployments or production requests/data changes were performed during this milestone.

**Local correction complete; production proxy identity remains a release blocker.** The user previously verified all eight core deployed workflows. The public HTTP results in the Phase 5.3 report are historical November 4 evidence, not repeated production tests on November 5. Current authenticated two-account/cache, viewport and keyboard acceptance remain pending.

On November 5 the owner confirmed that the exposed Atlas `taskflow_app` password was rotated, Render uses the replacement credential, and `STARTUP_DIAGNOSTICS` is disabled on Render. These are **OWNER-CONFIRMED, NOT INDEPENDENTLY VERIFIED**. Neither old nor replacement credentials were read or printed. The official Task 2 requirements and submission fields supplied in project context are accepted as the assignment contract; no separate portal verification or submission occurred.

## A — Save/retry race: finding and minimal correction

The previous Phase 5.3 client run failed at the immediate refreshed-task assertion after the dialog disappeared. An isolated baseline run in this milestone passed, consistent with an intermittent race. Source inspection establishes separate lifecycles:

1. `useTasks.mutate()` awaits the write, increments the revision and completes without waiting for the list refresh.
2. Dashboard awaits that write operation and closes the dialog.
3. A separate effect performs the refreshed list request and updates the visible rows.

Closing the dialog is therefore not a barrier for refreshed-row rendering. It intentionally does not turn a later read failure into a failed write; the existing successful-write/failed-refresh test preserves that UX contract.

To reproduce deterministically, the existing save/retry test now holds only the post-retry list GET with the existing `deferred<Response>()` helper. It allows the retry POST to complete, confirms the dialog closes, confirms exactly one fixture task was persisted, and confirms the refreshed row is still absent. Releasing that response while retaining the original synchronous `getByText` assertion produced a failing test at the expected row assertion. Replacing only that final query with `await screen.findByText(...)` made it pass.

All original validation, disabled Saving/close-button, cancel-blocking, retained title/description and retry assertions remain. No test was skipped, no timeout increased and no UI or production refresh code changed. The explicit gate adds regression coverage for a slow read after a successful write, rather than relying on scheduler timing. The deferred response releases a six-row snapshot from the fixture; it adds no production behavior.

**Conclusion:** faulty test synchronization explains this failure; no application state-refresh defect was demonstrated. The test still fails if the refreshed row never arrives. Ten isolated executions of the corrected, gated test passed; the full-suite results appear below.

## B — Proxy identity and limiter recommendation (plan only)

Source review: `server/src/app.ts` leaves Express trust proxy at false. `server/src/auth/routes.ts` shares a 10-attempt/15-minute in-memory limiter across registration/login without a custom key. The installed limiter derives its key from `request.ip`, with its normal IPv6 subnet normalization (default /56). The existing forwarded-header validation warning is suppressed; that does not validate peer identity. No settings or middleware were changed here.

**Multiple legitimate clients can share a limiter identity:** requests reaching the same apparent Render proxy peer derive the same key, irrespective of their original client addresses. A local synthetic check used the actual Express request getter and installed limiter IP normalizer: different forwarding values with the same socket peer produced equal keys while trust proxy remained false. This establishes the key-sharing mechanism without production traffic. Source plus provider documentation establishes the deployment risk; this milestone did not measure the deployed key distribution or prove every visitor shares one global bucket. NAT and IPv6 subnet grouping can also legitimately share a budget, so a future test should use genuinely distinct controlled public networks.

Provider documentation reviewed November 5:

- [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/): false derives the address from the socket; trust must match the actual chain, with particular caution about arbitrary headers and unequal hop counts.
- [Render ingress/client-IP guidance](https://render.com/articles/how-render-handles-ddos-attacks): Cloudflare and Render load balancers sit in front of the app, which sees a proxy address by default. This general guidance does not establish the complete sanitizer/chain contract for this particular service.
- [Vercel request headers](https://vercel.com/docs/headers/request-headers): documents forwarded client-IP fields and overwriting of external X-Forwarded-For values.
- [Vercel external-origin rewrites](https://vercel.com/docs/routing/rewrites#identifying-the-visitor-at-your-origin): forwards visitor identity headers and advises trusting them only for authenticated Vercel-origin traffic. Its adjacent origin-restriction guidance describes a private secret header overwritten by Vercel and verified at the origin.

Direct Render is publicly reachable (verified in Phase 5.3). A direct caller can supply a canonical Origin and counterfeit Vercel/X-Forwarded-* headers. Origin protects browser CSRF; it does not authenticate a reverse proxy. Neither provider documentation nor HTTP response headers prove the effective server-side identity. Blind trust, a guessed hop count, trusting all private ranges, or unconditionally taking an X-Real-IP/X-Vercel-Forwarded-For field is unsafe across the two paths. Do not increase the budget or disable validation to mask aggregation.

### Smallest safe next step and approval boundary

Keep the current trust/limiter unchanged until a **separately approved temporary observer** establishes the chain. Proposed design, not implemented:

1. An opt-in, secret-gated observer on the existing health route with a 15-minute TTL and eight-observation cap. Use fixed probe tags; reject arbitrary diagnostic payloads. Health response stays unchanged. No public debug route, IP reflection or raw header/error logging.
2. Two owner-controlled networks with different known egress identities, privately designated before the run. For each network, send one baseline and one synthetic spoof-header request through direct Render and through Vercel: eight health requests, zero login/register attempts.
3. Inspect a bounded socket/forwarding chain internally. Emit only fixed case tags, hop counts, equality-group labels or matches-expected booleans for candidate/current keys and spoof-marker survival. Never record raw client IPs, full headers, gate secrets or session tokens. Treat malformed/oversized chains as a failed diagnostic, not trusted input.
4. Compare both clients' current keys. Equal keys confirm the observed aggregation for that path; differing keys on one run do not guarantee stable identity. Candidate client extraction must match each controlled network and remain unchanged by synthetic spoofing on both paths. Raw observer access is limited to the designated requests and removed afterward.

**Conditional correction:** if provider-supported ingress boundaries and measurements support a narrow trust rule that works on both paths, propose that exact rule with spoofing/IPv6 regression tests. Otherwise the smallest defensible boundary is a Vercel-overwritten, environment-backed secret header checked in constant time before trusting an explicitly defined single client-address field for authentication rate limiting; direct auth traffic without that provenance would be rejected, while intentionally public health access could remain. Preserve default Express trust if a scoped key extractor suffices. This fallback changes direct API behavior and needs its own reviewed code/configuration plan and deployment approval. It is not selected or implemented by this document.

Verification of any later correction: local tests cover valid/invalid proxy provenance, spoofed IP/Origin/host/proto fields, malformed/multiple addresses, IPv6 normalization and independent client keys. Once deployed under separate authorization, use the same eight-request health observer matrix and at most one benign auth-validation request per controlled client/path. Do not exhaust a production rate bucket. Remove the observer and confirm it is disabled. No distributed store or new auth feature is justified for the current single-instance assignment.

## C — Submission documentation and official requirements

The root README now describes the deployed application, canonical URLs, implemented functionality, architecture, production cookie/CSRF contracts, relative `/api`, no-store rules, Node 24/pnpm setup, private environment requirements, test/build commands and Render Free behavior. Prototype evidence and all historical milestone links remain clearly identified as history. Current dashboard configuration is described as reviewed configuration, not independently inspected cloud state.

The owner-supplied official Task 2 contract is:

- Public GitHub repository named `task-manager-fullstack` containing React frontend and Node.js backend.
- Authentication/task CRUD, search/filter, loading/error handling and responsive design.
- Deployed frontend and backend; comprehensive README; public reviewer access.
- Submission URL: https://github.com/Oseni-Tomiwa/task-manager-fullstack
- Live/Demo URL: https://task-manager-fullstack-vert-five.vercel.app
- Additional Live/Demo URL or Comments: https://task-manager-fullstack-4wf9.onrender.com
- Deadline November 12, 2026; cutoff time/timezone not specified in the supplied instructions.

No further official-brief lookup is a blocker. The owner still enters the submission fields and verifies the portal-specific cutoff. No assignment submission was performed.

## D — Controlled two-account acceptance procedure (NOT EXECUTED)

This procedure is prepared only. It does not authorize creating accounts or changing production records now. A browser host was unavailable during Phase 5.3; no browser attempt or production interaction is claimed for this local milestone.

### Exact execution authorization needed

The owner must explicitly approve a named run/window against the canonical production frontend/API, creating **two new disposable accounts and three synthetic tasks**, the specific cross-owner GET/PATCH/DELETE negative probes below, and exact cleanup of those three run records. Negative mutation probes are expected to fail but could alter/delete those disposable targets if a defect exists; that risk must be expressly accepted. No other user's data may be viewed, changed or deleted. Approval must specify whether the two accounts remain afterward; the app has no account-deletion endpoint, so account removal requires a separate owner-managed, separately authorized cleanup rather than an improvised database command.

Use a unique run label such as `phase531-<UTC-date>-<random-suffix>`. Designate account A/B synthetic aliases under `example.com` and display names `QA A`/`QA B`; verify no collision before use by registering new accounts, not reusing existing ones. Generate distinct passwords privately and enter only into the intended canonical application; never put credentials/cookies into commands, reports, screenshots, console logs or a HAR export. Keep credentials only in an owner-approved private store or ephemeral isolated test contexts. No mail delivery is needed by the current application.

Use two clean browser profiles/contexts, not two tabs sharing a cookie jar. Use a third clean unauthenticated context only for public/protected rejection checks. Do not access an existing logged-in personal session. Avoid a traffic burst and stop on any unexpected response, ownership leak or 429; do not rotate identities to bypass limits. Budget no more than two registrations and two subsequent logins in one run, no production rate-limit exhaustion. Aim for at most 60 API requests total; if a failure/retry would exceed scope, stop and ask for a new window.

### Reproducible sequence and expected outcomes

1. **Fresh baseline:** register A and B in their isolated contexts. Record only status codes and A/B labels. Each workspace must initially be empty; if unexpected records exist, stop. Check fresh Set-Cookie attributes privately: expected host-only `__Host-taskflow`, Secure, HttpOnly, SameSite=Lax, Path=/, approximately 30-minute lifetime and no Domain. Confirm no JWT in response JSON, localStorage or sessionStorage without copying values.
2. **Create three records:** A creates `<run>-A-todo` (todo) and `<run>-A-done` (completed); B creates `<run>-B-progress` (in_progress). Capture only their three synthetic IDs privately for the allowlisted probes/cleanup; do not enumerate unrelated IDs. Expected A summary: total 2, todo 1, completed 1, in_progress 0. B: total 1, in_progress 1, other counts 0. Reload both; names/counts persist. Search/filter must show only the matching owned synthetic records; summary remains global.
3. **Ownership negative probes:** in each account's authenticated context, GET one known foreign task, PATCH its synthetic description, and DELETE that same foreign task. All six probes must return the existing safe 404 contract, with no token/hash/owner details. Retain canonical Origin, JSON and required header so CSRF rejection does not masquerade as ownership protection. After each mutation attempt the owning context verifies that exact record is unchanged/present. Stop immediately if a probe succeeds; do not continue testing a demonstrated access-control defect. No unknown-record scanning.
4. **Session boundaries:** each profile's `/api/auth/me` must identify only its own synthetic account. In a fresh direct-Render context without copied frontend cookies, `/api/auth/me` must return 401. Do not manually copy cookies across hosts. Log out A: its protected reads become 401 and private UI clears, while B's authenticated reads still succeed. Log in A once to test deliberate recovery. Clearing and creation cookies must use the same name/path/security scope; session values stay private. Stateless logout does not revoke a stolen JWT.
5. **Authenticated cache isolation:** use exactly identical canonical `/api/auth/me`, `/api/tasks`, and `/api/tasks/summary` URLs, without cache-busting query parameters. Alternate A → B → A in separate cookie jars using the application's normal fetch policy. Inspect JSON privately; A never receives B's identity/task and vice versa. Authenticated responses, errors and Set-Cookie responses must be no-store with no cached personalized reuse; no unexpected CDN HIT/Age evidence. A single MISS is insufficient: repeat identity separation and logout behavior. Static HTML cache hits are unrelated. Record only statuses, expected counts/booleans and safe cache directives, not bodies, full headers or HAR files.
6. **Expiration:** after session creation note only a timestamp; wait beyond the configured 1,800 seconds for one isolated test session, then its protected request must return 401 and explain expiry. Do not edit a JWT or print it. This passive wait is an optional separately scheduled continuation if it exceeds the approved window; otherwise record NOT VERIFIED. Other checks can proceed before expiry with an unexpired context.
7. **Cleanup:** only after ownership verification, use each owning account's normal UI/API to delete its exact run tasks and verify totals zero. Approval must cover irreversible deletion of these disposable records. Never use broad prefix deletion, deleteMany, direct Atlas access or cleanup of records merely resembling the run. If a negative probe already removed a task, record the defect and ask the owner how to proceed. Log out both; retain or remove accounts only according to the explicit account-retention decision.

If browser access remains unavailable, the owner can execute the same steps manually in isolated profiles and return redacted PASS/FAIL/status/count evidence. Do not silently substitute a simulated DOM test for production browser verification. Scripted HTTP QA, if separately authorized, must keep cookie jars in memory and emit only predetermined safe fields; it still cannot certify layout, browser cookie enforcement or keyboard behavior.

### Responsive, keyboard and reliability checklist

At 360, 768 and 1440 CSS pixels, check login/register, the two synthetic dashboards, summary, search/filter controls, task rows and create/edit/delete dialogs. Verify no horizontal overflow, clipped long synthetic titles, obscured controls or unusable touch targets. Capture only synthetic-data screenshots with no browser credential/session panels. The three-task run does not exercise multi-page production pagination; add a separately approved dataset of at least seven tasks only if that check is required.

Keyboard-only: Tab from skip link through sign-in/navigation/task actions, activate with Enter/Space, inspect visible focus, open a dialog and check forward/reverse focus wrapping, Escape/cancel when idle, blocked dismissal while saving, restored focus afterward, field-error associations and focus after route/page changes. Do not claim a screen-reader audit from these steps.

For failed-read/error handling, use browser-local offline/request blocking in the disposable context without disrupting the backend. Check retained input, retry and truthful write-success/refresh-error feedback. Do not deliberately issue a production write while simulating a network failure: an uncertain write may actually persist. Simulate a read-only failure after writes settle, restore networking, then verify the known record state before retrying any mutation. A controlled Free idle/wake check must be scheduled without unrelated traffic; record first-request duration and recovery rather than inducing a service restart or adding a keep-alive service.

## Verification results

| Check                               | Result                                                                                                                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline affected test              | Isolated unmodified run passed, matching the previously intermittent behavior.                                                                                                                                                    |
| Controlled red reproduction         | Held-refresh version with the original synchronous row assertion failed at the expected refreshed-row check.                                                                                                                      |
| Corrected affected test             | 10/10 separate Vitest invocations passed, each executing the affected test with the controlled refresh gate. Other tests were unselected only in these focused diagnostic runs; none were disabled in source.                     |
| Complete frontend suite             | 39/39 passed across five files.                                                                                                                                                                                                   |
| Complete backend default suite      | 233/233 passed across 15 files.                                                                                                                                                                                                   |
| Dedicated local MongoDB integration | 16/16 passed. The credential-free dedicated loopback target passed its exact URI guard and was listening before execution. Run-specific local records were created/cleaned by the existing suite. No production/Atlas connection. |
| TypeScript and ESLint               | Both applications passed.                                                                                                                                                                                                         |
| Formatting and Git whitespace       | Both application format checks and all three release documents passed Prettier; `git diff --check` passed. Nothing staged.                                                                                                        |
| Production builds                   | Client TypeScript check plus Vite build passed; server build TypeScript passed.                                                                                                                                                   |
| Local proxy-key demonstration       | PASS: actual Express getter plus installed IPv6-aware IP normalizer produced equal keys for different forwarding values behind the same synthetic socket peer. No deployed identity observation.                                  |

Checks used the installed CLI entry points under Node 24.22.1, equivalent to the package script tools, without dependency/lockfile changes or package-manager signature bypass. Final formatting and Git whitespace checks passed after documentation finalization. No new production requests, browser testing, cloud inspection, or dependency vulnerability audit was performed. Historical Phase 5.3 failures remain in its dated snapshot; the current full automated suites pass.

## Remaining gates and manual Git handoff

Production gate: proxy identity/key extraction and spoof resistance still require a separately approved diagnostic/correction plan. Authenticated two-account/session/cache, responsive/keyboard and controlled cold-start acceptance are prepared but not executed. Current platform runtime/commit and Atlas restriction/backup evidence remain owner verification tasks. Rotation/replacement/disabled diagnostics are no longer awaiting owner confirmation, but are not independently verified.

Changed paths: `README.md`, `client/src/tests/app.test.tsx`, the existing untracked `docs/phase-5.3-production-qa.md`, and new `docs/phase-5.3.1-release-hardening.md`. No backend source, security middleware, deployment configuration, dependency or infrastructure change.

The owner runs the following only after reviewing both reports and the test diff:

```sh
git status --short --branch
git diff --check
git diff -- README.md client/src/tests/app.test.tsx
cat docs/phase-5.3-production-qa.md
cat docs/phase-5.3.1-release-hardening.md
git add -- README.md client/src/tests/app.test.tsx docs/phase-5.3-production-qa.md docs/phase-5.3.1-release-hardening.md
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached
# Confirm exactly these four reviewed paths, with no secrets or unrelated files.
git commit -m "fix(test): synchronize save retry refresh and document release hardening"
git status --short --branch
```

Push, deployment and AppRo8 submission are separate owner decisions. This milestone stops at local verification and review.
