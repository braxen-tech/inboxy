"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/infrastructure/repositories/supabase-browser";
import { buildAuthCallbackUrl } from "@/lib/app-url";

type Mode = "login" | "signup";

interface LoginFormProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  redirectTo?: string;
}

function safeRedirectPath(redirectTo: string | undefined): string {
  if (!redirectTo) return "/";
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) return "/";
  return redirectTo;
}

export function LoginForm({ supabaseUrl, supabaseAnonKey, redirectTo }: LoginFormProps) {
  const router = useRouter();
  const afterAuthPath = safeRedirectPath(redirectTo);
  const supabase = useMemo(
    () => createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey),
    [supabaseUrl, supabaseAnonKey],
  );

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setConfirmMsg(null);

    if (mode === "signup") {
      const emailRedirectTo = buildAuthCallbackUrl(window.location.origin);
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });

      if (signUpError) {
        setError(signUpError.message);
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.captureException(signUpError, { mode: "signup" });
        }
      } else {
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.capture("user_signed_up", { mode: "signup" });
        }
        setConfirmMsg("Conta criada! Verifique seu email para confirmar o cadastro.");
      }
    } else {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.captureException(signInError, { mode: "login" });
        }
      } else {
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY && data.user) {
          posthog.identify(data.user.id, data.user.email ? { email: data.user.email } : undefined);
          posthog.capture("user_signed_in", { mode: "login" });
        }
        router.push(afterAuthPath);
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader showAuthButton={false} />
      <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Entrar" : "Criar conta"}</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Acesse sua conta com email e senha."
              : "Crie sua conta. Você receberá um email de confirmação."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirmMsg ? (
            <div className="space-y-3">
              <p className="text-sm text-green-600">{confirmMsg}</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMode("login");
                  setConfirmMsg(null);
                }}
              >
                Ir para login
              </Button>
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
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {mode === "login" && (
                    <Link
                      href="/forgot-password"
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Esqueci minha senha
                    </Link>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                  data-sensitive
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>
                    Não tem conta?{" "}
                    <button
                      type="button"
                      className="underline hover:text-foreground"
                      onClick={() => {
                        setMode("signup");
                        setError(null);
                      }}
                    >
                      Criar conta
                    </button>
                  </>
                ) : (
                  <>
                    Já tem conta?{" "}
                    <button
                      type="button"
                      className="underline hover:text-foreground"
                      onClick={() => {
                        setMode("login");
                        setError(null);
                      }}
                    >
                      Entrar
                    </button>
                  </>
                )}
              </p>
            </form>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
