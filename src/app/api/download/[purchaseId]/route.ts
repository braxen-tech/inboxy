import { NextResponse } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { logger } from "@/lib/logger";

const BUCKET = "digital-products";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ purchaseId: string }> },
) {
  const { purchaseId } = await params;
  const db = getAdminClient();

  const { data: purchase } = await db
    .from("digital_product_purchases")
    .select("id, status, product_id, buyer_email, download_count, last_downloaded_at")
    .eq("id", purchaseId)
    .maybeSingle();

  if (!purchase) {
    return NextResponse.json({ error: "Compra não encontrada." }, { status: 404 });
  }

  if (purchase.status !== "active") {
    return NextResponse.json({ error: "Acesso não ativo para esta compra." }, { status: 403 });
  }

  const { data: product } = await db
    .from("digital_products")
    .select("file_path, file_name, active")
    .eq("id", purchase.product_id)
    .maybeSingle();

  if (!product || !product.active) {
    return NextResponse.json({ error: "Produto não disponível." }, { status: 404 });
  }

  const { data: signedData, error: signError } = await db.storage
    .from(BUCKET)
    .createSignedUrl(product.file_path, SIGNED_URL_TTL_SECONDS, {
      download: product.file_name,
    });

  if (signError || !signedData?.signedUrl) {
    logger.error("Download: failed to create signed URL", {
      purchaseId,
      filePath: product.file_path,
      error: signError?.message,
    });
    return NextResponse.json({ error: "Erro ao gerar link de download." }, { status: 500 });
  }

  await db
    .from("digital_product_purchases")
    .update({
      download_count: (purchase.download_count ?? 0) + 1,
      last_downloaded_at: new Date().toISOString(),
    })
    .eq("id", purchaseId);

  logger.info("Digital product download served", {
    purchaseId,
    productId: purchase.product_id,
    buyerEmail: purchase.buyer_email,
  });

  return NextResponse.redirect(signedData.signedUrl);
}
