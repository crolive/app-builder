export const KUDOS_GLYPH = "👍";

export const MANUAL_ACTIVITY_TYPES = [
  "Run",
  "Ride",
  "Walk",
  "Hike",
  "Swim",
  "Weight Training",
  "Yoga",
  "Other",
] as const;

export type ManualActivityType = (typeof MANUAL_ACTIVITY_TYPES)[number];

export function isManualActivityType(value: string): value is ManualActivityType {
  return (MANUAL_ACTIVITY_TYPES as readonly string[]).includes(value);
}

// Maps Strava's raw sport_type/type strings to their closest matching
// manual category. Best-effort grouping based on Strava's sport_type
// taxonomy; unmapped keys are not listed here and fall through to "Other".
export const STRAVA_TYPE_TO_MANUAL_CATEGORY: Record<string, ManualActivityType> = {
  // Run family
  Run: "Run",
  TrailRun: "Run",
  VirtualRun: "Run",
  // Ride family
  Ride: "Ride",
  MountainBikeRide: "Ride",
  GravelRide: "Ride",
  EBikeRide: "Ride",
  EMountainBikeRide: "Ride",
  VirtualRide: "Ride",
  Handcycle: "Ride",
  Velomobile: "Ride",
  // Walk
  Walk: "Walk",
  // Hike
  Hike: "Hike",
  // Swim
  Swim: "Swim",
  // Weight Training family
  WeightTraining: "Weight Training",
  Workout: "Weight Training",
  Crossfit: "Weight Training",
  HighIntensityIntervalTraining: "Weight Training",
  // Yoga
  Yoga: "Yoga",
  Pilates: "Yoga",
};

// Pure function. Normalizes any activity type string — whether it's
// already an exact manual category (source = "manual") or a raw Strava
// sport_type/type string (source = "strava") — into one of the 8 fixed
// ManualActivityType categories. Never throws; unrecognized input maps
// to "Other".
export function normalizeActivityType(rawType: string): ManualActivityType {
  if (isManualActivityType(rawType)) return rawType;
  return STRAVA_TYPE_TO_MANUAL_CATEGORY[rawType] ?? "Other";
}
