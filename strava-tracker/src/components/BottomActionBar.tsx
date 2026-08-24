"use client";

import { useEffect } from "react";
import type { ConnectionStatus } from "@prisma/client";
import Avatar from "./Avatar";
import Badge from "./Badge";

export default function BottomActionBar({
  userId,
  firstName,
  lastName,
  photoUrl,
  connectionStatus,
  onAdd,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  connectionStatus?: ConnectionStatus;
  onAdd: () => void;
}) {
  useEffect(() => {
    document.body.classList.add("has-bottom-bar");
    return () => {
      document.body.classList.remove("has-bottom-bar");
    };
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-panel-raised/95 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar id={userId} firstName={firstName} lastName={lastName} photoUrl={photoUrl} size={32} />
          <span className="font-body text-sm text-text-primary">
            {firstName} {lastName}
          </span>
          {connectionStatus === "DISCONNECTED" && (
            <Badge variant="disconnected">Disconnected</Badge>
          )}
        </div>
        <button
          onClick={onAdd}
          className="rounded-full bg-accent-positive px-5 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-bg transition hover:opacity-90"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
