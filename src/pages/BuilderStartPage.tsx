import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useDepartments } from "@/hooks/useOnboardingData";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, Wrench, Phone, DollarSign, Package, Sparkles, Settings, ArrowLeft,
} from "lucide-react";

const deptIcons: Record<string, typeof TrendingUp> = {
  sales: TrendingUp,
  service_advisor: Wrench,
  bdc: Phone,
  finance: DollarSign,
  parts: Package,
  detailing: Sparkles,
};

export default function BuilderStartPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: departments, isLoading } = useDepartments();

  const preselectedDept = searchParams.get("department");
  const [selectedDeptId, setSelectedDeptId] = useState<string>(preselectedDept || "");
  const [programName, setProgramName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleStart = async () => {
    if (!selectedDeptId || !profile?.user_id) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("builder_sessions" as any)
        .insert({
          user_id: profile.user_id,
          department_id: selectedDeptId,
          program_name: programName || null,
          status: "active",
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      navigate(`/builder/${(data as any).id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <div className="px-4 py-4 max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate("/content-admin")} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-foreground">Build an Onboarding Program</h1>
          <p className="text-sm text-muted-foreground">
            Choose a department and let AI help you create a structured training program
          </p>
        </div>

        {/* Department selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Department</label>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {departments?.filter(d => d.is_active).map((dept) => {
                const Icon = deptIcons[dept.slug] || Settings;
                const isSelected = selectedDeptId === dept.id;
                return (
                  <Card
                    key={dept.id}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "ring-2 ring-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedDeptId(dept.id)}
                  >
                    <Icon className={`h-5 w-5 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-sm font-semibold">{dept.label}</p>
                    {dept.typical_duration_days && (
                      <p className="text-xs text-muted-foreground">{dept.typical_duration_days} days typical</p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Program name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Program Name (optional)</label>
          <Input
            placeholder="e.g. Sales Associate Onboarding v2"
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
          />
        </div>

        <Button
          className="w-full gap-2"
          size="lg"
          disabled={!selectedDeptId || creating}
          onClick={handleStart}
        >
          <Sparkles className="h-4 w-4" />
          {creating ? "Starting…" : "Start Building"}
        </Button>
      </div>
    </AppShell>
  );
}
