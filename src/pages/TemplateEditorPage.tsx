import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useTemplate, useTemplateDays, useTemplateTasks, usePublishTemplate } from "@/hooks/useTemplates";
import type { TemplateDay, TemplateTask } from "@/hooks/useTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useDepartment } from "@/hooks/useOnboardingData";
import { sanitizeHtml } from "@/lib/sanitize";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Trash2,
  BookOpen,
  Dumbbell,
  Briefcase,
  UserCheck,
  Save,
  Rocket,
  FileText,
} from "lucide-react";

const sectionIcons: Record<string, typeof BookOpen> = {
  learn: BookOpen,
  practice: Dumbbell,
  mastery_homework: Briefcase,
  manager_checkin: UserCheck,
};

const sectionLabels: Record<string, string> = {
  learn: "Learn",
  practice: "Practice",
  mastery_homework: "Mastery / Homework",
  manager_checkin: "Manager Check-in",
};

const sectionOrder = ["learn", "practice", "mastery_homework", "manager_checkin"];

const phaseOptions = [
  { value: "foundations", label: "Foundations" },
  { value: "skill_development", label: "Skill Development" },
  { value: "advanced_selling", label: "Advanced Selling" },
  { value: "mastery_integration", label: "Mastery & Integration" },
];

export default function TemplateEditorPage() {
  useEffect(() => { document.title = "Edit Template — WEAuto"; }, []);
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: template, isLoading: templateLoading } = useTemplate(templateId);
  const { data: department } = useDepartment(template?.department_id);
  const { data: days, isLoading: daysLoading } = useTemplateDays(templateId);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const { data: tasks, isLoading: tasksLoading } = useTemplateTasks(selectedDayId || undefined);
  const publishTemplate = usePublishTemplate();

  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (days && days.length > 0 && !selectedDayId) {
      setSelectedDayId(days[0].id);
    }
  }, [days, selectedDayId]);

  useEffect(() => {
    if (template) document.title = `Edit: ${template.name} — WEAuto`;
  }, [template]);

  const selectedDay = days?.find((d) => d.id === selectedDayId);

  const handleAddDay = async () => {
    if (!templateId) return;
    const nextNum = (days?.length || 0) + 1;
    const { error } = await supabase.from("template_days" as any).insert({
      template_id: templateId,
      day_number: nextNum,
      title: `Day ${nextNum}`,
      sort_order: nextNum,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["template-days", templateId] });
    }
  };

  const handleUpdateDay = useCallback(
    async (dayId: string, updates: Partial<TemplateDay>) => {
      const { error } = await supabase
        .from("template_days" as any)
        .update(updates as any)
        .eq("id", dayId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else queryClient.invalidateQueries({ queryKey: ["template-days", templateId] });
    },
    [templateId, queryClient, toast]
  );

  const handleAddTask = async (section: string) => {
    if (!selectedDayId) return;
    const existingCount = tasks?.filter((t) => t.section === section).length || 0;
    const { error } = await supabase.from("template_tasks" as any).insert({
      template_day_id: selectedDayId,
      section,
      title: "New Task",
      sort_order: existingCount,
    } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else queryClient.invalidateQueries({ queryKey: ["template-tasks", selectedDayId] });
  };

  const handleUpdateTask = useCallback(
    async (taskId: string, updates: Partial<TemplateTask>) => {
      const { error } = await supabase
        .from("template_tasks" as any)
        .update(updates as any)
        .eq("id", taskId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else queryClient.invalidateQueries({ queryKey: ["template-tasks", selectedDayId] });
    },
    [selectedDayId, queryClient, toast]
  );

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;
    const { error } = await supabase.from("template_tasks" as any).delete().eq("id", deleteTaskId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      queryClient.invalidateQueries({ queryKey: ["template-tasks", selectedDayId] });
      toast({ title: "Task deleted" });
    }
    setDeleteTaskId(null);
  };

  const handlePublish = async () => {
    if (!templateId) return;
    setPublishing(true);
    try {
      await publishTemplate.mutateAsync(templateId);
      toast({
        title: "Program published!",
        description: `It will be used for all new ${department?.label || ""} associates.`,
      });
      navigate("/content-admin");
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  if (templateLoading) {
    return (
      <AppShell>
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[60vh] w-full" />
        </div>
      </AppShell>
    );
  }

  if (!template) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center gap-4">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">Template not found</h1>
          <p className="text-sm text-muted-foreground">This template may have been deleted or you don't have access.</p>
          <Button variant="outline" onClick={() => navigate("/content-admin")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Content Admin
          </Button>
        </div>
      </AppShell>
    );
  }

  const statusColor: Record<string, string> = {
    draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    archived: "bg-muted text-muted-foreground",
  };

  return (
    <AppShell>
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/content-admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold truncate">{template.name}</h1>
          <Badge className={`text-[10px] ${statusColor[template.status] || ""}`}>
            {template.status}
          </Badge>
        </div>
        {template.status === "draft" && (
          <Button size="sm" onClick={handlePublish} disabled={publishing} className="gap-1">
            <Rocket className="h-3.5 w-3.5" />
            {publishing ? "Publishing…" : "Publish"}
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row min-h-[calc(100vh-120px)]">
        {/* Day sidebar */}
        <div className="md:w-56 md:border-r p-3 space-y-1 overflow-y-auto md:max-h-[calc(100vh-120px)]">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Days</p>
          {daysLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : (
            days?.map((day) => (
              <button
                key={day.id}
                onClick={() => setSelectedDayId(day.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedDayId === day.id
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted/50 text-foreground"
                }`}
              >
                <span className="font-mono text-xs text-muted-foreground mr-1.5">{day.day_number}.</span>
                {day.title}
              </button>
            ))
          )}
          <Button variant="outline" size="sm" className="w-full mt-2 gap-1" onClick={handleAddDay}>
            <Plus className="h-3.5 w-3.5" /> Add Day
          </Button>
        </div>

        {/* Main area */}
        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          {selectedDay ? (
            <>
              {/* Day header */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Day Title</Label>
                  <Input
                    value={selectedDay.title}
                    onBlur={(e) => handleUpdateDay(selectedDay.id, { title: e.target.value })}
                    onChange={(e) => {
                      // Optimistic local update via query cache
                      queryClient.setQueryData(["template-days", templateId], (old: any) =>
                        old?.map((d: any) => (d.id === selectedDay.id ? { ...d, title: e.target.value } : d))
                      );
                    }}
                    className="text-lg font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Subtitle</Label>
                  <Input
                    value={selectedDay.subtitle || ""}
                    placeholder="Optional subtitle"
                    onBlur={(e) => handleUpdateDay(selectedDay.id, { subtitle: e.target.value || null })}
                    onChange={(e) => {
                      queryClient.setQueryData(["template-days", templateId], (old: any) =>
                        old?.map((d: any) => (d.id === selectedDay.id ? { ...d, subtitle: e.target.value } : d))
                      );
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Phase</Label>
                  <Select
                    value={selectedDay.phase || ""}
                    onValueChange={(v) => handleUpdateDay(selectedDay.id, { phase: v })}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Select phase" />
                    </SelectTrigger>
                    <SelectContent>
                      {phaseOptions.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Task sections */}
              {tasksLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : (
                sectionOrder.map((section) => {
                  const Icon = sectionIcons[section] || BookOpen;
                  const sectionTasks = (tasks || [])
                    .filter((t) => t.section === section)
                    .sort((a, b) => a.sort_order - b.sort_order);

                  return (
                    <div key={section} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-secondary" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {sectionLabels[section]}
                        </span>
                      </div>

                      {sectionTasks.map((task) => (
                        <TaskEditor
                          key={task.id}
                          task={task}
                          onUpdate={handleUpdateTask}
                          onDelete={() => setDeleteTaskId(task.id)}
                        />
                      ))}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-muted-foreground"
                        onClick={() => handleAddTask(section)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Task
                      </Button>
                    </div>
                  );
                })
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              {days?.length === 0 ? "Add a day to get started." : "Select a day to edit."}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this task from the template. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

// ── Task Editor sub-component ──

function TaskEditor({
  task,
  onUpdate,
  onDelete,
}: {
  task: TemplateTask;
  onUpdate: (id: string, updates: Partial<TemplateTask>) => Promise<void>;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [contentHtml, setContentHtml] = useState(task.content_html || "");
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    setContentHtml(task.content_html || "");
  }, [task]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== task.title && onUpdate(task.id, { title })}
            className="font-medium"
            placeholder="Task title"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (task.description || "") && onUpdate(task.id, { description: description || null })}
            placeholder="Description (optional)"
            className="min-h-[60px] text-sm"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch
            checked={task.requires_upload}
            onCheckedChange={(v) => onUpdate(task.id, { requires_upload: v })}
          />
          <span className="text-xs text-muted-foreground">Requires Upload</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch
            checked={task.requires_rating}
            onCheckedChange={(v) => onUpdate(task.id, { requires_rating: v })}
          />
          <span className="text-xs text-muted-foreground">Requires Rating</span>
        </label>
      </div>

      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowContent(!showContent)}
          className="text-xs"
        >
          {showContent ? "Hide Content Editor" : "Edit Content"}
        </Button>
        {showContent && (
          <div className="mt-2 space-y-2">
            <RichTextEditor
              content={contentHtml}
              onChange={(html) => setContentHtml(html)}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onUpdate(task.id, { content_html: contentHtml })}
              className="gap-1"
            >
              <Save className="h-3.5 w-3.5" /> Save Content
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
