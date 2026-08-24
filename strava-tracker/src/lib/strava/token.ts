// Lazy, on-demand token refresh (Feature 3 / 4). Called immediately before
// any Strava API call made on a user's behalf (webhook processing,
// backfill) — never via a separate scheduled job.

import { prisma } from "@/lib/prisma";
import { refreshStravaToken, StravaAuthError } from "./client";
import type { User } from "@prisma/client";

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutes

export class UserDisconnectedError extends Error {
  constructor(userId: string) {
    super(`User ${userId} is disconnected; sync is paused until they re-authorize`);
    this.name = "UserDisconnectedError";
  }
}

/**
 * Ensures the given user has a valid, non-expiring-soon access token,
 * refreshing it via the stored refresh token if necessary. Returns the
 * access token to use. If the user is already DISCONNECTED, no refresh is
 * attempted (sync stays stopped until a fresh login re-authorizes them). If
 * a refresh attempt fails with an auth error, the user is marked
 * DISCONNECTED and the error propagates so the caller can stop processing.
 */
export async function ensureFreshAccessToken(user: User): Promise<string> {
  if (user.connectionStatus === "DISCONNECTED") {
    throw new UserDisconnectedError(user.id);
  }

  const needsRefresh =
    !user.accessToken ||
    !user.tokenExpiresAt ||
    user.tokenExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;

  if (!needsRefresh) {
    return user.accessToken as string;
  }

  if (!user.refreshToken) {
    await prisma.user.update({
      where: { id: user.id },
      data: { connectionStatus: "DISCONNECTED" },
    });
    throw new UserDisconnectedError(user.id);
  }

  try {
    const refreshed = await refreshStravaToken(user.refreshToken);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        tokenExpiresAt: new Date(refreshed.expires_at * 1000),
      },
    });
    return refreshed.access_token;
  } catch (err) {
    if (err instanceof StravaAuthError) {
      await prisma.user.update({
        where: { id: user.id },
        data: { connectionStatus: "DISCONNECTED" },
      });
      throw new UserDisconnectedError(user.id);
    }
    throw err;
  }
}
