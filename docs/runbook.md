# Operations Runbook

## Deployment

### Prerequisites
1. Supabase project created and migrations applied
2. Inngest account configured
3. Chatwoot instance available (Cloud or self-hosted)
4. Environment variables set in Vercel

### Chatwoot (conexão via dashboard)

1. No Chatwoot, vá em **Settings > Profile** e copie seu **Access Token**.
2. Identifique o **Account ID** na URL do Chatwoot (ex: `/app/accounts/1/...` → ID = 1).
3. No dashboard da nossa app, abra **Integrações** → card Chatwoot → cole a URL, Account ID e Access Token.
4. Ao salvar, o sistema valida o token, cria o webhook automaticamente no Chatwoot e habilita o processamento de mensagens.
5. O Chatwoot funciona com qualquer canal configurado (WhatsApp, Email, Instagram, Telegram, Web widget, etc).

O token é criptografado com `ENCRYPTION_KEY` (64 caracteres hex). Se rotacionar a chave, será necessário reconectar.

### Cal.com (agendamento pela IA)

1. Crie uma API key em [Cal.com Settings → Developer → API Keys](https://app.cal.com/settings/developer/api-keys).
2. Identifique o **Event Type ID** — é o número na URL ao editar o tipo de evento (ex.: `cal.com/event-types/123` → ID = 123).
3. No dashboard, abra **Integrações** → card Cal.com → cole API key, Event Type ID e fuso horário.
4. (Opcional) Cole o link público de agendamento (ex.: `https://cal.com/sua-clinica/consulta`) — a IA oferece como alternativa para pacientes que prefiram agendar sozinhos.
5. Ao salvar, o sistema valida a credencial consultando slots e habilita as tools `check_calendar_availability` e `book_calendar_appointment` automaticamente.

A API key é criptografada com `ENCRYPTION_KEY` (mesmo fluxo do Chatwoot).

```bash
# First deploy (Vercel)
vercel --prod
```

### Database Migration
```bash
# Apply migrations to Supabase
supabase db push
```

### Stripe Billing (assinatura Inboxy)

Variáveis em Vercel (separadas da integração Stripe por org para vendas no chat):

- `STRIPE_BILLING_SECRET_KEY` — secret key da conta Stripe da plataforma
- `STRIPE_BILLING_WEBHOOK_SECRET` — signing secret do endpoint de billing
- `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PROFESSIONAL` / `STRIPE_PRICE_BUSINESS` (opcional)

No Stripe Dashboard → Webhooks, crie um endpoint apontando para:

`https://inboxy.braxentech.com/api/webhooks/stripe-billing`

Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`.

Owners gerenciam plano em **Assinatura** (`/{orgSlug}/billing`). Quota de mensagens de saída/mês; ao estourar, conversas vão para `human` e o cliente recebe mensagem de transferência.

**Onboarding:** após criar conta, o usuário é redirecionado para `/billing?setup=required` até concluir o Stripe Checkout (cartão obrigatório). Todos os planos usam `STRIPE_TRIAL_DAYS` (padrão 14) de trial antes da primeira cobrança.

## Creating a New Organization

Self-service signup now auto-provisions an organization for each new auth user (migration `00006_auto_create_organization.sql`).
Existing accounts without an org are backfilled on first login via `ensureUserOrganization`.

The admin API remains available for onboarding with a custom slug/name or sending a magic link:

```bash
curl -X POST https://your-domain.vercel.app/api/admin/organizations \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{
    "name": "Clínica Exemplo",
    "slug": "clinica-exemplo",
    "ownerEmail": "owner@clinica.com"
  }'
```

If the owner already exists, the API updates their organization instead of failing.
The owner will receive a magic link email to access the dashboard.

## Monitoring

### Health Check
```bash
curl https://your-domain.vercel.app/api/health
# Returns: { "status": "healthy", "checks": { "supabase": "ok", "env": "ok" } }
```

### Inngest Dashboard
- View function runs, failures, and retry status at https://app.inngest.com
- Failed messages go to `webhook_failures` table for manual replay

### Sentry
- Error tracking and performance monitoring
- Set `SENTRY_DSN` env var to enable

## Troubleshooting

### Bot not responding
1. Check `/api/health` — is Supabase reachable?
2. Check Inngest dashboard — is the function running?
3. Check `webhook_failures` table for DLQ entries
4. Verify org has `chatwoot_status = 'active'`
5. Check `conversations` table — is the conversation locked? (stale locks expire after 60s)
6. Verify the Chatwoot webhook is registered (Chatwoot > Settings > Integrations > Webhooks)

### Duplicate messages
- System has triple idempotency: `external_message_id` UNIQUE, `processed_webhook_events`, Inngest event key
- If duplicates still appear, check Inngest for duplicate event delivery

### Chatwoot disconnected
- Re-connect via dashboard Integrations page
- Verify the Chatwoot API token is still valid in Chatwoot Settings > Profile

### Cal.com not booking
1. Verify `cal_status = 'active'` and `tools_enabled` contains `check_calendar_availability`
2. Check that `cal_api_key` can be decrypted (same `ENCRYPTION_KEY` as used when connecting)
3. If "AUTH_EXPIRED" in logs → the Cal.com API key was revoked or expired; reconnect via dashboard
4. If "BOOKING_FAILED: Slot not available" → the time slot was taken between availability check and booking attempt; patient should retry

### High token usage
- Check `usage_counters` table for per-org daily totals
- If a tenant's KB is too large (>40k tokens), suggest splitting or migration to RAG

## Incident Response

### Failed webhook (Chatwoot retrying)
1. Chatwoot retries webhook delivery on failure
2. Check `webhook_failures` table for error details
3. Fix the issue, then processing will resume on next delivery

### Token/secret rotation
1. Generate new `ENCRYPTION_KEY`
2. Write a migration script to re-encrypt all `chatwoot_api_token` and `cal_api_key` values
3. Deploy with new key

### Conversation lock stuck
- Locks auto-expire after 60 seconds
- If needed, manually clear: `UPDATE conversations SET processing_lock_until = NULL WHERE id = '...'`
