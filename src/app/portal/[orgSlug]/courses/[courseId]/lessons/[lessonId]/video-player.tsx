"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MuxPlayer from "@mux/mux-player-react";
import { markLessonComplete } from "./actions";

interface Props {
  lessonId: string;
  playbackId: string | null;
  playbackToken: string | null;
  enrollmentId: string | null;
  courseId: string;
  orgSlug: string;
  nextLessonId: string | null;
  lessonType: string;
  liveStreamStatus: string | null;
  muxUploadStatus: string | null;
}

export function VideoPlayer({
  lessonId,
  playbackId,
  playbackToken,
  enrollmentId,
  courseId,
  orgSlug,
  nextLessonId,
  lessonType,
  liveStreamStatus: initialLiveStatus,
  muxUploadStatus: initialUploadStatus,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [liveStatus, setLiveStatus] = useState(initialLiveStatus);
  const [uploadStatus, setUploadStatus] = useState(initialUploadStatus);

  useEffect(() => {
    if (lessonType !== "live") return;
    if (uploadStatus === "ready") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/courses/lessons/${lessonId}/live-status`);
        if (!res.ok) return;
        const data = (await res.json()) as { liveStreamStatus: string | null; muxUploadStatus: string | null };
        setLiveStatus(data.liveStreamStatus);
        setUploadStatus(data.muxUploadStatus);

        if (data.muxUploadStatus === "ready") {
          router.refresh();
        }
      } catch {
        // Silent retry on next interval
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [lessonId, lessonType, uploadStatus, router]);

  function handleEnded() {
    if (!enrollmentId) return;
    startTransition(async () => {
      await markLessonComplete(enrollmentId!, lessonId);
      router.refresh();
      if (nextLessonId) {
        router.push(`/portal/${orgSlug}/courses/${courseId}/lessons/${nextLessonId}`);
      }
    });
  }

  // Live lesson: active stream
  if (lessonType === "live" && liveStatus === "active" && playbackId && playbackToken) {
    return (
      <div className="relative rounded-lg overflow-hidden bg-black">
        <MuxPlayer
          playbackId={playbackId}
          tokens={{ playback: playbackToken }}
          streamType="live"
          style={{ aspectRatio: "16/9", width: "100%" }}
        />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-medium px-3 py-1 rounded">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          AO VIVO
        </div>
      </div>
    );
  }

  // Live lesson: recording ready (VOD)
  if (lessonType === "live" && uploadStatus === "ready" && playbackId && playbackToken) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg overflow-hidden bg-black">
          <MuxPlayer
            playbackId={playbackId}
            tokens={{ playback: playbackToken }}
            streamType="on-demand"
            style={{ aspectRatio: "16/9", width: "100%" }}
            onEnded={handleEnded}
          />
        </div>
        <p className="text-xs text-muted-foreground">Gravação da transmissão ao vivo</p>
      </div>
    );
  }

  // Live lesson: not started or ended without recording yet
  if (lessonType === "live") {
    return (
      <div className="rounded-lg bg-muted flex flex-col items-center justify-center aspect-video text-center px-4">
        <svg className="w-10 h-10 text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 15.828a5 5 0 010-7.656m5.656 0a5 5 0 010 7.656M12 12h.01" />
        </svg>
        {liveStatus === "idle" ? (
          <>
            <p className="text-sm text-muted-foreground font-medium">A transmissão ainda não começou</p>
            <p className="text-xs text-muted-foreground mt-1">Esta página atualiza automaticamente quando a live iniciar.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground font-medium">A transmissão terminou</p>
            <p className="text-xs text-muted-foreground mt-1">A gravação estará disponível em breve.</p>
          </>
        )}
      </div>
    );
  }

  // Regular video lesson
  if (!playbackId || !playbackToken) {
    return (
      <div className="rounded-lg bg-muted flex items-center justify-center aspect-video text-sm text-muted-foreground">
        Vídeo indisponível no momento.
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden bg-black">
      <MuxPlayer
        playbackId={playbackId}
        tokens={{ playback: playbackToken }}
        streamType="on-demand"
        style={{ aspectRatio: "16/9", width: "100%" }}
        onEnded={handleEnded}
      />
    </div>
  );
}
