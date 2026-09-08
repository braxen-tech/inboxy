import { NextResponse } from "next/server";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { createMuxSignedToken } from "@/infrastructure/adapters/mux";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;

  const db = getAdminClient();

  const { data: lesson } = await db
    .from("course_lessons")
    .select("id, mux_playback_id, is_preview, published, module_id, course_modules!inner(course_id)")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson || !lesson.published || !lesson.mux_playback_id) {
    return NextResponse.json({ error: "Aula não encontrada." }, { status: 404 });
  }

  // Preview lessons are accessible without authentication
  if (!lesson.is_preview) {
    const supabase = await getServerClientFromCookies();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const module_ = Array.isArray(lesson.course_modules) ? lesson.course_modules[0] : lesson.course_modules;
    const courseId = (module_ as { course_id: string })?.course_id;

    const { data: enrollment } = await db
      .from("course_enrollments")
      .select("id")
      .eq("course_id", courseId)
      .eq("end_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!enrollment) {
      return NextResponse.json({ error: "Sem acesso a este curso." }, { status: 403 });
    }
  }

  try {
    const token = await createMuxSignedToken({ playbackId: lesson.mux_playback_id, expirationSeconds: 3600 });
    return NextResponse.json({ token });
  } catch (error) {
    logger.error("MUX token: failed to sign", { lessonId, error: String(error) });
    return NextResponse.json({ error: "Erro ao gerar token de vídeo." }, { status: 500 });
  }
}
