import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDays, useAllTasks, getSectionLabel, getPhaseLabel, type Day, type Task } from "@/hooks/useOnboardingData";
import { useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { Pencil, Copy, Eye, Camera, Clock, BookOpen, Dumbbell, Briefcase, UserCheck, Save } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";

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

export default function ContentAdminPage() {
  const { profile } = useAuth();
  const { data: days, isLoading: daysLoading } = useDays();
  const { data: allTasks, isLoading: tasksLoading } = useAllTasks();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stores, setStores] = useState<Store[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editHtml, setEditHtml] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [previewTask, setPreviewTask] = useState<Task | null>(null);
  const [overrideTask, setOverrideTask] = useState<Task | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("stores").select("id, store_name, brand").eq("is_active", true).order("store_name").then(({ data }) => {
      if (data) setStores(data as Store[]);
    });
  }, []);

  if (profile?.role !== "corporate_admin") {
    return <Navigate to="/" replace />;
  }

  const tasksByDay = (allTasks || []).reduce((acc, task) => {
    if (!acc[task.day_id]) acc[task.day_id] = [];
    acc[task.day_id].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

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
    if (!dayForTask) {
      setSaving(false);
      return;
    }

    // Create a store-specific day if needed, then create the task override
    const { data: existingDay } = await supabase
      .from("days" as any)
      .select("id")
      .eq("day_number", dayForTask.day_number)
      .eq("store_id", selectedStoreId)
      .maybeSingle();

    let targetDayId: string;

    if (existingDay) {
      targetDayId = (existingDay as any).id;
    } else {
      const { data: newDay, error: dayErr } = await supabase
        .from("days" as any)
        .insert({
          day_number: dayForTask.day_number,
          week_number: dayForTask.week_number,
          phase: dayForTask.phase,
          title: dayForTask.title,
          subtitle: dayForTask.subtitle,
          store_id: selectedStoreId,
        } as any)
        .select("id")
        .single();
      if (dayErr || !newDay) {
        toast({ title: "Error", description: dayErr?.message || "Failed to create store day", variant: "destructive" });
        setSaving(false);
        return;
      }
      targetDayId = (newDay as any).id;
    }

    const { error } = await supabase
      .from("tasks" as any)
      .insert({
        day_id: targetDayId,
        section: overrideTask.section,
        title: overrideTask.title,
        description: overrideTask.description,
        content_html: overrideTask.content_html,
        sort_order: overrideTask.sort_order,
        requires_upload: overrideTask.requires_upload,
        requires_rating: overrideTask.requires_rating,
      } as any);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Override Created", description: `Store-specific task created. Edit it to customize.` });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      setOverrideTask(null);
      setSelectedStoreId("");
    }
  };

  const isLoading = daysLoading || tasksLoading;

  return (
    <AppShell>
      <div className="px-4 py-4 animate-fade-in space-y-4 max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl font-bold text-foreground">Content Admin</h1>
          <p className="text-sm text-muted-foreground">Manage training content for all 20 days</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {(days || []).map((day) => {
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
                        const Icon = sectionIcons[section] || BookOpen;

                        return (
                          <div key={section} className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="h-4 w-4 text-secondary" />
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
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => { setPreviewTask(task); }}
                                      title="Preview"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setEditingTask(task);
                                        setEditHtml(task.content_html || "");
                                        setEditTitle(task.title);
                                      }}
                                      title="Edit"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => { setOverrideTask(task); }}
                                      title="Create Store Override"
                                    >
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
                <div className="prose prose-sm max-w-none p-4 border rounded-lg bg-card" dangerouslySetInnerHTML={{ __html: editHtml || "<p class='text-muted-foreground'>No content yet</p>" }} />
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
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewTask?.content_html || "<p class='text-muted-foreground'>No content available</p>" }} />
        </DialogContent>
      </Dialog>

      {/* Override Dialog */}
      <Dialog open={!!overrideTask} onOpenChange={(open) => !open && setOverrideTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Store Override</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Create a store-specific version of "<strong>{overrideTask?.title}</strong>" that can be customized independently.
          </p>
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a store" />
            </SelectTrigger>
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
