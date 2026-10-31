# Phase 4.1 — Production React frontend

## Scope and implementation plan

Preserve the approved prototype's visual identity and interactions inside `client/` using React, TypeScript, Vite, Tailwind CSS and React Router. All authentication and task behavior in this milestone is explicitly isolated presentation state. Live integration is Phase 4.2.

- [x] Establish independent client tooling, environment example and focused interaction tests.
- [x] Define exact backend DTOs and a small unused HTTP client; test credentials, CSRF headers, query serialization, 204 and safe errors.
- [x] Extract approved styling and reusable components; use production task statuses, validation and accessible dialogs.
- [x] Keep preview fixtures/session/tasks in a removable module, with no browser storage or real network calls.
- [x] Verify navigation, validation, tasks, dialogs and feedback automatically; attempt browser checks and explicitly document the responsive verification blocker.
- [x] Run all frontend checks, reverify backend tests, document limitations and exact user-owned Git handoff.

Constraints: no prototype/backend modifications, live API wiring, database access, deployment, staging, commits or pushes. Existing approved design and the user's Phase 4.1 brief are authoritative; no redesign is needed. Client keeps its own lockfile like the existing server and prototype; root workspace migration is outside this milestone.

Review focus: Unicode password limits; summaries independent of filtered pagination; mutation failures retain values; focus restoration after deleting a row; long task/user text at narrow widths. No summary endpoint exists: Phase 4.2 must explicitly settle that contract before claiming dashboard-wide real-data counts.

## Delivered structure and design

`client/` is an independent pnpm application with React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 via its Vite plugin, and React Router 7 in declarative mode. Dependency major versions follow the approved prototype; no UI framework or state-management library was introduced. The client has its own reproducible lockfile. The deprecated jest-dom version initially selected by a range was replaced by an exact supported `6.9.1` dependency before verification.

Approved prototype CSS, branding, copy, layout, iconography, breakpoints and interactions were reused without editing `prototype/`. Reusable components cover branding, named icon actions and dismissible tooltips, field errors, native dialogs, task forms, list rows, summary/progress cards, toolbar, feedback states and pagination. Login and registration keep the approved two-column composition and mobile treatment. The dashboard retains four summary cards, progress strip, task list and mobile cards. Prototype playground controls were not copied into the product layout.

The component CSS is preserved alongside Tailwind's theme/preflight/utilities. Changes are focused: production status selectors, field-error associations, skip link, long-name/text wrapping, disabled pending actions and scroll locking during dialogs. The auth form heading is explicitly focused on navigation, ahead of the decorative story heading. This fixes a mobile focus defect in the copied selector; a regression test was observed failing before the fix and passing afterward. The approved prototype itself was not changed.

`src/preview/workspace.ts` is the only fixture/mock-state module. It supplies an in-memory preview session, tasks, derived whole-workspace counts and async presentation callbacks. It is not a duplicate mock HTTP server and has no persistence or production/mock toggle. App/dashboard import this module at explicit replacement points. Form and display components use production types and async callbacks and can be retained in Phase 4.2.

The running app and compiled build explicitly display **Phase 4.1 preview**. Preview registration creates no real account; sign-in, sign-out, creation, completion, editing and deletion affect memory only. Nothing calls the backend. No tokens or entered passwords are stored in browser storage. The public preview credential is deliberately documented and is not a secret or real account.

## Scripts and environment

See [client/README.md](../client/README.md) for exact install/run/check commands, source structure and review-state URLs. Node.js 24.10+ and pnpm 10.15.1 are declared. `pnpm dev`, `typecheck`, `lint`, `format:check`, `test` and `build` are the normal workflow; `test:watch`, `format` and `preview` are also available.

No `.env` is required for the preview. `client/.env.example` contains only public `VITE_API_BASE_URL=/api`. The HTTP helper defaults to that relative path and rejects absolute/cross-origin bases. There is no active Vite API proxy in this phase. Real `.env` files, dependencies, build output, coverage and logs are ignored; no generated output should be staged.

## API contracts prepared, not integrated

`src/api/contracts.ts` matches current backend public envelopes and fields:

- Public user: `id`, `name`, `email`, ISO `createdAt`/`updatedAt`; no token or password hash.
- Public task: `id`, `title`, `description`, `status`, ISO timestamps; no owner/internal Mongoose fields.
- Exact statuses: `todo`, `in_progress`, `completed`. “Pending” is only a display label for `todo`.
- User/task success envelopes: `data.user` / `data.task`.
- List envelope: `data.tasks`, `meta.page`, `limit`, `total`, `totalPages`.
- Error envelope: `error.code`, `message`, optional field-message arrays.

The centralized helper exposes registration, login, session retrieval, logout, task creation/list/retrieval/update/deletion, and typed search/status/page/limit queries. It sends same-origin credentials and no-store requests. Mutations send JSON and `X-TaskFlow-Request: 1`; logout and DELETE send `{}`. The browser supplies Origin. Empty 204 responses are handled without parsing; query/ID components are encoded; cancellation is forwarded and preserved. Structured API errors retain status/code/fields, while network/invalid-JSON responses get safe actionable messages. These are compile-time DTOs, not runtime response-schema validation.

The helper is tested using stubbed `fetch`, not an actual backend connection. It is not instantiated by the current UI. Real CSRF/cookie/proxy/session semantics still require Phase 4.2 integration verification. No backend behavior or contract was changed.

Client validation mirrors documented field limits, code-point password minimum, JavaScript length and bcrypt UTF-8 byte maximum. The server remains authoritative, including its stricter email validation. Search in this preview is immediate over in-memory titles; request debouncing, cancellation and stale-result handling belong to Phase 4.2.

## Automated verification

| Check                                       | Verified result                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Git prerequisite                            | Clean `main`; local and GitHub main both `e356ab236654208eef08c7ca816aee729a63217c` (Phase 3.5) |
| Existing backend tests before frontend work | 176 passed, 11 files                                                                            |
| Frontend TypeScript                         | Passed                                                                                          |
| Frontend ESLint                             | Passed, no warnings                                                                             |
| Frontend formatting                         | Passed                                                                                          |
| Frontend tests                              | **22 passed, 4 files**                                                                          |
| Client production build                     | Passed                                                                                          |
| Existing backend tests after frontend work  | **176 passed, 11 files**                                                                        |
| Git whitespace and intended-file audit      | Passed                                                                                          |

Frontend commands were run using the pinned pnpm scripts with permitted package-manager access. Initial sandboxed attempts could not resolve the package-manager version registry; this did not require bypassing signature checks or changing pnpm versions. The installed Vite/esbuild build succeeded without enabling additional install scripts.

The 22 tests cover:

- Protected preview navigation, login/register links, auth-heading focus, invalid credentials, registration and logout.
- Accessible local validation and password visibility; Unicode code-point/UTF-8 byte boundaries; task length/status validation.
- Dashboard summary, six-row presentation pages, search/status combination, empty results and filter clearing; summary remains independent of the filtered page.
- Create/edit/completion/incompletion, cancel/confirm deletion, safe initial focus, focus restoration including deletion of the invoking row, Tab wrap and cancel/Escape event handling.
- Pending actions, blocked dialog dismissal while saving, failed-save value retention/retry, failed-delete preservation/retry, loading, failed load/retry and empty-account creation action.
- Dismissible action tooltips and accessible button activation.
- Unused HTTP helper routes, JSON/CSRF/cookie request options, query/ID encoding, AbortSignal, 204s, structured errors, invalid responses, network errors and cross-origin base refusal.
- A fetch spy verifies the exercised preview sign-in and task mutation make no API requests.

The existing 176 backend tests use isolated/mocked database boundaries; no MongoDB connection or new real-database test run was performed in Phase 4.1. Phase 3.5's separate 15 real-MongoDB results remain historical evidence in its report.

A focused independent source review found the auth-heading focus issue above. It was fixed and retested. No other concrete security/correctness finding was reported.

## Browser, accessibility and responsive verification limits

**No completed manual browser walkthrough is claimed for this milestone.** The browser automation host was unavailable. Native Edge reported a user-interaction conflict, and Chrome failed with a screen-capture error. A local Vite server started successfully on port 5174, but starting a server is not a browser verification result. No new responsive screenshots were captured.

Source inspection confirms the approved 600/900/1440px responsive rules and 44px task/action targets were retained, long task/user strings wrap or truncate, reduced-motion behavior and visible focus styling remain present, and dialogs constrain width/height with scrolling. Components use semantic controls, explicit names, native modal dialogs, focus management, field-error descriptions and status/alert feedback. The jsdom dialog shim checks component logic only; it does not implement a browser's top layer, inert background, native Escape behavior or visual layout.

**Still to verify in an available browser:** login, registration, dashboard and create/edit/delete dialogs at 360, 768 and 1440 CSS pixels; actual document overflow and touch-target measurements; keyboard-only navigation, modal focus/inertness/scrolling; rendered typography/contrast and long-content layouts. These are not treated as passing automated layout tests. The prototype's earlier successful walkthrough is reference evidence, not fresh verification of `client/`. No full screen-reader or cross-browser certification is claimed.

## Phase 4.2 integration plan (not implemented)

1. Replace `usePreviewSession` with an auth context that restores `/auth/me`, shows session loading, and clears private state on 401. Wire login/register through the prepared client. Clear local session/tasks only after successful server logout; preserve retry feedback on failure. No browser token storage.
2. Replace `usePreviewTasks` with a focused API hook using `meta` for pagination. Add approximately 300ms search debouncing, reset page on query/filter changes, and cancel/ignore stale requests. Wire CRUD and preserve the current pending/error/value-retention behavior.
3. Settle whole-workspace summary counts explicitly. The current backend has **no `/tasks/summary` endpoint**. A backend-compatible option is four small `GET /tasks?limit=1` requests (unfiltered plus each status), reading `meta.total`; an aggregate endpoint would require a separate approved backend proposal. Do not count only the visible/filtered page or invent an existing endpoint. Independent counts may drift during concurrent writes, consistent with the current list contract.
4. Configure and verify a fixed same-origin development proxy and exact backend `CLIENT_ORIGIN`, then test real cookies, CSRF, session restoration, expiry, logout and owner isolation with the dedicated local integration database. Do not weaken Origin checks or use cross-site cookie workarounds.
5. Delete the preview module, public preview credentials/notice and review-state selectors once real integration is verified. Keep the reusable UI, DTOs, HTTP helper and relevant interaction tests; replace preview-oriented test setup with controlled API responses.
6. Complete the blocked browser/responsive checks and actual frontend/backend integration tests before claiming end-to-end readiness. Deployment remains a separately authorized milestone.

## Exact changed-file inventory

Modified:

```text
README.md
```

Added:

```text
client/.env.example
client/.gitignore
client/README.md
client/eslint.config.js
client/index.html
client/package.json
client/pnpm-lock.yaml
client/src/App.tsx
client/src/api/client.ts
client/src/api/contracts.ts
client/src/components/ActionButton.tsx
client/src/components/Brand.tsx
client/src/components/FieldError.tsx
client/src/components/Modal.tsx
client/src/components/Pagination.tsx
client/src/components/TaskForm.tsx
client/src/components/TaskList.tsx
client/src/components/TaskState.tsx
client/src/components/TaskSummary.tsx
client/src/components/TaskToolbar.tsx
client/src/main.tsx
client/src/pages/AuthPage.tsx
client/src/pages/Dashboard.tsx
client/src/preview/workspace.ts
client/src/styles.css
client/src/tests/api.test.ts
client/src/tests/app.test.tsx
client/src/tests/components.test.tsx
client/src/tests/setup.ts
client/src/tests/validation.test.ts
client/src/validation.ts
client/src/vite-env.d.ts
client/tsconfig.json
client/vite.config.ts
client/vitest.config.ts
docs/phase-4.1-frontend.md
```

Review found no real secrets in intended changes. Documented passwords and test inputs are explicitly synthetic. `client/node_modules/` and `client/dist/` are generated and ignored; the incidental package-manager cache created during a blocked launch was removed from the working tree. Backend and approved prototype files are unchanged. All work remains unstaged.

## User-owned Git handoff

From the repository root, review every new source file as well as the tracked README diff. `git diff` alone does not show untracked file contents. These commands are provided for the user and were not executed by the agent:

```sh
git status --short --branch
git diff --check
git diff -- README.md
git ls-files --others --exclude-standard
# Review client/ and docs/phase-4.1-frontend.md in your editor.
git add -- README.md client/ docs/phase-4.1-frontend.md
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached
# Confirm no .env, node_modules, dist, coverage, caches or real credentials are staged.
git commit -m "feat(client): establish production React frontend"
git status --short --branch
git push origin main
```

Phase 4.1 stops here for review. No Phase 4.2 live integration, database access, frontend/prototype redesign, backend modification, deployment, staging, commits, pushes or history rewriting was performed.
