"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  GraduationCap,
  Inbox,
  LayoutGrid,
  LogOut,
  Menu,
  CreditCard,
  Mail,
  Package,
  Palette,
  Plug,
  Settings,
  Store,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  orgSlug: string;
  orgName: string;
  chatwootActive: boolean;
  billingEnabled?: boolean;
  children: React.ReactNode;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  subItems?: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
};

function buildNavGroups(t: ReturnType<typeof useTranslations<"nav">>) {
  return [
    {
      label: t("store"),
      items: [
        {
          href: "store",
          label: t("myStore"),
          icon: Store,
          subItems: [
            { href: "store/profile", label: t("profile"), icon: User },
            { href: "store/content", label: t("content"), icon: LayoutGrid },
            { href: "store/analytics", label: t("analytics"), icon: BarChart3 },
            { href: "store/theme", label: t("theme"), icon: Palette },
          ],
        },
        { href: "products", label: t("digitalProducts"), icon: Package },
        { href: "courses", label: t("courses"), icon: GraduationCap },
        { href: "mentoring", label: t("mentoring"), icon: Calendar },
        { href: "customers", label: t("customers"), icon: Users },
        { href: "broadcasts", label: t("broadcasts"), icon: Mail },
      ],
    },
    {
      label: t("settings"),
      items: [
        { href: "integrations", label: t("integrations"), icon: Plug },
        { href: "finances", label: t("finances"), icon: Wallet },
        { href: "billing", label: t("billing"), icon: CreditCard },
        { href: "settings", label: t("settings"), icon: Settings },
      ],
    },
  ] as { label: string | null; items: NavItem[] }[];
}

function SidebarSignOutLabel() {
  const t = useTranslations("common");
  return <>{t("sair")}</>;
}

const COLLAPSED_GROUPS_STORAGE_KEY = "inboxy:collapsed-nav-groups";

function loadCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function NavLinks({
  orgSlug,
  pathname,
  onNavigate,
  billingEnabled = true,
}: {
  orgSlug: string;
  pathname: string;
  onNavigate?: () => void;
  billingEnabled?: boolean;
}) {
  const t = useTranslations("nav");
  const groups = buildNavGroups(t).map((group) => ({
    ...group,
    items: group.items.filter((item) => billingEnabled || item.href !== "billing"),
  }));

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    setCollapsed(loadCollapsedGroups());
  }, []);

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        window.localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // localStorage unavailable — collapse state just won't persist
      }
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-4 px-3 py-2">
      {groups.map((group, i) => {
        const isCollapsed = group.label ? collapsed.has(group.label) : false;
        const groupHasActiveItem = group.items.some((item) => {
          const path = `/${orgSlug}/${item.href}`;
          return pathname === path || pathname.startsWith(`${path}/`);
        });
        const showItems = !isCollapsed || groupHasActiveItem;

        return (
          <div key={group.label ?? `group-${i}`} className="flex flex-col gap-1">
            {group.label && (
              <button
                type="button"
                onClick={() => toggleGroup(group.label!)}
                className="flex items-center justify-between px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
              >
                {group.label}
                <ChevronDown className={cn("size-3.5 transition-transform", isCollapsed ? "-rotate-90" : "")} aria-hidden />
              </button>
            )}
            {showItems && group.items.map(({ href, label, icon: Icon, external, subItems }) => {
              const path = external ? href : `/${orgSlug}/${href}`;
              const isActive = !external && (pathname === path || pathname.startsWith(`${path}/`));

              if (external) {
                return (
                  <a
                    key={href}
                    href={path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {label}
                  </a>
                );
              }

              return (
                <div key={href}>
                  <Link
                    href={path}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {label}
                  </Link>
                  {isActive && subItems && subItems.map(({ href: subHref, label: subLabel, icon: SubIcon }) => {
                    const subPath = `/${orgSlug}/${subHref}`;
                    const isSubActive = pathname === subPath || pathname.startsWith(`${subPath}/`);
                    return (
                      <Link
                        key={subHref}
                        href={subPath}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-3 rounded-lg py-2 pl-9 pr-3 text-sm font-medium transition-colors",
                          isSubActive
                            ? "text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <SubIcon className="size-3.5 shrink-0" aria-hidden />
                        {subLabel}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarContent({
  orgSlug,
  orgName,
  chatwootActive,
  pathname,
  onNavigate,
  billingEnabled = true,
}: {
  orgSlug: string;
  orgName: string;
  chatwootActive: boolean;
  pathname: string;
  onNavigate?: () => void;
  billingEnabled?: boolean;
}) {
  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4 pr-12 lg:pr-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600">
            <Inbox className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <span className="block truncate font-semibold text-sidebar-foreground">Inboxy</span>
            <span className="block truncate text-xs text-sidebar-foreground/60">{orgName}</span>
          </div>
        </Link>
      </div>

      <div className="px-4 py-3">
        {/* <Badge
          variant="secondary"
          className={cn(
            "w-full justify-center text-xs",
            chatwootActive
              ? "bg-green-500/15 text-green-700 dark:text-green-400"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
          )}
        >
          {chatwootActive ? "Chatwoot ativo" : "Chatwoot pendente"}
        </Badge> */}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <NavLinks
          orgSlug={orgSlug}
          pathname={pathname}
          onNavigate={onNavigate}
          billingEnabled={billingEnabled}
        />
      </div>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-1">
          <SignOutButton
            variant="ghost"
            className="flex-1 justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" aria-hidden />
            <SidebarSignOutLabel />
          </SignOutButton>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}

export function DashboardShell({
  orgSlug,
  orgName,
  chatwootActive,
  billingEnabled = true,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const tNav = useTranslations("nav");
  const tDash = useTranslations("dashboard");

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-background lg:flex">
      {mobileOpen && (
        <button
          type="button"
          aria-label={tNav("closeMenu")}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          aria-label={tNav("closeMenu")}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="size-5" />
        </button>

        <SidebarContent
          orgSlug={orgSlug}
          orgName={orgName}
          chatwootActive={chatwootActive}
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
          billingEnabled={billingEnabled}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tNav("openMenu")}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">Inboxy</p>
            <p className="truncate text-xs text-muted-foreground">{orgName}</p>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 text-xs",
              chatwootActive
                ? "bg-green-500/15 text-green-700"
                : "bg-amber-500/15 text-amber-700",
            )}
          >
            {chatwootActive ? tDash("statusActive") : tDash("statusPending")}
          </Badge>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
