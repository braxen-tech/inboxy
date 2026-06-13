-- Knowledge base documents + vector chunks for RAG (v1.4/v1.5)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.kb_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  filename        text NOT NULL,
  mime_type       text NOT NULL,
  storage_path    text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error_message   text,
  char_count      integer,
  chunk_count     integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kb_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id     uuid NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  chunk_index     integer NOT NULL,
  content         text NOT NULL,
  embedding       vector(1024),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX kb_documents_org_idx ON public.kb_documents(organization_id);
CREATE INDEX kb_documents_org_status_idx ON public.kb_documents(organization_id, status);
CREATE INDEX kb_chunks_org_idx ON public.kb_chunks(organization_id);
CREATE INDEX kb_chunks_document_idx ON public.kb_chunks(document_id);

CREATE INDEX kb_chunks_embedding_idx ON public.kb_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_documents_owner_select ON public.kb_documents
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY kb_documents_owner_insert ON public.kb_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY kb_documents_owner_delete ON public.kb_documents
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY kb_chunks_owner_select ON public.kb_chunks
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  p_org_id uuid,
  p_embedding vector(1024),
  p_match_count int DEFAULT 5
)
RETURNS TABLE (
  content text,
  score float,
  document_title text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.content,
    (1 - (c.embedding <=> p_embedding))::float AS score,
    d.filename AS document_title
  FROM public.kb_chunks c
  INNER JOIN public.kb_documents d ON d.id = c.document_id
  WHERE c.organization_id = p_org_id
    AND d.status = 'ready'
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_embedding
  LIMIT GREATEST(p_match_count, 1);
$$;

-- Private bucket for KB uploads (server uses signed URLs + service role for ingest)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kb-documents',
  'kb-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;
