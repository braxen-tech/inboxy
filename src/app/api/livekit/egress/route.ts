import { NextResponse } from "next/server";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { startLiveKitEgress, stopLiveKitEgress } from "@/infrastructure/adapters/livekit";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let lessonId: string;
  let action: "start" | "stop";
  let egressId: string | undefined;
  try {
    const body = await request.json() as { lessonId?: string; action?: string; egressId?: string };
    lessonId = body.lessonId ?? "";
    action = body.action as "start" | "stop";
    egressId = body.egressId;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!lessonId || !["start", "stop"].includes(action)) {
    return NextResponse.json({ error: "lessonId e action ('start' | 'stop') obrigatórios." }, { status: 400 });
  }

  const db = getAdminClient();

  const { data: lesson } = await db
    .from("course_lessons")
    .select("id, lesson_type, mux_stream_key, module_id, course_modules!inner(course_id, courses!inner(organization_id, organizations!inner(owner_user_id)))")
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
    if (action === "start") {
      if (!lesson.mux_stream_key) {
        return NextResponse.json({ error: "Stream key não configurada." }, { status: 400 });
      }

      const roomName = `live-lesson-${lessonId}`;
      const result = await startLiveKitEgress(roomName, lesson.mux_stream_key);
      logger.info("LiveKit egress started", { lessonId, egressId: result.egressId });
      return NextResponse.json({ egressId: result.egressId });
    }

    if (!egressId) {
      return NextResponse.json({ error: "egressId obrigatório para stop." }, { status: 400 });
    }

    await stopLiveKitEgress(egressId);
    logger.info("LiveKit egress stopped", { lessonId, egressId });
    return NextResponse.json({ status: "stopped" });
  } catch (error) {
    logger.error("LiveKit egress: failed", { lessonId, action, error: String(error) });
    return NextResponse.json({ error: "Erro ao gerenciar egress LiveKit." }, { status: 500 });
  }
}
