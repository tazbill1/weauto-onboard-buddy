import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ProgressRing";
import { DayTimeline } from "@/components/DayTimeline";
import { TaskItem } from "@/components/TaskItem";
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
import { Skeleton } from "@/components/ui/skeleton";

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
  const isAssociate = profile?.role === "associate";

  const { data: days, isLoading: daysLoading } = useDays();
  const { data: program } = useMyProgram();
  const { data: allTasks } = useAllTasks();
  const { data: completions } = useCompletions(program?.id);
  const toggleCompletion = useToggleCompletion();

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

  if (!isAssociate) {
    // Non-associate home (unchanged from original)
    return (
      <AppShell>
        <div className="px-4 py-6 animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">Hi, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {roleGreetings[profile?.role || "associate"]}
          </p>
          <Card className="mt-6 p-6 text-center text-muted-foreground">
            Dashboard coming soon for {profile?.role} role.
          </Card>
        </div>
      </AppShell>
    );
  }

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
