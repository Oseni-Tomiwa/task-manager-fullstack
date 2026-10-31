# TaskFlow client

Production React client integrated with the Express/MongoDB API in Phase 4.2. Registration, login, restored sessions and tasks use the real API. The approved `prototype/` remains separate and unchanged. There are no preview credentials, fixtures or browser token storage in this app.

## Local startup

Use Node.js 24.10+ and pnpm 10.15.1. Client/server keep independent manifests and lockfiles; no new dependencies were needed for integration.

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

## Deployment boundary

No deployment is included. Phase 5 must configure a fixed Vercel `/api/:path*` rewrite to Render before the SPA fallback, exact HTTPS `CLIENT_ORIGIN`, proper non-cached forwarding of Cookie/Set-Cookie/Origin/custom headers and the production Secure HttpOnly host-only cookie. Verify actual proxy trust/IP handling before changing Express trust proxy or relying on auth rate limiting. Do not add permissive CORS or third-party-cookie workarounds.

See [Phase 4.2 results and Git handoff](../docs/phase-4.2-fullstack-integration.md) for actual evidence, screenshots and remaining risks.
