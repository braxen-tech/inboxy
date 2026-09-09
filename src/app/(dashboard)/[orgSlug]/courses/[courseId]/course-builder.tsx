"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModule, createLesson, deleteModule, deleteLesson, updateCourse, updateModule } from "../actions";

interface Lesson {
  id: string;
  title: string;
  position: number;
  published: boolean;
  is_preview: boolean;
  mux_upload_status: string | null;
  mux_playback_id: string | null;
  duration_seconds: number | null;
  lesson_type: string;
  live_stream_status: string | null;
  scheduled_at: string | null;
}

interface Module {
  id: string;
  title: string;
  position: number;
  published: boolean;
  course_lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  price_brl: number | null;
  active: boolean;
  thumbnail_url: string | null;
}

interface Props {
  orgSlug: string;
  course: Course;
  initialModules: Module[];
}

function statusBadge(status: string | null, playbackId: string | null) {
  if (playbackId && status === "ready") return <span className="text-xs text-green-600 dark:text-green-400">● Pronto</span>;
  if (status === "errored") return <span className="text-xs text-destructive">● Erro no upload</span>;
  if (status === "waiting" || status === "asset_created") return <span className="text-xs text-amber-600 dark:text-amber-400">● Processando…</span>;
  return <span className="text-xs text-muted-foreground">Sem vídeo</span>;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return ` · ${m}:${String(s).padStart(2, "0")}`;
}

export function CourseBuilder({ orgSlug, course, initialModules }: Props) {
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [pending, startTransition] = useTransition();
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newLessonTitles, setNewLessonTitles] = useState<Record<string, string>>({});
  const [newLessonTypes, setNewLessonTypes] = useState<Record<string, "video" | "live">>({});
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(initialModules.map((m) => m.id)));

  function toggleModule(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  function handleAddModule() {
    if (!newModuleTitle.trim()) return;
    const title = newModuleTitle.trim();
    setNewModuleTitle("");
    startTransition(async () => {
      const r = await createModule(orgSlug, course.id, title);
      if ("success" in r) {
        setModules((prev) => [
          ...prev,
          { id: r.id, title, position: prev.length, published: false, course_lessons: [] },
        ]);
        setExpandedModules((prev) => new Set([...prev, r.id]));
      }
    });
  }

  function handleAddLesson(moduleId: string) {
    const title = newLessonTitles[moduleId]?.trim();
    if (!title) return;
    const lessonType = newLessonTypes[moduleId] ?? "video";
    setNewLessonTitles((prev) => ({ ...prev, [moduleId]: "" }));
    setNewLessonTypes((prev) => ({ ...prev, [moduleId]: "video" }));
    startTransition(async () => {
      const r = await createLesson(orgSlug, course.id, moduleId, title, lessonType);
      if ("success" in r) {
        setModules((prev) =>
          prev.map((m) =>
            m.id === moduleId
              ? {
                  ...m,
                  course_lessons: [
                    ...m.course_lessons,
                    {
                      id: r.id,
                      title,
                      position: m.course_lessons.length,
                      published: false,
                      is_preview: false,
                      mux_upload_status: null,
                      mux_playback_id: null,
                      duration_seconds: null,
                      lesson_type: lessonType,
                      live_stream_status: lessonType === "live" ? "idle" : null,
                      scheduled_at: null,
                    },
                  ],
                }
              : m
          )
        );
      }
    });
  }

  function handleDeleteModule(moduleId: string) {
    if (!confirm("Excluir módulo e todas as suas aulas?")) return;
    startTransition(async () => {
      await deleteModule(orgSlug, course.id, moduleId);
      setModules((prev) => prev.filter((m) => m.id !== moduleId));
    });
  }

  function handleDeleteLesson(moduleId: string, lessonId: string) {
    if (!confirm("Excluir esta aula?")) return;
    startTransition(async () => {
      await deleteLesson(orgSlug, course.id, lessonId);
      setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, course_lessons: m.course_lessons.filter((l) => l.id !== lessonId) } : m));
    });
  }

  function handleTogglePublish() {
    startTransition(async () => {
      await updateCourse(orgSlug, course.id, { active: !course.active });
      router.refresh();
    });
  }

  function handleToggleModulePublish(moduleId: string, current: boolean) {
    startTransition(async () => {
      await updateModule(orgSlug, moduleId, { published: !current });
      setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, published: !current } : m));
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Module/Lesson tree */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="font-semibold">Conteúdo do curso</h2>

        {modules.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
            Nenhum módulo ainda. Adicione o primeiro módulo abaixo.
          </div>
        )}

        {modules.map((mod) => (
          <div key={mod.id} className="rounded-lg border overflow-hidden">
            {/* Module header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/40">
              <button type="button" onClick={() => toggleModule(mod.id)} className="text-xs text-muted-foreground hover:text-foreground w-4">
                {expandedModules.has(mod.id) ? "▼" : "▶"}
              </button>
              <span className="font-medium flex-1 truncate">{mod.title}</span>
              <button
                type="button"
                onClick={() => handleToggleModulePublish(mod.id, mod.published)}
                disabled={pending}
                className={`text-xs px-2 py-0.5 rounded-full border ${mod.published ? "border-green-500 text-green-600 dark:text-green-400" : "border-muted-foreground text-muted-foreground"}`}
              >
                {mod.published ? "Publicado" : "Rascunho"}
              </button>
              <button type="button" onClick={() => handleDeleteModule(mod.id)} disabled={pending} className="text-xs text-muted-foreground hover:text-destructive">
                Excluir
              </button>
            </div>

            {/* Lessons */}
            {expandedModules.has(mod.id) && (
              <div className="divide-y">
                {mod.course_lessons.map((lesson) => (
                  <div key={lesson.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="shrink-0 w-5 text-center">
                      {lesson.lesson_type === "live" ? (
                        <svg className={`w-4 h-4 ${lesson.live_stream_status === "active" ? "text-red-500" : "text-muted-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 15.828a5 5 0 010-7.656m5.656 0a5 5 0 010 7.656M12 12h.01" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/${orgSlug}/courses/${course.id}/lessons/${lesson.id}`} className="font-medium text-sm hover:underline truncate">
                          {lesson.title}
                        </Link>
                        {lesson.lesson_type === "live" && lesson.live_stream_status === "active" && (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 px-1.5 py-0.5 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Ao vivo
                          </span>
                        )}
                        {lesson.lesson_type === "live" && lesson.live_stream_status !== "active" && (
                          <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 px-1.5 py-0.5 rounded">Live</span>
                        )}
                        {lesson.is_preview && (
                          <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded">Preview</span>
                        )}
                        {!lesson.published && (
                          <span className="text-xs text-muted-foreground">(rascunho)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {lesson.lesson_type === "live" ? (
                          lesson.scheduled_at ? (
                            <span className="text-xs text-muted-foreground">
                              Agendada: {new Date(lesson.scheduled_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem agendamento</span>
                          )
                        ) : (
                          <>
                            {statusBadge(lesson.mux_upload_status, lesson.mux_playback_id)}
                            <span className="text-xs text-muted-foreground">{formatDuration(lesson.duration_seconds)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/${orgSlug}/courses/${course.id}/lessons/${lesson.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs">Editar</Button>
                      </Link>
                      <button type="button" onClick={() => handleDeleteLesson(mod.id, lesson.id)} disabled={pending} className="text-xs text-muted-foreground hover:text-destructive">
                        ×
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add lesson input */}
                <div className="flex gap-2 px-4 py-3 bg-muted/20">
                  <select
                    value={newLessonTypes[mod.id] ?? "video"}
                    onChange={(e) => setNewLessonTypes((prev) => ({ ...prev, [mod.id]: e.target.value as "video" | "live" }))}
                    className="h-8 text-sm rounded-md border bg-background px-2"
                  >
                    <option value="video">Vídeo</option>
                    <option value="live">Live</option>
                  </select>
                  <Input
                    value={newLessonTitles[mod.id] ?? ""}
                    onChange={(e) => setNewLessonTitles((prev) => ({ ...prev, [mod.id]: e.target.value }))}
                    placeholder="Título da aula..."
                    className="h-8 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddLesson(mod.id); } }}
                  />
                  <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={pending || !newLessonTitles[mod.id]?.trim()} onClick={() => handleAddLesson(mod.id)}>
                    + Aula
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add module */}
        <div className="flex gap-2">
          <Input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="Título do novo módulo..."
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddModule(); } }}
          />
          <Button variant="outline" disabled={pending || !newModuleTitle.trim()} onClick={handleAddModule} className="shrink-0">
            + Módulo
          </Button>
        </div>
      </div>

      {/* Course metadata panel */}
      <div className="space-y-4">
        <div className="rounded-lg border p-5 space-y-4">
          <h2 className="font-semibold text-sm">Configurações do curso</h2>
          {course.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.thumbnail_url} alt={course.title} className="w-full aspect-video object-cover rounded-md" />
          )}
          <div>
            <p className="text-sm font-medium">{course.title}</p>
            {course.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{course.description}</p>}
            {course.price_brl != null && (
              <p className="text-sm font-semibold mt-1">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(course.price_brl)}
              </p>
            )}
          </div>

          <Button
            className="w-full"
            variant={course.active ? "outline" : "default"}
            disabled={pending}
            onClick={handleTogglePublish}
          >
            {course.active ? "Despublicar curso" : "Publicar curso"}
          </Button>

          <p className="text-xs text-muted-foreground">
            {course.active
              ? "Curso visível na sua loja. Alunos podem comprar."
              : "Rascunho. Não visível na loja."}
          </p>
        </div>
      </div>
    </div>
  );
}
