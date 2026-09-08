"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VideoUploader } from "@/components/courses/video-uploader";
import { updateLesson } from "../../../actions";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  is_preview: boolean;
  mux_upload_status: string | null;
  mux_playback_id: string | null;
  mux_asset_id: string | null;
  duration_seconds: number | null;
}

interface Props {
  orgSlug: string;
  courseId: string;
  lesson: Lesson;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function LessonEditor({ orgSlug, courseId, lesson }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description ?? "");
  const [isPreview, setIsPreview] = useState(lesson.is_preview);
  const [published, setPublished] = useState(lesson.published);
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    startTransition(async () => {
      await updateLesson(orgSlug, courseId, lesson.id, { title, description, isPreview, published });
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* Metadata */}
      <div className="rounded-lg border p-6 space-y-5">
        <h2 className="font-semibold">Informações da aula</h2>

        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} placeholder="O que o aluno vai aprender nesta aula..." />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} className="rounded" />
            <span className="text-sm">Preview gratuito</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="rounded" />
            <span className="text-sm">Publicada</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending || !title.trim()}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
          {saved && <span className="text-sm text-green-600 dark:text-green-400">Salvo!</span>}
        </div>
      </div>

      {/* Video */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Vídeo da aula</h2>
          {lesson.duration_seconds && (
            <span className="text-sm text-muted-foreground">{formatDuration(lesson.duration_seconds)}</span>
          )}
        </div>

        {lesson.mux_playback_id && lesson.mux_upload_status === "ready" ? (
          <div className="space-y-3">
            <div className="rounded-md bg-muted/60 flex items-center justify-center aspect-video text-sm text-muted-foreground">
              Vídeo pronto · Playback ID: <code className="ml-1 text-xs">{lesson.mux_playback_id.slice(0, 12)}…</code>
            </div>
            <p className="text-xs text-muted-foreground">Para substituir o vídeo, faça um novo upload abaixo.</p>
            <VideoUploader lessonId={lesson.id} onUploaded={() => router.refresh()} />
          </div>
        ) : lesson.mux_upload_status === "waiting" || lesson.mux_upload_status === "asset_created" ? (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-700 dark:text-amber-400">
            Processando vídeo… isso pode levar alguns minutos. Recarregue a página para atualizar.
          </div>
        ) : lesson.mux_upload_status === "errored" ? (
          <div className="space-y-3">
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
              Erro no processamento do vídeo. Tente fazer o upload novamente.
            </div>
            <VideoUploader lessonId={lesson.id} onUploaded={() => router.refresh()} />
          </div>
        ) : (
          <VideoUploader lessonId={lesson.id} onUploaded={() => router.refresh()} />
        )}
      </div>
    </div>
  );
}
