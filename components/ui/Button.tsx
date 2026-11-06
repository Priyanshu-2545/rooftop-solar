import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet";
// One style per role (Law of Similarity). Min height 48px (Fitts). Primary label 19px bold: white on
// saffron is 3.50:1, which passes WCAG only as large text.
const base =
  "inline-flex min-h-12 items-center justify-center rounded-md px-5 text-center transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";
const styles: Record<Variant, string> = {
  primary: `${base} w-full bg-accent text-white text-[19px] font-bold hover:brightness-95 sm:w-auto`,
  secondary: `${base} w-full border border-ink bg-transparent text-ink font-semibold hover:bg-surface sm:w-auto`,
  quiet: `${base} px-2 text-ink underline underline-offset-4 font-semibold`,
};

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={`${styles[variant]} ${className}`} />;
}

export function LinkButton({ href, variant = "primary", children, className = "" }: { href: string; variant?: Variant; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`${styles[variant]} ${className}`}>
      {children}
    </Link>
  );
}
