# Phase 4.2 — Full-stack integration design for review

Status: approved by the user before implementation. Historical design/checkpoint; actual results are in docs/phase-4.2-fullstack-integration.md.

## Objective and checkpoint

Connect the approved production React client to the existing Express/Mongoose backend without redesigning the interface, adding unrelated features, deploying, or changing production infrastructure. The approved prototype remains untouched. All Git staging, commits and pushes belong to the user.

Checkpoint executed: clean main, local HEAD and origin/main and fresh GitHub refs/heads/main all 30c5e48757399974eb2c0797da3ae6e37f3a8159 (Phase 4.1). Backend 176 tests across 11 files passed; frontend 22 tests across 4 files passed. Initial sandbox failures were rerun with required filesystem/network permissions successfully.

## Approaches and recommendation

Retain React state/hooks and the existing typed fetch helper. A new client state library or service/repository backend layer is unnecessary for this scope.

For dashboard totals, use one authenticated GET /api/tasks/summary aggregation. The alternative is four list requests reading meta.total; that reuses existing endpoints but adds requests and independent count drift. Recommend the focused endpoint expressly allowed by the Phase 4.2 request.

## Authentication lifecycle

Use a small session provider/hook with restoring, authenticated, anonymous and recoverable restoration-error states. Restore GET /api/auth/me on initial load; do not redirect to login before restoration completes. Registration/login set the public user from the response. The helper sends same-origin credentials; JavaScript never reads or stores the JWT. No localStorage or refresh tokens.

Protected dashboard routes require a restored user. A protected API 401 clears all private UI state and presents an accessible session-expired message on login. Login's invalid-credentials 401 remains a form error rather than triggering a global expiry redirect. Network/server restoration failures offer retry and do not masquerade as anonymous sessions. Cancel/ignore stale restoration requests.

Logout keeps the session until the server confirms success. Failed logout remains visible and retryable; success unmounts private state and navigates to login. Prevent duplicate submissions and conflicting logout/mutation actions. Preserve auth/task form inputs on recoverable errors; map safe server field errors where applicable.

## Task loading and mutations

Replace preview task state with a focused API hook. List requests use backend q, status, page and limit (retain six rows per page), fixed server ordering createdAt descending then _id descending. Debounce title search approximately 300 ms; reset pagination on search/filter changes. Abort obsolete reads and ignore stale responses, including during sign-out. Render loading/error/empty states without displaying mismatched prior-query results.

Create/edit/delete/toggle use existing endpoints and exact todo/in_progress/completed values. Mutations are pessimistic: retain forms/confirmation on failure, disable duplicate submissions, and refresh list plus summary after success. A successful write followed by a failed refresh must not be reported as a failed write or invite duplicate creation. Show a retryable load failure instead. Clamp/reload an out-of-range page after deletion or concurrent changes, while preserving server pagination semantics. Mark incomplete uses todo.

Summary data is independent of search, status filter and page. Surface summary loading/failure honestly rather than displaying fabricated zero totals. Task-list metadata remains the source of filtered totals.

## Summary endpoint contract and security

GET /api/tasks/summary returns HTTP 200 with:

    {"data":{"summary":{"total":0,"todo":0,"in_progress":0,"completed":0}}}

Register this static route before /:id validation. Reuse existing requireAuth and no-store middleware. Reject unsupported query parameters. Aggregate with an explicit Mongoose Types.ObjectId owner match because aggregation does not apply query casting, then group by status. Return only the four numeric counts with zero defaults. No owner IDs or task contents returned. Use the existing generic error handler; no CORS expansion or new dependencies.

Test empty counts, mixed statuses, owner isolation, authentication, unsupported query rejection and database errors. Extend real MongoDB coverage to validate owner ObjectId matching and counts independent of paginated/filtered lists.

## Local proxy and configuration

Use Vite's /api proxy with a fixed loopback backend target, default http://127.0.0.1:3000. Preserve the browser Origin and cookie/Set-Cookie headers; do not rewrite an untrusted Origin into a trusted one. Keep client API base /api and server CLIENT_ORIGIN exactly equal to the selected frontend origin. Use a strict Vite port to avoid silently invalidating CSRF configuration. Resolve existing local port usage without killing unrelated processes.

Frontend environment values are public configuration only. Signing keys and database URIs remain server-only and ignored. For verification use only the explicitly configured dedicated loopback test database authorized in Phase 3.5, after safely checking its target. No Atlas connection, new external resources, collection/database drops or broad cleanup. Use uniquely prefixed verification users/tasks; cleanup only those records.

## Verification plan

Keep existing non-preview validation/component/API tests. Replace preview-specific app expectations with controlled HTTP response tests for session restoration, route protection, auth, task CRUD, errors, expiration, stale requests, search/filter/pagination, summary and logout. Keep routine tests database-independent.

Run client and server typecheck, lint, format:check, test and build scripts. Run the separate real MongoDB integration suite only after safe configuration inspection; report its counts separately from mocked tests. Missing/unsafe database configuration blocks live verification and is not a pass.

Start the actual backend and production client locally, then attempt browser walkthroughs using real HTTP/MongoDB persistence: registration/login, refresh restoration, create/edit/toggle/delete, search/filter/pagination, summary, logout, denied unauthenticated access and CSRF failures. Check 360, 768 and 1440 CSS-pixel layouts, dialogs and keyboard interaction. Clearly report unavailable browser capabilities or unexecuted checks; jsdom is not visual verification.

## Documentation and handoff

Create docs/phase-4.2-fullstack-integration.md and update relevant README/config examples. Remove preview fixtures, demo credentials, notices and review-state selectors once replaced. Preserve historical milestone reports.

Document required Phase 5 fixed Vercel /api rewrite before SPA fallback, exact HTTPS CLIENT_ORIGIN, Secure HttpOnly host-only cookie forwarding, no-store handling, and verified proxy trust/rate-limit behavior. Local success does not verify Vercel/Render deployment behavior. Retain the documented stateless JWT revocation limitation.

Finish with exact changed-file inventory, actual check counts, browser/database limitations, secret/generated-file audit and manual-only Git handoff. Suggested commit: feat(integration): connect TaskFlow client to backend. No deployment or Phase 5 work.
