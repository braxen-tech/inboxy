"use client";

import { useState } from "react";
import Link from "next/link";
import { Inbox, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/#canais", label: "Canais" },
  { href: "/#integracoes", label: "Integrações" },
  { href: "/#recursos", label: "Recursos" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#contato", label: "Contato" },
] as const;

interface MarketingHeaderProps {
  /** Hide "Entrar" on login/signup screen */
  showAuthButton?: boolean;
}

export function MarketingHeader({ showAuthButton = true }: MarketingHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
          onClick={() => setMobileOpen(false)}
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600">
            <Inbox className="size-4" aria-hidden />
          </span>
          Inboxy
        </Link>

        <nav className="hidden items-center gap-4 sm:flex">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
          {showAuthButton && (
            <Link href="/login">
              <Button size="sm">Entrar</Button>
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:hidden">
          {showAuthButton && (
            <Link href="/login">
              <Button size="sm" variant="outline">
                Entrar
              </Button>
            </Link>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          className="border-t bg-background px-4 py-3 sm:hidden"
          aria-label="Menu principal"
        >
          <ul className="flex flex-col gap-1">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/"
                className={cn(
                  "block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => setMobileOpen(false)}
              >
                Página inicial
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
