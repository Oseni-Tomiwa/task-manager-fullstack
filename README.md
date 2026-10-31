# TaskFlow — AppRo8 Task 2

A full-stack task manager in development for the AppRo8 Full Stack Developer Internship (Weeks 3–4).

**Status: Backend verified through Phase 3.5 real MongoDB integration testing. Phase 4.1 React frontend foundation is implemented in `client/`, preserving the approved prototype. Its authentication and task operations remain isolated presentation behavior; real API integration is reserved for Phase 4.2. No deployment has occurred.**

Repository: [Oseni-Tomiwa/task-manager-fullstack](https://github.com/Oseni-Tomiwa/task-manager-fullstack).
Internal target: November 9, 2026. Official deadline: November 12, 2026.

## Planned features

Registration, login and logout; a protected dashboard; owner-scoped task creation, viewing, editing, completion and deletion; title search; status filters; summary counters; accessible responsive layouts; loading, empty, error and success states.

## Proposed stack and architecture

React, TypeScript, Vite, Tailwind CSS and React Router in `client/`; Node.js, Express, TypeScript, MongoDB Atlas, Mongoose, JWT, bcrypt and Zod in `server/`. One pnpm workspace, with ESLint, Prettier, Vitest and Supertest. No shared package until duplication justifies one.

Browser → React client → Express API → MongoDB Atlas. The API authenticates requests and enforces task ownership. Frontend deployment is planned for Vercel; backend deployment for Render.

## Planning documents

- [Phase 1: audit, scope, architecture, API and security](docs/phase-1-plan.md)
- [Prototype design, interactions and review checklist](docs/prototype-plan.md)
- [Cookie authentication recommendation](docs/authentication-decision.md)
- [Phase 2 verification](docs/phase-2-verification.md)
- [Final prototype review](docs/final-prototype-review.md)
- [Manual prototype Git handoff (historical)](docs/git-handoff/README.md)
- [Phase 3.1 backend foundation](docs/phase-3.1-backend.md)
- [Phase 3.2 MongoDB foundation](docs/phase-3.2-database.md)
- [Phase 3.3 secure authentication](docs/phase-3.3-authentication.md)
- [Phase 3.4 task API](docs/phase-3.4-task-api.md)
- [Phase 3.5 real MongoDB integration](docs/phase-3.5-integration.md)
- [Phase 4.1 production frontend foundation](docs/phase-4.1-frontend.md)

## Proposed repository structure

```text
task-manager-fullstack/
├── client/                  # React frontend foundation; preview data until Phase 4.2
├── server/                  # Production backend foundation
├── prototype/               # Approved isolated mock-data prototype
├── docs/
├── .gitignore               # Environment and generated-file exclusions
├── README.md
└── LICENSE
```

`client/`, `server/` and the isolated `prototype/` each have their own pnpm manifest and lockfile. Root workspace migration is deferred; this preserves the verified backend/prototype installation while establishing the frontend.

## Installation, local development and testing

The prototype requires Node.js 22.13+ (verified on 24.22.1) and pnpm 10.15.1. From the repository root:

```bash
cd prototype
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite (normally http://127.0.0.1:5173). Demo login: `demo@taskflow.app` / `TaskflowDemo!2026`. Registration simulates success with valid made-up details; no reusable account or password is stored. All changes and mock sessions reset on reload or logout.

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Use **Prototype playground** on the dashboard to review loading, empty, load-error and mutation-failure states. See [Phase 2 verification](docs/phase-2-verification.md) for actual evidence and limitations. The prototype makes no API/database requests and requires no environment variables.

Current server variables: `PORT`, `HOST`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET` and `CLIENT_ORIGIN`. Startup requires the database URI, a privately generated signing secret and the exact frontend origin. Client variable: `VITE_API_BASE_URL`, a public same-origin path defaulting to `/api`. The Phase 4.1 UI does not call it yet. Environment examples contain placeholders/public configuration only; real environment files are ignored.

Planned checks: lint, formatting, TypeScript checks, client/server builds, API integration tests and frontend interaction tests. Foundation HTTP and environment tests now exist in `server/`; see the Phase 3.1 report for executed results. Prototype static/build checks and browser walkthroughs are documented separately. See the acceptance matrix in the Phase 1 plan.

## Production frontend foundation

See [client/README.md](client/README.md) for structure, scripts, environment configuration and review states. From the repository root:

```sh
cd client
pnpm install --frozen-lockfile
pnpm dev
```

Use Node.js 24.10+ and pnpm 10.15.1. Phase 4.1 preserves the approved login, registration, responsive dashboard and task dialogs, with focused frontend tests. The visible preview uses `demo@taskflow.app` / `TaskflowDemo!2026`; registration accepts made-up details. No real account is created or password stored. All mock sessions and tasks reset on reload/logout. A typed HTTP client is prepared and tested separately, but the UI makes no backend requests yet.

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

Phase 4.2 will replace the isolated presentation state with verified session/API integration. Browser verification limitations and the summary-count contract decision are documented in the Phase 4.1 report. No deployment or production readiness is claimed.

## API overview

Implemented `/api` routes cover health, registration, login/logout, current user and owner-scoped task CRUD. Lists support title search, status filtering and pagination. Authentication uses HttpOnly cookies and exact Origin/custom-header CSRF checks. See the Phase 3.3/3.4 documents for current contracts; earlier Phase 1 proposals are historical. There is no summary endpoint.

## Deployment and submission

Deployment has not been performed. No public live URLs are available. Local prototype screenshots are included below.

After implementation and explicit deployment approval: configure Vercel client routing, Render API environment and health checks, and Atlas access; verify the deployed end-to-end workflows. Then document verified URLs, screenshots, setup commands and test evidence. Confirm repository visibility and submit repository/frontend/backend URLs through the AppRo8 portal. No portal submission is performed by this planning phase.

## Prototype preview

![TaskFlow desktop prototype](docs/screenshots/dashboard-desktop.png)

[Mobile screenshot](docs/screenshots/dashboard-mobile.png) · [Tablet screenshot](docs/screenshots/dashboard-tablet.png)

## License

MIT — see [LICENSE](LICENSE).

## Production backend foundation

See [server/README.md](server/README.md) for setup, environment validation, scripts, health/errors and shutdown behavior. From the repository root:

```bash
cd server
pnpm install --frozen-lockfile
cp .env.example .env
# Configure MONGODB_URI, a private JWT_SECRET and exact CLIENT_ORIGIN.
# Start local MongoDB or use an authorized development database.
pnpm dev
```

`GET /api/health` returns HTTP 200 with `{"status":"ok"}`. Startup now requires an authorized local/development MongoDB URI and connects before listening; health remains process liveness. A typed User model defines validation and the unique email index. Cookie authentication and owner-scoped task CRUD/search/filtering/pagination are implemented. No deployment has occurred.

Production task statuses are `todo`, `in_progress`, `completed`; frontend contracts use these values. The approved prototype retains its original mock-only status names. See the task API document for the explicit mapping and request/response contracts.
