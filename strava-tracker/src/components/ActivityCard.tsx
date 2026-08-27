import Avatar from "./Avatar";
import Badge from "./Badge";
import {
  formatMiles,
  formatSecondsToDuration,
  computeAveragePaceSecondsPerMile,
  formatPace,
  isPaceEligible,
} from "@/lib/units";
import type { PublicActivity } from "@/lib/serialize";

export default function ActivityCard({
  activity,
  canEdit,
  onEdit,
}: {
  activity: PublicActivity;
  canEdit: boolean;
  onEdit?: (activity: PublicActivity) => void;
}) {
  const stripeColor = activity.source === "strava" ? "bg-accent-positive" : "bg-text-tertiary";
  const startDate = new Date(activity.startDate);
  const pace = isPaceEligible(activity.source, activity.type)
    ? computeAveragePaceSecondsPerMile(activity.distanceMiles, activity.movingTimeSeconds)
    : null;

  return (
    <div className="group relative overflow-hidden rounded-card border border-border bg-panel transition duration-150 hover:-translate-y-1 hover:border-border-strong hover:shadow-lift">
      <div className={`h-1 w-full ${stripeColor}`} />
      <div className="flex items-start gap-3 p-4">
        <Avatar
          id={activity.user.id}
          firstName={activity.user.firstName}
          lastName={activity.user.lastName}
          photoUrl={activity.user.profilePhotoUrl}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-sm font-medium text-text-primary">
              {activity.user.firstName} {activity.user.lastName}
            </span>
            {activity.user.connectionStatus === "DISCONNECTED" && (
              <Badge variant="disconnected">Disconnected</Badge>
            )}
            <Badge variant={activity.source === "strava" ? "strava" : "manual"}>
              {activity.source}
            </Badge>
          </div>
          <h3 className="mt-1 truncate font-display text-base font-bold uppercase tracking-tight text-text-primary">
            {activity.title}
          </h3>
          <p className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
            {activity.type}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-text-secondary">
            <span>{formatMiles(activity.distanceMiles)} mi</span>
            <span>{formatSecondsToDuration(activity.movingTimeSeconds)}</span>
            <span>{startDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
            {pace !== null && <span>{formatPace(pace)}</span>}
          </div>
        </div>

        {canEdit && (
          <button
            onClick={() => onEdit?.(activity)}
            className="shrink-0 rounded-full border border-border-strong px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition hover:border-accent-positive hover:text-accent-positive"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
