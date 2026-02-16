import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDays,
  useAllActivePrograms,
  useManagedPrograms,
  useProfiles,
  useRatingsForProgram,
  usePendingUploads,
  getPhaseLabel,
  getAssociateStatus,
} from "@/hooks/useOnboardingData";
import type { OnboardingProgram, PerformanceRating, ProfileBasic, Day } from "@/hooks/useOnboardingData";
import { Users, Video, Image, FileText, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function StatusBadge({ status }: { status: "on_track" | "behind" | "needs_attention" }) {
  const config = {
    on_track: { label: "On Track", className: "bg-success/10 text-success" },
    behind: { label: "Behind", className: "bg-destructive/10 text-destructive" },
    needs_attention: { label: "Needs Attention", className: "bg-warning/10 text-warning" },
  };
  const c = config[status];
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.className}`}>
      {c.label}
    </span>
  );
}

function FileTypeIcon({ type }: { type: string }) {
  if (type === "video") return <Video className="h-4 w-4 text-secondary" />;
  if (type === "image") return <Image className="h-4 w-4 text-secondary" />;
  return <FileText className="h-4 w-4 text-secondary" />;
}

function AssociateCard({
  program,
  profile,
  day,
  ratings,
  days,
}: {
  program: OnboardingProgram;
  profile: ProfileBasic | undefined;
  day: Day | undefined;
  ratings: PerformanceRating[];
  days: Day[];
}) {
  const navigate = useNavigate();
  const initials = (profile?.full_name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const status = getAssociateStatus(program, ratings, days);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-11 w-11">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground truncate">
              {profile?.full_name || "Unknown"}
            </h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Day {program.current_day} · {day?.title || ""}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {day ? getPhaseLabel(day.phase) : ""}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        className="w-full mt-3 h-10"
        onClick={() => navigate(`/checkin/${program.id}/${program.current_day}`)}
      >
        Check In – Day {program.current_day}
      </Button>
    </Card>
  );
}

function PendingReviewItem({ upload, profile, task }: { upload: any; profile: any; task: any }) {
  const navigate = useNavigate();
  const timeAgo = upload.uploaded_at
    ? new Date(upload.uploaded_at).toLocaleDateString()
    : "";

  return (
    <button
      onClick={() => navigate(`/review/${upload.id}`)}
      className="flex items-center gap-3 w-full text-left p-3 rounded-xl hover:bg-muted/50 transition-colors touch-target"
    >
      <FileTypeIcon type={upload.file_type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {task?.title || "Task"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {profile?.full_name || "Associate"} · {timeAgo}
        </p>
      </div>
      <Clock className="h-4 w-4 text-warning flex-shrink-0" />
    </button>
  );
}

export default function ManagerDashboardPage() {
  const { profile } = useAuth();
  const isManager = profile?.role === "sales_manager";
  const { data: managedPrograms, isLoading: managedLoading } = useManagedPrograms();
  const { data: allPrograms, isLoading: allLoading } = useAllActivePrograms();
  const { data: days } = useDays();
  const { data: pendingUploads } = usePendingUploads();

  const programs = isManager ? managedPrograms : allPrograms;
  const isLoading = isManager ? managedLoading : allLoading;

  const associateIds = programs?.map((p) => p.associate_id) || [];
  const uploadUserIds = pendingUploads?.map((u) => u.uploaded_by) || [];
  const allUserIds = [...new Set([...associateIds, ...uploadUserIds])];
  const { data: profiles } = useProfiles(allUserIds);
  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

  // Fetch tasks for pending uploads
  const taskIds = pendingUploads?.map((u) => u.task_id) || [];
  const { data: pendingTasks } = useQuery({
    queryKey: ["tasks-for-uploads", taskIds],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
        .in("id", taskIds);
      if (error) throw error;
      return data as any[];
    },
  });
  const taskMap = new Map(pendingTasks?.map((t: any) => [t.id, t]));

  const firstName = profile?.full_name?.split(" ")[0] || "Manager";
  const pendingCount = pendingUploads?.length || 0;

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hi, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {programs?.length || 0} active associate{(programs?.length || 0) !== 1 ? "s" : ""} in onboarding
          </p>
        </div>

        {/* Pending Reviews */}
        {pendingCount > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-base font-bold text-foreground">Pending Reviews</h2>
              <span className="bg-warning text-warning-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            </div>
            <Card className="divide-y divide-border">
              {pendingUploads!.map((upload) => (
                <PendingReviewItem
                  key={upload.id}
                  upload={upload}
                  profile={profileMap.get(upload.uploaded_by)}
                  task={taskMap.get(upload.task_id)}
                />
              ))}
            </Card>
          </div>
        )}

        {/* Associates */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-2">Associates</h2>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          ) : !programs?.length ? (
            <Card className="p-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No active associates in onboarding</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {programs.map((program) => (
                <AssociateCard
                  key={program.id}
                  program={program}
                  profile={profileMap.get(program.associate_id)}
                  day={days?.find((d) => d.day_number === program.current_day)}
                  ratings={[]}
                  days={days || []}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
