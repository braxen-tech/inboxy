import { NextResponse } from "next/server";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { createLiveKitToken } from "@/infrastructure/adapters/livekit";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let lessonId: string;
  try {
    const body = await request.json() as { lessonId?: string };
    lessonId = body.lessonId ?? "";
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!lessonId) {
    return NextResponse.json({ error: "lessonId obrigatório." }, { status: 400 });
  }

  const db = getAdminClient();

  const { data: lesson } = await db
    .from("course_lessons")
    .select("id, lesson_type, module_id, course_modules!inner(course_id, courses!inner(organization_id, organizations!inner(owner_user_id)))")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) {
    return NextResponse.json({ error: "Aula não encontrada." }, { status: 404 });
  }

  type ModuleShape = { courses: { organization_id: string; organizations: { owner_user_id: string } | null } | null };
  const module_ = (Array.isArray(lesson.course_modules) ? lesson.course_modules[0] : lesson.course_modules) as unknown as ModuleShape | null;
  const org = module_?.courses?.organizations;

  if (!org || org.owner_user_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (lesson.lesson_type !== "live") {
    return NextResponse.json({ error: "Aula não é do tipo live." }, { status: 400 });
  }

  try {
    const roomName = `live-lesson-${lessonId}`;
    const { token, wsUrl } = await createLiveKitToken(roomName, user.id, true);
    return NextResponse.json({ token, wsUrl, roomName });
  } catch (error) {
    logger.error("LiveKit token: failed to create token", { lessonId, error: String(error) });
    return NextResponse.json({ error: "Erro ao gerar token LiveKit." }, { status: 500 });
  }
}
