import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ChevronLeft, Building2, Users, TrendingUp } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

export default function StoreDetailPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { data: programs, isLoading } = useAllActivePrograms();
  const { data: allTasks } = useAllTasks();
  const { data: days } = useDays();
  const { data: completions } = useAllCompletions();
  const { data: ratings } = useAllRatings();
  const { data: profiles } = useAllProfiles();
  const { data: stores } = useStores();

  const store = stores?.find((s) => s.id === storeId);
  const storePrograms = useMemo(
    () => programs?.filter((p) => p.store_id === storeId) || [],
    [programs, storeId]
  );
  const profileMap = useMemo(() => new Map(profiles?.map((p) => [p.user_id, p])), [profiles]);
  const dayMap = useMemo(() => new Map(days?.map((d) => [d.day_number, d])), [days]);

  const avgProgress = useMemo(() => {
    if (!storePrograms.length || !allTasks?.length || !completions) return 0;
    return Math.round(storePrograms.reduce((s, p) => s + calcProgress(p.id, allTasks, completions), 0) / storePrograms.length);
  }, [storePrograms, allTasks, completions]);

  const statusCounts = useMemo(() => {
    const counts = { on_track: 0, behind: 0, needs_attention: 0 };
    storePrograms.forEach((p) => { counts[getAssociateStatusFromData(p, ratings || [])]++; });
    return counts;
  }, [storePrograms, ratings]);

  const weeklyTrend = useMemo(() => {
    if (!completions?.length) return [];
    const now = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      const w = 3 - i;
      const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 7);
      const wc = completions.filter((c) => c.completed_at && new Date(c.completed_at) >= weekStart && new Date(c.completed_at) <= weekEnd && storePrograms.some((p) => p.id === c.program_id));
      return {
        label: `Week ${i + 1}`,
        avg: storePrograms.length ? Math.round((wc.length / (storePrograms.length * (allTasks?.length || 1))) * 100) : 0,
      };
    });
  }, [completions, storePrograms, allTasks]);

  return (
    <AppShell>
      <div className="px-4 py-4 animate-fade-in space-y-4">
        <Button variant="ghost" size="sm" className="gap-1 -ml-2 text-muted-foreground" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{store?.store_name || "Store"}</h1>
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

        <div className="flex gap-3">
          {([
            { key: "on_track" as const, label: "On Track", color: "bg-success/10 border-success/20" },
            { key: "behind" as const, label: "Behind", color: "bg-destructive/10 border-destructive/20" },
            { key: "needs_attention" as const, label: "Attention", color: "bg-warning/10 border-warning/20" },
          ]).map((s) => (
            <div key={s.key} className={`flex-1 rounded-xl border p-3 text-center ${s.color}`}>
              <p className="text-2xl font-bold text-foreground">{statusCounts[s.key]}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        <div>
          <h2 className="text-base font-bold text-foreground mb-2">Associates</h2>
          {isLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : !storePrograms.length ? (
            <Card className="p-8 text-center"><Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-sm text-muted-foreground">No active programs</p></Card>
          ) : (
            <div className="space-y-2">
              {storePrograms.map((program) => {
                const p = profileMap.get(program.associate_id);
                const day = dayMap.get(program.current_day);
                const status = getAssociateStatusFromData(program, ratings || []);
                const progress = allTasks ? calcProgress(program.id, allTasks, completions || []) : 0;
                const initials = (p?.full_name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <Card key={program.id} className="p-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/checkin/${program.id}/${program.current_day}`)}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{initials}</AvatarFallback></Avatar>
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

        {weeklyTrend.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-foreground mb-2"><TrendingUp className="inline h-4 w-4 mr-1" />Weekly Trend</h2>
            <Card className="p-4">
              <ChartContainer config={{ avg: { label: "Avg %", color: "hsl(var(--secondary))" } }} className="h-48 w-full">
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
    </AppShell>
  );
}
