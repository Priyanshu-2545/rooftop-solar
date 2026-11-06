# PRD: Rooftop Solar Lead-to-Project App (Company A, Nagpur)

## Problem
Company A installs rooftop solar for homes and small businesses across Vidarbha (~120 installs/month). Leads arrive on WhatsApp and Excel. Sales calls every lead, asks for a bill photo, then sends a surveyor. Quotes are built in Excel (3 days). Subsidy and net-metering are tracked in another sheet.

Client's own numbers (not verified by us, see ASSUMPTIONS A20):
- 1,400 leads/month, 25% genuine (350).
- 40% of 220 monthly surveys go to non-buyers: 88 × ₹2,500 × 12 = ₹26.4 lakh/year.
- 4% of genuine leads (14/month) lost to faster rivals: 14 × ₹36,000 × 12 = ₹60.48 lakh/year.
- Total ₹86.88 lakh/year.

## Personas
- **Homeowner (phone, Marathi/Hindi/English):** wants to know "is it worth it, how big, what will I pay after subsidy, when does it pay back". Low patience, shopkeeper-level reading.
- **Sales/survey staff (phone + desk):** wants to spend time only on leads worth a visit; wants quotes out the same day.
- _Future (not built):_ project coordinator (DISCOM/subsidy follow-up), founder-MD (funnel dashboard).

## Jobs to be done
1. Homeowner: "Tell me quickly if solar suits my roof and bill, without a salesperson call first."
2. Sales: "Show me who is worth a visit, what size, and let me send a correct quote today."
3. Homeowner: "Tell me where my installation and subsidy stand without calling."

## In scope (8 core screens)
Sign in · Lead form · Bill review · Lead result · Sales inbox + lead detail · Quote builder · Quote view (+PDF) · Project tracker + public status page. Message log view for sales. Admin rule tables: seed-only unless time allows.

## Cut / out of scope
Filing on the government portal, inventory/purchasing, inverter monitoring (client-declared). Real SMS/WhatsApp, real payments, real OCR, coordinator role, dark mode, full offline sync (our cuts, see TDD).

## User stories and acceptance criteria
- **US1** As a homeowner I submit a lead in ≤5 short steps. *AC:* owner/tenant, roof type, area, bill, pincode, photo, consent (unticked by default); inline plain-language errors; draft survives offline reload; double-submit creates one lead.
- **US2** As a homeowner I see what was read from my bill beside the photo and confirm it. *AC:* each field editable with sure/check-this word; poor photo → re-upload tips (max 3 tries, then manual entry); nothing is scored before I confirm.
- **US3** As a homeowner I get a kind, plain outcome. *AC:* High → "A surveyor will visit" + kW; Low → "Let's start with a short call"; the word "rejected" never appears.
- **US4** As sales I work an inbox. *AC:* score chips, filters (score, status, pincode), search by name/phone, low-score leads visible and workable, skeleton/empty/error states.
- **US5** As sales I build a quote. *AC:* ≤3 options (±1 kW), live generation, gross, subsidy with rule row + effective date, net, payback, 25-yr savings; preview as homeowner sees it; "Send" snapshots inputs/outputs/rule ids, creates PDF, queues mock message.
- **US6** As a homeowner I view the quote as a story. *AC:* three big numbers first, one-line summary in my language, details under "How we calculated this", one action "Accept and pay advance" (mock).
- **US7** As sales I move a project through stages. *AC:* each change records who/when/note, logs a mock message, can attach a document; stuck projects listed.
- **US8** As a homeowner I open a status link without login. *AC:* shows first name, stage, timeline, next step; never consumer number or address; revocable.
- **US9** As a homeowner I can never read another person's data. *AC:* IDOR tests pass.

## Success metrics (from the brief)
Unqualified surveys 40% → <15%; same-day quotes for 90% of surveys; status calls down 50%. The app does not measure these yet (next step: funnel analytics).

## Non-goals
No AI deciding price/subsidy/size/acceptance. No rejecting leads automatically.

## Assumptions
Numbered register lives in [ASSUMPTIONS.md](ASSUMPTIONS.md) (A1…).
