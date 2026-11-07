# Testing

## Strategy
Pyramid: many Vitest unit tests on `lib/rules` and `lib/ai`; integration tests on auth/RBAC/quote snapshotting against a test DB; 3 Playwright E2E flows on a mobile viewport.

## MUST be tested
- **Subsidy:** 1 kW→₹30,000; 2→₹60,000; 3→₹78,000; 5→₹78,000 (cap); 0/negative/NaN rejected; half kW; non-residential; date before rule (no subsidy + warning); two rows by date incl. boundary (from inclusive, to exclusive); overlap/gap throws.
- **Generation/payback:** 3 kW × 1,400 = 4,200; sample payback; zero savings; rounding; no float drift.
- **kW from units:** 340→3, 85→1, tenant→none, boundaries.
- **Scoring:** sample leads High / Low (tenant) / Low (small bill); boundaries; low confidence caps at Medium; low never "reject".
- **Extraction adapter:** good/poor/ambiguous paths; malformed output rejected by Zod; unknown image → manual; implausible flagged.
- **Auth:** OTP expiry, attempts, rate limit, reuse blocked.
- **Access control:** IDOR (homeowner vs other's lead/quote/project); sales allowed; status token valid/revoked/unknown; public page leaks no PII.
- **Snapshotting:** changing a rule after send doesn't change the sent quote.
- **Validation:** bad phone, pincode, negative bill, oversized/forged file.
- **E2E:** (1) sign in → lead → confirm bill → result; (2) sales quote → send → homeowner accepts → project; (3) stage move → message logged → public link updated.

## Run
`npm test` · `npm run test:cov` (rules coverage target ≥ 95%) · `npm run e2e` · `npm run lint` · `npm run typecheck`.

## Fixtures
`tests/fixtures/` holds rule rows and sample bills (fictional).

## Manual QA per screen
Each screen: loading, empty, error states; 360px width; keyboard only; screen reader labels; offline reload (form draft).

## UX-laws QA checklist (walked through 2026-11-07 on the real screens, screenshots in docs/screenshots)
- [x] Hick: one primary action per screen; stepped form; 3 quote options; 3 collapsed filters
- [x] Fitts: ≥48px targets (axe + CSS), sticky bottom bar in the form, bill review and accept
- [x] Jakob: OTP boxes with autofill/paste, bottom nav for homeowners, list/detail for sales
- [x] Miller: ≤3 fields per lead step (name, owner, roof on step 1); ≤3 homeowner nav items; timeline shows current + next 3
- [x] Doherty: staged "uploading / reading / checking" text, skeletons on list routes, instant client validation (note: detail routes have no skeleton on purpose, so access errors return a true 404)
- [x] Proximity/Common region: bill image and values in one region; quote numbers in one surface
- [x] Hierarchy: quote numerals first, one H1 per screen
- [x] Disclosure: details behind "How we calculated this"; collapsed timeline
- [x] Von Restorff: saffron only on the primary action and the sun; stuck projects are the loud list
- [x] Peak-End: kind low-score copy (EN/MR/HI) and the warm "project has started" confirmation
- [x] Goal-gradient: sun-arc step progress and project progress
- [x] Postel: +91/spaces/dashes, "₹3,200", sq m, Devanagari digits (unit tests)
- [x] Feedback: message preview after a stage change, inline "Saved", loading buttons

## Accessibility / performance checklist
Contrast script passes; focus visible; `aria-live` on extraction; Lighthouse mobile ≥ 90 Perf/A11y on lead form and status page (record real numbers only).

## Results (2026-11-07)
- `npm test`: 231 tests pass (unit + integration against a real Postgres `solar_test` database).
- `lib/rules` coverage: 100% statements/lines/functions, 99% branches (gate 95%).
- `npm run e2e`: 10 Playwright tests pass on a mobile viewport: lead flow, quote flow (incl. real PDF and IDOR), project flow (incl. revoke), Marathi/Hindi, axe WCAG 2.2 AA at 360px on all core screens, security headers, deny-by-default, logout revocation.
- Lighthouse: see `docs/LIGHTHOUSE.md` (98/100/100 on the standard mobile profile; the strict 3G performance target is NOT met, with the measured reason).
- Secret scan (gitleaks) and `npm audit --omit=dev`: clean.

## Running the E2E tests
`npm run dev` (with a seeded DB and `OTP_IP_LIMIT=1000` in `.env.local`, since the suite signs in many times from one IP), then `npm run e2e`. Screenshots are written to `e2e/shots/` (git-ignored).
