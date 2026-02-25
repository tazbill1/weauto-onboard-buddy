import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface ProgramTemplate {
  id: string;
  name: string;
  department_id: string;
  description: string | null;
  total_days: number | null;
  created_by: string;
  is_master: boolean;
  forked_from: string | null;
  store_id: string | null;
  version: number;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  department_label?: string;
}

export interface TemplateDay {
  id: string;
  template_id: string;
  day_number: number;
  title: string;
  subtitle: string | null;
  phase: string | null;
  is_locked: boolean;
  sort_order: number;
  created_at: string;
}

export interface TemplateTask {
  id: string;
  template_day_id: string;
  section: string;
  title: string;
  description: string | null;
  content_html: string | null;
  requires_upload: boolean;
  requires_rating: boolean;
  is_locked: boolean;
  sort_order: number;
  source_reference: string | null;
  created_at: string;
}

export function useTemplates(departmentId?: string) {
  return useQuery({
    queryKey: ["templates", departmentId || "all"],
    queryFn: async () => {
      let query = supabase
        .from("program_templates" as any)
        .select("*, departments!inner(label)")
        .order("updated_at", { ascending: false });
      if (departmentId) {
        query = query.eq("department_id", departmentId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]).map((t) => ({
        ...t,
        department_label: (t.departments as any)?.label || "",
        departments: undefined,
      })) as ProgramTemplate[];
    },
  });
}

export function useTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ["template", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_templates" as any)
        .select("*")
        .eq("id", templateId!)
        .single();
      if (error) throw error;
      return data as unknown as ProgramTemplate;
    },
  });
}

export function useTemplateDays(templateId: string | undefined) {
  return useQuery({
    queryKey: ["template-days", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_days" as any)
        .select("*")
        .eq("template_id", templateId!)
        .order("day_number");
      if (error) throw error;
      return data as unknown as TemplateDay[];
    },
  });
}

export function useTemplateTasks(templateDayId: string | undefined) {
  return useQuery({
    queryKey: ["template-tasks", templateDayId],
    enabled: !!templateDayId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_tasks" as any)
        .select("*")
        .eq("template_day_id", templateDayId!)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as TemplateTask[];
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      department_id: string;
      description?: string;
      total_days?: number;
      store_id?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("program_templates" as any)
        .insert({
          name: params.name,
          department_id: params.department_id,
          description: params.description || null,
          total_days: params.total_days || null,
          created_by: user.id,
          store_id: params.store_id || null,
          status: "draft",
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return data as unknown as { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      description?: string;
      total_days?: number;
      status?: string;
    }) => {
      const updates: any = {};
      if (params.name !== undefined) updates.name = params.name;
      if (params.description !== undefined) updates.description = params.description;
      if (params.total_days !== undefined) updates.total_days = params.total_days;
      if (params.status !== undefined) updates.status = params.status;

      const { error } = await supabase
        .from("program_templates" as any)
        .update(updates)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["template"] });
    },
  });
}

export function usePublishTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      // 1. Get the template
      const { data: template, error: tErr } = await supabase
        .from("program_templates" as any)
        .select("*")
        .eq("id", templateId)
        .single();
      if (tErr) throw tErr;
      const t = template as any;

      // 2. Get template days
      const { data: tDays, error: dErr } = await supabase
        .from("template_days" as any)
        .select("*")
        .eq("template_id", templateId)
        .order("day_number");
      if (dErr) throw dErr;

      // 3. Get all template tasks
      const dayIds = (tDays as any[]).map((d: any) => d.id);
      let tTasks: any[] = [];
      if (dayIds.length > 0) {
        const { data, error: taskErr } = await supabase
          .from("template_tasks" as any)
          .select("*")
          .in("template_day_id", dayIds);
        if (taskErr) throw taskErr;
        tTasks = data as any[];
      }

      // 4. Upsert days into live table
      for (const td of tDays as any[]) {
        // Check if day exists
        const { data: existingDay } = await supabase
          .from("days" as any)
          .select("id")
          .eq("department_id", t.department_id)
          .eq("day_number", td.day_number)
          .is("store_id", null)
          .maybeSingle();

        let liveDayId: string;
        if (existingDay) {
          liveDayId = (existingDay as any).id;
          await supabase
            .from("days" as any)
            .update({
              title: td.title,
              subtitle: td.subtitle,
              phase: td.phase || "foundations",
              week_number: Math.ceil(td.day_number / 5),
            } as any)
            .eq("id", liveDayId);
        } else {
          const { data: newDay, error: insertErr } = await supabase
            .from("days" as any)
            .insert({
              department_id: t.department_id,
              day_number: td.day_number,
              title: td.title,
              subtitle: td.subtitle,
              phase: td.phase || "foundations",
              week_number: Math.ceil(td.day_number / 5),
            } as any)
            .select("id")
            .single();
          if (insertErr) throw insertErr;
          liveDayId = (newDay as any).id;
        }

        // Upsert tasks for this day
        const dayTasks = tTasks.filter((tt: any) => tt.template_day_id === td.id);
        for (const tt of dayTasks) {
          const { data: existingTask } = await supabase
            .from("tasks" as any)
            .select("id")
            .eq("day_id", liveDayId)
            .eq("section", tt.section)
            .eq("sort_order", tt.sort_order)
            .maybeSingle();

          if (existingTask) {
            await supabase
              .from("tasks" as any)
              .update({
                title: tt.title,
                description: tt.description,
                content_html: tt.content_html,
                requires_upload: tt.requires_upload,
                requires_rating: tt.requires_rating,
              } as any)
              .eq("id", (existingTask as any).id);
          } else {
            await supabase
              .from("tasks" as any)
              .insert({
                day_id: liveDayId,
                section: tt.section,
                title: tt.title,
                description: tt.description,
                content_html: tt.content_html,
                requires_upload: tt.requires_upload,
                requires_rating: tt.requires_rating,
                sort_order: tt.sort_order,
              } as any);
          }
        }
      }

      // 5. Update template status
      await supabase
        .from("program_templates" as any)
        .update({
          status: "published",
          published_at: new Date().toISOString(),
        } as any)
        .eq("id", templateId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["template"] });
      queryClient.invalidateQueries({ queryKey: ["days"] });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
