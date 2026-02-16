import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Plus, CheckCircle2, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAllPrograms,
  useAllProfiles,
  useStores,
} from "@/hooks/useDashboardData";

export default function HRAdminPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: programs, isLoading } = useAllPrograms();
  const { data: profiles } = useAllProfiles();
  const { data: stores } = useStores();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAssociate, setSelectedAssociate] = useState("");
  const [selectedManager, setSelectedManager] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [creating, setCreating] = useState(false);

  const profileMap = useMemo(() => new Map(profiles?.map((p) => [p.user_id, p])), [profiles]);
  const storeMap = useMemo(() => new Map(stores?.map((s) => [s.id, s])), [stores]);

  // Filter by HR's store
  const storeId = profile?.store_id;
  const storePrograms = useMemo(
    () => programs?.filter((p) => !storeId || p.store_id === storeId) || [],
    [programs, storeId]
  );

  // Associates without active programs (for the "Start New" form)
  const availableAssociates = useMemo(() => {
    if (!profiles || !programs) return [];
    const activeAssociateIds = new Set(programs.filter((p) => p.status === "active").map((p) => p.associate_id));
    return profiles.filter(
      (p) => p.role === "associate" && !activeAssociateIds.has(p.user_id) && (!storeId || p.store_id === storeId)
    );
  }, [profiles, programs, storeId]);

  const managers = useMemo(() => {
    if (!profiles) return [];
    return profiles.filter(
      (p) => ["sales_manager", "gm"].includes(p.role) && (!storeId || p.store_id === storeId)
    );
  }, [profiles, storeId]);

  const handleCreate = async () => {
    if (!selectedAssociate || !selectedManager || !startDate) {
      toast({ title: "Missing fields", description: "Please fill all fields.", variant: "destructive" });
      return;
    }
    const assocProfile = profileMap.get(selectedAssociate);
    const assocStoreId = assocProfile?.store_id;
    if (!assocStoreId) {
      toast({ title: "Error", description: "Associate has no store assigned.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from("onboarding_programs" as any).insert({
        associate_id: selectedAssociate,
        manager_id: selectedManager,
        store_id: assocStoreId,
        start_date: format(startDate, "yyyy-MM-dd"),
        status: "active",
        current_day: 1,
      } as any);
      if (error) throw error;
      toast({ title: "Program created!", description: "Onboarding has been started." });
      setDialogOpen(false);
      setSelectedAssociate("");
      setSelectedManager("");
      setStartDate(undefined);
      queryClient.invalidateQueries({ queryKey: ["all-programs"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Compute expected completion date (20 business days ≈ 28 calendar days from start)
  const getExpectedEnd = (startDate: string) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + 28);
    return format(d, "MMM d, yyyy");
  };

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Team Status</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> Start Onboarding
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Onboarding</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-foreground">Associate</label>
                  <Select value={selectedAssociate} onValueChange={setSelectedAssociate}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select associate..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAssociates.map((a) => (
                        <SelectItem key={a.user_id} value={a.user_id}>
                          {a.full_name || a.email}
                        </SelectItem>
                      ))}
                      {!availableAssociates.length && (
                        <SelectItem value="none" disabled>No available associates</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Manager</label>
                  <Select value={selectedManager} onValueChange={setSelectedManager}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select manager..." />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name || m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left mt-1", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={creating}>
                  {creating ? "Creating..." : "Create Program"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Team List */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : !storePrograms.length ? (
          <Card className="p-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No onboarding programs yet</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {storePrograms.map((program) => {
              const p = profileMap.get(program.associate_id);
              const mgr = profileMap.get(program.manager_id);
              const isCompleted = program.status === "completed";
              const initials = (p?.full_name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

              return (
                <Card key={program.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{p?.full_name || "Unknown"}</span>
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">
                            <CheckCircle2 className="h-3 w-3" /> Certified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                            <Clock className="h-3 w-3" /> Active
                          </span>
                        )}
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                        <span>Start: {program.start_date}</span>
                        {isCompleted && program.actual_end_date ? (
                          <span>Completed: {program.actual_end_date}</span>
                        ) : (
                          <span>Expected: {getExpectedEnd(program.start_date)}</span>
                        )}
                        {!isCompleted && <span>Day {program.current_day} / 20</span>}
                        <span>Manager: {mgr?.full_name || "—"}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
