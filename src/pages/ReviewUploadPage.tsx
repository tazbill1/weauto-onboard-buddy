import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Check, X, Download } from "lucide-react";
import { relativeTime } from "@/lib/dateUtils";

function useSignedUrl(filePath: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!filePath) return;
    // If it's already a full URL (legacy), use directly
    if (filePath.startsWith("http")) {
      setUrl(filePath);
      return;
    }
    supabase.storage.from("deliverables").createSignedUrl(filePath, 1800).then(({ data }) => {
      setUrl(data?.signedUrl || null);
    });
  }, [filePath]);
  return url;
}

export default function ReviewUploadPage() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = "Review Upload — WEAuto"; }, []);

  const { data: upload, isLoading } = useQuery({
    queryKey: ["upload", uploadId],
    enabled: !!uploadId,
    queryFn: async () => {
      const { data, error } = await supabase.from("uploads" as any).select("*").eq("id", uploadId!).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: task } = useQuery({
    queryKey: ["task", upload?.task_id],
    enabled: !!upload?.task_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks" as any).select("*").eq("id", upload.task_id).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: associateProfile } = useQuery({
    queryKey: ["profile", upload?.uploaded_by],
    enabled: !!upload?.uploaded_by,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name, email").eq("user_id", upload.uploaded_by).single();
      if (error) throw error;
      return data;
    },
  });

  const handleAction = async (action: "approved" | "rejected") => {
    if (!user || !uploadId || !upload) return;
    if (action === "rejected" && !notes.trim()) {
      toast({ title: "Notes required", description: "Please explain what needs improvement.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("uploads" as any)
        .update({ status: action, reviewed_by: user.id, review_notes: notes || null, reviewed_at: new Date().toISOString() } as any)
        .eq("id", uploadId);
      if (error) throw error;

      if (action === "approved") {
        await supabase
          .from("task_completions" as any)
          .upsert({ program_id: upload.program_id, task_id: upload.task_id, associate_id: upload.uploaded_by, status: "completed", completed_at: new Date().toISOString() } as any, { onConflict: "program_id,task_id" });
      }

      queryClient.invalidateQueries({ queryKey: ["uploads"] });
      queryClient.invalidateQueries({ queryKey: ["pending-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      toast({ title: action === "approved" ? "✅ Approved!" : "Revision requested" });
      navigate(-1);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const fileUrl = useSignedUrl(upload?.file_url);
  const isVideo = upload?.file_type === "video";
  const isImage = upload?.file_type === "image";
  const isPDF = upload?.file_type === "pdf" || upload?.file_name?.toLowerCase().endsWith(".pdf");

  return (
    <AppShell>
      <div className="px-4 py-4 animate-fade-in space-y-4">
        <Button variant="ghost" size="sm" className="gap-1 -ml-2 text-muted-foreground" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : !upload ? (
          <Card className="p-5 text-center text-muted-foreground">Upload not found.</Card>
        ) : (
          <>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{associateProfile?.full_name || "Associate"}</p>
              <h1 className="text-lg font-bold text-foreground mt-0.5">{task?.title || "Task"}</h1>
              <p className="text-xs text-muted-foreground mt-1">{upload.file_name} · {relativeTime(upload.uploaded_at)}</p>
            </Card>

            <Card className="overflow-hidden">
              {isVideo ? (
                <video controls playsInline className="w-full max-h-[60vh]" src={fileUrl || ""} />
              ) : isImage ? (
                <img src={fileUrl || ""} alt={upload.file_name} className="w-full max-h-[60vh] object-contain" loading="lazy" />
              ) : isPDF ? (
                <div className="w-full">
                  <iframe
                    src={fileUrl || ""}
                    title={upload.file_name}
                    className="w-full h-[60vh] border-0"
                  />
                  <div className="p-3 border-t text-center">
                    <a href={fileUrl || "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-secondary underline">
                      <Download className="h-3.5 w-3.5" /> Open in new tab
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <a href={fileUrl || "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-secondary underline">
                    <Download className="h-4 w-4" /> Download {upload.file_name}
                  </a>
                </div>
              )}
            </Card>

            {upload.status === "pending_review" && (
              <>
                <Card className="p-4 space-y-2">
                  <h3 className="text-sm font-bold text-foreground">Review Notes</h3>
                  <Textarea placeholder="Add notes (required for revision requests)..." value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px] text-sm" rows={3} />
                </Card>

                <div className="flex gap-3">
                  <Button
                    className="flex-1 h-12 bg-success hover:bg-success/90 text-success-foreground gap-1.5"
                    disabled={submitting}
                    onClick={() => handleAction("approved")}
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <ConfirmDialog
                    title="Request Revision?"
                    description="Are you sure you want to request a revision? The associate will need to resubmit."
                    confirmLabel="Request Revision"
                    confirmVariant="destructive"
                    onConfirm={() => handleAction("rejected")}
                    disabled={submitting}
                    trigger={
                      <Button variant="destructive" className="flex-1 h-12 gap-1.5">
                        <X className="h-4 w-4" /> Request Revision
                      </Button>
                    }
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
