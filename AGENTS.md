# Repository Guidelines

## Project Structure & Module Organization

`main.go` wires the Hub server together. Backend code lives under `internal/`, grouped by responsibility: HTTP endpoints in `api`, authentication in `auth`, message routing in `app`, `bot`, `relay`, and `sink`, and persistence implementations in `store/{sqlite,postgres}`. Keep schema changes paired with the appropriate numbered migration directories. Auxiliary executables live in `cmd/appmock` and `cmd/mockserver`. The React/TypeScript UI is in `web/src`, with pages, components, hooks, stores, and shared utilities separated by directory. Frontend builds are emitted to `internal/web/dist` for embedding in the Go binary. Documentation belongs in `docs/`; runnable examples belong in `example/`.

## Build, Test, and Development Commands

- `cd web && pnpm install && pnpm run build`: install pinned frontend dependencies, type-check, and produce the embedded UI.
- `go build -o oih . && ./oih`: build and run the Hub at its default `:9800` address.
- `cd web && pnpm run dev`: run the UI dev server on port 5173, proxying API and WebSocket traffic to `:9800`.
- `task test`: start the PostgreSQL test container, run all Go tests serially, then remove test resources.
- `go test ./internal/auth`: run a focused Go package test.
- `cd web && pnpm run test`: run Vitest; use `pnpm run check` for frontend formatting and lint checks.

## Coding Style & Naming Conventions

Format Go with `gofmt`; use tabs, short lowercase package names, exported `PascalCase` identifiers, and descriptive errors. TypeScript uses two spaces, double quotes, semicolons, `PascalCase` React components, and `camelCase` functions. Keep UI filenames kebab-case (for example, `bot-detail.tsx`). Run `pnpm run check:fix` before committing frontend changes; the Husky pre-commit hook applies the same checks to staged files.

## Testing Guidelines

Place Go tests beside implementations as `*_test.go`, with `TestXxx` functions and table-driven cases where useful. Name frontend tests `*.test.tsx` and use Vitest with jsdom for UI behavior. Add regression tests for bug fixes and cover both SQLite and PostgreSQL when store behavior changes. No numeric coverage threshold is configured.

## Commit & Pull Request Guidelines

Follow the repository's Conventional Commit style: `feat:`, `fix:`, `docs:`, or `chore:`, optionally scoped (for example, `fix(bridge): ...`). Keep subjects imperative and focused. Pull requests should explain behavior and motivation, link issues, list verification commands, call out migrations or configuration changes, and include screenshots for visible UI changes. Never commit `.env` files, tokens, local databases, or generated `dist/` output.
