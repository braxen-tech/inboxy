"use client";

import posthog from "posthog-js";
import { Button } from "@/components/ui/button";

interface SignOutButtonProps {
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  className?: string;
  children?: React.ReactNode;
  /** Path to land on after sign-out (must be same-origin absolute path). Defaults to /login. */
  redirectTo?: string;
}

export function SignOutButton({
  variant = "outline",
  className,
  children = "Sair",
  redirectTo = "/login",
}: SignOutButtonProps) {
  function handleSignOut() {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.reset();
    }
    const form = document.createElement("form");
    form.method = "POST";
    const next = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/login";
    form.action = `/api/auth/signout?next=${encodeURIComponent(next)}`;
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <Button type="button" variant={variant} className={className} onClick={handleSignOut}>
      {children}
    </Button>
  );
}
