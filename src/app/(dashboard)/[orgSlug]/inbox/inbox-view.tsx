"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ConversationThread } from "./conversation-thread";
import { createSupabaseBrowserClient } from "@/infrastructure/repositories/supabase-browser";

export interface ConversationRow {
  id: string;
  status: string;
  priority: string;
  unreadCount: number;
  lastMessageAt: string | null;
  channelType: "whatsapp" | "instagram" | null;
  contact: {
    id: string;
    name: string;
    subtitle: string;
    avatarUrl: string | null;
  };
}

interface Props {
  orgId: string;
  orgSlug: string;
  conversations: ConversationRow[];
  initialSelectedId: string | null;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function InboxView({
  orgId,
  orgSlug,
  conversations: initial,
  initialSelectedId,
  supabaseUrl,
  supabaseAnonKey,
}: Props) {
  const [rows, setRows] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "open" | "resolved">("all");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
    const channel = supabase
      .channel(`inbox:${orgId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `organization_id=eq.${orgId}` },
        (payload) => {
          setRows((prev) => {
            const next = [...prev];
            const idx = next.findIndex((r) => r.id === (payload.new as { id?: string })?.id);
            if (payload.eventType === "UPDATE" && idx >= 0) {
              const upd = payload.new as Record<string, unknown>;
              next[idx] = {
                ...next[idx],
                status: (upd.status as string) ?? next[idx].status,
                unreadCount: (upd.unread_count as number) ?? next[idx].unreadCount,
                lastMessageAt: (upd.last_message_at as string) ?? next[idx].lastMessageAt,
              };
              next.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
            }
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, supabaseUrl, supabaseAnonKey]);

  return (
    <div className="flex h-full">
      <aside className="flex w-80 shrink-0 flex-col border-r bg-background">
        <div className="border-b px-4 py-3">
          <h1 className="text-lg font-semibold">Inbox</h1>
          <div className="mt-2 flex gap-1 text-xs">
            {(["all", "pending", "open", "resolved"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded px-2 py-1 capitalize",
                  statusFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {s === "all" ? "Todas" : s}
              </button>
            ))}
          </div>
        </div>

        <ul className="flex-1 overflow-auto">
          {filtered.length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">Nenhuma conversa.</li>
          )}
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b px-4 py-3 text-left hover:bg-muted/60",
                  selected?.id === c.id && "bg-muted/80",
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {c.contact.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.contact.name}</span>
                    {c.lastMessageAt && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.lastMessageAt), { locale: ptBR, addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {c.channelType === "instagram" ? "IG" : c.channelType === "whatsapp" ? "WA" : "-"} · {c.contact.subtitle}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-1 flex-col">
        {selected ? (
          <ConversationThread
            key={selected.id}
            orgSlug={orgSlug}
            conversation={selected}
            supabaseUrl={supabaseUrl}
            supabaseAnonKey={supabaseAnonKey}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Selecione uma conversa
          </div>
        )}
      </main>
    </div>
  );
}
