# Backlog - Escalabilidade & Performance

## 🔴 Alta Prioridade (para 100+ usuários)

### Cache Layer - Vercel KV
- [ ] **Cal.com slots cache** (2min TTL)
  - Impacto: -100-200ms por slot check
  - Effort: 1-2h
  - ROI: Alto
  - Arquivo: `src/infrastructure/adapters/cal-com/adapter.ts`

- [ ] **Distributed rate limiter** (Redis/KV)
  - Impacto: -40% compute, funciona em múltiplas instâncias
  - Effort: 1-2h
  - ROI: Alto
  - Arquivo: `src/infrastructure/security/rate-limiter.ts`

- [ ] **KB/system prompt cache** (30min TTL)
  - Impacto: -80% Supabase queries
  - Effort: 1-2h
  - ROI: Médio
  - Arquivo: `src/application/use-cases/process-incoming-message.ts`

### Database Optimizations
- [ ] **Connection pooling** (Supabase PgBouncer)
  - Effort: 15min
  - ROI: Alto
  - Doc: Settings → Connection pooling

- [ ] **Índice BRIN em `messages.created_at`**
  - Impacto: -50% query time em históricos
  - Effort: 15min
  - Doc: `supabase/migrations/00004_add_brin_index.sql`

- [ ] **`processing_lock_until` lock ativo**
  - Impacto: Evita race conditions em pico
  - Effort: 1-2h
  - Arquivo: `src/app/api/webhooks/whatsapp/route.ts`

### Claude Integration
- [ ] **Backoff exponencial com retry**
  - Impacto: Resiliência em 429 (rate limit)
  - Effort: 1-2h
  - Arquivo: `src/infrastructure/adapters/claude/adapter.ts`

## 🟡 Média Prioridade (para 1000+ usuários)

- [ ] **Message table partitioning** (por mês)
  - Impacto: -70% query time em tabelas grandes
  - Effort: Alto (reindex necessário)
  - Arquivo: `supabase/migrations/00005_partition_messages.sql`

- [ ] **Full-text search** no histórico
  - Impacto: UX (search rápido)
  - Effort: 2-3h
  - Arquivo: `src/infrastructure/adapters/calendar-tools/search.ts`

- [ ] **Materialized views** para dashboard stats
  - Impacto: Dashboard carrega <100ms
  - Effort: 2-3h
  - Arquivo: `supabase/migrations/00006_materialized_views.sql`

- [ ] **Cal.com concurrent booking handling**
  - Impacto: UX (retry automático com próximo slot)
  - Effort: 2-3h
  - Arquivo: `src/infrastructure/tools/book-calendar-appointment.ts`

## 🟢 Baixa Prioridade (melhorias UX/ops)

- [ ] **HTTP CDN cache headers**
  - Effort: 30min
  - Arquivo: `src/middleware.ts`

- [ ] **Supabase Realtime** para conversas ao vivo
  - Effort: 2h
  - ROI: Baixo

- [ ] **Vector embeddings** para KB search (pgvector)
  - Effort: 4-5h
  - ROI: Baixo (não MVP)

---

## Notas

- **Foco**: Cache layer (KV) primeiro
- **Então**: Database indices + connection pooling
- **Depois**: Particionamento e materialized views

Data criado: 2026-05-18
Últimas atualizado: 2026-05-18
