// Reads and parses the single, app-wide activity cutoff date (APP_CUTOFF_DATE).
// Activities dated before this instant are excluded, at the query level, from
// the feed and leaderboard. Parsing is intentionally independent of
// APP_TIMEZONE — see .env.example for details on the resulting imprecision.

export function getActivityCutoffDate(): Date | null {
  const raw = process.env.APP_CUTOFF_DATE;
  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    console.warn(`Ignoring invalid APP_CUTOFF_DATE value: ${JSON.stringify(raw)}`);
    return null;
  }

  return date;
}
