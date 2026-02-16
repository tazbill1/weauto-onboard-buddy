import { useNavigate } from "react-router-dom";
import { InviteFAB } from "@/components/InviteFAB";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useDays,
  useAllTasks,
  useAllActivePrograms,
} from "@/hooks/useOnboardingData";
import {
  useAllCompletions,
  useAllRatings,
  useAllProfiles,
  useStores,
  getAssociateStatusFromData,
  calcProgress,
} from "@/hooks/useDashboardData";
import { Building2, Users, TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { useMemo, useEffect } from "react";

export default function GMOverviewPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { document.title = "Overview — WEAuto"; }, []);
  const { data: programs, isLoading } = useAllActivePrograms();
  const { data: allTasks } = useAllTasks();
  const { data: days } = useDays();
  const { data: completions } = useAllCompletions();
  const { data: ratings } = useAllRatings();
  const { data: profiles } = useAllProfiles();
  const { data: stores } = useStores();

  const storeId = profile?.store_id;
  const store = stores?.find((s) => s.id === storeId);

  // Filter to this store's programs
  const storePrograms = useMemo(
    () => programs?.filter((p) => p.store_id === storeId) || [],
    [programs, storeId]
  );

  const profileMap = useMemo(
    () => new Map(profiles?.map((p) => [p.user_id, p])),
    [profiles]
  );

  const avgProgress = useMemo(() => {
    if (!storePrograms.length || !allTasks?.length || !completions) return 0;
    const total = storePrograms.reduce(
      (sum, p) => sum + calcProgress(p.id, allTasks, completions),
      0
    );
    return Math.round(total / storePrograms.length);
  }, [storePrograms, allTasks, completions]);

  const statusCounts = useMemo(() => {
    const counts = { on_track: 0, behind: 0, needs_attention: 0 };
    storePrograms.forEach((p) => {
      const s = getAssociateStatusFromData(p, ratings || []);
      counts[s]++;
    });
    return counts;
  }, [storePrograms, ratings]);

  // Weekly trend: average completion rate over past 4 weeks
  const weeklyTrend = useMemo(() => {
    if (!completions?.length) return [];
    const now = new Date();
    const weeks: { label: string; avg: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      const weekCompletions = completions.filter((c) => {
        if (!c.completed_at) return false;
        const d = new Date(c.completed_at);
        return d >= weekStart && d <= weekEnd;
      });
      const storeCompletions = weekCompletions.filter((c) =>
        storePrograms.some((p) => p.id === c.program_id)
      );
      weeks.push({
        label: `Week ${4 - w}`,
        avg: storePrograms.length > 0
          ? Math.round((storeCompletions.length / (storePrograms.length * (allTasks?.length || 1))) * 100)
          : 0,
      });
    }
    return weeks;
  }, [completions, storePrograms, allTasks]);

  const dayMap = useMemo(
    () => new Map(days?.map((d) => [d.day_number, d])),
    [days]
  );

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-5">
        {/* Store Summary */}
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{store?.store_name || "My Store"}</h1>
              <p className="text-xs text-muted-foreground">{store?.brand}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{storePrograms.length}</p>
              <p className="text-[11px] text-muted-foreground">Active Programs</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{avgProgress}%</p>
              <p className="text-[11px] text-muted-foreground">Avg Progress</p>
            </div>
          </div>
        </Card>

        {/* Status Breakdown */}
        <div className="flex gap-3">
          {([
            { key: "on_track" as const, label: "On Track", color: "bg-success/10 border-success/20" },
            { key: "behind" as const, label: "Behind", color: "bg-destructive/10 border-destructive/20" },
            { key: "needs_attention" as const, label: "Needs Attention", color: "bg-warning/10 border-warning/20" },
          ]).map((s) => (
            <div key={s.key} className={`flex-1 rounded-xl border p-3 text-center ${s.color}`}>
              <p className="text-2xl font-bold text-foreground">{statusCounts[s.key]}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Associates List */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-2">Active Associates</h2>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ) : !storePrograms.length ? (
            <Card className="p-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No active onboarding programs</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {storePrograms.map((program) => {
                const p = profileMap.get(program.associate_id);
                const day = dayMap.get(program.current_day);
                const status = getAssociateStatusFromData(program, ratings || []);
                const progress = allTasks
                  ? calcProgress(program.id, allTasks, completions || [])
                  : 0;
                const initials = (p?.full_name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

                return (
                  <Card
                    key={program.id}
                    className="p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate(`/checkin/${program.id}/${program.current_day}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{p?.full_name || "Unknown"}</span>
                          <StatusBadge status={status} />
                        </div>
                        <p className="text-xs text-muted-foreground">Day {program.current_day} · {day?.title || ""}</p>
                        <Progress value={progress} className="h-1.5 mt-1.5" />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">{progress}%</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Weekly Trend Chart */}
        {weeklyTrend.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-foreground mb-2">
              <TrendingUp className="inline h-4 w-4 mr-1" />
              Weekly Completion Trend
            </h2>
            <Card className="p-4">
              <ChartContainer config={{ avg: { label: "Avg Completion %", color: "hsl(var(--secondary))" } }} className="h-48 w-full">
                <LineChart data={weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis domain={[0, 100]} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="avg" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            </Card>
          </div>
        )}
      </div>
      <InviteFAB />
    </AppShell>
  );
}
