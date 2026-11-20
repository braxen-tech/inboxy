"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { Package, Plus, Repeat } from "lucide-react";
import type { BillingOption, CatalogItem } from "@/infrastructure/adapters/stripe/catalog-admin";
import { saveCatalogProduct, setCatalogProductActive } from "./actions";

type RecurringOption = Exclude<BillingOption, "one_time">;

const PERIOD_LABEL: Record<RecurringOption, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  yearly: "Anual",
};

const PERIOD_SUFFIX: Record<RecurringOption, string> = {
  weekly: "/ semana",
  monthly: "/ mês",
  quarterly: "/ trimestre",
  semiannual: "/ semestre",
  yearly: "/ ano",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPrice(amountCents: number | null, billing: CatalogItem["billing"]): string {
  if (amountCents == null) return "Sem preço";
  const base = brl.format(amountCents / 100);
  if (billing === "one_time") return base;
  if (billing === "custom") return `${base} (recorrente)`;
  return `${base} ${PERIOD_SUFFIX[billing]}`;
}

/** Accepts "129,90", "129.90", "1.299,90" and "R$ 129,90". */
export function parseBrl(input: string): number | null {
  const cleaned = input.replace(/[^\d,.]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

interface FormState {
  productId?: string;
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  kind: "one_time" | "recurring";
  period: RecurringOption;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  imageUrl: "",
  price: "",
  kind: "one_time",
  period: "monthly",
};

function formFromItem(item: CatalogItem): FormState {
  const isRecurring = item.billing !== "one_time";
  return {
    productId: item.id,
    name: item.name,
    description: item.description ?? "",
    imageUrl: item.imageUrl ?? "",
    price: item.amountCents != null ? (item.amountCents / 100).toFixed(2).replace(".", ",") : "",
    kind: isRecurring ? "recurring" : "one_time",
    period: item.billing === "one_time" || item.billing === "custom" ? "monthly" : item.billing,
  };
}

function ProductDialog({
  orgSlug,
  initial,
  onClose,
}: {
  orgSlug: string;
  initial: FormState;
  onClose: (saved: boolean) => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const amount = parseBrl(form.price);
  const billing: BillingOption = form.kind === "one_time" ? "one_time" : form.period;
  const editing = !!form.productId;

  const submit = () => {
    setError(null);
    if (amount == null) {
      setError("Informe um preço válido, por exemplo 129,90.");
      return;
    }
    start(async () => {
      const res = await saveCatalogProduct({
        orgSlug,
        productId: form.productId,
        name: form.name,
        description: form.description,
        imageUrl: form.imageUrl,
        amountBrl: amount,
        billing,
      });
      if ("error" in res) setError(res.error ?? "Erro ao salvar.");
      else onClose(true);
    });
  };

  return (
    <Dialog open onClose={() => !pending && onClose(false)} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Nome"
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="Descrição"
            multiline
            minRows={2}
            helperText="A IA usa este texto para explicar o produto ao cliente."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Como o cliente paga?</Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              color="primary"
              value={form.kind}
              onChange={(_, v) => v && setForm({ ...form, kind: v })}
            >
              <ToggleButton value="one_time">Pagamento único</ToggleButton>
              <ToggleButton value="recurring">Assinatura recorrente</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Preço"
              required
              fullWidth
              inputMode="decimal"
              placeholder="129,90"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">R$</InputAdornment> } }}
            />
            {form.kind === "recurring" && (
              <TextField
                select
                label="Cobrar a cada"
                fullWidth
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value as RecurringOption })}
              >
                {(Object.keys(PERIOD_LABEL) as RecurringOption[]).map((k) => (
                  <MenuItem key={k} value={k}>
                    {PERIOD_LABEL[k]}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>

          <TextField
            label="URL da imagem"
            placeholder="https://…"
            helperText="Opcional."
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
          />

          <Alert severity="info" icon={false}>
            O cliente verá: <b>{amount != null ? formatPrice(Math.round(amount * 100), billing) : "—"}</b>
            {editing && " · Mudar preço ou forma de cobrança vale para novas compras; assinaturas atuais não mudam."}
          </Alert>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => onClose(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={pending || form.name.trim().length < 2}>
          {pending ? "Salvando…" : editing ? "Salvar" : "Criar produto"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function CatalogManager({ orgSlug, items }: { orgSlug: string; items: CatalogItem[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [editing, setEditing] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const visible = useMemo(
    () => items.filter((i) => (tab === "active" ? i.active : !i.active)),
    [items, tab],
  );
  const archivedCount = items.filter((i) => !i.active).length;

  const toggleActive = (item: CatalogItem) =>
    start(async () => {
      setError(null);
      const res = await setCatalogProductActive(orgSlug, item.id, !item.active);
      if ("error" in res) setError(res.error ?? "Erro.");
      else router.refresh();
    });

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="active" label={`Ativos (${items.length - archivedCount})`} />
          <Tab value="archived" label={`Arquivados (${archivedCount})`} />
        </Tabs>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setEditing(EMPTY)}>
          Novo produto
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined">
        {visible.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">
              {tab === "active"
                ? "Nenhum produto ainda. Crie o primeiro para a IA começar a vender."
                : "Nenhum produto arquivado."}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {visible.map((item, idx) => (
              <ListItem
                key={item.id}
                divider={idx < visible.length - 1}
                sx={{ gap: 1, flexWrap: { xs: "wrap", sm: "nowrap" } }}
                secondaryAction={undefined}
              >
                <ListItemAvatar>
                  <Avatar variant="rounded" src={item.imageUrl ?? undefined} sx={{ bgcolor: "action.hover", color: "text.secondary" }}>
                    <Package size={20} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <span>{item.name}</span>
                      {item.billing !== "one_time" && (
                        <Chip size="small" icon={<Repeat size={12} />} label="Recorrente" variant="outlined" />
                      )}
                    </Stack>
                  }
                  secondary={formatPrice(item.amountCents, item.billing)}
                  sx={{ minWidth: 0 }}
                />
                <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
                  {item.active && (
                    <Button size="small" onClick={() => setEditing(formFromItem(item))}>
                      Editar
                    </Button>
                  )}
                  <Button size="small" color={item.active ? "inherit" : "primary"} disabled={pending} onClick={() => toggleActive(item)}>
                    {item.active ? "Arquivar" : "Reativar"}
                  </Button>
                </Stack>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {editing && (
        <ProductDialog
          orgSlug={orgSlug}
          initial={editing}
          onClose={(saved) => {
            setEditing(null);
            if (saved) router.refresh();
          }}
        />
      )}
    </Stack>
  );
}
