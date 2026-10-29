# TaskFlow server — Phase 3.1

Production backend foundation only: Express 5, TypeScript, Zod, Helmet, pnpm, Vitest and Supertest. No authentication, database or task business logic is implemented.

## Run locally

Use Node.js 24.10+ (Node 24 LTS recommended) and pnpm 10.15.1. From the repository root:

```bash
cd server
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

`GET http://127.0.0.1:3000/api/health` returns HTTP 200 with exactly `{"status":"ok"}`. No authentication is required. This is a process liveness check, not database readiness. Nothing connects to MongoDB.

## Commands

| Command             | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `pnpm dev`          | Run TypeScript with Node watch mode and tsx |
| `pnpm build`        | Compile only src/ to dist/                  |
| `pnpm start`        | Run compiled dist/index.js                  |
| `pnpm typecheck`    | Check source and tests without emission     |
| `pnpm lint`         | ESLint source, tests and configuration      |
| `pnpm format`       | Format package files                        |
| `pnpm format:check` | Check formatting without modifications      |
| `pnpm test`         | Run Vitest once                             |
| `pnpm test:watch`   | Watch tests                                 |

Build before using start. dev/start load an optional `.env` using Node's built-in `--env-file-if-exists`; exported environment variables take precedence. No dotenv dependency is needed. Tests import the application factory without starting the production entry point or reading real .env files; Supertest binds temporary local ports.

## Configuration

| Variable | Default     | Validation                                                           |
| -------- | ----------- | -------------------------------------------------------------------- |
| NODE_ENV | development | development, test or production                                      |
| HOST     | 127.0.0.1   | Nonempty trimmed string; invalid/unresolvable addresses fail startup |
| PORT     | 3000        | Digits only, integer 1–65535                                         |

Validation errors show field names, never values. Real `.env` and `.env.*` files are ignored; `.env.example` contains only non-secret defaults. Do not introduce JWT secrets or database credentials before those milestones.

For a later hosting milestone, explicitly set HOST=0.0.0.0 and NODE_ENV=production and use the platform-supplied PORT. The local default deliberately binds loopback. No hosting configuration or deployment is provided here.

## Structure and behavior

- src/app.ts: side-effect-free createApp() factory, Helmet security headers, 16 KiB JSON parser, health route, 404 and error middleware.
- src/config/env.ts: pure environment parser and inferred Env type; no config reads during import.
- src/middleware/errors.ts: stable JSON error responses; no request bodies, stack traces or arbitrary exception messages returned/logged.
- src/index.ts: validation, listener startup, safe startup-error reporting, SIGINT/SIGTERM handling. Stop accepting connections and drain active requests; after 10 seconds close remaining HTTP connections and set a failing exit code. Repeated signals are idempotent.
- tests/: HTTP contracts, body parsing, error sanitization and environment validation.

Error envelope: `{error:{code,message}}`. Unknown routes return 404 NOT_FOUND; malformed JSON 400 INVALID_JSON; oversized JSON 413 PAYLOAD_TOO_LARGE; unsupported encoding 415 UNSUPPORTED_ENCODING; unexpected failures 500 INTERNAL_ERROR. JSON parsing occurs before route resolution. Non-JSON bodies are not consumed as JSON; future route-level content-type validation is deferred until mutation endpoints exist. Trust proxy remains Express's default false. No CORS middleware or allow-origin response headers are enabled.

## Anticipated proxy/authentication architecture

A later Vercel client will call relative `/api` paths, proxied to Render while keeping browser requests same-origin. See ../docs/authentication-decision.md for the proposed HttpOnly/Secure/SameSite cookie JWT strategy, exact Origin and custom-header CSRF controls, expiration/logout behavior and required deployment checks. A proxy, CORS allowlist, cookies, CSRF enforcement and auth routes are intentionally not implemented in this phase. Do not treat the absence of CORS as authentication or access control. Client integration and mutation-route security must be added in their authorized milestones.

No repository/service layers, database models, refresh-token infrastructure, deployment manifests or production frontend were added. The approved prototype is independent and unchanged.
