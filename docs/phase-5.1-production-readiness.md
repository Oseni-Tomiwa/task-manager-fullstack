# Phase 5.1 — Production readiness audit

Audit begun November 1; final verification November 2, 2026. Internal target: November 9; official deadline: November 12, 2026. **No deployment, hosting account/resource creation, Atlas connection/change or submission was performed.** Phase 5.2 requires separate approval.

## Verdict and checkpoint

The application is locally functional and the intended split-hosting design is practical, but it is **not yet certified for public production use**. Actual backend/frontend hostnames, Atlas access, production proxy/cookie behavior and trustworthy client-IP rate limiting are unresolved release gates. Local success is not evidence of a Vercel/Render deployment.

Before this audit, main, origin/main and an independent `git ls-remote` of actual GitHub main all matched Phase 4.2 commit `19dd11f93d79b7a7ae05414c042bbbe32882266c`; the working tree was clean. Existing client **39/39** and backend **184/184** tests passed under explicitly selected Node **24.22.1**, not the earlier Node 26 runtime. Git remained read-only throughout the audit.

Reviewed the Phase 4.2 report, authentication decision, real environment templates (examples only, plus the dedicated local integration target inspected without logging its value), package/lockfile/tool configurations, actual startup/database/auth/CSRF/task middleware, frontend helper/session/task hooks and build output. The approved UI/prototype and all historical milestone reports are preserved.

## Production architecture

Browser HTTPS → Vercel static React client (`client/`) → same-origin `/api` external rewrite → Render Node Web Service (`server/`) → dedicated TaskFlow Atlas database. Browser requests remain on the frontend host; database access and JWT signing remain backend-only. There is no need for cross-site `SameSite=None` cookies, permissive CORS, serverless Express conversion, a shared package or a new service layer.

External rewrites are supported by Vercel; cookie/header forwarding and no-cache behavior still require TaskFlow-specific live verification. This is an engineering recommendation based on supported capabilities, not a claim that the final host combination works. See [Vercel external rewrites](https://vercel.com/docs/routing/rewrites).

## Minimal local configuration changes

| Path                                         | Change and reason                                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/package.json`, `server/package.json` | Bound `engines.node` from `>=24.10.0` to `^24.10.0` (24.10+ but below 25), preventing silent major-runtime drift while retaining the existing minimum. No dependency versions change. |
| `.nvmrc`                                     | Select verified local Node 24.22.1 for NVM users.                                                                                                                                     |
| `server/.node-version`                       | Select tested Node 24.22.1 inside Render's `server` root; root-level files are outside that build root.                                                                               |
| `.gitignore`                                 | Ignore `.vercel/` local project metadata; real environment files were already ignored.                                                                                                |
| `client/vercel.json.example`                 | Inactive Vite/build/output, API-first routing, SPA fallback and response-header template. Its explicit Render-hostname placeholder must be replaced before activation.                |
| README files and this report                 | Explain exact setup, commands, environment classification, blockers and acceptance checks.                                                                                            |

No Express behavior, proxy trust, rate limit, cookie/CSRF controls, UI, model, task contract or database settings were changed. No new package, dependency upgrade, lockfile modification, Render Blueprint or active Vercel deployment configuration was introduced.

## Runtime and package management

Select **Node 24 LTS**, tested locally at **24.22.1**, with the existing **pnpm 10.15.1** pin. Node 24 remains supported; Vercel supports the 24.x major and manages minor/patch updates. Render honors a service `NODE_VERSION` override before version files and package engines. Verify actual platform versions in build logs rather than assuming they match the local patch. Revalidate patches before deployment; this audit does not install a newer runtime. [Node release schedule](https://github.com/nodejs/Release#release-schedule), [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Render version selection](https://render.com/docs/node-version).

Corepack under installed Node 24 selected pnpm **10.15.1** successfully. Do not run `corepack use` during deployment because it can rewrite package metadata. Do not disable signature verification. Commands below call `corepack pnpm` explicitly, avoiding global pnpm-shim changes and ambiguous host package-manager defaults. Vercel requires its Corepack opt-in; see [build/Corepack configuration](https://vercel.com/docs/builds/configure-a-build). Existing client/server lockfiles remain independent.

## Vercel settings and routing

Set Root Directory **`client`**, framework **Vite**, Node **24.x**, and output **`dist`**. Build and install commands in the inactive template are:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

Set `ENABLE_EXPERIMENTAL_COREPACK=1`. Do not rely on a plain custom `pnpm install` override selecting the intended version; inspect build logs. The existing packageManager field is `pnpm@10.15.1`. [Vercel package-manager behavior](https://vercel.com/docs/package-managers).

During separately authorized Phase 5.2, replace `REPLACE_WITH_RENDER_SERVICE` in the example with the actual fixed Render hostname, review it, and copy the example to `client/vercel.json`. Vercel does **not** load `vercel.json.example`. There is no active configuration to deploy in this audit.

The template forwards `/api/:path*` to the same `/api` prefix upstream before serving `/index.html` for SPA navigation. The fallback explicitly excludes `/api` and `/api/...`; unknown/failed API calls must never become SPA HTML. Normal generated assets retain filesystem precedence. No environment-variable interpolation or client-chosen proxy destination is assumed. [Vercel static configuration](https://vercel.com/docs/project-configuration/vercel-json).

Browser/shared/platform API cache directives are no-store; the API rule explicitly opts out of external rewrite caching with `x-vercel-enable-rewrite-caching: 0`. Newer Vercel projects enable cache-control-aware rewrite caching by default, so the template does not rely on an uncached default. [Vercel caching opt-out](https://vercel.com/docs/routing/rewrites#disabling-caching-for-rewrites-to-external-origins). Source API auth/task/health responses already use no-store. The static frontend gets nosniff, frame denial and a referrer policy because it does not inherit backend Helmet headers. No untested CSP or UI-changing asset policy is added. These are prepared directives, not observed live CDN behavior.

The frontend defaults to relative `/api`, rejects cross-origin API bases, sends same-origin credentials and does not contain database/signing secrets. `127.0.0.1:3000` appears only in Vite's development-server proxy, not production application code. `pnpm preview` is a static local preview, not a substitute for Vercel's proxy. When Render is unavailable, restoration/list/summary and mutation failures remain retryable; form values survive recoverable failures and successful writes are not misreported when later refresh fails. These behaviors have automated coverage; no live hosting outage was induced here.

## Render settings and lifecycle

Use a **Node Web Service**, Git branch `main`, Root Directory **`server`**. The backend is a long-lived Express process; no Docker image or serverless adapter is required. Render commands run relative to the chosen root; files outside it are unavailable. [Render monorepo roots](https://render.com/docs/monorepo-support).

Build:

```sh
corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm build
```

Start:

```sh
node dist/index.js
```

TypeScript is a dev dependency, so build installation must include dev dependencies despite `NODE_ENV=production`. Start runs the existing entry point directly and reads platform environment values; it needs no repository `.env` file or package-manager activation. Native bcrypt, optional platform binaries and a clean Linux installation still need hosting-build verification; macOS tests do not prove Linux binary availability. No broad dependency-script approval or signature bypass is recommended.

Set **`HOST=0.0.0.0`** and honor Render's supplied **`PORT`** (the parser accepts integers 1–65535). Defaults intentionally remain local-safe; leaving HOST unset on Render would bind loopback and block ingress. Configure HTTP health path **`/api/health`**, not the frontend login route. [Render web-service binding](https://render.com/docs/web-services), [HTTP health checks](https://render.com/docs/health-checks).

Startup validates configuration before connecting, connects with a 10-second selection/connect timeout, then awaits User index initialization before listening. Failed connection/startup messages are sanitized. The pool is bounded to 10, buffering disabled, socket inactivity timeout 45 seconds. SIGTERM/SIGINT drain HTTP and disconnect Mongoose with a 10-second shutdown deadline; forced termination remains best effort. Verify platform signal delivery and its shutdown budget during Phase 5.3.

Health returns exactly HTTP 200 `{"status":"ok"}` without auth. It is **liveness**, not continuous database readiness: a later Atlas outage can leave health green while business requests return generic errors. No new readiness endpoint is silently introduced. Assess that limitation explicitly during deployment rather than claiming database health from this endpoint.

## Environment matrix

Values below are names, public settings or placeholders, never actual secrets. Required-in-production settings must be explicitly supplied even when the parser has development defaults.

| Platform / variable                      | Required?                                     | Classification                             | Production value or rule                                                                                                |
| ---------------------------------------- | --------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Vercel `VITE_API_BASE_URL`               | Optional                                      | Public, compiled into client               | `/api` (also the default); never localhost or direct Render origin                                                      |
| Vercel `ENABLE_EXPERIMENTAL_COREPACK`    | Required for planned install                  | Public build setting                       | `1`                                                                                                                     |
| Vercel Node selector                     | Required project setting                      | Public runtime setting, not an app env var | 24.x; package engine constrains same major                                                                              |
| Vercel `NODE_ENV`                        | Framework-managed                             | Public build mode                          | Do not force development; use the production Vite build                                                                 |
| Vercel signing/database/platform secrets | Not used by client                            | Secret; prohibited in `VITE_`/bundle/repo  | Do not add JWT_SECRET, MONGODB_URI, Render API keys or Vercel tokens to frontend build variables                        |
| Render `NODE_ENV`                        | Required                                      | Public runtime configuration               | `production`; controls Secure cookie name/attributes                                                                    |
| Render `HOST`                            | Required                                      | Public binding setting                     | `0.0.0.0`                                                                                                               |
| Render `PORT`                            | Required, platform-supplied                   | Public platform configuration              | Honor Render's injected value; do not hardcode local 3000                                                               |
| Render `MONGODB_URI`                     | Required                                      | **Secret**, server-only                    | Dedicated TaskFlow Atlas URI with explicit production database and encoded credentials; never local test URI            |
| Render `JWT_SECRET`                      | Required                                      | **Secret**, server-only                    | Privately generated 64 hexadecimal characters; shared across restarts/instances; rotation invalidates existing sessions |
| Render `CLIENT_ORIGIN`                   | Required                                      | Public but security-sensitive              | One exact canonical HTTPS frontend origin; no trailing slash/path/wildcard/preview alias                                |
| Render `NODE_VERSION`                    | Optional override                             | Public host setting                        | Omit to honor server/.node-version, or match verified 24.22.1; override wins                                            |
| Render `PNPM_VERSION`                    | Not required                                  | Host-specific, unused by app               | Use packageManager/Corepack, not an assumed unsupported environment knob                                                |
| Local `INTEGRATION_MONGODB_URI`          | Required only for dedicated integration suite | **Development/test-only**, keep private    | Existing ignored `server/.env.integration`; strict authorized local test target only                                    |
| Vite dev host/port/proxy                 | Development-only                              | Public tool configuration                  | Loopback 5173 → loopback 3000; never used as production ingress                                                         |

JWT generation instruction for the user, **not executed by this audit**:

```sh
openssl rand -hex 32
```

Generate privately, paste directly into Render's protected environment settings and do not save the output in chat, shell command arguments, documentation, Git or frontend variables. Do not use `.env.example`'s intentionally invalid placeholder. Real `.env`/`.env.*` files and local Vercel metadata are ignored. Vercel/Render account/API credentials belong in their own secure stores, never in application source or deployment JSON.

## Cookie, CSRF, ownership and proxy identity

Production uses the existing `__Host-taskflow` JWT cookie with HttpOnly, Secure, SameSite=Lax, Path=/, 1800-second lifetime and no Domain. The server explicitly chooses Secure from production configuration; it does not need to trust forwarded protocol to set this cookie. Tokens are absent from JSON and browser storage. Logout expires the browser cookie but does not revoke a copied JWT before expiry; no refresh infrastructure is needed for this assignment.

POST/PATCH/DELETE require exact configured Origin, `X-TaskFlow-Request: 1` and JSON, including auth/logout. DELETE/logout send `{}`. Do not rewrite hostile/missing Origin into the allowed value to make the proxy work. Same-origin requests need no credentialed CORS; direct Render calls still require auth/ownership/CSRF. CORS does not protect against non-browser callers forging Origin. User and task DTOs are explicit whitelists; owner matching remains mandatory on every task operation/summary.

**Unresolved release blocker: client IP.** `trust proxy` remains false. The shared login/register limiter allows 10 attempts per network peer per 15 minutes; behind ingress it can become effectively global and block unrelated users. The in-memory store also resets on restart and is not shared across instances. Do not blindly trust every forwarded header, set trust proxy to true, assume a fixed hop count, disable limiting or raise limits to hide the problem. [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/), [express-rate-limit proxy guidance](https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues).

During authorized deployment, inspect the actual direct-to-Render and Vercel-to-Render paths with restricted temporary diagnostics (never log credentials/cookies). Verify which proxy overwrites or appends forwarded client identity and whether direct clients can inject it. Then implement the smallest evidence-backed trust/key policy with spoofing and two-client limiter regression checks. Remove diagnostics before public acceptance. No new public IP/debug endpoint or unverified trust setting is added by this audit. One instance is sufficient for the assignment once this gate is resolved; no Redis/distributed limiter is introduced speculatively.

## MongoDB Atlas preparation — instructions only

1. After explicit Phase 5.2 authorization, select/create the dedicated TaskFlow database (for example `taskflow`) in the intended Atlas project/cluster. Keep development/testing and production databases/users separate; never reuse `taskflow_integration_test` as production.
2. Create an application database user scoped to `readWrite` on this database only, with a private strong password. It needs collection/index creation for current Mongoose initialization; verify permissions deliberately. Do not use Atlas project-owner credentials or readWriteAnyDatabase. Atlas users and database users are separate. [Atlas database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
3. Allow only the selected Render service's actual outbound IP/CIDR ranges from its dashboard, plus a temporary authorized operator IP if needed. Vercel does not connect to MongoDB. Do not default to `0.0.0.0/0`, disable TLS or create new networking infrastructure as a workaround. [Render outbound IPs](https://render.com/docs/outbound-ip-addresses), [Atlas network access](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
4. Use Atlas's driver-provided `mongodb+srv` URI, explicitly set the intended database path, encode username/password URI characters, and preserve TLS/SRV options. Store only in Render's secret settings. Confirm selected database name and non-secret target metadata without printing the URI. DNS and outbound database access must work from Render, not merely the developer laptop. [Atlas connection prerequisites](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).
5. Startup currently uses autoIndex and awaits the unique User email index. Inspect the actual email unique and Task owner/creation/id index after deployment; uniqueness is database-index enforcement, not a Mongoose validator. Existing duplicates or missing privileges can stop readiness. Do not run syncIndexes, drop indexes or alter existing records automatically.
6. Verify ping/startup, uniquely identified test registration/task persistence, duplicate-email handling, restart persistence and scoped cleanup only after target authorization. Never point the routine integration suite at production; it intentionally refuses other targets. No Atlas connection was attempted in Phase 5.1.
7. Decide retention/backup needs before real users enter data. Check the chosen tier's actual backup support; do not assume every tier has snapshots/PITR. Enable available backups or define an authorized encrypted export/restore procedure and verify recovery without overwriting live data. Avoid storing dumps in Git or exposing credentials in CLI arguments. No backup/export was created in this audit. [Atlas backup capabilities](https://www.mongodb.com/docs/atlas/backup/cloud-backup/overview/).

## Security audit results and residual tooling finding

Both production-only dependency audits returned **zero reported advisories**. Both complete dependency audits returned **one moderate advisory**, exit code 1: `minimatch@10.2.6` through development ESLint, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). The report describes attacker-controlled glob preprocessing amplification and lists 11.0.1 as patched. This is not an API task-search regular-expression issue: task search uses escaped literal text, not minimatch.

The vulnerable package is absent from the production dependency graphs. In this project globs/configuration come from trusted repository tooling rather than public API input. That exposure assessment is a code-review inference, not exploit testing or a claim of zero risk. Builds install development tools, so keep build inputs trusted and record the advisory. A compatible tooling upgrade should be separately evaluated and retested; forcing a minimatch major override into ESLint without compatibility evidence is not justified by this audit. No lockfile/dependency change or automatic audit fix was performed. **The full dependency audits are not reported as clean/passing.**

Static source/bundle secret and generated-artifact results are recorded below. Pattern scans do not prove that every possible secret is absent; synthetic test fixtures and intentionally invalid placeholders are distinguished from credentials.

## Verification performed

Final checks executed November 2 using **Node 24.22.1** and **Corepack-selected pnpm 10.15.1**, explicitly selected in PATH. These are fresh source-checkout results, not inferred from the prior Node 26 milestone.

| Check                                     | Actual result                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Client `corepack pnpm typecheck`          | Passed, exit 0                                                                                                                  |
| Client `corepack pnpm lint`               | Passed, no errors/warnings                                                                                                      |
| Client `corepack pnpm format:check`       | Passed                                                                                                                          |
| Client `corepack pnpm test`               | **39 passed, 0 failed; 5 files**, 5.62 s                                                                                        |
| Client `corepack pnpm build`              | Passed; JS 289.88 kB / 92.30 kB gzip                                                                                            |
| Server `corepack pnpm typecheck`          | Passed, exit 0                                                                                                                  |
| Server `corepack pnpm lint`               | Passed, no errors/warnings                                                                                                      |
| Server `corepack pnpm format:check`       | Passed                                                                                                                          |
| Server `corepack pnpm test`               | **184 passed, 0 failed; 12 files**, 2.99 s                                                                                      |
| Server `corepack pnpm build`              | Passed                                                                                                                          |
| Server `corepack pnpm test:integration`   | **FAILED setup: 1 failed suite, 16 skipped cases, 0 executed cases**, exit 1; 10.42 s                                           |
| Production-only package audits, both apps | Zero reported advisories                                                                                                        |
| Full package audits, both apps            | One moderate development-tool advisory per app; **not clean**                                                                   |
| Inactive template validation              | Passed official-schema definitions for every used property and static routing/cache/runtime assertions; not hosted verification |
| Git diff / intended files / staged state  | Whitespace check passed; exactly 10 intended changed paths; nothing staged                                                      |

The dedicated integration URI was safely inspected before attempting a connection and still selected only the authorized credential-free loopback test target. The suite could not connect within its 10-second selection timeout and no test bodies executed. A separate permitted TCP check confirmed **ECONNREFUSED at 127.0.0.1:27018**; no listener was found. No Docker/service was started and no infrastructure was changed. Restore the existing authorized local test database yourself, then rerun `cd server && corepack pnpm test:integration` before claiming fresh Node 24 database-integration compatibility. Phase 4.2's historical 16 passing real-MongoDB results remain valid history under its recorded runtime, but are not substituted for this failed rerun. A fresh compiled startup/database/shutdown smoke check is also blocked by this unavailable database and is not claimed.

The template was parsed and checked against the downloaded official Vercel schema definitions for all properties it uses. Static assertions verified API-first ordering, API exclusion from fallback, build/output commands, no-store directives, explicit rewrite-cache opt-out, inactive placeholder, Node bounds and pnpm pins. An earlier whole-schema meta-validation attempt rejected upstream unused experimental function definitions that mix schema-draft keywords; validation was deliberately scoped to all used-property definitions rather than described as a complete vendor-schema/CLI certification. No Vercel CLI deployment or hosted route test was run.

The changed-file scan found no private-key, GitHub/AWS-token, credential-bearing MongoDB-URI or literal-JWT patterns. Real environment files, node_modules, dist and `.vercel/` metadata were confirmed ignored. The built client contains no database/signing secret names, test credentials or application loopback API endpoint. Two `http://localhost` literals were inspected and classified as bundled React Router URL-parsing/base fallbacks, not outbound API destinations; they were not falsely reported as absent. No user/session token or real production credential was generated, read into a frontend variable or added to Git. This is a scoped pattern/code review, not an exhaustive secret-history certification.

A source review found one minor caching-default documentation issue. Current Vercel guidance was rechecked and the inactive API template now explicitly sets `x-vercel-enable-rewrite-caching: 0` alongside no-store. The review reported no critical/important issue; live proxy/identity gates remain open. No product or dependency behavior was changed to silence a check.

No new browser walkthrough or hosted TLS/proxy test was performed in this audit. Phase 4.2's real-browser evidence is historical and retained; the approved UI was not modified. No live Vercel route, Render Linux build/ingress, Atlas connection or production cache behavior is claimed from local checks.

## Unresolved production gates

| Gate                                    | Required evidence before public acceptance                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local MongoDB re-verification           | Dedicated loopback database currently unavailable; rerun all 16 integration cases under Node 24 once it is restored                                                       |
| Actual frontend/backend identities      | Stable canonical HTTPS frontend origin and actual fixed Render upstream replace placeholders; preview origins intentionally denied                                        |
| Atlas authorization/network/data safety | Dedicated database/user, Render egress allowlist, secret URI, indexes and backup decision verified with explicit approval                                                 |
| Proxy/client-IP limiter                 | Evidence-backed sanitization/trust/key policy works for direct and proxied paths; separate clients do not share the global auth budget; spoofing rejected                 |
| Hosted build and runtime                | Frozen install on Node 24/pnpm 10.15.1, Linux bcrypt availability and correct bind/PORT/start command verified in platform logs                                           |
| Cookie/CSRF/cache/SPA                   | Production cookie/Origin forwarding, no cached personalized responses, unknown API JSON errors, deep-link refresh and logout/expiry verified live                         |
| Operational limits                      | Choose service tier knowingly: cold starts/spin-down, shutdown deadline, in-memory limiter, stateless JWT revocation and liveness-only health remain explicit limitations |
| Tooling advisory                        | Moderate development minimatch advisory remains; review a compatible remediation and trusted-build-input policy without claiming a clean full audit                       |

No local product defect requiring a frontend/backend behavior change was demonstrated by this audit. The blockers above prevent a production-ready sign-off, rather than justify weakening security.

## Exact deployment order — Phase 5.2, not executed

1. User reviews this audit, manually commits/pushes it, and explicitly authorizes Phase 5.2. Confirm the service/cluster plan and cost/resource choices before creation. Disable automatic promotion/autodeploy until configuration is reviewed where the platforms support it.
2. Decide the canonical frontend hostname and planned Render service identity. A Vercel project can be prepared without declaring its first build accepted; avoid the circular assumption that either host is already healthy. Do not admit broad preview origins to resolve naming uncertainty.
3. Prepare/authorize Atlas database/user and network entries using the actual selected Render egress ranges. Store only backend secrets on Render. Confirm backup/retention expectations.
4. Configure Render root/runtime/build/start/environment/health exactly as above, then deploy the backend only under the separate approval. Verify sanitized startup, Atlas/index readiness and unauthenticated health first.
5. Configure Vercel root/runtime/Corepack/public API path; replace/review the fixed upstream, activate the template and deploy the client only under approval. Confirm assets/deep links/API routing before attempting account workflows.
6. Verify actual forwarding/client identity on both paths, make the necessary evidence-backed narrow trust correction with tests, redeploy under authorized scope and remove restricted diagnostics. Public acceptance remains blocked until this is resolved.
7. Complete Phase 5.3 acceptance below with uniquely tagged disposable records and authorized scoped cleanup. Record final frontend/backend URLs, commit IDs, platform/runtime versions and evidence. Never submit the internship assignment automatically.

### Phase 5.2 checklist

- [ ] Explicit deployment/infrastructure authorization and user-owned Git checkpoint.
- [ ] Canonical hostnames, project roots, Node 24/pnpm versions and tier/cost choices confirmed.
- [ ] Dedicated Atlas credentials/database/egress access/backup decision configured privately.
- [ ] Render binds 0.0.0.0 and supplied PORT; startup/health/shutdown verified.
- [ ] Actual upstream replaces placeholder; inactive template deliberately activated and reviewed.
- [ ] API precedes SPA fallback; static assets load; no local endpoint in compiled browser requests.
- [ ] Proxy identity and auth limiting resolved with regression tests and no spoofing shortcut.
- [ ] No secrets in bundle/logs/Git; no permissive CORS; diagnostics removed.

### Phase 5.3 live acceptance tests

- [ ] Fresh `/login`, `/register`, `/dashboard` navigation/refresh and unknown API JSON 404; output has correct MIME types and no SPA HTML for failed API calls.
- [ ] Registration, duplicate email, correct/incorrect login, current user, reload restoration, logout and rejected/expired sessions work over final HTTPS host.
- [ ] Browser cookie is Secure/HttpOnly/Lax, host-only, correct name/path/lifetime; tokens/hashes absent from response JSON, browser storage and logs.
- [ ] Missing/hostile/null Origin, missing header and unsupported mutation content types are rejected without writes, including direct Render access.
- [ ] Two users cannot list/read/update/delete each other's tasks or include another owner in summary. No owner/mass-assignment injection.
- [ ] Create/edit/delete/complete/reopen, literal title search, status filters, six-row server pages, stable order and global counts persist across refresh/restart.
- [ ] Personalized responses are never CDN-cached across users; no cached Set-Cookie; query strings and JSON error status survive the proxy.
- [ ] Two real client identities have independent auth budgets; forged forwarding cannot bypass limits; 429 remains JSON and retryable.
- [ ] Controlled unavailable-backend/failed-write/failed-refresh recovery preserves input and truthful success state; cold-start behavior is usable. Do not disrupt unrelated users to simulate outages.
- [ ] Check 360/768/1440px layouts and keyboard/dialog focus on deployed code; no redesign or unsupported screen-reader claims.
- [ ] Authorized disposable records are cleaned precisely; unrelated records retained; final URLs/screenshots/runtime/check results recorded for user submission.

## Changed files and manual Git handoff

Exactly **10 paths: 6 modified, 4 added**. No source, test, lockfile, approved-prototype or generated-output changes.

Modified:

```text
.gitignore
README.md
client/README.md
client/package.json
server/README.md
server/package.json
```

Added:

```text
.nvmrc
client/vercel.json.example
docs/phase-5.1-production-readiness.md
server/.node-version
```

Every configuration change is justified in the table above. The example configuration is intentionally inactive; do not stage a fabricated active `client/vercel.json` or deployment credentials. The placeholder, unavailable local MongoDB verification, proxy/client-IP blocker, Linux build and live production acceptance gates are unresolved, not waived.

Recommended Conventional Commit: `chore(deploy): prepare production readiness audit`.

The user alone executes these commands. They were not executed by the agent:

```sh
cd '/Users/mavery/Documents/Codex-workspace/AppRo8 Internship 1/week2/task-manager-fullstack'
git status --short --branch
git diff --check
git diff -- .gitignore README.md client/README.md client/package.json server/README.md server/package.json
git ls-files --others --exclude-standard
# Inspect all four new files listed above before staging.
git add -- .gitignore .nvmrc README.md client/README.md client/package.json client/vercel.json.example server/.node-version server/README.md server/package.json docs/phase-5.1-production-readiness.md
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached
# Confirm exactly the 10 intended paths; no private .env, platform credentials or generated artifacts.
git commit -m "chore(deploy): prepare production readiness audit"
git status --short --branch
git push origin main
```

Local HEAD, origin/main and an independent actual GitHub main lookup remained `19dd11f93d79b7a7ae05414c042bbbe32882266c` at final review. Audit changes are unstaged. No Git staging, commits, pushes, destructive/history operations, deployment, Atlas changes or Phase 5.2 work occurred. Stop here for user review. Committing the audit records its known blockers; it does not certify the application as production-ready.
