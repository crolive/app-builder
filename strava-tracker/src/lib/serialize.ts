import type { Activity, ConnectionStatus, User } from "@prisma/client";

// Client-facing shapes. Deliberately omit accessToken/refreshToken/
// tokenExpiresAt — those must never reach the browser (see Acceptance
// Criteria: tokens never exposed in any client-facing API response or page).

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  connectionStatus: ConnectionStatus;
}

export interface PublicActivity {
  id: string;
  userId: string;
  source: "strava" | "manual";
  type: string;
  title: string;
  distanceMiles: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  startDate: string;
  stravaActivityId: string | null;
  user: PublicUser;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profilePhotoUrl: user.profilePhotoUrl,
    connectionStatus: user.connectionStatus,
  };
}

export function toPublicActivity(activity: Activity & { user: User }): PublicActivity {
  return {
    id: activity.id,
    userId: activity.userId,
    source: activity.source,
    type: activity.type,
    title: activity.title,
    distanceMiles: activity.distanceMiles,
    movingTimeSeconds: activity.movingTimeSeconds,
    elapsedTimeSeconds: activity.elapsedTimeSeconds,
    startDate: activity.startDate.toISOString(),
    stravaActivityId: activity.stravaActivityId,
    user: toPublicUser(activity.user),
  };
}
