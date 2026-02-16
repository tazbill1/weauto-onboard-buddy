import { useAuth } from "@/lib/auth";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, BarChart3, BookOpen, Bell, User, Users, ClipboardCheck,
  Building2, FileText, LayoutDashboard, Settings
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
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
    { label: "Reviews", icon: ClipboardCheck, path: "/reviews" },
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
    { label: "Reports", icon: FileText, path: "/reports" },
    { label: "Alerts", icon: Bell, path: "/notifications" },
    { label: "Profile", icon: User, path: "/profile" },
  ],
  hr_admin: [
    { label: "Team", icon: Users, path: "/" },
    { label: "Reports", icon: FileText, path: "/reports" },
    { label: "Profile", icon: User, path: "/profile" },
  ],
};

export function BottomNav() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!profile) return null;

  const items = navByRole[profile.role] || navByRole.associate;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card safe-area-bottom">
      <div className="flex items-stretch justify-around">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
