import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDays,
  useAllTasks,
} from "@/hooks/useOnboardingData";
import {
  useAllPrograms,
  useAllCompletions,
  useAllRatings,
  useAllSignoffs,
  useAllProfiles,
  useStores,
  getAssociateStatusFromData,
  csvDownload,
} from "@/hooks/useDashboardData";
import { Download, Search } from "lucide-react";
import { friendlyDate } from "@/lib/dateUtils";

type ReportType = "active" | "completion" | "gaps" | "manager";

export default function ReportsPage() {
  const { profile } = useAuth();
  const [reportType, setReportType] = useState<ReportType>("active");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => { document.title = "Reports — WEAuto"; }, []);

  const { data: programs } = useAllPrograms();
  const { data: allTasks } = useAllTasks();
  const { data: days } = useDays();
  const { data: completions } = useAllCompletions();
  const { data: ratings, isLoading } = useAllRatings();
  const { data: signoffs } = useAllSignoffs();
  const { data: profiles } = useAllProfiles();
  const { data: stores } = useStores();

  const profileMap = useMemo(() => new Map(profiles?.map((p) => [p.user_id, p])), [profiles]);
  const storeMap = useMemo(() => new Map(stores?.map((s) => [s.id, s])), [stores]);
  const dayMap = useMemo(() => new Map(days?.map((d) => [d.id, d])), [days]);

  // Filter stores visible to this user
  const visibleStores = useMemo(() => {
    if (!stores) return [];
    if (profile?.role === "gm") return stores.filter((s) => s.id === profile.store_id);
    return stores;
  }, [stores, profile]);

  const filteredPrograms = useMemo(() => {
    if (!programs) return [];
    let fp = programs;
    if (storeFilter !== "all") fp = fp.filter((p) => p.store_id === storeFilter);
    if (profile?.role === "gm" && profile.store_id) fp = fp.filter((p) => p.store_id === profile.store_id);
    return fp;
  }, [programs, storeFilter, profile]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const sortFn = (a: any, b: any) => {
    if (!sortCol) return 0;
    const va = a[sortCol] ?? "";
    const vb = b[sortCol] ?? "";
    const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
    return sortAsc ? cmp : -cmp;
  };

  // Active Programs Report
  const activeRows = useMemo(() => {
    const active = filteredPrograms.filter((p) => p.status === "active");
    return active.map((p) => {
      const prof = profileMap.get(p.associate_id);
      const mgr = profileMap.get(p.manager_id);
      const store = storeMap.get(p.store_id);
      const status = getAssociateStatusFromData(p, ratings || []);
      const startDate = new Date(p.start_date);
      const daysDiff = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const expectedDay = Math.min(daysDiff + 1, 20);
      return {
        name: prof?.full_name || "Unknown",
        store: store?.store_name || "",
        start_date: p.start_date,
        current_day: p.current_day,
        expected_day: expectedDay,
        status,
        manager: mgr?.full_name || "Unknown",
      };
    }).filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase())).sort(sortFn);
  }, [filteredPrograms, profileMap, storeMap, ratings, search, sortCol, sortAsc]);

  // Completion Report
  const completionRows = useMemo(() => {
    const completed = filteredPrograms.filter((p) => p.status === "completed");
    return completed.map((p) => {
      const prof = profileMap.get(p.associate_id);
      const mgr = profileMap.get(p.manager_id);
      const store = storeMap.get(p.store_id);
      const progRatings = (ratings || []).filter((r) => r.program_id === p.id);
      const meetsCount = progRatings.filter((r) => r.rating === "meets_expectation").length;
      const needsWorkCount = progRatings.filter((r) => r.rating === "needs_work").length;
      const daysToComplete = p.actual_end_date
        ? Math.floor((new Date(p.actual_end_date).getTime() - new Date(p.start_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        name: prof?.full_name || "Unknown",
        store: store?.store_name || "",
        start_date: p.start_date,
        completion_date: p.actual_end_date || "",
        days_to_complete: daysToComplete,
        meets: meetsCount,
        needs_work: needsWorkCount,
        manager: mgr?.full_name || "Unknown",
      };
    }).sort(sortFn);
  }, [filteredPrograms, profileMap, storeMap, ratings, sortCol, sortAsc]);

  // Performance Gaps Report
  const gapRows = useMemo(() => {
    if (!ratings || !allTasks || !days) return [];
    let scopeRatings = ratings;
    if (storeFilter !== "all") {
      const programIds = new Set(filteredPrograms.map((p) => p.id));
      scopeRatings = ratings.filter((r) => programIds.has(r.program_id));
    }
    const taskCounts: Record<string, { nw: number; na: number; total: number }> = {};
    scopeRatings.forEach((r) => {
      if (!taskCounts[r.task_id]) taskCounts[r.task_id] = { nw: 0, na: 0, total: 0 };
      taskCounts[r.task_id].total++;
      if (r.rating === "needs_work") taskCounts[r.task_id].nw++;
      if (r.rating === "not_attempted") taskCounts[r.task_id].na++;
    });
    const taskMap = new Map(allTasks.map((t) => [t.id, t]));
    return Object.entries(taskCounts)
      .filter(([, c]) => c.nw > 0 || c.na > 0)
      .sort(([, a], [, b]) => (b.nw + b.na) - (a.nw + a.na))
      .map(([tid, c]) => {
        const task = taskMap.get(tid);
        const day = task ? dayMap.get(task.day_id) : undefined;
        return {
          title: task?.title || "Unknown",
          day_number: day?.day_number || 0,
          needs_work: c.nw,
          not_attempted: c.na,
          struggle_pct: c.total > 0 ? Math.round(((c.nw + c.na) / c.total) * 100) : 0,
        };
      });
  }, [ratings, allTasks, days, filteredPrograms, storeFilter, dayMap]);

  // Manager Activity Report
  const managerRows = useMemo(() => {
    if (!profiles || !programs || !signoffs) return [];
    const managers = profiles.filter((p) => ["sales_manager", "gm"].includes(p.role));
    return managers.map((mgr) => {
      const store = storeMap.get(mgr.store_id || "");
      const mgrPrograms = (programs || []).filter((p) => p.manager_id === mgr.user_id && p.status === "active");
      const mgrSignoffs = (signoffs || []).filter((s) => s.manager_id === mgr.user_id);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthSignoffs = mgrSignoffs.filter((s) => new Date(s.signed_off_at) >= monthStart).length;

      // Avg days between check-ins
      const sorted = mgrSignoffs.sort((a, b) => new Date(a.signed_off_at).getTime() - new Date(b.signed_off_at).getTime());
      let avgGap = 0;
      if (sorted.length > 1) {
        const gaps = sorted.slice(1).map((s, i) =>
          Math.floor((new Date(s.signed_off_at).getTime() - new Date(sorted[i].signed_off_at).getTime()) / (1000 * 60 * 60 * 24))
        );
        avgGap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
      }

      // Pending reviews: programs where last sign-off was > 48 hours ago
      const pendingCount = mgrPrograms.filter((p) => {
        const latestSignoff = mgrSignoffs.filter((s) => s.program_id === p.id).sort((a, b) => new Date(b.signed_off_at).getTime() - new Date(a.signed_off_at).getTime())[0];
        if (!latestSignoff) return true;
        return (now.getTime() - new Date(latestSignoff.signed_off_at).getTime()) > 48 * 60 * 60 * 1000;
      }).length;

      return {
        name: mgr.full_name || mgr.email,
        store: store?.store_name || "",
        active_associates: mgrPrograms.length,
        avg_gap: avgGap,
        signoffs_month: monthSignoffs,
        pending: pendingCount,
        overdue: pendingCount > 0,
      };
    }).filter((m) => storeFilter === "all" || m.store === storeMap.get(storeFilter)?.store_name).sort(sortFn);
  }, [profiles, programs, signoffs, storeMap, storeFilter, sortCol, sortAsc]);

  const handleExport = () => {
    if (reportType === "active") {
      csvDownload("active-programs.csv",
        ["Name", "Store", "Start Date", "Current Day", "Expected Day", "Status", "Manager"],
        activeRows.map((r) => [r.name, r.store, r.start_date, String(r.current_day), String(r.expected_day), r.status, r.manager])
      );
    } else if (reportType === "completion") {
      csvDownload("completion-report.csv",
        ["Name", "Store", "Start Date", "Completion Date", "Days to Complete", "Meets Expectation", "Needs Work", "Manager"],
        completionRows.map((r) => [r.name, r.store, r.start_date, r.completion_date, String(r.days_to_complete), String(r.meets), String(r.needs_work), r.manager])
      );
    } else if (reportType === "gaps") {
      csvDownload("performance-gaps.csv",
        ["Task Title", "Day", "Needs Work", "Not Attempted", "Struggle %"],
        gapRows.map((r) => [r.title, String(r.day_number), String(r.needs_work), String(r.not_attempted), `${r.struggle_pct}%`])
      );
    } else if (reportType === "manager") {
      csvDownload("manager-activity.csv",
        ["Manager", "Store", "Active Associates", "Avg Days Between Check-ins", "Sign-offs This Month", "Pending Reviews"],
        managerRows.map((r) => [r.name, r.store, String(r.active_associates), String(r.avg_gap), String(r.signoffs_month), String(r.pending)])
      );
    }
  };

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort(col)}>
      {children} {sortCol === col ? (sortAsc ? "↑" : "↓") : ""}
    </TableHead>
  );

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>

        {/* Report Type Selector */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: "active" as const, label: "Active Programs" },
            { key: "completion" as const, label: "Completion" },
            { key: "gaps" as const, label: "Performance Gaps" },
            { key: "manager" as const, label: "Manager Activity" },
          ]).map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={reportType === r.key ? "default" : "outline"}
              onClick={() => { setReportType(r.key); setSearch(""); setSortCol(""); }}
            >
              {r.label}
            </Button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {visibleStores.length > 1 && (
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {visibleStores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {reportType === "active" && (
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search associate..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
          )}
          <Button size="sm" variant="outline" className="gap-1" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Report Content */}
        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-2xl" />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              {reportType === "active" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader col="name">Name</SortHeader>
                      <SortHeader col="store">Store</SortHeader>
                      <SortHeader col="start_date">Start</SortHeader>
                      <SortHeader col="current_day">Day</SortHeader>
                      <SortHeader col="expected_day">Expected</SortHeader>
                      <SortHeader col="status">Status</SortHeader>
                      <SortHeader col="manager">Manager</SortHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.store}</TableCell>
                        <TableCell>{r.start_date}</TableCell>
                        <TableCell>{r.current_day}</TableCell>
                        <TableCell>{r.expected_day}</TableCell>
                        <TableCell>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            r.status === "on_track" ? "bg-success/10 text-success" :
                            r.status === "behind" ? "bg-destructive/10 text-destructive" :
                            "bg-warning/10 text-warning"
                          }`}>{r.status === "on_track" ? "On Track" : r.status === "behind" ? "Behind" : "Needs Attention"}</span>
                        </TableCell>
                        <TableCell>{r.manager}</TableCell>
                      </TableRow>
                    ))}
                    {!activeRows.length && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No active programs</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {reportType === "completion" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader col="name">Name</SortHeader>
                      <SortHeader col="store">Store</SortHeader>
                      <SortHeader col="start_date">Start</SortHeader>
                      <SortHeader col="completion_date">Completed</SortHeader>
                      <SortHeader col="days_to_complete">Days</SortHeader>
                      <SortHeader col="meets">Meets</SortHeader>
                      <SortHeader col="needs_work">Needs Work</SortHeader>
                      <SortHeader col="manager">Manager</SortHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completionRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.store}</TableCell>
                        <TableCell>{r.start_date}</TableCell>
                        <TableCell>{r.completion_date}</TableCell>
                        <TableCell>{r.days_to_complete}</TableCell>
                        <TableCell className="text-success font-semibold">{r.meets}</TableCell>
                        <TableCell className="text-warning font-semibold">{r.needs_work}</TableCell>
                        <TableCell>{r.manager}</TableCell>
                      </TableRow>
                    ))}
                    {!completionRows.length && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No completed programs</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {reportType === "gaps" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader col="title">Task</SortHeader>
                      <SortHeader col="day_number">Day</SortHeader>
                      <SortHeader col="needs_work">Needs Work</SortHeader>
                      <SortHeader col="not_attempted">Not Attempted</SortHeader>
                      <SortHeader col="struggle_pct">Struggle %</SortHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gapRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell>Day {r.day_number}</TableCell>
                        <TableCell className="text-warning font-semibold">{r.needs_work}</TableCell>
                        <TableCell className="text-destructive font-semibold">{r.not_attempted}</TableCell>
                        <TableCell>{r.struggle_pct}%</TableCell>
                      </TableRow>
                    ))}
                    {!gapRows.length && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No performance gaps found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {reportType === "manager" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader col="name">Manager</SortHeader>
                      <SortHeader col="store">Store</SortHeader>
                      <SortHeader col="active_associates">Active</SortHeader>
                      <SortHeader col="avg_gap">Avg Gap (days)</SortHeader>
                      <SortHeader col="signoffs_month">Sign-offs</SortHeader>
                      <SortHeader col="pending">Pending</SortHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managerRows.map((r, i) => (
                      <TableRow key={i} className={r.overdue ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.store}</TableCell>
                        <TableCell>{r.active_associates}</TableCell>
                        <TableCell>{r.avg_gap || "—"}</TableCell>
                        <TableCell>{r.signoffs_month}</TableCell>
                        <TableCell className={r.overdue ? "text-destructive font-bold" : ""}>{r.pending}</TableCell>
                      </TableRow>
                    ))}
                    {!managerRows.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No managers found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
