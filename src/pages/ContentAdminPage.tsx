import { useState, useEffect, useCallback } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDays, useAllTasks, getSectionLabel, getPhaseLabel, useDepartments, type Day, type Task, type Department } from "@/hooks/useOnboardingData";
import { useTemplates, useUpdateTemplate } from "@/hooks/useTemplates";
import type { ProgramTemplate } from "@/hooks/useTemplates";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil, Copy, Eye, Camera, Clock, BookOpen, Dumbbell, Briefcase, UserCheck, Save,
  MoreVertical, Plus, Sparkles, FileText, Rocket, Archive, Users, Trash2, ExternalLink,
  MessageSquare, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { formatDistanceToNow } from "date-fns";

interface Store {
  id: string;
  store_name: string;
  brand: string;
}

const sectionIcons: Record<string, typeof BookOpen> = {
  learn: BookOpen,
  practice: Dumbbell,
  mastery_homework: Briefcase,
  manager_checkin: UserCheck,
};

const sectionOrder = ["learn", "practice", "mastery_homework", "manager_checkin"];

const sessionStatusConfig: Record<string, { label: string; className: string; icon: typeof Sparkles }> = {
  active: { label: "Active", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: MessageSquare },
  generating: { label: "Generating…", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse", icon: Loader2 },
  reviewing: { label: "Review Draft", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: Eye },
  completed: { label: "Published", className: "bg-muted text-muted-foreground", icon: CheckCircle2 },
  abandoned: { label: "Abandoned", className: "bg-muted text-muted-foreground", icon: XCircle },
};

export default function ContentAdminPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Department tabs
  const { data: departments, isLoading: deptsLoading } = useDepartments();
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");

  // Templates
  const { data: templates, isLoading: templatesLoading } = useTemplates(selectedDeptId || undefined);
  const updateTemplate = useUpdateTemplate();

  // Legacy content
  const { data: days, isLoading: daysLoading } = useDays(selectedDeptId || undefined);
  const { data: allTasks, isLoading: tasksLoading } = useAllTasks();

  // Stores for override
  const [stores, setStores] = useState<Store[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editHtml, setEditHtml] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [previewTask, setPreviewTask] = useState<Task | null>(null);
  const [overrideTask, setOverrideTask] = useState<Task | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // Quick stats
  const { data: activePrograms } = useQuery({
    queryKey: ["active-programs-count", selectedDeptId],
    enabled: !!selectedDeptId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_programs" as any)
        .select("id")
        .eq("status", "active")
        .eq("department_id", selectedDeptId);
      if (error) throw error;
      return (data as any[])?.length || 0;
    },
  });

  // Builder sessions — show all statuses including abandoned
  const { data: builderSessions } = useQuery({
    queryKey: ["builder-sessions", selectedDeptId, profile?.user_id],
    enabled: !!selectedDeptId && !!profile?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_sessions" as any)
        .select("id, program_name, status, created_at, department_id, messages, template_id, updated_at")
        .eq("department_id", selectedDeptId)
        .eq("user_id", profile!.user_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    supabase.from("stores").select("id, store_name, brand").eq("is_active", true).order("store_name").then(({ data }) => {
      if (data) setStores(data as Store[]);
    });
  }, []);

  // Default to first department (Sales)
  useEffect(() => {
    if (departments?.length && !selectedDeptId) {
      const sales = departments.find((d) => d.slug === "sales");
      setSelectedDeptId(sales?.id || departments[0].id);
    }
  }, [departments, selectedDeptId]);

  if (profile?.role !== "app_admin") {
    return <Navigate to="/" replace />;
  }

  const selectedDept = departments?.find((d) => d.id === selectedDeptId);

  const tasksByDay = (allTasks || []).reduce((acc, task) => {
    if (!acc[task.day_id]) acc[task.day_id] = [];
    acc[task.day_id].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const filteredDays = (days || []).filter((d) => d.department_id === selectedDeptId);

  const handleSave = async () => {
    if (!editingTask) return;
    setSaving(true);
    const { error } = await supabase
      .from("tasks" as any)
      .update({ content_html: editHtml, title: editTitle } as any)
      .eq("id", editingTask.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Task content updated." });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setEditingTask(null);
    }
  };

  const handleCreateOverride = async () => {
    if (!overrideTask || !selectedStoreId) return;
    setSaving(true);
    const dayForTask = days?.find(d => d.id === overrideTask.day_id);
    if (!dayForTask) { setSaving(false); return; }

    const { data: existingDay } = await supabase
      .from("days" as any).select("id").eq("day_number", dayForTask.day_number).eq("store_id", selectedStoreId).maybeSingle();

    let targetDayId: string;
    if (existingDay) {
      targetDayId = (existingDay as any).id;
    } else {
      const { data: newDay, error: dayErr } = await supabase
        .from("days" as any).insert({
          day_number: dayForTask.day_number, week_number: dayForTask.week_number,
          phase: dayForTask.phase, title: dayForTask.title, subtitle: dayForTask.subtitle,
          store_id: selectedStoreId, department_id: dayForTask.department_id,
        } as any).select("id").single();
      if (dayErr || !newDay) {
        toast({ title: "Error", description: dayErr?.message || "Failed", variant: "destructive" });
        setSaving(false);
        return;
      }
      targetDayId = (newDay as any).id;
    }

    const { error } = await supabase.from("tasks" as any).insert({
      day_id: targetDayId, section: overrideTask.section, title: overrideTask.title,
      description: overrideTask.description, content_html: overrideTask.content_html,
      sort_order: overrideTask.sort_order, requires_upload: overrideTask.requires_upload,
      requires_rating: overrideTask.requires_rating,
    } as any);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Override Created", description: "Store-specific task created." });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      setOverrideTask(null);
      setSelectedStoreId("");
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-sales-template");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Migration complete!",
        description: `Created template with ${data.days_migrated} days and ${data.tasks_migrated} tasks.`,
      });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        toast({ title: "Already migrated", description: "Master sales template already exists." });
      } else {
        toast({ title: "Migration failed", description: err.message, variant: "destructive" });
      }
    } finally {
      setMigrating(false);
    }
  };

  const handleArchiveTemplate = async (id: string) => {
    try {
      await updateTemplate.mutateAsync({ id, status: "archived" });
      toast({ title: "Template archived" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDuplicateTemplate = async (t: ProgramTemplate) => {
    try {
      const { data, error } = await supabase
        .from("program_templates" as any)
        .insert({
          name: `${t.name} (Copy)`,
          department_id: t.department_id,
          description: t.description,
          total_days: t.total_days,
          created_by: profile?.user_id,
          forked_from: t.id,
          store_id: t.store_id,
          status: "draft",
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      toast({ title: "Template duplicated", description: "Open the copy to edit it." });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("builder_sessions" as any)
        .delete()
        .eq("id", sessionId);
      if (error) throw error;
      toast({ title: "Session deleted" });
      queryClient.invalidateQueries({ queryKey: ["builder-sessions"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const hasMasterSalesTemplate = templates?.some((t) => t.is_master && t.name === "WEAuto Sales Onboarding");
  const publishedCount = templates?.filter((t) => t.status === "published").length || 0;

  const statusColor: Record<string, string> = {
    draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    archived: "bg-muted text-muted-foreground",
  };

  const isLoading = daysLoading || tasksLoading || deptsLoading;

  return (
    <AppShell>
      <div className="px-4 py-4 animate-fade-in space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Content Admin</h1>
            <p className="text-sm text-muted-foreground">Manage training programs and content</p>
          </div>
          {selectedDept?.slug === "sales" && !hasMasterSalesTemplate && (
            <Button variant="outline" size="sm" onClick={handleMigrate} disabled={migrating} className="gap-1">
              <FileText className="h-3.5 w-3.5" />
              {migrating ? "Migrating…" : "Migrate to Template"}
            </Button>
          )}
        </div>

        {/* Department Tabs */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-1 pb-2">
            {deptsLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)
              : departments?.map((dept) => (
                  <Button
                    key={dept.id}
                    variant={selectedDeptId === dept.id ? "default" : "outline"}
                    size="sm"
                    className="rounded-full shrink-0"
                    onClick={() => setSelectedDeptId(dept.id)}
                  >
                    {dept.label}
                  </Button>
                ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Templates Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Programs</h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => navigate(`/templates/new?department=${selectedDeptId}`)}
            >
              <Plus className="h-3.5 w-3.5" /> Create Manually
            </Button>
          </div>

          {templatesLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : templates && templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map((t) => (
                <Card key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{t.name}</p>
                        <Badge className={`text-[10px] ${statusColor[t.status] || ""}`}>
                          {t.status}
                        </Badge>
                        {t.is_master && (
                          <Badge variant="outline" className="text-[10px]">Master</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {t.total_days && <span>{t.total_days} days</span>}
                        <span>v{t.version}</span>
                        <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/templates/${t.id}/edit`)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateTemplate(t)}>
                          <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        {t.status === "draft" && (
                          <DropdownMenuItem
                            onClick={() => navigate(`/templates/${t.id}/edit`)}
                            className="text-emerald-600"
                          >
                            <Rocket className="h-3.5 w-3.5 mr-2" /> Publish
                          </DropdownMenuItem>
                        )}
                        {t.status !== "archived" && (
                          <DropdownMenuItem onClick={() => handleArchiveTemplate(t.id)} className="text-destructive">
                            <Archive className="h-3.5 w-3.5 mr-2" /> Archive
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))}
            </div>
          ) : !templatesLoading ? (
            <Card className="p-6 text-center space-y-3">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                No programs yet for {selectedDept?.label || "this department"}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/builder/new?department=${selectedDeptId}`)}>
                      <Sparkles className="h-3.5 w-3.5" /> Build with AI
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create a program using AI chat</TooltipContent>
                </Tooltip>
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => navigate(`/templates/new?department=${selectedDeptId}`)}
                >
                  <Plus className="h-3.5 w-3.5" /> Create Manually
                </Button>
              </div>
            </Card>
          ) : null}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{activePrograms || 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Associates</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{templates?.length || 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Templates</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{publishedCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Published</p>
          </Card>
        </div>

        {/* Recent Builder Sessions — Enhanced */}
        {builderSessions && builderSessions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recent AI Builder Sessions</h2>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/builder/new?department=${selectedDeptId}`)}>
                <Sparkles className="h-3.5 w-3.5" /> New Session
              </Button>
            </div>
            <div className="space-y-2">
              {builderSessions.map((s: any) => {
                const config = sessionStatusConfig[s.status] || sessionStatusConfig.active;
                const Icon = config.icon;
                const messageCount = Array.isArray(s.messages) ? s.messages.length : 0;
                const isResumable = ["active", "generating", "reviewing"].includes(s.status);

                return (
                  <Card key={s.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{s.program_name || "Untitled Session"}</p>
                          <Badge className={`text-[10px] gap-1 ${config.className}`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</span>
                          {messageCount > 0 && <span>{messageCount} messages</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isResumable && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => navigate(
                              s.status === "reviewing"
                                ? `/builder/${s.id}/review`
                                : `/builder/${s.id}`
                            )}
                          >
                            Resume
                          </Button>
                        )}
                        {s.status === "completed" && s.template_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => navigate(`/templates/${s.template_id}/edit`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Template
                          </Button>
                        )}
                        {s.status === "abandoned" && (
                          <ConfirmDialog
                            title="Delete Session?"
                            description="This will permanently delete this abandoned builder session."
                            confirmLabel="Delete"
                            confirmVariant="destructive"
                            onConfirm={() => handleDeleteSession(s.id)}
                            trigger={
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Legacy Content (existing day/task editing) */}
        {filteredDays.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Live Content</h2>
            <Accordion type="multiple" className="space-y-2">
              {filteredDays.map((day) => {
                const dayTasks = tasksByDay[day.id] || [];
                const sections = sectionOrder.filter(s => dayTasks.some(t => t.section === s));

                return (
                  <AccordionItem key={day.id} value={day.id} className="border-none">
                    <Card>
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          <Badge variant="outline" className="shrink-0">Day {day.day_number}</Badge>
                          <div>
                            <p className="text-sm font-semibold">{day.title}</p>
                            <p className="text-xs text-muted-foreground">{getPhaseLabel(day.phase)} · {dayTasks.length} tasks</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        {sections.map(section => {
                          const sectionTasks = dayTasks.filter(t => t.section === section).sort((a, b) => a.sort_order - b.sort_order);
                          const SectionIcon = sectionIcons[section] || BookOpen;

                          return (
                            <div key={section} className="mb-4">
                              <div className="flex items-center gap-2 mb-2">
                                <SectionIcon className="h-4 w-4 text-secondary" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{getSectionLabel(section)}</span>
                              </div>
                              <div className="space-y-1">
                                {sectionTasks.map(task => (
                                  <div key={task.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {task.requires_upload && (
                                          <span className="flex items-center gap-0.5 text-[10px] font-medium text-secondary"><Camera className="h-3 w-3" /> Upload</span>
                                        )}
                                        {task.requires_rating && (
                                          <span className="flex items-center gap-0.5 text-[10px] font-medium text-warning"><Clock className="h-3 w-3" /> Rating</span>
                                        )}
                                        {task.content_html ? (
                                          <span className="text-[10px] text-success font-medium">✓ Content</span>
                                        ) : (
                                          <span className="text-[10px] text-muted-foreground">No content</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreviewTask(task)} title="Preview">
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingTask(task); setEditHtml(task.content_html || ""); setEditTitle(task.title); }} title="Edit">
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOverrideTask(task)} title="Create Store Override">
                                        <Copy className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Title</label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="min-h-[300px]">
                <RichTextEditor content={editHtml} onChange={setEditHtml} />
              </TabsContent>
              <TabsContent value="preview" className="min-h-[300px]">
                <div className="prose prose-sm max-w-none p-4 border rounded-lg bg-card" dangerouslySetInnerHTML={{ __html: sanitizeHtml(editHtml || "<p class='text-muted-foreground'>No content yet</p>") }} />
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTask} onOpenChange={(open) => !open && setPreviewTask(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTask?.title}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewTask?.content_html || "<p class='text-muted-foreground'>No content available</p>") }} />
        </DialogContent>
      </Dialog>

      {/* Override Dialog */}
      <Dialog open={!!overrideTask} onOpenChange={(open) => !open && setOverrideTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Store Override</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Create a store-specific version of "<strong>{overrideTask?.title}</strong>".
          </p>
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger><SelectValue placeholder="Select a store" /></SelectTrigger>
            <SelectContent>
              {stores.map(store => (
                <SelectItem key={store.id} value={store.id}>
                  {store.store_name} ({store.brand})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideTask(null)}>Cancel</Button>
            <Button onClick={handleCreateOverride} disabled={saving || !selectedStoreId}>
              <Copy className="h-4 w-4 mr-1" /> {saving ? "Creating…" : "Create Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
