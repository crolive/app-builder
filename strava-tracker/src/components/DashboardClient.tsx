"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ActivityCard from "./ActivityCard";
import PersonFilter from "./PersonFilter";
import TypeFilter from "./TypeFilter";
import BottomActionBar from "./BottomActionBar";
import ManualEntryModal from "./ManualEntryModal";
import type { PublicActivity, PublicUser } from "@/lib/serialize";
import { normalizeActivityType, type ManualActivityType } from "@/lib/constants";

export default function DashboardClient({
  activities,
  users,
}: {
  activities: PublicActivity[];
  users: PublicUser[];
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<ManualActivityType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<PublicActivity | null>(null);

  const visibleActivities = useMemo(() => {
    return activities.filter((a) => {
      const personMatch = selectedUserIds.length === 0 || selectedUserIds.includes(a.userId);
      const typeMatch =
        selectedTypes.length === 0 || selectedTypes.includes(normalizeActivityType(a.type));
      return personMatch && typeMatch;
    });
  }, [activities, selectedUserIds, selectedTypes]);

  const currentUserId = session?.user?.id;

  function openAdd() {
    setEditingActivity(null);
    setModalOpen(true);
  }

  function openEdit(activity: PublicActivity) {
    setEditingActivity(activity);
    setModalOpen(true);
  }

  function handleSaved() {
    router.refresh();
  }

  return (
    <div className="container-app py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-text-primary">
          Activity Feed
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <PersonFilter users={users} selectedIds={selectedUserIds} onChange={setSelectedUserIds} />
          <TypeFilter selectedTypes={selectedTypes} onChange={setSelectedTypes} />
        </div>
      </div>

      {visibleActivities.length === 0 ? (
        <p className="font-body text-sm text-text-secondary">No activities yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visibleActivities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              canEdit={activity.source === "manual" && activity.userId === currentUserId}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {session?.user && (
        <BottomActionBar
          userId={session.user.id}
          firstName={session.user.name?.split(" ")[0] ?? ""}
          lastName={session.user.name?.split(" ").slice(1).join(" ") ?? ""}
          photoUrl={session.user.image}
          connectionStatus={session.user.connectionStatus}
          onAdd={openAdd}
        />
      )}

      <ManualEntryModal
        open={modalOpen}
        editingActivity={editingActivity}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
