"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PortalSignupPage() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    startTransition(async () => {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "end_user",
            org_slug: orgSlug,
            full_name: name,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/portal/${orgSlug}/library`)}`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // Supabase returns a "success" response with no error and an empty
      // identities array (instead of an error) when the email is already
      // registered — this prevents email enumeration, but looks identical
      // to a real signup unless we check for it explicitly.
      if (data.user && data.user.identities?.length === 0) {
        setError("Este e-mail já tem uma conta. Tente entrar em vez de criar uma nova conta.");
        return;
      }

      if (data.session) {
        router.push(`/portal/${orgSlug}/library`);
      } else {
        setCheckEmail(true);
      }
    });
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-bold">Confirme seu e-mail</h1>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele para
            ativar sua conta e acessar sua biblioteca.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Criar conta</h1>
          <p className="text-sm text-muted-foreground mt-1">Acesse seus produtos digitais</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Seu nome" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mínimo 8 caracteres" minLength={8} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href={`/portal/${orgSlug}/login`} className="underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
