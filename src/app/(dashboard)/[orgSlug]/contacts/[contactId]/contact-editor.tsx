"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateContact } from "./actions";

interface Props {
  orgSlug: string;
  contact: {
    id: string;
    name: string;
    email: string;
    phone: string;
    ig_username: string;
    notes: string;
  };
}

export function ContactEditor({ orgSlug, contact }: Props) {
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email);
  const [phone, setPhone] = useState(contact.phone);
  const [ig, setIg] = useState(contact.ig_username);
  const [notes, setNotes] = useState(contact.notes);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function handleSave() {
    startTransition(async () => {
      const res = await updateContact({
        orgSlug,
        contactId: contact.id,
        name,
        email,
        phone,
        ig_username: ig,
        notes,
      });
      setMsg(res.error ?? "Salvo.");
      setTimeout(() => setMsg(null), 2500);
    });
  }

  return (
    <section className="rounded-lg border p-4 space-y-4">
      <h2 className="text-sm font-medium">Dados do contato</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" value={name} onChange={setName} />
        <Field label="Email" value={email} onChange={setEmail} type="email" />
        <Field label="WhatsApp" value={phone} onChange={setPhone} />
        <Field label="Instagram (username)" value={ig} onChange={setIg} />
      </div>
      <div className="space-y-1">
        <Label>Notas</Label>
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
      />
    </div>
  );
}
