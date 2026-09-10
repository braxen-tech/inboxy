import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { LessonEditor } from "./lesson-editor";

interface Props {
  params: Promise<{ orgSlug: string; courseId: string; lessonId: string }>;
}

export default async function LessonEditorPage({ params }: Props) {
  const { orgSlug, courseId, lessonId } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = getAdminClient();

  const { data: lesson } = await db
    .from("course_lessons")
    .select("id, title, description, published, is_preview, mux_upload_status, mux_playback_id, mux_asset_id, duration_seconds, module_id, lesson_type, live_stream_status, scheduled_at, cal_event_type_id, booking_quota")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) notFound();

  // Verify lesson belongs to a course of this org
  const { data: mod } = await db
    .from("course_modules")
    .select("course_id, courses!inner(organization_id, title)")
    .eq("id", lesson.module_id)
    .maybeSingle();

  type ModShape = { courses: { organization_id: string; title: string } | null };
  const course = (mod as ModShape | null)?.courses;

  if (!course || course.organization_id !== org.id) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href={`/${orgSlug}/courses`} className="hover:text-foreground">Cursos</Link>
        <span>/</span>
        <Link href={`/${orgSlug}/courses/${courseId}`} className="hover:text-foreground truncate max-w-[140px]">{course.title}</Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{lesson.title}</span>
      </div>

      <LessonEditor orgSlug={orgSlug} courseId={courseId} lesson={lesson} />
    </div>
  );
}
