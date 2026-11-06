# Assumptions register

Everything not in the problem statement. Change values in the place listed under "Where".

| # | Assumption | Where used | How to change |
|---|---|---|---|
| A1 | **UNVERIFIED.** Central residential subsidy: ₹30,000/kW up to 2 kW + ₹18,000 for the 3rd kW, cap ₹78,000. Taken from the client's statement; must be verified before launch. | `subsidy_rules` seed, `lib/rules/subsidy.ts`, quote UI footnote | Insert a new dated row; never edit a sent quote |
| A2 | Subsidy rule effective_from = 2024-01-01, open-ended | seed | new row + close old row |
| A3 | Rule interval is `[effective_from, effective_to)`: start inclusive, end exclusive; to=null means open | `selectEffectiveRule` | n/a |
| A4 | System sizes are whole or half kW; other fractions rejected | `computeSubsidy` | `lib/rules/subsidy.ts` |
| A5 | Recommended kW = round(units × 12 ÷ 1,400) to nearest whole kW, minimum 1 | `monthlyUnitsToKw` | `lib/rules/size.ts` |
| A6 | Generation = 1,400 units/kW/year, editable | `app_settings.units_per_kw_year` | settings row |
| A7 | Flat blended tariff ₹8/unit for savings | `app_settings.tariff_rate_paise_per_unit` (800) | settings row |
| A8 | Tariff escalation 0%/year for 25-year savings | settings | settings row |
| A9 | Price table: ₹55,000/kW (standard) and ₹60,000/kW (premium) for 1–5 kW | `price_rules` seed | new dated rows |
| A10 | Non-residential customers get no subsidy unless a rule row exists | `computeSubsidy` | add rule row with customer_type |
| A11 | Scoring thresholds: Low if tenant, bill < ₹1,000 or units < 100; High if owner, bill ≥ ₹2,500, units ≥ 250 and roof fits; else Medium | `lib/rules/score.ts` | edit constants |
| A12 | Roof area needed ≈ 100 sq ft per kW | `requiredRoofArea` | constant |
| A13 | Vidarbha pincodes 440xxx–445xxx are a soft hint only, never blocking | lead form | constant |
| A14 | Stage list and stuck thresholds (days): Advance 3, Survey 5, Design 5, Material 7, Installed 7, Net metering applied 15, DISCOM inspection 10, Net meter installed 5, Subsidy applied 30, Credited – | `project_stages` seed | edit table rows |
| A15 | Admin = flag on a sales user (`is_admin`) | RBAC | users table |
| A16 | Bill images stored in the database (bytea) for the demo; production should use private object storage | `bill_uploads` | swap `lib/storage` |
| A17 | Retention: delete bill images 180 days after lead closed (documented job, not scheduled) | SECURITY.md | script |
| A18 | OTP is mocked: fixed demo code, logged to `messages` | auth | `DEMO_OTP` env |
| A19 | Duplicate lead = same phone + pincode within 7 days | lead create | constant |
| A20 | Client's loss figures (₹86.88 lakh) are the client's own and not verified | PRD | n/a |
| A21 | Quote valid for 15 days | quote send | constant |
| A22 | Advance payment = 10% of net cost (mock) | accept quote | constant |
| A23 | Bill reading is simulated; maps seed sample images by hash to canned values | `lib/ai` | swap adapter |
| A24 | Time zone Asia/Kolkata for all displayed dates; stored as UTC | everywhere | n/a |
| A25 | MR/HI translations are machine-assisted drafts and need native review | I18N.md | native reviewer |
| A26 | Medium score routes to a survey (a human checks first); only Low routes to a short call | `lib/rules/score.ts` | edit `scoreLead` |
