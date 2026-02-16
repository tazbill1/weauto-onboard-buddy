import { WEAutoLogo } from "./WEAutoLogo";
import { Bell } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-card px-4 py-3">
      <WEAutoLogo />
      <button className="touch-target flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors">
        <Bell className="h-5 w-5" />
      </button>
    </header>
  );
}
