import { useNavigate } from "react-router-dom";
import type { Day } from "@/hooks/useOnboardingData";

interface DayTimelineProps {
  days: Day[];
  currentDay: number;
  completedDays: Set<number>;
}

export function DayTimeline({ days, currentDay, completedDays }: DayTimelineProps) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto pb-2 -mx-4 px-4">
      <div className="flex items-center gap-3 min-w-max py-1">
        {days.map((day) => {
          const isCompleted = completedDays.has(day.day_number);
          const isCurrent = day.day_number === currentDay;

          return (
            <button
              key={day.id}
              onClick={() => navigate(`/day/${day.day_number}`)}
              className="flex flex-col items-center gap-1 touch-target min-w-[44px]"
              title={day.title}
            >
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isCompleted
                    ? "bg-success text-success-foreground"
                    : isCurrent
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/30"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {day.day_number}
              </div>
              {isCurrent && (
                <span className="text-[9px] font-medium text-primary">Today</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
