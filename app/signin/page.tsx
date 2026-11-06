import { redirect } from "next/navigation";
import { OtpForm } from "@/components/app/OtpForm";
import { getUser } from "@/lib/auth/current";
import { env, isDemo } from "@/lib/env";
import { getT, messagesFor } from "@/lib/i18n";

export const metadata = { title: "Sign in" };

export default async function SignIn() {
  const user = await getUser();
  if (user) redirect(user.role === "sales" ? "/leads" : "/");
  const { t, locale } = await getT();
  return (
    <section>
      <h1 className="display mb-4 text-4xl">{t("auth.title")}</h1>
      <OtpForm messages={messagesFor(locale, ["auth."])} demo={isDemo()} demoOtp={env().DEMO_OTP} />
    </section>
  );
}
