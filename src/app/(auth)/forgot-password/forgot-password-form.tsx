"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import posthog from "posthog-js";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/infrastructure/repositories/supabase-browser";
import { cn } from "@/lib/utils";

interface ForgotPasswordFormProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  passwordResetRedirectUrl: string;
}

export function ForgotPasswordForm({
  supabaseUrl,
  supabaseAnonKey,
  passwordResetRedirectUrl,
}: ForgotPasswordFormProps) {
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

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectUrl,
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
            <CardTitle>Esqueci minha senha</CardTitle>
            <CardDescription>
              Enviaremos um link para redefinir sua senha no email informado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-3">
                <p className="text-sm text-green-600">
                  Se existir uma conta com esse email, você receberá um link para redefinir sua senha.
                </p>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Voltar para login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Aguarde..." : "Enviar link de recuperação"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  <Link href="/login" className="underline hover:text-foreground">
                    Voltar para login
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
