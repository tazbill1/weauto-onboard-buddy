import { useMemo, useState, useEffect } from "react";
import { InviteFAB } from "@/components/InviteFAB";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/StatusBadge";
import {
  useDays,
  useAllTasks,
} from "@/hooks/useOnboardingData";
import {
  useAllPrograms,
  useAllCompletions,
  useAllRatings,
  useAllProfiles,
  useStores,
  getAssociateStatusFromData,
  calcProgress,
} from "@/hooks/useDashboardData";
import { Building2, Users, Award, TrendingUp, Clock, CheckCircle2, AlertTriangle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function CorporateDashboardPage() {
  const navigate = useNavigate();

  useEffect(() => { document.title = "All Stores — WEAuto"; }, []);
  const { data: programs, isLoading } = useAllPrograms();
  const { data: allTasks } = useAllTasks();
  const { data: days } = useDays();
  const { data: completions } = useAllCompletions();
  const { data: ratings } = useAllRatings();
  const { data: profiles } = useAllProfiles();
  const { data: stores } = useStores();

  const activePrograms = useMemo(
    () => programs?.filter((p) => p.status === "active") || [],
    [programs]
  );
  const completedPrograms = useMemo(
    () => programs?.filter((p) => p.status === "completed") || [],
    [programs]
  );

  // Aggregate metrics
  const avgDaysToCert = useMemo(() => {
    const completed = completedPrograms.filter((p) => p.actual_end_date);
    if (!completed.length) return 0;
    const total = completed.reduce((sum, p) => {
      const start = new Date(p.start_date);
      const end = new Date(p.actual_end_date!);
      return sum + Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(total / completed.length);
  }, [completedPrograms]);

  const statusCounts = useMemo(() => {
    const counts = { on_track: 0, behind: 0, needs_attention: 0 };
    activePrograms.forEach((p) => {
      counts[getAssociateStatusFromData(p, ratings || [])]++;
    });
    return counts;
  }, [activePrograms, ratings]);

  const onTrackPct = activePrograms.length
    ? Math.round((statusCounts.on_track / activePrograms.length) * 100)
    : 0;

  const completedThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return completedPrograms.filter((p) => p.actual_end_date && new Date(p.actual_end_date) >= monthStart).length;
  }, [completedPrograms]);

  // Store cards data
  const storeData = useMemo(() => {
    if (!stores) return [];
    return stores.map((store) => {
      const storeProgs = activePrograms.filter((p) => p.store_id === store.id);
      const sc = { on_track: 0, behind: 0, needs_attention: 0 };
      storeProgs.forEach((p) => { sc[getAssociateStatusFromData(p, ratings || [])]++; });
      const avgProg = storeProgs.length && allTasks?.length
        ? Math.round(storeProgs.reduce((s, p) => s + calcProgress(p.id, allTasks, completions || []), 0) / storeProgs.length)
        : 0;
      return { store, programs: storeProgs, statusCounts: sc, avgProgress: avgProg };
    }).filter((s) => s.programs.length > 0);
  }, [stores, activePrograms, ratings, allTasks, completions]);

  // Top 5 "Needs Work" tasks
  const needsWorkTasks = useMemo(() => {
    if (!ratings || !allTasks || !days) return [];
    const needsWork = ratings.filter((r) => r.rating === "needs_work");
    const taskCounts: Record<string, number> = {};
    needsWork.forEach((r) => { taskCounts[r.task_id] = (taskCounts[r.task_id] || 0) + 1; });
    const taskMap = new Map(allTasks.map((t) => [t.id, t]));
    const dayMap = new Map(days.map((d) => [d.id, d]));
    return Object.entries(taskCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([taskId, count]) => {
        const task = taskMap.get(taskId);
        const day = task ? dayMap.get(task.day_id) : undefined;
        return { taskId, title: task?.title || "Unknown", count, dayNumber: day?.day_number || 0 };
      });
  }, [ratings, allTasks, days]);

  // Week-over-week completions (8 weeks)
  const weeklyCompletions = useMemo(() => {
    if (!completedPrograms.length) return [];
    const now = new Date();
    const weeks: { label: string; count: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      const count = completedPrograms.filter((p) => {
        if (!p.actual_end_date) return false;
        const d = new Date(p.actual_end_date);
        return d >= weekStart && d <= weekEnd;
      }).length;
      weeks.push({ label: `W${8 - w}`, count });
    }
    return weeks;
  }, [completedPrograms]);

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">All Stores Overview</h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/content-admin")} className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Content
          </Button>
        </div>

        {/* Aggregate Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Users, label: "Active Programs", value: activePrograms.length, color: "text-primary" },
            { icon: Clock, label: "Avg Days to Cert", value: avgDaysToCert || "—", color: "text-secondary" },
            { icon: CheckCircle2, label: "On-Track %", value: `${onTrackPct}%`, color: "text-success" },
            { icon: Award, label: "Completed (Month)", value: completedThisMonth, color: "text-warning" },
          ].map((m) => (
            <Card key={m.label} className="p-4">
              <m.icon className={`h-5 w-5 ${m.color} mb-1`} />
              <p className="text-2xl font-bold text-foreground">{m.value}</p>
              <p className="text-[11px] text-muted-foreground">{m.label}</p>
            </Card>
          ))}
        </div>

        {/* Store Cards */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-2">Stores</h2>
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : !storeData.length ? (
            <Card className="p-8 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No active programs found</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {storeData.map(({ store, programs: progs, statusCounts: sc, avgProgress }) => (
                <Card
                  key={store.id}
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate(`/store/${store.id}`)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{store.store_name}</p>
                      <p className="text-[11px] text-muted-foreground">{store.brand} · {progs.length} program{progs.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <Progress value={avgProgress} className="h-1.5 mb-2" />
                  <div className="flex items-center gap-3">
                    <StatusDot status="on_track" count={sc.on_track} />
                    <StatusDot status="behind" count={sc.behind} />
                    <StatusDot status="needs_attention" count={sc.needs_attention} />
                    <span className="ml-auto text-xs font-semibold text-muted-foreground">{avgProgress}%</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Needs Work Indicators */}
        {needsWorkTasks.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-foreground mb-2">
              <AlertTriangle className="inline h-4 w-4 mr-1 text-warning" />
              Common Training Gaps
            </h2>
            <Card className="divide-y divide-border">
              {needsWorkTasks.map((t, i) => (
                <div key={t.taskId} className="flex items-center gap-3 p-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">Day {t.dayNumber}</p>
                  </div>
                  <span className="text-sm font-bold text-warning">{t.count}×</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Weekly Completions Chart */}
        {weeklyCompletions.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-foreground mb-2">
              <TrendingUp className="inline h-4 w-4 mr-1" />
              Programs Completed per Week
            </h2>
            <Card className="p-4">
              <ChartContainer config={{ count: { label: "Completed", color: "hsl(var(--success))" } }} className="h-48 w-full">
                <BarChart data={weeklyCompletions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </Card>
          </div>
        )}
      </div>
      <InviteFAB />
    </AppShell>
  );
}
