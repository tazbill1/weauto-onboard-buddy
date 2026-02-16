import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { BarChart3, BookOpen, CheckCircle, Clock } from "lucide-react";

const roleGreetings: Record<string, string> = {
  associate: "Let's keep your onboarding on track!",
  sales_manager: "Here's how your team is doing today.",
  gm: "Store performance overview at a glance.",
  hr_admin: "Team onboarding status summary.",
  corporate_admin: "Organization-wide insights.",
};

export default function HomePage() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const stats = [
    { label: "Completed", value: "3/12", icon: CheckCircle, color: "text-success" },
    { label: "In Progress", value: "2", icon: Clock, color: "text-warning" },
    { label: "Modules", value: "12", icon: BookOpen, color: "text-secondary" },
    { label: "Score", value: "85%", icon: BarChart3, color: "text-primary" },
  ];

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Hi, {firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {roleGreetings[profile?.role || "associate"]}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="flex flex-col items-start p-4">
              <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
              <span className="text-2xl font-bold text-foreground">{stat.value}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </Card>
          ))}
        </div>

        <Card className="mt-6 p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Next Up</h2>
          <div className="space-y-3">
            {["Product Knowledge Quiz", "CRM Training Video", "Shadow Session Sign-off"].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-secondary" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
