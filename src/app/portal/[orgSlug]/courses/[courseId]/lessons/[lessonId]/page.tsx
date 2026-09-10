import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { createMuxSignedToken } from "@/infrastructure/adapters/mux";
import { VideoPlayer } from "./video-player";
import { MentoringScheduler } from "@/components/courses/mentoring-scheduler";

interface Props {
  params: Promise<{ orgSlug: string; courseId: string; lessonId: string }>;
}

export default async function LessonPlayerPage({ params }: Props) {
  const { orgSlug, courseId, lessonId } = await params;

  const db = getAdminClient();

  const { data: lesson } = await db
    .from("course_lessons")
    .select("id, title, description, published, is_preview, mux_playback_id, module_id, lesson_type, live_stream_status, mux_upload_status, cal_event_type_id, booking_quota")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson || !lesson.published) notFound();

  let enrollmentId: string | null = null;
  let userName = "";
  let userEmail = "";

  if (!lesson.is_preview) {
    const supabase = await getServerClientFromCookies();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect(`/portal/${orgSlug}/login`);

    const { data: enrollment } = await db
      .from("course_enrollments")
      .select("id, buyer_name, buyer_email")
      .eq("course_id", courseId)
      .eq("end_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!enrollment) redirect(`/portal/${orgSlug}/courses`);
    enrollmentId = enrollment.id;
    userName = enrollment.buyer_name ?? "";
    userEmail = enrollment.buyer_email ?? user.email ?? "";
  }

  // Generate signed token server-side
  let playbackToken: string | null = null;
  if (lesson.mux_playback_id) {
    try {
      playbackToken = await createMuxSignedToken({ playbackId: lesson.mux_playback_id, expirationSeconds: 3600 });
    } catch {
      // Signing keys may not be configured in dev — player will show an error
    }
  }

  // Fetch adjacent lessons for navigation
  const { data: mod } = await db
    .from("course_modules")
    .select("course_id, courses!inner(title), position")
    .eq("id", lesson.module_id)
    .maybeSingle();

  const courseTitle = (() => {
    type ModShape = { courses: { title: string } | null };
    return (mod as ModShape | null)?.courses?.title ?? "";
  })();

  const { data: allModules } = await db
    .from("course_modules")
    .select("id, position, course_lessons(id, title, position, published)")
    .eq("course_id", courseId)
    .eq("published", true)
    .order("position", { ascending: true });

  const allLessons = (allModules ?? [])
    .flatMap((m) => (m.course_lessons ?? []).filter((l) => l.published).sort((a, b) => a.position - b.position))
    .map((l) => ({ id: l.id, title: l.title }));

  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href={`/portal/${orgSlug}/courses`} className="hover:text-foreground">Meus cursos</Link>
          <span>/</span>
          <Link href={`/portal/${orgSlug}/courses/${courseId}`} className="hover:text-foreground truncate max-w-[160px]">{courseTitle}</Link>
          <span>/</span>
          <span className="text-foreground truncate max-w-[160px]">{lesson.title}</span>
        </div>

        {/* Content: Video/Live or Mentoring Scheduler */}
        {lesson.lesson_type === "mentoring" ? (
          <MentoringScheduler
            lessonId={lessonId}
            bookingQuota={lesson.booking_quota ?? 1}
            userName={userName}
            userEmail={userEmail}
          />
        ) : (
          <VideoPlayer
            lessonId={lessonId}
            playbackId={lesson.mux_playback_id}
            playbackToken={playbackToken}
            enrollmentId={enrollmentId}
            courseId={courseId}
            orgSlug={orgSlug}
            nextLessonId={nextLesson?.id ?? null}
            lessonType={lesson.lesson_type ?? "video"}
            liveStreamStatus={lesson.live_stream_status ?? null}
            muxUploadStatus={lesson.mux_upload_status ?? null}
          />
        )}

        {/* Lesson info */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold">{lesson.title}</h1>
          {lesson.description && <p className="text-sm text-muted-foreground">{lesson.description}</p>}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t">
          {prevLesson ? (
            <Link href={`/portal/${orgSlug}/courses/${courseId}/lessons/${prevLesson.id}`} className="text-sm text-muted-foreground hover:text-foreground">
              ← {prevLesson.title}
            </Link>
          ) : <span />}
          {nextLesson ? (
            <Link href={`/portal/${orgSlug}/courses/${courseId}/lessons/${nextLesson.id}`} className="text-sm text-muted-foreground hover:text-foreground">
              {nextLesson.title} →
            </Link>
          ) : (
            <Link href={`/portal/${orgSlug}/courses/${courseId}`} className="text-sm text-muted-foreground hover:text-foreground">
              Ver todas as aulas →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
