"use client";

import { useActionState } from "react";
import { acceptInvite, type AcceptInviteState } from "./actions";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";

interface Props {
  token: string;
  inviteEmail: string;
  userEmail: string | null;
}

export function AcceptInviteForm({ token, inviteEmail, userEmail }: Props) {
  const [state, action, pending] = useActionState<AcceptInviteState, FormData>(
    acceptInvite,
    null,
  );

  const emailMismatch =
    Boolean(userEmail) &&
    userEmail!.toLowerCase() !== inviteEmail.toLowerCase();

  return (
    <div className="space-y-3">
      {emailMismatch && (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>
            Este convite é para <strong>{inviteEmail}</strong>, mas você está logado como{" "}
            <strong>{userEmail}</strong>.
          </p>
          <p className="text-muted-foreground">
            Saia e entre com o e-mail do convite para continuar.
          </p>
          <SignOutButton
            className="w-full"
            redirectTo={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
          >
            Sair e trocar de conta
          </SignOutButton>
        </div>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      {!emailMismatch && (
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Aceitando…" : "Aceitar convite"}
          </Button>
        </form>
      )}
    </div>
  );
}
