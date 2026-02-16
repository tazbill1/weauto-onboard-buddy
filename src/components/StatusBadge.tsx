export function StatusBadge({ status }: { status: "on_track" | "behind" | "needs_attention" }) {
  const config = {
    on_track: { label: "On Track", className: "bg-success/10 text-success" },
    behind: { label: "Behind", className: "bg-destructive/10 text-destructive" },
    needs_attention: { label: "Needs Attention", className: "bg-warning/10 text-warning" },
  };
  const c = config[status];
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${c.className}`}>
      {c.label}
    </span>
  );
}

export function StatusDot({ status, count }: { status: "on_track" | "behind" | "needs_attention"; count: number }) {
  const colors = {
    on_track: "bg-success",
    behind: "bg-destructive",
    needs_attention: "bg-warning",
  };
  if (count === 0) return null;
  return (
    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${colors[status]}`} />
      {count}
    </div>
  );
}
