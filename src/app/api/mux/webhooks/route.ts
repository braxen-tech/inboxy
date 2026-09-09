import { NextResponse } from "next/server";
import { Mux } from "@mux/mux-node";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { logger } from "@/lib/logger";

function getMuxForWebhooks(): Mux {
  const tokenId = process.env.MUX_TOKEN_ID ?? "";
  const tokenSecret = process.env.MUX_TOKEN_SECRET ?? "";
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  return new Mux({ tokenId, tokenSecret, webhookSecret });
}

export async function POST(request: Request) {
  const body = await request.text();

  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  if (webhookSecret) {
    try {
      const mux = getMuxForWebhooks();
      mux.webhooks.verifySignature(body, request.headers, webhookSecret);
    } catch {
      logger.warn("MUX webhook: invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(body) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getAdminClient();

  logger.info("MUX webhook received", { type: event.type });

  if (event.type === "video.upload.asset_created") {
    const uploadId = event.data.id as string;
    const assetId = event.data.asset_id as string;
    if (uploadId && assetId) {
      await db
        .from("course_lessons")
        .update({ mux_asset_id: assetId, mux_upload_status: "asset_created", updated_at: new Date().toISOString() })
        .eq("mux_upload_id", uploadId);
      logger.info("MUX webhook: asset created", { uploadId, assetId });
    }
  }

  if (event.type === "video.asset.ready") {
    const assetId = event.data.id as string;
    const playbackIds = event.data.playback_ids as { id: string; policy: string }[] | undefined;
    const playbackId = playbackIds?.[0]?.id;
    const duration = Math.round((event.data.duration as number | undefined) ?? 0);

    if (assetId) {
      const updateData = {
        mux_playback_id: playbackId ?? null,
        mux_upload_status: "ready" as const,
        duration_seconds: duration || null,
        updated_at: new Date().toISOString(),
      };

      const { count } = await db
        .from("course_lessons")
        .update(updateData)
        .eq("mux_asset_id", assetId);

      // Fallback: if no row matched by mux_asset_id, try matching by live_stream_id
      // (handles race condition where video.asset.ready arrives before video.asset.live_stream_completed)
      if (count === 0) {
        const liveStreamId = event.data.live_stream_id as string | undefined;
        if (liveStreamId) {
          await db
            .from("course_lessons")
            .update({ ...updateData, mux_asset_id: assetId })
            .eq("mux_live_stream_id", liveStreamId);
          logger.info("MUX webhook: asset ready (fallback via live_stream_id)", { assetId, liveStreamId, playbackId });
        }
      } else {
        logger.info("MUX webhook: asset ready", { assetId, playbackId, duration });
      }
    }
  }

  if (event.type === "video.asset.errored") {
    const assetId = event.data.id as string;
    if (assetId) {
      await db
        .from("course_lessons")
        .update({ mux_upload_status: "errored", updated_at: new Date().toISOString() })
        .eq("mux_asset_id", assetId);
      logger.warn("MUX webhook: asset errored", { assetId });
    }
  }

  // --- Live Stream Events ---

  if (event.type === "video.live_stream.active") {
    const liveStreamId = event.data.id as string;
    if (liveStreamId) {
      await db
        .from("course_lessons")
        .update({ live_stream_status: "active", updated_at: new Date().toISOString() })
        .eq("mux_live_stream_id", liveStreamId);
      logger.info("MUX webhook: live stream active", { liveStreamId });
    }
  }

  if (event.type === "video.live_stream.idle") {
    const liveStreamId = event.data.id as string;
    if (liveStreamId) {
      await db
        .from("course_lessons")
        .update({ live_stream_status: "idle", updated_at: new Date().toISOString() })
        .eq("mux_live_stream_id", liveStreamId);
      logger.info("MUX webhook: live stream idle", { liveStreamId });
    }
  }

  if (event.type === "video.live_stream.disabled") {
    const liveStreamId = event.data.id as string;
    if (liveStreamId) {
      await db
        .from("course_lessons")
        .update({ live_stream_status: "disabled", updated_at: new Date().toISOString() })
        .eq("mux_live_stream_id", liveStreamId);
      logger.info("MUX webhook: live stream disabled", { liveStreamId });
    }
  }

  if (event.type === "video.asset.live_stream_completed") {
    const assetId = event.data.id as string;
    const liveStreamId = event.data.live_stream_id as string;
    if (assetId && liveStreamId) {
      await db
        .from("course_lessons")
        .update({ mux_asset_id: assetId, updated_at: new Date().toISOString() })
        .eq("mux_live_stream_id", liveStreamId);
      logger.info("MUX webhook: live stream asset completed", { assetId, liveStreamId });
    }
  }

  return NextResponse.json({ status: "ok" });
}
