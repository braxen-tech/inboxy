"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ConversationThread } from "./conversation-thread";
import { createSupabaseBrowserClient } from "@/infrastructure/repositories/supabase-browser";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ConversationRow {
  id: string;
  status: string;
  priority: string;
  unreadCount: number;
  lastMessageAt: string | null;
  channelType: "whatsapp" | "instagram" | "telegram" | null;
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

type ChannelType = ConversationRow["channelType"];

function channelLabel(type: ChannelType): string {
  if (type === "instagram") return "IG";
  if (type === "telegram") return "TG";
  if (type === "whatsapp") return "WA";
  return "-";
}

function mapDbConversation(row: {
  id: string;
  status: string | null;
  priority: string | null;
  unread_count: number | null;
  last_message_at: string | null;
  channel_type: string | null;
  contact:
    | {
        id: string;
        name: string | null;
        phone: string | null;
        email: string | null;
        avatar_url: string | null;
        ig_username: string | null;
      }
    | {
        id: string;
        name: string | null;
        phone: string | null;
        email: string | null;
        avatar_url: string | null;
        ig_username: string | null;
      }[]
    | null;
  channel:
    | { type: string | null; display_name: string | null; phone_number: string | null }
    | { type: string | null; display_name: string | null; phone_number: string | null }[]
    | null;
}): ConversationRow {
  const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact;
  const channel = Array.isArray(row.channel) ? row.channel[0] : row.channel;
  const channelType = (row.channel_type ?? channel?.type ?? null) as ChannelType;

  let subtitle = contact?.phone ?? "";
  if (channelType === "instagram" && contact?.ig_username) {
    subtitle = `@${contact.ig_username}`;
  } else if (channelType === "telegram") {
    subtitle = contact?.name ? `TG · ${contact.name}` : "Telegram";
  }

  return {
    id: row.id,
    status: row.status ?? "open",
    priority: row.priority ?? "normal",
    unreadCount: row.unread_count ?? 0,
    lastMessageAt: row.last_message_at,
    channelType,
    contact: {
      id: contact?.id ?? "",
      name: contact?.name ?? contact?.phone ?? contact?.ig_username ?? "Sem nome",
      subtitle,
      avatarUrl: contact?.avatar_url ?? null,
    },
  };
}

async function fetchConversationRow(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ConversationRow | null> {
  const { data } = await supabase
    .from("conversations")
    .select(
      `
      id,
      status,
      priority,
      unread_count,
      last_message_at,
      channel_type,
      contact:contacts(id, name, phone, email, avatar_url, ig_username),
      channel:channels(type, display_name, phone_number)
    `,
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (!data) return null;
  return mapDbConversation(data as Parameters<typeof mapDbConversation>[0]);
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
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "error">("connecting");

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  const upsertRow = useCallback((row: ConversationRow) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === row.id);
      const next = idx >= 0 ? prev.map((r, i) => (i === idx ? { ...r, ...row } : r)) : [row, ...prev];
      next.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
      return next;
    });
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
    const channel = supabase
      .channel(`inbox:${orgId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          const id =
            (payload.new as { id?: string } | null)?.id ??
            (payload.old as { id?: string } | null)?.id;
          if (!id) return;

          if (payload.eventType === "DELETE") {
            setRows((prev) => prev.filter((r) => r.id !== id));
            setSelectedId((cur) => (cur === id ? null : cur));
            return;
          }

          if (payload.eventType === "UPDATE") {
            const upd = payload.new as Record<string, unknown>;
            setRows((prev) => {
              const idx = prev.findIndex((r) => r.id === id);
              if (idx < 0) {
                void fetchConversationRow(supabase, id).then((row) => {
                  if (row) upsertRow(row);
                });
                return prev;
              }
              const next = [...prev];
              next[idx] = {
                ...next[idx],
                status: (upd.status as string) ?? next[idx].status,
                priority: (upd.priority as string) ?? next[idx].priority,
                unreadCount: (upd.unread_count as number) ?? next[idx].unreadCount,
                lastMessageAt: (upd.last_message_at as string) ?? next[idx].lastMessageAt,
                channelType: (upd.channel_type as ChannelType) ?? next[idx].channelType,
              };
              next.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
              return next;
            });
            return;
          }

          if (payload.eventType === "INSERT") {
            void fetchConversationRow(supabase, id).then((row) => {
              if (row) upsertRow(row);
            });
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtimeStatus("error");
        else setRealtimeStatus("connecting");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, supabaseUrl, supabaseAnonKey, upsertRow]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="flex h-full">
      <aside className="flex w-80 shrink-0 flex-col border-r bg-background">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold">Inbox</h1>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                realtimeStatus === "live"
                  ? "bg-emerald-100 text-emerald-800"
                  : realtimeStatus === "error"
                    ? "bg-red-100 text-red-800"
                    : "bg-muted text-muted-foreground",
              )}
              title={
                realtimeStatus === "live"
                  ? "Atualizações em tempo real ativas"
                  : realtimeStatus === "error"
                    ? "Falha ao conectar realtime"
                    : "Conectando realtime…"
              }
            >
              {realtimeStatus === "live" ? "Ao vivo" : realtimeStatus === "error" ? "Offline" : "…"}
            </span>
          </div>
          <div className="mt-2 flex gap-1 text-xs">
            {(["all", "pending", "open", "resolved"] as const).map((s) => (
              <button
                key={s}
                type="button"
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
                type="button"
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
                        {formatDistanceToNow(new Date(c.lastMessageAt), {
                          locale: ptBR,
                          addSuffix: false,
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {channelLabel(c.channelType)} · {c.contact.subtitle}
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
