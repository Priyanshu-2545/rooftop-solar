import { redirect } from "next/navigation";
import { LeadForm } from "@/components/lead/LeadForm";
import { getUser } from "@/lib/auth/current";
import { isDemo } from "@/lib/env";
import { getT, messagesFor } from "@/lib/i18n";

export const metadata = { title: "Get a solar estimate" };

const SAMPLES = [
  { file: "bill-good-340.png", label: "Clear bill (340 units)" },
  { file: "bill-good-210.png", label: "Clear bill (210 units)" },
  { file: "bill-good-85.png", label: "Clear bill (85 units)" },
  { file: "bill-blurry.png", label: "Blurry photo" },
  { file: "bill-ambiguous.png", label: "Smudged bill (unsure fields)" },
];

export default async function NewLead() {
  const user = await getUser();
  if (!user) redirect("/signin");
  if (user.role !== "homeowner") redirect("/leads");
  const { locale } = await getT();
  return <LeadForm messages={messagesFor(locale, ["lead.", "roof.", "common."])} demo={isDemo()} samples={SAMPLES} />;
}
