import { describe, expect, it } from "vitest";
import { auth } from "@/lib/i18n/messages/auth";
import { bill } from "@/lib/i18n/messages/bill";
import { common } from "@/lib/i18n/messages/common";
import { lead } from "@/lib/i18n/messages/lead";
import { quote } from "@/lib/i18n/messages/quote";
import { status } from "@/lib/i18n/messages/status";
import { makeT } from "@/lib/i18n/make-t";

// In-scope groups must be complete in MR and HI, with matching {placeholders}.
const scoped = { common, auth, lead, bill, quote, status };
const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

describe("i18n completeness (MR/HI in scope)", () => {
  for (const [name, group] of Object.entries(scoped)) {
    for (const loc of ["mr", "hi"] as const) {
      it(`${name}: ${loc} has every key, non-empty, same placeholders`, () => {
        for (const key of Object.keys(group.en) as (keyof typeof group.en)[]) {
          const v = (group[loc] as Record<string, string>)[key];
          expect(v, `${loc} ${key}`).toBeTruthy();
          expect(vars(v), `${loc} ${key} placeholders`).toBe(vars(group.en[key]));
        }
      });
    }
  }
  it("falls back to English for sales keys and to the key for unknown", () => {
    const t = makeT("mr");
    expect(t("sales.inbox")).toBe("Leads");
    expect(t("lead.submit")).not.toBe("Get my estimate");
    expect(t("quote.summary", { kw: 3, net: "₹87,000", years: 2.6 })).toContain("87,000");
  });
});
