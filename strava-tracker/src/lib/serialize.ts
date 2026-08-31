import type { Activity, Comment, ConnectionStatus, Reaction, ReactionEmoji, User } from "@prisma/client";
import { REACTION_EMOJI_ORDER } from "@/lib/constants";

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

export interface PublicReactionSummary {
  emoji: ReactionEmoji;
  count: number;
  reactedByMe: boolean;
}

export interface PublicComment {
  id: string;
  activityId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: PublicUser;
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
  reactions: PublicReactionSummary[];
  commentCount: number;
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

export function toPublicComment(comment: Comment & { user: User }): PublicComment {
  return {
    id: comment.id,
    activityId: comment.activityId,
    userId: comment.userId,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    user: toPublicUser(comment.user),
  };
}

export function toPublicActivity(
  activity: Activity & {
    user: User;
    reactions?: Reaction[];
    _count?: { comments?: number };
  },
  currentUserId?: string | null
): PublicActivity {
  const reactions: PublicReactionSummary[] = REACTION_EMOJI_ORDER.map((emoji) => {
    if (!activity.reactions) {
      return { emoji, count: 0, reactedByMe: false };
    }
    const matching = activity.reactions.filter((r) => r.emoji === emoji);
    return {
      emoji,
      count: matching.length,
      reactedByMe: currentUserId != null && matching.some((r) => r.userId === currentUserId),
    };
  });

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
    reactions,
    commentCount: activity._count?.comments ?? 0,
  };
}
