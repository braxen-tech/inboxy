"use server";

import { revalidatePath } from "next/cache";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getOwnedOrg } from "@/lib/get-owned-org";
import { getKbPlanLimits } from "@/lib/kb-limits";
import {
  KB_BUCKET,
  KB_MAX_FILE_BYTES,
  buildKbStoragePath,
  isKbFilenameAllowed,
  resolveKbMimeType,
} from "@/lib/kb-mime";
import { sanitizeKnowledgeBase } from "@/infrastructure/security/sanitize";
import { inngest } from "@/infrastructure/events/inngest-client";
import { assertInngestEventKeyConfigured } from "@/infrastructure/events/inngest-client";
import {
  runKbAgentTest,
  type KbAgentTestOutput,
} from "@/application/services/test-kb-agent";
import { captureServerEvent } from "@/lib/posthog-server";

const MAX_KB_CHARS = 200_000;

async function requireOwnedOrg(orgSlug: string) {
  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." as const, org: null, userId: null };

  const org = await getOwnedOrg(orgSlug, user.id);
  if (!org) return { error: "Organização não encontrada." as const, org: null, userId: null };

  return { error: null, org, userId: user.id };
}

export async function updateKnowledgeBase(orgId: string, orgSlug: string, knowledgeBase: string) {
  const auth = await requireOwnedOrg(orgSlug);
  if (auth.error) return { error: auth.error };
  if (auth.org!.id !== orgId) return { error: "Organização inválida." };

  const sanitized = sanitizeKnowledgeBase(knowledgeBase);
  if (sanitized.length > MAX_KB_CHARS) {
    return { error: `Knowledge base excede o limite de ${MAX_KB_CHARS} caracteres.` };
  }

  const db = getAdminClient();
  const { error } = await db
    .from("organizations")
    .update({ knowledge_base: sanitized })
    .eq("id", orgId);

  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/kb`);
  return { success: true };
}

export interface KbDocumentRow {
  id: string;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  status: string;
  error_message: string | null;
  char_count: number | null;
  chunk_count: number;
  created_at: string;
}

export async function listKbDocuments(orgSlug: string) {
  const auth = await requireOwnedOrg(orgSlug);
  if (auth.error) return { error: auth.error };

  const db = getAdminClient();
  const { data, error } = await db
    .from("kb_documents")
    .select(
      "id, filename, mime_type, file_size_bytes, status, error_message, char_count, chunk_count, created_at",
    )
    .eq("organization_id", auth.org!.id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  const limits = getKbPlanLimits(auth.org!.subscription_plan);
  const totalBytes = (data ?? []).reduce((sum, row) => sum + (row.file_size_bytes ?? 0), 0);

  return {
    documents: (data ?? []) as KbDocumentRow[],
    usage: {
      fileCount: data?.length ?? 0,
      totalBytes,
      maxFiles: limits.maxFiles,
      maxTotalBytes: limits.maxTotalBytes,
    },
  };
}

export async function createKbUpload(
  orgSlug: string,
  input: { filename: string; mimeType: string; size: number },
) {
  const auth = await requireOwnedOrg(orgSlug);
  if (auth.error) return { error: auth.error };

  if (!isKbFilenameAllowed(input.filename)) {
    return {
      error: "Tipo de arquivo não suportado. Use PDF, DOCX, TXT, MD ou CSV.",
    };
  }

  const resolvedMime = resolveKbMimeType(input.filename, input.mimeType);
  if (!resolvedMime) {
    return { error: "Tipo MIME não permitido." };
  }

  if (input.size <= 0) {
    return { error: "Arquivo vazio." };
  }

  if (input.size > KB_MAX_FILE_BYTES) {
    return { error: "Arquivo excede o limite de 10 MB." };
  }

  const db = getAdminClient();
  const limits = getKbPlanLimits(auth.org!.subscription_plan);

  const { data: existing } = await db
    .from("kb_documents")
    .select("id, file_size_bytes")
    .eq("organization_id", auth.org!.id);

  const fileCount = existing?.length ?? 0;
  const totalBytes = (existing ?? []).reduce((sum, row) => sum + (row.file_size_bytes ?? 0), 0);

  if (fileCount >= limits.maxFiles) {
    return { error: `Limite de ${limits.maxFiles} arquivos atingido para o seu plano.` };
  }

  if (totalBytes + input.size > limits.maxTotalBytes) {
    return { error: "Limite total de armazenamento da base de conhecimento atingido." };
  }

  const documentId = crypto.randomUUID();
  const storagePath = buildKbStoragePath(auth.org!.id, documentId, input.filename);

  const { error: insertError } = await db.from("kb_documents").insert({
    id: documentId,
    organization_id: auth.org!.id,
    filename: input.filename,
    mime_type: resolvedMime,
    storage_path: storagePath,
    file_size_bytes: input.size,
    status: "pending",
  });

  if (insertError) return { error: insertError.message };

  const { data: signed, error: signedError } = await db.storage
    .from(KB_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signedError || !signed) {
    await db.from("kb_documents").delete().eq("id", documentId);
    return { error: signedError?.message ?? "Falha ao gerar URL de upload." };
  }

  revalidatePath(`/${orgSlug}/kb`);

  return {
    documentId,
    uploadUrl: signed.signedUrl,
    token: signed.token,
    path: signed.path,
  };
}

export async function confirmKbUpload(orgSlug: string, documentId: string) {
  const auth = await requireOwnedOrg(orgSlug);
  if (auth.error) return { error: auth.error };

  const db = getAdminClient();
  const { data: document, error } = await db
    .from("kb_documents")
    .select("id, organization_id, status, storage_path")
    .eq("id", documentId)
    .eq("organization_id", auth.org!.id)
    .single();

  if (error || !document) {
    return { error: "Documento não encontrado." };
  }

  const { data: stored, error: storageError } = await db.storage
    .from(KB_BUCKET)
    .list(`${auth.org!.id}/${documentId}`, { limit: 1 });

  if (storageError || !stored?.length) {
    return { error: "Upload não encontrado. Tente enviar o arquivo novamente." };
  }

  try {
    assertInngestEventKeyConfigured();
    await inngest.send({
      name: "kb.document.uploaded",
      data: { orgId: auth.org!.id, documentId },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Falha ao iniciar processamento do documento.",
    };
  }

  revalidatePath(`/${orgSlug}/kb`);
  return { success: true };
}

export async function deleteKbDocument(orgSlug: string, documentId: string) {
  const auth = await requireOwnedOrg(orgSlug);
  if (auth.error) return { error: auth.error };

  const db = getAdminClient();
  const { data: document, error } = await db
    .from("kb_documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("organization_id", auth.org!.id)
    .single();

  if (error || !document) {
    return { error: "Documento não encontrado." };
  }

  await db.storage.from(KB_BUCKET).remove([document.storage_path]);
  await db.from("kb_documents").delete().eq("id", documentId);

  revalidatePath(`/${orgSlug}/kb`);
  return { success: true };
}

export async function retryKbDocument(orgSlug: string, documentId: string) {
  const auth = await requireOwnedOrg(orgSlug);
  if (auth.error) return { error: auth.error };

  const db = getAdminClient();
  const { data: document, error } = await db
    .from("kb_documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("organization_id", auth.org!.id)
    .single();

  if (error || !document) {
    return { error: "Documento não encontrado." };
  }

  if (document.status !== "failed") {
    return { error: "Somente documentos com falha podem ser reprocessados." };
  }

  await db
    .from("kb_documents")
    .update({ status: "pending", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", documentId);

  try {
    assertInngestEventKeyConfigured();
    await inngest.send({
      name: "kb.document.uploaded",
      data: { orgId: auth.org!.id, documentId },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Falha ao reprocessar documento.",
    };
  }

  revalidatePath(`/${orgSlug}/kb`);
  return { success: true };
}

export type { KbAgentTestOutput };

export async function testKbAgent(orgSlug: string, question: string) {
  const auth = await requireOwnedOrg(orgSlug);
  if (auth.error) return { error: auth.error };

  const db = getAdminClient();
  const outcome = await runKbAgentTest(db, auth.org!.id, question);

  if (outcome.error) {
    return { error: outcome.error };
  }

  captureServerEvent("kb_agent_test_run", {
    org_id: auth.org!.id,
    org_slug: orgSlug,
    used_lookup_knowledge: outcome.result!.usedLookupKnowledge,
    lookup_call_count: outcome.result!.lookupCalls.length,
    direct_chunk_count: outcome.result!.directChunks.length,
  });

  return { result: outcome.result };
}
