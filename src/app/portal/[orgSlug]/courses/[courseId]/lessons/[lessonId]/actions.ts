"use server";

import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { revalidatePath } from "next/cache";

export async function markLessonComplete(enrollmentId: string, lessonId: string) {
  const db = getAdminClient();
  await db.from("lesson_progress").upsert(
    {
      enrollment_id: enrollmentId,
      lesson_id: lessonId,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "enrollment_id,lesson_id" },
  );

  // Revalidate the course overview so progress checkmarks update
  revalidatePath("/portal/[orgSlug]/courses/[courseId]", "page");
}
