"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { inviteMember, revokeInvite, updateMemberRole, removeMember } from "./actions";

type Role = "admin" | "agent" | "viewer";

interface Member {
  id: string;
  userId: string;
  role: Role;
  email: string;
  name: string;
  createdAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
}

interface Props {
  orgSlug: string;
  canManage: boolean;
  members: Member[];
  invites: Invite[];
}

export function TeamManager({ orgSlug, canManage, members: initialMembers, invites: initialInvites }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("agent");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMembers(initialMembers);
    setInvites(initialInvites);
  }, [initialMembers, initialInvites]);

  function handleInvite() {
    if (!inviteEmail.trim()) return;
    startTransition(async () => {
      setMessage(null);
      const res = await inviteMember({ orgSlug, email: inviteEmail.trim(), role: inviteRole });
      if (res.error) {
        setMessage(res.error);
        return;
      }
      setInviteEmail("");
      if (res.addedDirectly) {
        setMessage(`${inviteEmail.trim()} foi adicionado como membro (já tinha conta).`);
        router.refresh();
        return;
      }
      if (res.invite) {
        setInvites((prev) => [res.invite!, ...prev]);
        setMessage(
          res.emailed
            ? `Convite enviado por e-mail para ${res.invite.email}.`
            : `Convite criado (e-mail não enviado — confira RESEND_API_KEY). Link: ${res.acceptUrl}`,
        );
      }
    });
  }

  function handleRoleChange(memberId: string, role: Role) {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
    startTransition(async () => {
      const res = await updateMemberRole({ orgSlug, memberId, role });
      if (res.error) setMessage(res.error);
    });
  }

  function handleRemove(memberId: string) {
    if (!confirm("Remover este membro da organização?")) return;
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    startTransition(async () => {
      await removeMember({ orgSlug, memberId });
    });
  }

  function handleRevoke(inviteId: string) {
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    startTransition(async () => {
      await revokeInvite({ orgSlug, inviteId });
    });
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-medium">Convidar membro</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label>Email</Label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="pessoa@empresa.com"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Perfil</Label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="admin">Admin</option>
                <option value="agent">Agente</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <Button onClick={handleInvite} disabled={pending}>
              Convidar
            </Button>
          </div>
          {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
        </section>
      )}

      <section className="rounded-lg border">
        <header className="border-b px-4 py-2 text-sm font-medium">Membros ({members.length})</header>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </div>
              <div className="flex items-center gap-2">
                {canManage ? (
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                    disabled={pending}
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="agent">Agente</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span className="rounded-md bg-muted px-2 py-1 text-xs capitalize">{m.role}</span>
                )}
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={() => handleRemove(m.id)}>
                    Remover
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {invites.length > 0 && (
        <section className="rounded-lg border">
          <header className="border-b px-4 py-2 text-sm font-medium">Convites pendentes</header>
          <ul className="divide-y">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm">{i.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {i.role} · expira em {new Date(i.expiresAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={() => handleRevoke(i.id)}>
                    Revogar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
