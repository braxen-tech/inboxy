"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import posthog from "posthog-js";
import { useTranslations } from "next-intl";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/infrastructure/repositories/supabase-browser";
import { buildPasswordResetRedirectUrl } from "@/lib/app-url";
import { cn } from "@/lib/utils";

interface ForgotPasswordFormProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function ForgotPasswordForm({
  supabaseUrl,
  supabaseAnonKey,
}: ForgotPasswordFormProps) {
  const t = useTranslations("auth");
  const supabase = useMemo(
    () => createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey),
    [supabaseUrl, supabaseAnonKey],
  );

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const redirectTo = buildPasswordResetRedirectUrl(window.location.origin);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      setError(resetError.message);
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.captureException(resetError, { flow: "password_reset_request" });
      }
    } else {
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.capture("password_reset_requested");
      }
      setSent(true);
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader showAuthButton={false} />
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{t("forgotPasswordTitle")}</CardTitle>
            <CardDescription>{t("forgotPasswordDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-3">
                <p className="text-sm text-green-600">{t("resetLinkSent")}</p>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  {t("goToLogin")}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    required
                    autoComplete="email"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("waitingLogin") : t("sendResetLink")}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  <Link href="/login" className="underline hover:text-foreground">
                    {t("goToLogin")}
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
