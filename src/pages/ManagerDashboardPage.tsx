import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  useDays,
  useAllActivePrograms,
  useManagedPrograms,
  useProfiles,
  useRatingsForProgram,
  usePendingUploads,
  useSignoffsForProgram,
  getPhaseLabel,
  getAssociateStatus,
  useDepartments,
} from "@/hooks/useOnboardingData";
import type { OnboardingProgram, PerformanceRating, ProfileBasic, Day, DailySignoff, Department } from "@/hooks/useOnboardingData";
import { useNotifications } from "@/hooks/useNotifications";
import { InviteFAB } from "@/components/InviteFAB";
import { DepartmentBadge } from "@/components/DepartmentBadge";
import { Users, Video, Image, FileText, Clock, Trophy, ChevronDown, ChevronUp, CheckSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
  onCompleted,
  departmentLabel,
  departmentSlug,
}: {
  program: OnboardingProgram;
  profile: ProfileBasic | undefined;
  day: Day | undefined;
  ratings: PerformanceRating[];
  days: Day[];
  onCompleted: () => void;
  departmentLabel?: string;
  departmentSlug?: string;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState(false);
  const [showSignoff, setShowSignoff] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [bulkSigning, setBulkSigning] = useState(false);

  const { data: signoffs } = useSignoffsForProgram(program.id);
  const signedOffDayNums = new Set(signoffs?.map((s: DailySignoff) => s.day_number) || []);

  // Past days (up to current_day - 1) that haven't been signed off
  const unsignedPastDays = days
    .filter((d) => d.day_number < program.current_day && !signedOffDayNums.has(d.day_number))
    .sort((a, b) => a.day_number - b.day_number);

  const initials = (profile?.full_name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const status = getAssociateStatus(program, ratings, days);
  const isDay20Done = program.current_day >= 20;

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const { error } = await supabase
        .from("onboarding_programs" as any)
        .update({
          status: "completed",
          actual_end_date: format(new Date(), "yyyy-MM-dd"),
        } as any)
        .eq("id", program.id);
      if (error) throw error;
      toast({ title: "🎉 Program completed!", description: `${profile?.full_name || "Associate"} is now certified.` });
      onCompleted();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  const toggleDay = (dayNum: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum]
    );
  };

  const handleBulkSignoff = async () => {
    if (!user || selectedDays.length === 0) return;
    setBulkSigning(true);
    try {
      const inserts = selectedDays.map((dayNumber) => ({
        program_id: program.id,
        day_number: dayNumber,
        manager_id: user.id,
        overall_notes: null,
        signed_off_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("daily_signoffs" as any)
        .upsert(inserts as any, { onConflict: "program_id,day_number" });
      if (error) throw error;
      toast({ title: `✅ ${selectedDays.length} day${selectedDays.length > 1 ? "s" : ""} signed off!` });
      setSelectedDays([]);
      setShowSignoff(false);
      queryClient.invalidateQueries({ queryKey: ["signoffs", program.id] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBulkSigning(false);
    }
  };

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
            {departmentLabel && <DepartmentBadge label={departmentLabel} slug={departmentSlug} />}
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
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          className="flex-1 h-10"
          onClick={() => navigate(`/checkin/${program.id}/${program.current_day}`)}
        >
          Check In – Day {program.current_day}
        </Button>
        {unsignedPastDays.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-10 gap-1 text-secondary border-secondary/30 hover:bg-secondary/10"
            onClick={() => { setShowSignoff((v) => !v); setSelectedDays([]); }}
          >
            <CheckSquare className="h-4 w-4" />
            {showSignoff ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        )}
        {isDay20Done && (
          <ConfirmDialog
            title="Complete Onboarding Program?"
            description={`Mark ${profile?.full_name || "this associate"}'s 20-day program as completed and certified? This cannot be undone.`}
            confirmLabel="Complete & Certify"
            onConfirm={handleComplete}
            disabled={completing}
            trigger={
              <Button size="sm" variant="outline" className="gap-1 text-success border-success/30 hover:bg-success/10 h-10" disabled={completing}>
                <Trophy className="h-4 w-4" />
              </Button>
            }
          />
        )}
      </div>

      {/* Bulk Sign-off Panel */}
      {showSignoff && unsignedPastDays.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Sign off past days:</p>
          <div className="flex flex-wrap gap-2">
            {unsignedPastDays.map((d) => (
              <button
                key={d.day_number}
                onClick={() => toggleDay(d.day_number)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  selectedDays.includes(d.day_number)
                    ? "bg-secondary text-secondary-foreground border-secondary"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <span>Day {d.day_number}</span>
              </button>
            ))}
          </div>
          {selectedDays.length > 0 && (
            <ConfirmDialog
              title={`Sign Off ${selectedDays.length} Day${selectedDays.length > 1 ? "s" : ""}?`}
              description={`Confirm sign-off for Day${selectedDays.length > 1 ? "s" : ""} ${selectedDays.sort((a, b) => a - b).join(", ")} for ${profile?.full_name || "this associate"}.`}
              confirmLabel="Sign Off"
              onConfirm={handleBulkSignoff}
              disabled={bulkSigning}
              trigger={
                <Button size="sm" className="w-full h-9 gap-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground" disabled={bulkSigning}>
                  <CheckSquare className="h-3.5 w-3.5" />
                  Sign Off {selectedDays.length} Day{selectedDays.length > 1 ? "s" : ""}
                </Button>
              }
            />
          )}
        </div>
      )}
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
  const queryClient = useQueryClient();
  const isManager = profile?.role === "sales_manager";
  const { data: managedPrograms, isLoading: managedLoading } = useManagedPrograms();
  const { data: allPrograms, isLoading: allLoading } = useAllActivePrograms();
  const { data: days } = useDays();
  const { data: pendingUploads } = usePendingUploads();
  const { data: notifications } = useNotifications();
  const { data: departments } = useDepartments();
  const navigate = useNavigate();

  const deptMap = new Map(departments?.map((d) => [d.id, d]));

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

  // Behind schedule notifications
  const behindScheduleNotifs = notifications?.filter((n) => n.type === "behind_schedule" && !n.is_read) || [];
  const unreadNotifCount = notifications?.filter((n) => !n.is_read).length || 0;

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hi, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {programs?.length || 0} active associate{(programs?.length || 0) !== 1 ? "s" : ""} in onboarding
          </p>
        </div>

        {/* Notification Summary */}
        {(pendingCount > 0 || behindScheduleNotifs.length > 0) && (
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/reviews")}
              className="flex-1 rounded-xl bg-card border p-3 text-center hover:bg-muted/50 transition-colors"
            >
              <p className="text-2xl font-bold text-warning">{pendingCount}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Pending Reviews</p>
            </button>
            {behindScheduleNotifs.length > 0 && (
              <button
                onClick={() => navigate("/notifications")}
                className="flex-1 rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-center hover:bg-destructive/10 transition-colors"
              >
                <p className="text-2xl font-bold text-destructive">{behindScheduleNotifs.length}</p>
                <p className="text-[11px] text-destructive font-medium">Behind Schedule</p>
              </button>
            )}
            {unreadNotifCount > 0 && (
              <button
                onClick={() => navigate("/notifications")}
                className="flex-1 rounded-xl bg-card border p-3 text-center hover:bg-muted/50 transition-colors"
              >
                <p className="text-2xl font-bold text-secondary">{unreadNotifCount}</p>
                <p className="text-[11px] text-muted-foreground font-medium">Unread Alerts</p>
              </button>
            )}
          </div>
        )}

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
              <p className="text-sm font-semibold text-foreground mb-1">No active associates</p>
              <p className="text-xs text-muted-foreground mb-4">Invite a new team member to get started with onboarding.</p>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate("/invite")}>
                <Users className="h-3.5 w-3.5" /> Send an Invite
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {programs.map((program) => (
                <AssociateCard
                  key={program.id}
                  program={program}
                  profile={profileMap.get(program.associate_id)!}
                  day={days?.find((d) => d.day_number === program.current_day)}
                  ratings={[]}
                  days={days || []}
                  onCompleted={() => queryClient.invalidateQueries({ queryKey: ["managed-programs"] })}
                   departmentLabel={deptMap.get(program.department_id)?.label}
                   departmentSlug={deptMap.get(program.department_id)?.slug}
                 />
              ))}

            </div>
          )}
        </div>
      </div>
      <InviteFAB />
    </AppShell>
  );
}
