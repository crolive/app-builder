type BadgeVariant = "strava" | "manual" | "disconnected" | "neutral";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  strava: "bg-accent-positive/15 text-accent-positive border-accent-positive/40",
  manual: "bg-panel-raised text-text-secondary border-border-strong",
  disconnected: "bg-accent-alert/15 text-accent-alert border-accent-alert/40",
  neutral: "bg-panel-raised text-text-secondary border-border",
};

export default function Badge({
  variant,
  children,
}: {
  variant: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
