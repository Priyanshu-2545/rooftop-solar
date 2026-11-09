# Deployment Guide: Rooftop Solar Lead-to-Project App

| | |
|---|---|
| **Live app** | https://rooftop-solar-nine.vercel.app |
| **Source code** | https://github.com/Priyanshu-2545/rooftop-solar (public until the review ends) |
| **Stack** | Next.js 16 (TypeScript), Postgres (Neon) with Drizzle ORM, deployed on Vercel |

All people, phone numbers, consumer numbers and bills in the demo are **fictional**. Payments are always **mocked**. Bill reading uses a real vision model only when an AI key is configured (otherwise a simulated reader is used), and OTP/messages are real only when SMS keys are configured and `DEMO_MODE=false` (see section 3).

---

## 1. Run it locally, step by step

**Requirements:** Node.js 22 or newer (24 recommended), npm, Git, and Docker (for a local Postgres) or any Postgres 14+ database.

> **Windows:** use **PowerShell**, not WSL. `node_modules` holds OS-specific binaries (sharp, lightningcss, esbuild), so installing in one environment and running in the other breaks. If you switch, delete `node_modules` and `.next`, then run `npm ci` again.

**1. Get the code and install dependencies**
```bash
git clone https://github.com/Priyanshu-2545/rooftop-solar.git
cd rooftop-solar
npm ci
```

**2. Start a Postgres database** (Docker example, port 5433)
```bash
docker run -d --name solar-pg -e POSTGRES_PASSWORD=localdev -e POSTGRES_DB=solar -p 5433:5432 postgres:16-alpine
docker exec solar-pg psql -U postgres -c "CREATE DATABASE solar_test"   # only needed to run the integration tests
```
If Docker reports the port as "forbidden" on Windows, that port is reserved by the system. Pick another one (for example 5434) and use it in the next step.

**3. Create `.env.local`** (copy the names from `.env.example`, then fill in the values)
```bash
cp .env.example .env.local        # PowerShell: Copy-Item .env.example .env.local
```
Minimum values for a local demo:
```
DATABASE_URL=postgres://postgres:localdev@localhost:5433/solar
SESSION_SECRET=<any random string of 32+ characters>
DEMO_MODE=true
DEMO_OTP=123456
APP_ORIGIN=http://localhost:3000
```
Generate a secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**4. Create the tables and load the sample data** (safe to run twice)
```bash
npm run db:migrate
npm run db:seed
```
Expected output: `migrations applied` and `seeded: 20 leads, 2 staff`.

**5. Start the app**
```bash
npm run dev
```
Open http://localhost:3000 and sign in with a demo login from section 4.

**Optional: real AI bill reading.** Add one of these to `.env.local` and restart. Without a key, the five bundled sample bills still work and any other photo falls back to typing the values by hand.
```
GEMINI_API_KEY=<free key from https://aistudio.google.com/apikey>
# or
ANTHROPIC_API_KEY=<key from https://console.anthropic.com>
```

**Checks**
```bash
npm run lint && npm run typecheck
npm test                  # 238 unit and integration tests (needs the solar_test database; set TEST_DATABASE_URL if you changed the port)
npm run test:cov          # also enforces at least 95% coverage on lib/rules
npx playwright install chromium && npm run e2e    # 10 mobile end-to-end tests (needs the dev server and the seeded database)
```

---

## 2. How it is deployed

**Vercel** (app, Node runtime) + **Neon** (Postgres). Every push to `main` redeploys automatically. GitHub Actions runs lint, typecheck, tests (with a Postgres service), the coverage gate, `npm audit` and a secret scan.

1. **Database.** Create a Neon project (choose **Mumbai, `aws-ap-south-1`**, if offered: Indian personal data should stay in India) and copy the **pooled** connection string. Use the form `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`.
2. **Create the tables and seed the data once**, from your machine, against that database:
   ```powershell
   $env:DATABASE_URL = "<neon connection string>"      # bash: export DATABASE_URL="..."
   npm run db:migrate
   npm run db:seed
   Remove-Item Env:DATABASE_URL                         # bash: unset DATABASE_URL
   ```
3. **Import the repository in Vercel** (Add New, Project, pick the repo). Framework: Next.js. Keep the default build settings.
4. **Add the environment variables** from section 3 (Settings, Environment Variables, Production). Set `APP_ORIGIN` to the final public URL, for example `https://rooftop-solar-nine.vercel.app`.
5. **Deploy.** If you change an environment variable later, redeploy so it takes effect.

Notes
- Routes that read a bill allow up to 60 seconds (`maxDuration`), so use a Vercel plan that permits it (Hobby with Fluid compute, or Pro).
- Uploads are capped at 5 MB. Fonts and sample bills are bundled into the serverless output by `next.config.ts`.
- **Do not run `DEMO_MODE=true` for real customers:** the fixed OTP is public. For a real launch use `DEMO_MODE=false` with the SMS variables set, and seed only the rules you need.

---

## 3. Environment variables (names only; never commit values)

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `SESSION_SECRET` | Yes | Signs session cookies. At least 32 random characters |
| `APP_ORIGIN` | Yes | Public base URL, used in message links |
| `DEMO_MODE` | Yes | `true` shows the demo OTP hint and the sample-bill dropdown and never sends real messages. `false` for a real launch |
| `DEMO_OTP` | Demo | The fixed 6-digit demo code (used only when `DEMO_MODE=true`) |
| `OTP_IP_LIMIT` | No | OTP requests allowed per IP per 10 minutes (default 10) |
| `GEMINI_API_KEY` | No | Real AI bill reading with Google Gemini (free tier available). Used first if set |
| `GEMINI_MODEL` | No | Overrides the Gemini model |
| `ANTHROPIC_API_KEY` | No | Real AI bill reading with Claude vision |
| `ANTHROPIC_MODEL` | No | Overrides the Claude model |
| `AI_PROVIDER` | No | `gemini` or `anthropic`, to force one provider when both keys are set |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | No | Real OTP and stage messages. Ignored while `DEMO_MODE=true` |
| `TWILIO_SMS_FROM` | No | SMS sender number, or a Messaging Service SID (`MG...`) |
| `TWILIO_WHATSAPP_FROM` | No | WhatsApp sender, for example `whatsapp:+14155238886` |

With no AI key the app uses a simulated reader that recognises the five sample bills. SMS to Indian numbers needs DLT registration of the sender and template. When an AI key is set, the bill photo (including the consumer number) is sent to that provider: disclose this in the privacy notice (DPDP Act 2023).

---

## 4. Demo logins for the reviewer

Sign in at https://rooftop-solar-nine.vercel.app/signin with a phone number and the OTP. In demo mode the OTP is **`123456`** and is shown on the sign-in screen.

| Role | Phone | Who and what to try |
|---|---|---|
| Sales and admin | `9000000001` | Anita Deshmukh. Sees every lead and project, can open **Rules** |
| Sales | `9000000002` | Vikram Joshi. Same sales screens, no Rules page |
| Homeowner | `9000000015` | Deepak Gawande. Has a **sent quote** waiting: open it and choose "Accept and pay advance" |
| Homeowner | `9000000011` | Prashant Wankhede (LD-30881, Marathi). Project at "Material dispatched" |
| Homeowner | `9000000012` | Rohit Meshram (tenant, LD-30902, Hindi). Sees the "short call" outcome |
| Homeowner | `9000000013` | Ayesha Siddiqui (LD-30915). Small bill, "short call" outcome |
| Homeowner | `9000000014` | Neha Bhoyar. Quote is still a **draft**, so she sees nothing until sales sends it |
| New homeowner | any other 10-digit number | Creates a new account, to try the lead form from scratch |

**Public status links** (no login), for two seeded projects:
- `/status/demo-status-prashant-4f9c2a7e5b1d4c68a0e2f7b9d3c1a5e8`
- `/status/demo-status-sunita-7a1e3c5d9b2f4e60b8d4a6c2e0f1b3d5`

These two tokens are published on purpose and are demo-only. Real links are random 256-bit tokens, stored hashed and revocable from the project page.

**Sample bills.** With demo mode on, the lead form has a "Demo: use a sample bill" dropdown (also available as files in `samples/bills/`):
- `bill-good-340.png`, `bill-good-210.png`, `bill-good-85.png`: clear bills, read instantly with high confidence.
- `bill-ambiguous.png`: smudged. Unsure fields are marked "Check this" and one value must be typed.
- `bill-blurry.png`: poor photo. The app asks for a re-upload (after 3 tries it switches to typing the values).
- Any other photo goes to the real AI reader if a key is set, otherwise to manual entry.

Note: a second lead from the same phone and pincode within 7 days is linked to the existing lead. Use a different pincode to create a new one.

**A 5-minute tour**
1. Sign in as `9000000015`, open the lead, view the quote story, then **Accept and pay advance** (switch the language to Marathi or Hindi to see the translations).
2. Sign in as `9000000001`, open **Leads**, open a lead, choose **Start quote**, then **Send quote**.
3. As a homeowner, open the quote, expand "How we calculated this", then accept.
4. As sales, open **Projects** (stuck projects are listed first), move a stage and check **Messages**.
5. Open a public status link and switch the language.

---

## 5. Known limits

- **Payments are mocked.** OTP and messages are mocked in demo mode. The Twilio code is covered by mocked-HTTP tests only: test it with your own keys and DLT registration before launch.
- **AI reading accuracy is not measured** on real bills. Every value is shown beside the photo for a person to confirm, and failures fall back to manual entry.
- **The subsidy rule is the client's own statement and is unverified** (shown as such in the app and the PDF). Verify it before launch.
- The demo database is in a non-Indian region, so personal data leaves India. Use a Mumbai region and private object storage for bill images before real customers.
- The Rules page is read-only. New price and subsidy rules are added as dated rows through the seed or SQL.
