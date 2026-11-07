# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-11-08 (submission build)
### Added
- Lead form (5 steps, offline draft, double-submit protection), bill review (image beside values, sure/check this), re-upload and manual-entry fallbacks, kind lead result.
- Simulated, adapter-based bill reader and transparent rule-based scoring (no external AI).
- Pure rules engine: effective-dated selection, subsidy, generation, payback, sizing, scoring (100% covered).
- Sales inbox, lead detail (masked consumer number with audited reveal), survey, schedule.
- Quote builder (live numbers, exact homeowner preview), snapshotting, re-price warning, quote story, PDF (EN/MR/HI), accept with mock advance.
- Project tracker with sun-arc timeline, forward-only stage moves, documents, stuck list, message log, revocable public status link.
- Mock OTP sign-in with revocable sessions, RBAC with IDOR tests, CSP with nonce and security headers.
- Marathi and Hindi on the scoped screens; PWA shell and offline page.
- 231 unit/integration tests, 10 mobile E2E tests, axe audits, Lighthouse results, CI with Postgres, audit and gitleaks.

### Known gaps
- Strict slow-3G Lighthouse target not met (see docs/LIGHTHOUSE.md).
- Mock OTP, messages and payments; subsidy rule unverified; translations need native review.

## [0.1.0] - 2026-11-06
### Added
- Project scaffold, tooling and docs set.
