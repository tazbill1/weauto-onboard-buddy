import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";

const roleLabels: Record<string, string> = {
  associate: "Associate",
  sales_manager: "Sales Manager",
  gm: "General Manager",
  hr_admin: "HR Admin",
  corporate_admin: "Corporate Admin",
};

export default function ProfilePage() {
  const { profile, signOut } = useAuth();

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

        <Button
          variant="outline"
          className="mt-6 h-12 w-full gap-2 text-destructive border-destructive/20 hover:bg-destructive/5"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </AppShell>
  );
}
