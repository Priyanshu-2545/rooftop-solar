import type { Metadata, Viewport } from "next";
import { Fraunces, Mukta } from "next/font/google";
import { headers } from "next/headers";
import { Shell } from "@/components/app/Shell";
import { RegisterSw } from "@/components/app/RegisterSw";
import { getUser } from "@/lib/auth/current";
import { getT } from "@/lib/i18n";
import "./globals.css";

// Two families only. Mukta covers Latin + Devanagari, and next/font serves unicode-range subsets, so the
// Devanagari file is only downloaded when the page actually contains Devanagari text.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["opsz"], preload: false });
const sans = Mukta({ subsets: ["latin", "devanagari"], weight: ["400", "700"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Rooftop solar", template: "%s · Rooftop solar" },
  description: "Find out if rooftop solar suits your home, get a clear quote, and track your project.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#F6F1E7", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ t, locale }, user, h] = await Promise.all([getT(), getUser(), headers()]);
  const path = h.get("x-pathname") ?? "/";
  return (
    <html lang={locale} className={`${display.variable} ${sans.variable}`}>
      <body>
        <Shell user={user} t={t} locale={locale} path={path}>{children}</Shell>
        <RegisterSw />
      </body>
    </html>
  );
}
