"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/infrastructure/repositories/supabase-browser";
import { sendOutboundMessage, updateConversationStatus } from "./actions";
import type { ConversationRow } from "./inbox-view";

interface MessageRow {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  message_type: string | null;
  attachments: unknown;
  is_internal_note: boolean;
  created_at: string;
  status: string;
}

interface Props {
  orgSlug: string;
  conversation: ConversationRow;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function ConversationThread({ orgSlug, conversation, supabaseUrl, supabaseAnonKey }: Props) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
    let mounted = true;

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, direction, content, message_type, attachments, is_internal_note, created_at, status")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (mounted) {
        setMessages((data ?? []) as MessageRow[]);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`conv:${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages((prev) => {
            const row = payload.new as MessageRow;
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [conversation.id, supabaseUrl, supabaseAnonKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function handleSend() {
    const content = draft.trim();
    if (!content) return;

    startTransition(async () => {
      setError(null);
      const res = await sendOutboundMessage({
        orgSlug,
        conversationId: conversation.id,
        content,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setDraft("");
      }
    });
  }

  function handleStatus(status: "pending" | "open" | "resolved" | "snoozed" | "closed") {
    startTransition(async () => {
      await updateConversationStatus({ orgSlug, conversationId: conversation.id, status });
    });
  }

  return (
    <>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="font-medium">{conversation.contact.name}</div>
          <div className="text-xs text-muted-foreground">
            {conversation.channelType === "instagram" ? "Instagram DM" : "WhatsApp"} · {conversation.contact.subtitle}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={conversation.status}
            onChange={(e) => handleStatus(e.target.value as "pending")}
            disabled={pending}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="pending">Bot</option>
            <option value="open">Aberta</option>
            <option value="snoozed">Snoozed</option>
            <option value="resolved">Resolvida</option>
            <option value="closed">Fechada</option>
          </select>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto bg-muted/20 p-4">
        {loading && <div className="text-center text-sm text-muted-foreground">Carregando…</div>}
        {!loading && messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</div>
        )}
        {messages.map((m) => {
          const outbound = m.direction === "outbound";
          return (
            <div key={m.id} className={cn("flex", outbound ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                  m.is_internal_note
                    ? "bg-amber-100 text-amber-900"
                    : outbound
                      ? "bg-blue-600 text-white"
                      : "bg-background border",
                )}
              >
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div className={cn("mt-1 text-[10px]", outbound && !m.is_internal_note ? "text-blue-100" : "text-muted-foreground")}>
                  {format(new Date(m.created_at), "HH:mm")}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="border-t p-3">
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escreva uma mensagem…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={pending || !draft.trim()}>
            Enviar
          </Button>
        </div>
      </footer>
    </>
  );
}
