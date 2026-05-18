"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/infrastructure/repositories/supabase-browser";

type Mode = "login" | "signup";

interface LoginFormProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function LoginForm({ supabaseUrl, supabaseAnonKey }: LoginFormProps) {
  const router = useRouter();
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
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setConfirmMsg("Conta criada! Verifique seu email para confirmar o cadastro.");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        router.push("/");
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
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
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
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
  );
}
