import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { SessionUser } from "@/lib/auth/session";
import type { Locale, T } from "@/lib/i18n/make-t";
import { LanguageSwitcher } from "./LanguageSwitcher";

type NavItem = { href: string; label: string; icon: IconName };

/** Homeowner: phone layout with a bottom nav (<= 3 items, Jakob/Miller). Sales: top nav, wider desk layout. */
export function Shell({ user, t, locale, path, children }: { user: SessionUser | null; t: T; locale: Locale; path: string; children: React.ReactNode }) {
  const sales = user?.role === "sales";
  const items: NavItem[] = sales
    ? [
        { href: "/leads", label: t("sales.inbox"), icon: "list" },
        { href: "/projects", label: t("sales.projects"), icon: "folder" },
        { href: "/messages", label: t("sales.messages"), icon: "chat" },
        ...(user?.isAdmin ? [{ href: "/admin/rules", label: t("sales.rules"), icon: "doc" as IconName }] : []),
      ]
    : [
        { href: "/", label: t("common.home"), icon: "home" },
        { href: "/lead/new", label: t("common.newLead"), icon: "plus" },
        { href: "/projects", label: t("common.myProject"), icon: "folder" },
      ];
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-surface focus:p-3">{t("common.skip")}</a>
      <header className="border-b border-hairline">
        <div className={`mx-auto flex items-center justify-between gap-2 px-4 py-2 ${sales ? "max-w-[1100px]" : "max-w-[560px]"}`}>
          <Link href={sales ? "/leads" : "/"} className="display text-lg font-semibold">{t("common.appName")}</Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher current={locale} back={path} />
            {user ? (
              <form action={logoutAction}>
                <button className="min-h-12 px-2 text-sm text-muted underline underline-offset-4">{t("common.signOut")}</button>
              </form>
            ) : null}
          </div>
        </div>
        {sales ? (
          <nav aria-label="Main" className="mx-auto flex max-w-[1100px] gap-1 px-4">
            {items.map((i) => (
              <Link key={i.href} href={i.href} aria-current={path.startsWith(i.href) ? "page" : undefined}
                className={`inline-flex min-h-12 items-center gap-2 px-3 ${path.startsWith(i.href) ? "border-b-2 border-ink font-semibold" : "text-muted"}`}>
                <Icon name={i.icon} />{i.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <main id="main" className={`mx-auto px-4 pb-32 pt-6 ${sales ? "max-w-[1100px]" : "max-w-[560px]"}`}>{children}</main>
      {user && !sales ? (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 border-t border-hairline bg-surface">
          <ul className="mx-auto grid max-w-[560px] grid-cols-3">
            {items.map((i) => {
              const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
              return (
                <li key={i.href}>
                  <Link href={i.href} aria-current={active ? "page" : undefined}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${active ? "font-bold text-ink" : "text-muted"}`}>
                    <Icon name={i.icon} />{i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </>
  );
}
