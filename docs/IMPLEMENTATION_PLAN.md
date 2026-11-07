# Implementation plan

Tick items as done. Each task: files, definition of done (DoD).

## Day 1 (6 Nov): foundation + hard part
- [x] Scaffold Next.js, tooling, env example. DoD: `tsc` passes.
- [x] Docs set + skills + AGENTS/CLAUDE + settings. DoD: all docs in section 3 exist.
- [x] CI workflow `.github/workflows/ci.yml` (lint, typecheck, test).
- [x] DB schema + migration + idempotent seed (3 sample leads first). Files: `db/*`. DoD: `db:seed` twice is safe.
- [x] Rules engine, one commit per module: `effective.ts`, `subsidy.ts`, `generation.ts`/`payback.ts`, `size.ts`, `score.ts`, `money.ts`. DoD: all listed tests green, coverage ≥ 95%.
- [x] Auth: mock OTP, sessions, RBAC helpers + tests. DoD: expiry/attempts/reuse/IDOR tests green.
- [x] Lead form (stepped) + upload + `extractBill` simulated + bill review + score + result. DoD: happy path works locally.

## Day 2 (7 Nov): flows
- [ ] Sales inbox + lead detail.
- [ ] Quote builder + quote story view + PDF + mock message.
- [ ] Accept quote + mock advance → project.
- [ ] Project tracker, stage changes, message log, public status page, stuck list.
- [ ] i18n pass MR/HI on scoped screens; manual-entry fallback; extraction edit audit trail.
- [ ] Design polish: tokens, fonts, sun-arc, microcopy.
- [ ] UX-laws QA walkthrough (TESTING.md checklist).

## Day 3 (8 Nov): polish, prove, ship
- [ ] Loading/empty/error states everywhere; 360px pass; keyboard/a11y; anti-slop checklist.
- [ ] Playwright E2E (3 flows); security checks (headers, IDOR, uploads); gitleaks; npm audit.
- [ ] Lighthouse slow-3G run; fix budget (record real numbers only).
- [ ] Deploy Vercel + Neon (Mumbai if available); env vars; seed prod; verify demo logins. **Needs user authorisation.**
- [ ] `docs/TDD.md`, `deployment.md`, CHANGELOG, README; TDD → PDF; ZIP = TDD + deployment.md only.

## UX-law tasks (one checkbox each, see DESIGN_SYSTEM.md)
- [ ] Aesthetic-Usability · [ ] Hick · [ ] Fitts · [ ] Jakob · [ ] Miller · [ ] Doherty · [ ] Proximity · [ ] Similarity · [ ] Common Region · [ ] Hierarchy · [ ] Progressive Disclosure · [ ] Recognition · [ ] Von Restorff · [ ] Peak-End · [ ] Goal-Gradient · [ ] Serial Position · [ ] Tesler · [ ] Postel · [ ] Occam · [ ] Feedback Loops

## 9 Nov morning
Final verification from a clean clone, public repo check, submit. No new features.

## Cut list
Real WhatsApp/SMS; real payments; DISCOM/subsidy portal; full offline sync; admin UI for rules (seed + SQL) if time runs out; stuck dashboard as list; MR/HI outside scope; dark mode; coordinator role; native translation review; real OCR.
