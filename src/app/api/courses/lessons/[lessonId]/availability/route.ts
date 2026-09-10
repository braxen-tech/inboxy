import { NextResponse } from "next/server";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { CalComAdapter } from "@/infrastructure/adapters/cal-com/adapter";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();

  const { data: lesson } = await db
    .from("course_lessons")
    .select("id, lesson_type, cal_event_type_id, module_id")
    .eq("id", lessonId)
    .eq("lesson_type", "mentoring")
    .maybeSingle();

  if (!lesson || !lesson.cal_event_type_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: mod } = await db
    .from("course_modules")
    .select("course_id")
    .eq("id", lesson.module_id)
    .single();

  if (!mod) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: enrollment } = await db
    .from("course_enrollments")
    .select("id")
    .eq("course_id", mod.course_id)
    .eq("end_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json({ error: "No active enrollment" }, { status: 403 });
  }

  const { data: course } = await db
    .from("courses")
    .select("organization_id")
    .eq("id", mod.course_id)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: org } = await db
    .from("organizations")
    .select("cal_access_token_enc, cal_timezone")
    .eq("id", course.organization_id)
    .single();

  if (!org?.cal_access_token_enc) {
    return NextResponse.json({ error: "Calendar not configured" }, { status: 500 });
  }

  const secretStore = new AesSecretStore(process.env.ENCRYPTION_KEY!);
  const apiToken = secretStore.decrypt(org.cal_access_token_enc);

  const calendar = new CalComAdapter();
  const result = await calendar.listSlots({
    eventTypeId: lesson.cal_event_type_id,
    startDate,
    endDate,
    timeZone: org.cal_timezone ?? "America/Sao_Paulo",
    apiToken,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ slots: result.value });
}
