# Phase 3.1 — production backend foundation

Completed locally on October 30, 2026. Stop point: review and manual Git handoff; Phase 3.2 is not authorized.

## Inspection and architecture

Working tree was clean on `main`, tracking `origin/main`. Local HEAD was `151178e docs: define TaskFlow MVP architecture and prototype plan`, preceded by `ea711f9 Initial commit`. Despite its title, the latest commit contains the approved planning/prototype files; no separate Phase 2 commit appeared in the local log. The user reports the reviewed work was pushed; remote freshness was not independently fetched or verified.

Reviewed README, the Phase 1 architecture, authentication decision and prototype tooling. Express/TypeScript with a factory, startup entry, pure typed config and small middleware files remains appropriate. No controller/service/repository layers are needed for a single health route. The prototype is unchanged, and the production client does not exist.

The server is a standalone pnpm package with its own lockfile, consistent with the prototype's current independent package setup. Root workspace creation is deferred until the production client is introduced; this avoids lockfile migration and prototype tooling changes during a narrowly scoped backend milestone.

## Implemented behavior

- `createApp()` has no port-binding, environment-loading or database side effects.
- Separate startup entry validates environment before listening; built-in optional .env loading in dev/start scripts avoids dotenv.
- Zod returns a typed Env; NODE_ENV defaults to development, HOST to 127.0.0.1, PORT to numeric 3000. Invalid ports/environments/blank hosts fail early, reporting only field names.
- Helmet security headers, disabled X-Powered-By, default false proxy trust and 16 KiB JSON limit.
- `GET /api/health`: unauthenticated HTTP 200, JSON content type, exact body `{"status":"ok"}`, no-store caching. This overrides the Phase 1 database-readiness concept for this foundation: process liveness only; no database is configured or contacted.
- Safe JSON 404, malformed JSON 400, body-too-large 413, unsupported charset/encoding 415, generic unexpected-error 500. Arbitrary exception text, stack traces and request bodies are excluded from error responses/logs.
- SIGTERM/SIGINT stop new connections, drain active HTTP requests, and force-close remaining HTTP connections after 10 seconds with a nonzero exit status. Repeated signals do not restart shutdown.
- Root and server ignore rules exclude real environment files, dependencies, builds, coverage and logs; server/.env.example contains non-secret defaults only.

## Verification evidence

Executed from the repository with pnpm 10.15.1 on host Node 26.8.1. The package requires Node 24.10+ and recommends Node 24 LTS; this run is not a separate Node 24 CI matrix test.

| Command | Actual result |
| --- | --- |
| `pnpm --dir server install --frozen-lockfile` | Passed; lockfile reused |
| `pnpm --dir server typecheck` | Passed, no TypeScript errors |
| `pnpm --dir server lint` | Passed, no errors or warnings |
| `pnpm --dir server format:check` | Passed, all checked package files formatted |
| `pnpm --dir server test` | 3 files passed, 16 tests passed, 0 failed |
| `pnpm --dir server build` | Passed; production JavaScript emitted to ignored server/dist |

Tests cover exact public health response and security-header/CORS behavior; JSON 404; malformed JSON without payload disclosure; oversized JSON; valid JSON on an unknown route; local environment defaults and numeric conversion; invalid ports; unknown environment; blank host; generic 500 response/log sanitization; unsupported JSON charset.

Tests were written before implementation and run against an empty app/config stub: 13 assertions failed and one baseline 404 test passed. Initial sandbox HTTP tests could not bind ports; rerunning with the required local-port permission produced the intended assertion failures. The final implemented suite passed in the target repository.

A separate local smoke script launched compiled dist/index.js on temporary loopback ports: health returned 200 and the exact body; SIGTERM and SIGINT each drained and exited 0. Invalid PORT caused exit 1 and did not log its value. Those checks passed; their temporary processes were stopped. The forced 10-second timeout branch and concurrent long-running request drain were not exercised by that smoke script.

pnpm reported that esbuild's install script was ignored by its script policy; the supplied platform binary was sufficient for the executed tooling. No broad script approval was enabled. Build output is compilation only, not deployment.

## Security boundary and future proxy

No CORS allow-origin middleware, cookie parsing, JWT signing, CSRF middleware, auth routes, task routes, Mongoose or database connection exists. For the later same-origin Vercel → Render API proxy, keep the `/api` prefix and route the proxy before the SPA fallback. The detailed [authentication decision](authentication-decision.md) remains the proposal for HttpOnly/Secure/SameSite cookies, strict source-origin/custom-header CSRF defenses, explicit credential handling, expiration/logout and no-cache authenticated responses. This milestone configures none of that prematurely. No permissive production CORS is enabled; CORS absence is not authorization.

Before future mutation endpoints, add their content-type and schema validation alongside authentication/ownership controls. At present JSON parsing ignores non-JSON bodies and unknown routes still return 404. Health does not imply dependency readiness. Configure HOST=0.0.0.0 explicitly only when hosting is authorized; default is loopback. Shutdown is HTTP-only; there are no upgraded/WebSocket connections or database resources to close.

## Exact source files changed

Modified: README.md.

Created:

```text
.gitignore
docs/phase-3.1-backend.md
server/.env.example
server/.gitignore
server/.prettierignore
server/README.md
server/eslint.config.js
server/package.json
server/pnpm-lock.yaml
server/tsconfig.json
server/tsconfig.build.json
server/src/app.ts
server/src/config/env.ts
server/src/index.ts
server/src/middleware/errors.ts
server/tests/app.test.ts
server/tests/env.test.ts
server/tests/errors.test.ts
```

No prototype file changed. Ignored node_modules and dist exist locally as installation/build artifacts, not source changes. No real .env was created. No known secret patterns were found in the source/documentation review; this is not a guarantee against all possible secrets. The Git index remains unchanged.

## Manual Git handoff

Only you stage, commit and push. Review the exact changes before committing:

```bash
cd '/Users/mavery/Documents/Codex-workspace/AppRo8 Internship 1/week2/task-manager-fullstack'
git status --short --branch
git diff -- README.md
git ls-files --others --exclude-standard
git add -- .gitignore README.md docs/phase-3.1-backend.md server/
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached -- server/.env.example server/src server/tests
git commit -m "chore(server): initialize Express TypeScript backend"
git status --short --branch
```

The add command includes only this milestone's paths; ignore rules exclude dependencies/builds/real environment files. Inspect the staged name list before the commit. No push is needed to complete this local handoff; publish through your normal manual workflow when ready. No agent staging, commits, pushes, destructive Git or history rewriting occurred.

No authentication, database models/connections, task business logic, production frontend, proxy deployment or hosting setup was implemented. Wait for explicit authorization before Phase 3.2.
