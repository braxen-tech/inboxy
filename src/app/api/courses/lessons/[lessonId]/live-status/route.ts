import { NextResponse } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;

  const db = getAdminClient();
  const { data: lesson } = await db
    .from("course_lessons")
    .select("live_stream_status, mux_upload_status")
    .eq("id", lessonId)
    .eq("lesson_type", "live")
    .maybeSingle();

  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    liveStreamStatus: lesson.live_stream_status,
    muxUploadStatus: lesson.mux_upload_status,
  });
}
