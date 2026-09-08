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
        id, title, position, published, is_preview, mux_playback_id, duration_seconds
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

  function formatDuration(seconds: number | null) {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
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
                  return (
                    <Link key={lesson.id} href={`/portal/${orgSlug}/courses/${courseId}/lessons/${lesson.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${completed ? "border-green-500 bg-green-500" : "border-muted-foreground"}`}>
                        {completed && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lesson.title}</p>
                        {lesson.is_preview && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">Preview gratuito</span>
                        )}
                      </div>
                      {lesson.duration_seconds && (
                        <span className="text-xs text-muted-foreground shrink-0">{formatDuration(lesson.duration_seconds)}</span>
                      )}
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
