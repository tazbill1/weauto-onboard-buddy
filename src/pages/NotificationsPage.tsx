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
  Bell,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useEffect } from "react";
import { relativeTime } from "@/lib/dateUtils";

const typeConfig: Record<string, { icon: typeof Clock; className: string }> = {
  behind_schedule: { icon: Clock, className: "text-destructive bg-destructive/10" },
  deliverable_submitted: { icon: Upload, className: "text-warning bg-warning/10" },
  checkin_complete: { icon: CheckCircle2, className: "text-success bg-success/10" },
  needs_work: { icon: AlertTriangle, className: "text-warning bg-warning/10" },
  milestone: { icon: Trophy, className: "text-secondary bg-secondary/10" },
};

function NotificationItem({ notification, onTap }: { notification: Notification; onTap: () => void }) {
  const config = typeConfig[notification.type] || typeConfig.behind_schedule;
  const Icon = config.icon;

  return (
    <button onClick={onTap} className="flex items-start gap-3 w-full text-left p-4 hover:bg-muted/50 transition-colors touch-target">
      <div className={`mt-0.5 h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${config.className}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm leading-tight ${notification.is_read ? "text-muted-foreground" : "text-foreground font-semibold"}`}>
            {notification.title}
          </p>
          {!notification.is_read && <span className="h-2 w-2 rounded-full bg-secondary flex-shrink-0" />}
        </div>
        <p className={`text-xs mt-0.5 line-clamp-2 ${notification.is_read ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
          {notification.body}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{relativeTime(notification.created_at)}</p>
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const queryClient = useQueryClient();

  useEffect(() => { document.title = "Notifications — WEAuto"; }, []);

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  const handleTap = useCallback(
    (notification: Notification) => {
      if (!notification.is_read) markAsRead.mutate(notification.id);
      if (notification.type === "deliverable_submitted") navigate("/reviews");
      else if (notification.type === "checkin_complete" && notification.related_day) navigate(`/day/${notification.related_day}`);
      else if (notification.type === "needs_work" && notification.related_day) navigate(`/day/${notification.related_day}`);
      else navigate("/");
    },
    [markAsRead, navigate]
  );

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" className="text-xs gap-1.5 text-muted-foreground" onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending}>
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={handleRefresh}>Refresh</Button>
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
            <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">You're all caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">No new notifications.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onTap={() => handleTap(notification)} />
            ))}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
