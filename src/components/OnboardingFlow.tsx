import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, X, Rocket, BarChart3, Users } from "lucide-react";

const ONBOARDING_KEY = "weauto_onboarding_seen";

interface OnboardingFlowProps {
  onComplete: () => void;
}

const screens = [
  {
    icon: Rocket,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    title: "Welcome to WEAuto Onboarding",
    description:
      "Your 20-day journey to becoming a sales professional starts here.",
  },
  {
    icon: BarChart3,
    iconBg: "bg-success/10",
    iconColor: "text-success",
    title: "Track Your Progress",
    description:
      "Complete daily tasks, upload deliverables, and get real-time feedback from your manager.",
  },
  {
    icon: Users,
    iconBg: "bg-secondary/10",
    iconColor: "text-secondary",
    title: "Let's Get Started",
    description:
      "Your manager will guide you through each day. Tap any day to see your tasks.",
  },
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState(0);

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };

  const next = () => {
    if (current < screens.length - 1) setCurrent(current + 1);
    else handleComplete();
  };

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart - e.changedTouches[0].clientX;
    if (diff > 50 && current < screens.length - 1) setCurrent(current + 1);
    if (diff < -50 && current > 0) setCurrent(current - 1);
  };

  const screen = screens[current];
  const Icon = screen.icon;

  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-8"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip */}
      <button
        onClick={handleComplete}
        className="absolute top-4 right-4 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 safe-area-top"
      >
        Skip <X className="h-4 w-4" />
      </button>

      {/* Content */}
      <div className="flex flex-col items-center text-center max-w-sm animate-fade-in" key={current}>
        <div className={`h-24 w-24 rounded-3xl flex items-center justify-center mb-8 ${screen.iconBg}`}>
          <Icon className={`h-12 w-12 ${screen.iconColor}`} />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">{screen.title}</h1>
        <p className="text-base text-muted-foreground leading-relaxed">{screen.description}</p>
      </div>

      {/* Bottom */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6 px-8 safe-area-bottom">
        {/* Dots */}
        <div className="flex gap-2">
          {screens.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${
                i === current ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {current === screens.length - 1 ? (
          <Button className="w-full h-12 text-base font-semibold" onClick={handleComplete}>
            Get Started <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        ) : (
          <Button variant="ghost" className="text-base" onClick={next}>
            Next <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function useShowOnboarding() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) setShow(true);
  }, []);
  return { show, dismiss: () => setShow(false) };
}
