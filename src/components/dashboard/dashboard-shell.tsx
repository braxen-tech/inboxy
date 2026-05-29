"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  LogOut,
  Menu,
  MessageCircle,
  Plug,
  Settings,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  orgSlug: string;
  orgName: string;
  chatwootActive: boolean;
  children: React.ReactNode;
}

const navItems = [
  { href: "kb", label: "Base de conhecimento", icon: BookOpen },
  { href: "agent", label: "Agente", icon: Bot },
  { href: "integrations", label: "Integrações", icon: Plug },
  { href: "settings", label: "Configurações", icon: Settings },
] as const;

function NavLinks({
  orgSlug,
  pathname,
  onNavigate,
}: {
  orgSlug: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
      {navItems.map(({ href, label, icon: Icon }) => {
        const path = `/${orgSlug}/${href}`;
        const isActive = pathname === path || pathname.startsWith(`${path}/`);

        return (
          <Link
            key={href}
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
}: {
  orgSlug: string;
  orgName: string;
  chatwootActive: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4 pr-12 lg:pr-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#128C7E]">
            <MessageCircle className="size-4" aria-hidden />
          </span>
          <span className="truncate font-semibold text-sidebar-foreground">
            {orgName}
          </span>
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

      <NavLinks orgSlug={orgSlug} pathname={pathname} onNavigate={onNavigate} />

      <div className="mt-auto border-t border-sidebar-border p-3">
        <form action="/api/auth/signout" method="post">
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </Button>
        </form>
      </div>
    </>
  );
}

export function DashboardShell({
  orgSlug,
  orgName,
  chatwootActive,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          aria-label="Fechar menu"
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
          aria-label="Fechar menu"
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
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Abrir menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{orgName}</p>
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
            {chatwootActive ? "Ativo" : "Pendente"}
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
