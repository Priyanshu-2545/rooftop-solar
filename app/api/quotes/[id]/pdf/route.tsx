import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { getDb } from "@/db/client";
import { getUser } from "@/lib/auth/current";
import { isLocale, makeT, type Locale } from "@/lib/i18n/make-t";
import { getQuoteFor } from "@/lib/quote/service";
import type { OptionOutput } from "@/lib/quote/compute";
import type { QuoteSettings } from "@/lib/rules/settings";
import { formatINR } from "@/lib/rules/money";
import { formatDateIST } from "@/lib/sales/format";

export const runtime = "nodejs";

// Mukta covers Latin + Devanagari, so Marathi/Hindi quotes render correctly in the PDF.
const fonts = path.join(process.cwd(), "assets", "fonts");
Font.register({ family: "Mukta", fonts: [{ src: path.join(fonts, "Mukta-Regular.ttf") }, { src: path.join(fonts, "Mukta-Bold.ttf"), fontWeight: "bold" }] });
Font.registerHyphenationCallback((w) => [w]); // never hyphenate (breaks Devanagari)

const c = { ink: "#1E2430", muted: "#5B6270", hair: "#E3DCCB", teal: "#1F5C58" };
const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Mukta", fontSize: 11, color: c.ink, lineHeight: 1.6 },
  h1: { fontSize: 22, fontWeight: "bold", marginBottom: 10, lineHeight: 1.8 },
  small: { color: c.muted, fontSize: 9 },
  hero: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.hair, paddingVertical: 14, marginVertical: 14 },
  label: { color: c.muted, fontSize: 9 },
  big: { fontSize: 34, fontWeight: "bold", lineHeight: 1.2, marginBottom: 8 },
  h2: { fontSize: 13, fontWeight: "bold", marginTop: 14, marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 0.5, borderColor: c.hair, paddingVertical: 3 },
});

function Row({ k, v, b }: { k: string; v: string; b?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={{ color: c.muted }}>{k}</Text>
      <Text style={b ? { fontWeight: "bold" } : {}}>{v}</Text>
    </View>
  );
}

function QuotePdf({ t, options, selected, settings, valid, reference }: { t: ReturnType<typeof makeT>; options: OptionOutput[]; selected: number; settings: QuoteSettings; valid: string; reference: string }) {
  const o = options[selected];
  return (
    <Document title={t("quote.title")}>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{t("quote.title")}</Text>
        <Text style={s.small}>{reference} · {t("quote.validUntil", { date: valid })}</Text>
        {/* same order as the screen: three numbers, one sentence, then detail */}
        <View style={s.hero}>
          <Text style={s.label}>{t("quote.size")}</Text>
          <Text style={s.big}>{o.kw} {t("common.kw")}</Text>
          <Text style={s.label}>{t("quote.net")}</Text>
          <Text style={s.big}>{formatINR(o.netPaise)}</Text>
          <Text style={s.label}>{t("quote.payback")}</Text>
          <Text style={{ ...s.big, color: c.teal, marginBottom: 0 }}>{o.paybackYears === null ? "—" : o.paybackYears} {t("common.years")}</Text>
        </View>
        <Text>{o.paybackYears === null ? t("quote.summaryNoPayback", { kw: o.kw, net: formatINR(o.netPaise) }) : t("quote.summary", { kw: o.kw, net: formatINR(o.netPaise), years: o.paybackYears })}</Text>
        <Text style={s.h2}>{t("quote.how")}</Text>
        {options.length > 1 ? options.map((x, i) => <Row key={i} k={`${t("quote.kwOption", { kw: x.kw })} · ${t(`quote.tier.${x.tier}`)}`} v={formatINR(x.netPaise)} />) : null}
        <View style={{ marginTop: 8 }}>
          <Row k={t("quote.gross")} v={formatINR(o.grossPaise)} />
          <Row k={t("quote.subsidy")} v={o.subsidyPaise > 0 ? `− ${formatINR(o.subsidyPaise)}` : t("quote.noSubsidy")} />
          <Row k={t("quote.net")} v={formatINR(o.netPaise)} b />
          <Row k={t("quote.generation")} v={`${o.generationUnits.toLocaleString("en-IN")} ${t("common.units")}`} />
          <Row k={t("quote.savings")} v={formatINR(o.yearlySavingsPaise)} />
          <Row k={t("quote.lifetime")} v={formatINR(o.lifetimeSavingsPaise)} />
        </View>
        <Text style={s.h2}>{t("quote.assumptions")}</Text>
        <Text style={s.small}>• {t("quote.assume.tariff", { rate: formatINR(settings.tariffPaisePerUnit) })}</Text>
        <Text style={s.small}>• {t("quote.assume.gen", { units: settings.unitsPerKwYear.toLocaleString("en-IN") })}</Text>
        {settings.escalationBp === 0 ? <Text style={s.small}>• {t("quote.assume.flat")}</Text> : null}
        {o.subsidyPaise > 0 ? <Text style={s.small}>• {t("quote.assume.unverified")}</Text> : null}
        <Text style={s.small}>• {t("quote.explain.payback")}</Text>
        <Text style={s.small}>• {t("quote.explain.netMetering")}</Text>
        <Text style={s.h2}>{t("quote.terms")}</Text>
        <Text style={s.small}>{t("quote.terms.body", { date: valid })}</Text>
      </Page>
    </Document>
  );
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const q = await getQuoteFor(getDb(), await getUser(), id);
  if (!q) return new Response("Not found", { status: 404 });
  const snap = q.inputsSnapshot as { language?: string; settings: QuoteSettings };
  const asked = new URL(req.url).searchParams.get("lang");
  const lang: Locale = isLocale(asked) ? asked : isLocale(snap.language) ? snap.language : "en";
  const out = q.outputsSnapshot as { options: OptionOutput[]; recommendedIndex: number };
  const buf = await renderToBuffer(
    <QuotePdf t={makeT(lang)} options={out.options} selected={q.selectedOption ?? out.recommendedIndex} settings={snap.settings}
      valid={q.validUntil ? formatDateIST(q.validUntil) : "—"} reference={`${q.lead.humanId} · v${q.version}`} />,
  );
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="quote-${q.lead.humanId}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
