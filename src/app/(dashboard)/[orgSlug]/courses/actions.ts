"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getOrgBySlug } from "@/lib/get-org";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

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

export async function createLesson(orgSlug: string, courseId: string, moduleId: string, title: string) {
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

  const { data: lesson, error } = await db
    .from("course_lessons")
    .insert({ module_id: moduleId, title, position: (last?.position ?? -1) + 1 })
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
  data: { title?: string; description?: string; isPreview?: boolean; published?: boolean; position?: number },
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
