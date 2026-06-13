"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  confirmKbUpload,
  createKbUpload,
  deleteKbDocument,
  listKbDocuments,
  retryKbDocument,
  type KbDocumentRow,
} from "./actions";
import { KB_ALLOWED_EXTENSIONS } from "@/lib/kb-mime";

interface Props {
  orgSlug: string;
  initialDocuments: KbDocumentRow[];
  initialUsage: {
    fileCount: number;
    totalBytes: number;
    maxFiles: number;
    maxTotalBytes: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Aguardando";
    case "processing":
      return "Processando";
    case "ready":
      return "Pronto";
    case "failed":
      return "Falhou";
    default:
      return status;
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ready":
      return "default";
    case "failed":
      return "destructive";
    case "processing":
    case "pending":
      return "secondary";
    default:
      return "outline";
  }
}

export function KbDocuments({
  orgSlug,
  initialDocuments,
  initialUsage,
}: Props) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [usage, setUsage] = useState(initialUsage);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isUploading, startUpload] = useTransition();
  const [pendingAction, startAction] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const result = await listKbDocuments(orgSlug);
    if (!result.error && result.documents && result.usage) {
      setDocuments(result.documents);
      setUsage(result.usage);
    }
  }, [orgSlug]);

  useEffect(() => {
    const hasActive = documents.some(
      (doc) => doc.status === "pending" || doc.status === "processing",
    );
    if (!hasActive) return;

    const interval = setInterval(() => {
      void refresh();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, refresh]);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  function handleFileSelect(file: File) {
    startUpload(async () => {
      const createResult = await createKbUpload(orgSlug, {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });

      if (createResult.error || !createResult.uploadUrl || !createResult.documentId) {
        showMessage("error", createResult.error ?? "Falha ao iniciar upload.");
        return;
      }

      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.capture("kb_document_upload_started", {
          org_slug: orgSlug,
          filename: file.name,
          size: file.size,
        });
      }

      const uploadResponse = await fetch(createResult.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          ...(createResult.token ? { "x-upsert": "true" } : {}),
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        await deleteKbDocument(orgSlug, createResult.documentId);
        showMessage("error", "Falha ao enviar arquivo para o storage.");
        await refresh();
        return;
      }

      const confirmResult = await confirmKbUpload(orgSlug, createResult.documentId);
      if (confirmResult.error) {
        showMessage("error", confirmResult.error);
      } else {
        showMessage("success", "Arquivo enviado. Processamento iniciado.");
      }

      await refresh();
    });
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDelete(documentId: string) {
    startAction(async () => {
      const result = await deleteKbDocument(orgSlug, documentId);
      if (result.error) {
        showMessage("error", result.error);
        return;
      }
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.capture("kb_document_deleted", { org_slug: orgSlug, document_id: documentId });
      }
      showMessage("success", "Documento removido.");
      await refresh();
    });
  }

  function handleRetry(documentId: string) {
    startAction(async () => {
      const result = await retryKbDocument(orgSlug, documentId);
      if (result.error) {
        showMessage("error", result.error);
        return;
      }
      showMessage("success", "Reprocessamento iniciado.");
      await refresh();
    });
  }

  const accept = KB_ALLOWED_EXTENSIONS.join(",");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Documentos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Envie PDF, DOCX, TXT, MD ou CSV. O agente consulta estes documentos via busca semântica.
        </p>
      </div>

      <div
        className="border border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/40 transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onInputChange}
          disabled={isUploading}
        />
        <p className="text-sm font-medium">
          {isUploading ? "Enviando arquivo..." : "Arraste um arquivo ou clique para selecionar"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Máx. 10 MB · PDF, DOCX, TXT, MD, CSV
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        {usage.fileCount}/{usage.maxFiles} arquivos · {formatBytes(usage.totalBytes)} /{" "}
        {formatBytes(usage.maxTotalBytes)}
      </p>

      {message && (
        <p className={`text-sm ${message.type === "error" ? "text-destructive" : "text-green-600"}`}>
          {message.text}
        </p>
      )}

      {documents.length > 0 && (
        <div className="border rounded-lg divide-y">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-start justify-between gap-4 p-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium truncate">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(doc.file_size_bytes)}
                  {doc.char_count != null ? ` · ${doc.char_count.toLocaleString()} caracteres` : ""}
                  {doc.chunk_count > 0 ? ` · ${doc.chunk_count} trechos` : ""}
                </p>
                {doc.error_message && (
                  <p className="text-xs text-destructive">{doc.error_message}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={statusVariant(doc.status)}>{statusLabel(doc.status)}</Badge>
                {doc.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingAction}
                    onClick={() => handleRetry(doc.id)}
                  >
                    Retry
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pendingAction}
                  onClick={() => handleDelete(doc.id)}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
