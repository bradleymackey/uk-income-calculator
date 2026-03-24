# CLAUDE.md

## Workflow

- After each modular change, commit with a descriptive message.
- Before every commit, run `pnpm run lint`, `pnpm run format:check`, `pnpm run build`, and `pnpm test` to ensure everything passes.
- Use `pnpm` (not npm).

## Project

UK income tax calculator built with TanStack Start, React, TypeScript, Vite, and Tailwind CSS.

- Tax rules live in `src/data/tax-rules/*.json` — one file per tax year.
- Calculator logic is in `src/lib/calculator.ts` with tests in `src/lib/calculator.test.ts`.
- All calculator state syncs to URL search params for shareable links.
