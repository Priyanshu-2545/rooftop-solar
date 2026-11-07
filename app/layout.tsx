import type { Metadata, Viewport } from "next";
import { Mukta } from "next/font/google";
import localFont from "next/font/local";
import { Shell } from "@/components/app/Shell";
import { RegisterSw } from "@/components/app/RegisterSw";
import { getUser } from "@/lib/auth/current";
import { getT } from "@/lib/i18n";
import "./globals.css";

// Two families only: Fraunces (display, self-hosted subset) + Mukta (UI; Latin + Devanagari).
// Performance on 3G: Mukta's Devanagari file is only downloaded when Devanagari text is on the page
// (unicode-range). The language switcher labels use the device font, so English pages never need it.
// Fraunces, self-hosted: a static instance (weight 400, optical size 72) subset to Basic Latin + the rupee sign
// and the few punctuation marks we use. 11 KB instead of 61 KB. Licence: assets/fonts/OFL-Fraunces.txt.
const display = localFont({ src: "../assets/fonts/Fraunces-display-subset.woff2", weight: "400", variable: "--font-display", display: "swap", preload: true });
const sans = Mukta({ subsets: ["latin", "devanagari"], weight: ["400", "700"], variable: "--font-sans", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "Rooftop solar", template: "%s · Rooftop solar" },
  description: "Find out if rooftop solar suits your home, get a clear quote, and track your project.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#F6F1E7", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ t, locale }, user] = await Promise.all([getT(), getUser()]);
  return (
    <html lang={locale} className={`${display.variable} ${sans.variable}`}>
      <body>
        <Shell user={user} t={t} locale={locale}>{children}</Shell>
        <RegisterSw />
      </body>
    </html>
  );
}
