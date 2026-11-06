# AGENTS.md

Rooftop solar lead-to-project app for Company A (Nagpur). Read the docs below before changing things.

## Commands
`npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run test:cov` · `npm run e2e` · `npm run db:generate` · `npm run db:migrate` · `npm run db:seed`

## Hard rules
1. **Money is integer paise.** No floats for money.
2. **`lib/rules/*` is pure** (no db/env/next, no `Date.now()`).
3. **Never let AI compute price, subsidy, size or acceptance.** Bill reading is simulated and untrusted; a person confirms it.
4. Subsidy and prices come from dated rule rows; sent quotes are snapshots.
5. Never commit secrets. `.env.example` has names only. All sample data is fictional.
6. Run `npm run lint && npm run typecheck && npm test` before every commit. Conventional Commits, one logical change each.
7. Label guesses `ASSUMPTION` and add them to `docs/ASSUMPTIONS.md`.
8. UI work: read `docs/DESIGN_SYSTEM.md` (tokens, anti-slop checklist, UX laws) first. No hard-coded strings (see `docs/I18N.md`).
9. Enforce RBAC server-side with ownership checks on every read.

## Docs
[PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md) · [Plan](docs/IMPLEMENTATION_PLAN.md) · [Design](docs/DESIGN_SYSTEM.md) · [Security](docs/SECURITY.md) · [Code style](docs/CODE_STYLE.md) · [Testing](docs/TESTING.md) · [AI](docs/AI.md) · [Assumptions](docs/ASSUMPTIONS.md) · [i18n](docs/I18N.md)

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
