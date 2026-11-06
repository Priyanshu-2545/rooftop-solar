---
name: i18n
description: Add a string in EN/MR/HI and verify it.
---
1. Add the key to `lib/i18n/en.ts` (defines the type).
2. Add the same key to `mr.ts` and `hi.ts` (in-scope screens must have both; others may fall back to EN, document in docs/I18N.md).
3. Use the key via the translate helper; never inline text in components.
4. `npm run typecheck` fails on a missing in-scope key. Mark new translations "needs native review" in docs/I18N.md.
5. Check Devanagari line-height (≥1.65) on the screen.
