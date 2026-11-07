"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName };
const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** Client components so the active item and visibility follow client-side navigation. */
export function TopNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="mx-auto flex max-w-[1100px] gap-1 px-4">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined}
          className={`inline-flex min-h-12 items-center gap-2 px-3 ${isActive(path, i.href) ? "border-b-2 border-ink font-semibold" : "text-muted"}`}>
          <Icon name={i.icon} />{i.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  if (path.startsWith("/lead/new") || /^\/leads\/[^/]+\/bill/.test(path)) return null; // focus flows own the bottom bar
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 border-t border-hairline bg-surface">
      <ul className="mx-auto grid max-w-[560px] grid-cols-3">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${isActive(path, i.href) ? "font-bold text-ink" : "text-muted"}`}>
              <Icon name={i.icon} />{i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
