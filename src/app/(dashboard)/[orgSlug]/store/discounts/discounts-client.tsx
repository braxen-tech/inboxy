"use client";

import { useState, useTransition } from "react";
import { Percent, Trash2, PowerOff, Power, Plus, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createDiscount, deactivateDiscount, reactivateDiscount, deleteDiscount, listDiscounts } from "./actions";

interface Discount {
  id: string;
  code: string;
  description: string | null;
  percent_off: number | null;
  amount_off_brl: number | null;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
}

interface Props {
  orgSlug: string;
  initialDiscounts: Discount[];
}

function formatDiscount(d: Discount) {
  if (d.percent_off) return `${d.percent_off}% off`;
  if (d.amount_off_brl)
    return `R$ ${Number(d.amount_off_brl).toFixed(2).replace(".", ",")} off`;
  return "—";
}

export default function DiscountsClient({ orgSlug, initialDiscounts }: Props) {
  const [discounts, setDiscounts] = useState<Discount[]>(initialDiscounts);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [percentOff, setPercentOff] = useState("");
  const [amountOff, setAmountOff] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function refreshList() {
    const list = await listDiscounts(orgSlug);
    if ("data" in list) setDiscounts(list.data as Discount[]);
  }

  function resetForm() {
    setCode(""); setDescription(""); setPercentOff(""); setAmountOff(""); setMaxUses(""); setExpiresAt("");
    setShowForm(false); setError(null);
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createDiscount(orgSlug, {
        code,
        description: description || undefined,
        percentOff: discountType === "percent" ? Number(percentOff) : undefined,
        amountOffBrl: discountType === "amount" ? Number(amountOff) : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        expiresAt: expiresAt || undefined,
      });
      if ("error" in res) { setError(res.error ?? "Erro desconhecido."); return; }
      await refreshList();
      resetForm();
    });
  }

  function handleDeactivate(id: string) {
    startTransition(async () => {
      const res = await deactivateDiscount(orgSlug, id);
      if ("error" in res) { setError(res.error ?? "Erro desconhecido."); return; }
      setDiscounts((prev) => prev.map((d) => d.id === id ? { ...d, active: false } : d));
    });
  }

  function handleReactivate(id: string) {
    startTransition(async () => {
      const res = await reactivateDiscount(orgSlug, id);
      if ("error" in res) { setError(res.error ?? "Erro desconhecido."); return; }
      setDiscounts((prev) => prev.map((d) => d.id === id ? { ...d, active: true } : d));
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteDiscount(orgSlug, id);
      if ("error" in res) { setError(res.error ?? "Erro desconhecido."); return; }
      setDiscounts((prev) => prev.filter((d) => d.id !== id));
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Descontos</h2>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4 mr-1" /> Novo desconto
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Criar desconto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Código *</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="VERAO20"
                  maxLength={20}
                />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Promoção de verão"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de desconto *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={discountType === "percent" ? "default" : "outline"}
                  onClick={() => setDiscountType("percent")}
                >
                  <Percent className="size-3 mr-1" /> Percentual
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={discountType === "amount" ? "default" : "outline"}
                  onClick={() => setDiscountType("amount")}
                >
                  R$ Valor fixo
                </Button>
              </div>
            </div>

            {discountType === "percent" ? (
              <div className="space-y-1">
                <Label>Percentual de desconto *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={percentOff}
                    onChange={(e) => setPercentOff(e.target.value)}
                    placeholder="20"
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Valor de desconto (R$) *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={amountOff}
                    onChange={(e) => setAmountOff(e.target.value)}
                    placeholder="50.00"
                    className="w-32"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Limite de usos</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="Ilimitado"
                />
              </div>
              <div className="space-y-1">
                <Label>Expira em</Label>
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Criar desconto
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && !showForm && <p className="text-sm text-destructive">{error}</p>}

      {discounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Tag className="mx-auto size-10 opacity-30 mb-3" />
            <p className="text-sm">Nenhum desconto criado ainda.</p>
            <p className="text-xs mt-1">Crie um código e compartilhe com seus compradores.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {discounts.map((d) => (
            <Card key={d.id} className={d.active ? "" : "opacity-60"}>
              <CardContent className="py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm">{d.code}</span>
                    <Badge variant={d.active ? "default" : "secondary"}>
                      {d.active ? "Ativo" : "Inativo"}
                    </Badge>
                    <span className="text-sm font-medium text-green-600">{formatDiscount(d)}</span>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {d.description && <span>{d.description}</span>}
                    <span>{d.uses_count}{d.max_uses ? `/${d.max_uses}` : ""} usos</span>
                    {d.expires_at && (
                      <span>
                        Expira em{" "}
                        {new Date(d.expires_at).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {d.active ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Desativar"
                      disabled={pending}
                      onClick={() => handleDeactivate(d.id)}
                    >
                      <PowerOff className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Reativar"
                      disabled={pending}
                      onClick={() => handleReactivate(d.id)}
                    >
                      <Power className="size-4 text-green-600" />
                    </Button>
                  )}
                  {d.uses_count === 0 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Excluir"
                      disabled={pending}
                      onClick={() => handleDelete(d.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
