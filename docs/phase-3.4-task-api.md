# Phase 3.4 — authenticated task management API

Verified locally on October 30, 2026. This milestone implements the five requested task endpoints only; no production frontend, prototype modification, Atlas connection or deployment occurred.

## Checkpoint and architecture

Before implementation, main was clean at `00d33126ad59b1740a3922de40dc2976af72192b feat(auth): implement secure cookie-based authentication`. Local HEAD, origin/main and a fresh read-only GitHub ls-remote result matched. All 94 existing backend tests passed before changes.

Reviewed the Phase 1/prototype plans, Phase 3.3 auth report, server documentation/source/models and prototype task types/behavior. Reused cookie authentication, req.user, CSRF protection, safe errors and the existing Mongoose connection. No new dependencies, configuration variables, service/repository layers or search infrastructure were added. All existing tests and the approved prototype are unchanged.

## Status contract — explicit change from the mock prototype

The user's Phase 3.4 request is authoritative. Production schema validation and API validation share TASK_STATUSES from src/models/task.ts:

| Production DB/API/future frontend | Prototype mock value | Display label |
| --- | --- | --- |
| todo | pending | Pending / To do |
| in_progress | in-progress | In progress |
| completed | completed | Completed |

Production accepts only todo, in_progress and completed. Legacy mock strings are not accepted aliases. The prototype remains unchanged and disconnected from production; no mock-data migration or compatibility layer was added. Future frontend code must use the production values and can retain the approved display labels. Mark complete with PATCH status=completed; mark incomplete with PATCH status=todo, or explicitly select in_progress to resume work.

The earlier planned /tasks/summary endpoint is deferred: it is not among this milestone's five requested endpoints. Future dashboard counters must be addressed explicitly rather than inferred from a paginated/filtered page. No summary feature was silently added.

## Task model and index

Typed TaskRecord and Mongoose Task model:

- title: required, trimmed, 1–120 characters.
- description: optional on create, trimmed, at most 2000 characters; defaults to empty string.
- status: required enum, defaults to todo.
- owner: required immutable ObjectId reference to User; assigned only from the authenticated identity.
- createdAt and updatedAt: maintained by Mongoose timestamps.

Strict model fields reject unrelated attributes; buffering is disabled consistently with the User model. A compound `{owner:1,createdAt:-1,_id:-1}` index supports owned-list sorting. The _id tie-breaker makes ordering deterministic for equal creation timestamps. The model reuses an existing compiled model during repeated imports. Mongoose's existing auto-index setting builds the declared performance index after connection; no new startup readiness gate is added for this nonunique index. Live index creation/performance has not been verified.

## API contract

All five endpoints require a valid existing session cookie and a current authenticated User. POST/PATCH/DELETE additionally require the same CSRF rules as authentication: exact Origin=CLIENT_ORIGIN, X-TaskFlow-Request: 1 and application/json. Send {} on DELETE. Auth and task responses—including parser errors—use Cache-Control: no-store. Existing CORS/proxy assumptions and deployment limitations remain unchanged; no permissive CORS was enabled.

| Method/path | Success | Behavior |
| --- | --- | --- |
| POST /api/tasks | 201 | Creates a task owned by req.user.id |
| GET /api/tasks | 200 | Owned list, optional search/status filter, pagination |
| GET /api/tasks/:id | 200 | Retrieves a matching owned task |
| PATCH /api/tasks/:id | 200 | Updates a nonempty subset of editable fields |
| DELETE /api/tasks/:id | 204 | Deletes an owned task; empty response body |

Single-task success envelope:

```json
{
  "data": {
    "task": {
      "id": "507f1f77bcf86cd799439011",
      "title": "Review the task API",
      "description": "Check ownership and status transitions",
      "status": "todo",
      "createdAt": "2026-10-30T10:00:00.000Z",
      "updatedAt": "2026-10-30T10:00:00.000Z"
    }
  }
}
```

The ID/date values above are illustrative. The response uses an explicit DTO: owner, populated User fields, passwords/hashes and internal _id/__v are never included. No population of User data is performed.

POST body example:

```json
{"title":"Review the task API","description":"Check ownership and status transitions","status":"todo"}
```

Only title is mandatory. Missing description/status receive their create defaults. Client owner/IDs/timestamps/operators/unrelated fields are rejected, not trusted or silently mass-assigned.

PATCH examples:

```json
{"title":"Finish the review"}
```

```json
{"status":"completed"}
```

```json
{"status":"todo","description":"Ready for another pass"}
```

PATCH has its own schema with no create defaults, so omitted fields stay unchanged. Empty objects, blank/overlong titles, invalid statuses, operators and owner changes return 400. Updates use only an explicit `$set` from validated fields with `runValidators:true` and `returnDocument:'after'`; there is no upsert.

An authenticated local HTTP request has these headers (the session value is a placeholder, never a real credential):

```http
POST /api/tasks HTTP/1.1
Origin: http://127.0.0.1:5173
X-TaskFlow-Request: 1
Content-Type: application/json
Cookie: taskflow_session=<session established by login>

{"title":"Review the task API"}
```

Production uses the Secure __Host-taskflow cookie and the configured HTTPS origin through the intended same-origin proxy. Do not paste real session values into docs, chat, source or command history. See [authentication documentation](phase-3.3-authentication.md) for login/session details and unresolved proxy deployment checks.

## Search, filtering and pagination

Example: GET /api/tasks?q=review&status=in_progress&page=1&limit=20

| Query | Rules |
| --- | --- |
| q | Optional trimmed title substring, max 120 characters; empty means no search |
| status | Optional exact production status |
| page | Digits-only integer 1–10000, default 1 |
| limit | Digits-only integer 1–100, default 20 |

Unknown, repeated/array-valued, operator-shaped, fractional, negative and oversized parameters return 400. Query parameters on create and ID routes are rejected because none are supported there. Sorting is fixed, not client-controlled: createdAt descending, then _id descending. No arbitrary sort or MongoDB filter is accepted.

Search escapes regex metacharacters before applying a case-insensitive MongoDB title substring query. Searching for `[api].*` searches that literal text rather than a regular expression. Search/status predicates combine with the authenticated owner and use the same filter for countDocuments.

List response:

```json
{
  "data": {"tasks": []},
  "meta": {"page":1,"limit":20,"total":0,"totalPages":0}
}
```

Total is the filtered owned count, not the current page length. A page beyond the result set remains empty and retains its requested page; it is not silently clamped. Empty result sets have totalPages=0. Limits/page bounds avoid unbounded responses and extreme offsets; offset pagination is deliberately sufficient for this assignment.

List and count are independent queries, not a transactional snapshot. Concurrent writes can cause count/page drift, and offset pages can shift between requests despite deterministic sorting. Case-insensitive substring searches scan candidate owned tasks rather than using a separate search index/service. Larger datasets would need measured query/index and cursor-pagination decisions, not speculative infrastructure now.

## Ownership and safe errors

Every task database filter contains the authenticated owner, including detail, count, update and delete. Creation derives owner server-side after strict body validation. ID routes use 24-hex-character ObjectId validation before task queries. Auth runs before task handlers and task mutations run CSRF checks before data changes; the existing global JSON parser can still reject malformed/oversized input before routing.

Valid but missing and foreign-owned task IDs both return exactly:

```json
{"error":{"code":"TASK_NOT_FOUND","message":"Task not found."}}
```

There is no separate unscoped existence query, avoiding both an ownership gap and disclosure of another user's task. Deletes/updates are atomic owner-scoped operations. Unknown/malicious update fields are rejected by strict Zod validation, with immutable owner and strict model fields as additional defenses.

| Status | Meaning |
| --- | --- |
| 400 | Invalid body, query, empty PATCH or malformed task ID; VALIDATION_ERROR |
| 401 | Missing/invalid/expired session or missing authenticated user |
| 403 | Failed Origin/custom-header CSRF check |
| 404 | Missing or foreign-owned task; identical TASK_NOT_FOUND |
| 413 | JSON body exceeds existing 16 KiB limit |
| 415 | Mutation is not application/json or unsupported encoding |
| 500 | Unexpected/database error; existing generic INTERNAL_ERROR |

Unexpected exceptions use the existing safe middleware: no raw driver errors, request bodies, stack traces or sensitive credentials are returned/logged. No new auth behavior or task-specific abuse infrastructure was introduced.

## Verification evidence and limits

Baseline: 94 tests passed across 9 files. Final repository verification used pnpm 10.15.1 and host Node 26.8.1; this milestone did not separately run a Node 24 CI matrix.

| Check | Actual result |
| --- | --- |
| pnpm --dir server typecheck | Passed |
| pnpm --dir server lint | Passed, no errors/warnings |
| pnpm --dir server format:check | Passed |
| pnpm --dir server test | **176 tests passed, 0 failed, 11 files passed** |
| pnpm --dir server build | Passed |

All existing 94 tests and their source files are unchanged. Added 16 Task model tests and 66 task API cases. Tests cover model defaults/validation/index definition, all endpoint authentication, CRUD, public DTOs, strict fields, malformed IDs, update validators, sequential completion/incompletion, owner injection, two-user isolation, literal search/status filtering, tied-date sort/pagination metadata, empty/out-of-range pages, invalid queries, CSRF/JSON restrictions, no-store parsing errors and database failures on every operation.

Tests were written and observed failing against the absent router/minimal model before implementation. Two test-helper typing/lint issues were corrected; the final type/lint/format checks pass. No production code/test exception was hidden by disabling checks.

**Mocks versus integration:** Task/User database operations in API tests are isolated stateful mocks, with explicit assertions on owner filters and database options. JWT/cookie/CSRF middleware and temporary loopback HTTP sockets are real. Model tests use real Mongoose schemas on unsaved documents. No successful live MongoDB query, index build, database-backed update validation, persistence or timestamp write was verified. Actual MongoDB integration remains an outstanding gate before production readiness; no Atlas credentials were needed or used.

A separate compiled ESM smoke check imported the emitted modules and exercised create, list/search/filter/page metadata, retrieve, complete/incomplete, delete, two-user denial, invalid IDs, owner injection and CSRF over a temporary local HTTP listener. It used process-local database mocks with real model validation/JWT middleware, passed, and closed its listener. It is not a deployed/browser/database integration test.

The existing health/session behavior and prototype are preserved. No new dependency installation into the repository was needed; manifests and lockfiles are unchanged. No frontend, summary endpoint, optional fields, production MongoDB connection or deployment was added.

## Changed files and manual Git handoff

Modified:

```text
README.md
server/README.md
server/src/app.ts
```

Added:

```text
docs/phase-3.4-task-api.md
server/src/models/task.ts
server/src/tasks/routes.ts
server/src/tasks/validation.ts
server/tests/task-model.test.ts
server/tests/tasks.test.ts
```

Only these nine source/documentation paths are intended. No unexpected changes, known secret patterns or generated artifacts were found in the change set. Existing ignore rules exclude real environment files, node_modules, dist, coverage and logs. No real .env file was created/read during verification, and no new credential appears in examples/tests. Test JWT secrets are generated in memory.

Only the user runs Git staging/commit/push. Review and execute manually:

```bash
cd '/Users/mavery/Documents/Codex-workspace/AppRo8 Internship 1/week2/task-manager-fullstack'
git status --short --branch
git diff --check
git diff -- README.md server/
git ls-files --others --exclude-standard
git add -- README.md server/README.md server/src/app.ts docs/phase-3.4-task-api.md server/src/models/task.ts server/src/tasks/ server/tests/task-model.test.ts server/tests/tasks.test.ts
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached -- server/src server/tests
git commit -m "feat(tasks): implement authenticated task management API"
git status --short --branch
git push origin main
```

The agent performed no staging, commits, pushes, destructive Git or history rewriting. Stop for user review before the next milestone.
