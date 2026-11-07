# Lighthouse results (measured, not estimated)

Run on 2026-11-07 against the **production build** (`npm run build && npm run start`), Lighthouse 12, headless Chromium, mobile emulation. Lead form measured signed in (real session cookie). Seed data, local Postgres. Re-run with the commands at the bottom.

## Standard mobile profile (Lighthouse default: simulated slow 4G, 4× CPU)
| Page | Performance | Accessibility | Best practices | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Lead form `/lead/new` | 98 | 100 | 100 | 1.1 s | 2.5 s | 20 ms | 0 |
| Sign in `/signin` | 98 | 100 | 100 | 1.1 s | 2.5 s | 0 ms | 0 |
| Public status page | 98 | 100 | 100 | 0.9 s | 2.3 s | 0 ms | 0 |

Transfer on the lead form: 215 KB total (JS 158 KB, fonts 39 KB).

## Strict profile from the brief (simulated slow 3G: 400 ms RTT, 400 kbps, 4× CPU)
| Page (3 runs) | Performance | Accessibility | FCP | LCP |
|---|---|---|---|---|
| Lead form | 69–72 | 100 | 2.4–3.2 s | 7.7–8.1 s |
| Public status page | 70–73 | 100 | 2.4–3.2 s | 7.3–7.7 s |

**The brief's 3G target (first load < 3 s, Performance ≥ 90) is NOT met.** Honest diagnosis:
- Blocking all JavaScript drops LCP from 7.7 s to 4.0 s. Blocking fonts or CSS barely moves it. The cost is the framework runtime: `react-dom` (71 KB) + Next client (46 KB) ≈ 117 KB gzip, shipped by every App Router page. Our own client code is about 40 KB.
- So the lead flow ships about 158 KB of JS against the ≈100 KB budget. Going lower needs a lighter framework for the public pages (for example a static, JS-free status page), which is on the "next steps" list.
- Observed (unsimulated) load on the local machine is about 120 ms; the simulator's numbers are what the brief asked us to record.

## What we already did about it
- Fonts: 391 KB → 215 KB total transfer. Fraunces is a self-hosted static subset (11 KB instead of 61 KB); Mukta's Devanagari file is only fetched when Devanagari text is on the page (the language-switcher labels use the device font, so English pages never need it); no duplicate preloads.
- Server components by default; client JS only for forms; images are downscaled in the browser before upload and re-encoded on the server.
- No layout shift (CLS 0); skeletons instead of spinners.

## Re-run
```bash
npm run build && PORT=3100 npm run start &
export CHROME_PATH="<path to a Chromium/Chrome binary>"
npx lighthouse http://localhost:3100/signin --form-factor=mobile --only-categories=performance,accessibility,best-practices
# strict profile:
npx lighthouse http://localhost:3100/signin --form-factor=mobile --throttling-method=simulate \
  --throttling.rttMs=400 --throttling.throughputKbps=400 --throttling.cpuSlowdownMultiplier=4
```
