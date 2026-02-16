import { useEffect, useState } from "react";
import { Check, PartyPopper, Trophy } from "lucide-react";

export function TaskCompleteAnim({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (show) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 1200);
      return () => clearTimeout(t);
    }
  }, [show]);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="animate-scale-in">
        <div className="h-16 w-16 rounded-full bg-success flex items-center justify-center shadow-lg">
          <Check className="h-8 w-8 text-success-foreground" />
        </div>
      </div>
    </div>
  );
}

export function DayCompleteAnim({ dayNumber, show }: { dayNumber: number; show: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (show) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(t);
    }
  }, [show]);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
      <div className="animate-scale-in flex flex-col items-center text-center px-8">
        <PartyPopper className="h-16 w-16 text-warning mb-4" />
        <h2 className="text-2xl font-bold text-foreground">Day {dayNumber} Complete!</h2>
        <p className="text-sm text-muted-foreground mt-1">Great work — keep it up!</p>
      </div>
    </div>
  );
}

export function ProgramCompleteAnim({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (show) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(t);
    }
  }, [show]);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md">
      <div className="animate-scale-in flex flex-col items-center text-center px-8">
        <Trophy className="h-20 w-20 text-warning mb-4" />
        <h1 className="text-3xl font-bold text-foreground">Congratulations! 🎉</h1>
        <p className="text-base text-muted-foreground mt-2">
          You've completed the WEAuto Onboarding Program!
        </p>
        <p className="text-sm text-muted-foreground mt-1">Welcome to the team.</p>
      </div>
    </div>
  );
}
