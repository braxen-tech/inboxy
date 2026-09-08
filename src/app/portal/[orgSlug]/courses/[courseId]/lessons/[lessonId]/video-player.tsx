"use client";

import { useTransition } from "react";
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
}

export function VideoPlayer({ lessonId, playbackId, playbackToken, enrollmentId, courseId, orgSlug, nextLessonId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (!playbackId || !playbackToken) {
    return (
      <div className="rounded-lg bg-muted flex items-center justify-center aspect-video text-sm text-muted-foreground">
        Vídeo indisponível no momento.
      </div>
    );
  }

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
