# TaskFlow — AppRo8 Task 2

A proposed full-stack task manager for the AppRo8 Full Stack Developer Internship (Weeks 3–4).

**Status: Phase 2 mock-data prototype built; desktop design approved; final responsive refinements verified. Production frontend and backend are not implemented.**

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
- [Manual Git handoff](docs/git-handoff/README.md)

## Proposed repository structure

```text
task-manager-fullstack/
├── client/                  # Future production frontend
├── server/                  # Future production API
├── prototype/               # Future isolated mock-data prototype
├── docs/
├── .gitignore               # Future tooling phase
├── pnpm-workspace.yaml      # Future tooling phase
├── pnpm-lock.yaml           # Future tooling phase
├── package.json             # Future tooling phase
├── README.md
└── LICENSE
```

The standalone `prototype/` app and planning documents exist. Production directories and root workspace configuration remain uncreated.

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

Planned server environment variables: `PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`. Planned client variable: `VITE_API_BASE_URL`, which is public and must never contain secrets. Future `.env.example` files will contain placeholders only; real environment files will be ignored.

Planned checks: lint, formatting, TypeScript checks, client/server builds, API integration tests and frontend interaction tests. No production tests exist or have run. Prototype static/build checks and browser walkthroughs are documented separately. See the acceptance matrix in the Phase 1 plan.

## API overview

Proposed `/api` routes cover health, registration, login, current user and owner-scoped task CRUD. List requests support title search and status filtering. See the planning document for contracts, limits and error behavior.

## Deployment and submission

Deployment has not been performed. No public live URLs are available. Local prototype screenshots are included below.

After implementation and explicit deployment approval: configure Vercel client routing, Render API environment and health checks, and Atlas access; verify the deployed end-to-end workflows. Then document verified URLs, screenshots, setup commands and test evidence. Confirm repository visibility and submit repository/frontend/backend URLs through the AppRo8 portal. No portal submission is performed by this planning phase.

## Prototype preview

![TaskFlow desktop prototype](docs/screenshots/dashboard-desktop.png)

[Mobile screenshot](docs/screenshots/dashboard-mobile.png) · [Tablet screenshot](docs/screenshots/dashboard-tablet.png)

## License

MIT — see [LICENSE](LICENSE).
