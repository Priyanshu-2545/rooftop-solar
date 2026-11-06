# Design system: "Rooftop at golden hour, printed on good paper"

## Tokens (CSS variables in `app/globals.css`)
| Token | Value | Use |
|---|---|---|
| --paper | #F6F1E7 | page background |
| --surface | #FFFDF8 | grouped regions |
| --ink | #1E2430 | text |
| --ink-muted | #5B6270 | secondary text |
| --hairline | #E3DCCB | dividers, borders |
| --accent | #C9741B | primary button + the sun in the arc ONLY |
| --support | #1F5C58 | positive/saved money |
| --warn | #B4482E | warnings, stuck |

Contrast (verify with a script before release): ink on paper ≥ 4.5:1; muted on paper ≥ 4.5:1; support on surface ≥ 4.5:1; warn on surface ≥ 4.5:1. **Saffron #C9741B with white text measures 3.50:1 (computed in `tests/contrast.test.ts`): only allowed for large/bold button text (≥ 18.66px bold, 3:1). Primary button label is 19px bold (above the 18.66px bold large-text line).** If a check fails, darken the accent rather than shrink the text.

- **Type:** display serif (Fraunces) for headings and big numerals; humanist sans (Noto Sans / Mukta, covers Devanagari) for UI. Max 2 families, 2–3 weights, self-hosted WOFF2 subsets. Base 17–18px, line-height 1.5 (Devanagari ≥ 1.65). Tabular lining numerals for money. `Intl` `en-IN` grouping (₹1,25,000).
- **Spacing:** 8px grid. **Radius:** 6px everywhere. **Motion:** 150–200ms ease-out; respect `prefers-reduced-motion`. No gradients, glass, glows.
- **Layout:** mobile-first single column, max 560px on phone flows, ~1100px sales desk.

## Components
Button (primary saffron / secondary outline / quiet text), Field (label above, inline error), OtpBoxes, Stepper (sun-arc), BillReview (image + fields), ScoreChip, StageTimeline (sun-arc), MoneyFigure, Disclosure ("How we calculated this"), Toast/inline confirmation, Skeleton, EmptyState, ErrorState.

## Sun-arc signature (one SVG arc path, three places only)
1. Lead form progress ("Step 3 of 5"). 2. Stage timeline (sun position = project progress). 3. Hero line on the quote. It must carry meaning; never decoration elsewhere.

## Iconography
≤ 12 custom inline SVG icons, 1.5px stroke, always with a text label. No emoji, no icon-in-circle on every card.

## Copy tone
Sentence case, plain words, written for a busy shopkeeper. Explain "net metering" ("a meter that credits the power you send back") and "payback" ("years until savings equal what you paid") in one line each, in EN/MR/HI. Low score copy: "Let's start with a short call". Never "rejected".

## i18n rules
No hard-coded text in components; typed message files; see [I18N.md](I18N.md).

## Accessibility
WCAG 2.2 AA basics: contrast, visible focus rings, labels, keyboard flows, ≥ 48px targets, `aria-live` for upload/extraction, `lang` follows locale, errors announced, reduced motion.

## Anti-slop checklist (must pass before each UI commit)
- [ ] No gradients, glow, glass, blobs, gradient text, neon
- [ ] No grid of identical rounded icon-cards
- [ ] Not system-ui/Inter only; two deliberate families
- [ ] No emoji bullets, sparkles, robot imagery, "AI-powered" badges
- [ ] No lorem ipsum, "John Doe", stock art, fake logos/testimonials
- [ ] No dead buttons, decorative stats, purposeless banners
- [ ] No three-column feature rows, pricing cards, carousels
- [ ] Real copy, sentence case, jargon explained
- [ ] Every element answers "what job does this do?"
- [ ] AI shown as a helper that shows its work (image beside values, "sure / check this")
- [ ] Max 2 accent colours per screen

## 20 UX laws mapping
| Law | Decision |
|---|---|
| Aesthetic-Usability | Paper-and-ink polish, consistent tokens/spacing |
| Hick's | One primary action per screen; stepped form; ≤3 quote options; 3 filters |
| Fitts's | ≥48px targets; sticky bottom action bar in form and quote; destructive actions small and far |
| Jakob's | OTP boxes, bottom nav (homeowner), list/detail (sales), native camera/gallery picker |
| Miller's | ≤5 fields per step; ≤5 nav items; tracker shows current + next few stages |
| Doherty | Optimistic UI, skeletons, instant validation, staged extraction progress |
| Proximity | Bill image sits with its extracted fields |
| Similarity | One button style per role; one money style; one chip style |
| Common Region | Hairline/surface around the 3-number block and bill review; no nested boxes |
| Visual Hierarchy | Quote: big serif numerals, summary line, then details; one H1 per screen |
| Progressive Disclosure | Stepped form; "How we calculated this" |
| Recognition over Recall | Prefill phone/name; image beside values; stage names visible |
| Von Restorff | Only the saffron primary + stuck projects stand out |
| Peak-End | Quote reveal and kind confirmation/"short call" message |
| Goal-Gradient | Sun-arc "Step 3 of 5"; timeline toward "Subsidy credited" |
| Serial Position | Headline numbers first, accept action last |
| Tesler's | App derives kW, rule row, generation, payback |
| Postel's | Accept +91/spaces, commas, sq m/sq ft, Devanagari digits; output normalised |
| Occam's | Rule-based score, no external AI, minimal fields |
| Feedback Loops | Toasts, loading buttons, upload progress, message preview, stored corrections |
