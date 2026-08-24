import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processWebhookPayload, type StravaWebhookPayload } from "@/lib/strava/webhook";

// Strava's subscription validation handshake: echoes back hub.challenge.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  await prisma.webhookEvent.create({
    data: {
      objectType: "validation",
      rawPayload: Object.fromEntries(searchParams.entries()),
    },
  });

  if (mode === "subscribe" && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN && challenge) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "Webhook validation failed" }, { status: 403 });
}

// Receives activity/athlete event payloads (Feature 5).
export async function POST(req: NextRequest) {
  const payload = (await req.json()) as StravaWebhookPayload;

  await prisma.webhookEvent.create({
    data: {
      objectType: payload.object_type ?? null,
      objectId: payload.object_id != null ? String(payload.object_id) : null,
      aspectType: payload.aspect_type ?? null,
      ownerId: payload.owner_id != null ? String(payload.owner_id) : null,
      subscriptionId: payload.subscription_id != null ? String(payload.subscription_id) : null,
      eventTime: payload.event_time ? new Date(payload.event_time * 1000) : null,
      rawPayload: payload as unknown as object,
    },
  });

  try {
    await processWebhookPayload(payload);
  } catch (err) {
    // Never crash or alert on processing failure (Feature 4) — log and
    // still return 200 so Strava does not retry indefinitely.
    console.error("Failed to process Strava webhook payload:", err);
  }

  return NextResponse.json({ ok: true });
}
