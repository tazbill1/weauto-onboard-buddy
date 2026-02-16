import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Mail, Info, UserPlus } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const roleLabels: Record<string, string> = {
  associate: "Associate",
  sales_manager: "Sales Manager",
  gm: "General Manager",
  hr_admin: "HR Admin",
  corporate_admin: "Corporate Admin",
};

const APP_VERSION = "1.0.0";

export default function ProfilePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const canInvite = profile?.role && ["sales_manager", "gm", "hr_admin", "corporate_admin"].includes(profile.role);

  useEffect(() => { document.title = "Profile — WEAuto Onboarding"; }, []);

  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in">
        <div className="flex flex-col items-center mb-6">
          <Avatar className="h-20 w-20 mb-3">
            <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-bold text-foreground">{profile?.full_name || "User"}</h1>
          <span className="text-sm text-muted-foreground">{roleLabels[profile?.role || "associate"]}</span>
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Email</span>
            <span className="text-foreground">{profile?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={profile?.is_active ? "text-success" : "text-destructive"}>
              {profile?.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </Card>

        {canInvite && (
          <button
            onClick={() => navigate("/invite")}
            className="flex items-center gap-2 mt-4 p-3 rounded-xl border bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors text-sm font-medium text-primary w-full"
          >
            <UserPlus className="h-4 w-4" />
            Invite Team Member
          </button>
        )}

        <a
          href="mailto:support@weauto.com?subject=WEAuto%20Onboarding%20Help"
          className="flex items-center gap-2 mt-4 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-sm text-muted-foreground"
        >
          <Mail className="h-4 w-4" />
          Need Help? Contact Support
        </a>

        <Button
          variant="outline"
          className="mt-4 h-12 w-full gap-2 text-destructive border-destructive/20 hover:bg-destructive/5"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>

        <div className="mt-8 flex items-center justify-center gap-1 text-[11px] text-muted-foreground/50">
          <Info className="h-3 w-3" />
          WEAuto Onboarding v{APP_VERSION}
        </div>
      </div>
    </AppShell>
  );
}
