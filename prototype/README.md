# TaskFlow prototype

Isolated, disposable React/TypeScript/Vite/Tailwind application. No production code, backend, API calls, database or real authentication.

Node.js 22.13+ and pnpm 10.15.1 required. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. Vite normally serves http://127.0.0.1:5173.

Demo login: `demo@taskflow.app` / `TaskflowDemo!2026`. Registration accepts made-up valid details but does not store passwords or create a reusable account. Reload/logout resets the workspace.

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`. No unit/integration test suite is configured for this mock prototype. Browser walkthrough results live in `../docs/phase-2-verification.md`.

Dashboard playground controls demonstrate empty, loading, load-error and mutation-failure states. With failure simulation enabled, the first create/edit save in each dialog fails and retry succeeds. Completion/deletion failures persist until simulation is disabled; cancel the dialog to change that control. Reset sample data restores all fixtures.

`pnpm install` may report the esbuild install script was blocked by pnpm policy; the platform binary dependency was sufficient for the verified build. Do not broadly enable install scripts to suppress that notice.
