import { NextRequest, NextResponse } from "next/server";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

const STORE_IMAGES_BUCKET = "store-images";

export async function POST(req: NextRequest) {
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json();
  const { orgSlug, filename, contentType } = body as { orgSlug: string; filename: string; contentType: string };

  if (!orgSlug || !filename || !contentType) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (!org) return NextResponse.json({ error: "Org não encontrada." }, { status: 404 });

  const ext = filename.split(".").pop() ?? "jpg";
  const path = `${org.id}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(STORE_IMAGES_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: "Erro ao gerar URL de upload." }, { status: 500 });
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${STORE_IMAGES_BUCKET}/${path}`;

  return NextResponse.json({ signedUrl: data.signedUrl, publicUrl, path });
}
