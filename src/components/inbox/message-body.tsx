"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const MEDIA_LABELS: Record<string, string> = {
  image: "[Imagem]",
  audio: "[Áudio]",
  video: "[Vídeo]",
  document: "[Documento]",
  sticker: "[Sticker]",
  location: "[Localização]",
  contact: "[Contato]",
  template: "[Template]",
};

interface MessageBodyProps {
  content: string | null | undefined;
  messageType?: string | null;
  outbound?: boolean;
  className?: string;
}

export function MessageBody({ content, messageType, outbound = false, className }: MessageBodyProps) {
  const text = (content ?? "").trim();

  if (!text) {
    const label =
      (messageType && MEDIA_LABELS[messageType]) ||
      (messageType && messageType !== "text" ? `[${messageType}]` : null);
    return (
      <div className={cn("break-words text-sm italic opacity-80", className)}>
        {label ?? "—"}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "break-words text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_p]:my-1 [&_p]:whitespace-pre-wrap",
        "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4",
        "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4",
        "[&_li]:my-0.5",
        "[&_strong]:font-semibold",
        "[&_em]:italic",
        "[&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
        outbound
          ? "[&_a]:text-white [&_a]:underline [&_code]:bg-white/20"
          : "[&_a]:text-primary [&_a]:underline",
        className,
      )}
    >
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
