import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  type Notification,
} from "@/hooks/useNotifications";
import {
  Clock,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  CheckCheck,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

const typeConfig: Record<
  string,
  { icon: typeof Clock; className: string }
> = {
  behind_schedule: { icon: Clock, className: "text-destructive bg-destructive/10" },
  deliverable_submitted: { icon: Upload, className: "text-warning bg-warning/10" },
  checkin_complete: { icon: CheckCircle2, className: "text-success bg-success/10" },
  needs_work: { icon: AlertTriangle, className: "text-warning bg-warning/10" },
  milestone: { icon: Trophy, className: "text-secondary bg-secondary/10" },
};

function NotificationItem({
  notification,
  onTap,
}: {
  notification: Notification;
  onTap: () => void;
}) {
  const config = typeConfig[notification.type] || typeConfig.behind_schedule;
  const Icon = config.icon;
  const timeAgo = formatTimeAgo(notification.created_at);

  return (
    <button
      onClick={onTap}
      className="flex items-start gap-3 w-full text-left p-4 hover:bg-muted/50 transition-colors touch-target"
    >
      <div className={`mt-0.5 h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${config.className}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm leading-tight ${notification.is_read ? "text-muted-foreground" : "text-foreground font-semibold"}`}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="h-2 w-2 rounded-full bg-secondary flex-shrink-0" />
          )}
        </div>
        <p className={`text-xs mt-0.5 line-clamp-2 ${notification.is_read ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
          {notification.body}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo}</p>
      </div>
    </button>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const queryClient = useQueryClient();
  const refreshingRef = useRef(false);

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  const handleTap = useCallback(
    (notification: Notification) => {
      if (!notification.is_read) {
        markAsRead.mutate(notification.id);
      }
      // Navigate based on type
      if (notification.type === "deliverable_submitted" && notification.related_task_id) {
        navigate(`/reviews`);
      } else if (notification.type === "checkin_complete" && notification.related_day) {
        navigate(`/day/${notification.related_day}`);
      } else if (notification.type === "needs_work" && notification.related_day) {
        navigate(`/day/${notification.related_day}`);
      } else if (notification.type === "behind_schedule") {
        navigate("/");
      } else if (notification.type === "milestone") {
        navigate("/");
      }
    },
    [markAsRead, navigate]
  );

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    refreshingRef.current = false;
  }, [queryClient]);

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs gap-1.5 text-muted-foreground"
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={handleRefresh}
            >
              Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : !notifications?.length ? (
          <Card className="p-8 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              You'll be notified about milestones, reviews, and more.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onTap={() => handleTap(notification)}
              />
            ))}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
