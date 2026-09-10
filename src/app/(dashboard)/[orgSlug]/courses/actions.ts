"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getOrgBySlug } from "@/lib/get-org";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";
import { createMuxLiveStream } from "@/infrastructure/adapters/mux";

const BUCKET = "course-thumbnails";

const createCourseSchema = z.object({
  orgSlug: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  priceBrl: z.coerce.number().min(0).max(999999),
});

async function getAuthenticatedOrg(orgSlug: string) {
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." } as const;

  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "Organização não encontrada." } as const;

  return { user, org, db: getAdminClient() } as const;
}

export async function createCourse(formData: FormData) {
  scheduleTelemetryFlush();

  const raw = Object.fromEntries(formData.entries());
  const parsed = createCourseSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const { orgSlug, title, description, priceBrl } = parsed.data;

  const result = await getAuthenticatedOrg(orgSlug);
  if ("error" in result) return result;
  const { org, db } = result;

  let thumbnailUrl: string | null = null;
  const thumbnailFile = formData.get("thumbnail") as File | null;
  if (thumbnailFile && thumbnailFile.size > 0) {
    if (thumbnailFile.size > 5 * 1024 * 1024) return { error: "Thumbnail deve ter no máximo 5 MB." };
    const ext = thumbnailFile.name.split(".").pop() ?? "jpg";
    const storagePath = `${org.id}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await thumbnailFile.arrayBuffer());
    const { error: uploadErr } = await db.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: thumbnailFile.type, upsert: false });
    if (uploadErr) return { error: `Erro ao enviar thumbnail: ${uploadErr.message}` };
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(storagePath);
    thumbnailUrl = pub.publicUrl;
  }

  const { data: course, error: insertErr } = await db
    .from("courses")
    .insert({
      organization_id: org.id,
      title,
      description: description || null,
      thumbnail_url: thumbnailUrl,
      price_brl: priceBrl,
      payment_type: "one_time",
      active: false,
    })
    .select("id")
    .single();

  if (insertErr || !course) return { error: `Erro ao salvar curso: ${insertErr?.message}` };

  redirect(`/${orgSlug}/courses/${course.id}`);
}

export async function updateCourse(orgSlug: string, courseId: string, data: { title?: string; description?: string; priceBrl?: number; active?: boolean }) {
  scheduleTelemetryFlush();
  const result = await getAuthenticatedOrg(orgSlug);
  if ("error" in result) return result;
  const { org, db } = result;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description || null;
  if (data.priceBrl !== undefined) update.price_brl = data.priceBrl;
  if (data.active !== undefined) update.active = data.active;

  await db.from("courses").update(update).eq("id", courseId).eq("organization_id", org.id);
  revalidatePath(`/${orgSlug}/courses/${courseId}`);
  return { success: true as const };
}

export async function deleteCourse(orgSlug: string, courseId: string) {
  scheduleTelemetryFlush();
  const result = await getAuthenticatedOrg(orgSlug);
  if ("error" in result) return result;
  const { org, db } = result;

  await db.from("courses").delete().eq("id", courseId).eq("organization_id", org.id);
  revalidatePath(`/${orgSlug}/courses`);
  return { success: true as const };
}

export async function createModule(orgSlug: string, courseId: string, title: string) {
  scheduleTelemetryFlush();
  const result = await getAuthenticatedOrg(orgSlug);
  if ("error" in result) return result;
  const { org, db } = result;

  const { data: last } = await db
    .from("course_modules")
    .select("position")
    .eq("course_id", courseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: mod, error } = await db
    .from("course_modules")
    .insert({ course_id: courseId, title, position: (last?.position ?? -1) + 1 })
    .select("id")
    .single();

  if (error || !mod) return { error: error?.message ?? "Erro ao criar módulo." };

  revalidatePath(`/${orgSlug}/courses/${courseId}`);
  return { success: true as const, id: mod.id };
}

export async function updateModule(orgSlug: string, moduleId: string, data: { title?: string; published?: boolean; position?: number }) {
  scheduleTelemetryFlush();
  const result = await getAuthenticatedOrg(orgSlug);
  if ("error" in result) return result;
  const { db } = result;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) update.title = data.title;
  if (data.published !== undefined) update.published = data.published;
  if (data.position !== undefined) update.position = data.position;

  await db.from("course_modules").update(update).eq("id", moduleId);
  return { success: true as const };
}

export async function deleteModule(orgSlug: string, courseId: string, moduleId: string) {
  scheduleTelemetryFlush();
  const result = await getAuthenticatedOrg(orgSlug);
  if ("error" in result) return result;
  const { db } = result;

  await db.from("course_modules").delete().eq("id", moduleId);
  revalidatePath(`/${orgSlug}/courses/${courseId}`);
  return { success: true as const };
}

export async function createLesson(
  orgSlug: string,
  courseId: string,
  moduleId: string,
  title: string,
  lessonType: "video" | "live" | "mentoring" = "video",
) {
  scheduleTelemetryFlush();
  const result = await getAuthenticatedOrg(orgSlug);
  if ("error" in result) return result;
  const { db } = result;

  const { data: last } = await db
    .from("course_lessons")
    .select("position")
    .eq("module_id", moduleId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const insertData: Record<string, unknown> = {
    module_id: moduleId,
    title,
    position: (last?.position ?? -1) + 1,
    lesson_type: lessonType,
  };

  if (lessonType === "live") {
    const liveStream = await createMuxLiveStream();
    insertData.mux_live_stream_id = liveStream.liveStreamId;
    insertData.mux_stream_key = liveStream.streamKey;
    insertData.mux_playback_id = liveStream.playbackId;
    insertData.live_stream_status = "idle";
  }

  const { data: lesson, error } = await db
    .from("course_lessons")
    .insert(insertData)
    .select("id")
    .single();

  if (error || !lesson) return { error: error?.message ?? "Erro ao criar aula." };

  revalidatePath(`/${orgSlug}/courses/${courseId}`);
  return { success: true as const, id: lesson.id };
}

export async function updateLesson(
  orgSlug: string,
  courseId: string,
  lessonId: string,
  data: { title?: string; description?: string; isPreview?: boolean; published?: boolean; position?: number; calEventTypeId?: string; bookingQuota?: number },
) {
  scheduleTelemetryFlush();
  const result = await getAuthenticatedOrg(orgSlug);
  if ("error" in result) return result;
  const { db } = result;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description || null;
  if (data.isPreview !== undefined) update.is_preview = data.isPreview;
  if (data.published !== undefined) update.published = data.published;
  if (data.position !== undefined) update.position = data.position;
  if (data.calEventTypeId !== undefined) update.cal_event_type_id = data.calEventTypeId || null;
  if (data.bookingQuota !== undefined) update.booking_quota = data.bookingQuota;

  await db.from("course_lessons").update(update).eq("id", lessonId);
  revalidatePath(`/${orgSlug}/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath(`/${orgSlug}/courses/${courseId}`);
  return { success: true as const };
}

export async function deleteLesson(orgSlug: string, courseId: string, lessonId: string) {
  scheduleTelemetryFlush();
  const result = await getAuthenticatedOrg(orgSlug);
  if ("error" in result) return result;
  const { db } = result;

  await db.from("course_lessons").delete().eq("id", lessonId);
  revalidatePath(`/${orgSlug}/courses/${courseId}`);
  return { success: true as const };
}

export async function scheduleLiveLesson(orgSlug: string, courseId: string, lessonId: string, scheduledAt: string) {
  scheduleTelemetryFlush();
  const result = await getAuthenticatedOrg(orgSlug);
  if ("error" in result) return result;
  const { db } = result;

  const date = new Date(scheduledAt);
  if (isNaN(date.getTime()) || date <= new Date()) {
    return { error: "Data de agendamento inválida." };
  }

  await db
    .from("course_lessons")
    .update({ scheduled_at: date.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", lessonId);

  // Fetch enrolled students and send notification
  const { data: lesson } = await db
    .from("course_lessons")
    .select("title")
    .eq("id", lessonId)
    .single();

  const { data: course } = await db
    .from("courses")
    .select("title, organization_id, organizations!inner(name, slug)")
    .eq("id", courseId)
    .single();

  if (lesson && course) {
    const { data: enrollments } = await db
      .from("course_enrollments")
      .select("buyer_email, buyer_name")
      .eq("course_id", courseId)
      .eq("status", "active");

    if (enrollments && enrollments.length > 0) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const orgData = Array.isArray(course.organizations) ? course.organizations[0] : course.organizations;
      const orgName = (orgData as { name: string; slug: string } | null)?.name ?? "Inboxy";
      const orgSlugValue = (orgData as { name: string; slug: string } | null)?.slug ?? orgSlug;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const courseUrl = `${appUrl}/portal/${orgSlugValue}/courses/${courseId}`;

      const dateFormatted = date.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      await Promise.allSettled(
        enrollments.map((enrollment) =>
          resend.emails.send({
            from: `${orgName} <noreply@${process.env.RESEND_DOMAIN ?? "inboxy.com.br"}>`,
            to: enrollment.buyer_email,
            subject: `Nova live agendada: ${lesson.title}`,
            html: `
              <p>Olá${enrollment.buyer_name ? `, ${enrollment.buyer_name}` : ""}!</p>
              <p>Uma nova aula ao vivo foi agendada no curso <strong>${course.title}</strong>.</p>
              <p><strong>Aula:</strong> ${lesson.title}<br>
              <strong>Data:</strong> ${dateFormatted}</p>
              <p>Não perca — a gravação ficará disponível depois, mas ao vivo você pode tirar suas dúvidas.</p>
              <p><a href="${courseUrl}">Acessar curso</a></p>
            `,
          }),
        ),
      );
    }
  }

  revalidatePath(`/${orgSlug}/courses/${courseId}`);
  return { success: true as const };
}

export async function resetLiveStream(orgSlug: string, courseId: string, lessonId: string) {
  scheduleTelemetryFlush();
  const result = await getAuthenticatedOrg(orgSlug);
  if ("error" in result) return result;
  const { db } = result;

  const liveStream = await createMuxLiveStream();

  await db
    .from("course_lessons")
    .update({
      mux_live_stream_id: liveStream.liveStreamId,
      mux_stream_key: liveStream.streamKey,
      mux_playback_id: liveStream.playbackId,
      live_stream_status: "idle",
      mux_asset_id: null,
      mux_upload_status: null,
      duration_seconds: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonId);

  revalidatePath(`/${orgSlug}/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath(`/${orgSlug}/courses/${courseId}`);
  return { success: true as const };
}
