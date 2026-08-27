"use client";

import { useEffect, useRef, useState } from "react";
import { MANUAL_ACTIVITY_TYPES, type ManualActivityType } from "@/lib/constants";

export default function TypeFilter({
  selectedTypes,
  onChange,
}: {
  selectedTypes: ManualActivityType[];
  onChange: (types: ManualActivityType[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = selectedTypes.length > 0;

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(type: ManualActivityType) {
    if (selectedTypes.includes(type)) {
      onChange(selectedTypes.filter((t) => t !== type));
    } else {
      onChange([...selectedTypes, type]);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-widest transition ${
          active
            ? "border-accent-positive/50 bg-accent-positive/10 text-text-primary"
            : "border-border text-text-tertiary opacity-60 hover:opacity-100"
        }`}
      >
        Type
        {active && <span className="text-[11px]">({selectedTypes.length})</span>}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-border-strong bg-panel-raised p-2 shadow-lift">
          <div className="flex flex-col gap-1">
            {MANUAL_ACTIVITY_TYPES.map((type) => {
              const checked = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggle(type)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs transition ${
                    checked
                      ? "bg-accent-positive/10 text-text-primary"
                      : "text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                      checked ? "border-accent-positive/50 bg-accent-positive/20" : "border-border"
                    }`}
                  >
                    {checked && <span className="h-1.5 w-1.5 rounded-[1px] bg-accent-positive" />}
                  </span>
                  {type}
                </button>
              );
            })}
          </div>

          {active && (
            <button
              onClick={() => onChange([])}
              className="mt-2 w-full border-t border-border pt-2 text-left font-mono text-[11px] uppercase tracking-widest text-text-tertiary underline decoration-dotted hover:text-text-primary"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
