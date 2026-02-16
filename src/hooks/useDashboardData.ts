import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type {
  OnboardingProgram,
  PerformanceRating,
  ProfileBasic,
  Day,
  Task,
  TaskCompletion,
  DailySignoff,
} from "@/hooks/useOnboardingData";
import { countBusinessDays } from "@/hooks/useOnboardingData";

// ── Shared data hooks for dashboards ──

export function useAllPrograms() {
  return useQuery({
    queryKey: ["all-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_programs" as any)
        .select("*");
      if (error) throw error;
      return data as unknown as OnboardingProgram[];
    },
  });
}

export function useAllCompletions() {
  return useQuery({
    queryKey: ["all-completions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions" as any)
        .select("*")
        .eq("status", "completed");
      if (error) throw error;
      return data as unknown as TaskCompletion[];
    },
  });
}

export function useAllRatings() {
  return useQuery({
    queryKey: ["all-ratings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_ratings" as any)
        .select("*");
      if (error) throw error;
      return data as unknown as PerformanceRating[];
    },
  });
}

export function useAllSignoffs() {
  return useQuery({
    queryKey: ["all-signoffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_signoffs" as any)
        .select("*");
      if (error) throw error;
      return data as unknown as DailySignoff[];
    },
  });
}

export function useStores() {
  return useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useAllProfiles() {
  return useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, role, avatar_url, store_id");
      if (error) throw error;
      return data as ProfileBasic[];
    },
  });
}

// ── Helper functions ──

export function getAssociateStatusFromData(
  program: OnboardingProgram,
  ratings: PerformanceRating[]
): "on_track" | "behind" | "needs_attention" {
  const programRatings = ratings.filter((r) => r.program_id === program.id);
  const hasIssues = programRatings.some(
    (r) => r.rating === "needs_work" || r.rating === "not_attempted"
  );
  if (hasIssues) return "needs_attention";

  const startDate = new Date(program.start_date);
  const today = new Date();
  const businessDays = countBusinessDays(startDate, today);
  const expectedDay = Math.min(businessDays + 1, 20);
  if (program.current_day < expectedDay) return "behind";
  return "on_track";
}

export function calcProgress(
  programId: string,
  allTasks: Task[],
  completions: TaskCompletion[]
): number {
  const total = allTasks.length;
  if (total === 0) return 0;
  const completed = completions.filter(
    (c) => c.program_id === programId && c.status === "completed"
  ).length;
  return Math.round((completed / total) * 100);
}

export function csvDownload(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
