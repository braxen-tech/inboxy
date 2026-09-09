"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  VideoTrack,
  TrackToggle,
  MediaDeviceSelect,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Button } from "@/components/ui/button";

interface Props {
  lessonId: string;
  liveStreamStatus: string | null;
  muxUploadStatus: string | null;
  durationSeconds: number | null;
  onStatusChange?: () => void;
}

type BroadcastState = "pre" | "connecting" | "live" | "stopping" | "post";

export function LiveBroadcaster({ lessonId, liveStreamStatus, muxUploadStatus, durationSeconds, onStatusChange }: Props) {
  const [state, setState] = useState<BroadcastState>("pre");
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [egressId, setEgressId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasRecording = muxUploadStatus === "ready";

  useEffect(() => {
    if (liveStreamStatus === "active" && state === "pre") {
      setState("live");
    }
  }, [liveStreamStatus, state]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startTimer() {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  async function handleStartBroadcast() {
    setState("connecting");
    setError(null);

    try {
      const tokenRes = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });

      if (!tokenRes.ok) {
        const err = (await tokenRes.json()) as { error?: string };
        throw new Error(err.error ?? "Erro ao gerar token.");
      }

      const { token: tk, wsUrl: ws } = (await tokenRes.json()) as { token: string; wsUrl: string };
      setToken(tk);
      setWsUrl(ws);
    } catch (err) {
      setState("pre");
      setError(err instanceof Error ? err.message : "Erro ao iniciar transmissão.");
    }
  }

  async function handleStopBroadcast() {
    setState("stopping");
    stopTimer();

    try {
      if (egressId) {
        await fetch("/api/livekit/egress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, action: "stop", egressId }),
        });
      }
    } catch {
      // Best effort
    }

    setToken(null);
    setWsUrl(null);
    setEgressId(null);
    setState("post");
    onStatusChange?.();
  }

  async function handleNewBroadcast() {
    setState("pre");
    setError(null);
    onStatusChange?.();
  }

  // Pre-broadcast: show camera preview & start button
  if (state === "pre" && !hasRecording) {
    return (
      <div className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="rounded-lg bg-black aspect-video flex items-center justify-center">
          <div className="text-center text-zinc-500">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <p className="text-sm">Preview da câmera</p>
          </div>
        </div>
        <Button onClick={handleStartBroadcast} className="w-full bg-red-600 hover:bg-red-700 text-white">
          Iniciar transmissão
        </Button>
      </div>
    );
  }

  // Connecting state
  if (state === "connecting" && !token) {
    return (
      <div className="rounded-lg bg-black aspect-video flex items-center justify-center">
        <p className="text-sm text-zinc-400 animate-pulse">Conectando…</p>
      </div>
    );
  }

  // Live broadcast with LiveKit Room
  if ((state === "connecting" || state === "live") && token && wsUrl) {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={wsUrl}
        connect={true}
        video={true}
        audio={true}
        onConnected={async () => {
          setState("live");
          startTimer();
          try {
            const res = await fetch("/api/livekit/egress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lessonId, action: "start" }),
            });
            if (res.ok) {
              const data = (await res.json()) as { egressId: string };
              setEgressId(data.egressId);
            }
          } catch {
            // Egress may already be running
          }
        }}
        onDisconnected={() => {
          if (state === "live") {
            stopTimer();
            setState("post");
            onStatusChange?.();
          }
        }}
      >
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <LocalVideoPreview />
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white text-xs font-medium px-3 py-1 rounded">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              AO VIVO
            </div>
            <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded">
              {formatTime(elapsed)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrackToggle source={Track.Source.Microphone} className="rounded px-3 py-2 text-sm border hover:bg-muted" />
            <TrackToggle source={Track.Source.Camera} className="rounded px-3 py-2 text-sm border hover:bg-muted" />
            <div className="flex-1" />
            <Button
              variant="destructive"
              onClick={handleStopBroadcast}
              disabled={(state as BroadcastState) === "stopping"}
            >
              {(state as BroadcastState) === "stopping" ? "Encerrando…" : "Encerrar transmissão"}
            </Button>
          </div>
        </div>
      </LiveKitRoom>
    );
  }

  // Stopping
  if (state === "stopping") {
    return (
      <div className="rounded-lg bg-black aspect-video flex items-center justify-center">
        <p className="text-sm text-zinc-400 animate-pulse">Encerrando transmissão…</p>
      </div>
    );
  }

  // Post-broadcast or has recording
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-black aspect-video flex items-center justify-center">
        <div className="text-center text-zinc-500">
          {hasRecording ? (
            <>
              <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              <p className="text-sm">Gravação disponível · {durationSeconds ? formatTime(durationSeconds) : ""}</p>
            </>
          ) : (
            <>
              <svg className="w-10 h-10 mx-auto mb-2 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
              <p className="text-sm">Transmissão encerrada</p>
              <p className="text-xs text-zinc-600 mt-1">A gravação estará disponível em breve</p>
            </>
          )}
        </div>
      </div>
      {hasRecording && (
        <div className="rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-400">
          Gravação disponível para os alunos.
        </div>
      )}
      <Button variant="outline" onClick={handleNewBroadcast}>
        Nova transmissão
      </Button>
    </div>
  );
}

function LocalVideoPreview() {
  const { localParticipant } = useLocalParticipant();
  const cameraTrack = localParticipant.getTrackPublication(Track.Source.Camera);

  if (!cameraTrack?.track) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
        Câmera desligada
      </div>
    );
  }

  return <VideoTrack trackRef={{ participant: localParticipant, source: Track.Source.Camera, publication: cameraTrack }} />;
}
