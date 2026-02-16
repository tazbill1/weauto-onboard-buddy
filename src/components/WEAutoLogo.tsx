export function WEAutoLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
        <span className="text-sm font-bold text-primary-foreground tracking-tight">WE</span>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-base font-bold text-foreground tracking-tight">WEAuto</span>
        <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">Onboarding</span>
      </div>
    </div>
  );
}
