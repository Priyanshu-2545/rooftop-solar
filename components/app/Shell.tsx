import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { IconName } from "@/components/ui/Icon";
import type { SessionUser } from "@/lib/auth/session";
import type { Locale, T } from "@/lib/i18n/make-t";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { BottomNav, TopNav, type NavItem } from "./Nav";

/** Homeowner: phone layout with a bottom nav (<= 3 items, Jakob/Miller). Sales: top nav, wider desk layout. */
export function Shell({ user, t, locale, children }: { user: SessionUser | null; t: T; locale: Locale; children: React.ReactNode }) {
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
          <Link href={sales ? "/leads" : "/"} className="display whitespace-nowrap text-xl">{t("common.appName")}</Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher current={locale} />
            {user ? (
              <form action={logoutAction}>
                <button className="min-h-12 whitespace-nowrap px-2 text-sm text-muted underline underline-offset-4">{t("common.signOut")}</button>
              </form>
            ) : null}
          </div>
        </div>
        {sales ? <TopNav items={items} /> : null}
      </header>
      <main id="main" className={`mx-auto px-4 pb-32 pt-6 ${sales ? "max-w-[1100px]" : "max-w-[560px]"}`}>{children}</main>
      {user && !sales ? <BottomNav items={items} /> : null}
    </>
  );
}
