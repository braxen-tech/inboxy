"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PortalSignupPage() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    startTransition(async () => {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "end_user",
            org_slug: orgSlug,
            full_name: name,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      router.push(`/portal/${orgSlug}/library`);
    });
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
