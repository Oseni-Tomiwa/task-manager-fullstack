# TaskFlow Full-stack Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Connect the approved React UI to the existing authenticated Express/MongoDB API, with accurate global task counts.

**Architecture:** Reuse the typed fetch helper and existing components. Introduce small session/task hooks, a fixed same-origin development proxy, and one owner-scoped summary aggregation. No state-management dependency or new backend layer.

**Tech Stack:** React 19, TypeScript, Vite, Express, Mongoose, Vitest, Testing Library, Supertest, pnpm.

**Spec:** ../specs/2026-10-31-fullstack-integration-design.md (approved by user).

## Global Constraints

- Preserve approved UI and prototype; no unrelated features, production infrastructure, deployment or Phase 5.
- Git is read-only for the agent; user stages, commits and pushes.
- Keep HttpOnly JWT, exact Origin/custom-header/JSON CSRF, same-origin credentials, no browser token storage or refresh infrastructure.
- Use only authorized loopback MongoDB test database; unique fixtures, scoped cleanup, no global drops.
- Successful writes remain successful when later read refresh fails.

## Review Focus

- Stale session/list requests must not restore an old user's private data.
- Double submissions and failed refresh after create must not duplicate writes.
- Empty pages after deletes must recover without showing false empty-account counts.
- Network restoration/logout failures must retain retryable state and not claim logout success.
- Summary aggregation must cast the owner to ObjectId and never count another user's tasks.

### Task 1: Summary API

**Files:** server/src/tasks/routes.ts; server/tests/summary.test.ts; server/tests/integration/mongo.integration.ts.
**Interfaces:** GET /api/tasks/summary -> {data:{summary:{total,todo,in_progress,completed}}}; static route before /:id, no query parameters.

- [x] Write HTTP tests for authenticated empty/mixed summary, owner ObjectId filter, unauthorized, rejected queries, safe database failure and no-store.
- [x] Run pnpm test -- tests/summary.test.ts; observe missing endpoint failures.
- [x] Implement one owner-match/group aggregation with zero defaults and existing security middleware.
- [x] Run backend routine tests; extend dedicated real-database suite with exact owner counts.

### Task 2: Session and proxy

**Files:** client/src/api/client.ts, contracts.ts; client/src/auth/Session.tsx; client/src/App.tsx; client/src/pages/AuthPage.tsx; client/vite.config.ts; client/src/tests/app.test.tsx, api.test.ts.
**Interfaces:** SessionProvider/useSession expose user, restoration state/retry, signIn, logout, mutation-independent session-expiry handling. API summary(signal) uses TaskSummaryResponse.

- [x] Add failing response-controlled UI tests for restoration, route protection, retry, login/register/logout failure and protected-request 401 expiry.
- [x] Add API summary/cancellation and unauthorized callback tests. Run focused tests and verify failures.
- [x] Implement provider, replace preview auth, remove demo copy, wire protected routes and fixed loopback /api proxy with strict port.
- [x] Run client tests and typecheck; preserve existing component/validation coverage.

### Task 3: Task state and dashboard integration

**Files:** client/src/tasks/useTasks.ts; client/src/pages/Dashboard.tsx; client/src/tests/app.test.tsx; remove client/src/preview/workspace.ts.
**Interfaces:** useTasks(query,status,page,setPage) returns server page/meta, independent summary, loading/error states, retry and guarded save/toggle/remove callbacks.

- [x] Add failing tests for real helper-backed CRUD, recoverable save/delete errors, accurate unfiltered summary, pagination/filter/search requests, cancellation/stale completion, mutation-success/read-failure separation.
- [x] Implement cancellable debounced reads, pessimistic guarded writes, independent summary failure UI and page recovery. Retain dialogs, typography and design.
- [x] Remove preview-only module/selectors; run all client tests and correct integration defects with regression tests.

### Task 4: Real database, browser verification and handoff

**Files:** docs/phase-4.2-fullstack-integration.md; README.md; client/README.md; server/README.md; relevant environment examples; verification fixtures only if useful as repeatable tests.

- [x] Safely inspect dedicated .env.integration target without printing credentials; run pnpm test:integration separately.
- [x] Start actual application against authorized local test DB with ephemeral signing secret; fixed proxy and exact frontend Origin.
- [x] Attempt actual browser workflows and responsive checks at 360/768/1440; capture evidence and report blockers honestly. Cleanup only exact verification users/tasks and stop only processes started for this phase.
- [x] Run typecheck/lint/format:check/test/build for both apps; record exact counts and failures.
- [x] Review complete diff, secrets/generated artifacts and changed-file inventory; document deployment risks and exact manual Git handoff.

## Execution ledger

Ruling: Use an isolated file-only scratch copy for implementation, preserving the source checkout and all Git metadata; copy only intended changes back for final verification. This obeys the user's read-only Git requirement and avoids creating branches/worktrees or commits. User explicitly requested plan creation followed by execution, so no additional plan approval pause.
Pre-flight: Task 2 summary DTO matches Task 1 endpoint; Task 3 consumes Task 2 session expiry handling and helper. Reads accept AbortSignal; mutations do not accept cancellation because server writes may already have completed.

Task 1 complete: summary tests observed missing-route failures, then 184 routine backend tests and 16 real MongoDB tests passed.
Task 2/3 complete: preview replaced, test-first restoration/recovery cases observed failing; 37 frontend tests passed before final stale-summary/focus-preservation additions.
Ruling: Keep a session hook in App rather than adding a Context provider; only App and its direct Dashboard need the boundary, so props preserve a smaller architecture.
Ruling: Independent review is explicitly required by the executing-plans/requesting-code-review skills. Reviewer identified two P2 findings; both were corrected and re-reviewed, with real browser focus verification.
Task 4 complete: final source-checkout checks passed: client 39/5, backend routine 184/12, real MongoDB 16/1; type/lint/format/build passed for both. Live browser/proxy/responsive walkthrough completed, scoped data cleanup passed; temporary servers stopped. Final intended-file/secret/ignored-artifact audit passed. User alone stages, commits and pushes.
