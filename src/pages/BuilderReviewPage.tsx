import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/hooks/useOnboardingData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, ChevronDown, ChevronRight, Pencil, Trash2, Plus, Sparkles,
  Send, Loader2, BookOpen, Dumbbell, Briefcase, UserCheck, Rocket, AlertTriangle,
} from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { getSectionLabel } from "@/hooks/useOnboardingData";

interface DraftTask {
  section: string;
  title: string;
  description: string;
  content_html: string;
  requires_upload: boolean;
  requires_rating: boolean;
  sort_order: number;
}

interface DraftDay {
  day_number: number;
  title: string;
  subtitle?: string;
  phase: string;
  tasks: DraftTask[];
}

interface DraftProgram {
  program_name: string;
  total_days: number;
  days: DraftDay[];
  suggestions?: { topic: string; reason: string; suggested_day: number }[];
}

const sectionIcons: Record<string, typeof BookOpen> = {
  learn: BookOpen,
  practice: Dumbbell,
  mastery_homework: Briefcase,
  manager_checkin: UserCheck,
};

const sectionOrder = ["learn", "practice", "mastery_homework", "manager_checkin"];

export default function BuilderReviewPage() {
  useEffect(() => { document.title = "Review Draft — WEAuto"; }, []);
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: departments } = useDepartments();

  const [draft, setDraft] = useState<DraftProgram | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [editingTask, setEditingTask] = useState<{ dayIdx: number; taskIdx: number } | null>(null);
  const [refineInput, setRefineInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ dayIdx: number; taskIdx: number } | null>(null);

  const department = departments?.find((d) => d.id === sessionData?.department_id);

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("builder_sessions" as any)
        .select("*")
        .eq("id", sessionId)
        .single();
      if (error || !data) {
        toast({ title: "Session not found", variant: "destructive" });
        navigate("/content-admin");
        return;
      }
      setSessionData(data);
      const draftData = (data as any).draft_program as DraftProgram;
      if (!draftData || !draftData.days || !Array.isArray(draftData.days)) {
        setLoading(false);
        setDraft(null);
        return;
      }
      setDraft(draftData);
      setLoading(false);
    };
    load();
  }, [sessionId]);

  const toggleDay = (dayNum: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(dayNum) ? next.delete(dayNum) : next.add(dayNum);
      return next;
    });
  };

  const updateDraft = async (updated: DraftProgram) => {
    setDraft(updated);
    await supabase
      .from("builder_sessions" as any)
      .update({ draft_program: updated } as any)
      .eq("id", sessionId);
  };

  const updateTask = (dayIdx: number, taskIdx: number, updates: Partial<DraftTask>) => {
    if (!draft) return;
    const updated = { ...draft };
    updated.days = [...updated.days];
    updated.days[dayIdx] = { ...updated.days[dayIdx] };
    updated.days[dayIdx].tasks = [...updated.days[dayIdx].tasks];
    updated.days[dayIdx].tasks[taskIdx] = { ...updated.days[dayIdx].tasks[taskIdx], ...updates };
    updateDraft(updated);
  };

  const deleteTask = (dayIdx: number, taskIdx: number) => {
    if (!draft) return;
    const updated = { ...draft };
    updated.days = [...updated.days];
    updated.days[dayIdx] = { ...updated.days[dayIdx] };
    updated.days[dayIdx].tasks = updated.days[dayIdx].tasks.filter((_, i) => i !== taskIdx);
    updateDraft(updated);
    setDeleteConfirm(null);
  };

  const addTask = (dayIdx: number, section: string) => {
    if (!draft) return;
    const updated = { ...draft };
    updated.days = [...updated.days];
    updated.days[dayIdx] = { ...updated.days[dayIdx] };
    const tasks = [...updated.days[dayIdx].tasks];
    tasks.push({
      section,
      title: "New Task",
      description: "",
      content_html: "",
      requires_upload: false,
      requires_rating: false,
      sort_order: tasks.filter((t) => t.section === section).length + 1,
    });
    updated.days[dayIdx].tasks = tasks;
    updateDraft(updated);
  };

  const addSuggestion = (suggestion: { topic: string; suggested_day: number }) => {
    if (!draft) return;
    const dayIdx = draft.days.findIndex((d) => d.day_number === suggestion.suggested_day);
    if (dayIdx === -1) return;
    addTask(dayIdx, "learn");
    // Update the newly added task title
    const updated = { ...draft };
    updated.days = [...updated.days];
    updated.days[dayIdx] = { ...updated.days[dayIdx] };
    const tasks = [...updated.days[dayIdx].tasks];
    tasks[tasks.length - 1].title = suggestion.topic;
    updated.days[dayIdx].tasks = tasks;
    // Remove from suggestions
    updated.suggestions = updated.suggestions?.filter((s) => s.topic !== suggestion.topic);
    updateDraft(updated);
  };

  const handleRefine = async () => {
    if (!refineInput.trim() || refining || !draft || !department) return;
    setRefining(true);
    try {
      const msgs = [
        ...(sessionData?.messages || []),
        { role: "user", content: `Current draft:\n${JSON.stringify(draft)}\n\nUser request: ${refineInput}` },
      ];
      const { data, error } = await supabase.functions.invoke("builder-chat", {
        body: {
          messages: msgs,
          department: { label: department.label, description: department.description, typical_duration_days: department.typical_duration_days },
          extractedTopics: sessionData?.extracted_topics || [],
          mode: "refine",
          programName: draft.program_name,
        },
      });
      if (error) throw error;

      // Try parsing JSON from response
      const jsonMatch = data.message?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const newDraft = JSON.parse(jsonMatch[0]);
          if (newDraft.days) {
            await updateDraft(newDraft);
            toast({ title: "Draft updated", description: "AI has refined your program." });
          }
        } catch {
          toast({ title: "AI Response", description: data.message?.substring(0, 200) });
        }
      } else {
        toast({ title: "AI Response", description: data.message?.substring(0, 200) });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRefining(false);
      setRefineInput("");
    }
  };

  const handlePublish = async () => {
    if (!draft || !department || !profile?.user_id || publishing) return;
    setPublishing(true);
    try {
      // 1. Create program_templates row
      const { data: template, error: tErr } = await supabase
        .from("program_templates" as any)
        .insert({
          name: draft.program_name,
          department_id: department.id,
          total_days: draft.total_days,
          created_by: profile.user_id,
          is_master: profile.role === "app_admin",
          store_id: profile.store_id || null,
          status: "published",
          published_at: new Date().toISOString(),
        } as any)
        .select("id")
        .single();
      if (tErr) throw tErr;
      const templateId = (template as any).id;

      // 2. For each day: create template_days + live days
      for (const day of draft.days) {
        // Template day
        const { data: tDay, error: tdErr } = await supabase
          .from("template_days" as any)
          .insert({
            template_id: templateId,
            day_number: day.day_number,
            title: day.title,
            subtitle: day.subtitle || null,
            phase: day.phase,
            sort_order: day.day_number,
          } as any)
          .select("id")
          .single();
        if (tdErr) throw tdErr;

        // Live day - upsert
        const weekNumber = Math.ceil(day.day_number / 5);
        const { data: liveDay, error: ldErr } = await supabase
          .from("days" as any)
          .upsert({
            department_id: department.id,
            day_number: day.day_number,
            title: day.title,
            subtitle: day.subtitle || null,
            phase: day.phase,
            week_number: weekNumber,
          } as any, { onConflict: "department_id,day_number" })
          .select("id")
          .single();

        // Get the live day id (might be existing)
        let liveDayId: string;
        if (ldErr || !liveDay) {
          const { data: existing } = await supabase
            .from("days" as any)
            .select("id")
            .eq("department_id", department.id)
            .eq("day_number", day.day_number)
            .single();
          if (!existing) throw new Error(`Failed to create day ${day.day_number}`);
          liveDayId = (existing as any).id;
        } else {
          liveDayId = (liveDay as any).id;
        }

        // 3. For each task
        for (const task of day.tasks) {
          // Template task
          await supabase.from("template_tasks" as any).insert({
            template_day_id: (tDay as any).id,
            section: task.section,
            title: task.title,
            description: task.description,
            content_html: task.content_html,
            requires_upload: task.requires_upload,
            requires_rating: task.requires_rating,
            sort_order: task.sort_order,
          } as any);

          // Live task
          await supabase.from("tasks" as any).insert({
            day_id: liveDayId,
            section: task.section,
            title: task.title,
            description: task.description,
            content_html: task.content_html,
            requires_upload: task.requires_upload,
            requires_rating: task.requires_rating,
            sort_order: task.sort_order,
          } as any);
        }
      }

      // 4. Update session
      await supabase
        .from("builder_sessions" as any)
        .update({ status: "completed", template_id: templateId } as any)
        .eq("id", sessionId);

      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({
        title: "Program published! 🎉",
        description: `It will be used for all new ${department.label} associates.`,
      });
      navigate("/content-admin");
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="h-12 w-12 text-warning" />
        <h1 className="text-xl font-bold text-foreground">Could not load the program draft</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          The draft may be malformed or missing. Go back to the chat and try generating again.
        </p>
        <Button variant="outline" onClick={() => navigate(`/builder/${sessionId}`)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Chat
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 h-14 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/builder/${sessionId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{draft.program_name}</p>
          <p className="text-xs text-muted-foreground">{draft.total_days} days · {department?.label}</p>
        </div>
        <Button onClick={handlePublish} disabled={publishing} className="gap-2">
          <Rocket className="h-4 w-4" />
          {publishing ? "Publishing…" : "Publish"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-3xl mx-auto w-full">
        {/* Suggestions */}
        {draft.suggestions && draft.suggestions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">AI Suggestions</h3>
            {draft.suggestions.map((s, i) => (
              <Card key={i} className="p-3 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{s.topic}</p>
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => addSuggestion(s)}>
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const updated = { ...draft };
                        updated.suggestions = updated.suggestions?.filter((_, j) => j !== i);
                        updateDraft(updated);
                      }}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Days */}
        {draft.days.map((day, dayIdx) => (
          <Collapsible
            key={day.day_number}
            open={expandedDays.has(day.day_number)}
            onOpenChange={() => toggleDay(day.day_number)}
          >
            <Card>
              <CollapsibleTrigger className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                {expandedDays.has(day.day_number) ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <Badge variant="outline" className="shrink-0">Day {day.day_number}</Badge>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold truncate">{day.title}</p>
                  <p className="text-xs text-muted-foreground">{day.phase} · {day.tasks.length} tasks</p>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent className="px-4 pb-4">
                {sectionOrder.map((section) => {
                  const tasks = day.tasks.filter((t) => t.section === section);
                  if (tasks.length === 0 && section !== "manager_checkin") return null;
                  const Icon = sectionIcons[section] || BookOpen;

                  return (
                    <div key={section} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {getSectionLabel(section)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {tasks.map((task) => {
                          const taskIdx = day.tasks.indexOf(task);
                          const isEditing = editingTask?.dayIdx === dayIdx && editingTask?.taskIdx === taskIdx;

                          return (
                            <div key={taskIdx} className="border rounded-lg p-3 bg-card">
                              {isEditing ? (
                                <div className="space-y-3">
                                  <Input
                                    value={task.title}
                                    onChange={(e) => updateTask(dayIdx, taskIdx, { title: e.target.value })}
                                    className="font-medium"
                                  />
                                  <Textarea
                                    value={task.description}
                                    onChange={(e) => updateTask(dayIdx, taskIdx, { description: e.target.value })}
                                    placeholder="Description..."
                                    rows={2}
                                  />
                                  <RichTextEditor
                                    content={task.content_html}
                                    onChange={(html) => updateTask(dayIdx, taskIdx, { content_html: html })}
                                  />
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={task.requires_upload}
                                        onCheckedChange={(v) => updateTask(dayIdx, taskIdx, { requires_upload: v })}
                                      />
                                      <Label className="text-xs">Requires Upload</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={task.requires_rating}
                                        onCheckedChange={(v) => updateTask(dayIdx, taskIdx, { requires_rating: v })}
                                      />
                                      <Label className="text-xs">Requires Rating</Label>
                                    </div>
                                  </div>
                                  <Button size="sm" variant="outline" onClick={() => setEditingTask(null)}>
                                    Done
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{task.title}</p>
                                    {task.description && (
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                                    )}
                                    <div className="flex gap-2 mt-1">
                                      {task.requires_upload && <Badge variant="outline" className="text-[10px]">Upload</Badge>}
                                      {task.requires_rating && <Badge variant="outline" className="text-[10px]">Rating</Badge>}
                                    </div>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setEditingTask({ dayIdx, taskIdx })}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => setDeleteConfirm({ dayIdx, taskIdx })}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => addTask(dayIdx, section)}
                        >
                          <Plus className="h-3 w-3" /> Add Task
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}

        {/* Refine with chat */}
        <Card className="p-4 space-y-2">
          <p className="text-sm font-medium text-foreground">Refine with AI</p>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Ask AI to make changes..."
              value={refineInput}
              onChange={(e) => setRefineInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRefine()}
              disabled={refining}
            />
            <Button size="icon" onClick={handleRefine} disabled={refining || !refineInput.trim()}>
              {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to remove this task?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteTask(deleteConfirm.dayIdx, deleteConfirm.taskIdx)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
