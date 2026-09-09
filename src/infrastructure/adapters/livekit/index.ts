import { AccessToken, EgressClient, StreamOutput, StreamProtocol } from "livekit-server-sdk";

function getConfig() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !wsUrl) {
    throw new Error("LIVEKIT_API_KEY, LIVEKIT_API_SECRET e LIVEKIT_URL não configurados");
  }
  return { apiKey, apiSecret, wsUrl };
}

export async function createLiveKitToken(
  roomName: string,
  participantName: string,
  isPublisher: boolean,
): Promise<{ token: string; wsUrl: string }> {
  const { apiKey, apiSecret, wsUrl } = getConfig();

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    ttl: "6h",
  });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: isPublisher,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return { token, wsUrl };
}

export interface EgressResult {
  egressId: string;
}

export async function startLiveKitEgress(
  roomName: string,
  muxStreamKey: string,
): Promise<EgressResult> {
  const { apiKey, apiSecret, wsUrl } = getConfig();
  const httpUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");

  const egressClient = new EgressClient(httpUrl, apiKey, apiSecret);

  const output = new StreamOutput({
    protocol: StreamProtocol.RTMP,
    urls: [`mux://${muxStreamKey}`],
  });

  const egress = await egressClient.startRoomCompositeEgress(roomName, output);

  return { egressId: egress.egressId };
}

export async function stopLiveKitEgress(egressId: string): Promise<void> {
  const { apiKey, apiSecret, wsUrl } = getConfig();
  const httpUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");

  const egressClient = new EgressClient(httpUrl, apiKey, apiSecret);
  await egressClient.stopEgress(egressId);
}
