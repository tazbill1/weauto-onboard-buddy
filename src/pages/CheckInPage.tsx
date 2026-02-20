import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useDays,
  useTasksForDay,
  useProfiles,
  useRatingsForProgram,
  useUpsertRating,
  useSignOffDay,
  useUploadsForProgram,
  getPhaseLabel,
  type OnboardingProgram,
  type UploadRecord,
} from "@/hooks/useOnboardingData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Check, AlertTriangle, X, Video, Image, FileText, ExternalLink } from "lucide-react";


const RATING_OPTIONS = [
  { value: "meets_expectation", label: "Meets Expectation", icon: Check, color: "bg-success text-success-foreground", ring: "ring-success/30" },
  { value: "needs_work", label: "Needs Work", icon: AlertTriangle, color: "bg-warning text-warning-foreground", ring: "ring-warning/30" },
  { value: "not_attempted", label: "Not Attempted", icon: X, color: "bg-destructive text-destructive-foreground", ring: "ring-destructive/30" },
] as const;

function UploadPreview({ upload }: { upload: UploadRecord }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!upload.file_url) return;
    let path = upload.file_url;
    if (path.startsWith("http")) {
      const marker = "/deliverables/";
      const idx = path.indexOf(marker);
      if (idx !== -1) path = path.substring(idx + marker.length);
    }
    supabase.storage.from("deliverables").createSignedUrl(path, 1800)
      .then(({ data }) => { if (data?.signedUrl) setSignedUrl(data.signedUrl); });
  }, [upload.file_url]);

  if (!signedUrl) return <div className="h-32 rounded-lg bg-muted animate-pulse" />;

  if (upload.file_type === "video") {
    return <video src={signedUrl} controls className="w-full rounded-lg max-h-48" />;
  }
  if (upload.file_type === "image") {
    return <img src={signedUrl} alt={upload.file_name} className="w-full rounded-lg max-h-48 object-contain bg-muted" />;
  }
  if (upload.file_name?.endsWith(".pdf")) {
    return <iframe src={signedUrl} title={upload.file_name} className="w-full h-48 rounded-lg border" />;
  }
  return null;
}
export default function CheckInPage() {
  const { programId, dayNumber } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const dayNum = parseInt(dayNumber || "1", 10);

  useEffect(() => { document.title = `Check-in Day ${dayNum} — WEAuto`; }, [dayNum]);

  const { data: program } = useQuery({
    queryKey: ["program", programId],
    enabled: !!programId,
    queryFn: async () => {
      const { data, error } = await supabase.from("onboarding_programs" as any).select("*").eq("id", programId!).single();
      if (error) throw error;
      return data as unknown as OnboardingProgram;
    },
  });

  const { data: days } = useDays();
  const day = days?.find((d) => d.day_number === dayNum);
  const { data: tasks, isLoading } = useTasksForDay(day?.id);
  const { data: existingRatings } = useRatingsForProgram(programId);
  const { data: uploads } = useUploadsForProgram(programId);
  const { data: profiles } = useProfiles(program ? [program.associate_id] : []);
  const associateProfile = profiles?.[0];

  const upsertRating = useUpsertRating();
  const signOffDay = useSignOffDay();

  const rateableTasks = useMemo(() => tasks?.filter((t) => t.requires_rating) || [], [tasks]);

  // Map task_id -> upload for tasks on this day
  const uploadMap = useMemo(() => {
    const map = new Map<string, UploadRecord>();
    const dayTaskIds = new Set(tasks?.map((t) => t.id) || []);
    uploads?.forEach((u) => { if (dayTaskIds.has(u.task_id)) map.set(u.task_id, u); });
    return map;
  }, [uploads, tasks]);

  const [localRatings, setLocalRatings] = useState<Record<string, string>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [overallNotes, setOverallNotes] = useState("");
  const [signingOff, setSigningOff] = useState(false);

  const ratingMap = useMemo(() => {
    const map: Record<string, string> = {};
    existingRatings?.forEach((r) => { map[r.task_id] = r.rating; });
    return { ...map, ...localRatings };
  }, [existingRatings, localRatings]);

  const notesMap = useMemo(() => {
    const map: Record<string, string> = {};
    existingRatings?.forEach((r) => { if (r.notes) map[r.task_id] = r.notes; });
    return { ...map, ...localNotes };
  }, [existingRatings, localNotes]);

  const allRated = rateableTasks.every((t) => ratingMap[t.id]);

  const handleRate = (taskId: string, rating: string) => {
    setLocalRatings((prev) => ({ ...prev, [taskId]: rating }));
    if (user && programId) {
      upsertRating.mutate({ programId, taskId, ratedBy: user.id, rating, notes: localNotes[taskId] || notesMap[taskId] || null });
    }
  };

  const handleNotes = (taskId: string, notes: string) => {
    setLocalNotes((prev) => ({ ...prev, [taskId]: notes }));
  };

  const handleNoteBlur = (taskId: string) => {
    if (user && programId && ratingMap[taskId]) {
      upsertRating.mutate({ programId, taskId, ratedBy: user.id, rating: ratingMap[taskId], notes: localNotes[taskId] || notesMap[taskId] || null });
    }
  };

  const [signedOffSuccess, setSignedOffSuccess] = useState(false);

  const handleSignOff = async () => {
    if (!user || !programId) return;
    setSigningOff(true);
    try {
      await signOffDay.mutateAsync({ programId, dayNumber: dayNum, managerId: user.id, overallNotes: overallNotes || null });
      toast({ title: `✅ Day ${dayNum} signed off!`, description: "Ratings have been saved." });
      setSignedOffSuccess(true);
    } catch {
      toast({ title: "Error", description: "Failed to sign off.", variant: "destructive" });
    } finally {
      setSigningOff(false);
    }
  };

  return (
    <AppShell>
      <div className="px-4 py-4 animate-fade-in space-y-4">
        <Button variant="ghost" size="sm" className="gap-1 -ml-2 text-muted-foreground" onClick={() => navigate("/")}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {isLoading || !day ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : (
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Check-in · {getPhaseLabel(day.phase)}</p>
            <h1 className="mt-1 text-lg font-bold text-foreground">Day {dayNum}: {day.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{associateProfile?.full_name || "Associate"}</p>
          </Card>
        )}

        {rateableTasks.length === 0 ? (
          <Card className="p-5 text-center text-sm text-muted-foreground">No tasks require rating for this day.</Card>
        ) : (
          <div className="space-y-3">
            {rateableTasks.map((task) => {
              const currentRating = ratingMap[task.id];
              const currentNotes = localNotes[task.id] ?? notesMap[task.id] ?? "";
              const upload = uploadMap.get(task.id);

              return (
                <Card key={task.id} className="p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{task.title}</h3>
                    {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                  </div>

                  {upload && (
                    <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {upload.file_type === "video" ? <Video className="h-4 w-4 text-secondary" /> :
                         upload.file_type === "image" ? <Image className="h-4 w-4 text-secondary" /> :
                         <FileText className="h-4 w-4 text-secondary" />}
                        <span className="text-xs font-medium text-foreground truncate flex-1">{upload.file_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-secondary"
                          onClick={(e) => { e.stopPropagation(); navigate(`/review/${upload.id}`); }}
                        >
                          <ExternalLink className="h-3 w-3" /> Review
                        </Button>
                      </div>
                      <UploadPreview upload={upload} />
                    </div>
                  )}

                  <div className="flex gap-2">
                    {RATING_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = currentRating === opt.value;
                      const needsConfirm = opt.value === "not_attempted" && !isSelected;

                      const ratingButton = (
                        <button
                          key={opt.value}
                          onClick={needsConfirm ? undefined : () => handleRate(task.id, opt.value)}
                          className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-3 px-2 border-2 transition-all touch-target ${
                            isSelected ? `${opt.color} border-transparent ring-4 ${opt.ring}` : "border-border bg-card hover:bg-muted/50"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[10px] font-semibold leading-tight text-center">{opt.label}</span>
                          {isSelected && <Check className="h-3 w-3" />}
                        </button>
                      );

                      if (needsConfirm) {
                        return (
                          <ConfirmDialog
                            key={opt.value}
                            title="Mark as Not Attempted?"
                            description="This will block day completion until addressed."
                            confirmLabel="Mark Not Attempted"
                            confirmVariant="destructive"
                            onConfirm={() => handleRate(task.id, opt.value)}
                            trigger={ratingButton}
                          />
                        );
                      }

                      return ratingButton;
                    })}
                  </div>

                  <Textarea
                    placeholder="Add notes (optional)..."
                    value={currentNotes}
                    onChange={(e) => handleNotes(task.id, e.target.value)}
                    onBlur={() => handleNoteBlur(task.id)}
                    className="min-h-[40px] text-sm resize-none"
                    rows={1}
                    onFocus={(e) => { e.target.rows = 3; (e.target as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" }); }}
                  />
                </Card>
              );
            })}
          </div>
        )}

        <Card className="p-4 space-y-2">
          <h3 className="text-sm font-bold text-foreground">Overall Day Notes</h3>
          <Textarea
            placeholder="Any additional observations about this day..."
            value={overallNotes}
            onChange={(e) => setOverallNotes(e.target.value)}
            className="min-h-[60px] text-sm"
            rows={3}
            onFocus={(e) => { (e.target as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" }); }}
          />
        </Card>

        {signedOffSuccess ? (
          <Card className="p-6 text-center space-y-4 border-success/30 bg-success/5">
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Day {dayNum} Signed Off!</h3>
              <p className="text-sm text-muted-foreground">Ratings and notes have been saved.</p>
            </div>
            <div className="flex flex-col gap-2">
              {dayNum < 20 && (
                <Button className="w-full h-12 text-base font-semibold" onClick={() => navigate(`/checkin/${programId}/${dayNum + 1}`)}>
                  Continue to Day {dayNum + 1} Check-In
                </Button>
              )}
              <Button variant="outline" className="w-full h-10" onClick={() => navigate("/")}>
                Back to Dashboard
              </Button>
            </div>
          </Card>
        ) : (
          <ConfirmDialog
            title={`Sign off on Day ${dayNum}?`}
            description={`Confirm sign-off for Day ${dayNum}? This will be recorded with your name and timestamp.`}
            confirmLabel={`Sign Off Day ${dayNum}`}
            onConfirm={handleSignOff}
            disabled={!allRated || signingOff}
            trigger={
              <Button className="w-full h-12 text-base font-semibold" disabled={!allRated || signingOff}>
                {signingOff
                  ? "Signing off..."
                  : allRated
                  ? `Sign Off on Day ${dayNum}`
                  : `Rate all tasks to sign off (${Object.keys(ratingMap).length}/${rateableTasks.length})`}
              </Button>
            }
          />
        )}
      </div>
    </AppShell>
  );
}
