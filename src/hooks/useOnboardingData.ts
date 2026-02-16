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
        // Mark as not started
        const { error } = await supabase
          .from("task_completions" as any)
          .update({ status: "not_started", completed_at: null } as any)
          .eq("program_id", programId)
          .eq("task_id", taskId);
        if (error) throw error;
      } else if (!currentStatus || currentStatus === "not_started") {
        // Upsert as completed
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
