// Pure unit-conversion / formatting helpers. Canonical storage unit for
// distance is miles regardless of source; Strava's meters are converted at
// ingestion time (see src/lib/strava/backfill.ts and webhook.ts), never at
// display time.

export const METERS_PER_MILE = 1609.344;

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function formatMiles(miles: number, decimals = 2): string {
  return miles.toFixed(decimals);
}

/**
 * Parses a human-friendly duration string ("HH:MM:SS", "MM:SS", or plain
 * seconds) into whole seconds.
 */
export function parseDurationToSeconds(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") {
    throw new Error("Duration is required");
  }
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.length > 3 || parts.some((p) => p === "" || !/^\d+$/.test(p))) {
    throw new Error("Invalid duration format. Use HH:MM:SS, MM:SS, or seconds.");
  }
  const numbers = parts.map((p) => Number(p));
  let seconds = 0;
  if (numbers.length === 3) {
    const [h, m, s] = numbers;
    seconds = h * 3600 + m * 60 + s;
  } else if (numbers.length === 2) {
    const [m, s] = numbers;
    seconds = m * 60 + s;
  } else {
    seconds = numbers[0];
  }
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error("Invalid duration");
  }
  return Math.round(seconds);
}

export function formatSecondsToDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = Math.floor(safeSeconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatSecondsToHours(totalSeconds: number, decimals = 1): string {
  return (totalSeconds / 3600).toFixed(decimals);
}

// Allow-list of Strava's raw sport_type/type strings that qualify as "Run" family.
// Exact, case-sensitive membership match only — no substring/prefix/regex matching.
export const STRAVA_RUN_TYPES = ["Run", "TrailRun", "VirtualRun"] as const;

/**
 * Pure computation of average pace in seconds per mile. Returns null when
 * pace should not be shown rather than throwing:
 * - movingTimeSeconds <= 0
 * - distanceMiles <= 0
 * - the computed result is not a finite number
 */
export function computeAveragePaceSecondsPerMile(
  distanceMiles: number,
  movingTimeSeconds: number
): number | null {
  if (movingTimeSeconds <= 0 || distanceMiles <= 0) {
    return null;
  }
  const pace = movingTimeSeconds / distanceMiles;
  return Number.isFinite(pace) ? pace : null;
}

/**
 * Formats a pace-in-seconds-per-mile value as "M:SS /mi" (e.g. "7:42 /mi").
 * No hours component, ever. Minutes may exceed 59 and print as the raw
 * integer minute count (e.g. "62:00 /mi"). Caller is responsible for only
 * calling this with a valid (non-null, finite, non-negative) pace value —
 * this function does not itself guard against invalid input.
 */
export function formatPace(paceSecondsPerMile: number): string {
  const totalSeconds = Math.round(paceSecondsPerMile);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")} /mi`;
}

/**
 * Determines whether an activity qualifies for pace display based on its
 * source and type. Eligibility is source-dependent: manual activities must
 * be exactly "Run"; Strava activities must be in STRAVA_RUN_TYPES.
 */
export function isPaceEligible(source: "strava" | "manual", type: string): boolean {
  if (source === "manual") {
    return type === "Run";
  }
  return (STRAVA_RUN_TYPES as readonly string[]).includes(type);
}
