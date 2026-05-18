import { NextResponse } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    const db = getAdminClient();
    const { error } = await db.from("organizations").select("id").limit(1);
    checks.supabase = error ? "error" : "ok";
  } catch {
    checks.supabase = "error";
  }

  checks.env = process.env.ANTHROPIC_API_KEY ? "ok" : "error";

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", checks },
    { status: allOk ? 200 : 503 },
  );
}
