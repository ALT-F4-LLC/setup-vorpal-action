# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript sources for the action (`index.ts` entry, `cleanup.ts`).
- `__tests__/`: Jest tests (`*.test.ts`). Fixtures live in `__fixtures__/`.
- `dist/`: Compiled JS used by `action.yml` (`main: dist/index.js`, `post: dist/cleanup.js`).
- Config: `action.yml`, `eslint.config.mjs`, `rollup.config.ts`, `tsconfig*.json`.
- CI/workflows: `.github/`.

## Build, Test, and Development Commands
- Install: `npm install` (Node 20+ required).
- Build: `npm run build` or `make build` (writes to `dist/`).
- Test: `npm test` or `make test` (Jest + ts-jest, ESM enabled).
- Lint: `npm run lint`.
- Format: `npm run format:check` | `npm run format:write`.
- Coverage badge: `npm run coverage` (outputs `badges/coverage.svg`).
- Local run: `npm run local-action` (uses `@github/local-action` against `src` with optional `.env`).
- Full check: `npm run all` (format → lint → test → coverage → build).

## Coding Style & Naming Conventions
- Language: TypeScript, ESM modules. Indentation: 2 spaces; semicolons required.
- Linting/formatting: ESLint (`eslint.config.mjs`) + Prettier enforced in CI.
- Names: files kebab- or simple-case (`cleanup.ts`, `index.ts`); tests `*.test.ts`.
- Identifiers: camelCase for variables/functions, PascalCase for types/interfaces.
- Action logs: prefer `@actions/core` (`core.info`, `core.error`) over `console`.

## Testing Guidelines
- Framework: Jest with `ts-jest` resolver; tests in `__tests__/` named `*.test.ts`.
- Coverage: collected from `src/**` into `coverage/` (thresholds configurable in `jest.config.js`).
- Mocks: use `jest.unstable_mockModule` for `@actions/*`, `fs`, and process utilities.
- Run focused tests locally with `npx jest <pattern>`.

## Commit & Pull Request Guidelines
- Branches: `feature/<topic>` or `fix/<topic>` (e.g., `feature/bwrap-support`).
- Commits: clear, imperative subject; prefer Conventional Commits (`feat:`, `fix:`, `chore:`) when reasonable.
- PRs: include description, linked issue, rationale, and any relevant logs/screenshots. Ensure `npm run all` passes.
- Important: commit updated `dist/` artifacts when changing `src/` so the action remains runnable from `action.yml`.

## Security & Configuration Tips
- Never commit secrets; use workflow `secrets` for AWS env vars when `registry-backend: s3`.
- Local runs and CI create `/var/lib/vorpal/**` and may invoke `sudo`; ensure the runner has appropriate permissions.
