import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingUploads, useProfiles } from "@/hooks/useOnboardingData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Video, Image, FileText, Clock, Inbox } from "lucide-react";
import { relativeTime } from "@/lib/dateUtils";
import { useEffect } from "react";

function FileTypeIcon({ type }: { type: string }) {
  if (type === "video") return <Video className="h-5 w-5 text-secondary" />;
  if (type === "image") return <Image className="h-5 w-5 text-secondary" />;
  return <FileText className="h-5 w-5 text-secondary" />;
}

export default function ReviewsListPage() {
  const navigate = useNavigate();
  const { data: pendingUploads, isLoading } = usePendingUploads();

  useEffect(() => { document.title = "Pending Reviews — WEAuto"; }, []);

  const uploaderIds = pendingUploads?.map((u) => u.uploaded_by) || [];
  const taskIds = pendingUploads?.map((u) => u.task_id) || [];
  const { data: profiles } = useProfiles([...new Set(uploaderIds)]);
  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

  const { data: tasks } = useQuery({
    queryKey: ["tasks-for-reviews", taskIds],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("id, title")
        .in("id", [...new Set(taskIds)]);
      if (error) throw error;
      return data as any[];
    },
  });
  const taskMap = new Map(tasks?.map((t: any) => [t.id, t]));

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pending Reviews</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Loading…" : `${pendingUploads?.length || 0} deliverable${(pendingUploads?.length || 0) !== 1 ? "s" : ""} awaiting review`}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : !pendingUploads?.length ? (
          <Card className="p-8 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">No deliverables pending review.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {pendingUploads.map((upload) => {
              const profile = profileMap.get(upload.uploaded_by);
              const task = taskMap.get(upload.task_id);
              return (
                <Card
                  key={upload.id}
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.99]"
                  onClick={() => navigate(`/review/${upload.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <FileTypeIcon type={upload.file_type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {task?.title || "Task"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {profile?.full_name || "Associate"} · {upload.file_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-warning flex-shrink-0">
                      <Clock className="h-4 w-4" />
                      <span className="text-[11px] font-medium">{relativeTime(upload.uploaded_at)}</span>
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
