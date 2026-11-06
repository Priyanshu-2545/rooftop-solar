# Code style

- TypeScript `strict`; **no `any`** (use `unknown` + Zod).
- Files `kebab-case.ts`; components `PascalCase.tsx`; one concept per file.
- **Money is integer paise.** Never floats for money. Helpers in `lib/rules/money.ts` (`rupeesToPaise`, `mulPaise`, `formatINR`). kW values may be decimals (0.5 steps) but converted via integer half-kW units internally.
- **`lib/rules/*` is pure:** no imports from db/env/next, no `Date.now()`; dates and rows passed in.
- Errors: throw typed errors in libs; server actions return `{ ok: false, message }` with friendly text; never leak stack traces.
- Comments: explain *why* and mark `ASSUMPTION An` where a guess matters. No commented-out code.
- Lint/format: ESLint (next config) + Prettier (`.prettierrc`); `npm run typecheck` before commit.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), one logical change each.
