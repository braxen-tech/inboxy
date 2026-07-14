"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectTelegramChannel } from "./actions";

interface Props {
  orgSlug: string;
}

export function TelegramConnectForm({ orgSlug }: Props) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await connectTelegramChannel({ orgSlug, botToken: token });
      if ("error" in r && r.error) {
        setMessage({ type: "err", text: r.error });
        return;
      }
      setMessage({ type: "ok", text: "Telegram conectado." });
      setToken("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Crie um bot em{" "}
        <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline">
          @BotFather
        </a>
        , copie o token e cole abaixo. O Inboxy registra o webhook automaticamente.
      </p>
      <div className="space-y-2">
        <Label htmlFor="telegram-bot-token">Bot token</Label>
        <Input
          id="telegram-bot-token"
          type="password"
          value={token}
          data-sensitive
          onChange={(e) => setToken(e.target.value)}
          placeholder="123456:ABC-DEF..."
          autoComplete="new-password"
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={pending || !token.trim()}>
        {pending ? "Conectando..." : "Conectar Telegram"}
      </Button>
      {message && (
        <p
          className={
            message.type === "ok"
              ? "text-sm text-green-600 dark:text-green-400"
              : "text-sm text-destructive"
          }
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
