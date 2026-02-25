import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useCreateTemplate } from "@/hooks/useTemplates";
import { useDepartments } from "@/hooks/useOnboardingData";
import type { Department } from "@/hooks/useOnboardingData";
import { useToast } from "@/hooks/use-toast";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

export default function CreateTemplatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const { data: departments } = useDepartments();
  const createTemplate = useCreateTemplate();

  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState(searchParams.get("department") || "");
  const [description, setDescription] = useState("");
  const [totalDays, setTotalDays] = useState<number | "">(0);

  useEffect(() => {
    document.title = "New Template — WEAuto";
  }, []);

  // Pre-fill totalDays when department changes
  useEffect(() => {
    if (departmentId && departments) {
      const dept = departments.find((d) => d.id === departmentId);
      if (dept?.typical_duration_days) {
        setTotalDays(dept.typical_duration_days);
      }
    }
  }, [departmentId, departments]);

  // Default department from URL param
  useEffect(() => {
    if (!departmentId && departments?.length) {
      const paramDept = searchParams.get("department");
      if (paramDept) setDepartmentId(paramDept);
    }
  }, [departments, searchParams, departmentId]);

  const handleCreate = async () => {
    if (!name.trim() || !departmentId) return;
    try {
      const result = await createTemplate.mutateAsync({
        name: name.trim(),
        department_id: departmentId,
        description: description.trim() || undefined,
        total_days: totalDays ? Number(totalDays) : undefined,
      });
      toast({ title: "Template created!", description: "Start adding days and tasks." });
      navigate(`/templates/${result.id}/edit`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-lg mx-auto animate-fade-in space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/content-admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Create New Program</h1>
        </div>

        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Program Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Service Advisor Onboarding"
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this program cover?"
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Number of Days</Label>
            <Input
              type="number"
              min={1}
              max={90}
              value={totalDays}
              onChange={(e) => setTotalDays(e.target.value ? parseInt(e.target.value) : "")}
              className="h-12 w-32"
            />
          </div>

          <Button
            className="w-full h-12 text-base font-semibold"
            disabled={!name.trim() || !departmentId || createTemplate.isPending}
            onClick={handleCreate}
          >
            {createTemplate.isPending ? "Creating…" : "Create Program"}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
