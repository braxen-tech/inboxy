"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/infrastructure/repositories/supabase-browser";
import { cn } from "@/lib/utils";

interface ResetPasswordFormProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function ResetPasswordForm({ supabaseUrl, supabaseAnonKey }: ResetPasswordFormProps) {
  const router = useRouter();
  const supabase = useMemo(
    () => createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey),
    [supabaseUrl, supabaseAnonKey],
  );

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setCheckingSession(false);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.captureException(updateError, { flow: "password_reset_confirm" });
      }
    } else {
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.capture("password_reset_completed");
      }
      router.push("/");
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader showAuthButton={false} />
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Nova senha</CardTitle>
            <CardDescription>Defina uma nova senha para sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            {checkingSession ? (
              <p className="text-sm text-muted-foreground">Verificando sessão...</p>
            ) : !hasSession ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive">
                  Link inválido ou expirado. Solicite um novo link de recuperação.
                </p>
                <Link
                  href="/forgot-password"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Solicitar novo link
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nova senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                    autoComplete="new-password"
                    data-sensitive
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    minLength={6}
                    required
                    autoComplete="new-password"
                    data-sensitive
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Aguarde..." : "Salvar nova senha"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
