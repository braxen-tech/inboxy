import { Mux } from "@mux/mux-node";

function getMuxClient(): Mux {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) throw new Error("MUX_TOKEN_ID e MUX_TOKEN_SECRET não configurados");
  return new Mux({ tokenId, tokenSecret });
}

export interface MuxDirectUploadResult {
  uploadId: string;
  uploadUrl: string;
}

export async function createMuxDirectUpload(corsOrigin: string): Promise<MuxDirectUploadResult> {
  const mux = getMuxClient();
  const upload = await mux.video.uploads.create({
    new_asset_settings: {
      playback_policy: ["signed"],
      mp4_support: "none",
    },
    cors_origin: corsOrigin,
  });
  if (!upload.url) throw new Error("MUX não retornou URL de upload");
  return { uploadId: upload.id, uploadUrl: upload.url };
}

export interface MuxSignedTokenInput {
  playbackId: string;
  type?: "video" | "thumbnail" | "storyboard";
  expirationSeconds?: number;
}

export async function createMuxSignedToken(input: MuxSignedTokenInput): Promise<string> {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) throw new Error("MUX credentials not configured");

  const signingKey = process.env.MUX_SIGNING_KEY_ID;
  const privateKey = process.env.MUX_SIGNING_PRIVATE_KEY;
  if (!signingKey || !privateKey) throw new Error("MUX_SIGNING_KEY_ID e MUX_SIGNING_PRIVATE_KEY não configurados");

  const expSeconds = input.expirationSeconds ?? 3600;
  const mux = new Mux({ tokenId, tokenSecret, jwtSigningKey: signingKey, jwtPrivateKey: privateKey });

  return mux.jwt.signPlaybackId(input.playbackId, {
    type: input.type ?? "video",
    expiration: `${expSeconds}s`,
  });
}

export async function getMuxUpload(uploadId: string) {
  const mux = getMuxClient();
  return mux.video.uploads.retrieve(uploadId);
}
