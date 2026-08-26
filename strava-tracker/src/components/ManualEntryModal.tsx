"use client";

import { useEffect, useState } from "react";
import { MANUAL_ACTIVITY_TYPES } from "@/lib/constants";
import { formatSecondsToDuration } from "@/lib/units";
import type { PublicActivity } from "@/lib/serialize";

export interface ManualEntryFormValues {
  type: string;
  title: string;
  distanceMiles: string;
  movingTime: string;
  elapsedTime: string;
  startDate: string;
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function emptyForm(): ManualEntryFormValues {
  return {
    type: MANUAL_ACTIVITY_TYPES[0],
    title: "",
    distanceMiles: "",
    movingTime: "",
    elapsedTime: "",
    startDate: new Date().toISOString().slice(0, 10),
  };
}

function fromActivity(activity: PublicActivity): ManualEntryFormValues {
  return {
    type: activity.type,
    title: activity.title,
    distanceMiles: String(activity.distanceMiles),
    movingTime: formatSecondsToDuration(activity.movingTimeSeconds),
    elapsedTime: formatSecondsToDuration(activity.elapsedTimeSeconds),
    startDate: toDateInputValue(activity.startDate),
  };
}

export default function ManualEntryModal({
  open,
  editingActivity,
  onClose,
  onSaved,
}: {
  open: boolean;
  editingActivity: PublicActivity | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ManualEntryFormValues>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editingActivity ? fromActivity(editingActivity) : emptyForm());
      setError(null);
      setConfirmingDelete(false);
    }
  }, [open, editingActivity]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setConfirmingDelete(false);
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleCancel() {
    setConfirmingDelete(false);
    onClose();
  }

  function handleBackdropClick() {
    setConfirmingDelete(false);
    onClose();
  }

  async function handleDelete() {
    if (!editingActivity) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    setError(null);
    try {
      const res = await fetch(`/api/activities/${editingActivity.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete activity");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setConfirmingDelete(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      type: form.type,
      title: form.title,
      distanceMiles: form.distanceMiles,
      movingTime: form.movingTime,
      elapsedTime: form.elapsedTime,
      startDate: `${form.startDate}T12:00:00`,
    };

    try {
      const res = await fetch(
        editingActivity ? `/api/activities/${editingActivity.id}` : "/api/activities",
        {
          method: editingActivity ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save activity");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm animate-[sheet-backdrop-in_0.2s_ease-out]"
        onClick={handleBackdropClick}
        aria-hidden
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 max-h-[85vh] w-full max-w-[900px] overflow-y-auto rounded-t-card border border-border-strong bg-panel-raised p-6 shadow-lift animate-[sheet-slide-up_0.25s_ease-out]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />
        <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-text-primary">
          {editingActivity ? "Edit Workout" : "Add Workout"}
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
              Type
            </span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="rounded-lg border border-border bg-panel px-3 py-2 font-body text-sm text-text-primary outline-none focus:border-accent-positive"
            >
              {MANUAL_ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
              Title
            </span>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-lg border border-border bg-panel px-3 py-2 font-body text-sm text-text-primary outline-none focus:border-accent-positive"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
              Distance (miles)
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.distanceMiles}
              onChange={(e) => setForm({ ...form, distanceMiles: e.target.value })}
              className="rounded-lg border border-border bg-panel px-3 py-2 font-body text-sm text-text-primary outline-none focus:border-accent-positive"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
              Start Date
            </span>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="rounded-lg border border-border bg-panel px-3 py-2 font-body text-sm text-text-primary outline-none focus:border-accent-positive"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
              Moving Time (HH:MM:SS)
            </span>
            <input
              type="text"
              required
              placeholder="0:45:00"
              value={form.movingTime}
              onChange={(e) => setForm({ ...form, movingTime: e.target.value })}
              className="rounded-lg border border-border bg-panel px-3 py-2 font-body text-sm text-text-primary outline-none focus:border-accent-positive"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-tertiary">
              Elapsed Time (HH:MM:SS)
            </span>
            <input
              type="text"
              required
              placeholder="0:48:00"
              value={form.elapsedTime}
              onChange={(e) => setForm({ ...form, elapsedTime: e.target.value })}
              className="rounded-lg border border-border bg-panel px-3 py-2 font-body text-sm text-text-primary outline-none focus:border-accent-positive"
            />
          </label>
        </div>

        {error && <p className="mt-4 font-body text-sm text-accent-alert">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-3">
          {editingActivity && (
            <button
              type="button"
              onClick={handleDelete}
              className={
                confirmingDelete
                  ? "rounded-full bg-accent-alert px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-bg transition hover:opacity-90"
                  : "rounded-full border border-accent-alert px-4 py-2 font-mono text-xs uppercase tracking-widest text-accent-alert transition hover:opacity-90"
              }
            >
              {confirmingDelete ? "Confirm Delete" : "Delete"}
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full border border-border-strong px-4 py-2 font-mono text-xs uppercase tracking-widest text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-accent-positive px-5 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-bg transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Saving..." : editingActivity ? "Save Changes" : "Add Workout"}
          </button>
        </div>
      </form>
    </div>
  );
}
