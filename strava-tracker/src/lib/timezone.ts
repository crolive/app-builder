// Pure timezone-window math used by the leaderboard. All boundaries are
// computed against a single, application-wide IANA timezone (APP_TIMEZONE),
// never the viewer's or an activity-owner's local timezone. Calendar-based
// boundaries are used: "1 day" = since the start of today (app timezone),
// "1 week" = since the start of the current week (Monday, app timezone),
// "1 month" = since the start of the current calendar month (app timezone).
// Implemented with the built-in Intl API only, no date library dependency.

export type LeaderboardWindow = "1d" | "1w" | "1m" | "all";

export interface WindowRange {
  start: Date | null;
  end: Date;
}

function getZonedParts(date: Date, timeZone: string): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return map;
}

function zonedOffsetMinutes(date: Date, timeZone: string): number {
  const map = getZonedParts(date, timeZone);
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return (asUTC - date.getTime()) / 60000;
}

function startOfDayInZone(date: Date, timeZone: string): Date {
  const map = getZonedParts(date, timeZone);
  const y = Number(map.year);
  const m = Number(map.month);
  const d = Number(map.day);
  const guessUTC = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offset = zonedOffsetMinutes(new Date(guessUTC), timeZone);
  return new Date(guessUTC - offset * 60000);
}

function startOfMonthInZone(date: Date, timeZone: string): Date {
  const map = getZonedParts(date, timeZone);
  const y = Number(map.year);
  const m = Number(map.month);
  const guessUTC = Date.UTC(y, m - 1, 1, 0, 0, 0);
  const offset = zonedOffsetMinutes(new Date(guessUTC), timeZone);
  return new Date(guessUTC - offset * 60000);
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export function getLeaderboardWindowRange(
  window: LeaderboardWindow,
  timeZone: string,
  now: Date = new Date()
): WindowRange {
  const end = now;

  if (window === "all") {
    return { start: null, end };
  }

  const todayStart = startOfDayInZone(now, timeZone);

  if (window === "1d") {
    return { start: todayStart, end };
  }

  if (window === "1w") {
    const map = getZonedParts(now, timeZone);
    const daysSinceMonday = WEEKDAY_INDEX[map.weekday] ?? 0;
    const weekStart = new Date(todayStart.getTime() - daysSinceMonday * 86400000);
    return { start: weekStart, end };
  }

  // "1m"
  const monthStart = startOfMonthInZone(now, timeZone);
  return { start: monthStart, end };
}
