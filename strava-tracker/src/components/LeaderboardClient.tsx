"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Avatar from "./Avatar";
import Badge from "./Badge";
import BottomActionBar from "./BottomActionBar";
import ManualEntryModal from "./ManualEntryModal";
import { buildLeaderboard, type LeaderboardMetric } from "@/lib/leaderboard";
import type { LeaderboardWindow } from "@/lib/timezone";
import { formatMiles, formatSecondsToHours } from "@/lib/units";
import type { PublicActivity, PublicUser } from "@/lib/serialize";

const METRICS: { value: LeaderboardMetric; label: string }[] = [
  { value: "distance", label: "Total Distance" },
  { value: "time", label: "Total Time" },
  { value: "count", label: "Activity Count" },
];

const WINDOWS: { value: LeaderboardWindow; label: string }[] = [
  { value: "1d", label: "1 Day" },
  { value: "1w", label: "1 Week" },
  { value: "1m", label: "1 Month" },
  { value: "all", label: "All Time" },
];

export default function LeaderboardClient({
  activities,
  users,
  timeZone,
}: {
  activities: PublicActivity[];
  users: PublicUser[];
  timeZone: string;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [metric, setMetric] = useState<LeaderboardMetric>("distance");
  const [window, setWindow] = useState<LeaderboardWindow>("all");
  const [modalOpen, setModalOpen] = useState(false);

  function handleSaved() {
    router.refresh();
  }

  const parsedActivities = useMemo(
    () =>
      activities.map((a) => ({
        userId: a.userId,
        distanceMiles: a.distanceMiles,
        movingTimeSeconds: a.movingTimeSeconds,
        startDate: new Date(a.startDate),
      })),
    [activities]
  );

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const entries = useMemo(
    () =>
      buildLeaderboard(
        parsedActivities,
        users.map((u) => u.id),
        metric,
        window,
        timeZone
      ),
    [parsedActivities, users, metric, window, timeZone]
  );

  function metricDisplay(value: number): string {
    if (metric === "distance") return `${formatMiles(value)} mi`;
    if (metric === "time") return `${formatSecondsToHours(value)} hrs`;
    return String(value);
  }

  return (
    <div className="container-app py-6">
      <h1 className="mb-6 font-display text-2xl font-extrabold uppercase tracking-tight text-text-primary">
        Leaderboard
      </h1>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMetric(m.value)}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-widest transition ${
                metric === m.value
                  ? "border-accent-positive/50 bg-accent-positive/10 text-text-primary"
                  : "border-border text-text-tertiary hover:text-text-primary"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              onClick={() => setWindow(w.value)}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-widest transition ${
                window === w.value
                  ? "border-accent-positive/50 bg-accent-positive/10 text-text-primary"
                  : "border-border text-text-tertiary hover:text-text-primary"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-panel">
        {entries.length === 0 ? (
          <p className="p-4 font-body text-sm text-text-secondary">No members yet.</p>
        ) : (
          entries.map((entry, index) => {
            const user = usersById.get(entry.userId);
            if (!user) return null;
            return (
              <div
                key={entry.userId}
                className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 font-display text-lg font-extrabold text-text-tertiary">
                    {index + 1}
                  </span>
                  <Avatar
                    id={user.id}
                    firstName={user.firstName}
                    lastName={user.lastName}
                    photoUrl={user.profilePhotoUrl}
                  />
                  <div>
                    <p className="font-body text-sm font-medium text-text-primary">
                      {user.firstName} {user.lastName}
                    </p>
                    {user.connectionStatus === "DISCONNECTED" && (
                      <Badge variant="disconnected">Disconnected</Badge>
                    )}
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-accent-positive">
                  {metricDisplay(
                    metric === "distance"
                      ? entry.totalDistanceMiles
                      : metric === "time"
                      ? entry.totalTimeSeconds
                      : entry.activityCount
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      {session?.user && (
        <BottomActionBar
          userId={session.user.id}
          firstName={session.user.name?.split(" ")[0] ?? ""}
          lastName={session.user.name?.split(" ").slice(1).join(" ") ?? ""}
          photoUrl={session.user.image}
          connectionStatus={session.user.connectionStatus}
          onAdd={() => setModalOpen(true)}
        />
      )}

      <ManualEntryModal
        open={modalOpen}
        editingActivity={null}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
