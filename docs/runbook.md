# Operations Runbook

## Deployment

### Prerequisites
1. Supabase project created and migrations applied
2. Inngest account configured
3. Chatwoot instance available (Cloud or self-hosted)
4. Environment variables set in Vercel

### Chatwoot + Agent Bot (handoff IA ↔ humano)

**Status unificados** (Chatwoot e Supabase `conversations.status`):

| Status | Quem responde |
|--------|----------------|
| `pending` | IA (Inboxy / fila do bot) |
| `open` | Atendente humano |
| `closed` | Encerrada (sem bot) |

Handoff no Chatwoot: altere a conversa entre **pending** e **open**; o webhook `conversation_updated` sincroniza no Supabase.

#### Setup (cliente) — um passo na UI

1. **Integrações → Chatwoot:** URL da instância, Account ID e **API Access Token de administrador** → **Conectar Chatwoot**.
2. O Inboxy automaticamente:
   - Cria o Agent Bot (`{nome da org} - Inboxy`) com Outgoing URL gerada
   - Vincula o bot a **todos** os inboxes existentes (`set_agent_bot`)
   - Registra webhook de conta só com `inbox_created` (novos canais são vinculados automaticamente)
   - Remove webhooks de conta antigos com `message_created` (evita duplicar processamento)

Documentação Chatwoot: [How to use Agent bots](https://www.chatwoot.com/hc/user-guide/articles/1677497472-how-to-use-agent-bots).

Endpoints:

- Mensagens (Agent Bot): `POST /api/webhooks/chatwoot/agent-bot?secret=<agent_bot_secret>`
- Novos inboxes: `POST /api/webhooks/chatwoot/account-events?secret=<account_webhook_secret>`

O token é criptografado com `ENCRYPTION_KEY` (64 caracteres hex). Se rotacionar a chave, será necessário reconectar.

#### Migrar org já conectada (fluxo manual antigo)

1. Aplicar migration `00008_agent_bot.sql` (`supabase db push`).
2. No Inboxy: **desconectar** e **reconectar** Chatwoot (cria bot novo e re-vincula inboxes).
3. Bots criados manualmente no Chatwoot podem ser removidos (órfãos).
4. Teste E2E:
   - Conversa em **pending** → mensagem do cliente → IA responde.
   - Mudar para **open** no Chatwoot → nova mensagem → IA **não** responde.
   - Voltar para **pending** → IA responde de novo.
   - Estourar quota de mensagens → conversa vai para **open** nos dois lados + mensagem de transferência.
   - Cliente pede humano → IA chama tool `transfer_to_human` → conversa **open** + sem assignee (humano no Chatwoot).
   - No painel: filtro **Open** → aba **Unassigned** ou **All** (não só Mine). Conversas atribuídas a você aparecem em **Mine**.

#### Legado (sem Agent Bot automático)

Orgs antigas com `chatwoot_agent_bot_id` vazio ainda podem usar `POST /api/webhooks/chatwoot?secret=...` até reconectar.

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

Owners gerenciam plano em **Assinatura** (`/{orgSlug}/billing`). Quota de mensagens de saída/mês; ao estourar, conversas vão para `open` (humano) no Chatwoot e no Supabase, e o cliente recebe mensagem de transferência.

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

### PostHog
- Product analytics, error tracking, session replay, logs, and AI observability
- Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` in Vercel
- Dashboard: https://us.posthog.com/project/458321/

## Troubleshooting

### Bot not responding
1. Check `/api/health` — is Supabase reachable?
2. Check Inngest dashboard — is the function running?
3. Check `webhook_failures` table for DLQ entries
4. Verify org has `chatwoot_status = 'active'`
5. Check `conversations` table — is the conversation locked? (stale locks expire after 60s)
6. Verify Agent Bot exists in Chatwoot (Settings → Bots) with Outgoing URL from Integrações
7. New inbox: should auto-link via `inbox_created` webhook (check logs)
8. Check `conversations.status` — only `pending` enqueues the agent; `open` = human handoff
9. **Painel vazio com widget funcionando:** no Chatwoot, troque o filtro de status de **Open** para **Pending** — conversas do Agent Bot começam como `pending`
10. **IA responde mas não como Agent Bot:** reconecte em Integrações (regenera `access_token` via API). Sem esse token, o Inboxy envia com o token de usuário e o painel não lista as conversas corretamente
11. **Respostas ainda como “Braxen” (user):** por padrão o Chatwoot processa **inline** no Next.js (`CHATWOOT_USE_INNGEST` não definido). Se `CHATWOOT_USE_INNGEST=true`, o deploy/Inngest precisa estar na mesma versão do código. Reinicie `npm run dev` após mudanças

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

## Knowledge Base — upload + RAG

### Prerequisites
1. Migration `00013_kb_rag.sql` applied (`supabase db push`)
2. `VOYAGE_API_KEY` set in Vercel (embeddings via `voyage-3`, 1024 dims)
3. Storage bucket `kb-documents` created by migration (private, 10 MB limit)
4. Inngest function `ingest-kb-document` registered (`/api/inngest`)

### Supported file types
PDF, DOCX, TXT, MD, CSV — no images.

### Ingest stuck in `processing`
1. Check Inngest dashboard for `ingest-kb-document` failures
2. Verify `VOYAGE_API_KEY` and Supabase service role can read Storage
3. User can click **Retry** on failed documents in `/[orgSlug]/kb`

### Agent not using document content
1. Confirm document status is `ready` (not `pending`/`failed`)
2. Tool `lookup_knowledge` is auto-enabled only when ≥1 doc is `ready`
3. Check PostHog events `kb_document_ingested` / `kb_document_ingest_failed`

### Plan limits
| Plan | Max files | Max storage |
|------|-----------|-------------|
| starter | 5 | 25 MB |
| professional | 20 | 100 MB |
| business | 50 | 500 MB |
