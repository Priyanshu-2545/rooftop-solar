import { notFound, redirect } from "next/navigation";
import { BillReviewForm, ReuploadForm, type ReviewField } from "@/components/lead/BillReviewForm";
import { getUser } from "@/lib/auth/current";
import { getDb } from "@/db/client";
import { flagFields } from "@/lib/ai/plausibility";
import { BILL_FIELDS } from "@/lib/ai/schema";
import { getBillState, getLeadFor } from "@/lib/data/leads";
import { isDemo } from "@/lib/env";
import { getT, messagesFor } from "@/lib/i18n";
import { MAX_UPLOAD_ATTEMPTS, readerOutput } from "@/lib/leads/service";

export const metadata = { title: "Check your bill" };
const SAMPLES = [
  { file: "bill-good-340.png", label: "Clear bill (340 units)" },
  { file: "bill-good-210.png", label: "Clear bill (210 units)" },
  { file: "bill-good-85.png", label: "Clear bill (85 units)" },
  { file: "bill-blurry.png", label: "Blurry photo" },
  { file: "bill-ambiguous.png", label: "Smudged bill (unsure fields)" },
];

export default async function BillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dup?: string }> }) {
  const { id } = await params;
  const { dup } = await searchParams;
  const user = await getUser();
  if (!user) redirect("/signin");
  const db = getDb();
  const lead = await getLeadFor(db, user, id);
  if (!lead) notFound();
  if (lead.status !== "bill_review") redirect(`/leads/${lead.id}`);

  const { t, locale } = await getT();
  const messages = messagesFor(locale, ["bill.", "lead.", "roof.", "common."]);
  const { latest, extraction, attempts } = await getBillState(db, lead.id);
  const reader = extraction ? readerOutput(extraction.rawJson) : null;
  const raw = extraction?.rawJson as { photoQuality?: string; reason?: string } | undefined;
  const imageSrc = latest ? `/api/bills/${latest.id}` : null;

  // Poor photo: friendly re-upload with tips, until the retry limit; then manual entry.
  if (raw?.photoQuality === "poor" && attempts < MAX_UPLOAD_ATTEMPTS) {
    return (
      <ReuploadForm leadId={lead.id} messages={messages} attempt={attempts + 1} max={MAX_UPLOAD_ATTEMPTS}
        reason={raw.reason ?? ""} demo={isDemo()} samples={SAMPLES} />
    );
  }

  const flags = reader ? flagFields(reader) : {};
  const fields: ReviewField[] = BILL_FIELDS.map((k) => {
    const f = reader?.[k] ?? null;
    return { key: k, value: f ? String(f.value) : null, confidence: f?.confidence ?? null, flag: flags[k] };
  });
  const mode = reader ? "review" : "manual";

  return (
    <section>
      {dup ? <p role="status" className="mb-4 border-l-4 border-ink bg-surface p-3">{t("lead.duplicate")}</p> : null}
      <h1 className="display mb-2 text-3xl">{reader ? t("bill.title") : t("bill.manual.title")}</h1>
      <p className="mb-6 text-muted">{reader ? t("bill.intro") : t("bill.manual.body")}</p>
      <BillReviewForm leadId={lead.id} imageSrc={imageSrc} fields={fields} mode={mode} messages={messages} />
    </section>
  );
}
