import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { CourseBuilder } from "./course-builder";

interface Props {
  params: Promise<{ orgSlug: string; courseId: string }>;
}

export default async function CourseBuilderPage({ params }: Props) {
  const { orgSlug, courseId } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = getAdminClient();

  const { data: course } = await db
    .from("courses")
    .select("id, title, description, price_brl, active, thumbnail_url")
    .eq("id", courseId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!course) notFound();

  const { data: modules } = await db
    .from("course_modules")
    .select(`
      id, title, position, published,
      course_lessons (
        id, title, position, published, is_preview,
        mux_upload_status, mux_playback_id, duration_seconds
      )
    `)
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  const sortedModules = (modules ?? []).map((m) => ({
    ...m,
    course_lessons: [...(m.course_lessons ?? [])].sort((a, b) => a.position - b.position),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${orgSlug}/courses`} className="hover:text-foreground">Cursos</Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{course.title}</span>
      </div>

      <CourseBuilder
        orgSlug={orgSlug}
        course={course}
        initialModules={sortedModules}
      />
    </div>
  );
}
