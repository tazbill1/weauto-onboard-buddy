import { useAuth } from "@/lib/auth";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, BarChart3, BookOpen, Bell, User, Users, ClipboardCheck,
  Building2, FileText, LayoutDashboard, Settings
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePendingUploads } from "@/hooks/useOnboardingData";
import { useUnreadCount } from "@/hooks/useNotifications";

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badgeKey?: string;
}

const navByRole: Record<string, NavItem[]> = {
  associate: [
    { label: "Home", icon: Home, path: "/" },
    { label: "Progress", icon: BarChart3, path: "/progress" },
    { label: "Content", icon: BookOpen, path: "/content" },
    { label: "Alerts", icon: Bell, path: "/notifications" },
    { label: "Profile", icon: User, path: "/profile" },
  ],
  sales_manager: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { label: "My Team", icon: Users, path: "/team" },
    { label: "Reviews", icon: ClipboardCheck, path: "/reviews", badgeKey: "pending" },
    { label: "Alerts", icon: Bell, path: "/notifications" },
    { label: "Profile", icon: User, path: "/profile" },
  ],
  gm: [
    { label: "Overview", icon: LayoutDashboard, path: "/" },
    { label: "Stores", icon: Building2, path: "/stores" },
    { label: "Reports", icon: FileText, path: "/reports" },
    { label: "Alerts", icon: Bell, path: "/notifications" },
    { label: "Profile", icon: User, path: "/profile" },
  ],
  corporate_admin: [
    { label: "Stores", icon: Building2, path: "/" },
    { label: "My Team", icon: Users, path: "/team" },
    { label: "Content", icon: Settings, path: "/content-admin" },
    { label: "Reports", icon: FileText, path: "/reports" },
    { label: "Profile", icon: User, path: "/profile" },
  ],
  hr_admin: [
    { label: "Team", icon: Users, path: "/" },
    { label: "Reports", icon: FileText, path: "/reports" },
    { label: "Alerts", icon: Bell, path: "/notifications" },
    { label: "Profile", icon: User, path: "/profile" },
  ],
};

export function BottomNav() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: pendingUploads } = usePendingUploads();

  const unreadCount = useUnreadCount();

  if (!profile) return null;

  const items = navByRole[profile.role] || navByRole.associate;
  const isManagerRole = ["sales_manager", "gm", "hr_admin", "corporate_admin"].includes(profile.role);
  const pendingCount = isManagerRole ? (pendingUploads?.length || 0) : 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.06)] safe-area-bottom">
      <div className="flex items-stretch justify-around">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          const showBadge = item.badgeKey === "pending" && pendingCount > 0;
          const showNotifBadge = item.path === "/notifications" && unreadCount > 0;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors relative ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 bg-warning text-warning-foreground text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
                    {pendingCount}
                  </span>
                )}
                {showNotifBadge && (
                  <span className="absolute -top-1.5 -right-2 bg-destructive text-destructive-foreground text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
