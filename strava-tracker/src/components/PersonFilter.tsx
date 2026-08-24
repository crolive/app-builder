"use client";

import Avatar from "./Avatar";
import type { PublicUser } from "@/lib/serialize";

export default function PersonFilter({
  users,
  selectedIds,
  onChange,
}: {
  users: PublicUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
        Filter
      </span>
      {users.map((user) => {
        const active = selectedIds.length === 0 || selectedIds.includes(user.id);
        return (
          <button
            key={user.id}
            onClick={() => toggle(user.id)}
            className={`flex items-center gap-1.5 rounded-full border px-2 py-1 pr-3 font-mono text-xs transition ${
              active
                ? "border-accent-positive/50 bg-accent-positive/10 text-text-primary"
                : "border-border text-text-tertiary opacity-60 hover:opacity-100"
            }`}
          >
            <Avatar
              id={user.id}
              firstName={user.firstName}
              lastName={user.lastName}
              photoUrl={user.profilePhotoUrl}
              size={20}
            />
            {user.firstName}
          </button>
        );
      })}
      {selectedIds.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary underline decoration-dotted hover:text-text-primary"
        >
          Clear
        </button>
      )}
    </div>
  );
}
