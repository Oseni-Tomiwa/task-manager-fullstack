# Phase 5.2A — Node 24 verification and deployment preparation

Verified November 2, 2026. This is a focused follow-up to [Phase 5.1](phase-5.1-production-readiness.md), not deployment authorization. Its environment matrix, hosting security rationale and Phase 5.3 acceptance checklist still apply. No Atlas, Render or Vercel resources/settings were created or changed.

## Node 24 verification — previous local blocker resolved

The starting working tree was clean on `main`. Local HEAD, origin/main and an independent actual GitHub main lookup all matched Phase 5.1 commit `66cb39becf72c0109257511538938cbaa7cbd342`.

The existing `taskflow-test-mongo` container was stopped. It was started with the user's explicit authorization, without deleting/recreating it or changing its existing `mongo:7` image, volume or loopback port mapping. It now runs with host `127.0.0.1:27018` forwarded to container port 27017; read-only MongoDB ping returned `1`. The container is left running for local development.

`server/.env.integration` exists and is Git-ignored. Safe parsing confirmed exactly the authorized credential-free local target: `127.0.0.1`, port `27018`, database `taskflow_integration_test`, with no URI credentials or extra options. No complete connection URI was printed. The integration suite independently enforces the same target and never falls back to a production/development URI.

Commands used the explicitly selected installed Node **24.22.1** and Corepack-selected pnpm **10.15.1**, confirmed in output:

```sh
# After selecting Node 24.22.1, from server/:
node --version
corepack pnpm --version
corepack pnpm test:integration
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm test
corepack pnpm build
```

| Executed check                  | Actual result                                         |
| ------------------------------- | ----------------------------------------------------- |
| Real MongoDB + HTTP integration | **16 passed, 0 failed, 0 skipped; 1 file**, 2.49 s    |
| Backend regression tests        | **184 passed, 0 failed, 0 skipped; 12 files**, 2.77 s |
| Backend TypeScript              | Passed                                                |
| Backend ESLint                  | Passed, no errors/warnings                            |
| Backend formatting              | Passed                                                |
| Backend production build        | Passed                                                |

The 16 integration cases use actual Mongoose/MongoDB operations and HTTP requests, including persisted indexes/timestamps, password-hash projection, authentication, CSRF, task CRUD/status/search/pagination/ordering, two-user isolation and owner-scoped summaries. They are separate from routine persistence-mocked tests. Run-specific fixture cleanup and final Mongoose disconnection assertions passed; no database/collection/global cleanup was performed.

**No integration defect was found and no application/test/configuration correction was needed.** Phase 5.1's failed/skipped local run remains accurate historical evidence; the successful rerun here closes that local Node 24 verification gap. It does not verify Atlas, Render Linux builds, hosted proxying, production HTTPS cookies, failover or cold starts. No frontend or browser checks were rerun because this milestone changes documentation only; earlier results are not relabeled as new checks.

## Inputs to decide before any cloud work

The user must authorize actual deployment/resource changes separately and choose:

- Atlas project/cluster, region/tier, production database name and backup/retention policy.
- Render service name/region/tier and its actual outbound CIDR ranges.
- One canonical HTTPS frontend origin and the actual HTTPS Render upstream.

Suggested database/user names below are examples, not provisioned resources. Do not paste passwords, signing keys or connection strings into chat/Git. Keep production separate from `taskflow_integration_test` and its credential-free local container.

## Minimal Atlas procedure — manual, after authorization

1. **Database:** designate `taskflow` (or the approved dedicated production name). Confirm the intended project/cluster before any operation. Use separate development/test credentials and databases; do not migrate local integration fixtures into production.
2. **Database user:** create a dedicated application user such as `taskflow_app`. Assign **role `readWrite`, database `taskflow` only**, and restrict it to the intended cluster where the project has multiple clusters. Verify the effective scope; do not select `readWriteAnyDatabase`, Atlas project-owner credentials or an administrative database role. Current CRUD and automatic collection/index creation require those scoped write/index privileges. Atlas login accounts and database users are distinct. [Atlas database-user configuration](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
3. **Network:** once the authorized Render service exists, obtain its complete egress CIDR list from **service → Connect → Outbound**. Add those actual ranges to the intended Atlas project's network access list. They can be shared regional ranges, not a unique service identity; database credentials still matter. Do not use Vercel IPs, Render's inbound DNS address, one guessed IP, or `0.0.0.0/0`. A temporary operator IP, if required, needs explicit authorization and removal afterward. [Render outbound ranges](https://render.com/docs/outbound-ip-addresses), [Atlas access-list requirements](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
4. **Connection string:** obtain Atlas's Node driver/SRV connection template privately. Select the application user, explicitly set the production database path, encode reserved characters in username/password and preserve the provider's TLS/SRV options. Store the result only as Render's secret `MONGODB_URI`. Do not encode the entire URI, disable TLS/certificate checks, place it in `VITE_` variables or change the local integration file to Atlas.
5. **Indexes/startup:** the existing connection enables `autoIndex`; server startup awaits `User.init()` before listening. Verify the real unique `{email:1}` User index and Task `{owner:1,createdAt:-1,_id:-1}` index after initialization. The Task performance index is initialized automatically but is not an additional listener-readiness gate. Duplicate legacy emails or insufficient permissions can prevent startup; investigate deliberately, never automatically drop/reconcile indexes or delete existing data.
6. **Connectivity evidence:** from the authorized backend environment, verify sanitized startup and the non-secret selected database name, then a read-only ping/index inspection. `/api/health` alone does not prove ongoing Atlas connectivity. During separately authorized acceptance, use uniquely tagged disposable accounts/tasks, verify persistence/restart/duplicate-email behavior and remove only those records. Never point `test:integration` at production: its safety guard should continue to reject Atlas.
7. **Recovery:** decide acceptable data loss/restore time and verify the chosen Atlas tier's actual backup capabilities. Configure available backups or an approved encrypted export process; test restoration into a separate authorized database before trusting it. Do not restore over live data or commit dumps. Free/Flex/dedicated tiers have different backup capabilities; do not assume snapshots/PITR exist. No backup or export has been created here. [Atlas backup overview](https://www.mongodb.com/docs/atlas/backup/cloud-backup/overview/).

If Render egress ranges are unavailable until service creation, prepare Atlas user/database first, then obtain the actual service ranges and allowlist them before accepting the backend. Service creation may trigger an initial build/start; an allowlist-related startup failure must remain a failed readiness check until corrected. Do not open Atlas globally merely to make that first attempt succeed.

## Exact hosting settings to prepare

### Render backend — manual configuration

| Setting                        | Value                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------ |
| Service/runtime                | Node Web Service, branch `main`                                                |
| Root Directory                 | `server`                                                                       |
| Node                           | 24.22.1 from `server/.node-version`; verify any `NODE_VERSION` override agrees |
| Package manager                | Existing `packageManager: pnpm@10.15.1`, invoked through Corepack              |
| Build command                  | `corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm build`  |
| Start command                  | `node dist/index.js`                                                           |
| HTTP health path               | `/api/health` — unauthenticated liveness, not continuous database readiness    |
| Required nonsecret environment | `NODE_ENV=production`, `HOST=0.0.0.0`, exact canonical HTTPS `CLIENT_ORIGIN`   |
| Platform environment           | Honor Render's supplied `PORT`; do not replace it with local 3000              |
| Required secret environment    | Dedicated Atlas `MONGODB_URI` and privately generated 64-hex `JWT_SECRET`      |

Use Phase 5.1's private secret-generation instructions; no production secret is generated by this preparation. Confirm Linux bcrypt/frozen-install success and actual Node/pnpm versions in build logs. Verify startup, Atlas indexes and signal/shutdown behavior after deployment; local macOS success does not establish these hosted results.

### Vercel frontend — manual configuration

- Root Directory `client`, framework Vite, Node 24.x, output `dist`.
- Set public build setting `ENABLE_EXPERIMENTAL_COREPACK=1`; retain pinned pnpm 10.15.1. The prepared install/build commands are `corepack pnpm install --frozen-lockfile` and `corepack pnpm build`.
- `VITE_API_BASE_URL=/api` is public and optional because `/api` is the default. Do not put any Atlas/JWT/platform credentials in frontend variables.
- **The existing `client/vercel.json.example` remains inactive.** Only after authorization, copy it to `client/vercel.json`, replace `REPLACE_WITH_RENDER_SERVICE` with the actual fixed Render hostname, and review before deploying. No active file was created here.
- Preserve the first `/api/:path*` rewrite to the upstream `/api/:path*`; keep the SPA fallback after it and excluding `/api`. API errors must not return index.html; keep normal static-asset handling.
- Retain all no-store directives and `x-vercel-enable-rewrite-caching: 0`; do not assume a new project's external rewrites are uncached by default. Validate actual cookies/headers/query strings/status codes on the hosted path. [Vercel external rewrites and cache opt-out](https://vercel.com/docs/routing/rewrites#disabling-caching-for-rewrites-to-external-origins).

### Cookie, Origin and proxy release gates

Production must retain `__Host-taskflow`, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain and the existing 30-minute lifetime. Verify the proxied cookie is established on the frontend host and forwarded on `/auth/me` and task calls; never store the JWT in browser storage or return it in JSON. Logout clears the browser cookie, not copied stateless JWTs before expiration.

`CLIENT_ORIGIN` must exactly match the final browser origin, with HTTPS and no trailing slash/path/wildcard. Keep Origin, JSON and `X-TaskFlow-Request: 1` validation on mutations, including login/logout. Do not rewrite a hostile/missing Origin into the allowed value or add permissive CORS. Preview domains are not automatically trusted.

**Client-IP/rate limiting remains a release blocker.** Current Express proxy trust is false; the shared 10-attempt/15-minute auth limiter can group users by an ingress peer. After deployment is authorized, inspect both direct Render and Vercel-proxied forwarding paths with restricted temporary diagnostics, confirm sanitization and then make the smallest separately reviewed trust/key correction with spoofing/two-client tests. Do not guess `trust proxy=true` or a hop count, raise limits to hide aggregation, add a public debug route, or introduce a distributed store without need. No such code change is made in this preparation.

## Approval sequence and unresolved blockers

Next actions, in order:

1. User reviews and manually commits/pushes this documentation. Local Node 24 MongoDB compatibility is now verified; retain the container for further local checks.
2. User approves the actual cloud-work scope, hostnames, plans/costs, Atlas database/user/network/backup decisions and any required narrow proxy-identity correction. None is implicitly authorized by this guide.
3. Configure the dedicated Atlas database/user and Render environment, complete egress allowlisting, then verify backend startup/connectivity/indexes and health. Keep any initial failed start unaccepted until configuration is correct.
4. Activate/review the Vercel template with the real upstream, configure the canonical origin and deploy only under authorization.
5. Resolve the observed client-IP/limiter behavior safely, then execute the existing [Phase 5.3 acceptance checklist](phase-5.1-production-readiness.md#phase-53-live-acceptance-tests) on final HTTPS URLs. Record evidence and precisely clean disposable records before public sign-off.

Still unresolved: actual hostnames/secret values, Atlas access and backup configuration, hosted Linux build, production cookie/CSRF/cache/SPA forwarding, proxy identity/auth-limiter correctness, and final live acceptance. Phase 5.1's moderate development-only minimatch advisory remains recorded there; dependency audits were not rerun or dependencies changed in this documentation-only follow-up. No new frontend/browser/Atlas/deployment verification is claimed.

## Changed files, checks and user-owned Git handoff

Only `README.md` and this new `docs/phase-5.2a-deployment-preparation.md` are intended. The README links this follow-up; Phase 5.1's historical report is unchanged. No production config was activated, credentials stored, source/tests/lockfiles changed or generated artifacts added. Documentation formatting, Git whitespace and changed-file/secret-pattern checks are recorded in the final handoff.

Recommended commit: `docs(deploy): record Node 24 verification and deployment preparation`.

Only the user executes these commands; the agent did not run them:

```sh
cd '/Users/mavery/Documents/Codex-workspace/AppRo8 Internship 1/week2/task-manager-fullstack'
git status --short --branch
git diff --check
git diff -- README.md
cat docs/phase-5.2a-deployment-preparation.md
git add -- README.md docs/phase-5.2a-deployment-preparation.md
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "docs(deploy): record Node 24 verification and deployment preparation"
git push origin main
```

Stop after preparation for review. No deployment, Atlas change, external resource creation, assignment submission, Git staging/commit/push or unrelated work was performed. The sole infrastructure action was starting the explicitly authorized existing local MongoDB container.
