import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ProgressRing";
import { DayTimeline } from "@/components/DayTimeline";
import { TaskItem } from "@/components/TaskItem";
import GMOverviewPage from "./GMOverviewPage";
import CorporateDashboardPage from "./CorporateDashboardPage";
import HRAdminPage from "./HRAdminPage";
import ManagerDashboardPage from "./ManagerDashboardPage";
import {
  useDays,
  useMyProgram,
  useTasksForDay,
  useCompletions,
  useAllTasks,
  useToggleCompletion,
  getPhaseLabel,
  getSectionLabel,
} from "@/hooks/useOnboardingData";
import { useNotifications } from "@/hooks/useNotifications";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Upload, CheckCircle2, AlertTriangle, Trophy } from "lucide-react";

const roleGreetings: Record<string, string> = {
  associate: "Let's keep your onboarding on track!",
  sales_manager: "Here's how your team is doing today.",
  gm: "Store performance overview at a glance.",
  hr_admin: "Team onboarding status summary.",
  corporate_admin: "Organization-wide insights.",
};

export default function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const isAssociate = profile?.role === "associate";

  const { data: days, isLoading: daysLoading } = useDays();
  const { data: program } = useMyProgram();
  const { data: allTasks } = useAllTasks();
  const { data: completions } = useCompletions(program?.id);
  const toggleCompletion = useToggleCompletion();
  const { data: notifications } = useNotifications();
  const recentUnread = notifications?.filter((n) => !n.is_read).slice(0, 3) || [];

  // Get current day data
  const currentDayNumber = program?.current_day || 1;
  const currentDay = days?.find((d) => d.day_number === currentDayNumber);
  const { data: currentDayTasks } = useTasksForDay(currentDay?.id);

  // Calculate progress
  const totalTasks = allTasks?.length || 0;
  const completedCount = completions?.filter((c) => c.status === "completed").length || 0;
  const progress = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  // Completed days: a day is complete if all its tasks are completed
  const completedDays = new Set<number>();
  if (days && allTasks && completions) {
    for (const day of days) {
      const dayTasks = allTasks.filter((t) => t.day_id === day.id);
      if (dayTasks.length > 0 && dayTasks.every((t) => completions.some((c) => c.task_id === t.id && c.status === "completed"))) {
        completedDays.add(day.day_number);
      }
    }
  }

  // Group current day tasks by section
  const tasksBySection = (currentDayTasks || []).reduce((acc, task) => {
    if (!acc[task.section]) acc[task.section] = [];
    acc[task.section].push(task);
    return acc;
  }, {} as Record<string, typeof currentDayTasks>);

  const completionMap = new Map(completions?.map((c) => [c.task_id, c]));

  if (profile?.role === "gm") return <GMOverviewPage />;
  if (profile?.role === "corporate_admin") return <CorporateDashboardPage />;
  if (profile?.role === "hr_admin") return <HRAdminPage />;
  if (profile?.role === "sales_manager") return <ManagerDashboardPage />;

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hi, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {roleGreetings.associate}
          </p>
        </div>

        {/* Hero Card */}
        {daysLoading ? (
          <Skeleton className="h-48 w-full rounded-2xl" />
        ) : (
          <Card className="relative overflow-hidden p-5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
            <div className="flex items-center gap-5">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  {currentDay ? getPhaseLabel(currentDay.phase) : ""}
                </p>
                <p className="mt-1 text-4xl font-extrabold text-foreground">
                  Day {currentDayNumber}
                  <span className="text-lg font-medium text-muted-foreground"> / 20</span>
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {currentDay?.title}
                </p>
              </div>
              <ProgressRing progress={progress} size={100} strokeWidth={7} />
            </div>
          </Card>
        )}

        {/* Recent Notifications */}
        {isAssociate && recentUnread.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-foreground mb-2">Recent Alerts</h2>
            <Card className="divide-y divide-border overflow-hidden">
              {recentUnread.map((n) => {
                const iconMap: Record<string, typeof Clock> = {
                  behind_schedule: Clock,
                  deliverable_submitted: Upload,
                  checkin_complete: CheckCircle2,
                  needs_work: AlertTriangle,
                  milestone: Trophy,
                };
                const colorMap: Record<string, string> = {
                  behind_schedule: "text-destructive bg-destructive/10",
                  deliverable_submitted: "text-warning bg-warning/10",
                  checkin_complete: "text-success bg-success/10",
                  needs_work: "text-warning bg-warning/10",
                  milestone: "text-secondary bg-secondary/10",
                };
                const Icon = iconMap[n.type] || Clock;
                return (
                  <button
                    key={n.id}
                    onClick={() => navigate("/notifications")}
                    className="flex items-start gap-3 w-full text-left p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorMap[n.type] || ""}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{n.body}</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-secondary flex-shrink-0 mt-2" />
                  </button>
                );
              })}
            </Card>
          </div>
        )}

        {/* Today's Tasks */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-3">Today's Tasks</h2>
          {!program ? (
            <Card className="p-5 text-center">
              <p className="text-sm text-muted-foreground">
                No active onboarding program yet. Ask your manager to get started!
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(tasksBySection).map(([section, tasks]) => (
                <div key={section}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-1">
                    {getSectionLabel(section)}
                  </h3>
                  <Card className="divide-y divide-border">
                    {tasks!.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        completion={completionMap.get(task.id)}
                        onToggle={() =>
                          toggleCompletion.mutate({
                            programId: program.id,
                            taskId: task.id,
                            currentStatus: completionMap.get(task.id)?.status,
                          })
                        }
                      />
                    ))}
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 20-Day Timeline */}
        {days && days.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-foreground mb-3">Your Journey</h2>
            <DayTimeline
              days={days}
              currentDay={currentDayNumber}
              completedDays={completedDays}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
