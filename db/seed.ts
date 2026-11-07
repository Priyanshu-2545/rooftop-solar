// Idempotent seed. ALL people, phones, consumer numbers and addresses are FICTIONAL.
// Deterministic ids (hash of a key) + onConflictDoNothing => running twice changes nothing.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { computeOption, suggestSizes, type PriceRule, type Tier } from "@/lib/quote/compute";
import { resolveSettings } from "@/lib/rules/settings";
import { scoreLead } from "@/lib/rules/score";
import { monthlyUnitsToKw } from "@/lib/rules/size";
import type { SubsidyRule } from "@/lib/rules/subsidy";
import { extractBill } from "@/lib/ai";
import { sha256 } from "@/lib/ai/simulated";
import { createDb } from "./client";
import * as s from "./schema";
import { STAGES } from "./stages";

config({ path: ".env.local" });
config();

const uid = (key: string) => {
  const h = createHash("sha1").update(`solar-seed:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const NOW = new Date();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const T0 = new Date("2024-01-01T00:00:00Z");
const bytes = (f: string) => readFileSync(`samples/bills/${f}`);

// DEMO-ONLY status-link tokens (fictional data) so reviewers can open /status/<token> without creating one.
// Real tokens are random and only their hash is stored; these are published on purpose in deployment.md.
export const DEMO_TOKENS: Record<string, string> = {
  "LD-30881": "demo-status-prashant-4f9c2a7e5b1d4c68a0e2f7b9d3c1a5e8",
  "LD-30850": "demo-status-sunita-7a1e3c5d9b2f4e60b8d4a6c2e0f1b3d5",
};

type LeadSeed = {
  hid: string; name: string; phone: string; owner: "owner" | "tenant"; bill: number; units: number | null;
  area: number; roof: "rcc_flat" | "sloped_tin" | "sloped_tile" | "other"; pin: string; ago: number;
  billFile?: string; stage?: string; stageAgo?: number; quote?: "draft" | "sent" | "accepted" | "expired";
  commercial?: boolean; lang?: "en" | "mr" | "hi"; status?: "bill_review";
};

const LEADS: LeadSeed[] = [
  // The three sample leads, exactly as in the brief.
  { hid: "LD-30881", name: "Prashant Wankhede", phone: "+919000000011", owner: "owner", bill: 3200, units: 340, area: 420, roof: "rcc_flat", pin: "440010", ago: 40, billFile: "bill-good-340.png", quote: "accepted", stage: "material_dispatched", stageAgo: 9, lang: "mr" },
  { hid: "LD-30902", name: "Rohit Meshram", phone: "+919000000012", owner: "tenant", bill: 1900, units: 210, area: 250, roof: "rcc_flat", pin: "440022", ago: 12, billFile: "bill-good-210.png", lang: "hi" },
  { hid: "LD-30915", name: "Ayesha Siddiqui", phone: "+919000000013", owner: "owner", bill: 650, units: 85, area: 180, roof: "sloped_tin", pin: "444601", ago: 6, billFile: "bill-good-85.png" },
  // More fictional leads.
  { hid: "LD-30850", name: "Sunita Kale", phone: "+919000000101", owner: "owner", bill: 4100, units: 420, area: 520, roof: "rcc_flat", pin: "440015", ago: 55, quote: "accepted", stage: "net_metering_applied", stageAgo: 20, lang: "mr" },
  { hid: "LD-30857", name: "Manoj Thakre", phone: "+919000000102", owner: "owner", bill: 2900, units: 300, area: 380, roof: "rcc_flat", pin: "440009", ago: 33, quote: "accepted", stage: "installed", stageAgo: 2 },
  { hid: "LD-30833", name: "Kavita Raut", phone: "+919000000103", owner: "owner", bill: 3600, units: 380, area: 450, roof: "rcc_flat", pin: "442001", ago: 120, quote: "accepted", stage: "subsidy_credited", stageAgo: 5, lang: "hi" },
  { hid: "LD-30890", name: "Imran Sheikh", phone: "+919000000104", owner: "owner", bill: 5200, units: 520, area: 700, roof: "rcc_flat", pin: "444001", ago: 8, quote: "accepted", stage: "advance_received", stageAgo: 1 },
  { hid: "LD-30886", name: "Deepak Gawande", phone: "+919000000105", owner: "owner", bill: 2750, units: 275, area: 340, roof: "sloped_tile", pin: "444602", ago: 9, quote: "sent" },
  { hid: "LD-30893", name: "Neha Bhoyar", phone: "+919000000106", owner: "owner", bill: 3100, units: 330, area: 400, roof: "rcc_flat", pin: "440024", ago: 5, quote: "draft" },
  { hid: "LD-30812", name: "Santosh Ingle", phone: "+919000000107", owner: "owner", bill: 2600, units: 260, area: 320, roof: "rcc_flat", pin: "442001", ago: 70, quote: "expired" },
  { hid: "LD-30896", name: "Pooja Dhote", phone: "+919000000108", owner: "owner", bill: 2200, units: 240, area: 90, roof: "sloped_tin", pin: "444003", ago: 4 },
  { hid: "LD-30899", name: "Ganesh Padole", phone: "+919000000109", owner: "owner", bill: 8800, units: 900, area: 1200, roof: "rcc_flat", pin: "440001", ago: 3, commercial: true },
  { hid: "LD-30903", name: "Rekha Nimje", phone: "+919000000110", owner: "tenant", bill: 1200, units: 120, area: 150, roof: "other", pin: "444605", ago: 5 },
  { hid: "LD-30906", name: "Anil Wagh", phone: "+919000000111", owner: "owner", bill: 900, units: 95, area: 200, roof: "rcc_flat", pin: "442002", ago: 4 },
  { hid: "LD-30908", name: "Smita Lokhande", phone: "+919000000112", owner: "owner", bill: 3400, units: 360, area: 460, roof: "rcc_flat", pin: "440012", ago: 3, billFile: "bill-blurry.png", status: "bill_review" },
  { hid: "LD-30911", name: "Vijay Sontakke", phone: "+919000000113", owner: "owner", bill: 2100, units: null, area: 300, roof: "sloped_tile", pin: "444004", ago: 2, billFile: "bill-ambiguous.png", status: "bill_review" },
  { hid: "LD-30918", name: "Madhuri Bawane", phone: "+919000000114", owner: "owner", bill: 600, units: 70, area: 160, roof: "rcc_flat", pin: "440030", ago: 2 },
  { hid: "LD-30920", name: "Rahul Chaudhari", phone: "+919000000115", owner: "owner", bill: 6400, units: 650, area: 800, roof: "rcc_flat", pin: "440037", ago: 1 },
  { hid: "LD-30921", name: "Farzana Khan", phone: "+919000000116", owner: "tenant", bill: 2300, units: 250, area: 220, roof: "rcc_flat", pin: "444006", ago: 1 },
  { hid: "LD-30923", name: "Yogesh Tayade", phone: "+919000000117", owner: "owner", bill: 3000, units: 310, area: 410, roof: "sloped_tin", pin: "442001", ago: 1 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = createDb(url);

  // --- reference tables ---
  await db.insert(s.projectStages).values(STAGES.map((g) => ({
    code: g.code, order: g.order, stuckAfterDays: g.stuck,
    labelEn: g.en, labelMr: g.mr, labelHi: g.hi, nextEn: g.nextEn, nextMr: g.nextMr, nextHi: g.nextHi,
  }))).onConflictDoNothing();

  const priceRows: (typeof s.priceRules.$inferInsert)[] = [];
  for (let kw = 1; kw <= 10; kw++) {
    for (const [tier, perKw] of [["standard", 55_000], ["premium", 60_000]] as const) {
      priceRows.push({ id: uid(`price:${kw}:${tier}`), kw, tier, pricePaise: kw * perKw * 100, effectiveFrom: T0, effectiveTo: null }); // A9
    }
  }
  await db.insert(s.priceRules).values(priceRows).onConflictDoNothing();

  await db.insert(s.subsidyRules).values({
    id: uid("subsidy:res:2024"), scheme: "Central residential scheme (as stated by client)", customerType: "residential",
    perKwPaise: 3_000_000, firstKwLimit: 2, extraKwPaise: 1_800_000, capPaise: 7_800_000,
    effectiveFrom: T0, effectiveTo: null, verified: false, // A1/A2: UNVERIFIED
    sourceNote: "ASSUMPTION A1: from the client's statement; verify before launch.",
  }).onConflictDoNothing();

  await db.insert(s.appSettings).values([
    { key: "units_per_kw_year", value: "1400", effectiveFrom: T0 },
    { key: "tariff_rate_paise_per_unit", value: "800", effectiveFrom: T0 },
    { key: "tariff_escalation_bp", value: "0", effectiveFrom: T0 },
  ]).onConflictDoNothing();

  // --- users ---
  const staff = [
    { id: uid("user:sales-admin"), phone: "+919000000001", name: "Anita Deshmukh", role: "sales" as const, isAdmin: true, language: "en" as const },
    { id: uid("user:sales"), phone: "+919000000002", name: "Vikram Joshi", role: "sales" as const, isAdmin: false, language: "en" as const },
  ];
  await db.insert(s.users).values(staff).onConflictDoNothing();
  const salesId = staff[0].id;

  const priceRules = (await db.select().from(s.priceRules)) as unknown as PriceRule[];
  const subsidyRules = (await db.select().from(s.subsidyRules)) as unknown as SubsidyRule[];
  const settings = resolveSettings(await db.select().from(s.appSettings), NOW);

  for (const L of LEADS) {
    const userId = uid(`user:${L.phone}`);
    await db.insert(s.users).values({ id: userId, phone: L.phone, name: L.name, role: "homeowner", language: L.lang ?? "en" }).onConflictDoNothing();

    const leadId = uid(`lead:${L.hid}`);
    const kw = L.units === null ? null : monthlyUnitsToKw(L.units);
    const score = scoreLead({ ownerType: L.owner, billPaise: L.bill * 100, unitsPerMonth: L.units, roofAreaSqft: L.area, roofType: L.roof, confirmedBill: L.status !== "bill_review" });
    const quoted = L.quote !== undefined;
    await db.insert(s.leads).values({
      id: leadId, humanId: L.hid, ownerUserId: userId, ownerType: L.owner, roofType: L.roof, roofAreaSqft: L.area,
      monthlyBillPaise: L.bill * 100, unitsPerMonth: L.units, pincode: L.pin, customerType: L.commercial ? "commercial" : "residential",
      consentAt: daysAgo(L.ago), consentTextVersion: "v1",
      status: L.status ?? (L.stage ? "won" : quoted ? "quoted" : "scored"),
      score: score.band === "high" ? 80 : score.band === "medium" ? 50 : 20, scoreBand: score.band, scoreReasons: score.reasons,
      nextStep: score.nextStep, recommendedKw: score.recommendedKw === null ? null : String(score.recommendedKw), needsHumanCheck: score.needsHumanCheck,
      idempotencyKey: `seed-${L.hid}`, createdAt: daysAgo(L.ago),
    }).onConflictDoUpdate({ target: s.leads.id, set: { recommendedKw: score.recommendedKw === null ? null : String(score.recommendedKw) } });

    if (L.billFile) {
      const img = bytes(L.billFile);
      const uploadId = uid(`upload:${L.hid}`);
      const { extraction } = await extractBill(img, "image/png");
      await db.insert(s.billUploads).values({
        id: uploadId, leadId, storageKey: uid(`blob:${L.hid}`), data: img, mime: "image/png", bytes: img.length,
        sha256: sha256(img), qualityFlag: extraction.photoQuality === "good" ? "good" : "poor", uploadedAt: daysAgo(L.ago),
      }).onConflictDoNothing();
      const confirmed = L.status !== "bill_review" && extraction.photoQuality === "good";
      await db.insert(s.billExtractions).values({
        id: uid(`extraction:${L.hid}`), uploadId, backend: "simulated", rawJson: extraction,
        consumerNo: extraction.consumerNo?.value ?? null, tariff: extraction.tariff?.value ?? null,
        sanctionedLoadKw: extraction.sanctionedLoadKw ? String(extraction.sanctionedLoadKw.value) : null,
        avgUnitsMonth: extraction.avgUnitsMonth?.value ?? null,
        confidenceJson: Object.fromEntries(Object.entries(extraction).filter(([, v]) => v && typeof v === "object" && "confidence" in v).map(([k, v]) => [k, (v as { confidence: number }).confidence])),
        confirmedJson: confirmed ? extraction : null,
        status: confirmed ? "confirmed" : extraction.photoQuality === "poor" ? "rejected_photo" : "pending",
        confirmedBy: confirmed ? userId : null, confirmedAt: confirmed ? daysAgo(L.ago) : null,
      }).onConflictDoNothing();
    }

    if (L.quote && kw !== null) {
      const sent = daysAgo(Math.max(L.ago - 3, 1));
      const { sizes } = suggestSizes(kw, L.area);
      const tiers: Tier[] = sizes.map(() => "standard");
      const on = sent;
      const options = sizes.map((size, i) => computeOption({
        kw: size, tier: tiers[i], customerType: L.commercial ? "commercial" : "residential", on, priceRules, subsidyRules, settings,
      }));
      const recommendedIndex = Math.max(sizes.indexOf(kw), 0);
      const quoteId = uid(`quote:${L.hid}`);
      await db.insert(s.quotes).values({
        id: quoteId, leadId, version: 1,
        status: L.quote,
        inputsSnapshot: { leadHumanId: L.hid, customerType: "residential", recommendedKw: kw, on: on.toISOString(), settings, language: L.lang ?? "en" },
        outputsSnapshot: { options, recommendedIndex },
        ruleIdsUsed: [...new Set(options.flatMap((o) => [o.priceRuleId, o.subsidyRuleId].filter((x): x is string => !!x)))],
        createdBy: salesId, sentAt: L.quote === "draft" ? null : sent,
        validUntil: L.quote === "draft" ? null : new Date(sent.getTime() + (L.quote === "expired" ? 15 : 15) * 86_400_000),
        selectedOption: L.quote === "accepted" ? recommendedIndex : null, createdAt: sent,
      }).onConflictDoNothing();

      if (L.quote === "accepted" && L.stage) {
        const projectId = uid(`project:${L.hid}`);
        const opt = options[recommendedIndex];
        await db.insert(s.payments).values({
          id: uid(`payment:${L.hid}`), quoteId, amountPaise: Math.round(opt.netPaise / 10), ref: `MOCK-${L.hid}`, idempotencyKey: `seed-pay-${L.hid}`, createdAt: sent,
        }).onConflictDoNothing();
        await db.insert(s.projects).values({
          id: projectId, humanId: `PJ-${L.hid.slice(3)}`, quoteId, stageCode: L.stage,
          startedAt: sent, stageEnteredAt: daysAgo(L.stageAgo ?? 1),
          statusTokenHash: DEMO_TOKENS[L.hid] ? createHash("sha256").update(DEMO_TOKENS[L.hid]).digest("hex") : null,
        }).onConflictDoNothing();
        // timeline: one event per stage up to the current one
        const idx = STAGES.findIndex((g) => g.code === L.stage);
        for (let i = 0; i <= idx; i++) {
          const when = i === idx ? daysAgo(L.stageAgo ?? 1) : new Date(sent.getTime() + (i * 4 + 1) * 86_400_000 * 0.5);
          await db.insert(s.projectEvents).values({
            id: uid(`event:${L.hid}:${i}`), projectId, stageCode: STAGES[i].code, actorUserId: salesId,
            note: i === idx ? null : null, at: when > NOW ? daysAgo(L.stageAgo ?? 1) : when,
          }).onConflictDoNothing();
        }
        await db.insert(s.messages).values({
          id: uid(`msg:${L.hid}`), toPhone: L.phone, channel: "whatsapp", template: `stage:${L.stage}`, lang: L.lang ?? "en", status: "mock_sent",
          body: `${L.name.split(" ")[0]}, your solar project is now: ${STAGES[idx].en}.`, createdAt: daysAgo(L.stageAgo ?? 1),
        }).onConflictDoNothing();
      }
    }
  }
  console.log(`seeded: ${LEADS.length} leads, ${staff.length} staff`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
