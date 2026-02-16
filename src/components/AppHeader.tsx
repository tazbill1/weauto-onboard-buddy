import { useNavigate } from "react-router-dom";
import { WEAutoLogo } from "./WEAutoLogo";
import { Bell } from "lucide-react";
import { useUnreadCount } from "@/hooks/useNotifications";

export function AppHeader() {
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-card px-4 py-3">
      <WEAutoLogo />
      <button
        onClick={() => navigate("/notifications")}
        className="touch-target relative flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
}
