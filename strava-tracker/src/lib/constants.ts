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
