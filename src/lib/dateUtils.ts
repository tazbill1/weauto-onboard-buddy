import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

/**
 * Friendly date: "Feb 15, 2026"
 */
export function friendlyDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return format(new Date(dateStr), "MMM d, yyyy");
}

/**
 * Relative time for recent, full date for older:
 * "2 hours ago", "Yesterday", "Feb 15, 2026"
 */
export function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  if (isYesterday(d)) return "Yesterday";
  if (diffHours < 24 * 7) return `${Math.floor(diffHours / 24)} days ago`;
  return format(d, "MMM d, yyyy");
}
