import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { CalComAdapter } from "@/infrastructure/adapters/cal-com/adapter";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";

const bookingSchema = z.object({
  start: z.string(),
  attendeeName: z.string().min(2),
  attendeeEmail: z.email(),
  timeZone: z.string().optional().default("America/Sao_Paulo"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await params;

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { start, attendeeName, attendeeEmail, timeZone } = parsed.data;
  const db = getAdminClient();

  const { data: lesson } = await db
    .from("course_lessons")
    .select("id, lesson_type, cal_event_type_id, booking_quota, module_id")
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

  // Check quota
  const { count } = await db
    .from("mentoring_bookings")
    .select("id", { count: "exact", head: true })
    .eq("enrollment_id", enrollment.id)
    .eq("lesson_id", lessonId)
    .neq("status", "canceled");

  if ((count ?? 0) >= lesson.booking_quota) {
    return NextResponse.json({ error: "Booking quota exhausted" }, { status: 403 });
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
  const idempotencyKey = `mentoring:${enrollment.id}:${lessonId}:${start}`;

  const result = await calendar.createBooking({
    eventTypeId: lesson.cal_event_type_id,
    start,
    attendeeName,
    attendeeEmail,
    timeZone,
    apiToken,
    idempotencyKey,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const booking = result.value;

  const { error: insertErr } = await db
    .from("mentoring_bookings")
    .insert({
      enrollment_id: enrollment.id,
      lesson_id: lessonId,
      cal_booking_id: booking.id,
      cal_booking_start: booking.start,
      status: "booked",
    });

  if (insertErr) {
    return NextResponse.json({ error: "Failed to save booking" }, { status: 500 });
  }

  return NextResponse.json({
    booking: {
      id: booking.id,
      start: booking.start,
      attendeeName: booking.attendeeName,
      attendeeEmail: booking.attendeeEmail,
    },
  });
}
