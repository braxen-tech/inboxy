"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  Inbox,
  Kanban,
  LogOut,
  Menu,
  CreditCard,
  Plug,
  Settings,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  orgSlug: string;
  orgName: string;
  hasActiveChannel: boolean;
  billingEnabled?: boolean;
  userId?: string | null;
  organizationId?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  children: React.ReactNode;
}

const baseNavItems = [
  { href: "inbox", label: "Inbox", icon: Inbox },
  { href: "leads", label: "Leads (Kanban)", icon: Kanban },
  { href: "contacts", label: "Contatos", icon: Users },
  { href: "kb", label: "Base de conhecimento", icon: BookOpen },
  { href: "agent", label: "Agente", icon: Bot },
  { href: "integrations", label: "Integrações", icon: Plug },
  { href: "team", label: "Equipe", icon: UserCog },
  { href: "billing", label: "Assinatura", icon: CreditCard },
  { href: "settings", label: "Configurações", icon: Settings },
] as const;

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
  const navItems = billingEnabled
    ? baseNavItems
    : baseNavItems.filter((item) => item.href !== "billing");

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
  hasActiveChannel,
  pathname,
  onNavigate,
  billingEnabled = true,
}: {
  orgSlug: string;
  orgName: string;
  hasActiveChannel: boolean;
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
        <Badge
          variant="secondary"
          className={cn(
            "w-full justify-center text-xs",
            hasActiveChannel
              ? "bg-green-500/15 text-green-700 dark:text-green-400"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
          )}
        >
          {hasActiveChannel ? "Canais ativos" : "Nenhum canal conectado"}
        </Badge>
      </div>

      <NavLinks
        orgSlug={orgSlug}
        pathname={pathname}
        onNavigate={onNavigate}
        billingEnabled={billingEnabled}
      />

      <div className="mt-auto border-t border-sidebar-border p-3">
        <SignOutButton
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" aria-hidden />
          Sair
        </SignOutButton>
      </div>
    </>
  );
}

export function DashboardShell({
  orgSlug,
  orgName,
  hasActiveChannel,
  billingEnabled = true,
  userId,
  organizationId,
  supabaseUrl,
  supabaseAnonKey,
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
          hasActiveChannel={hasActiveChannel}
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
            aria-label="Abrir menu"
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
              hasActiveChannel
                ? "bg-green-500/15 text-green-700"
                : "bg-amber-500/15 text-amber-700",
            )}
          >
            {hasActiveChannel ? "Ativo" : "Pendente"}
          </Badge>
          {userId && organizationId && supabaseUrl && supabaseAnonKey && (
            <NotificationsBell
              userId={userId}
              organizationId={organizationId}
              supabaseUrl={supabaseUrl}
              supabaseAnonKey={supabaseAnonKey}
            />
          )}
        </header>

        {userId && organizationId && supabaseUrl && supabaseAnonKey && (
          <div className="sticky top-0 z-20 hidden h-12 items-center justify-end gap-2 border-b bg-background/95 px-4 backdrop-blur lg:flex">
            <NotificationsBell
              userId={userId}
              organizationId={organizationId}
              supabaseUrl={supabaseUrl}
              supabaseAnonKey={supabaseAnonKey}
            />
          </div>
        )}

        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
