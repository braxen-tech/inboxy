# ADR-002: No RAG in MVP — KB Inline with Prompt Caching

## Status
Accepted

## Context
A typical clinic/barbershop knowledge base is 2-5 pages (~3,000-8,000 tokens). Claude Sonnet 4 supports 200k token context. RAG adds significant complexity: pgvector, chunking, embedding provider, retrieval pipeline.

## Decision
In the MVP, the entire `knowledge_base` field is injected inline into the system prompt. Anthropic Prompt Caching reduces re-read cost by ~90%.

## Migration criteria
Migrate to RAG (implement `KnowledgeRetriever` port) when:
- A tenant's KB exceeds ~40,000 tokens (dashboard shows a warning).
- Cost monitoring shows prompt caching savings are insufficient.
- File upload feature (PDF/DOCX) is needed.

## Consequences
- No dependency on embedding providers (Voyage/OpenAI) in MVP.
- No pgvector extension needed.
- ~$2/month more per tenant vs RAG at typical usage.
- Migration path is clean: implement the `KnowledgeRetriever` port, inject retrieved chunks into the agent context.
