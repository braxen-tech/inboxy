"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Check, Copy } from "lucide-react";
import {
  connectTelegramAction,
  connectWhatsAppAction,
  disconnectChannelAction,
} from "./channel-actions";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <TextField
      label={label}
      value={value}
      size="small"
      fullWidth
      slotProps={{
        input: {
          readOnly: true,
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={copied ? "Copiado" : "Copiar"}>
                <IconButton
                  size="small"
                  aria-label={`Copiar ${label}`}
                  onClick={async () => {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

function DisconnectButton({ orgSlug, channel }: { orgSlug: string; channel: "whatsapp_cloud" | "telegram" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Stack spacing={1}>
      <Button
        color="error"
        variant="outlined"
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (!window.confirm("Desconectar este canal? O agente de IA para de responder por ele.")) return;
            const res = await disconnectChannelAction(orgSlug, channel);
            if ("error" in res) setError(res.error ?? "Erro ao desconectar.");
            else router.refresh();
          })
        }
      >
        {pending ? "Desconectando…" : "Desconectar"}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

export interface WhatsAppConnectFormProps {
  orgSlug: string;
  isConnected: boolean;
  displayPhoneNumber: string | null;
  savedPhoneNumberId: string;
  savedWabaId: string;
  webhookUrl: string | null;
  verifyToken: string | null;
}

export function WhatsAppConnectForm(props: WhatsAppConnectFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    phoneNumberId: props.savedPhoneNumberId,
    wabaId: props.savedWabaId,
    accessToken: "",
    appSecret: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Stack spacing={2.5}>
      {props.isConnected && (
        <Alert severity="success">
          Conectado{props.displayPhoneNumber ? ` ao número ${props.displayPhoneNumber}` : ""}. O agente de IA já responde por este número.
        </Alert>
      )}

      {props.webhookUrl && props.verifyToken && (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Webhook no app da Meta</Typography>
          <Typography variant="body2" color="text.secondary">
            No painel do seu app em developers.facebook.com, abra WhatsApp → Configuração → Webhook, cole os dois
            valores abaixo e assine o campo <b>messages</b>.
          </Typography>
          <CopyField label="URL de callback" value={props.webhookUrl} />
          <CopyField label="Token de verificação" value={props.verifyToken} />
        </Stack>
      )}

      <Box
        component="form"
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const res = await connectWhatsAppAction({ orgSlug: props.orgSlug, ...form });
            if ("error" in res) setError(res.error ?? "Erro ao conectar.");
            else {
              setForm((f) => ({ ...f, accessToken: "", appSecret: "" }));
              router.refresh();
            }
          });
        }}
      >
        <Stack spacing={2}>
          <Typography variant="subtitle2">{props.isConnected ? "Atualizar credenciais" : "Credenciais da Meta"}</Typography>
          <TextField label="Phone number ID" required size="small" value={form.phoneNumberId} onChange={set("phoneNumberId")} />
          <TextField
            label="WhatsApp Business Account ID"
            size="small"
            helperText="Opcional. Com ele inscrevemos o app na sua conta automaticamente."
            value={form.wabaId}
            onChange={set("wabaId")}
          />
          <TextField
            label="Token de acesso permanente"
            required
            size="small"
            type="password"
            autoComplete="off"
            helperText="Gere um token de usuário do sistema com as permissões whatsapp_business_messaging e whatsapp_business_management."
            value={form.accessToken}
            onChange={set("accessToken")}
          />
          <TextField
            label="Chave secreta do app"
            required
            size="small"
            type="password"
            autoComplete="off"
            helperText="Configurações do app → Básico → Chave secreta do app. Usada para validar os webhooks."
            value={form.appSecret}
            onChange={set("appSecret")}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? "Validando…" : props.isConnected ? "Salvar" : "Conectar WhatsApp"}
          </Button>
        </Stack>
      </Box>

      {props.isConnected && <DisconnectButton orgSlug={props.orgSlug} channel="whatsapp_cloud" />}
    </Stack>
  );
}

export interface TelegramConnectFormProps {
  orgSlug: string;
  isConnected: boolean;
  botUsername: string | null;
  lastError: string | null;
}

export function TelegramConnectForm({ orgSlug, isConnected, botUsername, lastError }: TelegramConnectFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [botToken, setBotToken] = useState("");

  return (
    <Stack spacing={2.5}>
      {isConnected && (
        <Alert severity="success">
          Conectado{botUsername ? (
            <>
              {" "}ao bot{" "}
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer">@{botUsername}</a>
            </>
          ) : ""}. O agente de IA já responde por ele.
        </Alert>
      )}
      {!isConnected && lastError && <Alert severity="warning">Última tentativa falhou: {lastError}</Alert>}

      <Typography variant="body2" color="text.secondary">
        No Telegram, fale com <b>@BotFather</b>, envie <code>/newbot</code>, escolha nome e usuário e copie o token que ele
        devolver. A gente registra o webhook sozinho.
      </Typography>

      <Box
        component="form"
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const res = await connectTelegramAction({ orgSlug, botToken });
            if ("error" in res) setError(res.error ?? "Erro ao conectar.");
            else {
              setBotToken("");
              router.refresh();
            }
          });
        }}
      >
        <Stack spacing={2}>
          <TextField
            label="Token do bot"
            required
            size="small"
            type="password"
            autoComplete="off"
            placeholder="123456789:AA…"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? "Conectando…" : isConnected ? "Trocar bot" : "Conectar Telegram"}
          </Button>
        </Stack>
      </Box>

      {isConnected && <DisconnectButton orgSlug={orgSlug} channel="telegram" />}
    </Stack>
  );
}
