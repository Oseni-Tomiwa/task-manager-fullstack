# TaskFlow client

Production React client integrated with the Express/MongoDB API in Phase 4.2. Registration, login, restored sessions and tasks use the real API. The protected Profile page displays read-only account details from the existing session response. Profile verification used local tests and browser fixtures. Hosted Profile acceptance remains pending. The approved `prototype/` remains separate and unchanged. There are no preview credentials, fixtures or browser token storage in this app.

## Local startup

Use Node.js 24 LTS (24.10+ within 24.x) and pnpm 10.15.1. The root `.nvmrc` selects the verified local 24.22.1 runtime. Client/server keep independent manifests and lockfiles; no new dependencies were needed for integration.

1. Configure and start an authorized local/development MongoDB database. Never use production credentials for development or verification.
2. In `server/`, install with `pnpm install --frozen-lockfile`, copy `.env.example` to ignored `.env`, and privately configure `MONGODB_URI` and a fresh `JWT_SECRET` (`openssl rand -hex 32`). Keep `CLIENT_ORIGIN=http://127.0.0.1:5173`, `HOST=127.0.0.1`, `PORT=3000` and `NODE_ENV=development`. Run `pnpm dev`.
3. In another terminal, from `client/`:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:5173**. Register your own development account; there is no demo sign-in. Do not run the prototype on the same port. Vite uses strict port 5173 and fails if occupied rather than silently breaking the server's exact Origin configuration. `localhost` is a different origin: use the printed `127.0.0.1` URL.

Vite forwards `/api` to the fixed loopback backend `http://127.0.0.1:3000`, preserving Origin and cookie headers (`changeOrigin: false`). No browser-to-backend CORS configuration is needed. Do not rewrite hostile origins into trusted ones. For a deliberate local port change, update both frontend port and server `CLIENT_ORIGIN`, and the fixed proxy target if changing the backend port. No arbitrary client-selected upstream exists.

`client/.env.example` contains only public `VITE_API_BASE_URL=/api`; no client environment file is normally required. This is a same-origin path, never a database URI, signing key or token. Real environment files are ignored. Vite's development proxy is **not** included in a static production build; `pnpm preview` alone does not establish a verified production API proxy.

## Commands

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

Also available: `pnpm format`, `pnpm test:watch`, `pnpm preview`. Ordinary frontend tests use controlled fetch responses and jsdom, not MongoDB. From `server/`, `pnpm test:integration` runs the separate real MongoDB/HTTP suite after its strict local test-target safety check. See the Phase 3.5 report for dedicated integration-file configuration.

## Implementation

- `src/App.tsx`: protected routes, session restoration/error/retry boundary, route titles/focus and expiry notice.
- `src/auth/useSession.ts`: public user state, cancellable `/auth/me`, auth/logout operations and session epochs that ignore obsolete protected-request failures.
- `src/tasks/useTasks.ts`: backend six-row pagination, approximately 300 ms title-search debounce, filters, independent summary, abort/stale-response guards and guarded pessimistic mutations. A completed write invalidates reads separately, so a failed refresh never invites resubmitting a successful creation.
- `src/api/client.ts` / `contracts.ts`: centralized same-origin fetch helper and public DTOs. All mutations use JSON plus `X-TaskFlow-Request: 1`; DELETE/logout send `{}` and handle empty 204s. The browser supplies Origin. Protected 401s clear private UI; invalid login credentials stay on the form. Responses are compile-time typed, not runtime-schema validated.
- `src/pages/`, `src/components/`, `src/styles.css`: preserved approved interface, accessible feedback/dialogs, form value retention, pending guards and focus recovery after list reloads. Focus recovery does not steal focus from a user who moved elsewhere during the request.
- `src/tests/`: focused request, session, task and component/validation tests. Test HTTP fixtures exist only under tests and never ship with the application.

Production statuses: `todo`, `in_progress`, `completed`; “Pending” labels `todo`. Lists use server-createdAt/_id descending ordering. Dashboard-wide counts come from authenticated `GET /api/tasks/summary`, never the visible/filtered page. List and summary reads are not a shared transaction snapshot; other tabs' concurrent changes become visible on the next read. Out-of-range pages recover to the last available page.

## Session and failures

An HttpOnly cookie carries a 30-minute JWT. No localStorage/sessionStorage tokens, refresh tokens or rolling sessions. Initial `/auth/me` completes before route decisions; network/server restoration failure offers retry. A protected 401 clears tasks/dialogs and explains that sign-in is required. Login/registration retain inputs after errors; the server remains authoritative for validation. Logout clears private UI only after success; failures stay retryable.

Task writes are disabled while pending. Recoverable write failures retain the edit form/delete confirmation; read failures show retry. Summary failures do not fabricate zeros or hide an independently successful list. Failed refresh after a successful write shows both truthful success feedback and a separate load-retry state.

## Vercel deployment

[Vercel configuration](vercel.json) is active. Its first rewrite sends `/api/:path*` to the fixed Render API, before the SPA fallback. [The example](vercel.json.example) is an inactive historical template with a placeholder upstream. The production-readiness audit records the earlier rollout plan.

See [Phase 4.2 verification](../docs/phase-4.2-fullstack-integration.md) for local evidence, screenshots, and integration risks.

Vercel settings: Root Directory `client`, framework Vite, Node.js 24.x, output `dist`; enable `ENABLE_EXPERIMENTAL_COREPACK=1` and retain the existing `packageManager` pin. The active configuration installs with `corepack pnpm install --frozen-lockfile` and builds with `corepack pnpm build`. API proxying precedes the SPA fallback, and the fallback explicitly excludes `/api` so API failures cannot become index.html. Filesystem assets retain normal Vercel precedence. API responses are marked no-store for browser/shared/platform caches; the API rule explicitly opts out of external rewrite caching with `x-vercel-enable-rewrite-caching: 0`. Basic response headers also cover the static frontend, which does not inherit Express Helmet headers.

The only frontend build variable is public `VITE_API_BASE_URL=/api` (optional because it is the default). Do not set it to localhost or Render's direct URL. The Vite development proxy stays development-only. The canonical frontend is `https://task-manager-fullstack-vert-five.vercel.app`; Render's `CLIENT_ORIGIN` must match that exact origin. Other preview origins are intentionally not authorized. No production cookie, CSRF, proxy identity or cache behavior is established by local configuration validation; those require live acceptance tests. See [the production-readiness audit](../docs/phase-5.1-production-readiness.md) for the complete environment matrix, blockers and deployment order.

### Hosted acceptance still required

After separately authorized deployment, verify the canonical frontend's `/api/health`
and unknown API path return API JSON/statuses, and refresh `/login`, `/register`,
and `/dashboard` to verify SPA routing. Verify query strings and non-GET methods
reach the corresponding Render API endpoints. A local Vite build or preview does
not execute Vercel rewrites.

With an authorized test account, check login and reload restoration, forwarded
Cookie/Set-Cookie, and the production host-only `__Host-taskflow` cookie with Secure,
HttpOnly, SameSite=Lax and Path=/. Do not copy cookie values or tokens into logs.
Confirm logout expires that same cookie and protected reads are rejected afterward.
Logout and task DELETE requests retain JSON `{}`; all mutations retain the browser's
original Origin, `X-TaskFlow-Request: 1` and JSON content type. Missing/hostile Origin
or missing security headers must be rejected without writes. Do not rewrite Origin,
add permissive CORS, or change cookie security settings to pass acceptance.

Verify effective no-store behavior on authenticated and error responses, no cached
Set-Cookie, and no personalized response reuse across accounts. Some CDN control
headers may be consumed by Vercel rather than exposed to the browser. Configuration
alone does not prove hosted cache behavior. External rewrite caching remains
explicitly disabled; see [Vercel's documented opt-out](https://vercel.com/docs/routing/rewrites#disabling-caching-for-rewrites-to-external-origins).

Express proxy trust remains at its default false setting. The 10-attempt/15-minute
login/register limiter can group users by an ingress peer behind Render/Vercel.
Verify independent client budgets and spoofed forwarding-header handling through
both direct and proxied paths before public acceptance. This remains a release
blocker; resolving it requires separate evidence and review. Render cold starts,
stateless JWT logout limitations, and liveness-only health also remain operational
considerations. No backend authentication, proxy trust, or database changes are
included in this configuration activation.
