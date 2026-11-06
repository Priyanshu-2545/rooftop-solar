---
name: rules-engine
description: Add or modify a subsidy or price rule row and its tests (effective dating, no overlaps). Use when touching lib/rules or rule seed data.
---
1. Rules are dated rows; interval is `[effective_from, effective_to)`, null `to` = open.
2. To change a rule: insert a NEW row with the new `effective_from`, set the old row's `effective_to` to the same date. Never edit rows that sent quotes used.
3. Keep `lib/rules/*` pure: pass rows and dates in; money is integer paise.
4. Add tests in `tests/rules/` for: new boundary day, overlap throws, gap throws, old date still picks old row.
5. Seed subsidy rows with `verified=false` until the client confirms (ASSUMPTION A1).
6. Run `npm run test:cov`; rules coverage must stay ≥ 95%.
