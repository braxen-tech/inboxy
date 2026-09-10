"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getOrgBySlug } from "@/lib/get-org";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const BUCKET = "course-thumbnails";

const createMentoringSchema = z.object({
  orgSlug: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  priceBrl: z.coerce.number().min(0).max(999999),
  bookingQuota: z.coerce.number().int().min(1).max(100).optional().default(1),
});

export async function createMentoring(formData: FormData) {
  scheduleTelemetryFlush();

  const raw = Object.fromEntries(formData.entries());
  const parsed = createMentoringSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const { orgSlug, title, description, priceBrl, bookingQuota } = parsed.data;

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "Organização não encontrada." };

  const db = getAdminClient();

  // Upload thumbnail if provided
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

  // Create course
  const { data: course, error: courseErr } = await db
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

  if (courseErr || !course) return { error: `Erro ao criar mentoria: ${courseErr?.message}` };

  // Create default module
  const { data: mod, error: modErr } = await db
    .from("course_modules")
    .insert({
      course_id: course.id,
      title: "Sessões",
      position: 0,
      published: true,
    })
    .select("id")
    .single();

  if (modErr || !mod) return { error: `Erro ao criar módulo: ${modErr?.message}` };

  // Create mentoring lesson using org's cal_event_type_id
  const { error: lessonErr } = await db
    .from("course_lessons")
    .insert({
      module_id: mod.id,
      title,
      position: 0,
      lesson_type: "mentoring",
      cal_event_type_id: org.cal_event_type_id ?? null,
      booking_quota: bookingQuota,
      published: true,
    });

  if (lessonErr) return { error: `Erro ao criar aula: ${lessonErr.message}` };

  redirect(`/${orgSlug}/courses/${course.id}`);
}

export async function deleteMentoring(orgSlug: string, courseId: string) {
  scheduleTelemetryFlush();

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "Organização não encontrada." };

  const db = getAdminClient();
  await db.from("courses").delete().eq("id", courseId).eq("organization_id", org.id);
  revalidatePath(`/${orgSlug}/mentoring`);
  return { success: true as const };
}
