"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  lessonId: string;
  onUploaded?: () => void;
}

type UploadState = "idle" | "uploading" | "done" | "error";

export function VideoUploader({ lessonId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleFile(file: File) {
    setState("uploading");
    setProgress(0);
    setErrorMsg("");

    try {
      // 1. Get a direct upload URL from our API
      const res = await fetch("/api/mux/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Erro ao obter URL de upload.");
      }

      const { uploadUrl } = (await res.json()) as { uploadUrl: string };

      // 2. Upload directly to MUX using XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload falhou: HTTP ${xhr.status}`));
        };

        xhr.onerror = () => reject(new Error("Erro de rede no upload."));
        xhr.send(file);
      });

      setState("done");
      onUploaded?.();
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido.");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  if (state === "uploading") {
    return (
      <div className="space-y-2">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">{progress}% enviado para o MUX…</p>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-400">
        Upload concluído! O vídeo está sendo processado — recarregue em alguns minutos.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state === "error" && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}
      <div
        className="rounded-lg border-2 border-dashed p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        <p className="text-sm text-muted-foreground">Arraste um arquivo de vídeo ou clique para selecionar</p>
        <p className="text-xs text-muted-foreground mt-1">MP4, MOV, AVI · sem limite de tamanho</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
          Selecionar vídeo
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
