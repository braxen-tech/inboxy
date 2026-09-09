import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";

interface Props {
  params: Promise<{ orgSlug: string; courseId: string }>;
}

export default async function PortalCourseOverviewPage({ params }: Props) {
  const { orgSlug, courseId } = await params;

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/portal/${orgSlug}/login`);

  const db = getAdminClient();

  // Verify enrollment
  const { data: enrollment } = await db
    .from("course_enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("end_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!enrollment) redirect(`/portal/${orgSlug}/courses`);

  const { data: course } = await db
    .from("courses")
    .select("id, title, description, thumbnail_url, organizations:organization_id(slug)")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) notFound();

  const { data: modules } = await db
    .from("course_modules")
    .select(`
      id, title, position, published,
      course_lessons (
        id, title, position, published, is_preview, mux_playback_id, duration_seconds,
        lesson_type, live_stream_status, scheduled_at, mux_upload_status
      )
    `)
    .eq("course_id", courseId)
    .eq("published", true)
    .order("position", { ascending: true });

  const { data: progress } = await db
    .from("lesson_progress")
    .select("lesson_id, completed_at")
    .eq("enrollment_id", enrollment.id);

  const completedSet = new Set((progress ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id));

  const sortedModules = (modules ?? []).map((m) => ({
    ...m,
    course_lessons: [...(m.course_lessons ?? [])].filter((l) => l.published).sort((a, b) => a.position - b.position),
  }));

  const totalLessons = sortedModules.reduce((acc, m) => acc + m.course_lessons.length, 0);
  const completedLessons = sortedModules.reduce((acc, m) => acc + m.course_lessons.filter((l) => completedSet.has(l.id)).length, 0);

  const now = new Date();
  const upcomingLives = sortedModules
    .flatMap((mod) =>
      mod.course_lessons
        .filter((l) => l.lesson_type === "live" && (l.live_stream_status === "active" || (l.scheduled_at && new Date(l.scheduled_at) > now)))
        .map((l) => ({ ...l, moduleTitle: mod.title }))
    )
    .sort((a, b) => {
      if (a.live_stream_status === "active" && b.live_stream_status !== "active") return -1;
      if (b.live_stream_status === "active" && a.live_stream_status !== "active") return 1;
      return new Date(a.scheduled_at ?? 0).getTime() - new Date(b.scheduled_at ?? 0).getTime();
    });

  function formatDuration(seconds: number | null) {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function getLessonBadge(lesson: { lesson_type: string; live_stream_status: string | null; mux_upload_status: string | null; scheduled_at: string | null }) {
    if (lesson.lesson_type !== "live") return null;
    if (lesson.live_stream_status === "active") {
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 px-1.5 py-0.5 rounded font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Ao vivo
        </span>
      );
    }
    if (lesson.mux_upload_status === "ready") {
      return <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 px-1.5 py-0.5 rounded">Gravação da live</span>;
    }
    if (lesson.scheduled_at) {
      return <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 px-1.5 py-0.5 rounded">Live agendada</span>;
    }
    return <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 px-1.5 py-0.5 rounded">Live</span>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <Link href={`/portal/${orgSlug}/courses`} className="text-sm text-muted-foreground hover:text-foreground">← Meus cursos</Link>
          <h1 className="text-2xl font-bold mt-2">{course.title}</h1>
          {course.description && <p className="text-sm text-muted-foreground">{course.description}</p>}
          {totalLessons > 0 && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((completedLessons / totalLessons) * 100)}%` }} />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{completedLessons}/{totalLessons} aulas</span>
            </div>
          )}
        </div>

        {/* Upcoming lives */}
        {upcomingLives.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 15.828a5 5 0 010-7.656m5.656 0a5 5 0 010 7.656M12 12h.01" />
              </svg>
              Próximas lives
            </h2>
            <div className="space-y-2">
              {upcomingLives.map((live) => (
                <Link
                  key={live.id}
                  href={`/portal/${orgSlug}/courses/${courseId}/lessons/${live.id}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors hover:bg-muted/30 ${live.live_stream_status === "active" ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10" : ""}`}
                >
                  <div className="shrink-0">
                    {live.live_stream_status === "active" ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        AO VIVO
                      </span>
                    ) : (
                      <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 px-2 py-1 rounded font-medium">
                        Agendada
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{live.title}</p>
                    <p className="text-xs text-muted-foreground">{live.moduleTitle}</p>
                  </div>
                  {live.scheduled_at && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(live.scheduled_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Modules */}
        <div className="space-y-4">
          {sortedModules.map((mod) => (
            <div key={mod.id} className="rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40">
                <p className="font-medium text-sm">{mod.title}</p>
              </div>
              <div className="divide-y">
                {mod.course_lessons.map((lesson) => {
                  const completed = completedSet.has(lesson.id);
                  const isLive = lesson.lesson_type === "live";
                  const isActive = isLive && lesson.live_stream_status === "active";
                  return (
                    <Link
                      key={lesson.id}
                      href={`/portal/${orgSlug}/courses/${courseId}/lessons/${lesson.id}`}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${isActive ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${completed ? "border-green-500 bg-green-500" : isActive ? "border-red-500" : "border-muted-foreground"}`}>
                        {completed && <span className="text-white text-xs">✓</span>}
                        {!completed && isLive && (
                          <svg className={`w-3 h-3 ${isActive ? "text-red-500" : "text-muted-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{lesson.title}</p>
                          {getLessonBadge(lesson)}
                        </div>
                        {lesson.is_preview && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">Preview gratuito</span>
                        )}
                        {isLive && lesson.scheduled_at && lesson.live_stream_status !== "active" && lesson.mux_upload_status !== "ready" && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(lesson.scheduled_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                      {!isLive && lesson.duration_seconds ? (
                        <span className="text-xs text-muted-foreground shrink-0">{formatDuration(lesson.duration_seconds)}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
