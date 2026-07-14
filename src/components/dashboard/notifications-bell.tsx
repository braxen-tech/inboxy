"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createSupabaseBrowserClient } from "@/infrastructure/repositories/supabase-browser";
import { cn } from "@/lib/utils";
import { markNotificationsRead } from "./notifications-actions";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  organizationId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function NotificationsBell({ userId, organizationId, supabaseUrl, supabaseAnonKey }: Props) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);

    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, action_url, read_at, created_at")
        .eq("user_id", userId)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(30);
      setItems((data ?? []) as NotificationRow[]);
    })();

    const channel = supabase
      .channel(`notifs:${userId}:${organizationId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setItems((prev) => [payload.new as NotificationRow, ...prev].slice(0, 30));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, organizationId, supabaseUrl, supabaseAnonKey]);

  const unread = useMemo(() => items.filter((i) => !i.read_at), [items]);

  async function handleToggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unread.length > 0) {
      const ids = unread.map((n) => n.id);
      setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)));
      await markNotificationsRead(ids);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notificações"
        className="relative rounded-md p-2 hover:bg-muted"
      >
        <Bell className="size-5" />
        {unread.length > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-background shadow-lg">
            <div className="border-b px-3 py-2 text-sm font-medium">Notificações</div>
            <ul className="max-h-96 divide-y overflow-auto">
              {items.length === 0 && (
                <li className="p-4 text-center text-sm text-muted-foreground">
                  Nenhuma notificação.
                </li>
              )}
              {items.map((n) => {
                const inner = (
                  <div className={cn("space-y-0.5 p-3 hover:bg-muted/50", !n.read_at && "bg-blue-500/5")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), { locale: ptBR, addSuffix: true })}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.action_url ? (
                      <Link href={n.action_url} onClick={() => setOpen(false)}>
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
