import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Day {
  id: string;
  day_number: number;
  week_number: number;
  phase: string;
  title: string;
  subtitle: string | null;
}

export interface Task {
  id: string;
  day_id: string;
  section: string;
  title: string;
  description: string | null;
  content_html: string | null;
  sort_order: number;
  requires_upload: boolean;
  requires_rating: boolean;
}

export interface TaskCompletion {
  id: string;
  program_id: string;
  task_id: string;
  associate_id: string;
  status: string;
  completed_at: string | null;
}

export interface OnboardingProgram {
  id: string;
  associate_id: string;
  manager_id: string;
  store_id: string;
  start_date: string;
  current_day: number;
  status: string;
}

export interface PerformanceRating {
  id: string;
  program_id: string;
  task_id: string;
  rated_by: string;
  rating: string;
  notes: string | null;
  rated_at: string;
}

export interface DailySignoff {
  id: string;
  program_id: string;
  day_number: number;
  manager_id: string;
  overall_notes: string | null;
  signed_off_at: string;
}

export interface ProfileBasic {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  avatar_url: string | null;
  store_id: string | null;
}

export interface UploadRecord {
  id: string;
  program_id: string;
  task_id: string;
  uploaded_by: string;
  file_url: string;
  file_type: string;
  file_name: string;
  file_size: number;
  status: string;
  reviewed_by: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  uploaded_at: string;
}

// ── Queries ──

export function useDays() {
  return useQuery({
    queryKey: ["days"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("days" as any)
        .select("*")
        .order("day_number");
      if (error) throw error;
      return data as unknown as Day[];
    },
  });
}

export function useTasksForDay(dayId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", dayId],
    enabled: !!dayId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
        .eq("day_id", dayId!)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as Task[];
    },
  });
}

export function useMyProgram() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-program", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_programs" as any)
        .select("*")
        .eq("associate_id", user!.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as OnboardingProgram | null;
    },
  });
}

export function useCompletions(programId: string | undefined) {
  return useQuery({
    queryKey: ["completions", programId],
    enabled: !!programId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions" as any)
        .select("*")
        .eq("program_id", programId!);
      if (error) throw error;
      return data as unknown as TaskCompletion[];
    },
  });
}

export function useAllTasks() {
  return useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as unknown as Task[];
    },
  });
}

export function useToggleCompletion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      programId,
      taskId,
      currentStatus,
    }: {
      programId: string;
      taskId: string;
      currentStatus: string | undefined;
    }) => {
      if (!user) throw new Error("Not authenticated");

      if (currentStatus === "completed") {
        const { error } = await supabase
          .from("task_completions" as any)
          .update({ status: "not_started", completed_at: null } as any)
          .eq("program_id", programId)
          .eq("task_id", taskId);
        if (error) throw error;
      } else if (!currentStatus || currentStatus === "not_started") {
        const { error } = await supabase
          .from("task_completions" as any)
          .upsert(
            {
              program_id: programId,
              task_id: taskId,
              associate_id: user.id,
              status: "completed",
              completed_at: new Date().toISOString(),
            } as any,
            { onConflict: "program_id,task_id" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });
}

// ── Manager-specific hooks ──

export function useManagedPrograms() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["managed-programs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_programs" as any)
        .select("*")
        .eq("manager_id", user!.id)
        .eq("status", "active");
      if (error) throw error;
      return data as unknown as OnboardingProgram[];
    },
  });
}

export function useAllActivePrograms() {
  return useQuery({
    queryKey: ["all-active-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_programs" as any)
        .select("*")
        .eq("status", "active");
      if (error) throw error;
      return data as unknown as OnboardingProgram[];
    },
  });
}

export function useProfiles(userIds: string[]) {
  return useQuery({
    queryKey: ["profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, role, avatar_url, store_id")
        .in("user_id", userIds);
      if (error) throw error;
      return data as ProfileBasic[];
    },
  });
}

export function useRatingsForProgram(programId: string | undefined) {
  return useQuery({
    queryKey: ["ratings", programId],
    enabled: !!programId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_ratings" as any)
        .select("*")
        .eq("program_id", programId!);
      if (error) throw error;
      return data as unknown as PerformanceRating[];
    },
  });
}

export function useSignoffsForProgram(programId: string | undefined) {
  return useQuery({
    queryKey: ["signoffs", programId],
    enabled: !!programId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_signoffs" as any)
        .select("*")
        .eq("program_id", programId!);
      if (error) throw error;
      return data as unknown as DailySignoff[];
    },
  });
}

export function useUpsertRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      programId: string;
      taskId: string;
      ratedBy: string;
      rating: string;
      notes: string | null;
    }) => {
      const { error } = await supabase
        .from("performance_ratings" as any)
        .upsert(
          {
            program_id: params.programId,
            task_id: params.taskId,
            rated_by: params.ratedBy,
            rating: params.rating,
            notes: params.notes,
            rated_at: new Date().toISOString(),
          } as any,
          { onConflict: "program_id,task_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ratings"] });
    },
  });
}

export function useSignOffDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      programId: string;
      dayNumber: number;
      managerId: string;
      overallNotes: string | null;
    }) => {
      const { error } = await supabase
        .from("daily_signoffs" as any)
        .upsert(
          {
            program_id: params.programId,
            day_number: params.dayNumber,
            manager_id: params.managerId,
            overall_notes: params.overallNotes,
            signed_off_at: new Date().toISOString(),
          } as any,
          { onConflict: "program_id,day_number" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signoffs"] });
    },
  });
}

// ── Upload hooks ──

export function useUploadsForProgram(programId: string | undefined) {
  return useQuery({
    queryKey: ["uploads", programId],
    enabled: !!programId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploads" as any)
        .select("*")
        .eq("program_id", programId!);
      if (error) throw error;
      return data as unknown as UploadRecord[];
    },
  });
}

export function usePendingUploads() {
  return useQuery({
    queryKey: ["pending-uploads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploads" as any)
        .select("*")
        .eq("status", "pending_review")
        .order("uploaded_at", { ascending: true });
      if (error) throw error;
      return data as unknown as UploadRecord[];
    },
  });
}

// ── Helpers ──

const PHASE_LABELS: Record<string, string> = {
  foundations: "Foundations",
  skill_development: "Skill Development",
  advanced_selling: "Advanced Selling",
  mastery_integration: "Mastery & Integration",
};

export function getPhaseLabel(phase: string) {
  return PHASE_LABELS[phase] || phase;
}

const SECTION_LABELS: Record<string, string> = {
  learn: "Learn",
  practice: "Practice",
  mastery_homework: "Mastery / Homework",
  manager_checkin: "Manager Check-in",
};

export function getSectionLabel(section: string) {
  return SECTION_LABELS[section] || section;
}

export function getAssociateStatus(
  program: OnboardingProgram,
  ratings: PerformanceRating[],
  days: Day[]
): "on_track" | "behind" | "needs_attention" {
  const hasIssues = ratings.some(
    (r) => r.rating === "needs_work" || r.rating === "not_attempted"
  );
  if (hasIssues) return "needs_attention";

  const startDate = new Date(program.start_date);
  const today = new Date();
  const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const expectedDay = Math.min(daysDiff + 1, 20);

  if (program.current_day < expectedDay) return "behind";
  return "on_track";
}
