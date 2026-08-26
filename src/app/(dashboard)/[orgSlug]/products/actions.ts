"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getOrgBySlug } from "@/lib/get-org";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const BUCKET = "digital-products";

const createProductSchema = z.object({
  orgSlug: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  priceBrl: z.coerce.number().min(0).max(999999),
  paymentType: z.enum(["one_time", "recurring"]).default("one_time"),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
});

export async function createDigitalProduct(formData: FormData) {
  scheduleTelemetryFlush();

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const raw = Object.fromEntries(formData.entries());
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) return { error: "Selecione um arquivo." };
  if (file.size > 100 * 1024 * 1024) return { error: "Arquivo deve ter no máximo 100 MB." };

  const parsed = createProductSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos. Verifique os campos." };

  const { orgSlug, title, description, priceBrl, paymentType, billingCycle } = parsed.data;

  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "Organização não encontrada." };

  const db = getAdminClient();

  const ext = file.name.split(".").pop() ?? "";
  const storagePath = `${org.id}/${randomUUID()}/${file.name}`;

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return { error: `Erro ao enviar arquivo: ${uploadError.message}` };
  }

  const { error: insertError } = await db.from("digital_products").insert({
    organization_id: org.id,
    title,
    description: description || null,
    file_path: storagePath,
    file_name: file.name,
    file_size_bytes: file.size,
    content_type: file.type || null,
    price_brl: priceBrl,
    payment_type: paymentType,
    billing_cycle: billingCycle ?? null,
  });

  if (insertError) {
    await db.storage.from(BUCKET).remove([storagePath]);
    return { error: `Erro ao salvar produto: ${insertError.message}` };
  }

  revalidatePath(`/${orgSlug}/products`);
  return { success: true as const };
}

export async function deleteDigitalProduct(orgSlug: string, productId: string) {
  scheduleTelemetryFlush();

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const db = getAdminClient();

  const { data: product } = await db
    .from("digital_products")
    .select("file_path, organization_id")
    .eq("id", productId)
    .maybeSingle();

  if (!product) return { error: "Produto não encontrado." };

  await db.storage.from(BUCKET).remove([product.file_path]);

  await db.from("digital_products").delete().eq("id", productId);

  revalidatePath(`/${orgSlug}/products`);
  return { success: true as const };
}
