"use client";

import { useState } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "This Strava account is not authorized for this app.",
  Default: "Something went wrong signing in with Strava. Please try again.",
};

export default function ErrorBanner({ code }: { code: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const message = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.Default;

  return (
    <div className="container-app mt-4">
      <div className="flex items-start justify-between gap-4 rounded-card border border-accent-alert/40 bg-accent-alert/10 px-4 py-3">
        <p className="font-body text-sm text-accent-alert">{message}</p>
        <button
          onClick={() => setDismissed(true)}
          className="font-mono text-xs uppercase tracking-widest text-accent-alert/80 hover:text-accent-alert"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
