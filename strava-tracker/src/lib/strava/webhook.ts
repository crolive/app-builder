// Webhook event processing (Feature 5). The raw payload is always persisted
// to WebhookEvent by the API route before these handlers run; these handlers
// perform the follow-up sync work and are tolerant of individual failures
// (a failure here must never crash the request or alert anyone — Feature 4).

import { prisma } from "@/lib/prisma";
import { metersToMiles } from "@/lib/units";
import { ensureFreshAccessToken, UserDisconnectedError } from "./token";
import { fetchActivityById } from "./client";

export interface StravaWebhookPayload {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  subscription_id?: number;
  event_time?: number;
  updates?: Record<string, string>;
}

export async function handleActivityUpsert(payload: StravaWebhookPayload): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { stravaAthleteId: String(payload.owner_id) },
  });
  if (!user) return;

  let accessToken: string;
  try {
    accessToken = await ensureFreshAccessToken(user);
  } catch (err) {
    if (err instanceof UserDisconnectedError) return;
    throw err;
  }

  const activity = await fetchActivityById(accessToken, payload.object_id);
  const data = {
    userId: user.id,
    source: "strava" as const,
    stravaActivityId: String(activity.id),
    type: activity.sport_type ?? activity.type,
    title: activity.name,
    distanceMiles: metersToMiles(activity.distance),
    movingTimeSeconds: Math.round(activity.moving_time),
    elapsedTimeSeconds: Math.round(activity.elapsed_time),
    startDate: new Date(activity.start_date),
  };

  await prisma.activity.upsert({
    where: { stravaActivityId: data.stravaActivityId },
    create: data,
    update: data,
  });
}

export async function handleActivityDelete(payload: StravaWebhookPayload): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { stravaAthleteId: String(payload.owner_id) },
  });
  if (!user) return;

  await prisma.activity.deleteMany({
    where: {
      stravaActivityId: String(payload.object_id),
      userId: user.id,
    },
  });
}

export async function handleAthleteDeauthorization(payload: StravaWebhookPayload): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { stravaAthleteId: String(payload.owner_id) },
  });
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { connectionStatus: "DISCONNECTED" },
  });
}

export async function processWebhookPayload(payload: StravaWebhookPayload): Promise<void> {
  if (payload.object_type === "activity") {
    if (payload.aspect_type === "delete") {
      await handleActivityDelete(payload);
    } else {
      await handleActivityUpsert(payload);
    }
  } else if (payload.object_type === "athlete") {
    if (payload.updates?.authorized === "false") {
      await handleAthleteDeauthorization(payload);
    }
  }
}
