# Deployment guide

- **Live app:** {{LIVE_URL}}
- **Source:** {{GITHUB_URL}} (public until review ends)

All people, phone numbers, consumer numbers and bills in this app are **fictional demo data**. Bill reading, OTP, messages and payments are **mocked** (see the TDD).

## 1. Demo logins (reviewer)

Sign in with phone + OTP. In demo mode the OTP is fixed and shown on the sign-in screen.

| Role | Phone | Notes |
|---|---|---|
| Sales + admin | `9000000001` | Anita Deshmukh. Sees everything, can open **Rules**. |
| Sales | `9000000002` | Vikram Joshi. No Rules page. |
| Homeowner | `9000000011` | Prashant Wankhede (lead LD-30881, Marathi, project at "Material dispatched"). |
| Homeowner | `9000000012` | Rohit Meshram (tenant, LD-30902, Hindi): sees the "Let's start with a short call" outcome. |
| Homeowner | `9000000013` | Ayesha Siddiqui (LD-30915): small bill, short-call outcome. |
| Homeowner | `9000000015` | Deepak Gawande: has a quote that was **sent** and is waiting to be accepted (try "Accept and pay advance"). |
| Homeowner | `9000000014` | Neha Bhoyar: her quote is still a **draft**, so she sees nothing until sales sends it. |

**OTP: `123456`** (env `DEMO_OTP`, only revealed when `DEMO_MODE=true`).
Any other 10-digit number creates a new homeowner account (for trying the lead form from scratch).

**Public status links** (no login), for the two seeded projects:
- `/status/demo-status-prashant-4f9c2a7e5b1d4c68a0e2f7b9d3c1a5e8`
- `/status/demo-status-sunita-7a1e3c5d9b2f4e60b8d4a6c2e0f1b3d5`

(These two tokens are published on purpose and are demo-only. Real links are random 256-bit tokens, stored hashed, and can be revoked from the project page.)

**Sample bill photos** are in `samples/bills/` of the repo. In demo mode the lead form also has a "Demo: use a sample bill" dropdown, so no file is needed:
- `bill-good-340.png`, `bill-good-210.png`, `bill-good-85.png`: clear bills (the reader is "sure").
- `bill-ambiguous.png`: smudged, so fields are marked "Check this" and one must be typed.
- `bill-blurry.png`: poor photo, so the app asks for a re-upload (after 3 tries it switches to typing the values by hand).
- Any other image: the reader says "cannot read this", and the app goes to manual entry.

**A 5-minute tour:** (1) sign in as `9000000015`, open the lead, view the quote story, **Accept and pay advance** (switch language to see Marathi/Hindi); (2) sign in as `9000000001`, open **Leads**, open a lead, **Start quote**, **Send quote**; (3) as a homeowner, open the quote, expand "How we calculated this", **Accept and pay advance**; (4) as sales, open **Projects** (stuck ones are listed first), move a stage, check **Messages**; (5) open a public status link and switch language.

## 2. Run locally, step by step

Requirements: Node 24+ (22+ works), npm, and a Postgres 14+ database (Docker is easiest).

```bash
# 1. dependencies
npm install

# 2. database (Docker example)
docker run -d --name solar-pg -e POSTGRES_PASSWORD=localdev -e POSTGRES_DB=solar -p 54329:5432 postgres:16-alpine
docker exec solar-pg psql -U postgres -c "CREATE DATABASE solar_test"   # only needed for the integration tests

# 3. environment: copy the names from .env.example into .env.local and fill them in
cp .env.example .env.local
#   DATABASE_URL=postgres://postgres:localdev@localhost:54329/solar
#   SESSION_SECRET=<any random string of 32+ characters>
#   DEMO_MODE=true
#   DEMO_OTP=123456
#   APP_ORIGIN=http://localhost:3000

# 4. create tables and load the sample data (safe to run twice)
npm run db:migrate
npm run db:seed

# 5. run
npm run dev            # http://localhost:3000
```

Checks:

```bash
npm run lint && npm run typecheck
npm test                 # 231 unit + integration tests (needs the solar_test database)
npm run test:cov         # also enforces ≥95% coverage on lib/rules
npx playwright install chromium && npm run e2e   # 10 mobile-viewport E2E tests (needs the dev server + seeded DB)
```

## 3. How it is deployed

Vercel (Next.js, Node runtime) + Neon Postgres.

1. Create a Neon project (**choose the Mumbai / `aws-ap-south-1` region if offered**: Indian personal data should stay in India; if it is not available, that is a documented limit, see SECURITY.md) and copy its pooled connection string.
2. Push the repo to GitHub (public) and import it in Vercel (framework: Next.js; no custom build command).
3. In Vercel → Settings → Environment Variables, add the names below for Production.
4. Run the migration and seed **once against the production database** from your machine:
   ```bash
   DATABASE_URL="<neon connection string>" npm run db:migrate
   DATABASE_URL="<neon connection string>" npm run db:seed
   ```
5. Deploy, then sign in on the live URL with the demo logins above.

## 4. Environment variables (names only; never commit values)

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | Signs session cookies. At least 32 random characters |
| `DEMO_MODE` | `true` shows the demo OTP hint and the sample-bill dropdown. Use `false` for a real launch |
| `DEMO_OTP` | The fixed 6-digit demo code (only used when `DEMO_MODE=true`) |
| `APP_ORIGIN` | Public base URL, used in message links (for example `https://your-app.vercel.app`) |
| `OTP_IP_LIMIT` | Optional. OTP requests per IP per 10 minutes (default 10) |

## 5. Known limits of this deployment

- OTP, WhatsApp/SMS, payments and bill reading are mocked (swap points: `lib/auth/otp.ts`, `lib/messaging/provider.ts`, `lib/ai/index.ts`).
- Bill images and documents are stored in the database for the demo; production should use private object storage in an India region.
- The subsidy rule is the client's statement and is **unverified** (shown as such in the app and PDF).
