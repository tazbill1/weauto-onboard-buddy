import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TaskItem } from "@/components/TaskItem";
import {
  useDays,
  useTasksForDay,
  useMyProgram,
  useCompletions,
  useToggleCompletion,
  getPhaseLabel,
  getSectionLabel,
} from "@/hooks/useOnboardingData";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronLeft, BookOpen, Dumbbell, Briefcase, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const sectionIcons: Record<string, typeof BookOpen> = {
  learn: BookOpen,
  practice: Dumbbell,
  mastery_homework: Briefcase,
  manager_checkin: UserCheck,
};

export default function DayViewPage() {
  const { dayNumber } = useParams();
  const navigate = useNavigate();
  const num = parseInt(dayNumber || "1", 10);

  const { data: days } = useDays();
  const day = days?.find((d) => d.day_number === num);
  const { data: tasks, isLoading } = useTasksForDay(day?.id);
  const { data: program } = useMyProgram();
  const { data: completions } = useCompletions(program?.id);
  const toggleCompletion = useToggleCompletion();

  const completionMap = new Map(completions?.map((c) => [c.task_id, c]));

  // Group tasks by section
  const tasksBySection = (tasks || []).reduce((acc, task) => {
    if (!acc[task.section]) acc[task.section] = [];
    acc[task.section].push(task);
    return acc;
  }, {} as Record<string, typeof tasks>);

  const totalTasks = tasks?.length || 0;
  const completedCount =
    tasks?.filter((t) => completionMap.get(t.id)?.status === "completed").length || 0;
  const dayProgress = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  const phaseColors: Record<string, string> = {
    foundations: "text-primary",
    skill_development: "text-secondary",
    advanced_selling: "text-warning",
    mastery_integration: "text-success",
  };

  return (
    <AppShell>
      <div className="px-4 py-4 animate-fade-in space-y-4">
        {/* Back + Header */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 -ml-2 text-muted-foreground"
          onClick={() => navigate("/")}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {isLoading || !day ? (
          <Skeleton className="h-28 w-full rounded-2xl" />
        ) : (
          <Card className="p-5">
            <p
              className={`text-xs font-semibold uppercase tracking-wider ${
                phaseColors[day.phase] || "text-muted-foreground"
              }`}
            >
              Week {day.week_number} · {getPhaseLabel(day.phase)}
            </p>
            <h1 className="mt-1 text-xl font-bold text-foreground">
              Day {day.day_number}: {day.title}
            </h1>
            {day.subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{day.subtitle}</p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <Progress value={dayProgress} className="flex-1 h-2" />
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                {completedCount}/{totalTasks}
              </span>
            </div>
          </Card>
        )}

        {/* Accordion Sections */}
        {Object.keys(tasksBySection).length > 0 && (
          <Accordion type="multiple" defaultValue={Object.keys(tasksBySection)} className="space-y-2">
            {Object.entries(tasksBySection).map(([section, sectionTasks]) => {
              const Icon = sectionIcons[section] || BookOpen;
              const sectionCompleted = sectionTasks!.filter(
                (t) => completionMap.get(t.id)?.status === "completed"
              ).length;

              return (
                <AccordionItem key={section} value={section} className="border-none">
                  <Card>
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-secondary" />
                        <span className="text-sm font-semibold text-foreground">
                          {getSectionLabel(section)}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto mr-2">
                          {sectionCompleted}/{sectionTasks!.length}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-1 pb-2">
                      <div className="divide-y divide-border">
                        {sectionTasks!.map((task) => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            completion={completionMap.get(task.id)}
                            disabled={!program}
                            onToggle={() => {
                              if (!program) return;
                              toggleCompletion.mutate({
                                programId: program.id,
                                taskId: task.id,
                                currentStatus: completionMap.get(task.id)?.status,
                              });
                            }}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {/* Day navigation */}
        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={num <= 1}
            onClick={() => navigate(`/day/${num - 1}`)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Day {num - 1}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={num >= 20}
            onClick={() => navigate(`/day/${num + 1}`)}
          >
            Day {num + 1} <ChevronLeft className="h-4 w-4 ml-1 rotate-180" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
