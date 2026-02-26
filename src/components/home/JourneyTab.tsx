import { DayTimeline } from "@/components/DayTimeline";
import { EmptyState } from "@/components/ErrorStates";
import { MapIcon } from "lucide-react";
import type { Day } from "@/hooks/useOnboardingData";

interface JourneyTabProps {
  days: Day[] | undefined;
  currentDay: number;
  completedDays: Set<number>;
}

export function JourneyTab({ days, currentDay, completedDays }: JourneyTabProps) {
  if (!days || days.length === 0) {
    return (
      <EmptyState
        icon={MapIcon}
        title="Journey not available yet"
        description="Your training journey will appear here once your program is set up."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Your Journey</h2>
        <p className="text-sm text-muted-foreground">Track your progress through each training day.</p>
      </div>
      <DayTimeline days={days} currentDay={currentDay} completedDays={completedDays} />
    </div>
  );
}
