// Pure leaderboard aggregation. Deliberately does not branch on `source` —
// Strava and manual activities are functionally identical once stored, per
// spec. Only cosmetic badges elsewhere in the UI distinguish source.

import { getLeaderboardWindowRange, LeaderboardWindow } from "./timezone";

export type LeaderboardMetric = "time" | "distance" | "count";

export interface LeaderboardActivityInput {
  userId: string;
  distanceMiles: number;
  movingTimeSeconds: number;
  startDate: Date;
}

export interface LeaderboardEntry {
  userId: string;
  totalDistanceMiles: number;
  totalTimeSeconds: number;
  activityCount: number;
}

export function filterActivitiesByWindow(
  activities: LeaderboardActivityInput[],
  window: LeaderboardWindow,
  timeZone: string,
  now: Date = new Date()
): LeaderboardActivityInput[] {
  const { start, end } = getLeaderboardWindowRange(window, timeZone, now);
  return activities.filter((a) => {
    if (a.startDate > end) return false;
    if (start && a.startDate < start) return false;
    return true;
  });
}

export function computeLeaderboard(
  activities: LeaderboardActivityInput[],
  userIds: string[]
): LeaderboardEntry[] {
  const entries = new Map<string, LeaderboardEntry>();
  for (const id of userIds) {
    entries.set(id, { userId: id, totalDistanceMiles: 0, totalTimeSeconds: 0, activityCount: 0 });
  }
  for (const activity of activities) {
    const entry = entries.get(activity.userId);
    if (!entry) continue;
    entry.totalDistanceMiles += activity.distanceMiles;
    entry.totalTimeSeconds += activity.movingTimeSeconds;
    entry.activityCount += 1;
  }
  return Array.from(entries.values());
}

function metricValue(entry: LeaderboardEntry, metric: LeaderboardMetric): number {
  switch (metric) {
    case "time":
      return entry.totalTimeSeconds;
    case "distance":
      return entry.totalDistanceMiles;
    case "count":
      return entry.activityCount;
  }
}

export function sortLeaderboard(
  entries: LeaderboardEntry[],
  metric: LeaderboardMetric
): LeaderboardEntry[] {
  return [...entries].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
}

export function buildLeaderboard(
  activities: LeaderboardActivityInput[],
  userIds: string[],
  metric: LeaderboardMetric,
  window: LeaderboardWindow,
  timeZone: string,
  now: Date = new Date()
): LeaderboardEntry[] {
  const windowed = filterActivitiesByWindow(activities, window, timeZone, now);
  const entries = computeLeaderboard(windowed, userIds);
  return sortLeaderboard(entries, metric);
}
