import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ProgressRing";
import { TaskItem } from "@/components/TaskItem";
import { EmptyState } from "@/components/ErrorStates";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Upload, CheckCircle2, AlertTriangle, Trophy, Inbox, TrendingDown } from "lucide-react";
import { relativeTime } from "@/lib/dateUtils";
import { getPhaseLabel, getSectionLabel } from "@/hooks/useOnboardingData";
import type { Day, Task, TaskCompletion, OnboardingProgram, Department } from "@/hooks/useOnboardingData";

interface DashboardTabProps {
  firstName: string;
  program: OnboardingProgram | undefined;
  department: Department | undefined;
  currentDay: Day | undefined;
  currentDayNumber: number;
  totalDays: number;
  progress: number;
  daysLoading: boolean;
  noDaysYet: boolean;
  isBehindSchedule: boolean;
  recentUnread: Array<{ id: string; type: string; title: string; body: string; created_at: string; is_read: boolean }>;
  tasksBySection: Record<string, Task[]>;
  completionMap: Map<string, TaskCompletion>;
  toggleCompletion: { mutate: (args: { programId: string; taskId: string; currentStatus: string | undefined }) => void };
}

export function DashboardTab({
  firstName,
  program,
  department,
  currentDay,
  currentDayNumber,
  totalDays,
  progress,
  daysLoading,
  noDaysYet,
  isBehindSchedule,
  recentUnread,
  tasksBySection,
  completionMap,
  toggleCompletion,
}: DashboardTabProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hi, {firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Let's keep your onboarding on track!
        </p>
      </div>

      {daysLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : (
        <Card className="relative overflow-hidden p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="flex items-center gap-5">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {currentDay ? getPhaseLabel(currentDay.phase) : (department?.label || "")}
              </p>
              <p className="mt-1 text-4xl font-extrabold text-foreground">
                Day {currentDayNumber}
                <span className="text-lg font-medium text-muted-foreground"> / {totalDays}</span>
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{currentDay?.title}</p>
            </div>
            <ProgressRing progress={progress} size={100} strokeWidth={7} />
          </div>
        </Card>
      )}

      {isBehindSchedule && (
        <button
          onClick={() => navigate("/notifications")}
          className="w-full flex items-center gap-3 rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 text-left hover:bg-destructive/15 transition-colors"
        >
          <div className="h-9 w-9 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="h-4.5 w-4.5 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-destructive">You're behind schedule</p>
            <p className="text-xs text-destructive/70">Tap to see what needs your attention</p>
          </div>
        </button>
      )}

      {recentUnread.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-foreground mb-2">Recent Alerts</h2>
          <Card className="divide-y divide-border overflow-hidden">
            {recentUnread.map((n) => {
              const iconMap: Record<string, typeof Clock> = {
                behind_schedule: Clock, deliverable_submitted: Upload, checkin_complete: CheckCircle2,
                needs_work: AlertTriangle, milestone: Trophy,
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
                <button key={n.id} onClick={() => navigate("/notifications")} className="flex items-start gap-3 w-full text-left p-3 hover:bg-muted/50 transition-colors">
                  <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorMap[n.type] || ""}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{relativeTime(n.created_at)}</p>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-secondary flex-shrink-0 mt-2" />
                </button>
              );
            })}
          </Card>
        </div>
      )}

      <div>
        <h2 className="text-base font-bold text-foreground mb-3">Today's Tasks</h2>
        {!program ? (
          <EmptyState
            icon={Inbox}
            title="No active program yet"
            description="HR will set up your onboarding when you're ready to begin."
          />
        ) : noDaysYet ? (
          <Card className="p-6 text-center">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-bold text-foreground mb-1">Your onboarding program is being prepared</p>
            <p className="text-xs text-muted-foreground">Your manager will notify you when training content is ready.</p>
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
                          programId: program!.id,
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
    </div>
  );
}
