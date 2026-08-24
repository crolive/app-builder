// One-time historical backfill on first connect (Feature 6). Runs once per
// user, gated by User.hasCompletedBackfill.

import { prisma } from "@/lib/prisma";
import { metersToMiles } from "@/lib/units";
import { ensureFreshAccessToken } from "./token";
import { fetchAthleteActivities, type StravaActivity } from "./client";

const PER_PAGE = 100;
const MAX_PAGES = 20; // safety cap (2000 activities) to bound worst-case latency

export function mapStravaActivityToActivityData(activity: StravaActivity, userId: string) {
  return {
    userId,
    source: "strava" as const,
    stravaActivityId: String(activity.id),
    type: activity.sport_type ?? activity.type,
    title: activity.name,
    distanceMiles: metersToMiles(activity.distance),
    movingTimeSeconds: Math.round(activity.moving_time),
    elapsedTimeSeconds: Math.round(activity.elapsed_time),
    startDate: new Date(activity.start_date),
  };
}

export async function runBackfill(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const accessToken = await ensureFreshAccessToken(user);

  for (let page = 1; page <= MAX_PAGES; page++) {
    const activities = await fetchAthleteActivities(accessToken, { page, perPage: PER_PAGE });
    if (activities.length === 0) break;

    for (const activity of activities) {
      const data = mapStravaActivityToActivityData(activity, userId);
      await prisma.activity.upsert({
        where: { stravaActivityId: data.stravaActivityId },
        create: data,
        update: data,
      });
    }

    if (activities.length < PER_PAGE) break;
  }
}
