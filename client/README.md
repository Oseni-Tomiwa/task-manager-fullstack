# TaskFlow client

Production React frontend foundation for Phase 4.1. **The current app uses isolated presentation data and a mock session. It is not connected to the backend.** Real authentication and task persistence are reserved for Phase 4.2. The approved `prototype/` remains unchanged.

## Run locally

Use Node.js 24.10+ and pnpm 10.15.1. From the repository root:

```sh
cd client
pnpm install --frozen-lockfile
pnpm dev
```

Open Vite's printed address (normally `http://127.0.0.1:5173`). If the prototype already uses that port, stop it or use `pnpm dev --port 5174 --strictPort`. No backend or MongoDB is required for this phase.

Preview sign-in: `demo@taskflow.app` / `TaskflowDemo!2026`. Registration accepts valid made-up details and creates no real account. Session and task changes live only in memory and reset on reload/logout. Never enter real credentials into this preview. The production build also contains this clearly labeled preview; building it is not authorization to deploy it.

## Scripts

| Script              | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | Local Vite server on loopback                                    |
| `pnpm typecheck`    | TypeScript, including tests and tool configs                     |
| `pnpm lint`         | ESLint and React hooks rules                                     |
| `pnpm format:check` | Check formatting                                                 |
| `pnpm format`       | Apply formatting                                                 |
| `pnpm test`         | Focused Vitest/Testing Library interaction and HTTP-helper tests |
| `pnpm test:watch`   | Watch tests                                                      |
| `pnpm build`        | Typecheck and produce `dist/`                                    |
| `pnpm preview`      | Serve the local compiled build                                   |

## Structure

- `src/App.tsx`: routing, presentation session boundary, title/route focus.
- `src/pages/`: authentication form and dashboard composition.
- `src/components/`: branding, icon actions/tooltips, modal, field errors, task form/list/summary/toolbar/states, pagination.
- `src/api/contracts.ts`: exact public backend DTOs and production status values.
- `src/api/client.ts`: small centralized, typed fetch helper. Tested independently; never called by the current UI.
- `src/preview/workspace.ts`: removable fixture, mock session and task-state module. No duplicate mock server, browser storage, or production/mock switch.
- `src/validation.ts`: client-side input feedback aligned with documented limits; backend validation remains authoritative.
- `src/styles.css`: approved prototype styling adapted to production status names, with focus/overflow refinements. Tailwind v4 is installed through its Vite plugin; approved component CSS is retained rather than rewritten for appearance alone.
- `src/tests/`: critical behavior tests, without snapshots. jsdom's dialog shim does not certify native browser modal behavior.

Client, server and prototype retain separate pnpm manifests/lockfiles. Root workspace migration is deliberately deferred to avoid changing the verified backend/prototype installation in this UI milestone.

## Environment and prepared API boundary

No environment file is needed to review Phase 4.1. The ignored environment file, if later needed, can be created with `cp .env.example .env`. `VITE_API_BASE_URL` is a **public** build-time same-origin path, default `/api`; absolute/cross-origin URLs are rejected. Never place passwords, database URIs or signing keys in frontend variables.

Prepared methods cover register/login/logout/me, task create/list/get/update/delete and search/status/page/limit query parameters. DTO dates are ISO strings, IDs use public `id`, list results contain `data.tasks` and `meta.page/limit/total/totalPages`, and errors contain `error.code/message/fields?`. There is no token field and no summary endpoint. Production statuses are `todo`, `in_progress`, `completed`; “Pending” is a display label for `todo`.

The helper sends `credentials: 'same-origin'`, `cache: 'no-store'`, and JSON plus `X-TaskFlow-Request: 1` on mutations. DELETE/logout send `{}` and handle empty 204 responses. The browser supplies Origin; do not fabricate that header in client code. Reads accept AbortSignal. The helper preserves structured API errors and aborts, and gives safe errors for network/non-JSON responses. It provides compile-time contracts, not runtime response-schema validation.

No Vite API proxy, live `/me` restoration, CORS change, database connection or deployment configuration is enabled in Phase 4.1. A verified same-origin proxy and exact server `CLIENT_ORIGIN` are part of Phase 4.2/local integration.

## Review states

For local review only, add one of these to the login URL before signing in:

- `/login?previewState=loading`: hold initial loading.
- `/login?previewState=error`: load error with working retry.
- `/login?previewState=empty`: empty account and first-task action.
- `/login?previewState=save-error`: first mutation fails, values/data remain intact, retry succeeds.

These selectors live only in the removable preview module. The prototype playground is not part of the production component layout.

See [the Phase 4.1 report](../docs/phase-4.1-frontend.md) for verification evidence, browser limitations, changed-file inventory and the Phase 4.2 integration plan.
