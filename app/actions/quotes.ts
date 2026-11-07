"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current";
import { assertSales } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { acceptQuote, saveQuote } from "@/lib/quote/service";

export type QuoteFormState = { error?: string; warning?: string } | null;

const selSchema = z.array(z.object({ kw: z.number().positive().max(100), tier: z.enum(["standard", "premium"]) }).strict()).min(1).max(3);
const input = z.object({
  leadId: z.string().uuid(),
  selections: z.string().max(500),
  shownRuleIds: z.string().max(2000),
  intent: z.enum(["draft", "send"]),
}).strict();

const origin = () => env().APP_ORIGIN;

export async function saveQuoteAction(_p: QuoteFormState, fd: FormData): Promise<QuoteFormState> {
  const user = await requireUser();
  assertSales(user);
  const parsed = input.safeParse({ leadId: fd.get("leadId"), selections: fd.get("selections"), shownRuleIds: fd.get("shownRuleIds") ?? "[]", intent: fd.get("intent") });
  if (!parsed.success) return { error: "Please check the options and try again." };
  let selections: z.infer<typeof selSchema>;
  let shown: string[];
  try {
    selections = selSchema.parse(JSON.parse(parsed.data.selections));
    shown = z.array(z.string().max(64)).max(20).parse(JSON.parse(parsed.data.shownRuleIds));
  } catch {
    return { error: "Please check the options and try again." };
  }
  const r = await saveQuote(getDb(), { user, leadId: parsed.data.leadId, selections, send: parsed.data.intent === "send", now: new Date(), origin: origin(), shownRuleIds: shown });
  if (!r.ok) {
    const msg = {
      invalid: "Please choose 1 to 3 valid options.", no_price: "There is no price for one of these sizes on today's date.",
      not_ready: "The bill must be confirmed before a quote can be made.",
      repriced: "Prices or subsidy rules changed since you opened this page. We updated the draft. Please review the new numbers, then send.",
    } as const;
    return r.reason === "repriced" ? { warning: msg.repriced } : { error: msg[r.reason] };
  }
  redirect(`/quotes/${r.quoteId}`);
}

export async function acceptQuoteAction(_p: { error?: string } | null, fd: FormData): Promise<{ error?: string } | null> {
  const user = await requireUser();
  const parsed = z.object({ quoteId: z.string().uuid(), option: z.coerce.number().int().min(0).max(2), key: z.string().min(8).max(64).regex(/^[\w-]+$/) }).safeParse({
    quoteId: fd.get("quoteId"), option: fd.get("option"), key: fd.get("key"),
  });
  if (!parsed.success) return { error: "quote.err.generic" };
  await headers(); // opt out of static rendering; Next also verifies the Origin header for server actions
  const r = await acceptQuote(getDb(), { user, quoteId: parsed.data.quoteId, optionIndex: parsed.data.option, idempotencyKey: parsed.data.key, now: new Date(), origin: origin() });
  if (!r.ok) return { error: r.reason === "expired" ? "quote.expired" : "quote.err.generic" };
  redirect(`/quotes/${parsed.data.quoteId}`);
}
