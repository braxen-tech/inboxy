"use client";

import posthog from "posthog-js";
import { Button } from "@/components/ui/button";

interface SignOutButtonProps {
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  className?: string;
  children?: React.ReactNode;
}

export function SignOutButton({
  variant = "outline",
  className,
  children = "Sair",
}: SignOutButtonProps) {
  function handleSignOut() {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.reset();
    }
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/signout";
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <Button type="button" variant={variant} className={className} onClick={handleSignOut}>
      {children}
    </Button>
  );
}
