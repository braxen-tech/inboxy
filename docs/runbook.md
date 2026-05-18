# Operations Runbook

## Deployment

### Prerequisites
1. Supabase project created and migration applied
2. Inngest account configured
3. Meta Developer App configured (see ADR-005)
4. Environment variables set in Vercel

### WhatsApp (credenciais manuais no dashboard)
Integrações usa **cole WABA ID, Phone number ID e Access Token** na organização — sem Embedded Signup.

1. Meta for Developers → app WhatsApp → copie IDs e gere um token (ideal: **usuário do sistema** com permissões permanentes onde a Meta permite “sem expiração”).
2. Cole no dashboard dessa organização → o backend valida o token e guarda-o cifrado (`ENCRYPTION_KEY` com 64 caracteres hex).
3. Configure o webhook no Meta (`META_WEBHOOK_VERIFY_TOKEN`; URL público HTTPS em produção; em localhost use túnel, ex.: ngrok).

`META_EMBEDDED_SIGNUP_CONFIG_ID` só é necessário se voltar a usar Embedded Signup.
```bash
# First deploy (Vercel)
vercel --prod

# After deploy: register webhook at Meta
# URL: https://your-domain.vercel.app/api/webhooks/whatsapp
# Verify token: value of META_WEBHOOK_VERIFY_TOKEN
```

### Database Migration
```bash
# Apply migrations to Supabase
supabase db push
```

## Creating a New Organization

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
4. Verify org has `whatsapp_status = 'active'`
5. Check `conversations` table — is the conversation locked? (stale locks expire after 60s)

### Duplicate messages
- System has triple idempotency: `whatsapp_message_id` UNIQUE, `processed_webhook_events`, Inngest event key
- If duplicates still appear, check Inngest for duplicate event delivery

### WhatsApp disconnected
- Meta can revoke tokens if app review fails or terms are violated
- Re-connect via dashboard Integrations page

### High token usage
- Check `usage_counters` table for per-org daily totals
- If a tenant's KB is too large (>40k tokens), suggest splitting or migration to RAG

## Incident Response

### Failed webhook (Meta retrying)
1. Meta retries up to 7 times over 72 hours
2. Check `webhook_failures` table for error details
3. Fix the issue, then Inngest will process normally on next retry

### Token/secret rotation
1. Generate new `ENCRYPTION_KEY`
2. Write a migration script to re-encrypt all `whatsapp_access_token` and `whatsapp_pin` values
3. Deploy with new key

### Conversation lock stuck
- Locks auto-expire after 60 seconds
- If needed, manually clear: `UPDATE conversations SET processing_lock_until = NULL WHERE id = '...'`
