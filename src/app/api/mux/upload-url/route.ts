import { NextResponse } from "next/server";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { createMuxDirectUpload } from "@/infrastructure/adapters/mux";
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

  // Verify the lesson belongs to an org owned by this user
  const { data: lesson } = await db
    .from("course_lessons")
    .select("id, module_id, course_modules!inner(course_id, courses!inner(organization_id, organizations!inner(owner_user_id)))")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) {
    return NextResponse.json({ error: "Aula não encontrada." }, { status: 404 });
  }

  type ModuleShape = { courses: { organization_id: string; organizations: { owner_user_id: string } | null } | null };
  const module_ = (Array.isArray(lesson.course_modules) ? lesson.course_modules[0] : lesson.course_modules) as unknown as ModuleShape | null;
  const course = module_?.courses;
  const org = course?.organizations;

  if (!org || org.owner_user_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const { uploadId, uploadUrl } = await createMuxDirectUpload(appUrl);

    await db
      .from("course_lessons")
      .update({ mux_upload_id: uploadId, mux_upload_status: "waiting", updated_at: new Date().toISOString() })
      .eq("id", lessonId);

    return NextResponse.json({ uploadUrl, uploadId });
  } catch (error) {
    logger.error("MUX upload-url: failed to create upload", { lessonId, error: String(error) });
    return NextResponse.json({ error: "Erro ao criar upload MUX." }, { status: 500 });
  }
}
