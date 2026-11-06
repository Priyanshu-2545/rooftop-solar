# Security

## Lightweight threat model
| Threat | Mitigation |
|---|---|
| IDOR (homeowner reads another's lead/quote/project) | ownership check in every loader/action; deny by default; tested |
| OTP brute force / SMS pumping | hashed, 5-min expiry, 5 attempts, per-phone + per-IP limits, lockout, single use |
| Session theft | signed httpOnly Secure SameSite=Lax cookie, short TTL, rotation on login, server-side logout |
| CSRF | SameSite cookies + Origin check on server actions; no state change via GET |
| Malicious upload | MIME allowlist + magic bytes, 5 MB cap, re-encode (strips EXIF/GPS), random keys, authorised route only |
| Status-link guessing | ≥128-bit random token, stored hashed, revocable, rate-limited, noindex |
| XSS | React escaping, strict CSP, no inline scripts except nonce |
| PII leakage | masking, no PII in logs, minimal public page |

## Auth / OTP design
Phone normalised to E.164 (+91). OTP is 6 digits, hashed with SHA-256 + per-challenge salt, constant-time compare (`crypto.timingSafeEqual`). **Mocked for this build (A18):** the code is `DEMO_OTP`, shown in a dev banner only when `DEMO_MODE=true`, and logged to `messages`. Production must send via a real provider and never reveal the code.

## Sessions
`jose` HS256 JWT in cookie `session` (httpOnly, Secure in prod, SameSite=Lax), 12h TTL, new token each login. Revocation: a `sessions` row id (`jti`) is checked, so logout works server-side.

## RBAC matrix
| Resource | Homeowner | Sales | Admin | Public token |
|---|---|---|---|---|
| Own lead/bill | RW | – | – | – |
| Any lead | – | RW | RW | – |
| Quote | R own, once `sent` | RW | RW | – |
| Accept quote | own | – | – | – |
| Project | R own | RW | RW | R minimal |
| Documents | R own | RW | RW | names only |
| Rule tables | – | R | RW | – |
| Message log | – | R | R | – |

## Input validation
Zod on every action/route input and on env; max lengths; strict objects (unknown fields rejected); phone/pincode/number formats.

## File upload rules
JPEG/PNG/WebP (HEIC only if conversion is feasible; otherwise documented as unsupported). Max 5 MB. Magic-byte sniff, re-encode and downscale server-side. Never in `/public`.

## Rate limits
In-memory/DB-backed windows per phone and IP for OTP and token pages. Known gap: in-memory limiter is per-instance on serverless; production should use a shared store.

## Status-link token
32 random bytes (base64url), only SHA-256 stored. Page shows first name, stage, timeline, next step, document names. Never consumer number or full address. `X-Robots-Tag: noindex`.

## DPDP notes
Consent captured with text version + timestamp. Minimisation: only fields in the lead form. Mask consumer numbers (last 4); unmask only on bill review/detail and audit-log it. Retention A17. Deletion on request: documented script. Hosting: Neon/Vercel region chosen at deploy (Mumbai preferred; if unavailable this is a documented limit).

## Secrets policy
Only in env. `.env.example` has names only. `.env*` git-ignored. Run `gitleaks` before each push and check `git log -p` for accidents.

## Dependency hygiene
Lockfile committed; `npm audit` reviewed at release (current moderate findings are dev-tooling transitive minimatch via eslint; not shipped to runtime); no unused packages.

## Known gaps
Mock OTP/payments; in-memory rate limiting; no real malware scan; bill images in DB for the demo; no MFA for sales.
