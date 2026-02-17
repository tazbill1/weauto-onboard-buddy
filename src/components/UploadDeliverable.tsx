import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, FileText, Video, Image, RotateCcw, Clock, Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface Upload {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  status: string;
  review_notes: string | null;
}

interface UploadDeliverableProps {
  programId: string;
  taskId: string;
  storeId: string;
  dayNumber: number;
  existingUpload?: Upload | null;
}

const ALLOWED_TYPES: Record<string, string[]> = {
  video: ["video/mp4", "video/quicktime"],
  image: ["image/jpeg", "image/png", "image/heic"],
  document: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

const ALL_ALLOWED = Object.values(ALLOWED_TYPES).flat();
const ACCEPT_STRING = ".mp4,.mov,.jpg,.jpeg,.png,.heic,.pdf,.docx";
const MAX_SIZE = 100 * 1024 * 1024; // 100MB

function getFileType(mimeType: string): string {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  return "document";
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: typeof Clock; className: string }> = {
    pending_review: { label: "Pending Review", icon: Clock, className: "bg-warning/10 text-warning" },
    approved: { label: "Approved", icon: Check, className: "bg-success/10 text-success" },
    rejected: { label: "Revision Needed", icon: X, className: "bg-destructive/10 text-destructive" },
  };
  const c = config[status] || config.pending_review;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${c.className}`}>
      <Icon className="h-3 w-3" /> {c.label}
    </span>
  );
}

function FileTypeIcon({ type }: { type: string }) {
  if (type === "video") return <Video className="h-4 w-4 text-secondary" />;
  if (type === "image") return <Image className="h-4 w-4 text-secondary" />;
  return <FileText className="h-4 w-4 text-secondary" />;
}

export function UploadDeliverable({ programId, taskId, storeId, dayNumber, existingUpload }: UploadDeliverableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!existingUpload?.file_url) return;
    if (existingUpload.file_url.startsWith("http")) {
      setSignedUrl(existingUpload.file_url);
      return;
    }
    supabase.storage.from("deliverables").createSignedUrl(existingUpload.file_url, 1800).then(({ data }) => {
      setSignedUrl(data?.signedUrl || null);
    });
  }, [existingUpload?.file_url]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!ALL_ALLOWED.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a video, image, or document.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 100MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const ext = file.name.split(".").pop();
      const filePath = `${storeId}/${programId}/${dayNumber}/${taskId}.${ext}`;
      const fileType = getFileType(file.type);

      setProgress(30);

      const { error: storageError } = await supabase.storage
        .from("deliverables")
        .upload(filePath, file, { upsert: true });

      if (storageError) throw storageError;
      setProgress(70);

      // Store the file path (not public URL) since bucket is private
      const fileUrl = filePath;

      if (existingUpload) {
        // Update existing upload (re-submit)
        const { error } = await supabase
          .from("uploads" as any)
          .update({
            file_url: fileUrl,
            file_type: fileType,
            file_name: file.name,
            file_size: file.size,
            status: "pending_review",
            reviewed_by: null,
            review_notes: null,
            reviewed_at: null,
            uploaded_at: new Date().toISOString(),
          } as any)
          .eq("id", existingUpload.id);
        if (error) throw error;
      } else {
        // Create new upload
        const { error } = await supabase
          .from("uploads" as any)
          .insert({
            program_id: programId,
            task_id: taskId,
            uploaded_by: user.id,
            file_url: fileUrl,
            file_type: fileType,
            file_name: file.name,
            file_size: file.size,
            status: "pending_review",
          } as any);
        if (error) throw error;
      }

      // Update task completion to needs_review
      await supabase
        .from("task_completions" as any)
        .upsert({
          program_id: programId,
          task_id: taskId,
          associate_id: user.id,
          status: "needs_review",
          completed_at: null,
        } as any, { onConflict: "program_id,task_id" });

      setProgress(100);
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      toast({ title: "Uploaded!", description: "Your deliverable has been submitted for review." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (uploading) {
    return (
      <div className="space-y-2 p-3 rounded-xl bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Upload className="h-4 w-4 animate-pulse" /> Uploading...
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    );
  }

  if (existingUpload) {
    return (
      <div className="p-3 rounded-xl bg-muted/30 space-y-2">
        <div className="flex items-center gap-2">
          <FileTypeIcon type={existingUpload.file_type} />
          <span className="text-xs text-foreground font-medium truncate flex-1">{existingUpload.file_name}</span>
          <StatusBadge status={existingUpload.status} />
        </div>

        {existingUpload.status === "rejected" && existingUpload.review_notes && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-2.5">
            <p className="text-xs font-semibold text-destructive mb-0.5">Revision needed:</p>
            <p className="text-xs text-foreground">{existingUpload.review_notes}</p>
          </div>
        )}

        {existingUpload.status === "rejected" && (
          <>
            <input ref={fileRef} type="file" accept={ACCEPT_STRING} className="hidden" onChange={handleFileSelect} />
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => fileRef.current?.click()}>
              <RotateCcw className="h-3.5 w-3.5" /> Resubmit
            </Button>
          </>
        )}

        {existingUpload.status === "approved" && signedUrl && (
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-secondary underline">
            View file
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept={ACCEPT_STRING} className="hidden" onChange={handleFileSelect} />
      <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => fileRef.current?.click()}>
        <Camera className="h-4 w-4" /> Upload Deliverable
      </Button>
    </div>
  );
}
