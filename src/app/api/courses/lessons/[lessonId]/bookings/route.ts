import { NextResponse } from "next/server";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();

  const { data: lesson } = await db
    .from("course_lessons")
    .select("module_id")
    .eq("id", lessonId)
    .eq("lesson_type", "mentoring")
    .maybeSingle();

  if (!lesson) {
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

  const { data: bookings } = await db
    .from("mentoring_bookings")
    .select("id, cal_booking_id, cal_booking_start, status, created_at")
    .eq("enrollment_id", enrollment.id)
    .eq("lesson_id", lessonId)
    .order("cal_booking_start", { ascending: true });

  return NextResponse.json({ bookings: bookings ?? [] });
}
