import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/ProgressRing";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, AlertTriangle, X, BookOpen, Dumbbell, Briefcase, ChevronRight, Trophy } from "lucide-react";
import {
  useDays,
  useMyProgram,
  useAllTasks,
  useCompletions,
  useRatingsForProgram,
  useSignoffsForProgram,
  getPhaseLabel,
} from "@/hooks/useOnboardingData";

const PHASES = [
  { key: "foundations", label: "Foundations", week: "Week 1", days: [1, 2, 3, 4, 5, 6], color: "text-primary", bg: "bg-primary/10" },
  { key: "skill_development", label: "Skill Development", week: "Week 2", days: [7, 8, 9, 10], color: "text-secondary", bg: "bg-secondary/10" },
  { key: "advanced_selling", label: "Advanced Selling", week: "Week 3", days: [11, 12, 13, 14, 15], color: "text-warning", bg: "bg-warning/10" },
  { key: "mastery_integration", label: "Mastery & Integration", week: "Week 4", days: [16, 17, 18, 19, 20], color: "text-success", bg: "bg-success/10" },
];

function RatingSummary({ ratings }: { ratings: Array<{ rating: string }> }) {
  const counts = {
    meets_expectation: ratings.filter((r) => r.rating === "meets_expectation").length,
    needs_work: ratings.filter((r) => r.rating === "needs_work").length,
    not_attempted: ratings.filter((r) => r.rating === "not_attempted").length,
  };
  if (!ratings.length) return null;

  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      <div className="rounded-lg bg-success/10 p-2 text-center">
        <Check className="h-3.5 w-3.5 text-success mx-auto mb-1" />
        <p className="text-lg font-bold text-success">{counts.meets_expectation}</p>
        <p className="text-[10px] text-success/70 leading-tight">Meets<br />Expectation</p>
      </div>
      <div className="rounded-lg bg-warning/10 p-2 text-center">
        <AlertTriangle className="h-3.5 w-3.5 text-warning mx-auto mb-1" />
        <p className="text-lg font-bold text-warning">{counts.needs_work}</p>
        <p className="text-[10px] text-warning/70 leading-tight">Needs<br />Work</p>
      </div>
      <div className="rounded-lg bg-destructive/10 p-2 text-center">
        <X className="h-3.5 w-3.5 text-destructive mx-auto mb-1" />
        <p className="text-lg font-bold text-destructive">{counts.not_attempted}</p>
        <p className="text-[10px] text-destructive/70 leading-tight">Not<br />Attempted</p>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const navigate = useNavigate();
  const { data: days } = useDays();
  const { data: program } = useMyProgram();
  const { data: allTasks } = useAllTasks();
  const { data: completions } = useCompletions(program?.id);
  const { data: ratings } = useRatingsForProgram(program?.id);
  const { data: signoffs } = useSignoffsForProgram(program?.id);

  useEffect(() => { document.title = "My Progress — WEAuto"; }, []);

  const completionMap = useMemo(
    () => new Map(completions?.map((c) => [c.task_id, c])),
    [completions]
  );

  const totalTasks = allTasks?.length || 0;
  const completedCount = completions?.filter((c) => c.status === "completed").length || 0;
  const overallProgress = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  const signedOffDays = useMemo(() => new Set(signoffs?.map((s) => s.day_number) || []), [signoffs]);

  const phaseStats = useMemo(() => {
    if (!days || !allTasks) return {};
    return PHASES.reduce((acc, phase) => {
      const phaseDays = days.filter((d) => phase.days.includes(d.day_number));
      const phaseTasks = allTasks.filter((t) => phaseDays.some((d) => d.id === t.day_id));
      const phaseCompleted = phaseTasks.filter((t) => completionMap.get(t.id)?.status === "completed").length;
      acc[phase.key] = { total: phaseTasks.length, completed: phaseCompleted };
      return acc;
    }, {} as Record<string, { total: number; completed: number }>);
  }, [days, allTasks, completionMap]);

  const isCompleted = program?.status === "completed";

  if (!program) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center animate-fade-in">
          <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">No Active Program</h1>
          <p className="text-sm text-muted-foreground">HR will set up your onboarding when you're ready to begin.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-5">
        <h1 className="text-2xl font-bold text-foreground">My Progress</h1>

        {/* Overall Summary */}
        {!days ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : (
          <Card className="p-5">
            {isCompleted ? (
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                  <Trophy className="h-8 w-8 text-success" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-success">Program Complete</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">Certified! 🎉</p>
                  <p className="text-xs text-muted-foreground">All 20 days completed</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <ProgressRing progress={overallProgress} size={90} strokeWidth={6} />
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overall Progress</p>
                  <p className="text-3xl font-extrabold text-foreground mt-1">Day {program.current_day}<span className="text-lg font-medium text-muted-foreground"> / 20</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">{completedCount} of {totalTasks} tasks completed</p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Performance Ratings Summary */}
        {ratings && ratings.length > 0 && (
          <Card className="p-4">
            <h2 className="text-sm font-bold text-foreground">Manager Ratings</h2>
            <p className="text-xs text-muted-foreground">Across all signed-off days</p>
            <RatingSummary ratings={ratings} />
          </Card>
        )}

        {/* Phase Breakdown */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-foreground">Phase Breakdown</h2>
          {PHASES.map((phase) => {
            const stats = phaseStats[phase.key] || { total: 0, completed: 0 };
            const pct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
            const phaseDayNums = phase.days;
            const signedOffInPhase = phaseDayNums.filter((d) => signedOffDays.has(d)).length;

            return (
              <Card key={phase.key} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${phase.color}`}>{phase.week}</p>
                    <p className="text-sm font-bold text-foreground">{phase.label}</p>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded-full ${phase.bg} ${phase.color}`}>
                    {stats.completed}/{stats.total}
                  </div>
                </div>
                <Progress value={pct} className="h-2 mb-3" />
                {/* Day chips */}
                <div className="flex gap-1.5 flex-wrap">
                  {phaseDayNums.map((dayNum) => {
                    const isSigned = signedOffDays.has(dayNum);
                    const isCurrent = dayNum === program.current_day;
                    const isPast = dayNum < program.current_day;
                    return (
                      <button
                        key={dayNum}
                        onClick={() => navigate(`/day/${dayNum}`)}
                        className={`h-8 w-8 rounded-full text-xs font-bold transition-all ${
                          isSigned
                            ? "bg-success text-success-foreground"
                            : isCurrent
                            ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                            : isPast
                            ? "bg-muted text-muted-foreground"
                            : "bg-muted/50 text-muted-foreground/50"
                        }`}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
                {signedOffInPhase > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {signedOffInPhase} of {phaseDayNums.length} days signed off by manager
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
