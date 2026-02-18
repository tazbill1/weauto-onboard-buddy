import { Check, Camera, Clock, UserCheck } from "lucide-react";
import type { Task, TaskCompletion } from "@/hooks/useOnboardingData";

interface TaskItemProps {
  task: Task;
  completion?: TaskCompletion;
  onToggle: () => void;
  disabled?: boolean;
  /** When the task is a manager_checkin, pass whether the day has been signed off */
  managerSignedOff?: boolean;
}

export function TaskItem({ task, completion, onToggle, disabled, managerSignedOff }: TaskItemProps) {
  const isManagerCheckin = task.section === "manager_checkin";
  const isCompleted = isManagerCheckin ? !!managerSignedOff : completion?.status === "completed";
  const needsReview = completion?.status === "needs_review";

  return (
    <button
      onClick={isManagerCheckin ? undefined : onToggle}
      disabled={disabled || isManagerCheckin}
      className={`flex items-start gap-3 w-full text-left p-3 rounded-xl transition-colors touch-target ${
        isManagerCheckin ? "cursor-default opacity-90" : "hover:bg-muted/50"
      }`}
    >
      <div
        className={`mt-0.5 h-6 w-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
          isCompleted
            ? "bg-success border-success text-success-foreground"
            : needsReview
            ? "bg-warning/20 border-warning"
            : "border-border"
        }`}
      >
        {isCompleted && <Check className="h-3.5 w-3.5" />}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium leading-tight ${
            isCompleted ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
        )}
        {isManagerCheckin && (
          <p className={`text-xs mt-0.5 font-medium ${isCompleted ? "text-success" : "text-muted-foreground"}`}>
            {isCompleted ? "✓ Completed by manager" : "Pending manager check-in"}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        {task.requires_upload && (
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-full">
            <Camera className="h-3 w-3" />
          </span>
        )}
        {isManagerCheckin && (
          <span className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            isCompleted ? "text-success bg-success/10" : "text-muted-foreground bg-muted"
          }`}>
            <UserCheck className="h-3 w-3" />
          </span>
        )}
        {task.requires_rating && !isCompleted && !isManagerCheckin && (
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">
            <Clock className="h-3 w-3" />
            Review
          </span>
        )}
      </div>
    </button>
  );
}
