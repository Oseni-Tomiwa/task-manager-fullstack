# TaskFlow — Phase 1 proposal

Date: October 29, 2026. Status: approved by the user for the prototype phase. This document authorizes no implementation, database connection, deployment or push.

## Repository inspection

Inspected `/Users/mavery/Documents/Codex-workspace/AppRo8 Internship 1/week2/task-manager-fullstack/`.

- Branch: `main`, tracking `origin/main`; working tree clean at inspection.
- HEAD: `ea711f9 Initial commit`.
- Origin: `https://github.com/Oseni-Tomiwa/task-manager-fullstack.git`.
- All existing tracked files: `README.md`, `LICENSE` (MIT, copyright 2026 Oseni Tomiwa).
- No package manifest, lockfile, source, tests, environment configuration, CI or deployment configuration was present. No applicable ancestor AGENTS.md was found.
- The original README described a modern full-stack application and its intended features without clarifying implementation status. The revised README labels these as planned. Its original text was:

> # task-manager-fullstack
> A modern full-stack task management application built with React, TypeScript, Node.js, Express, and MongoDB. Features secure authentication, task management, search, filtering, and a responsive dashboard.

The chat workspace is a different directory containing an existing `task-api` project. It was not modified or treated as this application's implementation. Remote repository visibility and remote freshness have not been independently verified; no fetch, commit or push occurred.

## Architecture and alternatives

Recommend the requested React/Vite frontend and Express API, independently deployable from one pnpm workspace. The `client/`, `server/`, `docs/` layout fits the assignment; add `prototype/` for explicit separation and a pnpm workspace file when setup is approved. Keep the repository name unchanged and use TaskFlow as the product name.

Alternatives considered: separate repositories add coordination and conflict with the requested submission layout; a full-stack React framework changes the requested Vite/Express approach without a clear MVP benefit. Neither is recommended. These are engineering proposals, not choices already approved by the user.

Use routes, validation schemas, authentication middleware, Mongoose models and small controllers. Extract business helpers when needed; avoid generic repositories, dependency injection frameworks and speculative service layers. Client pages use reusable form, task row, dialog and feedback components plus a small API wrapper and auth context. Native fetch is sufficient initially; do not add a global state library or query library without demonstrated need.

## Exact MVP and acceptance criteria

| Area | Acceptance criteria | Verification planned |
| --- | --- | --- |
| Registration | Name, email and password required; normalized email unique; invalid input rejected; password hash never returned | API valid/invalid/duplicate and concurrent duplicate tests; form errors |
| Login/logout | Valid credentials open dashboard; invalid credentials show generic feedback; logout clears token, user and cached tasks | API success/401 and frontend interaction tests |
| Protection | Unauthenticated routes redirect to login; missing, invalid or expired JWT returns 401 | API and route tests |
| Ownership | Every read/write is scoped to authenticated owner; another user's task returns 404 | Two-user integration tests for detail, update, delete and list |
| Create/view | Valid title creates a persistent task; owned list and details match saved data; timestamps shown | API integration and UI walkthrough |
| Edit/complete | Title, description and status editable; marking complete persists; failed save retains entered values | API validation/update and frontend failure tests |
| Delete | Confirmation required; cancel preserves task; successful deletion removes it; failure preserves row | API and frontend tests |
| Search/filter | Case-insensitive literal title substring search combines with one status filter; clear restores list | Combined query, special-character and empty-result tests |
| Summary | All, pending, in-progress and completed counters describe all owned tasks, independent of active filters | API count and UI tests |
| Feedback | Initial loading, submission pending, errors with retry, empty account and no search results are distinct | Mocked loading/failure UI tests |
| Responsive/accessibility | Usable at 360, 768 and 1440 CSS pixels; no horizontal overflow; keyboard navigation, visible focus, labels and focus-managed dialogs | Browser review, keyboard and contrast checks |
| Delivery | React communicates with deployed Express API; reload of dashboard route works; README commands and public URLs verified | Build/type/lint checks, deployed smoke test and README review |

Out of scope: priority, due dates, teams, roles, sharing, realtime updates, AI, payments, notifications, password reset, email verification, social login, refresh-token infrastructure and drag-and-drop. Missing password reset and email verification must be documented as scope limitations.

## Proposed data model

**User:** `_id: ObjectId`, `name: string` (trimmed, 1–80 characters), `email: string` (trimmed, lowercase, valid email, max 254), `passwordHash: string` (excluded by default), `createdAt`, `updatedAt`. Unique index on email; catch duplicate-key errors as well as checking input. Never trim or normalize passwords.

**Task:** `_id: ObjectId`, `owner: ObjectId` (required User reference), `title: string` (trimmed, 1–120), `description: string` (max 2000, default empty), `status: pending | in-progress | completed` (default pending), `createdAt`, `updatedAt`. Index `{owner: 1, createdAt: -1, _id: -1}`; add a status compound index only if query evidence warrants it. No soft deletion or separate summary collection.

Return public IDs as `id` strings, timestamps as ISO strings, and omit hash, owner and Mongoose metadata from public DTOs. Owner always comes from verified JWT subject, never request input.

## Proposed API contract

JSON API under `/api`; JSON success envelope uses `data`, optional `meta`; errors use `{error: {code, message, fields?}}`. Never expose stack traces or database errors.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | /health | 200 if API/database ready; 503 on unavailable dependency, no secrets |
| POST | /auth/register | `{name,email,password}` → 201 `{data:{user,token}}`; duplicate email 409 |
| POST | /auth/login | `{email,password}` → 200 `{data:{user,token}}`; bad credentials 401 |
| GET | /auth/me | Authenticated → 200 `{data:{user}}` |
| GET | /tasks | Authenticated list with `q`, `status`, `page`, `limit` |
| GET | /tasks/summary | Authenticated → `{data:{total,pending,inProgress,completed}}` |
| POST | /tasks | `{title,description?,status?}` → 201 `{data:{task}}` |
| GET | /tasks/:taskId | Owned task → 200 `{data:{task}}` |
| PATCH | /tasks/:taskId | Nonempty subset of editable fields → 200 `{data:{task}}` |
| DELETE | /tasks/:taskId | Owned task → 204, no body |

Register `/tasks/summary` before the ID route. Validate IDs and query values; malformed IDs or inputs return 400, absent/foreign-owned tasks 404, oversized bodies 413, rate limits 429, unexpected errors 500. Unknown body keys are rejected, including `owner` and timestamps. Invalid credentials use the same response for absent users and wrong passwords.

List defaults: page 1, limit 20, maximum 100; `q` max 120 characters; status optional and strictly enumerated. Escape regex metacharacters before a MongoDB case-insensitive title substring query; never accept raw MongoDB operators. Sort newest first by `createdAt` then `_id`, returning `{data:{tasks},meta:{page,limit,total}}`. Frontend resets page on query changes, debounces search about 300 ms, cancels/ignores stale responses and shows previous/next controls. Summary ignores query filters; reload list and summary after successful mutations.

## Proposed authentication and security decisions

Use a signed short-lived JWT (proposed 30 minutes) with subject user ID, issuer, audience and expiry. Explicitly allow one signing algorithm and verify every claim. Keep the token in frontend memory, transmit via `Authorization: Bearer`, and clear it on logout or 401. A reload or new tab requires login again. No localStorage/sessionStorage token persistence, refresh tokens or cookie credentials in the MVP. Logout removes browser access but does not revoke an already copied token; it remains valid until expiry. This limitation and reload behavior require review.

A persistent HttpOnly-cookie session is an alternative if persistence is essential, but would need an agreed same-site/proxy strategy plus CSRF controls and deployment tests. Do not silently change transport during implementation.

Use bcrypt with an initial cost of 12, measured on deployment hardware. Proposed password policy: minimum 12 characters and maximum 72 UTF-8 bytes to avoid bcrypt truncation; allow spaces and Unicode and show the limits in the form. Never log credentials or tokens. Use TLS in deployment, Helmet headers, small JSON body limit (proposed 16 KB), configurable authentication rate limits (starting point 10 attempts per 15 minutes per IP), and correctly scoped proxy trust. Confirm limiter behavior behind Render; do not blindly trust forwarded headers. Rate limiting adds one focused dependency; a single-instance memory store is acceptable for the initial deployment, with restart limitations documented.

Exact allowlisted client origin for CORS; no wildcard credentials. OPTIONS preflight permits required methods and Authorization header. CORS is not authorization. Owner scope must be part of each database operation, including counts. Render task text as text, never injected HTML. Validate configuration on startup; secrets stay server-side and outside Git. Use a least-privilege Atlas database user and review network access during deployment. Do not connect to Atlas in Phase 1.

OWASP advises against storing authentication credentials in browser storage: [Session Management guidance](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Session_Management_Cheat_Sheet.md?plain=1). In-memory tokens reduce persistence exposure but do not make XSS harmless.

## Quality and deployment plan

Once implementation is approved, add Vitest/Supertest integration coverage against an isolated test database, never a production database. Include two-user ownership tests, hash exclusion, malformed inputs, JWT expiry, combined queries and summary correctness. Frontend tests should cover important interactions and failure states using mocked API responses; select only the minimal testing helpers needed at setup. Each phase must pass relevant lint, formatting, TypeScript, tests and build checks before review. No test or build result is claimed in Phase 1.

Vercel hosts client static output; Render runs compiled Express using its supplied PORT; Atlas stores data. Plan pnpm root-workspace installation and package-scoped build commands, then verify exact commands after scaffolding. Keep API fallback separate from SPA routing. Vercel's [Vite guidance](https://vercel.com/docs/frameworks/frontend/vite) requires configuring SPA deep links. Preview origins must be explicitly managed; do not broadly allow all preview domains.

Render [free service documentation](https://render.com/docs/free) currently describes idle spin-down after 15 minutes and startup delays. Show useful connection/loading/retry feedback and test a cold start; paid hosting remains a later user decision. No uptime guarantees or fictitious deployment URLs.

## Milestones and deadline risks

Proposed dates in Africa/Lagos; dates do not substitute for approval:

1. October 29: Phase 1 inspection and proposal; stop for approval.
2. October 30–31: isolated clickable mock-data prototype; review and explicit approval before production.
3. November 1–3: approved tooling, API/auth/ownership and integration tests; review.
4. November 4–6: frontend integration, responsiveness, error/loading states; review.
5. November 7–9: approved deployment, end-to-end checks and complete README/screenshots; internal completion target November 9.
6. November 10–12: contingency, public URL verification and internship portal submission by official November 12 deadline.

Risks: delayed reviews compress the schedule; hosting cold starts and CORS may emerge late; Atlas credentials/network configuration need user access; package compatibility must be checked during setup; optional features can consume the buffer. Mitigate with a narrow scope, separate mock prototype, early deployment planning and verified workflows. Existing Task 1 API may be inspected for reusable ideas later, but any copying requires review and tests against this contract.

## Phase 1 change summary and approval gate

Modified `README.md` to reflect actual status and link planning. Added this document and `docs/prototype-plan.md`. Preserved LICENSE and original README text above. No source, dependency installation, database connection, commit, push or deployment.

Review the scope, schema/API, memory-token/reload behavior and prototype plan. Explicit approval advances only to the mock-data prototype phase; production implementation remains gated on prototype approval.

## Phase 2 authentication review

The user requested evaluation of HttpOnly cookies. See [authentication-decision.md](authentication-decision.md) for a proposed same-origin proxy with short-lived cookie JWTs, CSRF/CORS rules, logout and expiration. This proposal does not silently replace the bearer API contracts above; production transport requires an explicit decision before implementation. Phase 2 remains mock-only.
