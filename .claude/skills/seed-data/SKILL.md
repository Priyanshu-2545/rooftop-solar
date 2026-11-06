---
name: seed-data
description: Extend sample data safely (fictional only).
---
All people, phones (e.g. 90000 000NN), consumer numbers and addresses are FICTIONAL. Keep `db/seed.ts` idempotent (upsert by natural key). The 3 sample leads (LD-30881, LD-30902, LD-30915) must stay exactly as in the brief. Run `npm run db:seed` twice to prove idempotency. Never paste real bills or numbers.
