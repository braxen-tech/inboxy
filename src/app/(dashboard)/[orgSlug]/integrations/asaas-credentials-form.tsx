"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activateAsaas, disconnectAsaasAction } from "./actions";

interface Props {
  orgSlug: string;
  isConnected: boolean;
}

export function AsaasCredentialsForm({ orgSlug, isConnected }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [companyType, setCompanyType] = useState<"MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION">("MEI");
  const [mobilePhone, setMobilePhone] = useState("");
  const [incomeValue, setIncomeValue] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await activateAsaas({
        orgSlug,
        name,
        email,
        cpfCnpj,
        companyType,
        mobilePhone,
        incomeValue: Number(incomeValue),
        address,
        addressNumber,
        province,
        postalCode,
      });
      if ("error" in r && r.error) {
        setMessage({ type: "err", text: r.error });
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.captureException(new Error(r.error), { org_slug: orgSlug, integration: "asaas" });
        }
      } else if ("success" in r && r.success) {
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.capture("integration_connected", { org_slug: orgSlug, integration: "asaas" });
        }
        setMessage({ type: "ok", text: "Pagamentos ativados! Sua subconta Asaas foi criada." });
        router.refresh();
      }
    });
  }

  async function onDisconnect() {
    setDisconnecting(true);
    setMessage(null);
    const r = await disconnectAsaasAction(orgSlug);
    if ("error" in r && r.error) {
      setMessage({ type: "err", text: r.error });
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.captureException(new Error(r.error), { org_slug: orgSlug, integration: "asaas" });
      }
    } else {
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.capture("integration_disconnected", { org_slug: orgSlug, integration: "asaas" });
      }
      setMessage({ type: "ok", text: "Pagamentos desconectados." });
    }
    setDisconnecting(false);
    router.refresh();
  }

  if (isConnected) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
          ✓ Subconta Asaas ativa — seu agente pode gerar links de pagamento (PIX, boleto, cartão).
        </p>
        <div className="border-t pt-4">
          <Button type="button" variant="destructive" disabled={disconnecting} onClick={onDisconnect}>
            {disconnecting ? "..." : "Desconectar pagamentos"}
          </Button>
        </div>
        {message && (
          <p className={message.type === "ok" ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-destructive"}>
            {message.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ative os pagamentos (PIX, boleto e cartão) informando os dados abaixo. A plataforma cria
        automaticamente uma subconta Asaas para o seu negócio — sem precisar criar conta você mesmo.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="asaas-name">Nome / Razão social</Label>
          <Input id="asaas-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="asaas-email">E-mail</Label>
          <Input id="asaas-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="asaas-cpfcnpj">CPF/CNPJ</Label>
          <Input id="asaas-cpfcnpj" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="00000000000000" required />
          <p className="text-xs text-muted-foreground">Precisa ser CNPJ — o Asaas não permite subconta para CPF.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="asaas-company-type">Tipo de empresa</Label>
          <select
            id="asaas-company-type"
            value={companyType}
            onChange={(e) => setCompanyType(e.target.value as typeof companyType)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            required
          >
            <option value="MEI">MEI</option>
            <option value="LIMITED">Ltda</option>
            <option value="INDIVIDUAL">Empresário Individual</option>
            <option value="ASSOCIATION">Associação</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="asaas-phone">Celular</Label>
          <Input id="asaas-phone" value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)} placeholder="11999999999" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="asaas-income">Faturamento mensal (R$)</Label>
          <Input id="asaas-income" type="number" min={0} value={incomeValue} onChange={(e) => setIncomeValue(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label htmlFor="asaas-address">Endereço</Label>
            <Input id="asaas-address" value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asaas-number">Número</Label>
            <Input id="asaas-number" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asaas-province">Bairro</Label>
            <Input id="asaas-province" value={province} onChange={(e) => setProvince(e.target.value)} required />
          </div>
          <div className="space-y-2 col-span-2">
            <Label htmlFor="asaas-postal">CEP</Label>
            <Input id="asaas-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="00000000" required />
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Ativando..." : "Ativar pagamentos"}
        </Button>
      </form>
      {message && (
        <p className={message.type === "ok" ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
