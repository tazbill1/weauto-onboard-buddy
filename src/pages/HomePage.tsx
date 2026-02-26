import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { OnboardingFlow, useShowOnboarding } from "@/components/OnboardingFlow";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DashboardTab } from "@/components/home/DashboardTab";
import { JourneyTab } from "@/components/home/JourneyTab";
import GMOverviewPage from "./GMOverviewPage";
import CorporateDashboardPage from "./CorporateDashboardPage";
import ManagerDashboardPage from "./ManagerDashboardPage";
import {
  useDays,
  useMyProgram,
  useTasksForDay,
  useCompletions,
  useAllTasks,
  useToggleCompletion,
  useDepartment,
} from "@/hooks/useOnboardingData";
import { useNotifications } from "@/hooks/useNotifications";
import { useEffect } from "react";
import { LayoutDashboard, MapIcon } from "lucide-react";

export default function HomePage() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const isAssociate = profile?.role === "user";
  const { show: showOnboarding, dismiss: dismissOnboarding } = useShowOnboarding();

  const { data: program } = useMyProgram();
  const departmentId = program?.department_id;
  const { data: department } = useDepartment(departmentId);
  const { data: days, isLoading: daysLoading } = useDays(departmentId);
  const { data: allTasks } = useAllTasks();
  const { data: completions } = useCompletions(program?.id);
  const toggleCompletion = useToggleCompletion();
  const { data: notifications } = useNotifications();
  const recentUnread = notifications?.filter((n) => !n.is_read).slice(0, 3) || [];
  const isBehindSchedule = notifications?.some((n) => n.type === "behind_schedule" && !n.is_read);

  useEffect(() => { document.title = "Home — WEAuto Onboarding"; }, []);

  const currentDayNumber = program?.current_day || 1;
  const currentDay = days?.find((d) => d.day_number === currentDayNumber);
  const { data: currentDayTasks } = useTasksForDay(currentDay?.id);

  const departmentDayIds = new Set(days?.map((d) => d.id) || []);
  const deptTasks = allTasks?.filter((t) => departmentDayIds.has(t.day_id)) || [];

  const totalTasks = deptTasks.length;
  const completedCount = completions?.filter((c) => c.status === "completed").length || 0;
  const progress = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  const totalDays = department?.typical_duration_days || days?.length || 20;
  const noDaysYet = days && days.length === 0 && !!program;

  const completedDays = new Set<number>();
  if (days && deptTasks.length > 0 && completions) {
    for (const day of days) {
      const dayTasks = deptTasks.filter((t) => t.day_id === day.id);
      if (dayTasks.length > 0 && dayTasks.every((t) => completions.some((c) => c.task_id === t.id && c.status === "completed"))) {
        completedDays.add(day.day_number);
      }
    }
  }

  const tasksBySection = (currentDayTasks || []).reduce((acc, task) => {
    if (!acc[task.section]) acc[task.section] = [];
    acc[task.section].push(task);
    return acc;
  }, {} as Record<string, typeof currentDayTasks>);

  const completionMap = new globalThis.Map(completions?.map((c) => [c.task_id, c]));

  // Role-specific home pages
  if (profile?.role === "location_admin") return <GMOverviewPage />;
  if (profile?.role === "app_admin") return <CorporateDashboardPage />;
  if (profile?.role === "manager") return <ManagerDashboardPage />;

  // Onboarding flow for first-time associates
  if (isAssociate && showOnboarding) {
    return <OnboardingFlow onComplete={dismissOnboarding} />;
  }

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="w-full mb-5">
            <TabsTrigger value="dashboard" className="flex-1 gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="journey" className="flex-1 gap-1.5">
              <MapIcon className="h-4 w-4" />
              Journey
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab
              firstName={firstName}
              program={program}
              department={department}
              currentDay={currentDay}
              currentDayNumber={currentDayNumber}
              totalDays={totalDays}
              progress={progress}
              daysLoading={daysLoading}
              noDaysYet={!!noDaysYet}
              isBehindSchedule={!!isBehindSchedule}
              recentUnread={recentUnread}
              tasksBySection={tasksBySection}
              completionMap={completionMap}
              toggleCompletion={toggleCompletion}
            />
          </TabsContent>

          <TabsContent value="journey">
            <JourneyTab
              days={days}
              currentDay={currentDayNumber}
              completedDays={completedDays}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
